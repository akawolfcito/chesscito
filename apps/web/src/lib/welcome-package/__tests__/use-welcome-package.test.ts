import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { DEFAULT_STATE, getWelcomePackageState, setWelcomePackageState } from "../storage";

vi.mock("@/lib/feature-flags", () => ({ CHESSCITO_LITE_MODE: true }));
vi.mock("@/lib/daily/progress", () => ({
  getDailyProgress: vi.fn(() => ({ streak: 0, lastCompletedDate: null, totalCompleted: 0 })),
}));

const { useWelcomePackage } = await import("../use-welcome-package");
const { getDailyProgress } = await import("@/lib/daily/progress");

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getDailyProgress).mockReturnValue({ streak: 0, lastCompletedDate: null, totalCompleted: 0 });
});

describe("useWelcomePackage — Lite mode", () => {
  it("starts with DEFAULT_STATE when storage is empty and no prior achievement", () => {
    const { result } = renderHook(() => useWelcomePackage());
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.isClaimed).toBe(false);
    expect(result.current.isPending).toBe(false);
    expect(result.current.shouldAutoShow).toBe(false);
  });

  it("does NOT retroactively unlock from totalCompleted>=1 (Task 10 — gift belongs to the first-reward milestone, not the first Daily Focus)", () => {
    vi.mocked(getDailyProgress).mockReturnValue({ streak: 1, lastCompletedDate: "2026-06-20", totalCompleted: 1 });
    const { result } = renderHook(() => useWelcomePackage());
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.isClaimed).toBe(false);
    expect(result.current.isPending).toBe(false);
    expect(result.current.shouldAutoShow).toBe(false);
    expect(getWelcomePackageState().unlocked).toBe(false);
  });

  // The hook exposes NO `unlock()`. `unlockWelcomePackageGift()` (exercises
  // screen) is the single writer of that transition — see the interface doc.
  it("reflects an unlock written by the single writer, without exposing one", () => {
    setWelcomePackageState({ ...DEFAULT_STATE, unlocked: true, unlockedAt: "2026-06-20T00:00:00Z" });
    const { result } = renderHook(() => useWelcomePackage());
    expect(result.current.isUnlocked).toBe(true);
    expect("unlock" in result.current).toBe(false);
  });

  it("claim() sets claimed=true and claimedAt", () => {
    setWelcomePackageState({ ...DEFAULT_STATE, unlocked: true, unlockedAt: "2026-06-20T00:00:00Z" });
    const { result } = renderHook(() => useWelcomePackage());
    act(() => result.current.claim());
    expect(result.current.isClaimed).toBe(true);
    const stored = getWelcomePackageState();
    expect(stored.claimed).toBe(true);
    expect(stored.claimedAt).not.toBeNull();
  });

  it("dismiss() increments dismissCount and sets dismissedAt", () => {
    setWelcomePackageState({ ...DEFAULT_STATE, unlocked: true, unlockedAt: "2026-06-20T00:00:00Z" });
    const { result } = renderHook(() => useWelcomePackage());
    act(() => result.current.dismiss());
    const stored = getWelcomePackageState();
    expect(stored.dismissCount).toBe(1);
    expect(stored.dismissedAt).not.toBeNull();
    act(() => result.current.dismiss());
    expect(getWelcomePackageState().dismissCount).toBe(2);
  });

  it("shouldAutoShow=true when unlocked, not claimed, autoShowCount<2", () => {
    setWelcomePackageState({ ...DEFAULT_STATE, unlocked: true, unlockedAt: "now", autoShowCount: 1 });
    const { result } = renderHook(() => useWelcomePackage());
    expect(result.current.shouldAutoShow).toBe(true);
  });

  it("shouldAutoShow=false when autoShowCount>=2", () => {
    setWelcomePackageState({ ...DEFAULT_STATE, unlocked: true, unlockedAt: "now", autoShowCount: 2 });
    const { result } = renderHook(() => useWelcomePackage());
    expect(result.current.shouldAutoShow).toBe(false);
  });

  it("shouldAutoShow=false when claimed=true", () => {
    setWelcomePackageState({ ...DEFAULT_STATE, unlocked: true, unlockedAt: "now", claimed: true, claimedAt: "now" });
    const { result } = renderHook(() => useWelcomePackage());
    expect(result.current.shouldAutoShow).toBe(false);
  });

  it("markShown() increments autoShowCount", () => {
    setWelcomePackageState({ ...DEFAULT_STATE, unlocked: true, unlockedAt: "now", autoShowCount: 0 });
    const { result } = renderHook(() => useWelcomePackage());
    act(() => result.current.markShown());
    expect(getWelcomePackageState().autoShowCount).toBe(1);
    act(() => result.current.markShown());
    expect(getWelcomePackageState().autoShowCount).toBe(2);
  });

  it("isPending=true when unlocked and not claimed", () => {
    setWelcomePackageState({ ...DEFAULT_STATE, unlocked: true, unlockedAt: "now" });
    const { result } = renderHook(() => useWelcomePackage());
    expect(result.current.isPending).toBe(true);
  });

  it("isPending=false after claim", () => {
    setWelcomePackageState({ ...DEFAULT_STATE, unlocked: true, unlockedAt: "now" });
    const { result } = renderHook(() => useWelcomePackage());
    act(() => result.current.claim());
    expect(result.current.isPending).toBe(false);
  });
});
