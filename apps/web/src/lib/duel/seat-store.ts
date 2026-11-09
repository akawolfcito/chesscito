/**
 * Where the player's seat credential lives on the device.
 *
 * ⛔ `localStorage`, and the cookie is the BACKUP — not the other way round.
 * The spec calls this the primary path and it was measured: opening the link in
 * WhatsApp's in-app browser and then "open in Chrome" is a different browser
 * context, and in `learn` mode the middleware bounces `/arena` cross-domain.
 * The cookie survives neither. Without this store the player watches their own
 * game without being able to move.
 *
 * ⚠️ Keyed PER DUEL. One key would mean opening a second duel silently evicts
 * the credential of the first — and the eviction is invisible until the player
 * goes back to the first game and finds themselves a spectator in it.
 *
 * ⚠️ Every function swallows its errors. Safari in private mode throws on
 * `setItem`, and a storage quota is not a reason to fail a chess move: the
 * token is also in the response and in a cookie.
 */

const PREFIX = "chesscito:duel:";

function keyFor(duelId: string): string {
  return `${PREFIX}${duelId}:seat`;
}

export function readStoredSeatToken(duelId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(keyFor(duelId));
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function storeSeatToken(duelId: string, token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(duelId), token);
  } catch {
    // Private mode / quota. The cookie is still set and the token is still in
    // memory for this page view.
  }
}

export function forgetSeatToken(duelId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(keyFor(duelId));
  } catch {
    // Nothing to do, and nothing worth failing a render over.
  }
}
