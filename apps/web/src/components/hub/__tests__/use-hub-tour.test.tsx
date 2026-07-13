import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useHubTour } from "../use-hub-tour";
import { HUB_TOUR_STORAGE_KEY } from "@/lib/hub/hub-tour";

vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));

beforeEach(() => {
  window.localStorage.clear();
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useHubTour", () => {
  it("stays shut until the player's state is known — an early tour would sell the pass to someone who owns it", () => {
    const { result, rerender } = renderHook(
      ({ ready }) => useHubTour({ enabled: true, ready }),
      { initialProps: { ready: false } },
    );
    expect(result.current.open).toBe(false);

    rerender({ ready: true });
    expect(result.current.open).toBe(true);
  });

  it("never runs outside LEARN", () => {
    const { result } = renderHook(() =>
      useHubTour({ enabled: false, ready: true }),
    );
    expect(result.current.open).toBe(false);
  });

  it("yields to a modal that is already on screen", () => {
    document.body.innerHTML = '<div aria-modal="true">Season Pass</div>';
    const { result } = renderHook(() =>
      useHubTour({ enabled: true, ready: true }),
    );
    expect(result.current.open).toBe(false);
  });

  it("does not relaunch for a player who already saw it", () => {
    window.localStorage.setItem(HUB_TOUR_STORAGE_KEY, "skipped");
    const { result } = renderHook(() =>
      useHubTour({ enabled: true, ready: true }),
    );
    expect(result.current.open).toBe(false);
  });

  it("persists the outcome when the tour finishes and closes it", () => {
    const { result } = renderHook(() =>
      useHubTour({ enabled: true, ready: true }),
    );
    expect(result.current.open).toBe(true);

    act(() => result.current.finish("completed"));

    expect(result.current.open).toBe(false);
    expect(window.localStorage.getItem(HUB_TOUR_STORAGE_KEY)).toBe("completed");
  });

  it("decides once per mount — it does not pop open mid-session behind a closing sheet", () => {
    document.body.innerHTML = '<div aria-modal="true">Season Pass</div>';
    const { result, rerender } = renderHook(() =>
      useHubTour({ enabled: true, ready: true }),
    );
    expect(result.current.open).toBe(false);

    document.body.innerHTML = "";
    rerender();

    expect(result.current.open).toBe(false);
  });
});
