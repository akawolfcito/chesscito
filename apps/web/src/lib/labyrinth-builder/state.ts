import type { ExerciseTier, PieceId } from "@/lib/game/types";
import {
  parseFenBoard,
  squareToPos,
  isTargetlessKind,
  type PuzzleInput,
  type PuzzleKind,
} from "@/lib/game/fen-puzzle";
import type { LabyrinthRecord } from "@/lib/content/catalog";

/**
 * An enemy in AUTHOR coordinates: a square plus WHICH piece stands there.
 *
 * ⚠️ This replaces the old `captures: string[]`, which carried squares and threw
 * the type away. `buildFenBlock` then re-emitted every one of them as a black
 * PAWN, so a load→save turned the black ROOK of `pawn-promotion-1` ("No Way
 * Around", whose whole lesson is that the enemy on the diagonal is the only
 * door) into a pawn — silently, with no error anywhere. The board draws what the
 * FEN says, so the level stopped teaching what it claims to teach.
 *
 * `TypedEnemy` (lib/game/types) is the same fact in BoardPosition coordinates;
 * the builder speaks algebraic, so it keeps its own shape and converts on the
 * way down.
 */
export type AuthoredEnemy = { square: string; piece: PieceId };

export type BuilderState = {
  /** WHICH GAME this draft is — first-class from the day the field exists, never
   *  optional and never derived from the bucket. The validator reads it to speak
   *  the same verdict Save will (AC-5); the day it drives an authoring UI (goal
   *  optional, typed enemies) is additive, not a refactor. */
  kind: PuzzleKind;
  piece: PieceId;
  start: string | null;
  /** `null` is a LEGAL final state when isTargetlessKind(kind); elsewhere it is
   *  an incomplete draft. buildFenBlock and the validator both branch on kind. */
  goal: string | null;
  walls: string[];
  /** Black pieces on the board. Typed (see AuthoredEnemy). Whether they are
   *  capture targets (pawn) or static threats (safe-path) is decided downstream
   *  by kind — the type survives the round-trip either way. */
  enemies: AuthoredEnemy[];
  /** `promotion-run` only: the piece the level asks the pawn to crown. Required
   *  there (the catalog rejects the record without it), absent elsewhere. */
  promoteTo?: PieceId;
  order: number;
  explanation?: string;
  /** Difficulty tier — drives the rotation engine's gating. Defaults to
   *  "medium" downstream when unset. Author-editable for exercises. */
  tier?: ExerciseTier;
  /** Freeform authoring tags (e.g. "straight-line"). Persisted verbatim. */
  tags?: string[];
  id?: string;
};

export function emptyState(piece: PieceId = "rook", kind: PuzzleKind = "labyrinth"): BuilderState {
  return { kind, piece, start: null, goal: null, walls: [], enemies: [], order: 0 };
}

/** The record fields the builder UI owns and re-derives on every save. Anything
 *  NOT listed here is data the UI cannot draw, and `extraFields` carries it
 *  through verbatim so an edit never drops it.
 *
 *  ⚠️ `kind` must stay OUT of this set. It was in it, and that is why saving a
 *  signature game re-wrote it as a plain labyrinth: the UI cannot express the
 *  kind, so claiming ownership of it meant silently discarding it.
 *  `bucket` IS listed — it is a read-time tag, not part of the record. */
const UI_OWNED_FIELDS = new Set([
  "id",
  "bucket",
  "piece",
  "fen",
  "target",
  "mover",
  "order",
  "explanation",
  "tier",
  "tags",
]);

/** Everything on a record the builder UI cannot express (pedagogy, `kind`,
 *  `promoteTo`, `disabled`, …), so a read-modify-write round-trips it instead of
 *  dropping it. Lives here, not in the page, so the invariant is testable —
 *  the same reason `deriveStateFromFen` moved out (etapa 1). */
