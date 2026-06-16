# Labyrinth Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dev-only visual + written labyrinth authoring tool that BFS-validates a puzzle live and saves it (via a dev API that writes a repo content file + regenerates the committed catalog) so it appears in `/exercises`, augmenting the existing content in an author-chosen order.

**Architecture:** Phase A builds the FEN data backbone (mapper + BFS + generated catalog, reading CSV + a new `labyrinths.json`). Phase B builds the editor on top: a flat 8×8 grid + brushes, a live validator using a new path-returning BFS, a written FEN field, and a dev-only save API that upserts `labyrinths.json` and regenerates the catalog.

**Tech Stack:** TypeScript, Vitest, Next.js (Route Handler + dev page), existing `@/lib/game/board` + `exercise-bfs`.

**Specs:** `docs/superpowers/specs/2026-06-16-labyrinth-builder-design.md` (red-teamed B1-B6) + `docs/superpowers/specs/2026-06-16-fen-puzzle-content-pipeline-design.md` (backbone).

`<repo>` = `/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito`. Run tests with `pnpm -C <repo>/apps/web exec vitest run <file>` and `pnpm -C <repo>/apps/web exec tsc --noEmit`.

---

## Phase A — FEN backbone (prerequisite)

Execute these tasks from the FEN pipeline plan (`docs/superpowers/plans/2026-06-16-fen-puzzle-content-pipeline.md`) FIRST — they are the shared data layer:

- [ ] **A1** — FEN plan Task 1 (`fen-puzzle.ts`: `parseFenBoard`, `squareToPos`, `posToSquare`).
- [ ] **A2** — FEN plan Task 2 (`mapFenPuzzle` — role convention, mover override, pawn-only captures).
- [ ] **A3** — FEN plan Task 3 (`puzzleId` content hash).
- [ ] **A4** — FEN plan Task 5 (`buildCatalog`) **with the JSON delta in Task A5 below**.
- [ ] **A5** — FEN plan Task 6 (`renderGeneratedModule`) + CLI.
- [ ] **A6** — FEN plan Task 8 (merge generated arrays into `exercises.ts`, augment).

### Task A5-delta: buildCatalog also ingests `labyrinths.json`

**Files:** Modify `apps/web/scripts/import-puzzles.ts`; Test `apps/web/scripts/__tests__/import-puzzles.test.ts`.

- [ ] **Step 1: Failing test** — `buildCatalog` accepts an optional second arg of JSON labyrinth records and merges them as `kind:"labyrinth"`, sorted by `(order, id)`.

```typescript
import { buildCatalog, type LabyrinthRecord } from "../import-puzzles";

it("ingests labyrinths.json records sorted by (order,id)", () => {
  const header = ["kind","piece","fen","target","mover","tier","tags","explanation","id"];
  const recs: LabyrinthRecord[] = [
    { piece: "rook", fen: "8/8/8/8/8/8/8/R6R w - - 0 1", target: "a8", mover: "a1", order: 20, id: "rook-b" },
    { piece: "rook", fen: "8/8/8/8/8/8/8/R6R w - - 0 1", target: "h8", mover: "a1", order: 10, id: "rook-a" },
  ];
  const { labyrinths, errors } = buildCatalog([header], recs);
  expect(errors).toEqual([]);
  expect(labyrinths.rook.map((e) => e.id)).toEqual(["rook-a", "rook-b"]); // order 10 before 20
});
```

- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** — add the type + ingestion:

