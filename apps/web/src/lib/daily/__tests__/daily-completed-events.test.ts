import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dispatchDailyCompleted, subscribeToDailyCompleted } from "../events";
import { recordDailyCompletion } from "../progress";

/**
 * A DEDICATED event for "the Daily was just completed".
 *
 * `chesscito:daily-progress-changed` cannot carry this: it is dispatched from
 * two places (`progress.ts` and, redundantly, `challenge-daily-client.tsx`) and
 * tests emit it by hand. Hanging a WRITE off it means anyone who re-renders a
 * card can mint a ledger row. This event fires only where a completion was
 * actually recorded, and it carries the date that was recorded.
 */

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("daily completed event bus", () => {
  it("delivers the completed date to subscribers", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToDailyCompleted(handler);

    dispatchDailyCompleted("2026-04-25");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("2026-04-25");
    unsubscribe();
  });

  it("stops delivering after unsubscribe", () => {
    const handler = vi.fn();
    subscribeToDailyCompleted(handler)();

    dispatchDailyCompleted("2026-04-25");

    expect(handler).not.toHaveBeenCalled();
  });

  it("is a different channel from daily-progress-changed", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToDailyCompleted(handler);

    window.dispatchEvent(new CustomEvent("chesscito:daily-progress-changed"));

    expect(handler).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe("recordDailyCompletion emits the completion", () => {
  it("emits once, with the recorded date, on a real completion", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToDailyCompleted(handler);

    recordDailyCompletion("2026-04-25");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("2026-04-25");
    unsubscribe();
  });

  it("does NOT emit on the no-op second call of the same day", () => {
    recordDailyCompletion("2026-04-25");
    const handler = vi.fn();
    const unsubscribe = subscribeToDailyCompleted(handler);

    recordDailyCompletion("2026-04-25");

    expect(handler).not.toHaveBeenCalled();
    unsubscribe();
  });
});
