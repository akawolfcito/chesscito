import type { PieceId } from "@/lib/game/types";
import {
  isTargetlessKind,
  isThreatKind,
  type PuzzleKind,
} from "@/lib/game/fen-puzzle";

/**
 * What each game lets an author paint — ONE table, read by the UI, never
 * duplicated into component state.
 *
 * Only the facts that are NOT already derivable live here. A field that merely
 * restates a predicate would be a second source of truth for the same fact, and
 * two encodings of one truth drift apart (feedback_same_shape_number_wrong_meaning).
 * So ask the helpers, not the table, for:
 *   - needs a goal square   → !isTargetlessKind(kind)
 *   - shows the threat map   → isThreatKind(kind)
 *   - needs a promoteTo      → kind === "promotion-run"
 */
export type KindCapability = {
  /** Typed black pieces the enemy brush may paint; `[]` = no enemy brush. The
   *  threat kinds get the five non-king pieces (a black king as a threat is not
   *  modelled yet — see the open question in the spec). */
  enemyPieces: readonly PieceId[];
  /** `false` → the record is LISTED with its game's name but does not open, and
   *  the UI says why. Safe Path stays here until its own stage: loading it today
   *  drops the very threats that ARE the level, so the builder must not offer it. */
  editable: boolean;
};

/** The five pieces a threat kind may place as black. No king: a black king as a
 *  static threat is not something the attack map computes yet. */
const NON_KING_ENEMIES: readonly PieceId[] = ["queen", "rook", "bishop", "knight", "pawn"];

export const KIND_CAPABILITY: Record<PuzzleKind, KindCapability> = {
  exercise: { enemyPieces: [], editable: true },
  labyrinth: { enemyPieces: [], editable: true },
  "diagonal-run": { enemyPieces: [], editable: true },
  "knight-tour": { enemyPieces: [], editable: true },
  queens: { enemyPieces: [], editable: true },
  // Its enemies are BOTH victims to eat and eyes to avoid; typed from etapa 1.
  "promotion-run": { enemyPieces: NON_KING_ENEMIES, editable: true },
  // ⛔ editable:false until the Safe Path stage (spec §Etapas 7). Loading it now
  //    drops its typed threats on the floor — the knight that IS the game. Flip
  //    this to true only when the typed enemy brush lands.
  "safe-path": { enemyPieces: NON_KING_ENEMIES, editable: false },
};

/** Whether the builder will open a record of this kind for editing. */
export function isKindEditable(kind: PuzzleKind): boolean {
  return KIND_CAPABILITY[kind].editable;
}

/** Human label for a kind, for the record list and the "cannot edit yet" note. */
const KIND_LABEL: Record<PuzzleKind, string> = {
  exercise: "Exercise",
  labyrinth: "Labyrinth",
  "diagonal-run": "Diagonal Run",
  "knight-tour": "Knight's Tour",
  queens: "N-Queens",
  "safe-path": "Safe Path",
  "promotion-run": "Promotion Run",
};

export function kindLabel(kind: PuzzleKind): string {
  return KIND_LABEL[kind];
}

// Re-exported so callers read one module for authoring capability, deriving the
// predicates rather than duplicating them as table columns.
export { isTargetlessKind, isThreatKind };
