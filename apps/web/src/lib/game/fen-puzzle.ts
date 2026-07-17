import type {
  BoardPosition,
  PieceId,
  ExerciseTier,
  TypedEnemy,
} from "@/lib/game/types";

/** Re-exported so the threat modules can keep importing it from here, next to
 *  the mapper that produces it. Defined in types.ts because `Exercise` carries
 *  it and this module imports types.ts — see the note there. */
export type { TypedEnemy };

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

export type PuzzleKind =
  | "exercise"
  | "labyrinth"
  | "diagonal-run"
  | "knight-tour"
  | "queens"
  | "safe-path";

/** The kinds graded by COVERAGE instead of arrival: they have no destination and
 *  no route, only a ceiling to fill. Everything that branches on "is there a
 *  target" asks THIS, not the kind — the tour was the first, queens the second,
 *  and a third would otherwise mean hunting every `!== "knight-tour"` in the
 *  tree. Grade them with tourStars, never labyrinthStars. */
export const COVERAGE_KINDS = ["knight-tour", "queens"] as const;

export function isCoverageKind(kind: PuzzleKind): boolean {
  return (COVERAGE_KINDS as readonly string[]).includes(kind);
}

/** The kinds that model BLACK pieces as static threats instead of as capture
 *  targets. They are the only ones that read `enemies`, and the only ones
 *  allowed a black piece without a pawn's capture semantics — everywhere else a
 *  black piece is still an authoring mistake (see the guard in mapFenPuzzle).
 *  Ask THIS, never `kind === "safe-path"`: Promotion Run is next in line. */
export const THREAT_KINDS = ["safe-path"] as const;

export function isThreatKind(kind: PuzzleKind): boolean {
  return (THREAT_KINDS as readonly string[]).includes(kind);
}

export type PuzzleInput = {
  kind: PuzzleKind;
  piece: PieceId;
  fen: string;
  /** The square to reach. OPTIONAL for the coverage kinds, which have no
   *  destination — see `targetPos` on MappedPuzzle. Required for every other
   *  kind: without it the puzzle has no win condition. */
  target?: string;
  mover?: string;
  tier: ExerciseTier;
  tags?: string[];
  explanation?: string;
  /* Pedagogy (A1) — curated, carried through the FEN round-trip untouched. */
  principle?: string;
  title?: string;
  playerPrompt?: string;
  learningObjective?: string;
};

export type MappedPuzzle = {
  kind: PuzzleKind;
  piece: PieceId;
  startPos: BoardPosition;
  /** The square to reach. For the coverage kinds this is the START square, which
   *  encodes "no target": they end when no legal square is left, and the start is
   *  the one square that can never be arrived at (the tour X-es it out on the
   *  first jump; a queens level already has a queen standing on it).
   *  `Exercise.targetPos` is required and
   *  read in 100+ places, so a sentinel buys the game its way in without an
   *  Optional that every one of those callers would have to answer for. Nothing
   *  in their own path reads it — the board and host use the coverage handler,
   *  never a target check. */
  targetPos: BoardPosition;
  obstacles?: BoardPosition[];
  captureTargets?: BoardPosition[];
  /** Static black pieces that project attacked squares. ADDITIVE: only the
   *  threat kinds populate it, so `obstacles`/`captureTargets` keep the exact
   *  meaning their other 27 call sites already rely on. */
  enemies?: TypedEnemy[];
  isCapture?: boolean;
  tier: ExerciseTier;
  tags?: string[];
  objective?: string;
  principle?: string;
  title?: string;
  playerPrompt?: string;
  learningObjective?: string;
};

const samePos = (a: BoardPosition, b: BoardPosition) => a.file === b.file && a.rank === b.rank;

export function mapFenPuzzle(input: PuzzleInput): MappedPuzzle {
  const board = parseFenBoard(input.fen);
  const isCoverage = isCoverageKind(input.kind);

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
  // Resolved after the mover, because a coverage kind's "target" IS the mover's square.
  if (!isCoverage && !input.target?.trim()) throw new FenError("target is required");
  const targetPos = isCoverage ? startPos : squareToPos(input.target!);
  // The coverage kinds are exempt: their target and start are the same square BY
  // DEFINITION, which is exactly the mistake this guard catches for every other kind.
  if (!isCoverage && samePos(startPos, targetPos)) {
    throw new FenError("target equals start");
  }

  const obstacles: BoardPosition[] = [];
  const captureTargets: BoardPosition[] = [];
  const enemies: TypedEnemy[] = [];
  const isThreat = isThreatKind(input.kind);
  for (const [sq, p] of board) {
    if (sq === moverSq) continue;
    // White stays untyped on purpose: a wall is a wall, and 27 call sites read
    // `obstacles` as bare squares.
    if (p.color === "w") { obstacles.push(squareToPos(sq)); continue; }
    // Black means one of three things, and the kind decides which:
    if (isThreat) { enemies.push({ pos: squareToPos(sq), piece: p.type }); continue; }
    if (input.piece !== "pawn") {
      throw new FenError(`black piece on ${sq}: captures unsupported for ${input.piece}; model as obstacles`);
    }
    captureTargets.push(squareToPos(sq));
  }

  const targetIsBlack = board.get(input.target?.trim() ?? "")?.color === "b";
  const isCapture = input.piece === "pawn" && (captureTargets.length > 0 || targetIsBlack);

  return {
    kind: input.kind,
    piece: input.piece,
    startPos,
    targetPos,
    obstacles: obstacles.length ? obstacles : undefined,
    captureTargets: captureTargets.length ? captureTargets : undefined,
    enemies: enemies.length ? enemies : undefined,
    isCapture: isCapture || undefined,
    tier: input.tier,
    tags: input.tags && input.tags.length ? input.tags : undefined,
    objective: input.explanation && input.explanation.trim() ? input.explanation.trim() : undefined,
    principle: trimmed(input.principle),
    title: trimmed(input.title),
    playerPrompt: trimmed(input.playerPrompt),
    learningObjective: trimmed(input.learningObjective),
  };
}

/** Blank-or-whitespace collapses to undefined, so "present but empty" can never
 *  masquerade as curated copy — the linter treats both as missing. */
function trimmed(v: string | undefined): string | undefined {
  const s = v?.trim();
  return s ? s : undefined;
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
