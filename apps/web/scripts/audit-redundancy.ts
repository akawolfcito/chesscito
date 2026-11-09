/**
 * Curriculum redundancy audit.
 *
 * The rook audit (2026-07-13) found exercises that taught nothing new: rook-3
 * only repeated rook-2's file movement, rook-5 was rook-4's corner turn a second
 * time. Both were replaced. Knight, pawn, queen and king never got that pass —
 * they were CURATED (copy written over existing boards) but never AUDITED.
 *
 * This measures, rather than guesses, what each exercise asks of the player:
 *
 *   shape = (optimalMoves, optimalRoutes, firstMoveChoices, geometry, tags)
 *
 * Two exercises with the same shape are teaching the same lesson twice. That is
 * a CANDIDATE, not a verdict: a deliberate pair (knight-2/knight-3 show the two
 * corner jumps) shares a shape on purpose. The report names them; a human calls it.
 *
 * Run: `pnpm -C apps/web exec tsx scripts/audit-redundancy.ts`
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EXERCISES } from "@/lib/game/exercises";
import { computeExerciseBfs } from "@/lib/game/exercise-bfs";
import { getValidTargets } from "@/lib/game/board";
import type { BoardPosition, Exercise, PieceId } from "@/lib/game/types";

const PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

type Row = {
  id: string;
  piece: string;
  tags: string[];
  principle?: string;
  title?: string;
  tier?: string;
};

const content: Row[] = JSON.parse(
  readFileSync(join(process.cwd(), "content/exercises.json"), "utf8"),
);
const meta = new Map(content.map((r) => [r.id, r]));

const key = (p: BoardPosition) => `${p.file},${p.rank}`;
const sq = (p: BoardPosition) =>
  `${String.fromCharCode(97 + p.file)}${p.rank + 1}`;

/** How the target sits relative to the start — the "idea" of the board. */
function geometry(e: Exercise): string {
  const df = e.targetPos.file - e.startPos.file;
  const dr = e.targetPos.rank - e.startPos.rank;
  if (df === 0 && dr !== 0) return "same-file";
  if (dr === 0 && df !== 0) return "same-rank";
  if (Math.abs(df) === Math.abs(dr)) return "diagonal";
  return "offset";
}

/**
 * How FAR the target is. Without this the audit reports its own blind spot as a
 * finding: rook-2 (a2->a8, sweep the file) and rook-distance-1 (d7->d6, one
 * square) share every other number, yet the rook audit created that pair ON
 * PURPOSE — "one square is a move too" is the whole lesson. Distance is what
 * separates a repeat from a contrast. Bucketed, not exact: 5 squares vs 6 is
 * not a different idea; 1 vs 7 is.
 */
function reach(e: Exercise): string {
  const d = Math.max(
    Math.abs(e.targetPos.file - e.startPos.file),
    Math.abs(e.targetPos.rank - e.startPos.rank),
  );
  return d <= 1 ? "adjacent" : d <= 3 ? "near" : "far";
}

/** What the player actually faces: how long, how many best routes, how wide
 *  the first decision. Mirrors lint.ts's decisionProfile (which is private). */
function profile(piece: PieceId, e: Exercise) {
  const bfs = computeExerciseBfs(piece, e);
  if (!bfs) return null;
  const targets = (from: BoardPosition) =>
    getValidTargets(
      piece,
      from,
      e.obstacles ?? [],
      e.isCapture ?? false,
      e.captureTargets,
      e.targetPos,
    );

  const dist = new Map<string, number>([[key(e.startPos), 0]]);
  const order: BoardPosition[] = [e.startPos];
  for (let i = 0; i < order.length; i += 1) {
    const u = order[i];
    const du = dist.get(key(u))!;
    if (du >= bfs.optimalMoves) continue;
    for (const m of targets(u)) {
      if (dist.has(key(m))) continue;
      dist.set(key(m), du + 1);
      order.push(m);
    }
  }
  const routes = new Map<string, number>([[key(e.startPos), 1]]);
  for (const u of order) {
    const du = dist.get(key(u))!;
    const wu = routes.get(key(u)) ?? 0;
    if (wu === 0 || du >= bfs.optimalMoves) continue;
    for (const m of targets(u)) {
      if (dist.get(key(m)) !== du + 1) continue;
      routes.set(key(m), (routes.get(key(m)) ?? 0) + wu);
    }
  }
  return {
    optimalMoves: bfs.optimalMoves,
    optimalRoutes: routes.get(key(e.targetPos)) ?? 0,
    firstMoveChoices: targets(e.startPos).length,
  };
}

let flagged = 0;

for (const piece of PIECES) {
  const rows = EXERCISES[piece].map((e) => {
    const m = meta.get(e.id);
    const p = profile(piece, e);
    return {
      e,
      m,
      p,
      geo: geometry(e),
      reach: reach(e),
      obstacles: (e.obstacles ?? []).length,
    };
  });

  console.log(`\n${"=".repeat(78)}\n${piece.toUpperCase()}  (${rows.length} exercises)\n${"=".repeat(78)}`);
  for (const r of rows) {
    const p = r.p;
    console.log(
      [
        r.e.id.padEnd(18),
        (r.m?.tier ?? "?").padEnd(7),
        `${sq(r.e.startPos)}->${sq(r.e.targetPos)}`.padEnd(9),
        `opt ${p ? p.optimalMoves : "?"}`.padEnd(7),
        `routes ${p ? p.optimalRoutes : "?"}`.padEnd(11),
        `first ${p ? p.firstMoveChoices : "?"}`.padEnd(10),
        `obst ${r.obstacles}`.padEnd(8),
        r.geo.padEnd(10),
        r.reach.padEnd(9),
        (r.m?.tags ?? []).join("+"),
      ].join(" "),
    );
  }

  // Same shape twice = same lesson twice. Candidate, not verdict.
  const shape = (r: (typeof rows)[number]) =>
    r.p
      ? `${r.p.optimalMoves}|${r.p.optimalRoutes}|${r.p.firstMoveChoices}|${r.geo}|${r.reach}|${r.obstacles === 0 ? "open" : "blocked"}`
      : "?";
  const groups = new Map<string, string[]>();
  for (const r of rows) {
    const k = shape(r);
    groups.set(k, [...(groups.get(k) ?? []), r.e.id]);
  }
  const dupes = [...groups.entries()].filter(([, ids]) => ids.length > 1);
  if (dupes.length === 0) {
    console.log("  -> no repeated shapes");
  } else {
    for (const [k, ids] of dupes) {
      flagged += ids.length - 1;
      console.log(`  !! SAME SHAPE [${k}]: ${ids.join(", ")}`);
    }
  }
}

console.log(`\n${"=".repeat(78)}`);
console.log(`Candidates for redundancy (repeated shapes beyond the first): ${flagged}`);
console.log(`${"=".repeat(78)}\n`);
