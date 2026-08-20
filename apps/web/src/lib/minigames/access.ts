/**
 * Mini-games access policy — THE MONETIZATION SEAM.
 *
 * Today this answers `allowed` unconditionally. It exists anyway, and every
 * caller must go through it, because the alternative is what the previous spec
 * proposed and this one rejects: `if (peones >= 5)` scattered across a card, a
 * deep link and a request boundary. Three copies of an access rule drift on the
 * first change, and the symptom is a card that offers a game the router then
 * refuses.
 *
 * ⛔ WHAT THIS MUST NOT GROW INTO YET
 * No wallet read. No ledger read. No balance. No Date. No countdown. No
 * `expiresAt`. Early Access has no announced end, so anything that computes one
 * would be inventing a promise the product has not made.
 *
 * WHERE A FUTURE POLICY PLUGS IN
 * The signature is `(rotation, player)` on purpose — the candidate models are
 * all rotation-scoped or period-scoped ("5 Peones per rotation", "5 Peones for
 * 7 days"), never per-game-forever. A future policy replaces the body of
 * `resolveMiniGamesAccess` and widens `MiniGamesPlayer`; no caller changes, and
 * the `allowed:false` branch already exists in the type so every consumer is
 * forced by the compiler to handle a denial the day one becomes possible.
 */

import type { MiniGameRotation } from "@/lib/minigames/rotation";

/** The only policy that exists today. Stable string: it ships on telemetry. */
export const EARLY_ACCESS_POLICY = "early_access_free" as const;

/**
 * What a future policy would be allowed to read about the player.
 *
 * Deliberately EMPTY in Early Access. An empty object is not an oversight — it
 * is the compile-time proof that no caller is passing a balance, a wallet or an
 * entitlement into an access decision that does not have one.
 */
export type MiniGamesPlayer = Record<string, never>;

export type MiniGamesAccess =
  | { allowed: true; policy: typeof EARLY_ACCESS_POLICY }
  | { allowed: false; policy: string; reason: string };

/**
 * Whether this player may play this rotation's featured challenges.
 *
 * Early Access: always yes, free, for everyone. This includes players who have
 * never touched the corresponding piece — see the EARLY ACCESS LOCAL GATE
 * decision in docs/specs/2026-08-19-learn-ia-minigames-early-access-implementation.md.
 */
export function resolveMiniGamesAccess(
  _rotation: MiniGameRotation,
  _player: MiniGamesPlayer,
): MiniGamesAccess {
  return { allowed: true, policy: EARLY_ACCESS_POLICY };
}