```typescript
export type LabyrinthRecord = {
  id?: string;
  piece: PieceId;
  fen: string;
  target: string;
  mover?: string;
  tier?: ExerciseTier;       // default "medium"
  tags?: string[];
  explanation?: string;
  order: number;
};

// inside buildCatalog(rows, labRecords: LabyrinthRecord[] = []):
//  ...after processing CSV rows, before the final sort, process labRecords:
for (const rec of labRecords) {
  const input: PuzzleInput = {
    kind: "labyrinth", piece: rec.piece, tier: rec.tier ?? "medium",
    fen: rec.fen, target: rec.target, mover: rec.mover,
    tags: rec.tags, explanation: rec.explanation,
  };
  let mapped;
  try { mapped = mapFenPuzzle(input); } catch (e) { errors.push(`labyrinths.json '${rec.id ?? rec.fen}': ${(e as Error).message}`); continue; }
  const probe: Exercise = { id: "probe", optimalMoves: 0, ...toExerciseFields(mapped) };
  const bfs = computeExerciseBfs(rec.piece, probe);
  if (!bfs) { errors.push(`labyrinths.json '${rec.id ?? rec.fen}': unsolvable`); continue; }
  const id = rec.id || puzzleId(rec.piece, `labyrinth|${rec.fen}|${rec.target}|${rec.mover ?? ""}`);
  if (seenIds.has(id)) { errors.push(`labyrinths.json: duplicate id '${id}'`); continue; }
  seenIds.add(id);
  // attach order for the sort below
  labyrinths[rec.piece].push(Object.assign({ id, optimalMoves: bfs.optimalMoves, ...toExerciseFields(mapped) }, { __order: rec.order }) as Exercise);
}
// FINAL sort: generated labyrinths by (order, id); strip __order before emit.
for (const p of PIECES) {
  labyrinths[p].sort((a, b) => (((a as any).__order ?? 0) - ((b as any).__order ?? 0)) || a.id.localeCompare(b.id));
  labyrinths[p].forEach((e) => { delete (e as any).__order; });
}
```
(Keep exercises sorted by id as in the FEN plan; only labyrinths honor `order`.)

- [ ] **Step 4: Run, verify pass. Step 5: Commit** `feat(content): buildCatalog ingests labyrinths.json (order-sorted)`.

---

## Phase B — Builder

### Task B1: path-returning BFS (RED-TEAM B1)

**Files:** Modify `apps/web/src/lib/game/exercise-bfs.ts`; Test `apps/web/src/lib/game/__tests__/exercise-bfs-path.test.ts`.

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect } from "vitest";
import { computeExerciseBfsPath } from "../exercise-bfs";
import type { Exercise } from "../types";

const rookLab: Exercise = {
  id: "t", optimalMoves: 0,
  startPos: { file: 0, rank: 0 }, targetPos: { file: 0, rank: 7 },
};

describe("computeExerciseBfsPath", () => {
  it("returns a path from start to target with length == optimalMoves", () => {
    const r = computeExerciseBfsPath("rook", rookLab);
    expect(r).not.toBeNull();
    expect(r!.path[0]).toEqual({ file: 0, rank: 0 });
    expect(r!.path[r!.path.length - 1]).toEqual({ file: 0, rank: 7 });
    expect(r!.path.length - 1).toBe(r!.optimalMoves); // edges == moves
  });
  it("returns null when unsolvable", () => {
    const boxed: Exercise = { ...rookLab, obstacles: [{ file: 0, rank: 1 }, { file: 1, rank: 0 }], targetPos: { file: 7, rank: 7 } };
    // a1 rook fully boxed on file a (a2) and rank 1 (b1) cannot be fully blocked for a rook;
    // pick a real unsolvable fixture during impl (e.g. surround target). Assert null.
    void boxed;
  });
});
```

- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** — add alongside `computeExerciseBfs` (same expansion, parent map):

```typescript
export type ExerciseBfsPathResult = { optimalMoves: number; path: BoardPosition[] } | null;

export function computeExerciseBfsPath(
  piece: PieceId,
  exercise: Exercise,
  maxDepth = 32,
): ExerciseBfsPathResult {
  const start = exercise.startPos;
  const target = exercise.targetPos;
  const blockers = exercise.obstacles ?? [];
  const isCapture = exercise.isCapture ?? false;
  const captureTargets = exercise.captureTargets;
  if (key(start) === key(target)) return { optimalMoves: 0, path: [start] };

  const parent = new Map<string, BoardPosition | null>([[key(start), null]]);
  const queue: Array<{ pos: BoardPosition; depth: number }> = [{ pos: start, depth: 0 }];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.depth >= maxDepth) continue;
    const moves = getValidTargets(piece, node.pos, blockers, isCapture, captureTargets, target);
    for (const m of moves) {
      const k = key(m);
      if (parent.has(k)) continue;
      parent.set(k, node.pos);
      if (k === key(target)) {
        const path: BoardPosition[] = [];
        let cur: BoardPosition | null = m;
        while (cur) { path.unshift(cur); cur = parent.get(key(cur)) ?? null; }
        return { optimalMoves: node.depth + 1, path };
      }
      queue.push({ pos: m, depth: node.depth + 1 });
    }
  }
  return null;
}
```
(`key` already exists in the file; reuse it.)

- [ ] **Step 4: Run, verify pass (fix the unsolvable fixture to a truly boxed case). Step 5: Commit** `feat(game): computeExerciseBfsPath returns the optimal route`.

### Task B2: builder state model

**Files:** Create `apps/web/src/lib/labyrinth-builder/state.ts`; Test `__tests__/state.test.ts`.

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect } from "vitest";
import { emptyState, toPuzzleInput, buildFenBlock } from "../state";

describe("builder state", () => {
  it("maps a rook state to a PuzzleInput with explicit mover", () => {
    const s = { piece: "rook" as const, start: "a1", goal: "a8", walls: ["h1"], captures: [], order: 0 };
    const input = toPuzzleInput(s);
    expect(input.kind).toBe("labyrinth");
    expect(input.mover).toBe("a1");
    expect(input.target).toBe("a8");
    expect(input.fen).toContain("/"); // a FEN string
  });
  it("buildFenBlock always emits an explicit mover (B5)", () => {
    const block = buildFenBlock({ piece: "rook", start: "a1", goal: "a8", walls: ["h1"], captures: [], order: 0 });
    expect(block.mover).toBe("a1");
  });
});
```

- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** — `BuilderState`, `emptyState()`, cell-role toggles, and FEN build. White mover at `start` + walls as white rooks (arbitrary non-king filler), black pieces at captures (pawn only). Always sets `mover`.

```typescript
import type { PieceId } from "@/lib/game/types";
import { squareToPos, type PuzzleInput } from "@/lib/game/fen-puzzle";

export type BuilderState = {
  piece: PieceId;
  start: string | null;
  goal: string | null;
  walls: string[];
  captures: string[];   // pawn only
  order: number;
  explanation?: string;
  id?: string;
};

export function emptyState(piece: PieceId = "rook"): BuilderState {
  return { piece, start: null, goal: null, walls: [], captures: [], order: 0 };
}

const FEN_LETTER: Record<PieceId, string> = {
  rook: "R", knight: "N", bishop: "B", queen: "Q", king: "K", pawn: "P",
};

/** Build the 8-rank placement string. mover = white piece of `piece` type;
 *  walls = white knights (filler — never the mover's type unless piece is
 *  knight, in which case mover is still disambiguated by explicit `mover`);
 *  captures = black pawns. */
export function buildFenBlock(s: BuilderState): { fen: string; target: string; mover: string } {
  if (!s.start || !s.goal) throw new Error("start and goal required");
  const grid: (string | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  const put = (sq: string, ch: string) => { const p = squareToPos(sq); grid[7 - p.rank][p.file] = ch; };
  for (const w of s.walls) put(w, "N");            // wall filler (white)
  for (const c of s.captures) put(c, "p");          // capturable (black), pawn only
  put(s.start, FEN_LETTER[s.piece]);                // mover (overwrites filler if overlap)
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
    fen, target, mover,
    captureTargets: undefined, // captures are read from the FEN by the mapper
    explanation: s.explanation,
  } as PuzzleInput;
}
```

- [ ] **Step 4: Run, verify pass. Step 5: Commit** `feat(builder): labyrinth builder state model`.

### Task B3: live validator

**Files:** Create `apps/web/src/lib/labyrinth-builder/validate.ts`; Test `__tests__/validate.test.ts`.

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect } from "vitest";
import { validateBuilder } from "../validate";

describe("validateBuilder", () => {
  it("ok + optimal + path for a solvable rook lab", () => {
    const r = validateBuilder({ piece: "rook", start: "a1", goal: "a8", walls: [], captures: [], order: 0 });
    expect(r.ok).toBe(true);
    expect(r.optimalMoves).toBe(1);
    expect(r.path.length).toBe(2);
  });
  it("errors when start === goal", () => {
    const r = validateBuilder({ piece: "rook", start: "a1", goal: "a1", walls: [], captures: [], order: 0 });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/start/i);
  });
  it("warns on an accidental shortcut vs a traced path", () => {
    // traced length 3 but BFS optimal 1 → shortcut warning
    const r = validateBuilder({ piece: "rook", start: "a1", goal: "a8", walls: [], captures: [], order: 0 }, ["a1","b1","b8","a8"]);
    expect(r.warnings.join(" ")).toMatch(/shorter|shortcut/i);
  });
});
```

- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** — map state → Exercise (via `toPuzzleInput` + `mapFenPuzzle`), run `computeExerciseBfsPath`, assemble result:

```typescript
import { mapFenPuzzle } from "@/lib/game/fen-puzzle";
import { computeExerciseBfsPath } from "@/lib/game/exercise-bfs";
import type { BoardPosition, Exercise } from "@/lib/game/types";
import { toPuzzleInput, type BuilderState } from "./state";

