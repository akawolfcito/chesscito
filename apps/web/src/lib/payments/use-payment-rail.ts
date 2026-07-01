"use client";

/**
 * usePaymentRail — client hook for the Stablecoin Direct Payment Rail
 * (Get Peones, slice B 2026-06-09).
 *
 * Reusable flow for a real buy-Peones surface: build a direct
 * `ERC20.transfer(treasury, amount)`, send it (feeCurrency-optional so
 * MiniPay AND MetaMask-on-Celo both work), wait the receipt, POST
 * /api/verify-payment, and expose the verdict. NO approve, NO Shop
 * buyItem, NO contract mint. The backend decides amount/reward/price; the
 * client only points at the SKU + the token it pays with.
 *
 * Fail-closed: pay() never sends when the treasury env is missing, the
 * chain isn't Celo mainnet, or the token isn't supported.
 */

import { useCallback, useState } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";

import { erc20Abi } from "@/lib/contracts/tokens";
import { getMiniPayFeeCurrency } from "@/lib/contracts/chains";
import { isUserCancellation } from "@/lib/errors";
import {
  GET_PEONES_CANARY_CHAIN_ID,
  GET_PEONES_CANARY_SKU,
  isGetPeonesCanaryClientRequested,
  type GetPeonesCanaryIntent,
} from "@/lib/payments/get-peones-canary";
import {
  getTreasuryAddressClient,
  RAIL_ACCEPTED_STABLECOINS,
  type PeonesPackSku,
} from "@/lib/payments/rail-config";
import { buildPeonesPackTransfer } from "@/lib/payments/transfer-builder";

const CELO_MAINNET_CHAIN_ID = 42220;

/** Backoff schedule (ms) for auto-retrying a transient verify failure once
 *  the tx has already settled on-chain. One entry per retry attempt. */
const DEFAULT_VERIFY_RETRY_DELAYS_MS = [1000, 3000, 8000];

/** Verify errors worth retrying — the on-chain payment landed, only the
 *  off-chain confirmation hiccupped (rate limit, ledger blip, RPC lag).
 *  Deterministic business rejections (amount_too_low, transfer_not_found, …)
 *  are NOT here: retrying can't change the verdict. */
const RETRIABLE_VERIFY_ERRORS = new Set([
  "rate_limited",
  "ledger_unavailable",
  "ledger_write_failed",
  "receipt_not_found",
]);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type PaymentRailPhase =
  | "idle"
  | "preparing"
  | "awaiting_signature"
  | "pending_tx"
  | "verifying"
  | "success"
  | "error";

export type PaymentRailUnavailableReason =
  | "no_treasury"
  | "wrong_chain"
  | "unsupported_token";

export type PaymentRailResult = {
  txHash: string;
  duplicate: boolean;
  peonesCredited: number;
  newBalance?: number;
  token: string;
  amountPaid: string;
  overpaid: boolean;
};

export type UsePaymentRailArgs = {
  sku: PeonesPackSku;
  /** Stablecoin symbol to pay with (USDC | USDT | cUSD). */
  tokenSymbol: string;
  onVerified?: (result: PaymentRailResult) => void;
  /** Backoff schedule (ms) for auto-retrying a transient verify failure.
   *  One entry per retry attempt; defaults to [1000, 3000, 8000]. */
  retryDelaysMs?: number[];
};

