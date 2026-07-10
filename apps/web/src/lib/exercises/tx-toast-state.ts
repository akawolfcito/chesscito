/**
 * Pure derivation of the SAVE-flow `<TxProgressSteps variant="toast">`
 * state from wagmi's `useWaitForTransactionReceipt` outputs + the local
 * done-hold timer.
 *
 * Extracted from `exercises-screen.tsx` to keep the 4-phase precedence
 * (`failed > done > wait > sign`) testable in isolation — the original
 * inline derivation grew a `failed` branch (Cluster C SAVE residue
 * defer #1, post-domain-migration addendum review 2026-05-20) and the
 * untestable component-local logic was a regression risk.
 */

export type TxToastInputs = {
  /** `useOnChainWrite().phase === "signing"` — request being signed. */
  isWriting: boolean;
  /** `useOnChainWrite().phase === "confirming"` — receipt pending. */
  isConfirming: boolean;
  /** The write settled as `failed`.
   *
   *  Was `useWaitForTransactionReceipt().isError`, documented here as
   *  "chain revert / RPC error". It was only ever the RPC error: viem resolves
   *  the receipt query for a reverted tx, so this branch never fired on the
   *  revert it was written for. Now fed by the settled outcome. */
  hasFailed: boolean;
  /** Broadcast tx hash, set once the wallet returns from `writeContract`. */
  txHash: string | null;
  /** Epoch ms when the done-hold window started; null outside the hold. */
  doneAt: number | null;
};

export type TxToastState =
  | { show: false }
  | { show: true; current: "sign" | "wait" | "done" | "failed" };

export function deriveTxToastState(inputs: TxToastInputs): TxToastState {
  const hasTxHash = inputs.txHash !== null && inputs.txHash !== "";

  // Failed wins outright — a chain revert is terminal. The toast stays
  // mounted with `current="failed"` until either a new submit starts
  // (which clears `txHash` upstream) or the surface unmounts.
  if (inputs.hasFailed && hasTxHash) {
    return { show: true, current: "failed" };
  }

  if (inputs.doneAt !== null) {
    return { show: true, current: "done" };
  }

  if (hasTxHash) {
    // Receipt is in flight — render the wait phase regardless of whether
    // wagmi has flipped `isConfirming` true yet (there's a one-render gap
    // between writeContract resolving and the receipt watcher mounting).
    return { show: true, current: "wait" };
  }

  if (inputs.isWriting) {
    return { show: true, current: "sign" };
  }

  return { show: false };
}
