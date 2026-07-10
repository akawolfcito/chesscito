"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Hash, TransactionReceipt } from "viem";

import { classifyTxErrorKind, isUserCancellation, type TxErrorKind } from "@/lib/errors";

/** `idle → signing → confirming → settled`. `settled` covers every terminal
 *  outcome: success, cancellation, and failure alike. */
export type OnChainWritePhase = "idle" | "signing" | "confirming" | "settled";

export type OnChainWriteOutcome =
  | { status: "success"; txHash: Hash; receipt: TransactionReceipt }
  /** The wallet never broadcast (hash null), or the player walked away after it
   *  did (hash kept). Never surfaced as an on-chain failure. */
  | { status: "cancelled"; txHash: Hash | null }
  | { status: "failed"; kind: TxErrorKind; error: unknown; txHash: Hash | null };

/** Returned when `run` is called while a write is already in flight. Not a
 *  TxErrorKind: nothing failed, and it must never reach telemetry as an error. */
export type OnChainWriteBusy = { status: "busy" };

export type OnChainWriteRequest = {
  /** Sign and broadcast. Resolves with the tx hash. */
  broadcast: () => Promise<Hash>;
  /** Await the receipt. MUST reject on a revert or an unreadable receipt —
   *  `waitForReceiptWithTimeout` does. A `confirm` that resolves on a reverted
   *  receipt reintroduces the exact bug this module exists to close. */
  confirm: (hash: Hash) => Promise<TransactionReceipt>;
};

export type UseOnChainWriteReturn = {
  phase: OnChainWritePhase;
  txHash: Hash | null;
  outcome: OnChainWriteOutcome | null;
  isBusy: boolean;
  run: (req: OnChainWriteRequest) => Promise<OnChainWriteOutcome | OnChainWriteBusy>;
  reset: () => void;
};

/**
 * Drives a player-facing on-chain write from signature to settled verdict.
 *
 * `run` never throws: callers branch on a discriminated outcome, so a success
 * path cannot be reached by forgetting a `try`. Success is only ever reported
 * after `confirm` resolves, which is what makes the celebration honest.
 */
export function useOnChainWrite(): UseOnChainWriteReturn {
  const [phase, setPhase] = useState<OnChainWritePhase>("idle");
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [outcome, setOutcome] = useState<OnChainWriteOutcome | null>(null);

  const isMountedRef = useRef(true);
  // Guards re-entry synchronously. React state lands a render too late to stop
  // a double tap from broadcasting twice.
  const inFlightRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const commit = useCallback((next: OnChainWriteOutcome) => {
    if (!isMountedRef.current) return;
    setOutcome(next);
    setPhase("settled");
  }, []);

  const run = useCallback(
    async (req: OnChainWriteRequest): Promise<OnChainWriteOutcome | OnChainWriteBusy> => {
      if (inFlightRef.current) return { status: "busy" };
      inFlightRef.current = true;

      let hash: Hash | null = null;
      try {
        if (isMountedRef.current) {
          setOutcome(null);
          setTxHash(null);
          setPhase("signing");
        }

        hash = await req.broadcast();
        if (isMountedRef.current) {
          setTxHash(hash);
          setPhase("confirming");
        }

        const receipt = await req.confirm(hash);
        const success: OnChainWriteOutcome = { status: "success", txHash: hash, receipt };
        commit(success);
        return success;
      } catch (error) {
        // A rejection is a cancellation wherever it happens: before the wallet
        // broadcast (hash null) or while waiting on the receipt (hash kept).
        const settled: OnChainWriteOutcome = isUserCancellation(error)
          ? { status: "cancelled", txHash: hash }
          : { status: "failed", kind: classifyTxErrorKind(error), error, txHash: hash };
        commit(settled);
        return settled;
      } finally {
        inFlightRef.current = false;
      }
    },
    [commit],
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setTxHash(null);
    setOutcome(null);
  }, []);

  return {
    phase,
    txHash,
    outcome,
    isBusy: phase === "signing" || phase === "confirming",
    run,
    reset,
  };
}
