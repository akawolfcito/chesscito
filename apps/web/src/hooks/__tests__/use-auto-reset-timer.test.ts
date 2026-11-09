import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutoResetTimer } from "../use-auto-reset-timer";

describe("useAutoResetTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires the scheduled callback after the timeout", () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useAutoResetTimer());

    act(() => result.current.schedule(cb, 1000));
    expect(cb).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(cb).toHaveBeenCalledOnce();
  });

  it("clear() cancels a pending timer", () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useAutoResetTimer());

    act(() => result.current.schedule(cb, 1000));
    act(() => result.current.clear());
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(cb).not.toHaveBeenCalled();
  });

  it("schedule() replaces any pending timer rather than stacking", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result } = renderHook(() => useAutoResetTimer());

    act(() => result.current.schedule(first, 1000));
    act(() => result.current.schedule(second, 1000));
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it("invalidate() prevents the in-flight callback from firing", () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useAutoResetTimer());

    act(() => result.current.schedule(cb, 1000));
    act(() => result.current.invalidate());
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(cb).not.toHaveBeenCalled();
  });

  it("after invalidate(), a NEW schedule() fires normally", () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useAutoResetTimer());

    act(() => result.current.invalidate());
    act(() => result.current.schedule(cb, 500));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(cb).toHaveBeenCalledOnce();
  });

  it("unmount cleans up any pending timer", () => {
    const cb = vi.fn();
    const { result, unmount } = renderHook(() => useAutoResetTimer());

    act(() => result.current.schedule(cb, 1000));
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(cb).not.toHaveBeenCalled();
  });
});
