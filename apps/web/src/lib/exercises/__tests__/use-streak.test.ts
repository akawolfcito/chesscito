import { describe, it, expect, beforeEach } from "vitest";

import { bumpStreak, readStreak, resetStreak } from "../use-streak";

describe("useStreak storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("readStreak returns 0 when no value is stored", () => {
    expect(readStreak()).toBe(0);
  });

  it("bumpStreak increments and returns the new value", () => {
    expect(bumpStreak()).toBe(1);
    expect(bumpStreak()).toBe(2);
    expect(bumpStreak()).toBe(3);
    expect(readStreak()).toBe(3);
  });

  it("resetStreak sets the value back to 0", () => {
    bumpStreak();
    bumpStreak();
    expect(readStreak()).toBe(2);
    resetStreak();
    expect(readStreak()).toBe(0);
  });

  it("resetStreak is a no-op when the value is already 0 (no event dispatched)", () => {
    let dispatched = 0;
    const handler = () => {
      dispatched += 1;
    };
    window.addEventListener("chesscito:streak-changed", handler);
    resetStreak();
    expect(dispatched).toBe(0);
    window.removeEventListener("chesscito:streak-changed", handler);
  });

  it("bumpStreak dispatches chesscito:streak-changed so subscribers can refresh", () => {
    let dispatched = 0;
    const handler = () => {
      dispatched += 1;
    };
    window.addEventListener("chesscito:streak-changed", handler);
    bumpStreak();
    expect(dispatched).toBe(1);
    window.removeEventListener("chesscito:streak-changed", handler);
  });

  it("readStreak ignores corrupted localStorage values gracefully", () => {
    window.localStorage.setItem("chesscito:streak", "not-a-number");
    expect(readStreak()).toBe(0);
    window.localStorage.setItem("chesscito:streak", "-5");
    expect(readStreak()).toBe(0);
  });
});