export function usePaymentRail({
  sku,
  tokenSymbol,
  onVerified,
  retryDelaysMs = DEFAULT_VERIFY_RETRY_DELAYS_MS,
}: UsePaymentRailArgs) {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();

  const [phase, setPhase] = useState<PaymentRailPhase>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [result, setResult] = useState<PaymentRailResult | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [canaryIntentId, setCanaryIntentId] = useState<string | null>(null);

  const canaryRequested = isGetPeonesCanaryClientRequested() && sku === GET_PEONES_CANARY_SKU;
  const treasury = getTreasuryAddressClient();
  const tokenEntry =
    RAIL_ACCEPTED_STABLECOINS.find((t) => t.symbol === tokenSymbol) ?? null;

  const unavailableReason: PaymentRailUnavailableReason | null = !canaryRequested && !treasury
    ? "no_treasury"
    : chainId !== CELO_MAINNET_CHAIN_ID
      ? "wrong_chain"
      : !tokenEntry
        ? "unsupported_token"
        : null;
  const available = unavailableReason === null;

  const reset = useCallback(() => {
    setPhase("idle");
    setTxHash(null);
    setResult(null);
    setErrorReason(null);
    setCanaryIntentId(null);
  }, []);

  const verify = useCallback(
    async (hash: `0x${string}`, intentId?: string) => {
      if (!tokenEntry) return;
      setPhase("verifying");
      // The tx has settled on-chain by the time we get here. A transient
      // verify failure (network blip, rate limit, ledger hiccup) must NOT
      // strand the user's payment — auto-retry with backoff before giving up.
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await fetch(
            intentId
              ? "/api/verify-payment/get-peones-canary"
              : "/api/verify-payment",
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(
                intentId
                  ? { intentId, txHash: hash }
                  : {
                      chainId: CELO_MAINNET_CHAIN_ID,
                      txHash: hash,
                      wallet: address,
                      token: tokenEntry.address,
                      sku,
                    },
              ),
            },
          );
          const json = (await res.json()) as {
            ok?: boolean;
            error?: string;
            duplicate?: boolean;
            peonesCredited?: number;
            newBalance?: number;
            token?: string;
            amountPaid?: string;
            overpaid?: boolean;
          };
          // duplicate:true is still ok:true → an idempotent success, never an error.
          if (json.ok) {
            const railResult: PaymentRailResult = {
              txHash: hash,
              duplicate: Boolean(json.duplicate),
              peonesCredited: Number(json.peonesCredited ?? 0),
              newBalance: json.newBalance,
              token: json.token ?? tokenEntry.address,
              amountPaid: json.amountPaid ?? "",
              overpaid: Boolean(json.overpaid),
            };
            setResult(railResult);
            setPhase("success");
            onVerified?.(railResult);
            return;
          }
          // A retriable error with budget left → wait and re-POST.
          const retriable = RETRIABLE_VERIFY_ERRORS.has(json.error ?? "") ||
            (intentId !== undefined &&
              (json.error === "finality_pending" ||
                json.error === "entitlement_failed_recoverable"));
          if (retriable && attempt < retryDelaysMs.length) {
            await sleep(retryDelaysMs[attempt]);
            continue;
          }
          // Deterministic failure (or budget exhausted) — KEEP txHash so the
          // caller can still re-verify manually.
          setErrorReason(json.error ?? "verify_failed");
          setPhase("error");
          return;
        } catch (e) {
          // Network/transport error — always retriable while budget remains.
          if (attempt < retryDelaysMs.length) {
            await sleep(retryDelaysMs[attempt]);
            continue;
          }
          setErrorReason(e instanceof Error ? e.message : "verify_request_failed");
          setPhase("error");
          return;
        }
      }
    },
    [address, sku, tokenEntry, onVerified, retryDelaysMs],
  );

  const pay = useCallback(async () => {
    if (!available || (!canaryRequested && !treasury) || !tokenEntry) {
      setErrorReason(unavailableReason ?? "unavailable");
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
    setCanaryIntentId(null);
    setPhase("preparing");

    let intent: GetPeonesCanaryIntent | null = null;
    if (canaryRequested) {
      try {
        const response = await fetch("/api/payment-intents/get-peones", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            wallet: address,
            token: tokenEntry.address,
            sku,
            chainId: GET_PEONES_CANARY_CHAIN_ID,
          }),
        });
        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string;
          intent?: GetPeonesCanaryIntent;
        };
        if (!payload.ok || !payload.intent) {
          setErrorReason(payload.error ?? "intent_creation_failed");
          setPhase("error");
          return;
        }
        intent = payload.intent;
        if (
          intent.wallet.toLowerCase() !== address.toLowerCase() ||
          intent.token.toLowerCase() !== tokenEntry.address.toLowerCase() ||
          intent.sku !== GET_PEONES_CANARY_SKU ||
          intent.chainId !== GET_PEONES_CANARY_CHAIN_ID ||
          BigInt(intent.expectedAmount) <= 0n
        ) {
          setErrorReason("intent_mismatch");
          setPhase("error");
          return;
        }
        setCanaryIntentId(intent.id);
      } catch {
        setErrorReason("intent_creation_failed");
        setPhase("error");
        return;
      }
    }

    const tx = intent
      ? {
          token: tokenEntry,
          expectedAmount: BigInt(intent.expectedAmount),
          treasury: intent.treasury,
        }
      : buildPeonesPackTransfer({ sku, treasury: treasury!, tokenSymbol });
    const feeCurrency = getMiniPayFeeCurrency(chainId);
    const base = {
      address: tx.token.address,
      abi: erc20Abi,
      functionName: "transfer" as const,
      args: [tx.treasury, tx.expectedAmount] as const,
      chainId: CELO_MAINNET_CHAIN_ID,
      account: address,
    };

    let submittedHash: `0x${string}` | null = null;
    try {
      setPhase("awaiting_signature");
      let hash: `0x${string}`;
      if (intent) {
        hash = await writeContractAsync(
          (feeCurrency ? { ...base, feeCurrency } : base) as Parameters<
            typeof writeContractAsync
          >[0],
        );
      } else {
        try {
          hash = await writeContractAsync(
            (feeCurrency ? { ...base, feeCurrency } : base) as Parameters<
              typeof writeContractAsync
            >[0],
          );
        } catch (e) {
          // User rejected → real error, do NOT re-prompt. Otherwise the
          // feeCurrency field may be unsupported (MetaMask) → retry without.
          if (isUserCancellation(e) || !feeCurrency) throw e;
          hash = await writeContractAsync(base as Parameters<typeof writeContractAsync>[0]);
        }
      }
      submittedHash = hash;
      setTxHash(hash);
      setPhase("pending_tx");
      await publicClient?.waitForTransactionReceipt({ hash });
      await verify(hash, intent?.id);
    } catch (e) {
      const reason = isUserCancellation(e)
        ? "user_rejected"
        : intent && !submittedHash
          ? "unknown_submission_state"
          : submittedHash
            ? "verification_pending"
            : e instanceof Error
              ? e.message
              : "tx_failed";
      setErrorReason(reason);
      if (reason === "unknown_submission_state" && intent) {
        void fetch("/api/payment-intents/get-peones", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ intentId: intent.id, event: reason }),
        }).catch(() => undefined);
      }
      setPhase("error");
    }
  }, [
    available,
    canaryRequested,
    treasury,
    tokenEntry,
    unavailableReason,
    address,
    sku,
    tokenSymbol,
    chainId,
    writeContractAsync,
    publicClient,
    verify,
  ]);

  const verifyAgain = useCallback(async () => {
    if (txHash) await verify(txHash, canaryIntentId ?? undefined);
  }, [txHash, canaryIntentId, verify]);

  return {
    available,
    unavailableReason,
    phase,
    txHash,
    result,
    errorReason,
    canaryRequested,
    paymentRetryBlocked: canaryRequested && errorReason === "unknown_submission_state",
    pay,
    verifyAgain,
    reset,
  };
}
