import type { BoardPosition, Exercise, PieceId } from "@/lib/game/types";

const FILE_LETTERS = "abcdefgh";

function parseFile(ch: string): number {
  const f = ch.charCodeAt(0) - 97;
  if (f < 0 || f > 7) throw new RangeError(`Invalid file "${ch}": expected a-h`);
  return f;
}

function parseRank(ch: string): number {
  const n = Number(ch);
  if (!Number.isInteger(n) || n < 1 || n > 8) throw new RangeError(`Invalid rank "${ch}": expected 1-8`);
  return n - 1;
}

export function sq(coord: string): BoardPosition {
  if (coord.length !== 2) throw new RangeError(`Invalid coordinate "${coord}": expected 2 characters (e.g. "a1")`);
  return { file: parseFile(coord[0]), rank: parseRank(coord[1]) };
}

export function posToString(pos: BoardPosition): string {
  return `${FILE_LETTERS[pos.file]}${pos.rank + 1}`;
}

export type ExerciseDef = {
  id: string;
  piece: PieceId;
  start: string;
  target: string;
  optimalMoves: number;
  isCapture?: boolean;
};

export type LabyrinthDef = {
  id: string;
  piece?: PieceId;
  start: string;
  target: string;
  obstacles?: string[];
  isCapture?: boolean;
  optimalMoves: number;
};

function validateDistinct(start: BoardPosition, target: BoardPosition): void {
  if (start.file === target.file && start.rank === target.rank) {
    throw new Error(
      `Start "${posToString(start)}" and target "${posToString(target)}" must be different`,
    );
  }
}

function validateObstacles(
  obstacles: BoardPosition[],
  start: BoardPosition,
  target: BoardPosition,
): void {
  const seen = new Set<string>();
  for (const ob of obstacles) {
    const key = `${ob.file},${ob.rank}`;
    if (seen.has(key)) throw new Error(`Duplicate obstacle at "${posToString(ob)}"`);
    seen.add(key);
    if (ob.file === start.file && ob.rank === start.rank) {
      throw new Error(`Obstacle at "${posToString(ob)}" overlaps start position`);
    }
    if (ob.file === target.file && ob.rank === target.rank) {
      throw new Error(`Obstacle at "${posToString(ob)}" overlaps target position`);
    }
  }
}

export function defineExercise(def: ExerciseDef): Exercise {
  const startPos = sq(def.start);
  const targetPos = sq(def.target);
  validateDistinct(startPos, targetPos);

  return {
    id: def.id,
    startPos,
    targetPos,
    optimalMoves: def.optimalMoves,
    ...(def.isCapture !== undefined && { isCapture: def.isCapture }),
  };
}

export function defineLabyrinth(def: LabyrinthDef): Exercise {
  const startPos = sq(def.start);
  const targetPos = sq(def.target);
  validateDistinct(startPos, targetPos);

  const obstacles = (def.obstacles ?? []).map(sq);
  validateObstacles(obstacles, startPos, targetPos);

  return {
    id: def.id,
    startPos,
    targetPos,
    optimalMoves: def.optimalMoves,
    ...(def.isCapture !== undefined && { isCapture: def.isCapture }),
    ...(obstacles.length > 0 && { obstacles }),
  };
}
