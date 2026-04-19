import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// wagmi's useAccount is called inside the hook — stub it with a static
// non-MiniPay value so walletReady flips to true immediately.
vi.mock("wagmi", () => ({
  useAccount: () => ({ isConnected: false }),
}));

vi.mock("@/lib/minipay", () => ({
  isMiniPayEnv: () => false,
}));

const ONBOARDED_KEY = "chesscito:onboarded";

describe("useSplashLoader — briefing lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("markOnboarded flips showBriefing to false in the same session", async () => {
    const { useSplashLoader } = await import("../use-splash-loader");
    const { result, rerender } = renderHook(() => useSplashLoader());

    // Before assets resolve, splash is up — briefing is deliberately false.
    expect(result.current.showSplash).toBe(true);
    expect(result.current.showBriefing).toBe(false);

    // Let the preloadImage timeout fire (3s per asset) so assetsReady flips.
    await act(async () => {
      vi.advanceTimersByTime(3_500);
      await Promise.resolve();
    });
    rerender();

    // First visit + loaded → briefing is shown.
    expect(result.current.showSplash).toBe(false);
    expect(result.current.showBriefing).toBe(true);

    // User dismisses → markOnboarded must collapse the briefing in-session.
    await act(async () => {
      result.current.markOnboarded();
    });

    expect(result.current.showBriefing).toBe(false);
    expect(localStorage.getItem(ONBOARDED_KEY)).toBe("true");
  });

  it("returning users (onboarded flag already set) never see the briefing", async () => {
    localStorage.setItem(ONBOARDED_KEY, "true");

    const { useSplashLoader } = await import("../use-splash-loader");
    const { result, rerender } = renderHook(() => useSplashLoader());

    await act(async () => {
      vi.advanceTimersByTime(3_500);
      await Promise.resolve();
    });
    rerender();

    expect(result.current.showSplash).toBe(false);
    expect(result.current.showBriefing).toBe(false);
  });
});
