import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Full mode: CHESSCITO_LITE_MODE=false
vi.mock("@/lib/feature-flags", () => ({ CHESSCITO_LITE_MODE: false }));
vi.mock("@/lib/daily/progress", () => ({
  getDailyProgress: vi.fn(() => ({ streak: 0, lastCompletedDate: null, totalCompleted: 0 })),
}));

const { useWelcomePackage } = await import("../use-welcome-package");

describe("useWelcomePackage — Full mode guard", () => {
  it("returns all false and noops without touching localStorage", () => {
    const { result } = renderHook(() => useWelcomePackage());
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.isClaimed).toBe(false);
    expect(result.current.isPending).toBe(false);
    expect(result.current.shouldAutoShow).toBe(false);

    act(() => result.current.unlock());
    act(() => result.current.claim());
    act(() => result.current.dismiss());
    act(() => result.current.markShown());

    expect(localStorage.getItem("chesscito:welcome-package")).toBeNull();
  });
});
