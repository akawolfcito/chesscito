/**
 * Guest identity — client-only local id for users without a wallet.
 *
 * The id seeds the same deterministic `deriveAvatarVariant` as wallets, so a
 * guest gets a stable avatar + nickname for the session. Never throws: a
 * localStorage failure falls back to an ephemeral in-memory id so render is
 * never blocked. Spec: docs/specs/identity-lite-pr1.md
 */

export const GUEST_STORAGE_KEY = "chesscito_guest_id";

/** Namespace a guest id into a derivation seed (kept distinct from wallets). */
export function guestSeed(id: string): string {
  return `guest:${id}`;
}

let ephemeralId: string | null = null;

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  // Deterministic-shape fallback; uniqueness is best-effort for the rare
  // no-crypto, no-localStorage case.
  return `g-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/**
 * Read the existing guest id or create + persist one. On any storage failure
 * returns a process-stable ephemeral id (so repeated calls in the same session
 * agree) without throwing.
 */
export function getOrCreateGuestId(): string {
  try {
    const stored = window.localStorage.getItem(GUEST_STORAGE_KEY);
    if (stored) return stored;
    const created = randomId();
    window.localStorage.setItem(GUEST_STORAGE_KEY, created);
    return created;
  } catch {
    if (!ephemeralId) ephemeralId = randomId();
    return ephemeralId;
  }
}
