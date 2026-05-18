import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHubOnboarding, HUB_ONBOARDING_KEY } from "@/hooks/use-hub-onboarding";

beforeEach(() => { window.localStorage.clear(); });

describe("useHubOnboarding", () => {
  it("hasSeenOnboarding=false on first visit", () => {
    const { result } = renderHook(() => useHubOnboarding());
    expect(result.current.hasSeenOnboarding).toBe(false);
  });

  it("hasSeenOnboarding=true when storage flag set", () => {
    window.localStorage.setItem(HUB_ONBOARDING_KEY, "true");
    const { result } = renderHook(() => useHubOnboarding());
    expect(result.current.hasSeenOnboarding).toBe(true);
  });

  it("dismiss() persists the flag", () => {
    const { result } = renderHook(() => useHubOnboarding());
    act(() => result.current.dismiss());
    expect(result.current.hasSeenOnboarding).toBe(true);
    expect(window.localStorage.getItem(HUB_ONBOARDING_KEY)).toBe("true");
  });
});