export type ValidationResult = {
  ok: boolean; optimalMoves: number | null; path: BoardPosition[];
  errors: string[]; warnings: string[];
};

export function validateBuilder(s: BuilderState, tracedPath?: string[]): ValidationResult {
  const errors: string[] = []; const warnings: string[] = [];
  if (!s.start) errors.push("Set a start square.");
  if (!s.goal) errors.push("Set a goal square.");
  if (s.start && s.goal && s.start === s.goal) errors.push("Start and goal must differ.");
  if (errors.length) return { ok: false, optimalMoves: null, path: [], errors, warnings };

  let exercise: Exercise;
  try {
    const mapped = mapFenPuzzle(toPuzzleInput(s));
    exercise = { id: "preview", optimalMoves: 0, startPos: mapped.startPos, targetPos: mapped.targetPos, obstacles: mapped.obstacles, captureTargets: mapped.captureTargets, isCapture: mapped.isCapture };
  } catch (e) {
    return { ok: false, optimalMoves: null, path: [], errors: [(e as Error).message], warnings };
  }
  const bfs = computeExerciseBfsPath(s.piece, exercise);
  if (!bfs) return { ok: false, optimalMoves: null, path: [], errors: ["No path: the goal is unreachable."], warnings };
  if (tracedPath && tracedPath.length - 1 > bfs.optimalMoves) {
    warnings.push(`There is a shorter path (${bfs.optimalMoves}) than your traced route (${tracedPath.length - 1}). Add walls to remove the shortcut.`);
  }
  return { ok: true, optimalMoves: bfs.optimalMoves, path: bfs.path, errors, warnings };
}
```

- [ ] **Step 4: Run, verify pass. Step 5: Commit** `feat(builder): live BFS validator with shortcut warning`.

### Task B4: dev save API

**Files:** Create `apps/web/src/lib/labyrinth-builder/store.ts` (pure upsert) + `apps/web/src/app/api/dev/labyrinth/route.ts`; Test `__tests__/store.test.ts`.

- [ ] **Step 1: Failing test (pure upsert)**

```typescript
import { describe, it, expect } from "vitest";
import { upsertRecord } from "../store";

it("replaces by id, else appends", () => {
  const a = { id: "x", piece: "rook" as const, fen: "f", target: "a8", order: 1 };
  const b = { id: "x", piece: "rook" as const, fen: "g", target: "a8", order: 1 };
  expect(upsertRecord([a], b)).toEqual([b]);            // replace
  const c = { id: "y", piece: "rook" as const, fen: "h", target: "a8", order: 2 };
  expect(upsertRecord([a], c)).toEqual([a, c]);          // append
});
```

- [ ] **Step 2: Run, verify fail. Step 3: Implement `store.ts`:**

```typescript
import type { LabyrinthRecord } from "@/../scripts/import-puzzles"; // or re-declare the type here
export function upsertRecord(recs: LabyrinthRecord[], rec: LabyrinthRecord): LabyrinthRecord[] {
  const i = rec.id ? recs.findIndex((r) => r.id === rec.id) : -1;
  if (i >= 0) { const next = recs.slice(); next[i] = rec; return next; }
  return [...recs, rec];
}
```
(If the cross-package import is awkward, declare `LabyrinthRecord` in `store.ts` and have `import-puzzles.ts` import it FROM here instead — single source of the type.)

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Implement the route** `app/api/dev/labyrinth/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { upsertRecord } from "@/lib/labyrinth-builder/store";
import { parseCsv, buildCatalog, renderGeneratedModule } from "@/../scripts/import-puzzles";

