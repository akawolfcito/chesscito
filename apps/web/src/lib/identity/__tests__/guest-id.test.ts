// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GUEST_STORAGE_KEY, getOrCreateGuestId, guestSeed } from "../guest-id";

describe("getOrCreateGuestId", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it("creates and persists a guest id on first call", () => {
    expect(window.localStorage.getItem(GUEST_STORAGE_KEY)).toBeNull();
    const id = getOrCreateGuestId();
    expect(id).toBeTruthy();
    expect(window.localStorage.getItem(GUEST_STORAGE_KEY)).toBe(id);
  });

  it("returns the same id across reads", () => {
    const first = getOrCreateGuestId();
    const second = getOrCreateGuestId();
    expect(second).toBe(first);
  });

  it("survives a localStorage throw with an ephemeral id (never throws)", () => {
    const spy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(() => getOrCreateGuestId()).not.toThrow();
    const id = getOrCreateGuestId();
    expect(id).toBeTruthy();
    spy.mockRestore();
  });

  it("guestSeed namespaces the id", () => {
    expect(guestSeed("abc")).toBe("guest:abc");
  });
});
