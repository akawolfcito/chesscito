import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { Hash, TransactionReceipt } from "viem";

import {
  TransactionReceiptUnverifiableError,
  TransactionRevertedError,
} from "@/lib/contracts/transaction-helpers";
import { useOnChainWrite } from "../use-onchain-write";

const HASH = "0xfeed" as Hash;
const SUCCESS = { transactionHash: HASH, status: "success" } as unknown as TransactionReceipt;
const REVERTED = { transactionHash: HASH, status: "reverted" } as unknown as TransactionReceipt;

/** A promise we resolve by hand, so the test can observe the phase WHILE the
 *  step is still in flight. Asserting only after settle would let a hook that
 *  never enters `confirming` pass. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useOnChainWrite — phase transitions", () => {
  it("is idle before anything runs", () => {
    const { result } = renderHook(() => useOnChainWrite());
    expect(result.current.phase).toBe("idle");
    expect(result.current.txHash).toBeNull();
    expect(result.current.outcome).toBeNull();
    expect(result.current.isBusy).toBe(false);
  });

  it("is `signing` while broadcast is in flight, before any hash exists", async () => {
    const broadcast = deferred<Hash>();
    const { result } = renderHook(() => useOnChainWrite());

    act(() => {
      void result.current.run({
        broadcast: () => broadcast.promise,
        confirm: async () => SUCCESS,
      });
    });

    await waitFor(() => expect(result.current.phase).toBe("signing"));
    expect(result.current.txHash).toBeNull();
    expect(result.current.isBusy).toBe(true);

    await act(async () => {
      broadcast.resolve(HASH);
    });
  });

  it("is `confirming` after the hash and before the receipt", async () => {
    const confirm = deferred<TransactionReceipt>();
    const { result } = renderHook(() => useOnChainWrite());

    act(() => {
      void result.current.run({
        broadcast: async () => HASH,
        confirm: () => confirm.promise,
      });
    });

    await waitFor(() => expect(result.current.phase).toBe("confirming"));
    expect(result.current.txHash).toBe(HASH);
    expect(result.current.isBusy).toBe(true);
    expect(result.current.outcome).toBeNull();

    await act(async () => {
      confirm.resolve(SUCCESS);
    });
    await waitFor(() => expect(result.current.phase).toBe("settled"));
  });

  it("settles success only once the receipt resolves", async () => {
    const { result } = renderHook(() => useOnChainWrite());
    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined;

    await act(async () => {
      outcome = await result.current.run({
        broadcast: async () => HASH,
        confirm: async () => SUCCESS,
      });
    });

    expect(outcome).toMatchObject({ status: "success", txHash: HASH, receipt: SUCCESS });
    expect(result.current.phase).toBe("settled");
    expect(result.current.isBusy).toBe(false);
    expect(result.current.outcome).toMatchObject({ status: "success" });
  });
});

describe("useOnChainWrite — failure never masquerades as success", () => {
  it("returns failed/revert on a reverted receipt and keeps the hash", async () => {
    const { result } = renderHook(() => useOnChainWrite());
    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined;

    await act(async () => {
      outcome = await result.current.run({
        broadcast: async () => HASH,
        confirm: async () => {
          throw new TransactionRevertedError(HASH, REVERTED);
        },
      });
    });

    expect(outcome).toMatchObject({ status: "failed", kind: "revert", txHash: HASH });
  });

  it("returns failed/unknown on an unverifiable receipt, never `revert`", async () => {
    const { result } = renderHook(() => useOnChainWrite());
    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined;

    await act(async () => {
      outcome = await result.current.run({
        broadcast: async () => HASH,
        confirm: async () => {
          throw new TransactionReceiptUnverifiableError(HASH, SUCCESS, undefined);
        },
      });
    });

    expect(outcome).toMatchObject({ status: "failed", kind: "unknown", txHash: HASH });
  });

  it("never throws — a broadcast failure comes back as a failed outcome with a null hash", async () => {
    const { result } = renderHook(() => useOnChainWrite());
    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined;

    await act(async () => {
      outcome = await result.current.run({
        broadcast: async () => {
          throw new Error("rpc exploded");
        },
        confirm: async () => SUCCESS,
      });
    });

    expect(outcome).toMatchObject({ status: "failed", txHash: null });
    expect(result.current.phase).toBe("settled");
  });

  it("reports a wallet rejection as cancelled with a null hash, not as an on-chain failure", async () => {
    const { result } = renderHook(() => useOnChainWrite());
    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined;

    await act(async () => {
      outcome = await result.current.run({
        broadcast: async () => {
          throw new Error("User rejected the request");
        },
        confirm: async () => SUCCESS,
      });
    });

    expect(outcome).toEqual({ status: "cancelled", txHash: null });
  });

  it("keeps the hash when the user cancels AFTER the broadcast landed", async () => {
    const { result } = renderHook(() => useOnChainWrite());
    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined;

    await act(async () => {
      outcome = await result.current.run({
        broadcast: async () => HASH,
        confirm: async () => {
          throw new Error("User rejected the request");
        },
      });
    });

    expect(outcome).toEqual({ status: "cancelled", txHash: HASH });
  });
});

describe("useOnChainWrite — concurrency and lifecycle", () => {
  it("a second run while busy does not broadcast again", async () => {
    const broadcast = vi.fn(async () => HASH);
    const confirm = deferred<TransactionReceipt>();
    const { result } = renderHook(() => useOnChainWrite());

    act(() => {
      void result.current.run({ broadcast, confirm: () => confirm.promise });
    });
    await waitFor(() => expect(result.current.phase).toBe("confirming"));

    let second: Awaited<ReturnType<typeof result.current.run>> | undefined;
    await act(async () => {
      second = await result.current.run({ broadcast, confirm: async () => SUCCESS });
    });

    // `busy` is its own outcome, not a TxErrorKind: nothing failed on chain,
    // and it must never reach telemetry as an error.
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(second).toEqual({ status: "busy" });
    expect(result.current.outcome).toBeNull();

    await act(async () => {
      confirm.resolve(SUCCESS);
    });
  });

  it("does not update state after unmount", async () => {
    const confirm = deferred<TransactionReceipt>();
    const { result, unmount } = renderHook(() => useOnChainWrite());

    act(() => {
      void result.current.run({
        broadcast: async () => HASH,
        confirm: () => confirm.promise,
      });
    });
    await waitFor(() => expect(result.current.phase).toBe("confirming"));

    unmount();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      confirm.resolve(SUCCESS);
    });

    // React logs "state update on an unmounted component" through console.error.
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("reset returns the hook to idle", async () => {
    const { result } = renderHook(() => useOnChainWrite());
    await act(async () => {
      await result.current.run({ broadcast: async () => HASH, confirm: async () => SUCCESS });
    });
    expect(result.current.phase).toBe("settled");

    act(() => result.current.reset());
    expect(result.current.phase).toBe("idle");
    expect(result.current.txHash).toBeNull();
    expect(result.current.outcome).toBeNull();
  });
});
