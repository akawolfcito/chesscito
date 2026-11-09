import { describe, it, expect, beforeEach } from "vitest";
import {
  getMiniArenaBest,
  recordMiniArenaBest,
} from "../mini-arena-progress";

const SETUP_ID = "kr-vs-k";
const STORAGE_KEY = "chesscito:mini-arena-best";

beforeEach(() => {
  localStorage.clear();
});

describe("getMiniArenaBest", () => {
  it("returns null when no record exists", () => {
    expect(getMiniArenaBest(SETUP_ID)).toBeNull();
  });

  it("returns null when storage has a different setup id", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ "other-setup": 10 }));
    expect(getMiniArenaBest(SETUP_ID)).toBeNull();
  });

  it("returns the stored best score", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ [SETUP_ID]: 14 }));
    expect(getMiniArenaBest(SETUP_ID)).toBe(14);
  });

  it("returns null when value is zero", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ [SETUP_ID]: 0 }));
    expect(getMiniArenaBest(SETUP_ID)).toBeNull();
  });

  it("returns null when storage is corrupt JSON", () => {
    localStorage.setItem(STORAGE_KEY, "not-json");
    expect(getMiniArenaBest(SETUP_ID)).toBeNull();
  });
});

describe("recordMiniArenaBest", () => {
  it("records the first completion and returns true", () => {
    const result = recordMiniArenaBest(SETUP_ID, 14);
    expect(result).toBe(true);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored[SETUP_ID]).toBe(14);
  });

  it("returns false when moves <= 0", () => {
    expect(recordMiniArenaBest(SETUP_ID, 0)).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("returns true and updates when beating a previous best", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ [SETUP_ID]: 14 }));
    const result = recordMiniArenaBest(SETUP_ID, 10);
    expect(result).toBe(true);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored[SETUP_ID]).toBe(10);
  });

  it("returns false when not beating previous best", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ [SETUP_ID]: 10 }));
    const result = recordMiniArenaBest(SETUP_ID, 14);
    expect(result).toBe(false);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored[SETUP_ID]).toBe(10); // unchanged
  });

  it("returns false when same score as previous best (not strictly better)", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ [SETUP_ID]: 10 }));
    const result = recordMiniArenaBest(SETUP_ID, 10);
    expect(result).toBe(false);
  });

  it("preserves other setup records when updating one", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ "other-setup": 5, [SETUP_ID]: 14 }),
    );
    recordMiniArenaBest(SETUP_ID, 10);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored["other-setup"]).toBe(5);
    expect(stored[SETUP_ID]).toBe(10);
  });
});
