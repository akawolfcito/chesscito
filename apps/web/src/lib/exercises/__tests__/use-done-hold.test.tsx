import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { SAVE_DONE_HOLD_MS, useDoneHold } from "../use-done-hold";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDoneHold", () => {
  it("starts closed", () => {
    const { result } = renderHook(() => useDoneHold());
    expect(result.current.doneAt).toBeNull();
  });

  it("opens the hold window and closes it after SAVE_DONE_HOLD_MS", () => {
    const { result } = renderHook(() => useDoneHold());

    act(() => result.current.start("0xabc"));
    expect(result.current.doneAt).not.toBeNull();

    act(() => vi.advanceTimersByTime(SAVE_DONE_HOLD_MS - 1));
    expect(result.current.doneAt).not.toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.doneAt).toBeNull();
  });

  it("preserves the 1500ms window the effect it replaces used", () => {
    expect(SAVE_DONE_HOLD_MS).toBe(1500);
  });

  // This is the latch that `doneHoldStartedForTxRef` used to carry. A repeated
  // start for the same tx must not restart the window.
  it("is idempotent per key: a second start for the same tx is a no-op", () => {
    const { result } = renderHook(() => useDoneHold());

    act(() => result.current.start("0xabc"));
    const first = result.current.doneAt;

    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.start("0xabc"));

    expect(result.current.doneAt).toBe(first);
    // The original window still expires on its own schedule, un-extended.
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.doneAt).toBeNull();
  });

  it("a different key opens a fresh window", () => {
    const { result } = renderHook(() => useDoneHold());

    act(() => result.current.start("0xabc"));
    act(() => vi.advanceTimersByTime(SAVE_DONE_HOLD_MS));
    expect(result.current.doneAt).toBeNull();

    act(() => result.current.start("0xdef"));
    expect(result.current.doneAt).not.toBeNull();
  });

  it("reset closes the window, clears the timer, and re-arms the same key", () => {
    const { result } = renderHook(() => useDoneHold());

    act(() => result.current.start("0xabc"));
    act(() => result.current.reset());
    expect(result.current.doneAt).toBeNull();

    // The cleared timer must not fire later and null an unrelated window.
    act(() => result.current.start("0xabc"));
    expect(result.current.doneAt).not.toBeNull();
    act(() => vi.advanceTimersByTime(SAVE_DONE_HOLD_MS - 1));
    expect(result.current.doneAt).not.toBeNull();
  });

  it("clears its timer on unmount", () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    const { result, unmount } = renderHook(() => useDoneHold());

    act(() => result.current.start("0xabc"));
    unmount();

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
