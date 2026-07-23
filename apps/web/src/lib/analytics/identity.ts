/**
 * Analytics identity primitives.
 *
 * Two distinct notions, resolved by the observability audit
 * (docs/audits/2026-07-23-product-observability-audit.md):
 *
 *  - anonymousId — PERSISTENT, per-install identity. Lives in localStorage,
 *    never rotates. Powers retention / cohorts (D1/D7/D30) and unique-user
 *    counts. This is the SAME value historically written as `session_id`,
 *    so existing rows stay comparable (no migration, no rename).
 *  - visitId — per-VISIT identity. Lives in sessionStorage, so it is fresh
 *    for each tab / visit and dies when the tab closes. Powers app_opened
 *    (once-per-visit) and per-visit funnels.
 *
 * All accessors are SSR-safe (return "" on the server) and swallow storage
 * errors (private mode / disabled storage) so analytics never throws into a
 * user-visible flow.
 */

/** Unchanged from the original telemetry module — renaming would force a
 *  migration and break comparability with historical rows. */
const ANONYMOUS_ID_KEY = "chesscito:analytics-session";
const VISIT_ID_KEY = "chesscito:visit-id";
const APP_OPENED_KEY = "chesscito:app-opened-fired";

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Persistent anonymous install id. Empty string on the server or when
 *  storage is unavailable. */
export function getAnonymousId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(ANONYMOUS_ID_KEY);
    if (existing) return existing;
    const id = randomHex(8); // ~64 bits — fits well under the 64-char column
    window.localStorage.setItem(ANONYMOUS_ID_KEY, id);
    return id;
  } catch {
    return "";
  }
}

/** Per-visit id (sessionStorage). Fresh for each tab / visit. Empty string on
 *  the server or when storage is unavailable. */
export function getVisitId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.sessionStorage.getItem(VISIT_ID_KEY);
    if (existing) return existing;
    const id = randomHex(8);
    window.sessionStorage.setItem(VISIT_ID_KEY, id);
    return id;
  } catch {
    return "";
  }
}

/**
 * Returns `true` exactly once per visit (per tab session): the first call in a
 * visit flips a sessionStorage guard and returns `true`; every later call in
 * the same visit returns `false`. This survives React StrictMode double-invoke,
 * remounts, and client navigation. On the server or when storage is
 * unavailable it returns `false` (never emits) so `app_opened` can neither fire
 * from SSR nor leak duplicates.
 */
export function claimAppOpenedForVisit(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(APP_OPENED_KEY)) return false;
    window.sessionStorage.setItem(APP_OPENED_KEY, "1");
    return true;
  } catch {
    return false;
  }
}
