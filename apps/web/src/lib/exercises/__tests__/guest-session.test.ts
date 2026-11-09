import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOrCreateGuestSessionId,
  isGuestGraduated,
} from "@/lib/exercises/guest-session";

const KEY = "chesscito:guest-session-id";

describe("getOrCreateGuestSessionId", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("creates the id once and persists it to localStorage", () => {
    expect(localStorage.getItem(KEY)).toBeNull();
    const id = getOrCreateGuestSessionId();
    expect(id).toBeTruthy();
    expect(localStorage.getItem(KEY)).toBe(id);
  });

  it("reuses the same id on subsequent calls", () => {
    const a = getOrCreateGuestSessionId();
    const b = getOrCreateGuestSessionId();
    expect(a).toBe(b);
  });

  it("falls back to an opaque id when crypto.randomUUID is unavailable", () => {
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
      throw new Error("not available");
    });
    const id = getOrCreateGuestSessionId();
    expect(id).toBeTruthy();
    expect(id!.startsWith("guest-")).toBe(true);
  });

  it("returns null without crashing when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("localStorage disabled");
    });
    expect(getOrCreateGuestSessionId()).toBeNull();
  });
});

describe("isGuestGraduated", () => {
  it("does not graduate at 4/5 canonical completed", () => {
    expect(isGuestGraduated([1, 1, 1, 1, 0, 0, 0, 0, 0, 0])).toBe(false);
  });

  it("graduates when all 5 canonical have ≥1★", () => {
    expect(isGuestGraduated([1, 1, 1, 1, 1, 0, 0, 0, 0, 0])).toBe(true);
  });

  it("graduates with higher stars too", () => {
    expect(isGuestGraduated([3, 2, 3, 1, 2, 0, 0, 0, 0, 0])).toBe(true);
  });

  it("does not graduate when the array is shorter than 5", () => {
    expect(isGuestGraduated([1, 1, 1])).toBe(false);
  });

  it("does not graduate with an empty array", () => {
    expect(isGuestGraduated([])).toBe(false);
  });
});
