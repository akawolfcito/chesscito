import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_STATE,
  getWelcomePackageState,
  setWelcomePackageState,
} from "../storage";

const KEY = "chesscito:welcome-package";

beforeEach(() => {
  localStorage.clear();
});

describe("DEFAULT_STATE", () => {
  it("has all fields with safe defaults", () => {
    expect(DEFAULT_STATE).toEqual({
      version: 1,
      unlocked: false,
      unlockedAt: null,
      claimed: false,
      claimedAt: null,
      dismissed: false,
      dismissedAt: null,
      dismissCount: 0,
      autoShowCount: 0,
    });
  });
});

describe("getWelcomePackageState", () => {
  it("returns DEFAULT_STATE when storage is empty", () => {
    expect(getWelcomePackageState()).toEqual(DEFAULT_STATE);
  });

  it("returns DEFAULT_STATE for invalid JSON", () => {
    localStorage.setItem(KEY, "not-json{{");
    expect(getWelcomePackageState()).toEqual(DEFAULT_STATE);
  });

  it("returns DEFAULT_STATE when version !== 1 (migration guard)", () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 2, unlocked: true }));
    expect(getWelcomePackageState()).toEqual(DEFAULT_STATE);
  });

  it("returns parsed state for valid v1 storage", () => {
    const stored = { ...DEFAULT_STATE, unlocked: true, unlockedAt: "2026-06-20T00:00:00Z" };
    localStorage.setItem(KEY, JSON.stringify(stored));
    expect(getWelcomePackageState()).toEqual(stored);
  });
});

describe("setWelcomePackageState + round-trip", () => {
  it("persists and retrieves state correctly", () => {
    const state = {
      ...DEFAULT_STATE,
      unlocked: true,
      unlockedAt: "2026-06-20T00:00:00Z",
      claimed: true,
      claimedAt: "2026-06-20T01:00:00Z",
      dismissCount: 1,
      autoShowCount: 1,
    };
    setWelcomePackageState(state);
    expect(getWelcomePackageState()).toEqual(state);
  });

  it("overwrites previous state", () => {
    setWelcomePackageState({ ...DEFAULT_STATE, unlocked: true });
    setWelcomePackageState({ ...DEFAULT_STATE, unlocked: true, claimed: true });
    expect(getWelcomePackageState().claimed).toBe(true);
  });
});
