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

export const SHIELDS_LEGACY_KEY = "chesscito:shields";
export const SHIELDS_CONSUMED_KEY = "chesscito:shields:consumed";
export const SHIELDS_CREDITED_CACHE_KEY = "chesscito:shields:credited-cache";

/** Max ACTIVE (displayed/usable) shields. MiniPay Lote 3 B4 (2026-07-08):
 *  30 → 3. The displayed count is `min(MAX_SHIELDS, credited - consumed)`, so
 *  every source (Welcome Pack, Season Pass bonus, rescue) is capped here — no
 *  source can leave the user showing more than 3. NOTE: `credited` is a
 *  monotonic server counter and `consumed` is client-local, so two sources
 *  can push `credited - consumed` above 3; the excess is buffered (drains as
 *  the user consumes) rather than a hard reject. See risk note in the Lote 3
 *  deliverable. */
export const MAX_SHIELDS = 3;

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
