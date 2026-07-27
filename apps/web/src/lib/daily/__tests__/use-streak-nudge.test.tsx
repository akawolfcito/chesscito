import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useStreakNudge } from "../use-streak-nudge";
import { getStreakNudgeState } from "../streak-nudge";

const TODAY = "2026-07-27";

type Options = Parameters<typeof useStreakNudge>[0];

function mount(overrides: Partial<Options> = {}) {
  const onOpenDaily = vi.fn();
  const view = renderHook(() =>
    useStreakNudge({
      getToday: () => TODAY,
      isDailySolvedToday: () => false,
      isOverlayOpen: false,
      onOpenDaily,
      ...overrides,
    }),
  );
  return { ...view, onOpenDaily };
}

/** Three fresh solves, which is what arms the latch. */
function trainToThird(result: { current: ReturnType<typeof useStreakNudge> }) {
  act(() => {
    result.current.armOnSolve(1);
    result.current.armOnSolve(2);
    result.current.armOnSolve(3);
  });
}

describe("useStreakNudge", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_STREAK_NUDGE_ENABLED", "true");
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it("renders nothing at the moment of the solve", () => {
    const { result } = mount();

    trainToThird(result);

    expect(result.current.visible).toBe(false);
  });

  it("defers the exit and shows the screen on the way out", () => {
    const { result } = mount();
    const exit = vi.fn();

    trainToThird(result);
    act(() => {
      result.current.interceptExit(exit);
    });

    expect(result.current.visible).toBe(true);
    expect(exit).not.toHaveBeenCalled();
  });

  it("still pays after solves 4 and 5 when the exit at 3 was blocked", () => {
    // The whole reason this is a latch and not a modulo test: `% 3` is false
    // at 4 and 5, so a blocked 3rd solve would teach nothing all day.
    let overlayOpen = true;
    const onOpenDaily = vi.fn();
    const { result, rerender } = renderHook(() =>
      useStreakNudge({
        getToday: () => TODAY,
        isDailySolvedToday: () => false,
        isOverlayOpen: overlayOpen,
        onOpenDaily,
      }),
    );
    const blocked = vi.fn();

    trainToThird(result);
    act(() => {
      result.current.interceptExit(blocked);
    });
    expect(result.current.visible).toBe(false);
    expect(blocked).toHaveBeenCalledTimes(1);

    overlayOpen = false;
    rerender();
    const laterExit = vi.fn();
    act(() => {
      result.current.armOnSolve(4);
      result.current.armOnSolve(5);
    });
    act(() => {
      result.current.interceptExit(laterExit);
    });

    expect(result.current.visible).toBe(true);
    expect(laterExit).not.toHaveBeenCalled();
  });

  it("lets an exit through untouched when nothing is owed", () => {
    const { result } = mount();
    const exit = vi.fn();

    act(() => {
      result.current.armOnSolve(2);
      result.current.interceptExit(exit);
    });

    expect(result.current.visible).toBe(false);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("completes the deferred navigation on dismiss", () => {
    const { result } = mount();
    const exit = vi.fn();

    trainToThird(result);
    act(() => {
      result.current.interceptExit(exit);
    });
    act(() => {
      result.current.handleDismiss();
    });

    expect(exit).toHaveBeenCalledTimes(1);
    expect(result.current.visible).toBe(false);
    expect(getStreakNudgeState().shownCount).toBe(1);
  });

  it("does not show twice in a day once dismissed", () => {
    const { result } = mount();
    const secondExit = vi.fn();

    trainToThird(result);
    act(() => {
      result.current.interceptExit(vi.fn());
    });
    act(() => {
      result.current.handleDismiss();
    });
    act(() => {
      result.current.armOnSolve(6);
      result.current.interceptExit(secondExit);
    });

    expect(result.current.visible).toBe(false);
    expect(secondExit).toHaveBeenCalledTimes(1);
  });

  it("routes to the Daily and retires instead of resuming the exit", () => {
    const { result, onOpenDaily } = mount();
    const exit = vi.fn();

    trainToThird(result);
    act(() => {
      result.current.interceptExit(exit);
    });
    act(() => {
      result.current.handleOpenDaily();
    });

    expect(onOpenDaily).toHaveBeenCalledTimes(1);
    expect(exit).not.toHaveBeenCalled();
    expect(getStreakNudgeState().retired).toBe(true);
  });

  it("yields to any overlay that is already on screen", () => {
    const { result } = mount({ isOverlayOpen: true });
    const exit = vi.fn();

    trainToThird(result);
    act(() => {
      result.current.interceptExit(exit);
    });

    expect(result.current.visible).toBe(false);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("never arms once the Daily is solved", () => {
    const { result } = mount({ isDailySolvedToday: () => true });
    const exit = vi.fn();

    trainToThird(result);
    act(() => {
      result.current.interceptExit(exit);
    });

    expect(result.current.visible).toBe(false);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("does nothing at all with the flag off", () => {
    vi.stubEnv("NEXT_PUBLIC_STREAK_NUDGE_ENABLED", "false");
    const { result } = mount();
    const exit = vi.fn();

    trainToThird(result);
    act(() => {
      result.current.interceptExit(exit);
    });

    expect(result.current.visible).toBe(false);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("chesscito:streak-nudge")).toBeNull();
  });
});
