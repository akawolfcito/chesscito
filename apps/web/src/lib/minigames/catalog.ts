/**
 * Mini-game ENGINE registry + the canonical challenge lookup.
 *
 * An ENGINE is a game (Rook Rail, Pivot Run, N-Queens, Safe Path…). A
 * CHALLENGE is one of its levels. The distinction is load-bearing: rotation is
 * per CHALLENGE (13 units), telemetry `game_id` is per ENGINE (6 units), and
 * conflating them would either give us 4 rotatable things or an unreadable
 * funnel.
 *
 * ⛔ THE ONE RULE: a challenge is only real if it survives
 * `projectSpecialTrainingLane`. That projection is what swapped each piece's
 * raw labyrinths for its signature game, and the ids it drops (`bishop-lab-3`,
 * `knight-lab-1`, …) are RETIRED — still in `content/labyrinths.json`, never
 * playable again. Reading the raw pools instead would resurrect them into
 * rotation and into deep links. Reading the projection rejects them for free,
 * with no second list to keep in sync.
 *
 * Everything here is PURE: no React, no IO, no Date, no storage. Pools are
 * injected so the surface can read the merged catalog and tests can read the
 * baseline.
 */

import type { Exercise, PieceId } from "@/lib/game/types";
import type { CatalogPoolKey } from "@/lib/content/merged-catalog";
import { projectSpecialTrainingLane } from "@/lib/training/special-training-lane";
import { baselineMiniGamePools, type MiniGamePools } from "@/lib/minigames/pools";

export type MiniGameEngineId =
  | "rook-rail"
  | "pivot-run"
  | "knight-tour"
  | "n-queens"
  | "safe-path"
  | "promotion-run";

/**
 * `early-access` ships in the launch set and may be featured.
 * `coming-soon` is inert: no rotation, no card interaction, no price — and,
 * because Early Access is free, no price is what it would have been anyway.
 * The status is a PRODUCT verdict backed by production evidence, recorded per
 * engine below.
 */
export type MiniGameStatus = "early-access" | "coming-soon";

export type MiniGameEngine = {
  /** Stable across content edits. Telemetry `game_id` and the i18n key. */
  id: MiniGameEngineId;
  piece: PieceId;
  /** The pool the projection is expected to draw this engine's lane from.
   *  Declared rather than derived so a test can catch a projection change:
   *  add a signature pool for the rook and `engineChallenges("rook-rail")`
   *  silently becomes a different game while every id-based test still passes. */
  pool: CatalogPoolKey;
  status: MiniGameStatus;
};

/**
 * One engine per playable piece. The order is the order the surface offers
 * them in when it has no rotation to follow.
 *
 * Status verdicts (production, window 2026-05-03 → 2026-08-19, accounts that
 * completed each level; see docs/specs/2026-08-19-learn-minigames-peones-economy.md §2):
 *   rook-rail      547 → 339 → 181 → 135   gentlest decay in the catalog
 *   pivot-run       69 →  68 →  64         flattest retention
 *   n-queens        17 →  17 →  17         zero internal decay
 *   safe-path       13 →  14 →  13         flat
 *   knight-tour     34 →   1 →   2         97% cliff with the gate OPEN, and
 *                                          `starless` — a completed card would
 *                                          have no score to show
 *   promotion-run   13 →   6 →   1         and its own source says
 *                                          `optimalMoves` grades nothing
 */
export const MINIGAME_ENGINES: readonly MiniGameEngine[] = [
  { id: "rook-rail", piece: "rook", pool: "labyrinths", status: "early-access" },
  { id: "pivot-run", piece: "bishop", pool: "diagonalRun", status: "early-access" },
  { id: "n-queens", piece: "queen", pool: "queens", status: "early-access" },
  { id: "safe-path", piece: "king", pool: "safePath", status: "early-access" },
  { id: "knight-tour", piece: "knight", pool: "knightTour", status: "coming-soon" },
  { id: "promotion-run", piece: "pawn", pool: "promotionRun", status: "coming-soon" },
] as const;

const ENGINE_BY_ID = new Map<MiniGameEngineId, MiniGameEngine>(
  MINIGAME_ENGINES.map((engine) => [engine.id, engine]),
);

const ENGINE_BY_PIECE = new Map<PieceId, MiniGameEngine>(
  MINIGAME_ENGINES.map((engine) => [engine.piece, engine]),
);

export function getEngine(id: MiniGameEngineId): MiniGameEngine {
  const engine = ENGINE_BY_ID.get(id);
  // Unreachable through the typed union; a throw beats returning a shape that
  // would render an empty card.
  if (!engine) throw new Error(`unknown mini-game engine: ${id}`);
  return engine;
}

/** The engines that may be featured. */
export function earlyAccessEngines(): MiniGameEngine[] {
  return MINIGAME_ENGINES.filter((engine) => engine.status === "early-access");
}

/** The projected Special Training lane, per piece. One call, reused by every
 *  lookup below so the surface and the drawer can never disagree about what a
 *  piece's lane contains. */
function projectLanes(pools: MiniGamePools) {
  return projectSpecialTrainingLane(pools.labyrinths, {
    diagonalRun: pools.diagonalRun,
    knightTour: pools.knightTour,
    queens: pools.queens,
    safePath: pools.safePath,
    promotionRun: pools.promotionRun,
  });
}

/** This engine's challenges, in authored order. Empty when the piece's lane is
 *  empty — never throws, so a catalog edit degrades to "no card", not a crash. */
export function engineChallenges(
  pools: MiniGamePools,
  id: MiniGameEngineId,
): readonly Exercise[] {
  return projectLanes(pools)[getEngine(id).piece] ?? [];
}

export type ResolvedChallenge = {
  challenge: Exercise;
  engine: MiniGameEngine;
  piece: PieceId;
};

/**
 * The canonical id → challenge lookup, across every lane.
 *
 * This is the single function that decides whether a mini-game id is real. It
 * backs rotation validation AND the `?content=` deep link, so a rule proven in
 * one is true in the other by construction — which is the defect the previous
 * deep link had (`pieceForContent` searched the Knight's Tour pool alone and
 * silently dropped every other lane's id at the route boundary).
 *
 * Returns null for: unknown ids, lane-1 exercise ids, and RETIRED ids.
 */
export function resolveChallenge(
  pools: MiniGamePools,
  challengeId: string,
): ResolvedChallenge | null {
  const lanes = projectLanes(pools);
  for (const engine of MINIGAME_ENGINES) {
    const challenge = (lanes[engine.piece] ?? []).find(
      (entry) => entry.id === challengeId,
    );
    if (challenge) return { challenge, engine, piece: engine.piece };
  }
  return null;
}

/** True only for a real challenge whose engine is in the launch set. */
export function isEarlyAccessChallenge(
  pools: MiniGamePools,
  challengeId: string,
): boolean {
  return resolveChallenge(pools, challengeId)?.engine.status === "early-access";
}

/** The engine that owns a piece's lane, or null for a piece with no engine.
 *  Every playable piece has one today; the null branch keeps a future
 *  piece-without-a-game from throwing on a surface that only wants to skip it. */
export function engineForPiece(piece: PieceId): MiniGameEngine | null {
  return ENGINE_BY_PIECE.get(piece) ?? null;
}

/** Convenience default for callers with no injected catalog (tests, client
 *  components outside the content provider). */
export function defaultMiniGamePools(): MiniGamePools {
  return baselineMiniGamePools();
}
