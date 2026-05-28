"use client";

import { useCallback, useState } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { erc20Abi } from "@/lib/contracts/tokens";
import { shopAbi } from "@/lib/contracts/shop";
import { getShopAddress } from "@/lib/contracts/chains";
import { ACCEPTED_TOKENS, normalizePrice } from "@/lib/contracts/tokens";
import { selectMaxBalanceToken } from "@/lib/contracts/select-payment-token";
import { COACH_PACK_ITEMS } from "@/lib/contracts/shop-catalog";
import type { CoachPackSize } from "@/lib/contracts/shop-catalog";
import { waitForReceiptWithTimeout } from "@/lib/contracts/transaction-helpers";
import { isUserCancellation, isTransactionTimeout, classifyTxErrorKind } from "@/lib/errors";

export type CoachCreditsPurchaseInjected = {
  address?: `0x${string}`;
  chainId?: number;
  sendPurchase?: (itemId: number, paymentToken: `0x${string}`) => Promise<`0x${string}`>;
  tokenBalances?: Record<`0x${string}`, bigint>;
};

export type CoachCreditsPurchaseInput = {
  walletAddress?: `0x${string}`;
  injected?: CoachCreditsPurchaseInjected;
  /** Fired when the purchase machine emits telemetry-worthy events. Consumer
   *  fires the actual track() with the right surface dim. */
  onPurchaseTelemetry?: (event: {
    stage: "request" | "submitted" | "confirmed" | "failed";
    itemId: number;
    txHash?: `0x${string}`;
    error?: string;
  }) => void;
  /** Fired when the contract write completes successfully — the consumer
   *  may need to refresh credits, fire UI updates, etc. */
  onPurchaseSuccess?: (itemId: number, txHash: `0x${string}`) => void;
};

export type CoachCreditsPurchaseState = {
  isProcessing: boolean;
  error: string | null;
  /** Last-completed tx hash (for receipt links etc.). Resets on next call. */
  lastTxHash: `0x${string}` | null;
  buyCredits: (itemId: number) => Promise<void>;
  reset: () => void;
};

/**
 * Coach credits purchase — transplanted from arena/page.tsx:handleBuyCredits (T5c).
 * Owns the approve→buyItem→verify-purchase sequence for coach credit packs.
 * Telemetry stripped; consumer receives events via onPurchaseTelemetry /
 * onPurchaseSuccess callbacks. Behind feature flag
 * NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOKS — default OFF.
 */
