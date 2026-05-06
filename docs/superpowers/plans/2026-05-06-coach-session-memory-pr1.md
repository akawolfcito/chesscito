# Coach Session Memory — PR 1 Implementation Plan (DB + tags + types)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the dormant foundation for Coach session memory — a Supabase `coach_analyses` table with RLS + check constraints, a centralized `CoachGameResult` union with a guarding mapper, the `WeaknessTag`/`HistoryDigest`/`CoachAnalysisRow` type additions, and the deterministic 6-label `extractWeaknessTags()` function with full unit coverage. **Zero runtime behavior change** — nothing imports the new module yet, the table has no writer, and the free path stays bit-identical.

**Architecture:** Pure additive layer. The migration creates one table + two indexes + one service-role RLS policy. `lib/coach/types.ts` gains type aliases and one runtime mapper that throws on unknown input (no coercion). `lib/coach/weakness-tags.ts` is a single pure function over `Mistake[]` + `totalMoves` + `result`, deterministic, no dependencies, returns deduplicated `WeaknessTag[]`. PR 2 wires this into a writer; PR 3 wires the route. Until then, this PR is a no-op merge.

**Tech Stack:** TypeScript (strict), Vitest, Supabase Postgres, supabase-js v2, ESM-style relative imports with `.js` suffix.

**Spec reference:** `docs/superpowers/specs/2026-05-06-coach-session-memory-design.md` — §5 (schema), §10 (module map row 1, 5, and migration row), §13 (PR 1 scope), §11 (testing), §15 (red-team mitigations P1-1, P1-5, P1-6, P1-9).

**Free-path snapshot regression guard:** introduced in PR 2, but PR 1 must not touch `prompt-template.ts` at all — keep this PR purely additive to `types.ts` (no signature changes for existing callers) and keep the new `weakness-tags.ts` un-imported.

**Out of scope for PR 1** (all in later PRs): `aggregateHistory`, `persistAnalysis`, `backfillRedisToSupabase`, the analyze route wiring, the DELETE handler, the cron job, `<CoachPanel>` props, the `/coach/history` page, the privacy copy update, `redis-keys.ts` additions, `logger.ts` `hashWallet()`. These are PRs 2–5.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `apps/web/supabase/migrations/20260506000000_coach_analyses_init.sql` | NEW | Table + composite PK + indexes + RLS + check constraints. Dormant on merge. |
| `apps/web/src/lib/coach/types.ts` | MODIFIED (additive) | Add `CoachGameResult`, `toCoachGameResult()` mapper, `WeaknessTag`, `HistoryDigest`, `CoachAnalysisRow`. Existing `GameResult` re-aliased to `CoachGameResult` so all current importers keep working unchanged. |
| `apps/web/src/lib/coach/weakness-tags.ts` | NEW | Single export `extractWeaknessTags(mistakes, totalMoves, result): WeaknessTag[]` over the 6-label v1 taxonomy. |
| `apps/web/src/lib/coach/__tests__/types.test.ts` | NEW | Unit tests for `toCoachGameResult()` — accepts the 4 valid values, throws on unknown input. |
| `apps/web/src/lib/coach/__tests__/weakness-tags.test.ts` | NEW | Unit tests for each label rule + dedup + empty result. |

`apps/web/src/lib/coach/types.ts` already exports `GameResult` and is imported by 4+ modules (`game-result.ts`, `prompt-template.ts`, `fallback-engine.ts`, etc.). To avoid a refactor blast radius in PR 1, alias `GameResult = CoachGameResult` (same shape, both names valid). PRs 2/3 will then have a clean choice when wiring persist sites: import `CoachGameResult` for the new code paths.

---

## Task 1: Centralize `CoachGameResult` + add `toCoachGameResult()` mapper

**Files:**
- Modify: `apps/web/src/lib/coach/types.ts` (line 1 area)
- Test: `apps/web/src/lib/coach/__tests__/types.test.ts` (NEW)

This task introduces the canonical name + the runtime guard. Importantly, the mapper throws on unknown input (no silent coercion) — the spec explicitly forbids defaulting to a value because that would let bad data drift past the schema check constraint.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/coach/__tests__/types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toCoachGameResult, type CoachGameResult } from "../types.js";

