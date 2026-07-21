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

import { useCallback, useRef, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWriteContract,
} from "wagmi";

import { erc20Abi } from "@/lib/contracts/tokens";
import { getMiniPayFeeCurrency } from "@/lib/contracts/chains";
import { isUserCancellation } from "@/lib/errors";
import { isMiniPayEnv } from "@/lib/minipay";
import {
  GET_PEONES_CANARY_CHAIN_ID,
  GET_PEONES_CANARY_SKU,
  classifyProviderSubmissionError,
  getProviderErrorDiagnostics,
  isGetPeonesCanaryClientRequested,
  normalizeProviderTransactionHash,
  recoverProviderTransactionHashFromError,
  type GetPeonesCanaryIntent,
  type GetPeonesSubmissionReport,
  type GetPeonesSubmissionReportResponse,
  type GetPeonesSubmissionStage,
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
  const { address, connector } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();

  const [phase, setPhase] = useState<PaymentRailPhase>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [result, setResult] = useState<PaymentRailResult | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [canaryIntentId, setCanaryIntentId] = useState<string | null>(null);
  const payInFlightRef = useRef(false);
  const retryBlockedRef = useRef(false);

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
    // An in-flight or ambiguous broadcast cannot be made safe by resetting UI
    // state. The owning payment finishes its own mutex; ambiguous state needs
    // server-side reconciliation before another transfer may start.
    if (payInFlightRef.current || retryBlockedRef.current) return;
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

  const reportSubmission = useCallback(async (report: GetPeonesSubmissionReport) => {
    try {
      const response = await fetch("/api/payment-intents/get-peones", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(report),
      });
      return await response.json() as GetPeonesSubmissionReportResponse;
    } catch {
      return null;
    }
  }, []);

  const submissionDiagnostics = useCallback((
    stage: GetPeonesSubmissionStage,
    error?: unknown,
  ) => ({
    stage,
    ...(error === undefined ? {} : { error: getProviderErrorDiagnostics(error) }),
    connectorId: connector?.id ?? "unavailable",
    // `account` is passed as an address, so viem parses it as a JSON-RPC
    // account and resolves the wallet client from wagmi's active connector.
    walletClientKind: "json-rpc",
    chainId,
    isMiniPay: isMiniPayEnv(),
  }), [chainId, connector?.id]);

  const pay = useCallback(async () => {
    if (payInFlightRef.current || retryBlockedRef.current) return;
    payInFlightRef.current = true;
    try {
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
          intentId?: string;
          txHash?: string | null;
        };
        if (!payload.ok || !payload.intent) {
          if (payload.error === "unresolved_submission_state" && payload.intentId) {
            setCanaryIntentId(payload.intentId);
            retryBlockedRef.current = true;
            const recovered = normalizeProviderTransactionHash(payload.txHash);
            if (recovered.ok) {
              setTxHash(recovered.txHash);
              setErrorReason("verification_pending");
            } else {
              setErrorReason("unknown_submission_state");
            }
            setPhase("error");
            return;
          }
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
        const submitting = await reportSubmission({
          intentId: intent.id,
          submissionState: "SUBMITTING",
          providerResultKind: "WALLET_REQUESTED",
        });
        if (!submitting?.ok) {
          setErrorReason(submitting?.error?.toLowerCase() ?? "submission_report_failed");
          setPhase("error");
          return;
        }
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
    let providerOutcome: ReturnType<typeof classifyProviderSubmissionError> | null = null;
    let providerStage: GetPeonesSubmissionStage = "PREPARE";
    try {
      setPhase("awaiting_signature");
      providerStage = "WALLET_REQUEST";
      let rawProviderResult: unknown;
      if (intent) {
        rawProviderResult = await writeContractAsync(
          (feeCurrency ? { ...base, feeCurrency } : base) as Parameters<
            typeof writeContractAsync
          >[0],
        );
      } else {
        try {
          rawProviderResult = await writeContractAsync(
            (feeCurrency ? { ...base, feeCurrency } : base) as Parameters<
              typeof writeContractAsync
            >[0],
          );
        } catch (e) {
          // User rejected → real error, do NOT re-prompt. Otherwise the
          // feeCurrency field may be unsupported (MetaMask) → retry without.
          if (isUserCancellation(e) || !feeCurrency) throw e;
          rawProviderResult = await writeContractAsync(
            base as Parameters<typeof writeContractAsync>[0],
          );
        }
      }
      providerStage = "HASH_RETURN";
      const normalized = normalizeProviderTransactionHash(rawProviderResult);
      if (!normalized.ok) {
        providerOutcome = normalized.outcome;
        throw new Error(normalized.outcome.errorCode);
      }
      const hash = normalized.txHash;
      submittedHash = hash;
      setTxHash(hash);
      setPhase("pending_tx");
      if (intent) {
        await reportSubmission({
          intentId: intent.id,
          submissionState: "SUBMITTED",
          txHash: hash,
          providerResultKind: normalized.providerResultKind,
          diagnostics: submissionDiagnostics("HASH_RETURN"),
        });
      }
      await publicClient?.waitForTransactionReceipt({ hash });
      await verify(hash, intent?.id);
    } catch (e) {
      if (intent && !submittedHash) {
        const recoveredHash = recoverProviderTransactionHashFromError(e);
        if (recoveredHash) {
          submittedHash = recoveredHash;
          setTxHash(recoveredHash);
          setPhase("pending_tx");
          await reportSubmission({
            intentId: intent.id,
            submissionState: "SUBMITTED",
            txHash: recoveredHash,
            providerResultKind: "TRANSACTION_HASH",
            diagnostics: submissionDiagnostics("BROADCAST", e),
          });
          try {
            await publicClient?.waitForTransactionReceipt({ hash: recoveredHash });
            await verify(recoveredHash, intent.id);
          } catch {
            setErrorReason("verification_pending");
            setPhase("error");
          }
          return;
        }
        const outcome = providerOutcome ?? classifyProviderSubmissionError(e, providerStage);
        await reportSubmission({
          intentId: intent.id,
          submissionState: outcome.submissionState,
          providerResultKind: outcome.providerResultKind,
          errorCode: outcome.errorCode,
          diagnostics: submissionDiagnostics(providerStage, e),
        });
        const reason = outcome.submissionState === "CANCELLED"
          ? "user_rejected"
          : outcome.submissionState === "FAILED"
            ? "tx_failed"
            : "unknown_submission_state";
        if (!outcome.retrySafe) retryBlockedRef.current = true;
        setErrorReason(reason);
        setPhase("error");
        return;
      }
      const reason = isUserCancellation(e)
        ? "user_rejected"
        : submittedHash
          ? "verification_pending"
          : e instanceof Error
            ? e.message
            : "tx_failed";
      setErrorReason(reason);
      setPhase("error");
    }
    } finally {
      payInFlightRef.current = false;
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
    reportSubmission,
    submissionDiagnostics,
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
