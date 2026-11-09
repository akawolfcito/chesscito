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

  describe("onApplied (Sprint 5 commit F)", () => {
    it("fires INSIDE the dedup gate with the CLOSED attemptSeq + default source", () => {
      const resetBoard = vi.fn();
      const incrementAttemptSeq = vi.fn();
      const onApplied = vi.fn();
      const { result } = renderHook(() =>
        useRetryGuard({
          attemptSeq: 7,
          resetBoard,
          incrementAttemptSeq,
          onApplied,
        }),
      );

      act(() => {
        result.current();
      });

      expect(onApplied).toHaveBeenCalledTimes(1);
      // Receives the attemptSeq value that the guard read BEFORE
      // incrementing + the default source label.
      expect(onApplied).toHaveBeenCalledWith(7, "contextual_action_slot");
    });

    it("Sprint 6 commit C — forwards the source argument when caller supplies one", () => {
      const onApplied = vi.fn();
      const { result } = renderHook(() =>
        useRetryGuard({
          attemptSeq: 3,
          resetBoard: vi.fn(),
          incrementAttemptSeq: vi.fn(),
          onApplied,
        }),
      );

      act(() => {
        result.current("auto_reset");
      });

      expect(onApplied).toHaveBeenCalledTimes(1);
      expect(onApplied).toHaveBeenCalledWith(3, "auto_reset");
    });

    it("Sprint 6 commit C — same attemptSeq deduped regardless of source label (auto_reset + manual collapse)", () => {
      const resetBoard = vi.fn();
      const incrementAttemptSeq = vi.fn();
      const onApplied = vi.fn();
      const { result } = renderHook(() =>
        useRetryGuard({
          attemptSeq: 1,
          resetBoard,
          incrementAttemptSeq,
          onApplied,
        }),
      );

      act(() => {
        result.current("auto_reset");
        // User taps RETRY immediately after auto-reset fires —
        // same attemptSeq, MUST collapse to a single transition.
        result.current("contextual_action_slot");
        result.current("contextual_action_slot");
      });

      expect(resetBoard).toHaveBeenCalledTimes(1);
      expect(incrementAttemptSeq).toHaveBeenCalledTimes(1);
      expect(onApplied).toHaveBeenCalledTimes(1);
      // The first invocation wins, so the source on the emit
      // describes which trigger actually crossed the gate.
      expect(onApplied).toHaveBeenCalledWith(1, "auto_reset");
    });

    it("does NOT fire on duplicate / double-tap (same attemptSeq)", () => {
      const onApplied = vi.fn();
      const { result } = renderHook(() =>
        useRetryGuard({
          attemptSeq: 1,
          resetBoard: vi.fn(),
          incrementAttemptSeq: vi.fn(),
          onApplied,
        }),
      );

      act(() => {
        result.current();
        result.current();
        result.current();
      });

      expect(onApplied).toHaveBeenCalledTimes(1);
    });

    it("fires AFTER reset + increment so consumers can read the latest state", () => {
      const order: string[] = [];
      const resetBoard = vi.fn(() => order.push("reset"));
      const incrementAttemptSeq = vi.fn(() => order.push("increment"));
      const onApplied = vi.fn(() => order.push("onApplied"));

      const { result } = renderHook(() =>
        useRetryGuard({
          attemptSeq: 1,
          resetBoard,
          incrementAttemptSeq,
          onApplied,
        }),
      );

      act(() => {
        result.current();
      });

      expect(order).toEqual(["reset", "increment", "onApplied"]);
    });

    it("re-fires for a new attemptSeq after the counter advances", () => {
      const onApplied = vi.fn();
      const { result, rerender } = renderHook(
        ({ attemptSeq }: { attemptSeq: number }) =>
          useRetryGuard({
            attemptSeq,
            resetBoard: vi.fn(),
            incrementAttemptSeq: vi.fn(),
            onApplied,
          }),
        { initialProps: { attemptSeq: 1 } },
      );

      act(() => {
        result.current();
      });
      expect(onApplied).toHaveBeenCalledWith(1, "contextual_action_slot");

      rerender({ attemptSeq: 2 });
      act(() => {
        result.current();
      });
      expect(onApplied).toHaveBeenCalledTimes(2);
      expect(onApplied).toHaveBeenLastCalledWith(2, "contextual_action_slot");
    });

    it("is optional — guard works WITHOUT onApplied", () => {
      const resetBoard = vi.fn();
      const incrementAttemptSeq = vi.fn();
      const { result } = renderHook(() =>
        useRetryGuard({
          attemptSeq: 1,
          resetBoard,
          incrementAttemptSeq,
        }),
      );

      expect(() => act(() => result.current())).not.toThrow();
      expect(resetBoard).toHaveBeenCalledTimes(1);
      expect(incrementAttemptSeq).toHaveBeenCalledTimes(1);
    });
  });
});
