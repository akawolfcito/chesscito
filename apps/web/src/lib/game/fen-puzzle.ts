import type { BoardPosition, PieceId, ExerciseTier } from "@/lib/game/types";

export class FenError extends Error {}

const FEN_PIECE: Record<string, PieceId> = {
  r: "rook", n: "knight", b: "bishop", q: "queen", k: "king", p: "pawn",
};

/** Parse ONLY the piece-placement field of a FEN into square -> piece.
 *  Does NOT use chess.js: puzzle positions are not legal chess games. */
export function parseFenBoard(
  fen: string,
): Map<string, { color: "w" | "b"; type: PieceId }> {
  const placement = fen.trim().split(/\s+/)[0];
  if (!placement) throw new FenError("empty FEN");
  const ranks = placement.split("/");
  if (ranks.length !== 8) throw new FenError(`FEN needs 8 ranks, got ${ranks.length}`);
  const board = new Map<string, { color: "w" | "b"; type: PieceId }>();
  for (let r = 0; r < 8; r++) {
    const rankIndex = 7 - r; // FEN lists rank 8 first => index 7
    let file = 0;
    for (const ch of ranks[r]) {
      if (ch >= "1" && ch <= "8") { file += Number(ch); continue; }
      const type = FEN_PIECE[ch.toLowerCase()];
      if (!type) throw new FenError(`invalid FEN char '${ch}'`);
      if (file > 7) throw new FenError(`rank ${8 - r} overflows`);
      const color = ch === ch.toLowerCase() ? "b" : "w";
      const sq = String.fromCharCode(97 + file) + (rankIndex + 1);
      board.set(sq, { color, type });
      file++;
    }
    if (file !== 8) throw new FenError(`rank ${8 - r} has ${file} files, expected 8`);
  }
  return board;
}

export function squareToPos(sq: string): BoardPosition {
  const m = /^([a-h])([1-8])$/.exec(sq.trim());
  if (!m) throw new FenError(`invalid square '${sq}'`);
  return { file: m[1].charCodeAt(0) - 97, rank: Number(m[2]) - 1 };
}

export function posToSquare(pos: BoardPosition): string {
  return String.fromCharCode(97 + pos.file) + (pos.rank + 1);
}

export type PuzzleInput = {
  kind: "exercise" | "labyrinth";
  piece: PieceId;
  fen: string;
  target: string;
  mover?: string;
  tier: ExerciseTier;
  tags?: string[];
  explanation?: string;
};

export type MappedPuzzle = {
  kind: "exercise" | "labyrinth";
  piece: PieceId;
  startPos: BoardPosition;
  targetPos: BoardPosition;
  obstacles?: BoardPosition[];
  captureTargets?: BoardPosition[];
  isCapture?: boolean;
  tier: ExerciseTier;
  tags?: string[];
  objective?: string;
};

const samePos = (a: BoardPosition, b: BoardPosition) => a.file === b.file && a.rank === b.rank;

export function mapFenPuzzle(input: PuzzleInput): MappedPuzzle {
  const board = parseFenBoard(input.fen);
  const targetPos = squareToPos(input.target);

  let moverSq: string;
  if (input.mover && input.mover.trim()) {
    moverSq = input.mover.trim();
    const p = board.get(moverSq);
    if (!p) throw new FenError(`mover ${moverSq} is empty`);
    if (p.color !== "w") throw new FenError(`mover ${moverSq} must be white`);
    if (p.type !== input.piece) throw new FenError(`mover ${moverSq} is ${p.type}, expected ${input.piece}`);
  } else {
    const matches = [...board.entries()].filter(([, p]) => p.color === "w" && p.type === input.piece);
    if (matches.length === 0) throw new FenError(`no white ${input.piece} in FEN`);
    if (matches.length > 1) throw new FenError(`ambiguous mover: ${matches.length} white ${input.piece}s — set 'mover'`);
    moverSq = matches[0][0];
  }

  const startPos = squareToPos(moverSq);
  if (samePos(startPos, targetPos)) throw new FenError("target equals start");

  const obstacles: BoardPosition[] = [];
  const captureTargets: BoardPosition[] = [];
  for (const [sq, p] of board) {
    if (sq === moverSq) continue;
    if (p.color === "w") { obstacles.push(squareToPos(sq)); continue; }
    if (input.piece !== "pawn") {
      throw new FenError(`black piece on ${sq}: captures unsupported for ${input.piece}; model as obstacles`);
    }
    captureTargets.push(squareToPos(sq));
  }

  const targetIsBlack = board.get(input.target.trim())?.color === "b";
  const isCapture = input.piece === "pawn" && (captureTargets.length > 0 || targetIsBlack);

  return {
    kind: input.kind,
    piece: input.piece,
    startPos,
    targetPos,
    obstacles: obstacles.length ? obstacles : undefined,
    captureTargets: captureTargets.length ? captureTargets : undefined,
    isCapture: isCapture || undefined,
    tier: input.tier,
    tags: input.tags && input.tags.length ? input.tags : undefined,
    objective: input.explanation && input.explanation.trim() ? input.explanation.trim() : undefined,
  };
}

/** FNV-1a → base36, 8 chars. Content-addressed so authoring order never
 *  changes ids. */
export function puzzleId(piece: PieceId, content: string): string {
  let h = 0x811c9dc5;
  const s = `${piece}|${content}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hex = (h >>> 0).toString(36).padStart(8, "0").slice(0, 8);
  return `${piece}-gen-${hex}`;
}
