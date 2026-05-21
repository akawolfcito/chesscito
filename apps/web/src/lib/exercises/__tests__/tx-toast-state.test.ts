import { describe, it, expect } from "vitest";
import { deriveTxToastState } from "../tx-toast-state.js";

const base = {
  isWriting: false,
  isConfirming: false,
  isError: false,
  txHash: null as string | null,
  doneAt: null as number | null,
};

describe("deriveTxToastState — idle", () => {
  it("does not show the toast when nothing is happening", () => {
    expect(deriveTxToastState(base)).toEqual({ show: false });
  });

  it("ignores an isError flag with no tx hash (residue from a prior cleared tx)", () => {
    expect(deriveTxToastState({ ...base, isError: true })).toEqual({ show: false });
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
  it("shows current='failed' when isError is set against a real tx hash (revert)", () => {
    expect(
      deriveTxToastState({ ...base, isError: true, txHash: "0xabc" }),
    ).toEqual({ show: true, current: "failed" });
  });

  it("failed outranks every other phase — chain revert is terminal", () => {
    expect(
      deriveTxToastState({
        ...base,
        isWriting: true,
        isConfirming: true,
        isError: true,
        txHash: "0xabc",
        doneAt: 12345,
      }),
    ).toEqual({ show: true, current: "failed" });
  });

  it("does NOT show failed when isError is true but no tx hash exists (no on-chain attempt)", () => {
    // Wagmi flips isError on user-rejection BEFORE a hash exists. The
    // existing error overlay handles that path; the toast should not
    // render a failed state without a real on-chain tx.
    expect(
      deriveTxToastState({ ...base, isError: true, isWriting: true }),
    ).toEqual({ show: true, current: "sign" });
  });
});