export function extraFields(rec: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (!UI_OWNED_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

const FEN_LETTER: Record<PieceId, string> = {
  rook: "R", knight: "N", bishop: "B", queen: "Q", king: "K", pawn: "P",
};

/** Build the FEN placement: mover = white piece of `piece` type at start;
 *  walls = white knights (filler); enemies = their OWN black piece, so the type
 *  survives a load→save. Always returns an explicit `mover` (B5). Throws if
 *  start/goal missing. */
export function buildFenBlock(s: BuilderState): { fen: string; target: string | undefined; mover: string } {
  // The targetless kinds (queens, knight-tour, promotion-run) have no goal by
  // design — `null` there is a finished draft, not a missing field. Everywhere
  // else a goal is still required.
  if (!s.start || (!s.goal && !isTargetlessKind(s.kind))) throw new Error("start and goal required");
  const grid: (string | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  const put = (sq: string, ch: string) => { const p = squareToPos(sq); grid[7 - p.rank][p.file] = ch; };
  for (const w of s.walls) put(w, "N");      // wall filler (white)
  // Lowercase = black. The old code hardcoded "p" here and ate the type.
  for (const e of s.enemies) put(e.square, FEN_LETTER[e.piece].toLowerCase());
  put(s.start, FEN_LETTER[s.piece]);          // mover overwrites any filler overlap
  const placement = grid
    .map((row) => {
      let out = "", run = 0;
      for (const cell of row) { if (cell) { if (run) { out += run; run = 0; } out += cell; } else run++; }
      return run ? out + run : out;
    })
    .join("/");
  return { fen: `${placement} w - - 0 1`, target: s.goal ?? undefined, mover: s.start };
}

export function toPuzzleInput(s: BuilderState): PuzzleInput {
  const { fen, target, mover } = buildFenBlock(s);
  return {
    kind: s.kind, piece: s.piece, tier: s.tier ?? "medium",
    fen, target, mover, explanation: s.explanation,
    // promotion-run carries its win condition here; the FEN cannot express it.
    mission: s.promoteTo ? { promoteTo: s.promoteTo } : undefined,
  };
}

/** The record Save would write for this draft — the exact input the ONE
 *  validator (buildCatalog) decides on. `kind:"exercise"` is left OFF the record
 *  (LabyrinthRecord's kind excludes it); the exercise bucket is expressed by
 *  routing the record through buildCatalog's `exerciseRecords`, which forces it.
 *  The draft id defaults to a fixed sentinel so its errors carry a stable label. */
export function toLabyrinthRecord(s: BuilderState, id = "draft"): LabyrinthRecord {
  const { fen, target, mover } = buildFenBlock(s);
  return {
    id,
    piece: s.piece,
    ...(s.kind === "exercise" ? {} : { kind: s.kind }),
    fen,
    mover,
    target,
    promoteTo: s.promoteTo,
    tier: s.tier,
    tags: s.tags,
    explanation: s.explanation,
    order: s.order,
  };
}

export type FenLoadResult =
  | { ok: true; start: string; walls: string[]; enemies: AuthoredEnemy[]; notes: string[] }
  | { ok: false; error: string };

/**
 * FEN → builder state. The INVERSE of buildFenBlock, and the pair is tested as
 * one over the real records (fen-round-trip.test.ts): the builder loads with
 * this and re-serializes with that on every save, so an unfaithful pair rewrites
 * levels nobody asked it to touch.
 *
 * Lived unexported inside app/dev/labyrinth-builder/page.tsx, which made the
 * round-trip untestable — and the reason the type loss went unmeasured for so
 * long.
 *
 * Resolves the mover square (explicit or the sole white piece of `piece` type),
 * then maps remaining whites → walls and blacks → typed enemies.
 */
export function deriveStateFromFen(
  fen: string,
  piece: PieceId,
  mover: string,
): FenLoadResult {
  let board: ReturnType<typeof parseFenBoard>;
  try {
    board = parseFenBoard(fen);
  } catch (e) {
    return { ok: false, error: `FEN parse error: ${(e as Error).message}` };
  }

  let moverSq = mover.trim();
  if (moverSq) {
    const p = board.get(moverSq);
    if (!p || p.color !== "w" || p.type !== piece) {
      return { ok: false, error: `mover ${moverSq} is not a white ${piece} in this FEN.` };
    }
  } else {
    const matches = [...board.entries()].filter(
      ([, p]) => p.color === "w" && p.type === piece,
    );
    if (matches.length === 1) {
      moverSq = matches[0][0];
    } else if (matches.length === 0) {
      return { ok: false, error: `No white ${piece} found — set mover or change piece.` };
    } else {
      return { ok: false, error: `Ambiguous: ${matches.length} white ${piece}s — set mover.` };
    }
  }

  const walls: string[] = [];
  const enemies: AuthoredEnemy[] = [];
  for (const [sq, p] of board) {
    if (sq === moverSq) continue;
    if (p.color === "w") walls.push(sq);
    else enemies.push({ square: sq, piece: p.type });
  }

  const notes: string[] = [];
  if (piece !== "pawn" && enemies.length)
    notes.push(`${enemies.length} black square(s) ignored (captures only for pawn)`);

  return { ok: true, start: moverSq, walls, enemies, notes };
}
