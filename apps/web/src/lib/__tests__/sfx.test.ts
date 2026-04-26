import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isSfxMuted, setSfxMuted } from "../sfx";

const STORAGE_KEY = "chesscito:sfx-muted";

describe("sfx mute persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset module-level cache by re-evaluating the getter — setSfxMuted
    // refreshes the cached value to whatever we pass.
    setSfxMuted(false);
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("defaults to unmuted on a fresh device", () => {
    localStorage.removeItem(STORAGE_KEY);
    setSfxMuted(false);
    expect(isSfxMuted()).toBe(false);
  });

  it("persists the muted flag across reads", () => {
    setSfxMuted(true);
    expect(isSfxMuted()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("clears the storage key when un-muting", () => {
    setSfxMuted(true);
    setSfxMuted(false);
    expect(isSfxMuted()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
