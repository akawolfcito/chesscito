/**
 * Content Loop v1 — pure Next Best Action derivation for Chesscito Lite.
 *
 * Spec: docs/specs/content-loop-v1.md
 * Red-team: docs/specs/content-loop-v1-redteam.md
 *
 * Pure module: no localStorage reads, no React, no IO. Callers hydrate
 * all inputs and pass them in; deriveContentLoopAction is deterministic.
 */

import { isCompletedToday } from "@/lib/daily/progress";
import type { DailyProgress } from "@/lib/daily/progress";
import type { TrainingNode } from "@/lib/training/path";

/**
 * 10 variants in strict priority order (highest → lowest).
 * deriveContentLoopAction returns exactly ONE — the most urgent.
 */
export type ContentLoopVariant =
  | "daily-pending"       // Daily Focus not done today — highest priority
  | "claim-pending"       // Welcome Package unlocked but not claimed
  | "daily-limit-reached" // Lite: free quota exhausted, more content available (B2.3a)
  | "daily-max-reached"   // Lite: hard max reached, more content available (B2.3a)
  | "continue-path"       // Exercises with no stars yet (first visit)
  | "labyrinth-ready"     // Labyrinth unlocked and not yet completed
  | "improve-stars"       // All exercises played but some < 3★
  | "next-piece"          // Current piece fully done; another piece available
  | "come-back-tomorrow"  // Daily done, content exists, nothing urgent left
  | "view-progress";      // Fallback — navigate to /trophies; never dead screen

export type ContentLoopAction = {
  variant: ContentLoopVariant;
  /** Navigation target for the CTA. Null only for come-back-tomorrow (no nav). */
  destination: string | null;
  ctaEN: string;
  ctaES: string;
  subEN: string;
  subES: string;
};

export type ContentLoopInput = {
  /** DailyProgress hydrated from localStorage (chesscito:daily-progress). */
  daily: DailyProgress;
  /** UTC date "YYYY-MM-DD" — injected by caller for determinism/testability. */
  today: string;
  /**
   * Welcome Package state. Caller must read useWelcomePackage() (available in
   * Hub Lite via hub-daily-tile.tsx pattern) — do not create a new data source.
   */
  welcomePackage: {
    unlocked: boolean;
    claimed: boolean;
  };
  /**
   * The piece being evaluated — and the piece every path-variant CTA points at.
   * Derive it with `selectPrimaryPiece`; it is no longer pinned to the rook.
   */
  primaryPiece: string;
  /**
   * TrainingNode[] for the primary piece, built by buildTrainingPath().
   *
   * Caller MUST hydrate it in this exact order:
   *   1. Read PieceProgress from localStorage: chesscito:progress:{piece}
   *   2. Read labyrinthBests from localStorage: chesscito:labyrinth-best:{piece}
   *      (use getLabyrinthBestsMap() from lib/game/labyrinth-progress.ts)
   *   3. Call buildTrainingPath({ piece, progress, labyrinthBests, badgeClaimed })
   *
   * Omitting labyrinthBests causes all labyrinth nodes to stay "locked",
   * silently suppressing the labyrinth-ready variant.
   */
  primaryPath: TrainingNode[];
  /**
   * Next piece available after the primary piece is complete. Null when no
   * further piece is exposed in Lite or the current piece is not yet done.
   * Caller derives this from the catalog — do not hardcode.
   */
  nextAvailablePiece: string | null;
  /**
   * B2.3a: Daily session quota state (Lite-only).
   * Omit or pass null in Full mode — quota gate is never applied.
   * Caller hydrates from getDailySession() + isAtFreeLimit/isAtHardMax helpers.
   */
  sessionQuota?: {
    isAtFreeLimit: boolean;
    isAtHardMax: boolean;
  } | null;
};

// ─── Static action table ──────────────────────────────────────────────────────

