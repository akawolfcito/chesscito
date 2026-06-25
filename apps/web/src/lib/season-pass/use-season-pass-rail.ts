"use client";

import { useCallback, useState } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";

import { erc20Abi } from "@/lib/contracts/tokens";
import { getMiniPayFeeCurrency } from "@/lib/contracts/chains";
import { isUserCancellation } from "@/lib/errors";
import {
  getTreasuryAddressClient,
  RAIL_ACCEPTED_STABLECOINS,
  type SeasonPassSku,
} from "@/lib/payments/rail-config";
import { buildSeasonPassTransfer } from "@/lib/payments/transfer-builder";

const CELO_MAINNET_CHAIN_ID = 42220;
const DEFAULT_VERIFY_RETRY_DELAYS_MS = [1000, 3000, 8000];
const RETRIABLE_VERIFY_ERRORS = new Set([
  "rate_limited",
  "ledger_unavailable",
  "ledger_write_failed",
  "receipt_not_found",
]);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type SeasonPassRailPhase =
  | "idle"
  | "preparing"
  | "awaiting_signature"
  | "pending_tx"
  | "verifying"
  | "success"
  | "error";

export type SeasonPassRailResult = {
  txHash: string;
  duplicate: boolean;
  seasonId: string;
  expiresAt: string;
  shieldsCredited: number;
  shieldsPending?: boolean;
  supporterStatus: string;
  token: string;
  amountPaid: string;
  overpaid: boolean;
};

export type UseSeasonPassRailArgs = {
  sku: SeasonPassSku;
  tokenSymbol: string;
  onVerified?: (result: SeasonPassRailResult) => void;
  retryDelaysMs?: number[];
};

export function useSeasonPassRail({
  sku,
  tokenSymbol,
  onVerified,
  retryDelaysMs = DEFAULT_VERIFY_RETRY_DELAYS_MS,
}: UseSeasonPassRailArgs) {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();

  const [phase, setPhase] = useState<SeasonPassRailPhase>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [result, setResult] = useState<SeasonPassRailResult | null>(null);
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
            seasonId?: string;
            expiresAt?: string;
            shieldsCredited?: number;
            shieldsPending?: boolean;
            supporterStatus?: string;
            token?: string;
            amountPaid?: string;
            overpaid?: boolean;
          };
          if (json.ok) {
            const railResult: SeasonPassRailResult = {
              txHash: hash,
              duplicate: Boolean(json.duplicate),
              seasonId: json.seasonId ?? "",
              expiresAt: json.expiresAt ?? "",
              shieldsCredited: Number(json.shieldsCredited ?? 0),
              shieldsPending: json.shieldsPending,
              supporterStatus: json.supporterStatus ?? "challenger",
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
    [address, sku, tokenEntry, retryDelaysMs],
  );

  const pay = useCallback(async () => {
    if (!treasury || !tokenEntry || !address || !publicClient) return;
    if (chainId !== CELO_MAINNET_CHAIN_ID) {
      setErrorReason("wrong_chain");
      setPhase("error");
      return;
    }
    try {
      setPhase("preparing");
      const tx = buildSeasonPassTransfer({ sku, treasury, tokenSymbol });
      const feeCurrency = getMiniPayFeeCurrency(chainId);

      setPhase("awaiting_signature");
      const hash = await writeContractAsync({
        address: tokenEntry.address,
        abi: erc20Abi,
        functionName: "transfer",
        args: [treasury as `0x${string}`, tx.expectedAmount],
        ...(feeCurrency ? { feeCurrency } : {}),
      });
      setTxHash(hash);

      setPhase("pending_tx");
      await publicClient.waitForTransactionReceipt({ hash });

      await verify(hash);
    } catch (e) {
      if (isUserCancellation(e)) {
        setPhase("idle");
      } else {
        setErrorReason((e as Error)?.message ?? "unknown_error");
        setPhase("error");
      }
    }
  }, [address, chainId, publicClient, treasury, tokenEntry, sku, tokenSymbol, writeContractAsync, verify]);

  return {
    phase,
    txHash,
    result,
    errorReason,
    available,
    pay,
    reset,
  };
}
