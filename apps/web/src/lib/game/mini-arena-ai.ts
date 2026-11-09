import type { Chess } from "chess.js";
import { aiMove } from "js-chess-engine";

import type { MiniArenaSetup } from "./mini-arena";

export type MoveSuggestion = { from: string; to: string };

/**
 * Suggests an AI move for a Mini-Arena setup. Wraps `js-chess-engine`
 * and falls back to a uniformly-random legal move (enumerated by
 * chess.js) whenever the engine misbehaves.
 *
 * Why the fallback exists: chess.js v1+ throws on illegal moves. The
 * legacy `triggerAi` in `mini-arena-sheet.tsx` wrapped the engine call
 * in a silent `try/catch` and reset `status="playing"` on failure —
 * but the player's prior move had already flipped chess.js's internal
 * turn to black. After the catch, the UI claimed it was the player's
 * turn while chess.js still thought it was black's. The player could
 * select a white piece, get zero legal targets back from
 * `game.moves({ square })`, and the board appeared to freeze.
 *
 * This function makes the freeze impossible by construction:
 *
 * - Empty engine result → fallback random legal move.
 * - Engine throws → fallback random legal move.
 * - Engine suggests an illegal move → fallback random legal move.
 * - No legal moves at all → returns `null`; caller should resolve
 *   the game (mate or stalemate) via `endIfTerminal()`.
 *
 * Spec: `docs/superpowers/plans/2026-05-02-product-stabilization-sprint.md`
 * Commit 4. Triage P0-2.
 *
 * @param random - Injected for deterministic tests; defaults to
 * `Math.random`. Must return a value in `[0, 1)`.
 */
export function pickAiMoveOrFallback(
  game: Chess,
  aiLevel: MiniArenaSetup["aiLevel"],
  random: () => number = Math.random,
): MoveSuggestion | null {
  if (game.isGameOver()) return null;

  const legal = game.moves({ verbose: true });
  if (legal.length === 0) return null;

  // First, try js-chess-engine. Verify its suggestion is in the legal
  // set before committing — a verified-legal suggestion never throws
  // when passed to chess.js's `game.move()`.
  try {
    const result = aiMove(game.fen(), aiLevel) as Record<string, string>;
    const entries = Object.entries(result);
    if (entries.length > 0) {
      const [fromUpper, toUpper] = entries[0];
      const from = fromUpper.toLowerCase();
      const to = toUpper.toLowerCase();
      const isLegal = legal.some((m) => m.from === from && m.to === to);
      if (isLegal) return { from, to };
    }
  } catch {
    // Engine failure is expected on some endgames (e.g. K+R vs K with
    // random level). Fall through to the chess.js fallback below.
  }

  // Fallback: uniform-random legal move from chess.js's enumeration.
  // chess.js's move list is the ground truth — it will never include
  // an illegal move.
  const pick = legal[Math.floor(random() * legal.length)];
  return { from: pick.from, to: pick.to };
}
