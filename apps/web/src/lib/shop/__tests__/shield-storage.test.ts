import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  consumeLegacyShieldsForMigration,
  MAX_SHIELDS,
  readConsumedCount,
  readCreditedCache,
  readDisplayedShields,
  SHIELDS_CONSUMED_KEY,
  SHIELDS_CREDITED_CACHE_KEY,
  SHIELDS_LEGACY_KEY,
  writeCreditedCache,
} from "@/lib/shop/shield-storage";

describe("shield-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── B1: display math + counter round-trips ──────────────────────

  describe("readDisplayedShields", () => {
    it("returns 0 with no stored counters", () => {
      expect(readDisplayedShields()).toBe(0);
    });

    it("returns credited - consumed in the normal range", () => {
      writeCreditedCache(5);
      window.localStorage.setItem(SHIELDS_CONSUMED_KEY, "2");
      expect(readDisplayedShields()).toBe(3);
    });

    it("clamps to MAX_SHIELDS when credited - consumed exceeds cap", () => {
      writeCreditedCache(33);
      window.localStorage.setItem(SHIELDS_CONSUMED_KEY, "0");
      expect(readDisplayedShields()).toBe(MAX_SHIELDS);
    });

    it("clamps to 0 when consumed exceeds credited (defensive floor)", () => {
      writeCreditedCache(2);
      window.localStorage.setItem(SHIELDS_CONSUMED_KEY, "5");
      expect(readDisplayedShields()).toBe(0);
    });

    it("over-credit drains naturally as user consumes", () => {
      writeCreditedCache(10);
      window.localStorage.setItem(SHIELDS_CONSUMED_KEY, "2");
      // 10 - 2 = 8, capped to MAX_SHIELDS (3)
      expect(readDisplayedShields()).toBe(MAX_SHIELDS);
      window.localStorage.setItem(SHIELDS_CONSUMED_KEY, "8");
      // 10 - 8 = 2 (below cap → shows through)
      expect(readDisplayedShields()).toBe(2);
    });
  });

  // ─── Lote 3 B4: MAX_SHIELDS = 3 cap across all credit sources ─────
  describe("MAX_SHIELDS = 3 cap (Lote 3 B4)", () => {
    it("the cap constant is 3", () => {
      expect(MAX_SHIELDS).toBe(3);
    });

    // Every credit source funnels through `credited`; these prove the
    // displayed count never exceeds 3 regardless of how much is credited.
    it("0 shields + a +3 source → 3 (not more)", () => {
      writeCreditedCache(3); // 0 existing + 3
      expect(readDisplayedShields()).toBe(3);
    });

    it("1 shield + a +3 source → 3 (gains at most 2 effective)", () => {
      writeCreditedCache(4); // effective 1, source adds 3
      expect(readDisplayedShields()).toBe(3);
    });

    it("2 shields + a +3 source → 3, NOT 5", () => {
      writeCreditedCache(5); // effective 2, source adds 3
      expect(readDisplayedShields()).toBe(3);
    });

    it("3 shields + a +3 source → stays 3 (no more above the cap)", () => {
      writeCreditedCache(6); // effective 3, source adds 3
      expect(readDisplayedShields()).toBe(3);
    });

    it("Season Pass (+3) stacking Welcome Pack (+3) → displayed 3, excess buffered", () => {
      writeCreditedCache(6); // Welcome 3 + Season 3, none consumed
      window.localStorage.setItem(SHIELDS_CONSUMED_KEY, "0");
      expect(readDisplayedShields()).toBe(3);
      // The buffer (credited 6) means display holds at 3 until consumed > 3.
      window.localStorage.setItem(SHIELDS_CONSUMED_KEY, "3");
      expect(readDisplayedShields()).toBe(3); // buffer still refills
      window.localStorage.setItem(SHIELDS_CONSUMED_KEY, "4");
      expect(readDisplayedShields()).toBe(2); // drains below cap
    });
  });

  describe("readCreditedCache / writeCreditedCache", () => {
    it("round-trips a positive integer", () => {
      writeCreditedCache(7);
      expect(readCreditedCache()).toBe(7);
    });

    it("returns 0 for an unset key", () => {
      expect(readCreditedCache()).toBe(0);
    });

    it("clamps negative inputs to 0", () => {
      writeCreditedCache(-3);
      expect(readCreditedCache()).toBe(0);
    });

    it("survives a corrupted (non-numeric) stored value", () => {
      window.localStorage.setItem(SHIELDS_CREDITED_CACHE_KEY, "not-a-number");
      expect(readCreditedCache()).toBe(0);
    });
  });

  describe("readConsumedCount", () => {
    it("returns 0 for an unset key", () => {
      expect(readConsumedCount()).toBe(0);
    });

    it("returns the stored consumed value", () => {
      window.localStorage.setItem(SHIELDS_CONSUMED_KEY, "4");
      expect(readConsumedCount()).toBe(4);
    });

    it("returns 0 for a corrupted value", () => {
      window.localStorage.setItem(SHIELDS_CONSUMED_KEY, "garbage");
      expect(readConsumedCount()).toBe(0);
    });
  });

  // ─── B5: legacy migration consume ────────────────────────────────

  describe("consumeLegacyShieldsForMigration", () => {
    it("returns null when no legacy key exists", () => {
      expect(consumeLegacyShieldsForMigration()).toBeNull();
    });

    it("returns { legacy } once when the legacy key exists", () => {
      window.localStorage.setItem(SHIELDS_LEGACY_KEY, "5");
      const result = consumeLegacyShieldsForMigration();
      expect(result).toEqual({ legacy: 5 });
    });

    it("does not delete the legacy key (caller does atomic clear)", () => {
      window.localStorage.setItem(SHIELDS_LEGACY_KEY, "5");
      consumeLegacyShieldsForMigration();
      // Caller is responsible for clearing after consumed +
      // credited-cache writes succeed. The helper merely reads.
      expect(window.localStorage.getItem(SHIELDS_LEGACY_KEY)).toBe("5");
    });

    it("returns { legacy: 0 } when legacy is 0 (signals 'consumed already')", () => {
      window.localStorage.setItem(SHIELDS_LEGACY_KEY, "0");
      const result = consumeLegacyShieldsForMigration();
      expect(result).toEqual({ legacy: 0 });
    });

    it("returns null when consumed key is already initialized (post-migration)", () => {
      window.localStorage.setItem(SHIELDS_LEGACY_KEY, "5");
      window.localStorage.setItem(SHIELDS_CONSUMED_KEY, "0");
      expect(consumeLegacyShieldsForMigration()).toBeNull();
    });

    it("survives a corrupted legacy value (returns null)", () => {
      window.localStorage.setItem(SHIELDS_LEGACY_KEY, "not-a-number");
      expect(consumeLegacyShieldsForMigration()).toBeNull();
    });
  });
});
