/**
 * Mini-Arena setups — limited-piece chess positions used as the
 * pedagogical bridge between Play Hub exercises (single piece, no
 * opponent) and Arena (full chess vs AI).
 *
 * Each setup is a standard 8×8 board (chess.js compatible) but with
 * a small piece roster so the player exercises a single concept at
 * a time: K+R vs K mate, K+Q vs K, etc. The opponent is driven by
 * js-chess-engine at level 0 — random legal moves — so the focus is
 * on the player's plan, not on out-thinking an engine.
 */

export type MiniArenaSetup = {
  id: string;
  name: string;
  /** Short pedagogical description shown in the entry card. */
  description: string;
  /** Starting FEN — white to move, simplified to 1-2 piece roster. */
  fen: string;
  /** Soft turn budget — completing the mate within this many half-moves
   *  earns a "fluid" star; over budget is still a win, just slower. */
  parMoves: number;
  /** Level passed to js-chess-engine. 0 keeps it gentle (random legal
   *  moves) so the player isn't fighting an engine while learning the
   *  endgame technique. */
  aiLevel: 0 | 1;
};

/** Curated set of bridge setups. The first one (K+R vs K) is the
 *  natural follow-up to mastering the rook in Play Hub. */
export const MINI_ARENA_SETUPS: MiniArenaSetup[] = [
  {
    id: "kr-vs-k",
    name: "K+R vs K",
    description:
      "El final clásico que aparece después de dominar la torre. Lleva el rey enemigo al borde y dale mate.",
    fen: "4k3/8/8/8/8/8/8/R3K3 w - - 0 1",
    parMoves: 16,
    aiLevel: 0,
  },
];

export function getSetupById(id: string): MiniArenaSetup | null {
  return MINI_ARENA_SETUPS.find((s) => s.id === id) ?? null;
}