const ACTIONS: Record<ContentLoopVariant, ContentLoopAction> = {
  "daily-pending": {
    variant: "daily-pending",
    destination: "/exercises?slot=daily",
    ctaEN: "Today's Focus",
    ctaES: "Enfoque de hoy",
    subEN: "Complete your daily tactic",
    subES: "Completa tu táctica diaria",
  },
  "claim-pending": {
    variant: "claim-pending",
    destination: "/trophies",
    ctaEN: "Claim your gift",
    ctaES: "Reclama tu regalo",
    subEN: "A reward is waiting for you",
    subES: "Tienes una recompensa esperando",
  },
  "daily-limit-reached": {
    variant: "daily-limit-reached",
    destination: null,
    ctaEN: "Come back tomorrow",
    ctaES: "Vuelve mañana",
    subEN: "Great focus today.",
    subES: "Gran enfoque hoy.",
  },
  "daily-max-reached": {
    variant: "daily-max-reached",
    destination: null,
    ctaEN: "Come back tomorrow",
    ctaES: "Vuelve mañana",
    subEN: "That's enough focus for today.",
    subES: "Eso es suficiente enfoque por hoy.",
  },
  "continue-path": {
    variant: "continue-path",
    destination: "/exercises?piece=rook",
    ctaEN: "Keep going",
    ctaES: "Continúa",
    subEN: "Your path is growing",
    subES: "Tu camino sigue creciendo",
  },
  "labyrinth-ready": {
    variant: "labyrinth-ready",
    destination: "/exercises?piece=rook",
    ctaEN: "Try the labyrinth",
    ctaES: "Prueba el laberinto",
    subEN: "Next challenge unlocked",
    subES: "Siguiente reto desbloqueado",
  },
  "improve-stars": {
    variant: "improve-stars",
    destination: "/exercises?piece=rook",
    ctaEN: "Improve your stars",
    ctaES: "Mejora tus estrellas",
    subEN: "Can you do better?",
    subES: "¿Puedes hacerlo mejor?",
  },
  "next-piece": {
    variant: "next-piece",
    destination: "/exercises",
    ctaEN: "Start another piece",
    ctaES: "Empieza otra pieza",
    subEN: "New moves await",
    subES: "Nuevos movimientos te esperan",
  },
  "come-back-tomorrow": {
    variant: "come-back-tomorrow",
    destination: null,
    ctaEN: "Come back tomorrow",
    ctaES: "Vuelve mañana",
    subEN: "Today's focus is done",
    subES: "El enfoque de hoy está hecho",
  },
  "view-progress": {
    variant: "view-progress",
    destination: "/trophies",
    ctaEN: "View progress",
    ctaES: "Ver progreso",
    subEN: "See what you've achieved",
    subES: "Mira lo que has logrado",
  },
};

// ─── Pure path helpers ────────────────────────────────────────────────────────

/** True when any exercise node has never been played (stars = 0, status = "available"). */
export function hasAvailableExercise(path: TrainingNode[]): boolean {
  return path.some((n) => n.kind === "exercise" && n.status === "available");
}

/**
 * True when all exercise nodes have been played (status = "complete") but at
 * least one has stars < 3 — the player can still improve their score.
 * Returns false when any exercise is still unplayed (should never reach
 * improve-stars if continue-path is still open).
 */
export function hasImprovableExercise(path: TrainingNode[]): boolean {
  const exercises = path.filter((n) => n.kind === "exercise");
  if (exercises.length === 0) return false;
  const allPlayed = exercises.every((n) => n.status === "complete");
  if (!allPlayed) return false;
  return exercises.some((n) => n.stars !== null && n.stars < 3);
}

/** True when any labyrinth node is unlocked but not yet completed.
 *  Equivalent to getNextChallenge(path) !== null. */
export function hasReadyLabyrinth(path: TrainingNode[]): boolean {
  return path.some((n) => n.kind === "labyrinth" && n.status === "available");
}

/**
 * True when every exercise node is complete AND every labyrinth node is
 * complete (none are locked or available). A piece with no labyrinths
 * satisfies the labyrinth clause vacuously.
 */
export function isPieceFullyComplete(path: TrainingNode[]): boolean {
  const exercises = path.filter((n) => n.kind === "exercise");
  const labyrinths = path.filter((n) => n.kind === "labyrinth");
  if (exercises.length === 0) return false;
  return (
    exercises.every((n) => n.status === "complete") &&
    labyrinths.every((n) => n.status === "complete")
  );
}

/** True when there is meaningful consumable content still available in the path
 *  or another piece is unlocked. Used by the daily-limit variants to avoid
 *  gating a player who has already finished everything. */
export function hasMoreContent(path: TrainingNode[], nextAvailablePiece: string | null): boolean {
  return (
    hasAvailableExercise(path) ||
    hasReadyLabyrinth(path) ||
    hasImprovableExercise(path) ||
    (isPieceFullyComplete(path) && nextAvailablePiece !== null)
  );
}

// ─── Piece selection ──────────────────────────────────────────────────────────

/** Paths keyed by piece. A piece the caller did not build reads as no content. */
export type PathsByPiece = Partial<Record<string, TrainingNode[]>>;

