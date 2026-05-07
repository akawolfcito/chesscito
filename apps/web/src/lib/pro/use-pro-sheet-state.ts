"use client";

import { useCallback, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContracts,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

import { PRO_COPY } from "@/lib/content/editorial";
import {
  getConfiguredChainId,
  getShopAddress,
} from "@/lib/contracts/chains";
import { PRO_PRICE_USD6 } from "@/lib/contracts/shop-catalog";
import {
  ACCEPTED_TOKENS,
  CELO_TOKEN,
  erc20Abi,
  normalizePrice,
} from "@/lib/contracts/tokens";
import { hapticSuccess } from "@/lib/haptics";
import { executeProPurchase } from "@/lib/pro/purchase";
import { useProStatus, type ProStatus } from "@/lib/pro/use-pro-status";
import { track } from "@/lib/telemetry";

import type { ProSheetProps } from "@/components/pro/pro-sheet";

type SheetProps = Omit<ProSheetProps, "open" | "onOpenChange"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type UseProSheetStateReturn = {
  /** Live sheet open state. Surfaced separately so the host component
   *  can branch on "is the sheet up?" without unpacking sheetProps. */
  open: boolean;
  /** Open the sheet from a CTA tap. Idempotent — already-open is a no-op. */
  openSheet: () => void;
  /** Mid-tx + mid-retry guards live here so callers can't desync the UI
   *  by hard-closing during a write. Equivalent to ProSheet's own
   *  onOpenChange(false) branch. */
  closeSheet: () => void;
  /** Spread directly onto `<ProSheet />`. */
  sheetProps: SheetProps;
  /** Surfaced for the parent's PRO chip rendering so the page never
   *  fires a second `useProStatus(address)` fetch in parallel. */
  proStatus: ProStatus | null;
};

/** PRO sheet orchestration extracted from `<PlayHubRoot>` so the redesigned
 *  `<HubScaffoldClient>` can render `<ProSheet>` in-place instead of
 *  bouncing through `/hub?legacy=1&action=pro`. The bounce is what created
 *  the B2 "Play in Arena" race (audit 2026-05-07) and what hid the bottom
 *  CTA behind the legacy persistent dock.
 *
 *  Self-contained — pulls every wagmi/RainbowKit dependency it needs.
 *  Returns `sheetProps` already shaped for `<ProSheet>` so the host
 *  component is just `<ProSheet {...proSheet.sheetProps} />`. */
export function useProSheetState(): UseProSheetStateReturn {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { switchChain } = useSwitchChain();
  const { openConnectModal } = useConnectModal();

  const configuredChainId = useMemo(() => getConfiguredChainId(), []);
  const isCorrectChain =
    configuredChainId != null && chainId === configuredChainId;
  const shopAddress = useMemo(() => getShopAddress(chainId), [chainId]);

  const { writeContractAsync: writeShopAsync } = useWriteContract();
  const { status: proStatus, refetch: refetchProStatus } = useProStatus(address);

  const [open, setOpen] = useState(false);
  const [purchaseState, setPurchaseState] = useState<
    "idle" | "purchasing" | "verifying"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifyFailedTxHash, setVerifyFailedTxHash] = useState<string | null>(
    null,
  );
  const [isRetryingVerify, setIsRetryingVerify] = useState(false);

  // Token balances drive `selectPaymentToken` — same shape PlayHubRoot
  // uses. CELO sits at the tail purely to share the read; PRO never
  // settles in CELO, only stablecoins.
  const BALANCE_READ_TOKENS = useMemo(() => [...ACCEPTED_TOKENS, CELO_TOKEN], []);
  const { data: tokenBalances } = useReadContracts({
    contracts: BALANCE_READ_TOKENS.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: address ? ([address] as const) : undefined,
      chainId,
    })),
    allowFailure: true,
    query: { enabled: Boolean(address), staleTime: 15_000 },
  });

  const selectPaymentToken = useCallback(
    (priceUsd6: bigint) => {
      if (!tokenBalances) return null;
      for (let i = 0; i < ACCEPTED_TOKENS.length; i++) {
        const t = ACCEPTED_TOKENS[i];
        const result = tokenBalances[i];
        if (result?.status !== "success") continue;
        const balance = result.result as bigint;
        const needed = normalizePrice(priceUsd6, t.decimals);
        if (balance >= needed) return t;
      }
      return null;
    },
    [tokenBalances],
  );

  const openSheet = useCallback(() => {
    setOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    if (purchaseState !== "idle" || isRetryingVerify) return;
    setOpen(false);
    setErrorMessage(null);
    setVerifyFailedTxHash(null);
  }, [purchaseState, isRetryingVerify]);

  const handlePurchase = useCallback(async () => {
    if (!address || !shopAddress || !publicClient || !isCorrectChain) return;
    setErrorMessage(null);
    setVerifyFailedTxHash(null);

    const previewToken = selectPaymentToken(PRO_PRICE_USD6);
    if (!previewToken) {
      track("pro_purchase_failed", { kind: "no-token" });
      setErrorMessage("Insufficient stablecoin balance.");
      return;
    }

    track("pro_purchase_started", {
      item_id: 6,
      price_usd6: 1_990_000,
    });

    const result = await executeProPurchase({
      address,
      shopAddress,
      publicClient,
      chainId,
      writeContractAsync: writeShopAsync,
      selectPaymentToken: (price) => selectPaymentToken(price),
      onPhaseChange: (phase) => setPurchaseState(phase),
    });
    setPurchaseState("idle");

    if (result.kind === "success") {
      track("pro_purchase_confirmed", {
        item_id: 6,
        price_usd6: 1_990_000,
        days_granted: 30,
        tx_hash_prefix: result.txHash.slice(0, 10),
      });
      refetchProStatus();
      hapticSuccess();
      setOpen(false);
      return;
    }
    if (result.kind === "cancelled") return;
    if (result.kind === "verify-failed") {
      track("pro_purchase_failed", {
        kind: "verify-failed",
        tx_hash_prefix: result.txHash ? result.txHash.slice(0, 10) : null,
      });
      setVerifyFailedTxHash(result.txHash ?? null);
    } else {
      track("pro_purchase_failed", { kind: result.kind });
    }
    setErrorMessage(
      result.kind === "no-token"
        ? "Insufficient stablecoin balance."
        : result.kind === "timeout"
          ? "Transaction timed out. Please try again."
          : result.kind === "verify-failed"
            ? PRO_COPY.errors.verifyFailedTitle
            : PRO_COPY.errors.purchaseFailed,
    );
  }, [
    address,
    shopAddress,
    publicClient,
    isCorrectChain,
    chainId,
    writeShopAsync,
    selectPaymentToken,
    refetchProStatus,
  ]);

  const handleRetryVerify = useCallback(async () => {
    if (!verifyFailedTxHash || !address || isRetryingVerify) return;
    setIsRetryingVerify(true);
    try {
      const res = await fetch("/api/verify-pro", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          txHash: verifyFailedTxHash,
          walletAddress: address,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { active?: boolean }
        | null;
      if (res.ok && json?.active) {
        track("pro_purchase_confirmed", {
          item_id: 6,
          price_usd6: 1_990_000,
          days_granted: 30,
          tx_hash_prefix: verifyFailedTxHash.slice(0, 10),
        });
        setErrorMessage(null);
        setVerifyFailedTxHash(null);
        refetchProStatus();
        hapticSuccess();
        setOpen(false);
        return;
      }
      track("pro_verify_retry_failed", {
        tx_hash_prefix: verifyFailedTxHash.slice(0, 10),
        status: res.status,
      });
    } catch {
      track("pro_verify_retry_failed", {
        tx_hash_prefix: verifyFailedTxHash.slice(0, 10),
        status: 0,
      });
    } finally {
      setIsRetryingVerify(false);
    }
  }, [verifyFailedTxHash, address, isRetryingVerify, refetchProStatus]);

  const sheetProps: SheetProps = {
    open,
    onOpenChange: (next: boolean) => {
      if (next) openSheet();
      else closeSheet();
    },
    status: proStatus,
    isConnected,
    isCorrectChain,
    isPurchasing: purchaseState === "purchasing",
    isVerifying: purchaseState === "verifying",
    errorMessage,
    verifyFailedTxHash,
    isRetryingVerify,
    onRetryVerify: () => void handleRetryVerify(),
    onConnectWallet: () => openConnectModal?.(),
    onSwitchNetwork: () =>
      configuredChainId != null && switchChain({ chainId: configuredChainId }),
    onPurchase: () => void handlePurchase(),
  };

  return { open, openSheet, closeSheet, sheetProps, proStatus };
}
