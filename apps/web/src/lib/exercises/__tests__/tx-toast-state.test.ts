import { describe, it, expect } from "vitest";
import { deriveTxToastState } from "../tx-toast-state.js";

const base = {
  isWriting: false,
  isConfirming: false,
  hasFailed: false,
  txHash: null as string | null,
  doneAt: null as number | null,
};

// `hasFailed` replaces `isError`, which was fed from
// `useWaitForTransactionReceipt().isError` — a QUERY error. viem resolves the
// query even for a reverted tx, so this branch never fired on the failure it
// was written for, despite the comment on it claiming exactly that. It is now
// fed by the settled outcome of `useOnChainWrite`.
describe("deriveTxToastState — hasFailed reflects the chain, not the query", () => {
  it("shows current='failed' when the write settled as failed", () => {
    expect(deriveTxToastState({ ...base, hasFailed: true, txHash: "0xabc" })).toEqual({
      show: true,
      current: "failed",
    });
  });

  it("failed outranks a done-hold window", () => {
    expect(
      deriveTxToastState({
        ...base,
        hasFailed: true,
        txHash: "0xabc",
        doneAt: Date.now(),
      }),
    ).toEqual({ show: true, current: "failed" });
  });
});

describe("deriveTxToastState — idle", () => {
  it("does not show the toast when nothing is happening", () => {
    expect(deriveTxToastState(base)).toEqual({ show: false });
  });

  it("ignores an hasFailed flag with no tx hash (residue from a prior cleared tx)", () => {
    expect(deriveTxToastState({ ...base, hasFailed: true })).toEqual({ show: false });
  });
});

describe("deriveTxToastState — sign phase", () => {
  it("shows current='sign' while writing the request and no tx hash exists yet", () => {
    expect(
      deriveTxToastState({ ...base, isWriting: true }),
    ).toEqual({ show: true, current: "sign" });
  });
});

describe("deriveTxToastState — wait phase", () => {
  it("shows current='wait' once the tx is broadcast (hash present, receipt pending)", () => {
    expect(
      deriveTxToastState({ ...base, isConfirming: true, txHash: "0xabc" }),
    ).toEqual({ show: true, current: "wait" });
  });

  it("still shows current='wait' if isWriting flips back false but the receipt is still pending", () => {
    expect(
      deriveTxToastState({ ...base, isConfirming: true, txHash: "0xabc" }),
    ).toEqual({ show: true, current: "wait" });
  });
});

// Device smoke, 2026-07-10: "STEP 2 of 2 — Confirming…" stayed pinned above
// the dock forever after a successful save. `saveWrite.txHash` is never cleared
// on `settled`, and the derivation read a bare `hasTxHash` as "receipt in
// flight". Once the 1500ms done-hold expired, it fell straight back into `wait`.
describe("deriveTxToastState — settled: a stale hash is not a pending receipt", () => {
  const settledWithHash = { ...base, txHash: "0xabc" };

  it("hides the toast after a successful save once the done-hold expires", () => {
    expect(deriveTxToastState(settledWithHash)).toEqual({ show: false });
  });

  it("hides the toast after a cancellation that had already broadcast", () => {
    expect(deriveTxToastState({ ...settledWithHash, doneAt: null })).toEqual({
      show: false,
    });
  });

  it("hides the toast after a cancellation before broadcast", () => {
    expect(deriveTxToastState({ ...base, txHash: null })).toEqual({ show: false });
  });

  it("never renders `wait` without an in-flight confirmation", () => {
    const state = deriveTxToastState(settledWithHash);
    expect(state.show === true && state.current === "wait").toBe(false);
  });

  it("still renders `wait` while the receipt is genuinely pending", () => {
    expect(deriveTxToastState({ ...settledWithHash, isConfirming: true })).toEqual({
      show: true,
      current: "wait",
    });
  });
});

describe("deriveTxToastState — done phase", () => {
  it("shows current='done' during the done-hold window (doneAt set)", () => {
    expect(
      deriveTxToastState({ ...base, txHash: "0xabc", doneAt: 12345 }),
    ).toEqual({ show: true, current: "done" });
  });

  it("done outranks wait even if isConfirming is somehow still true", () => {
    expect(
      deriveTxToastState({
        ...base,
        txHash: "0xabc",
        doneAt: 12345,
        isConfirming: true,
      }),
    ).toEqual({ show: true, current: "done" });
  });
});

describe("deriveTxToastState — failed phase (Cluster C SAVE residue defer #1)", () => {
  it("shows current='failed' when hasFailed is set against a real tx hash (revert)", () => {
    expect(
      deriveTxToastState({ ...base, hasFailed: true, txHash: "0xabc" }),
    ).toEqual({ show: true, current: "failed" });
  });

  it("failed outranks every other phase — chain revert is terminal", () => {
    expect(
      deriveTxToastState({
        ...base,
        isWriting: true,
        isConfirming: true,
        hasFailed: true,
        txHash: "0xabc",
        doneAt: 12345,
      }),
    ).toEqual({ show: true, current: "failed" });
  });

  it("does NOT show failed when hasFailed is true but no tx hash exists (no on-chain attempt)", () => {
    // Wagmi flips hasFailed on user-rejection BEFORE a hash exists. The
    // existing error overlay handles that path; the toast should not
    // render a failed state without a real on-chain tx.
    expect(
      deriveTxToastState({ ...base, hasFailed: true, isWriting: true }),
    ).toEqual({ show: true, current: "sign" });
  });
});