/**
 * A piece still holds the focus while its EXERCISES are unfinished — unplayed,
 * or played below three stars.
 *
 * Labyrinths deliberately do NOT count (founder call, 2026-07-12). The rook
 * ships three of them, so counting them would pin a player to a piece whose
 * badge they already claimed, which is exactly the loop this rule exists to
 * break. A pending labyrinth is side content: it must stay VISIBLE, but it must
 * never hold the path hostage.
 *
 * `isPieceFullyComplete` is not enough on its own: it ignores stars, so a piece
 * played end to end at one star would read as done and get skipped.
 */
function hasWorkLeft(path: TrainingNode[] | undefined): boolean {
  if (!path || path.length === 0) return false;
  return hasAvailableExercise(path) || hasImprovableExercise(path);
}

/**
 * The piece the player is actually on: the first in `order` that still has work
 * left. Falls back to the first piece in `order` when everything is finished —
 * the loop always needs a path to evaluate, and "nothing left to advance to" is
 * the honest answer there.
 *
 * This replaces `LITE_PRIMARY_PIECE` as the loop's subject. Pinning it to the
 * rook meant a player living on the pawn was still being advised about a rook
 * they had finished months ago.
 */
export function selectPrimaryPiece(
  order: readonly string[],
  paths: PathsByPiece,
): string {
  return order.find((piece) => hasWorkLeft(paths[piece])) ?? order[0];
}

/**
 * The piece to move on to once the primary is done: the next one in `order`,
 * other than the primary, that still has work left.
 *
 * Null when there is nothing left — the loop must never invent a destination.
 * This used to be hardcoded `null` in `use-hub-data`, which made the entire
 * `next-piece` variant unreachable.
 */
export function selectNextAvailablePiece(
  order: readonly string[],
  paths: PathsByPiece,
  primaryPiece: string,
): string | null {
  return (
    order.find((piece) => piece !== primaryPiece && hasWorkLeft(paths[piece])) ??
    null
  );
}

// ─── Main derivation ──────────────────────────────────────────────────────────

/**
 * Derives the single Next Best Action for the user.
 *
 * Evaluation is strictly sequential — the first matching variant wins.
 * Same inputs always produce the same output (pure, deterministic).
 */
export function deriveContentLoopAction(input: ContentLoopInput): ContentLoopAction {
  const { daily, today, welcomePackage, primaryPiece, primaryPath, nextAvailablePiece, sessionQuota } = input;

  /** The three path variants ship `?piece=rook` in the static table — a Lite-v1
   *  hardcode. Reasoning about one piece and then walking the player to another
   *  is how a finished rook kept getting recommended forever. */
  const toPrimary = (action: ContentLoopAction): ContentLoopAction => ({
    ...action,
    destination: `/exercises?piece=${primaryPiece}`,
  });

  // 1. Daily Focus not yet done today — highest priority regardless of anything else.
  if (!isCompletedToday(today, daily)) {
    return ACTIONS["daily-pending"];
  }

  // 2. Welcome Package unlocked but not yet claimed.
  if (welcomePackage.unlocked && !welcomePackage.claimed) {
    return ACTIONS["claim-pending"];
  }

  // 3–4. B2.3a daily quota gate (Lite-only; sessionQuota === null in Full mode).
  //      Only fires when there IS more consumable content — never gate a finished path.
  if (sessionQuota && hasMoreContent(primaryPath, nextAvailablePiece)) {
    if (sessionQuota.isAtHardMax) {
      return ACTIONS["daily-max-reached"];
    }
    if (sessionQuota.isAtFreeLimit) {
      return ACTIONS["daily-limit-reached"];
    }
  }

  // 5. Exercises waiting to be played (stars = 0).
  if (hasAvailableExercise(primaryPath)) {
    return toPrimary(ACTIONS["continue-path"]);
  }

  // 6. Labyrinth unlocked and pending.
  if (hasReadyLabyrinth(primaryPath)) {
    return toPrimary(ACTIONS["labyrinth-ready"]);
  }

  // 7. All exercises played but improvement possible (stars < 3★).
  if (hasImprovableExercise(primaryPath)) {
    return toPrimary(ACTIONS["improve-stars"]);
  }

  // 8. Piece fully done and another piece is available.
  if (isPieceFullyComplete(primaryPath) && nextAvailablePiece !== null) {
    return {
      ...ACTIONS["next-piece"],
      destination: `/exercises?piece=${nextAvailablePiece}`,
    };
  }

  // 9. Daily done, content exists, nothing urgent left — come back tomorrow.
  //    Only fires when the path has exercise nodes (meaningful content exists).
  if (primaryPath.some((n) => n.kind === "exercise")) {
    return ACTIONS["come-back-tomorrow"];
  }

  // 10. view-progress: ultimate fallback (empty path / catalog not yet loaded).
  //     Never a dead screen — destination /trophies always available.
  return ACTIONS["view-progress"];
}
