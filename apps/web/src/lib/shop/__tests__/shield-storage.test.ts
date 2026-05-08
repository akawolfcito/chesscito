import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  consumeLegacyShieldsForMigration,
  consumeOneShield,
  dequeuePendingTx,
  enqueuePendingTx,
  MAX_SHIELDS,
  PENDING_TX_QUEUE_MAX,
  PENDING_TX_TTL_MS,
  readConsumedCount,
  readCreditedCache,
  readDisplayedShields,
  readPendingTxs,
  SHIELDS_CONSUMED_KEY,
  SHIELDS_CREDITED_CACHE_KEY,
  SHIELDS_LEGACY_KEY,
  SHIELDS_PENDING_TX_KEY,
  writeCreditedCache,
} from "@/lib/shop/shield-storage";
import { subscribeToShieldChanges } from "@/lib/shop/shield-events";

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
      writeCreditedCache(33);
      window.localStorage.setItem(SHIELDS_CONSUMED_KEY, "2");
      // 33 - 2 = 31, capped to 30
      expect(readDisplayedShields()).toBe(MAX_SHIELDS);
      window.localStorage.setItem(SHIELDS_CONSUMED_KEY, "4");
      // 33 - 4 = 29
      expect(readDisplayedShields()).toBe(29);
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

  // ─── B2: consume + dispatch ──────────────────────────────────────

  describe("consumeOneShield", () => {
    it("bumps the consumed counter by 1 from 0", () => {
      consumeOneShield();
      expect(readConsumedCount()).toBe(1);
    });

    it("bumps cumulatively across calls", () => {
      consumeOneShield();
      consumeOneShield();
      consumeOneShield();
      expect(readConsumedCount()).toBe(3);
    });

    it("never touches credited-cache", () => {
      writeCreditedCache(10);
      consumeOneShield();
      expect(readCreditedCache()).toBe(10);
    });

    it("dispatches shield-events so subscribers refresh", () => {
      const handler = vi.fn();
      const unsubscribe = subscribeToShieldChanges(handler);
      consumeOneShield();
      expect(handler).toHaveBeenCalledTimes(1);
      unsubscribe();
    });
  });

  // ─── B3: pending-tx queue (enqueue/dequeue/idempotent/ring) ─────

  describe("pending-tx queue", () => {
    it("starts empty", () => {
      expect(readPendingTxs()).toEqual([]);
    });

    it("enqueue + read returns the entry with a queuedAt timestamp", () => {
      const before = Date.now();
      enqueuePendingTx("0xaa");
      const after = Date.now();
      const queue = readPendingTxs();
      expect(queue).toHaveLength(1);
      expect(queue[0].txHash).toBe("0xaa");
      expect(queue[0].queuedAt).toBeGreaterThanOrEqual(before);
      expect(queue[0].queuedAt).toBeLessThanOrEqual(after);
    });

    it("enqueue is idempotent — duplicate txHash does not add a new entry", () => {
      enqueuePendingTx("0xaa");
      enqueuePendingTx("0xaa");
      expect(readPendingTxs()).toHaveLength(1);
    });

    it("dequeue removes the matching entry", () => {
      enqueuePendingTx("0xaa");
      enqueuePendingTx("0xbb");
      dequeuePendingTx("0xaa");
      const txs = readPendingTxs().map((t) => t.txHash);
      expect(txs).toEqual(["0xbb"]);
    });

    it("dequeue of a missing txHash is a no-op", () => {
      enqueuePendingTx("0xaa");
      dequeuePendingTx("0xnope");
      expect(readPendingTxs()).toHaveLength(1);
    });

    it("ring-buffer trims oldest at PENDING_TX_QUEUE_MAX + 1", () => {
      for (let i = 0; i < PENDING_TX_QUEUE_MAX; i++) {
        enqueuePendingTx(`0x${i.toString(16).padStart(2, "0")}`);
      }
      enqueuePendingTx("0xff");
      const txs = readPendingTxs();
      expect(txs).toHaveLength(PENDING_TX_QUEUE_MAX);
      // Oldest (0x00) was evicted; newest (0xff) is present.
      expect(txs.find((t) => t.txHash === "0x00")).toBeUndefined();
      expect(txs.find((t) => t.txHash === "0xff")).toBeDefined();
    });

    it("survives a corrupted JSON payload (returns empty)", () => {
      window.localStorage.setItem(SHIELDS_PENDING_TX_KEY, "{not-json");
      expect(readPendingTxs()).toEqual([]);
    });
  });

  // ─── B4: pending-tx TTL eviction on read ─────────────────────────

  describe("pending-tx TTL eviction", () => {
    it("entries older than PENDING_TX_TTL_MS are dropped on read", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-01T00:00:00Z"));
      enqueuePendingTx("0xold");

      // Advance past the TTL.
      vi.setSystemTime(new Date(Date.now() + PENDING_TX_TTL_MS + 1));
      enqueuePendingTx("0xfresh");

      const txs = readPendingTxs().map((t) => t.txHash);
      expect(txs).toEqual(["0xfresh"]);
    });

    it("entries within the TTL window are retained", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-01T00:00:00Z"));
      enqueuePendingTx("0xrecent");

      // Advance just under the TTL.
      vi.setSystemTime(new Date(Date.now() + PENDING_TX_TTL_MS - 1));
      const txs = readPendingTxs().map((t) => t.txHash);
      expect(txs).toEqual(["0xrecent"]);
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