export function useCoachCreditsPurchase(input: CoachCreditsPurchaseInput): CoachCreditsPurchaseState {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | null>(null);

  // Wagmi reads — accept injected overrides for VR fixtures / tests
  const wagmiAccount = useAccount();
  const wagmiChainId = useChainId();
  const writeContractFromWagmi = useWriteContract();
  const publicClientFromWagmi = usePublicClient();

  const address = input.injected?.address ?? input.walletAddress ?? wagmiAccount.address;
  const chainId = input.injected?.chainId ?? wagmiChainId;

  const reset = useCallback(() => {
    setError(null);
    setLastTxHash(null);
  }, []);

  const buyCredits = useCallback(
    async (itemId: number) => {
      // Look up pack entry by itemId number
      const packEntry = (Object.entries(COACH_PACK_ITEMS) as Array<[string, { itemId: bigint; priceUsd6: bigint }]>)
        .find(([, entry]) => Number(entry.itemId) === itemId);

      if (!packEntry) {
        setError(`Unknown coach item id: ${itemId}`);
        return;
      }

      const [, { itemId: itemIdBigInt, priceUsd6 }] = packEntry;

      if (!address) {
        setError("Wallet not connected");
        return;
      }

      // Injected sendPurchase path (used in tests / VR fixtures) — bypasses
      // shopAddress lookup and wagmi writes entirely.
      if (input.injected?.sendPurchase) {
        setIsProcessing(true);
        setError(null);
        setLastTxHash(null);
        try {
          // For injected path, select best token from injected balances if available,
          // or fall back to first ACCEPTED_TOKEN
          const tokenBalancesRecord = input.injected.tokenBalances;
          let paymentToken: `0x${string}`;
          if (tokenBalancesRecord) {
            const balances = ACCEPTED_TOKENS.map((t) => {
              const bal = tokenBalancesRecord[t.address];
              return bal !== undefined
                ? ({ status: "success" as const, result: bal })
                : ({ status: "failure" as const });
            });
            const best = selectMaxBalanceToken(ACCEPTED_TOKENS, balances, priceUsd6);
            paymentToken = best?.address ?? ACCEPTED_TOKENS[0].address;
          } else {
            paymentToken = ACCEPTED_TOKENS[0].address;
          }

          const txHash = await input.injected.sendPurchase(itemId, paymentToken);
          setLastTxHash(txHash);
          input.onPurchaseTelemetry?.({ stage: "confirmed", itemId, txHash });
          input.onPurchaseSuccess?.(itemId, txHash);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Purchase failed";
          setError(msg);
          input.onPurchaseTelemetry?.({ stage: "failed", itemId, error: msg });
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      // Real wagmi path — requires a resolvable shop address
      const shopAddress = getShopAddress(chainId);
      if (!shopAddress) {
        setError("Shop unavailable on this chain");
        return;
      }

      const publicClient = publicClientFromWagmi;
      const writeContractAsync = writeContractFromWagmi.writeContractAsync;

      if (!publicClient) {
        setError("Public client unavailable");
        return;
      }

      // Select payment token from live balances
      // We need balances — but the hook doesn't own the useReadContracts call.
      // The token list is small (2-3 tokens); fetch allowances directly.
      // For balance-based selection we use an approximation: attempt tokens
      // in order and pick the first with sufficient allowance/balance.
      // A richer approach would inject tokenBalances from the consumer, which
      // is wired at T9. For now replicate the arena/page.tsx logic:
      // selectPaymentToken needs balances from useReadContracts, which arena
      // owns. Since we can't call hooks conditionally here, we do a live
      // eth_call for each token's balanceOf to replicate the behavior.
      let paymentToken: `0x${string}` | null = null;
      try {
        const normalizedTotal = normalizePrice(priceUsd6, 6); // USD6 base
        const balanceResults = await Promise.all(
          ACCEPTED_TOKENS.map((t) =>
            publicClient.readContract({
              address: t.address,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address as `0x${string}`],
            }).then((bal) => ({ status: "success" as const, result: bal as bigint }))
              .catch(() => ({ status: "failure" as const }))
          )
        );
        const best = selectMaxBalanceToken(ACCEPTED_TOKENS, balanceResults, normalizedTotal);
        paymentToken = best?.address ?? null;
      } catch {
        paymentToken = null;
      }

      if (!paymentToken) {
        setError("Insufficient token balance");
        return;
      }

      const token = ACCEPTED_TOKENS.find((t) => t.address === paymentToken)!;
      const normalizedTotal = normalizePrice(priceUsd6, token.decimals);
      const itemIdNum = Number(itemIdBigInt);

      setIsProcessing(true);
      setError(null);
      setLastTxHash(null);
      input.onPurchaseTelemetry?.({ stage: "request", itemId });

      try {
        // 1. Check allowance and approve if needed
        const allowance = await publicClient.readContract({
          address: token.address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address as `0x${string}`, shopAddress],
        });

        if ((allowance as bigint) < normalizedTotal) {
          const approveHash = await writeContractAsync({
            address: token.address,
            abi: erc20Abi,
            functionName: "approve",
            args: [shopAddress, normalizedTotal],
            chainId,
            account: address as `0x${string}`,
          });
          await waitForReceiptWithTimeout(publicClient, approveHash);
        }

        // 2. Buy item from shop
        const buyHash = await writeContractAsync({
          address: shopAddress,
          abi: shopAbi,
          functionName: "buyItem",
          args: [itemIdBigInt, 1n, token.address],
          chainId,
          account: address as `0x${string}`,
        });
        input.onPurchaseTelemetry?.({ stage: "submitted", itemId, txHash: buyHash });
        await waitForReceiptWithTimeout(publicClient, buyHash);

        // 3. Verify purchase and credit wallet
        const verifyRes = await fetch("/api/coach/verify-purchase", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ txHash: buyHash, walletAddress: address }),
        });
        const verifyData = await verifyRes.json();

        const finalHash = buyHash;
        setLastTxHash(finalHash);
        input.onPurchaseTelemetry?.({ stage: "confirmed", itemId: itemIdNum, txHash: finalHash });

        if (verifyData.ok) {
          input.onPurchaseSuccess?.(itemIdNum, finalHash);
        }
      } catch (err) {
        let errorMsg: string;
        if (isUserCancellation(err)) {
          errorMsg = "cancelled";
        } else if (isTransactionTimeout(err)) {
          errorMsg = "timeout";
          console.warn("[CoachPurchase] timeout", err instanceof Error ? err.message : "");
        } else {
          errorMsg = classifyTxErrorKind(err);
          console.warn("[CoachPurchase] error", err instanceof Error ? err.message : "");
        }
        setError(errorMsg);
        input.onPurchaseTelemetry?.({ stage: "failed", itemId, error: errorMsg });
        // Stay on paywall so user can retry or use quick review
      } finally {
        setIsProcessing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      address,
      chainId,
      publicClientFromWagmi,
      writeContractFromWagmi.writeContractAsync,
      input.injected,
      input.onPurchaseTelemetry,
      input.onPurchaseSuccess,
    ],
  );

  return {
    isProcessing,
    error,
    lastTxHash,
    buyCredits,
    reset,
  };
}

// Re-export CoachPackSize for consumers that need it alongside this hook
export type { CoachPackSize };
