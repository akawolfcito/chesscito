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
  /** Pre-v2 single-number shield count read from
   *  `chesscito:shields` exactly once. */
  legacy: number;
};

/** Derived display count clamped to [0, MAX_SHIELDS]. */
export function readDisplayedShields(): number {
  throw new Error("not implemented");
}

export function readCreditedCache(): number {
  throw new Error("not implemented");
}

export function writeCreditedCache(_n: number): void {
  throw new Error("not implemented");
}

export function readConsumedCount(): number {
  throw new Error("not implemented");
}

/** Bump the local consumed counter by one. Never touches `credited`.
 *  Dispatches `shield-events` so footer chip + retry button refresh. */
export function consumeOneShield(): void {
  throw new Error("not implemented");
}

/** Idempotent push (no duplicates by txHash). Trims to
 *  PENDING_TX_QUEUE_MAX, oldest first. */
export function enqueuePendingTx(_txHash: `0x${string}`): void {
  throw new Error("not implemented");
}

export function dequeuePendingTx(_txHash: `0x${string}`): void {
  throw new Error("not implemented");
}

/** TTL-prunes entries older than PENDING_TX_TTL_MS on read. */
export function readPendingTxs(): PendingShieldTx[] {
  throw new Error("not implemented");
}

/** One-shot migration helper. Returns `{ legacy }` if a legacy
 *  number exists *and* no `consumed` key has been initialized yet.
 *  Subsequent calls return null. Caller is responsible for the
 *  atomic clear (only delete legacy after consumed + credited-cache
 *  writes succeed). */
export function consumeLegacyShieldsForMigration(): LegacyMigrationPayload | null {
  throw new Error("not implemented");
}

void dispatchShieldChange;