export const runtime = "nodejs";
const CONTENT = resolve(process.cwd(), "content");
const JSON_PATH = resolve(CONTENT, "labyrinths.json");
const CSV_PATH = resolve(CONTENT, "puzzles.csv");
const GEN_PATH = resolve(process.cwd(), "src/lib/game/generated/puzzles.generated.ts");

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  const rec = await req.json();
  const recs = existsSync(JSON_PATH) ? JSON.parse(readFileSync(JSON_PATH, "utf8")) : [];
  const next = upsertRecord(recs, rec);
  const csvRows = existsSync(CSV_PATH) ? parseCsv(readFileSync(CSV_PATH, "utf8")) : [["kind","piece","fen","target","mover","tier","tags","explanation","id"]];
  const cat = buildCatalog(csvRows, next);
  if (cat.errors.length) return NextResponse.json({ ok: false, errors: cat.errors }, { status: 400 });
  mkdirSync(dirname(GEN_PATH), { recursive: true });
  writeFileSync(JSON_PATH, JSON.stringify(next, null, 2));
  writeFileSync(GEN_PATH, renderGeneratedModule(cat));
  return NextResponse.json({ ok: true, saved: rec });
}
```
- Validates server-side (buildCatalog rejects invalid/unsolvable → 400, nothing written). 404 in prod. Path-locked to `content/`.

- [ ] **Step 6: Commit** `feat(builder): dev-only save API (upsert labyrinths.json + regenerate)`.

### Task B5: editor page (UI — manual-verified)

**Files:** Create `apps/web/src/app/dev/labyrinth-builder/page.tsx`.

- [ ] **Step 1: Build the page** (dev-only). No unit test (UI); verified by running it. Structure:
  - `"use client"`; `export const dynamic = "force-dynamic"`; `if (process.env.NODE_ENV === "production") notFound();`
  - State: `useState<BuilderState>(emptyState())`, active brush, optional traced path, written-field text.
  - A FLAT 8×8 grid (CSS grid of 64 buttons; label files a-h cols, ranks 8→1 rows; a1 bottom-left). Each cell shows its role color (start=green, goal=star/amber, wall=dark, capture=red) + path overlay dots from `validateBuilder().path`.
  - Brush buttons: Start / Goal / Wall / Capture (capture only enabled when `piece==="pawn"`) / Trace.
  - Piece `<select>`. Inputs for `order`, `explanation`, `id`.
  - A `<textarea>` written field: on change, parse `fen`+`target` (via `parseFenBoard`/`squareToPos`) into BuilderState; on board edits, re-serialize via `buildFenBlock`.
  - Live: call `validateBuilder(state, tracedPath)` on each change; show `optimalMoves`, errors (red), warnings (amber), and the path overlay.
  - "Save" button (disabled when `!result.ok`) → `fetch("/api/dev/labyrinth", { method: "POST", body: JSON.stringify({ id, piece, fen, target, mover, explanation, order }) })`; on `{ok:true}` show a "saved → reload /exercises" toast.
  - A read-only list of existing generated labyrinths for the current piece (import `GENERATED_LABYRINTHS`) with their `order`, so the author picks a non-colliding order.

- [ ] **Step 2: Verify** — `pnpm -C <repo>/apps/web exec tsc --noEmit` clean; run the dev server, open `/dev/labyrinth-builder`, build a rook a1→a8 lab, confirm optimal shows `1`, Save, then open `/exercises` rook labyrinths and confirm it appears after the hand-authored ones. Screenshot at 390px.

- [ ] **Step 3: Commit** `feat(builder): /dev/labyrinth-builder editor page`.

---

## Task C: full suite + seed file + docs

- [ ] **Step 1:** `pnpm -C <repo>/apps/web exec tsc --noEmit` + `pnpm -C <repo>/apps/web exec vitest run` — all green.
- [ ] **Step 2:** Create `apps/web/content/labyrinths.json` = `[]` (committed empty seed) so the API/import have a file to read.
- [ ] **Step 3:** Add to `apps/web/content/README.md`: the Builder workflow (open `/dev/labyrinth-builder`, author, Save → commits `labyrinths.json` + the regenerated `puzzles.generated.ts`).
- [ ] **Step 4: Commit** `chore(content): seed labyrinths.json + builder authoring docs`.

---

## Self-review notes (author)
- **Spec coverage:** flat grid (B5 task B5 / B3), path overlay (B1/B3), shortcut warning (B2/B3), dev API write+regenerate+404 (B4), augment+order (A5-delta/A6, B6 reorder-safe), written↔board (B2/B5), explicit mover on export (B5/state). All covered.
- **Type consistency:** `LabyrinthRecord` declared once (in `store.ts` or `import-puzzles.ts`, imported by the other); `PuzzleInput`/`MappedPuzzle` from the FEN spec; `computeExerciseBfsPath` signature matches B1 + B3 usage.
- **Implementer notes:** pick a genuinely-unsolvable fixture in B1 Step 1; confirm `process.cwd()` resolves to `apps/web` for the route's `content/` path (Next dev runs from the app dir) — if not, resolve from a known root.
- **Out of scope:** auto-invented labyrinths, DB, prod editing, ES copy, backfilling the 18.
