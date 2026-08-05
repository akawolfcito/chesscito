import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useHubTour } from "../use-hub-tour";
import {
  HUB_TOUR_DAILY_STORAGE_KEY,
  HUB_TOUR_STORAGE_KEYS,
} from "@/lib/hub/hub-tour";

vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));

beforeEach(() => {
  window.localStorage.clear();
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useHubTour", () => {
  it("waits for narrated state to resolve", () => {
    const { result, rerender } = renderHook(
      ({ ready }) => useHubTour({ mode: "learn", enabled: true, ready }),
      { initialProps: { ready: false } },
    );
    expect(result.current.open).toBe(false);
    rerender({ ready: true });
    expect(result.current.open).toBe(true);
  });

  it("keeps LEARN and PLAY completion independent", () => {
    window.localStorage.setItem(HUB_TOUR_STORAGE_KEYS.learn, "completed");
    const { result } = renderHook(() =>
      useHubTour({ mode: "play", enabled: true, ready: true }),
    );
    expect(result.current.open).toBe(true);
  });

  it("omits Daily in LEARN once the introduction already ran", () => {
    window.localStorage.setItem(HUB_TOUR_DAILY_STORAGE_KEY, "completed");
    const { result } = renderHook(() =>
      useHubTour({ mode: "learn", enabled: true, ready: true }),
    );
    expect(result.current.includeDaily).toBe(false);
  });

  /** PLAY spends its three steps on context → offer → action. It has no Daily
   *  step, so claiming the shared memory would silence LEARN's ritual for a
   *  player who happened to open PLAY first. */
  it("never includes Daily in PLAY, whatever the shared memory says", () => {
    const { result } = renderHook(() =>
      useHubTour({ mode: "play", enabled: true, ready: true }),
    );
    expect(result.current.includeDaily).toBe(false);
    act(() => result.current.replay());
    expect(result.current.includeDaily).toBe(false);
  });

  it("finishing PLAY does not mark the Daily as explained", () => {
    const { result } = renderHook(() =>
      useHubTour({ mode: "play", enabled: true, ready: true }),
    );
    act(() => result.current.finish("completed"));
    expect(result.current.open).toBe(false);
    expect(window.localStorage.getItem(HUB_TOUR_STORAGE_KEYS.play)).toBe(
      "completed",
    );
    expect(window.localStorage.getItem(HUB_TOUR_DAILY_STORAGE_KEY)).toBeNull();
  });

  it("still teaches LEARN the Daily after PLAY was completed first", () => {
    const play = renderHook(() =>
      useHubTour({ mode: "play", enabled: true, ready: true }),
    );
    act(() => play.result.current.finish("completed"));

    const learn = renderHook(() =>
      useHubTour({ mode: "learn", enabled: true, ready: true }),
    );
    expect(learn.result.current.includeDaily).toBe(true);
  });

  it("persists both mode and shared Daily when LEARN finishes a full tour", () => {
    const { result } = renderHook(() =>
      useHubTour({ mode: "learn", enabled: true, ready: true }),
    );
    act(() => result.current.finish("completed"));
    expect(window.localStorage.getItem(HUB_TOUR_STORAGE_KEYS.learn)).toBe(
      "completed",
    );
    expect(window.localStorage.getItem(HUB_TOUR_DAILY_STORAGE_KEY)).toBe(
      "completed",
    );
  });

  it("manual replay restores Daily but never mutates seen flags", () => {
    window.localStorage.setItem(HUB_TOUR_STORAGE_KEYS.learn, "skipped");
    window.localStorage.setItem(HUB_TOUR_DAILY_STORAGE_KEY, "completed");
    const { result } = renderHook(() =>
      useHubTour({ mode: "learn", enabled: true, ready: true }),
    );
    act(() => result.current.replay());
    expect(result.current.open).toBe(true);
    expect(result.current.includeDaily).toBe(true);
    act(() => result.current.finish("completed"));
    expect(window.localStorage.getItem(HUB_TOUR_STORAGE_KEYS.learn)).toBe(
      "skipped",
    );
  });

  it("decides once per mount instead of ambushing after a sheet closes", () => {
    document.body.innerHTML = '<div aria-modal="true">Sheet</div>';
    const { result, rerender } = renderHook(() =>
      useHubTour({ mode: "learn", enabled: true, ready: true }),
    );
    expect(result.current.open).toBe(false);
    document.body.innerHTML = "";
    rerender();
    expect(result.current.open).toBe(false);
  });
});

/**
 * `onFinished` is the single hook the tour → first-activity experiment hangs
 * off. Its contract is narrow on purpose: it must fire exactly once per
 * completion, AFTER the seen-flag is persisted, and it must tell a replay
 * apart from a first run.
 */
describe("useHubTour — onFinished", () => {
  it("fires once with the outcome, for a completion", () => {
    const onFinished = vi.fn();
    const { result } = renderHook(() =>
      useHubTour({ mode: "learn", enabled: true, ready: true, onFinished }),
    );

    act(() => {
      result.current.finish("completed");
    });

    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(onFinished).toHaveBeenCalledWith({
      outcome: "completed",
      replay: false,
    });
  });

  it("reports a skip as a skip, not as a completion", () => {
    const onFinished = vi.fn();
    const { result } = renderHook(() =>
      useHubTour({ mode: "learn", enabled: true, ready: true, onFinished }),
    );

    act(() => {
      result.current.finish("skipped");
    });

    expect(onFinished).toHaveBeenCalledWith({
      outcome: "skipped",
      replay: false,
    });
  });

  /** A veteran replaying from settings must be distinguishable, or the
   *  experiment would hijack the hub of somebody already using the product. */
  it("flags a manual replay", () => {
    const onFinished = vi.fn();
    const { result } = renderHook(() =>
      useHubTour({ mode: "learn", enabled: true, ready: true, onFinished }),
    );

    act(() => {
      result.current.finish("completed");
    });
    act(() => {
      result.current.replay();
    });
    act(() => {
      result.current.finish("completed");
    });

    expect(onFinished).toHaveBeenCalledTimes(2);
    expect(onFinished).toHaveBeenLastCalledWith({
      outcome: "completed",
      replay: true,
    });
  });

  /** Ordering IS the idempotency guarantee: whatever the callback does next
   *  must never run against an install that could still see the tour again. */
  it("runs only after the seen-flag is persisted", () => {
    let flagAtCallback: string | null = "unwritten";
    const { result } = renderHook(() =>
      useHubTour({
        mode: "learn",
        enabled: true,
        ready: true,
        onFinished: () => {
          flagAtCallback = window.localStorage.getItem(
            HUB_TOUR_STORAGE_KEYS.learn,
          );
        },
      }),
    );

    act(() => {
      result.current.finish("completed");
    });

    expect(flagAtCallback).toBe("completed");
  });

  it("is optional — the tour works with no callback at all", () => {
    const { result } = renderHook(() =>
      useHubTour({ mode: "learn", enabled: true, ready: true }),
    );
    act(() => {
      result.current.finish("completed");
    });
    expect(result.current.open).toBe(false);
  });
});
