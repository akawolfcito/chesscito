/**
 * Sprint 5 commit D — useRetryGuard tests.
 *
 * Contract assertions:
 *   - first call for an attemptSeq runs reset + increment EXACTLY once
 *   - subsequent calls for the SAME attemptSeq are no-ops
 *   - when attemptSeq advances, the guard re-opens for the new value
 *   - reset runs BEFORE increment (board lands fresh before counter
 *     advances)
 *   - returned callback is referentially stable when deps don't change
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useRetryGuard } from "@/lib/exercises/use-retry-guard";

describe("useRetryGuard", () => {
  it("first invocation runs reset + increment exactly once", () => {
    const resetBoard = vi.fn();
    const incrementAttemptSeq = vi.fn();
    const { result } = renderHook(() =>
      useRetryGuard({
        attemptSeq: 1,
        resetBoard,
        incrementAttemptSeq,
      }),
    );

    act(() => {
      result.current();
    });

    expect(resetBoard).toHaveBeenCalledTimes(1);
    expect(incrementAttemptSeq).toHaveBeenCalledTimes(1);
  });

  it("subsequent calls for the same attemptSeq are no-ops (double-tap / duplicate)", () => {
    const resetBoard = vi.fn();
    const incrementAttemptSeq = vi.fn();
    const { result } = renderHook(() =>
      useRetryGuard({
        attemptSeq: 1,
        resetBoard,
        incrementAttemptSeq,
      }),
    );

    act(() => {
      result.current();
      result.current();
      result.current();
    });

    expect(resetBoard).toHaveBeenCalledTimes(1);
    expect(incrementAttemptSeq).toHaveBeenCalledTimes(1);
  });

  it("re-opens for a new attemptSeq after the parent advances the counter", () => {
    const resetBoard = vi.fn();
    const incrementAttemptSeq = vi.fn();
    const { result, rerender } = renderHook(
      ({ attemptSeq }: { attemptSeq: number }) =>
        useRetryGuard({
          attemptSeq,
          resetBoard,
          incrementAttemptSeq,
        }),
      { initialProps: { attemptSeq: 1 } },
    );

    act(() => {
      result.current();
    });
    expect(resetBoard).toHaveBeenCalledTimes(1);

    // Parent advanced attemptSeq → guard sees a new value → next call
    // re-fires the transition.
    rerender({ attemptSeq: 2 });
    act(() => {
      result.current();
    });
    expect(resetBoard).toHaveBeenCalledTimes(2);
    expect(incrementAttemptSeq).toHaveBeenCalledTimes(2);
  });

  it("resetBoard fires BEFORE incrementAttemptSeq (board fresh before counter advances)", () => {
    const order: string[] = [];
    const resetBoard = vi.fn(() => {
      order.push("reset");
    });
    const incrementAttemptSeq = vi.fn(() => {
      order.push("increment");
    });

    const { result } = renderHook(() =>
      useRetryGuard({
        attemptSeq: 1,
        resetBoard,
        incrementAttemptSeq,
      }),
    );

    act(() => {
      result.current();
    });

    expect(order).toEqual(["reset", "increment"]);
  });

  it("returns a referentially stable callback when deps don't change", () => {
    const resetBoard = vi.fn();
    const incrementAttemptSeq = vi.fn();
    const { result, rerender } = renderHook(() =>
      useRetryGuard({
        attemptSeq: 1,
        resetBoard,
        incrementAttemptSeq,
      }),
    );
    const initial = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(initial);
  });
});
