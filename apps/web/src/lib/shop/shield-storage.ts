/** Client-side storage for retry-shield state. v2 model splits the
 *  legacy single-number `chesscito:shields` into two monotonic
 *  counters: server-tracked `credited-cache` (mirror of Redis) and
 *  local-tracked `consumed`. The displayed available count is derived
 *  via `min(MAX_SHIELDS, max(0, credited - consumed))`.
 *
 *  Why split: previously a server-cap-vs-local-spend race could lose
 *  credits silently. With monotonic counters there is no race surface.
 *  Spec: 2026-05-08-credit-shield-server-side-design.md §"Counter model".
 */

import { dispatchShieldChange } from "@/lib/shop/shield-events";

export const SHIELDS_LEGACY_KEY = "chesscito:shields";
export const SHIELDS_CONSUMED_KEY = "chesscito:shields:consumed";
export const SHIELDS_CREDITED_CACHE_KEY = "chesscito:shields:credited-cache";
export const SHIELDS_PENDING_TX_KEY = "chesscito:shields:pending-tx";

export const MAX_SHIELDS = 30;
export const PENDING_TX_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const PENDING_TX_QUEUE_MAX = 32;

export type PendingShieldTx = {
  txHash: `0x${string}`;
  queuedAt: number;
};

export type LegacyMigrationPayload = {
  legacy: number;
};

function safeReadInt(key: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return 0;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  } catch {
    return 0;
  }
}

function safeWriteInt(key: string, value: number): void {
  if (typeof window === "undefined") return;
  const clamped = Math.max(0, Math.floor(value));
  try {
    window.localStorage.setItem(key, String(clamped));
  } catch {
    // storage unavailable; the next read returns 0 and boot-sync
    // re-hydrates from the server.
  }
}

export function readDisplayedShields(): number {
  const credited = readCreditedCache();
  const consumed = readConsumedCount();
  return Math.min(MAX_SHIELDS, Math.max(0, credited - consumed));
}

export function readCreditedCache(): number {
  return safeReadInt(SHIELDS_CREDITED_CACHE_KEY);
}

export function writeCreditedCache(n: number): void {
  safeWriteInt(SHIELDS_CREDITED_CACHE_KEY, n);
}

export function readConsumedCount(): number {
  return safeReadInt(SHIELDS_CONSUMED_KEY);
}

export function consumeOneShield(): void {
  const next = readConsumedCount() + 1;
  safeWriteInt(SHIELDS_CONSUMED_KEY, next);
  dispatchShieldChange();
}

function readQueueRaw(): PendingShieldTx[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SHIELDS_PENDING_TX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is PendingShieldTx =>
        entry != null &&
        typeof entry === "object" &&
        typeof entry.txHash === "string" &&
        entry.txHash.startsWith("0x") &&
        typeof entry.queuedAt === "number" &&
        Number.isFinite(entry.queuedAt),
    );
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingShieldTx[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SHIELDS_PENDING_TX_KEY,
      JSON.stringify(queue),
    );
  } catch {
    // ignore — queue rebuilt on next enqueue
  }
}

export function enqueuePendingTx(txHash: `0x${string}`): void {
  const queue = readQueueRaw();
  if (queue.some((entry) => entry.txHash === txHash)) return;
  queue.push({ txHash, queuedAt: Date.now() });
  while (queue.length > PENDING_TX_QUEUE_MAX) queue.shift();
  writeQueue(queue);
}

export function dequeuePendingTx(txHash: `0x${string}`): void {
  const queue = readQueueRaw();
  const next = queue.filter((entry) => entry.txHash !== txHash);
  if (next.length === queue.length) return;
  writeQueue(next);
}

export function readPendingTxs(): PendingShieldTx[] {
  const now = Date.now();
  const queue = readQueueRaw();
  const fresh = queue.filter(
    (entry) => now - entry.queuedAt < PENDING_TX_TTL_MS,
  );
  // Persist the pruned queue so subsequent reads are fast and the TTL
  // truly evicts (not just hides) stale entries.
  if (fresh.length !== queue.length) writeQueue(fresh);
  return fresh;
}

export function consumeLegacyShieldsForMigration(): LegacyMigrationPayload | null {
  if (typeof window === "undefined") return null;
  try {
    // Already migrated? consumed key is the migration sentinel.
    if (window.localStorage.getItem(SHIELDS_CONSUMED_KEY) != null) return null;
    const raw = window.localStorage.getItem(SHIELDS_LEGACY_KEY);
    if (raw == null) return null;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return null;
    return { legacy: n };
  } catch {
    return null;
  }
}