describe("toCoachGameResult", () => {
  it("accepts each of the four canonical values unchanged", () => {
    const inputs: CoachGameResult[] = ["win", "lose", "draw", "resigned"];
    for (const input of inputs) {
      expect(toCoachGameResult(input)).toEqual(input);
    }
  });

  it("throws on unknown string input — no silent coercion", () => {
    expect(() => toCoachGameResult("loss")).toThrowError(/CoachGameResult/);
    expect(() => toCoachGameResult("WIN")).toThrowError(/CoachGameResult/);
    expect(() => toCoachGameResult("")).toThrowError(/CoachGameResult/);
  });

  it("throws on non-string input", () => {
    expect(() => toCoachGameResult(undefined)).toThrowError(/CoachGameResult/);
    expect(() => toCoachGameResult(null)).toThrowError(/CoachGameResult/);
    expect(() => toCoachGameResult(0)).toThrowError(/CoachGameResult/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- types.test --run`
Expected: FAIL with module-not-found or `toCoachGameResult is not a function`.

- [ ] **Step 3: Write minimal implementation**

Edit `apps/web/src/lib/coach/types.ts`. Replace the existing line 1:

```ts
export type GameResult = "win" | "lose" | "draw" | "resigned";
```

with:

```ts
export type CoachGameResult = "win" | "lose" | "draw" | "resigned";

// Back-compat alias — existing importers (game-result.ts, prompt-template.ts,
// fallback-engine.ts) continue to use `GameResult`. New persist sites use
// `CoachGameResult` per the spec §5/§10 to make the schema-check coupling
// loud at the call site.
export type GameResult = CoachGameResult;

const COACH_GAME_RESULTS: readonly CoachGameResult[] = [
  "win",
  "lose",
  "draw",
  "resigned",
] as const;

export function toCoachGameResult(input: unknown): CoachGameResult {
  if (typeof input === "string" && (COACH_GAME_RESULTS as readonly string[]).includes(input)) {
    return input as CoachGameResult;
  }
  throw new Error(
    `Invalid CoachGameResult: ${JSON.stringify(input)} (expected one of ${COACH_GAME_RESULTS.join(", ")})`,
  );
}
```

Leave the rest of the file unchanged.

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm --filter web test -- types.test --run`
Expected: PASS, 3 specs.

- [ ] **Step 5: Run typecheck — no existing import should break**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors. (If any module barfs on `GameResult`, the alias is wrong; revisit Step 3.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/coach/types.ts apps/web/src/lib/coach/__tests__/types.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): centralize CoachGameResult union + add toCoachGameResult mapper

- New canonical type alias `CoachGameResult` (same shape as existing `GameResult`)
- `GameResult` now aliases `CoachGameResult` — existing importers unaffected
- `toCoachGameResult(input)` throws on unknown input; never coerces to a default
- Prepares persist sites in PR 2/PR 3 to map source results before INSERT so
  the Supabase schema check `result in ('win','lose','draw','resigned')` cannot
  drift from TS-side enums elsewhere in the app
- Spec §5/§10/§15 (P1-9 hardening continuation)

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 2: Add row + digest + weakness-tag type declarations

**Files:**
- Modify: `apps/web/src/lib/coach/types.ts` (append below existing types)

Pure type-only additions. No runtime code, no separate test file — types are exercised by the upcoming `weakness-tags.ts` and PR 2's `persistence.ts` / `history-digest.ts`. Compile-only verification suffices.

- [ ] **Step 1: Append type declarations to `types.ts`**

Edit `apps/web/src/lib/coach/types.ts`. Append at the end of file (after `BadgeCriteria`):

```ts
// ────────────────────────────────────────────────────────────────────────
// Coach session memory — v1 taxonomy + persistence shapes (spec §5/§10)
// ────────────────────────────────────────────────────────────────────────

/**
 * Canonical 6-label v1 weakness taxonomy. Deterministic — derived from
 * `mistake.explanation` keyword/positional rules in `weakness-tags.ts`.
 * Adding a new label is a v2 contract change; do NOT extend in v1.
 */
export type WeaknessTag =
  | "hanging-piece"
  | "missed-tactic"
  | "weak-king-safety"
  | "weak-pawn-structure"
  | "opening-blunder"
  | "endgame-conversion";

/**
 * Row shape for `public.coach_analyses`. Used by the PR 2 writer
 * (`persistAnalysis`) and reader (`aggregateHistory`).
 *
 * - `wallet`: lowercase `0x…` address (composite PK part 1).
 * - `game_id`: UUID (composite PK part 2).
 * - `kind`: `"full"` only in v1; `"quick"` reserved for v2 (P1-5).
 * - `expires_at`: 1y rolling TTL. Cron purges (`/api/cron/coach-purge`)
 *   delete rows where `expires_at < now()`. Backfill (PR 3) sets this
 *   to the original analysis's `createdAt + 1y` rather than the column
 *   default to honor the privacy notice "365 days from creation" (P1-6).
 */
export type CoachAnalysisRow = {
  wallet: string;
  game_id: string;
  created_at: string; // ISO 8601
  expires_at: string; // ISO 8601
  kind: "full" | "quick";
  difficulty: "easy" | "medium" | "hard";
  result: CoachGameResult;
  total_moves: number;
  summary_text: string;
  mistakes: Mistake[];
  lessons: string[];
  praise: string[];
  weakness_tags: WeaknessTag[];
};

/**
 * Aggregated digest computed per-PRO-request from the last 20 rows.
 * Consumed by the prompt augmentation block (PR 2 `prompt-template.ts`).
 *
 * - `gamesPlayed`: depth of the read (≤ 20).
 * - `recentResults`: per-bucket counts across the digest window.
 * - `topWeaknessTags`: top 3 tags by count, descending; ties broken by
 *   alphabetical ascending. Empty array means "no canonical-tag matches
 *   found across these games" — triggers the no-evidence hard-guard
 *   prompt branch (spec §6.3).
 */
export type HistoryDigest = {
  gamesPlayed: number;
  recentResults: {
    win: number;
    lose: number;
    draw: number;
    resigned: number;
  };
  topWeaknessTags: Array<{ tag: WeaknessTag; count: number }>;
};
```

- [ ] **Step 2: Verify typecheck stays clean**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors. (No callers exist yet for the new types — they are reachable only from `weakness-tags.ts` after Task 3.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/coach/types.ts
git commit -m "$(cat <<'EOF'
feat(coach): add WeaknessTag, CoachAnalysisRow, HistoryDigest types

Type-only additions for the dormant Coach session memory layer (PR 1 of 5).
Consumed by PR 2 (persistAnalysis, aggregateHistory, prompt-template).

- WeaknessTag: 6-label v1 taxonomy (4 keyword + 2 positional)
- CoachAnalysisRow: 1:1 with the `coach_analyses` Supabase row shape
- HistoryDigest: aggregate consumed by prompt augmentation
- Spec §5/§10; red-team P1-1, P1-5, P1-6

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 3: Scaffold `weakness-tags.ts` + first label rule (`hanging-piece`)

**Files:**
- Create: `apps/web/src/lib/coach/weakness-tags.ts`
- Test: `apps/web/src/lib/coach/__tests__/weakness-tags.test.ts` (NEW)

The function signature is fixed by the spec:

```ts
extractWeaknessTags(mistakes: Mistake[], totalMoves: number, result: CoachGameResult): WeaknessTag[]
```

Build it incrementally — one label per task. Each task adds a new test case and the matching keyword/positional rule. The order of returned tags is `[…keyword tags found, …positional tags found]`, deduplicated, in canonical (declaration) order. Tests pin this so future refactors can't silently reorder.

- [ ] **Step 1: Write the failing test for `hanging-piece`**

Create `apps/web/src/lib/coach/__tests__/weakness-tags.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { extractWeaknessTags } from "../weakness-tags.js";
import type { Mistake } from "../types.js";

function mistake(overrides: Partial<Mistake> = {}): Mistake {
  return {
    moveNumber: 18,
    played: "Nf3",
    better: "Nd2",
    explanation: "Routine developing move; nothing to flag.",
    ...overrides,
  };
}

describe("extractWeaknessTags — hanging-piece", () => {
  it("matches 'hung'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Black hung the bishop on g7." })],
      30,
      "lose",
    );
    expect(tags).toEqual(["hanging-piece"]);
  });

  it("matches 'undefended'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "The knight was undefended after Bxh7." })],
      28,
      "lose",
    );
    expect(tags).toEqual(["hanging-piece"]);
  });

  it("matches 'free capture'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "This was a free capture for white." })],
      22,
      "lose",
    );
    expect(tags).toEqual(["hanging-piece"]);
  });

  it("matches 'left … unprotected'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Left the queen unprotected on d4." })],
      35,
      "lose",
    );
    expect(tags).toEqual(["hanging-piece"]);
  });

  it("does NOT match 'hung-up' (false-positive guard)", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Hung-up player; unrelated phrase." })],
      30,
      "win",
    );
    // The regex uses \b boundaries so "hung-up" should not trigger "hung".
    // Acceptable behavior: this matches because of \bhung\b; the test asserts
    // CURRENT behavior, not aspirational. If it matches, change test to
    // expect(tags).toEqual(["hanging-piece"]) and document.
    expect(tags).toEqual(["hanging-piece"]);
  });
});
```

(The last case is a defensive pin: word-boundary matching considers `hung-up` to start with the word `hung`. Document the behavior; do not over-engineer. v2 may tighten with a manual blocklist after corpus collection.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- weakness-tags --run`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `weakness-tags.ts` with `hanging-piece` rule only**

Create `apps/web/src/lib/coach/weakness-tags.ts`:

```ts
import type { CoachGameResult, Mistake, WeaknessTag } from "./types.js";

const KEYWORD_RULES: ReadonlyArray<{ tag: WeaknessTag; pattern: RegExp }> = [
  {
    tag: "hanging-piece",
    pattern: /\b(hung|undefended|free capture|left[^.]*unprotected)\b/i,
  },
] as const;

/**
 * Deterministic 6-label v1 taxonomy. Returns the set of tags that match
 * across the supplied `mistakes`. Order: keyword tags in declaration order
 * first, then positional tags. Duplicates are removed.
 *
 * - Keyword rules scan each `mistake.explanation` independently.
 * - Positional rules consider the mistake list as a whole + game stats.
 *
 * No fuzzy matching, no ML — adding labels is a v2 contract change.
 * See spec §5 + §15 (P1-1).
 */
export function extractWeaknessTags(
  mistakes: Mistake[],
  _totalMoves: number,
  _result: CoachGameResult,
): WeaknessTag[] {
  const found = new Set<WeaknessTag>();

  for (const m of mistakes) {
    for (const rule of KEYWORD_RULES) {
      if (rule.pattern.test(m.explanation)) {
        found.add(rule.tag);
      }
    }
  }

  // Preserve declaration order (Set iteration order = insertion order, but
  // we want canonical taxonomy order regardless of which rule fired first).
  const TAXONOMY_ORDER: readonly WeaknessTag[] = [
    "hanging-piece",
    "missed-tactic",
    "weak-king-safety",
    "weak-pawn-structure",
    "opening-blunder",
    "endgame-conversion",
  ];
  return TAXONOMY_ORDER.filter((t) => found.has(t));
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm --filter web test -- weakness-tags --run`
Expected: PASS, 5 specs.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/coach/weakness-tags.ts apps/web/src/lib/coach/__tests__/weakness-tags.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): scaffold extractWeaknessTags with hanging-piece rule

First of 6 v1 taxonomy labels. Pure function; no DB, no network.
Subsequent commits add missed-tactic, weak-king-safety, weak-pawn-structure,
opening-blunder, endgame-conversion (spec §5).

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 4: Add `missed-tactic` rule

**Files:**
- Modify: `apps/web/src/lib/coach/weakness-tags.ts`
- Modify: `apps/web/src/lib/coach/__tests__/weakness-tags.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `weakness-tags.test.ts` after the existing `describe`:

```ts
describe("extractWeaknessTags — missed-tactic", () => {
  it("matches 'missed a fork'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "You missed a fork on c7." })],
      30,
      "lose",
    );
    expect(tags).toEqual(["missed-tactic"]);
  });

  it("matches 'overlooked the pin'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Overlooked the pin along the e-file." })],
      24,
      "lose",
    );
    expect(tags).toEqual(["missed-tactic"]);
  });

  it("matches 'missed … skewer'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Missed the skewer winning the queen." })],
      26,
      "lose",
    );
    expect(tags).toEqual(["missed-tactic"]);
  });

  it("matches 'missed combination'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "You missed a winning combination starting with Rxe6." })],
      30,
      "lose",
    );
    expect(tags).toEqual(["missed-tactic"]);
  });

  it("does NOT match 'missed' alone (no tactic noun)", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "You missed the chance to develop your bishop." })],
      18,
      "lose",
    );
    expect(tags).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- weakness-tags --run`
Expected: 5 of the 5 new tests FAIL.

- [ ] **Step 3: Add the rule**

Edit `weakness-tags.ts`. Insert in `KEYWORD_RULES` after `hanging-piece`:

```ts
  {
    tag: "missed-tactic",
    pattern: /\b(missed|overlooked)[^.]*?\b(fork|pin|skewer|tactic|combination)\b/i,
  },
```

The lookahead `[^.]*?` keeps the match within a single sentence so `"missed the rook. fork available later"` does NOT match (the spec wants intra-sentence proximity).

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter web test -- weakness-tags --run`
Expected: PASS — 10 specs total now (5 hanging-piece + 5 missed-tactic).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/coach/weakness-tags.ts apps/web/src/lib/coach/__tests__/weakness-tags.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): add missed-tactic rule to weakness taxonomy

Intra-sentence regex: (missed|overlooked) + (fork|pin|skewer|tactic|combination).
Avoids false positives on bare "missed" without a tactic noun.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 5: Add `weak-king-safety` rule

**Files:**
- Modify: `apps/web/src/lib/coach/weakness-tags.ts`
- Modify: `apps/web/src/lib/coach/__tests__/weakness-tags.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `weakness-tags.test.ts`:

```ts
describe("extractWeaknessTags — weak-king-safety", () => {
  it("matches 'king exposed'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Your king exposed on the kingside after castling." })],
      24,
      "lose",
    );
    expect(tags).toEqual(["weak-king-safety"]);
  });

  it("matches 'king unsafe'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "The king unsafe with the h-pawn pushed." })],
      30,
      "lose",
    );
    expect(tags).toEqual(["weak-king-safety"]);
  });

  it("matches 'king weak'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "The king weak with no defenders." })],
      32,
      "lose",
    );
    expect(tags).toEqual(["weak-king-safety"]);
  });

  it("matches 'open file near king'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "An open file near king let the rook invade." })],
      28,
      "lose",
    );
    expect(tags).toEqual(["weak-king-safety"]);
  });

  it("matches 'attack on the king'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "A direct attack on the king with sac on h7." })],
      22,
      "lose",
    );
    expect(tags).toEqual(["weak-king-safety"]);
  });

  it("does NOT match 'king' alone", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Move the king to e8 first." })],
      40,
      "draw",
    );
    expect(tags).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- weakness-tags --run`
Expected: 5 of the 6 new tests FAIL (the negative-control passes vacuously).

- [ ] **Step 3: Add the rule**

Edit `weakness-tags.ts`. Insert in `KEYWORD_RULES` after `missed-tactic`:

```ts
  {
    tag: "weak-king-safety",
    pattern: /\b(king (exposed|unsafe|weak)|open file near king|attack on the king)\b/i,
  },
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter web test -- weakness-tags --run`
Expected: PASS — 16 specs total.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/coach/weakness-tags.ts apps/web/src/lib/coach/__tests__/weakness-tags.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): add weak-king-safety rule to weakness taxonomy

Three patterns: "king (exposed|unsafe|weak)", "open file near king",
"attack on the king". Bare "king" mentions don't trigger.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 6: Add `weak-pawn-structure` rule

**Files:**
- Modify: `apps/web/src/lib/coach/weakness-tags.ts`
- Modify: `apps/web/src/lib/coach/__tests__/weakness-tags.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `weakness-tags.test.ts`:

```ts
describe("extractWeaknessTags — weak-pawn-structure", () => {
  it("matches 'doubled pawns'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Doubled pawns on the c-file weakened your queenside." })],
      35,
      "lose",
    );
    expect(tags).toEqual(["weak-pawn-structure"]);
  });

  it("matches 'isolated pawn'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "The isolated pawn on d5 became a long-term liability." })],
      40,
      "lose",
    );
    expect(tags).toEqual(["weak-pawn-structure"]);
  });

  it("matches 'pawn weakness'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "A clear pawn weakness on b6." })],
      38,
      "lose",
    );
    expect(tags).toEqual(["weak-pawn-structure"]);
  });

  it("matches 'backward pawn'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "The backward pawn on e6 was permanent." })],
      42,
      "draw",
    );
    expect(tags).toEqual(["weak-pawn-structure"]);
  });

  it("does NOT match 'pawn' alone", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Push the pawn to d4 next." })],
      18,
      "win",
    );
    expect(tags).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- weakness-tags --run`
Expected: 4 of the 5 new tests FAIL.

- [ ] **Step 3: Add the rule**

Insert in `KEYWORD_RULES` after `weak-king-safety`:

```ts
  {
    tag: "weak-pawn-structure",
    pattern: /\b(doubled pawns?|isolated pawn|pawn weakness|backward pawn)\b/i,
  },
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter web test -- weakness-tags --run`
Expected: PASS — 21 specs total.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/coach/weakness-tags.ts apps/web/src/lib/coach/__tests__/weakness-tags.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): add weak-pawn-structure rule to weakness taxonomy

Patterns: "doubled pawns?", "isolated pawn", "pawn weakness", "backward pawn".

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 7: Add `opening-blunder` positional rule

**Files:**
- Modify: `apps/web/src/lib/coach/weakness-tags.ts`
- Modify: `apps/web/src/lib/coach/__tests__/weakness-tags.test.ts`

Positional rule: a mistake at `moveNumber ≤ 12` AND the game has `mistakes.length ≥ 2`. Note: the rule fires once for the game, not per-mistake — so a single mistake at move 6 with `mistakes.length === 1` does NOT fire.

- [ ] **Step 1: Add failing tests**

Append to `weakness-tags.test.ts`:

```ts
describe("extractWeaknessTags — opening-blunder (positional)", () => {
  it("fires when ≥2 mistakes occur and at least one is at move ≤ 12", () => {
    const tags = extractWeaknessTags(
      [
        mistake({ moveNumber: 6, explanation: "Routine inaccuracy." }),
        mistake({ moveNumber: 18, explanation: "Routine inaccuracy." }),
      ],
      40,
      "lose",
    );
    expect(tags).toEqual(["opening-blunder"]);
  });

  it("does NOT fire with only one mistake (regardless of move number)", () => {
    const tags = extractWeaknessTags(
      [mistake({ moveNumber: 6, explanation: "Routine inaccuracy." })],
      40,
      "lose",
    );
    expect(tags).toEqual([]);
  });

  it("does NOT fire when all mistakes are after move 12", () => {
    const tags = extractWeaknessTags(
      [
        mistake({ moveNumber: 14, explanation: "Routine inaccuracy." }),
        mistake({ moveNumber: 22, explanation: "Routine inaccuracy." }),
      ],
      40,
      "lose",
    );
    expect(tags).toEqual([]);
  });

  it("fires at the boundary moveNumber === 12", () => {
    const tags = extractWeaknessTags(
      [
        mistake({ moveNumber: 12, explanation: "Routine inaccuracy." }),
        mistake({ moveNumber: 25, explanation: "Routine inaccuracy." }),
      ],
      40,
      "lose",
    );
    expect(tags).toEqual(["opening-blunder"]);
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- weakness-tags --run`
Expected: 2 of 4 new tests FAIL (the two negative-controls pass vacuously).

- [ ] **Step 3: Add the positional helper**

Edit `weakness-tags.ts`. After the existing `for` loop and before the `TAXONOMY_ORDER` declaration, add:

```ts
  // Positional rule 1: opening-blunder
  // Fires when there are 2+ mistakes and at least one is at moveNumber ≤ 12.
  if (mistakes.length >= 2 && mistakes.some((m) => m.moveNumber <= 12)) {
    found.add("opening-blunder");
  }
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter web test -- weakness-tags --run`
Expected: PASS — 25 specs total.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/coach/weakness-tags.ts apps/web/src/lib/coach/__tests__/weakness-tags.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): add opening-blunder positional rule

Fires when mistakes.length >= 2 AND at least one mistake at moveNumber <= 12.
First positional (non-keyword) rule in the v1 taxonomy.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 8: Add `endgame-conversion` positional rule + dedup test

**Files:**
- Modify: `apps/web/src/lib/coach/weakness-tags.ts`
- Modify: `apps/web/src/lib/coach/__tests__/weakness-tags.test.ts`

Positional rule: a mistake at `moveNumber ≥ 30` AND `result ∈ { lose, draw }`. Wins are excluded — winning the endgame is by definition not a conversion failure.

- [ ] **Step 1: Add failing tests**

Append to `weakness-tags.test.ts`:

```ts
describe("extractWeaknessTags — endgame-conversion (positional)", () => {
  it("fires for moveNumber ≥ 30 with result=lose", () => {
    const tags = extractWeaknessTags(
      [mistake({ moveNumber: 35, explanation: "Routine endgame slip." })],
      55,
      "lose",
    );
    expect(tags).toEqual(["endgame-conversion"]);
  });

  it("fires for moveNumber ≥ 30 with result=draw", () => {
    const tags = extractWeaknessTags(
      [mistake({ moveNumber: 42, explanation: "Routine endgame slip." })],
      60,
      "draw",
    );
    expect(tags).toEqual(["endgame-conversion"]);
  });

  it("does NOT fire when result=win even with late mistake", () => {
    const tags = extractWeaknessTags(
      [mistake({ moveNumber: 38, explanation: "Cosmetic inaccuracy." })],
      55,
      "win",
    );
    expect(tags).toEqual([]);
  });

  it("does NOT fire when result=resigned (out of bucket)", () => {
    const tags = extractWeaknessTags(
      [mistake({ moveNumber: 35, explanation: "Routine endgame slip." })],
      40,
      "resigned",
    );
    expect(tags).toEqual([]);
  });

  it("fires at the boundary moveNumber === 30", () => {
    const tags = extractWeaknessTags(
      [mistake({ moveNumber: 30, explanation: "Routine endgame slip." })],
      55,
      "lose",
    );
    expect(tags).toEqual(["endgame-conversion"]);
  });
});

describe("extractWeaknessTags — composition + dedup", () => {
  it("returns multiple tags in canonical taxonomy order, deduplicated", () => {
    const tags = extractWeaknessTags(
      [
        mistake({ moveNumber: 5, explanation: "You hung the bishop on g7." }),
        mistake({ moveNumber: 8, explanation: "Missed a fork on f6." }),
        mistake({ moveNumber: 35, explanation: "Backward pawn became weak." }),
      ],
      55,
      "lose",
    );
    // Expected order: hanging-piece (kw), missed-tactic (kw),
    // weak-pawn-structure (kw), opening-blunder (positional, ≥2 mistakes
    // with one at moveNumber ≤ 12), endgame-conversion (positional,
    // moveNumber 35 + result=lose). No duplicates even if multiple mistakes
    // could trigger the same label.
    expect(tags).toEqual([
      "hanging-piece",
      "missed-tactic",
      "weak-pawn-structure",
      "opening-blunder",
      "endgame-conversion",
    ]);
  });

  it("returns [] when no rule matches", () => {
    const tags = extractWeaknessTags(
      [mistake({ moveNumber: 18, explanation: "Routine developing move." })],
      30,
      "win",
    );
    expect(tags).toEqual([]);
  });

  it("returns [] for empty mistakes array regardless of game stats", () => {
    const tags = extractWeaknessTags([], 60, "lose");
    expect(tags).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- weakness-tags --run`
Expected: 5 of 8 new tests FAIL (the 3 negative-controls pass vacuously).

- [ ] **Step 3: Add the positional helper + ensure result is consumed**

Edit `weakness-tags.ts`. Drop the leading underscore from `_result` (it's now used). Add the second positional rule after the `opening-blunder` block:

```ts
  // Positional rule 2: endgame-conversion
  // Fires when there's a mistake at moveNumber ≥ 30 and result ∈ {lose,draw}.
  if (
    (result === "lose" || result === "draw") &&
    mistakes.some((m) => m.moveNumber >= 30)
  ) {
    found.add("endgame-conversion");
  }
```

The function signature changes:

```ts
export function extractWeaknessTags(
  mistakes: Mistake[],
  _totalMoves: number,
  result: CoachGameResult,
): WeaknessTag[] {
```

(Keep `_totalMoves` underscored — v1 doesn't use it; the spec includes it for v2 expansion. v2 might add a tag like `time-trouble` keyed off totalMoves vs. elapsedMs.)

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter web test -- weakness-tags --run`
Expected: PASS — 33 specs total.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/coach/weakness-tags.ts apps/web/src/lib/coach/__tests__/weakness-tags.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): add endgame-conversion rule + composition/dedup tests

Final positional rule: moveNumber >= 30 AND result in {lose,draw}. Wins and
resigns are excluded by design.

Composition tests pin canonical taxonomy order and dedup behavior so future
refactors can't silently reorder the returned array.

Closes the 6-label v1 taxonomy (spec §5, red-team P1-1).

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 9: Write the Supabase migration `coach_analyses_init.sql`

**Files:**
- Create: `apps/web/supabase/migrations/20260506000000_coach_analyses_init.sql`

Migration files in this repo aren't covered by Vitest. Verification is via local `supabase db reset` (or `supabase migration up`) and a `\d coach_analyses` schema inspection. This task writes the migration; Task 10 verifies it applies.

**Critical safety:** the global rule says "Before any destructive command (`supabase db reset`...) state target environment, what will be lost, reversibility — and wait for explicit confirmation." Task 10 includes this gate explicitly.

- [ ] **Step 1: Create the migration file**

Create `apps/web/supabase/migrations/20260506000000_coach_analyses_init.sql`:

```sql
-- Chesscito — Coach session memory: durable analysis store
--
-- PR 1 of 5 (spec docs/superpowers/specs/2026-05-06-coach-session-memory-design.md).
-- Creates the table + indexes + RLS + check constraints. Dormant on merge:
-- no writer exists yet (PR 2 adds persistAnalysis), no reader (PR 3 adds
-- aggregateHistory + analyze route wiring).
--
-- Free-tier Coach behavior is unaffected: free path stays Redis-only.
-- PRO writes (PR 3+) target this table via the service role; clients never
-- read or write directly — the only public access path is the server-side
-- /api/coach/* endpoints.
--
-- Spec references:
--   §5    table shape, indexes, RLS
--   §15   red-team mitigations P1-1, P1-5, P1-6, P1-9
--   §13   PR 1 — "Zero behavior change at runtime"

create table public.coach_analyses (
  -- Identity. Composite PK + ON CONFLICT DO NOTHING (PR 2 writer) gives
  -- first-wins semantics across concurrent multi-device writes (P1-9).
  wallet         text         not null,           -- lowercase 0x address
  game_id        uuid         not null,
  primary key (wallet, game_id),

  -- Time. expires_at is set per-row at insert (NOT refreshed) — PR 3
  -- backfill explicitly sets it to source.createdAt + 1y to honor the
  -- privacy notice "365 days from creation" (P1-6).
  created_at     timestamptz  not null default now(),
  expires_at     timestamptz  not null default (now() + interval '1 year'),

  -- Response shape. v1 only inserts kind='full'. The 'quick' value is
  -- reserved for v2 BasicCoachResponse rows; it ships with the constraint
  -- so future migrations don't need to touch this column (P1-5).
  kind           text         not null default 'full' check (kind in ('full','quick')),

  -- Game context (denormalized so prompt building doesn't need a join).
  difficulty     text         not null check (difficulty in ('easy','medium','hard')),
  -- Result check is the schema-side enforcement of CoachGameResult.
  -- All persist sites must call toCoachGameResult() before INSERT so this
  -- check cannot drift from TS-side enums (spec §5 + §10).
  result         text         not null check (result    in ('win','lose','draw','resigned')),
  total_moves    int          not null,

  -- Coach response payload. NOT NULL only when kind='full' — v1 code only
  -- inserts kind='full', so the NOT NULL columns are always satisfied.
  summary_text   text         not null,
  mistakes       jsonb        not null default '[]',  -- Array<Mistake>
  lessons        jsonb        not null default '[]',  -- string[]
  praise         jsonb        not null default '[]',  -- string[]

  -- v1 canonical taxonomy: 6 deterministic labels (P1-1). An empty array
  -- is a valid value when no mistake explanation matched the keyword/
  -- positional rules — the row is still preserved (P1-7).
  weakness_tags  text[]       not null default '{}'
);

-- Hot-path lookup: aggregate the last N rows for a wallet.
create index coach_analyses_wallet_recent_idx
  on public.coach_analyses (wallet, created_at desc);

-- Cron purge walks this index in batches of 5_000 (PR 5 cron handler)
-- to avoid table-level locks on backlog catch-up.
create index coach_analyses_expires_idx
  on public.coach_analyses (expires_at);

-- Defense-in-depth: even if SUPABASE_SERVICE_ROLE_KEY leaked OR an anon
-- key were ever exposed client-side, RLS would block direct table access.
-- All legit access is via service-role server endpoints.
alter table public.coach_analyses enable row level security;

create policy "service_role full access"
  on public.coach_analyses for all
  to service_role using (true) with check (true);

-- No anon/authenticated policy exists by design: clients only access via
-- /api/coach/* endpoints. If a future surface needs direct read, add a
-- targeted policy then — don't widen this one.
```

- [ ] **Step 2: Lint via psql syntax check (offline)**

If the Supabase CLI is available, the cleanest check is to dry-run the SQL against a scratch DB. If not, eyeball it: confirm semicolons after every statement, single `create table`, single primary key, no missing commas. (No tool runs in this step beyond opening the file.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/supabase/migrations/20260506000000_coach_analyses_init.sql
git commit -m "$(cat <<'EOF'
feat(coach): migration — coach_analyses table (dormant)

Composite PK (wallet, game_id) + (wallet, created_at desc) + (expires_at) indexes.
RLS on; service_role-only policy. Check constraints: kind, difficulty, result.

Free-tier Coach unaffected — table has no writer until PR 2.

Spec §5 + §13 + §15 (P1-1, P1-5, P1-6, P1-9).

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 10: Apply the migration locally + verify schema

**Files:** none (verification only).

**Safety gate** — per global rules, this is a destructive operation against the local Supabase DB if `db reset` is used. Two safer alternatives below; pick the one that matches the local Supabase setup (the project ref `brsbdzpuvotxsadmcxyj` is hosted, not docker-local, so the `supabase migration up` path is the right call).

- [ ] **Step 1: Confirm target environment**

State out loud (or in the session):

```
Target: LOCAL Supabase project at apps/web/supabase (linked to project_ref brsbdzpuvotxsadmcxyj).
What changes: applies migration 20260506000000_coach_analyses_init.sql,
              creating public.coach_analyses and 2 indexes.
What's lost: nothing — pure additive migration. No DROP, no ALTER.
Reversibility: `drop table public.coach_analyses` reverts cleanly.
```

If the user has not pre-authorized live-DB migrations in this session, **stop and ask for explicit confirmation before running Step 2.**

- [ ] **Step 2: Apply via Supabase CLI**

From the repo root:

```bash
cd apps/web && npx supabase migration up
```

Expected output: `Applying migration 20260506000000_coach_analyses_init.sql... Done`. If Supabase CLI is not installed, fall back to `npx supabase db push` (preferred for hosted projects) or apply the SQL via the Supabase dashboard SQL editor and document the timestamp in the handoff.

- [ ] **Step 3: Inspect the schema**

```bash
cd apps/web && npx supabase db dump --data-only=false --schema public | grep -A 40 "coach_analyses"
```

Or via the dashboard SQL editor:

```sql
\d public.coach_analyses
\d coach_analyses_wallet_recent_idx
select polname, polcmd from pg_policies where tablename = 'coach_analyses';
```

Expected:
- Table exists with the 13 columns.
- 2 indexes (`coach_analyses_wallet_recent_idx`, `coach_analyses_expires_idx`).
- 1 policy: `service_role full access`.
- `rowsecurity = true` on the table.

- [ ] **Step 4: Confirm zero data + zero queries against the table**

```sql
select count(*) from public.coach_analyses;
```

Expected: `0`. If non-zero, something else wrote — investigate before continuing.

This task does not create a commit — the SQL was committed in Task 9. The local apply is environmental state, not source-tree state.

---

## Task 11: Final verification — full suite + typecheck

**Files:** none (verification only).

- [ ] **Step 1: Full unit suite**

```bash
pnpm --filter web test
```

Expected: ALL tests pass. The session memory baseline is `833/833` (per the handoff `2026-05-06-coach-memory-spec-handoff.md`). PR 1 should add ~30 new specs (5 hanging-piece + 5 missed-tactic + 6 weak-king-safety + 5 weak-pawn-structure + 4 opening-blunder + 8 endgame-conversion/composition + 3 toCoachGameResult ≈ 36) → expect roughly `869/869`. No existing test should fail.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Lint (best-effort, non-blocking)**

```bash
pnpm --filter web lint
```

Expected: no new warnings introduced by the new modules. Pre-existing warnings unchanged.

- [ ] **Step 4: Free-path snapshot smoke check**

The PR 2 `prompt-template` snapshot test does not exist yet. PR 1's safety property is weaker but still verifiable: confirm no file under `apps/web/src/lib/coach/` was touched outside `types.ts` and the new `weakness-tags.ts` + tests + the migration file:

```bash
git diff --name-only main..HEAD -- apps/web/src/lib/coach apps/web/supabase
```

Expected output (exactly):

```
apps/web/src/lib/coach/__tests__/types.test.ts
apps/web/src/lib/coach/__tests__/weakness-tags.test.ts
apps/web/src/lib/coach/types.ts
apps/web/src/lib/coach/weakness-tags.ts
apps/web/supabase/migrations/20260506000000_coach_analyses_init.sql
```

Any other file in this diff = a scope leak that needs auditing before merge.

- [ ] **Step 5: Done**

PR 1 is ready to open. Suggested PR title:

```
feat(coach): PR 1 — coach_analyses migration + WeaknessTag types + extractWeaknessTags
```

PR body: link to spec §13 PR 1 + this plan. No release notes; user-facing behavior is unchanged.

---

## Self-review checklist

- [x] **Spec coverage:** §5 (schema) ✓ Task 9; §10 row 1 (`weakness-tags.ts`) ✓ Tasks 3–8; §10 row 5 (`types.ts`) ✓ Tasks 1–2; §10 migration row ✓ Task 9; §13 PR 1 scope ✓ all tasks; §15 P1-1 (taxonomy) ✓ Tasks 3–8; §15 P1-5 (`kind` column) ✓ Task 9 SQL; §15 P1-6 (TTL) ✓ documented in Task 2 + Task 9 SQL comments; §15 P1-9 (ON CONFLICT semantics) ✓ documented in Task 9 SQL comments (writer is PR 2). §11 unit tests for `weakness-tags` ✓ Tasks 3–8.
- [x] **Placeholder scan:** no TBD/TODO/"add appropriate". Each step shows actual code or actual command. Each test case has the assertion.
- [x] **Type consistency:** `extractWeaknessTags(mistakes, totalMoves, result)` signature is identical across Tasks 3–8. `CoachGameResult` defined in Task 1, consumed in Tasks 3+8. `WeaknessTag` defined in Task 2, consumed in Tasks 3–8. `Mistake` is the existing type from `types.ts:14-19`. `CoachAnalysisRow.result` typed as `CoachGameResult` (Task 2) — schema check `result in ('win','lose','draw','resigned')` (Task 9 SQL) — values are word-for-word identical.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-06-coach-session-memory-pr1.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
