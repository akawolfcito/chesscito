import type { ExerciseTier, PieceId } from "@/lib/game/types";
import { squareToPos, type PuzzleInput } from "@/lib/game/fen-puzzle";

export type BuilderState = {
  piece: PieceId;
  start: string | null;
  goal: string | null;
  walls: string[];
  captures: string[]; // pawn only
  order: number;
  explanation?: string;
  /** Difficulty tier — drives the rotation engine's gating. Defaults to
   *  "medium" downstream when unset. Author-editable for exercises. */
  tier?: ExerciseTier;
  /** Freeform authoring tags (e.g. "straight-line"). Persisted verbatim. */
  tags?: string[];
  id?: string;
};

export function emptyState(piece: PieceId = "rook"): BuilderState {
  return { piece, start: null, goal: null, walls: [], captures: [], order: 0 };
}

const FEN_LETTER: Record<PieceId, string> = {
  rook: "R", knight: "N", bishop: "B", queen: "Q", king: "K", pawn: "P",
};

/** Build the FEN placement: mover = white piece of `piece` type at start;
 *  walls = white knights (filler); captures = black pawns (pawn lessons only).
 *  Always returns an explicit `mover` (B5). Throws if start/goal missing. */
export function buildFenBlock(s: BuilderState): { fen: string; target: string; mover: string } {
  if (!s.start || !s.goal) throw new Error("start and goal required");
  const grid: (string | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  const put = (sq: string, ch: string) => { const p = squareToPos(sq); grid[7 - p.rank][p.file] = ch; };
  for (const w of s.walls) put(w, "N");      // wall filler (white)
  for (const c of s.captures) put(c, "p");   // capturable (black) — pawn lessons
  put(s.start, FEN_LETTER[s.piece]);          // mover overwrites any filler overlap
  const placement = grid
    .map((row) => {
      let out = "", run = 0;
      for (const cell of row) { if (cell) { if (run) { out += run; run = 0; } out += cell; } else run++; }
      return run ? out + run : out;
    })
    .join("/");
  return { fen: `${placement} w - - 0 1`, target: s.goal, mover: s.start };
}

export function toPuzzleInput(s: BuilderState): PuzzleInput {
  const { fen, target, mover } = buildFenBlock(s);
  return {
    kind: "labyrinth", piece: s.piece, tier: "medium",
    fen, target, mover, explanation: s.explanation,
  };
}
