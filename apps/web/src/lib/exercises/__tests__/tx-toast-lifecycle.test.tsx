/**
 * Composition test for the SAVE toast lifecycle.
 *
 * `tx-toast-state.test.ts` proves the derivation in isolation and
 * `use-onchain-write.test.tsx` proves the phase machine in isolation. Both were
 * green while the device showed "STEP 2 of 2 — Confirming…" pinned above the
 * dock forever: nothing tested the two together.
 *
 * This drives the real hook and feeds its real outputs into the real
 * derivation, exactly as `<ExercisesScreen>` wires them.
 */
import { describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { Hash, TransactionReceipt } from "viem";

import { TransactionRevertedError } from "@/lib/contracts/transaction-helpers";
import { useDoneHold } from "../use-done-hold";
import { useOnChainWrite } from "../use-onchain-write";
import { deriveTxToastState, type TxToastState } from "../tx-toast-state";

const HASH = "0xfeed" as Hash;
const SUCCESS = { transactionHash: HASH, status: "success" } as unknown as TransactionReceipt;
const REVERTED = { transactionHash: HASH, status: "reverted" } as unknown as TransactionReceipt;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Mirrors the wiring in `exercises-screen.tsx`. */
function useSaveToast() {
  const saveWrite = useOnChainWrite();
  const doneHold = useDoneHold();
  const toast: TxToastState = deriveTxToastState({
    isWriting: saveWrite.phase === "signing",
    isConfirming: saveWrite.phase === "confirming",
    hasFailed: saveWrite.outcome?.status === "failed",
    txHash: saveWrite.txHash,
    doneAt: doneHold.doneAt,
  });
  return { saveWrite, doneHold, toast };
}

const current = (toast: TxToastState) => (toast.show ? toast.current : null);

describe("SAVE toast lifecycle — success", () => {
  it("signing → confirming → success → the indicator stops rendering", async () => {
    const broadcast = deferred<Hash>();
    const confirm = deferred<TransactionReceipt>();
    const { result } = renderHook(() => useSaveToast());

    expect(current(result.current.toast)).toBeNull();

    act(() => {
      void result.current.saveWrite.run({
        broadcast: () => broadcast.promise,
        confirm: () => confirm.promise,
      });
    });

    // 1. signing
    await waitFor(() => expect(result.current.saveWrite.phase).toBe("signing"));
    expect(current(result.current.toast)).toBe("sign");

    // 2. confirming
    await act(async () => {
      broadcast.resolve(HASH);
    });
    await waitFor(() => expect(result.current.saveWrite.phase).toBe("confirming"));
    expect(current(result.current.toast)).toBe("wait");

    // 3. success — the screen opens the done-hold from the success sequencer
    await act(async () => {
      confirm.resolve(SUCCESS);
    });
    await waitFor(() => expect(result.current.saveWrite.phase).toBe("settled"));
    act(() => result.current.doneHold.start(HASH));
    expect(current(result.current.toast)).toBe("done");

    // 4. the done-hold expires. The hash is still set — it must not read as a
    //    receipt in flight.
    act(() => result.current.doneHold.reset());
    expect(result.current.saveWrite.txHash).toBe(HASH);
    expect(result.current.toast.show).toBe(false);
  });
});

describe("SAVE toast lifecycle — the label never sticks", () => {
  it("clears on a cancellation that already broadcast", async () => {
    const { result } = renderHook(() => useSaveToast());

    await act(async () => {
      await result.current.saveWrite.run({
        broadcast: async () => HASH,
        confirm: async () => {
          throw new Error("User rejected the request");
        },
      });
    });

    expect(result.current.saveWrite.outcome).toMatchObject({ status: "cancelled" });
    expect(result.current.toast.show).toBe(false);
  });

  it("clears on a cancellation before the broadcast", async () => {
    const { result } = renderHook(() => useSaveToast());

    await act(async () => {
      await result.current.saveWrite.run({
        broadcast: async () => {
          throw new Error("User rejected the request");
        },
        confirm: async () => SUCCESS,
      });
    });

    expect(result.current.toast.show).toBe(false);
  });

  it("shows `failed`, not `wait`, on a reverted receipt", async () => {
    const { result } = renderHook(() => useSaveToast());

    await act(async () => {
      await result.current.saveWrite.run({
        broadcast: async () => HASH,
        confirm: async () => {
          throw new TransactionRevertedError(HASH, REVERTED);
        },
      });
    });

    // The failed toast is sticky by design (Cluster C SAVE residue defer #1):
    // a terminal chain verdict stays on screen. What must never happen is it
    // degrading back into "Confirming…".
    expect(current(result.current.toast)).toBe("failed");
  });

  it("reset() clears phase, outcome and txHash, and the toast with them", async () => {
    const { result } = renderHook(() => useSaveToast());

    await act(async () => {
      await result.current.saveWrite.run({
        broadcast: async () => HASH,
        confirm: async () => {
          throw new TransactionRevertedError(HASH, REVERTED);
        },
      });
    });
    expect(current(result.current.toast)).toBe("failed");

    act(() => {
      result.current.saveWrite.reset();
      result.current.doneHold.reset();
    });

    expect(result.current.saveWrite.phase).toBe("idle");
    expect(result.current.saveWrite.outcome).toBeNull();
    expect(result.current.saveWrite.txHash).toBeNull();
    expect(result.current.toast.show).toBe(false);
  });
});
