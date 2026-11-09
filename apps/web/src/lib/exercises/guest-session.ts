/**
 * Guest rotation session seed (Rotation Engine, 2026-06-09).
 *
 * Completes the approved guest model: canonical 5 first touch → (wallet
 * prompt, follow-up) → session_uuid fallback. A recurring guest gets a
 * stable per-device id so daily rotation behaves like a wallet seed.
 *
 * Storage: localStorage `chesscito:guest-session-id` — same persistence
 * as the guest's progress (`chesscito:progress:*`), so the seed and the
 * progress it rotates over stay coherent across tabs/days (sessionStorage
 * would drift per tab while progress persists).
 *
 * Scope: no UI, no wallet prompt, no Peones/Coach/ledger/payment/badge.
 */

const GUEST_SESSION_KEY = "chesscito:guest-session-id";

/** First-touch canonical exercises a guest must complete (≥1★ each)
 *  before graduating from the canonical set to session rotation. */
const CANONICAL_GRADUATION_COUNT = 5;

function generateId(): string {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to the opaque fallback */
  }
  // Opaque fallback for old webviews without crypto.randomUUID. Not
  // security-sensitive — just a stable, unique-enough rotation seed.
  return `guest-${Date.now().toString(36)}-${Math.floor(
    Math.random() * 1e9,
  ).toString(36)}`;
}

/**
 * Returns the persistent guest session id, creating + storing it on first
 * call. Client-only and localStorage-safe: returns `null` on the server
 * or when localStorage is unavailable (private mode) — callers then fall
 * back to the canonical set (no rotation seed, never a crash).
 */
export function getOrCreateGuestSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(GUEST_SESSION_KEY);
    if (existing) return existing;
    const id = generateId();
    window.localStorage.setItem(GUEST_SESSION_KEY, id);
    return id;
  } catch {
    return null;
  }
}

/**
 * A guest "graduates" from the canonical 5 to session rotation once the
 * first 5 exercises of the piece each have ≥1★ (they've been through the
 * curated first-touch set). Pure + per-piece; derives from progress, no
 * new persisted state.
 */
export function isGuestGraduated(starsArray: readonly number[]): boolean {
  if (starsArray.length < CANONICAL_GRADUATION_COUNT) return false;
  for (let i = 0; i < CANONICAL_GRADUATION_COUNT; i += 1) {
    if (!(starsArray[i] > 0)) return false;
  }
  return true;
}
