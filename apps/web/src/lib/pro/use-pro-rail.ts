"use client";

/**
 * useProRail — client hook for buying Chesscito PRO via the no-approve
 * stablecoin direct-transfer rail (`ERC20.transfer(treasury, amount)`).
 * Mirrors `useSeasonPassRail` exactly (same phase machine, same verify
 * auto-retry with backoff) — different SKU family, different result shape.
 *
 * The Shop's approve + `buyItem(PRO_ITEM_ID, ...)` path (itemId 6) is a
 * separate, untouched way to buy the same entitlement — see
 * `lib/shop/use-shop-sheet-state.ts`.
 */

import { useCallback, useState } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";

import { erc20Abi } from "@/lib/contracts/tokens";
import { getMiniPayFeeCurrency } from "@/lib/contracts/chains";
import { isUserCancellation } from "@/lib/errors";
import {
  getTreasuryAddressClient,
  RAIL_ACCEPTED_STABLECOINS,
  type ProPackSku,
} from "@/lib/payments/rail-config";
import { buildProPackTransfer } from "@/lib/payments/transfer-builder";

const CELO_MAINNET_CHAIN_ID = 42220;
const DEFAULT_VERIFY_RETRY_DELAYS_MS = [1000, 3000, 8000];
const RETRIABLE_VERIFY_ERRORS = new Set([
  "rate_limited",
  "ledger_unavailable",
  "ledger_write_failed",
  "receipt_not_found",
]);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type ProRailPhase =
  | "idle"
  | "preparing"
  | "awaiting_signature"
  | "pending_tx"
  | "verifying"
  | "success"
  | "error";

export type ProRailResult = {
  txHash: string;
  duplicate: boolean;
  expiresAt: number;
  token: string;
  amountPaid: string;
  overpaid: boolean;
};

export type UseProRailArgs = {
  sku: ProPackSku;
  tokenSymbol: string;
  onVerified?: (result: ProRailResult) => void;
  retryDelaysMs?: number[];
};

export function useProRail({
  sku,
  tokenSymbol,
  onVerified,
  retryDelaysMs = DEFAULT_VERIFY_RETRY_DELAYS_MS,
}: UseProRailArgs) {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();

  const [phase, setPhase] = useState<ProRailPhase>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [result, setResult] = useState<ProRailResult | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);

  const treasury = getTreasuryAddressClient();
  const tokenEntry = RAIL_ACCEPTED_STABLECOINS.find((t) => t.symbol === tokenSymbol) ?? null;

  const available =
    Boolean(treasury) && chainId === CELO_MAINNET_CHAIN_ID && Boolean(tokenEntry);

  const reset = useCallback(() => {
    setPhase("idle");
    setTxHash(null);
    setResult(null);
    setErrorReason(null);
  }, []);

  const verify = useCallback(
    async (hash: `0x${string}`) => {
      if (!tokenEntry) return;
      setPhase("verifying");
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              chainId: CELO_MAINNET_CHAIN_ID,
              txHash: hash,
              wallet: address,
              token: tokenEntry.address,
              sku,
            }),
          });
          const json = (await res.json()) as {
            ok?: boolean;
            error?: string;
            duplicate?: boolean;
            expiresAt?: number;
            token?: string;
            amountPaid?: string;
            overpaid?: boolean;
          };
          if (json.ok) {
            const railResult: ProRailResult = {
              txHash: hash,
              duplicate: Boolean(json.duplicate),
              expiresAt: Number(json.expiresAt ?? 0),
              token: json.token ?? tokenEntry.address,
              amountPaid: json.amountPaid ?? "",
              overpaid: Boolean(json.overpaid),
            };
            setResult(railResult);
            setPhase("success");
            onVerified?.(railResult);
            return;
          }
          if (RETRIABLE_VERIFY_ERRORS.has(json.error ?? "") && attempt < retryDelaysMs.length) {
            await sleep(retryDelaysMs[attempt]);
            continue;
          }
          setErrorReason(json.error ?? "verify_failed");
          setPhase("error");
          return;
        } catch (e) {
          if (attempt < retryDelaysMs.length) {
            await sleep(retryDelaysMs[attempt]);
            continue;
          }
          setErrorReason((e as Error)?.message ?? "network_error");
          setPhase("error");
          return;
        }
      }
    },
    [address, sku, tokenEntry, onVerified, retryDelaysMs],
  );

  const pay = useCallback(async () => {
    if (!available || !treasury || !tokenEntry) {
      setErrorReason("unavailable");
      setPhase("error");
      return;
    }
    if (!address) {
      setErrorReason("not_connected");
      setPhase("error");
      return;
    }
    setErrorReason(null);
    setResult(null);
    setTxHash(null);
    setPhase("preparing");

    const tx = buildProPackTransfer({ sku, treasury, tokenSymbol });
    const feeCurrency = getMiniPayFeeCurrency(chainId);
    const base = {
      address: tx.token.address,
      abi: erc20Abi,
      functionName: "transfer" as const,
      args: [treasury, tx.expectedAmount] as const,
      chainId: CELO_MAINNET_CHAIN_ID,
      account: address,
    };

    try {
      setPhase("awaiting_signature");
      let hash: `0x${string}`;
      try {
        hash = await writeContractAsync(
          (feeCurrency ? { ...base, feeCurrency } : base) as Parameters<
            typeof writeContractAsync
          >[0],
        );
      } catch (e) {
        if (isUserCancellation(e) || !feeCurrency) throw e;
        hash = await writeContractAsync(base as Parameters<typeof writeContractAsync>[0]);
      }
      setTxHash(hash);
      setPhase("pending_tx");
      await publicClient?.waitForTransactionReceipt({ hash });
      await verify(hash);
    } catch (e) {
      setErrorReason(
        isUserCancellation(e)
          ? "user_rejected"
          : e instanceof Error
            ? e.message
            : "tx_failed",
      );
      setPhase("error");
    }
  }, [
    available,
    treasury,
    tokenEntry,
    address,
    sku,
    tokenSymbol,
    chainId,
    publicClient,
    writeContractAsync,
    verify,
  ]);

  const verifyAgain = useCallback(async () => {
    if (txHash) await verify(txHash);
  }, [txHash, verify]);

  return {
    phase,
    txHash,
    result,
    errorReason,
    available,
    pay,
    verifyAgain,
    reset,
  };
}
