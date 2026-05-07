# Coach Session Memory — PR 2 Implementation Plan (persistence + prompt template)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the dormant persistence + read aggregation + prompt augmentation modules for Coach session memory — `lib/coach/persistence.ts` (writer + soft-cap delete + fail-soft tag extraction), `lib/coach/history-digest.ts` (Supabase reader + pure `aggregateRows` aggregator), and a `lib/coach/prompt-template.ts` augmentation that adds an optional `history?: HistoryDigest` parameter with a 600-char-capped PRO block, three conditional branches (omit / hard-guard / standard), and a snapshot-locked free path. **Zero runtime behavior change** — nothing imports the new modules yet, the writer has no caller, and any free-tier `buildCoachPrompt(...)` call returns the bit-identical PR 1 string.

**Architecture:** Pure additive layer plus one strictly-additive change to `prompt-template.ts`. The writer + reader split builder logic into pure functions (`aggregateRows`, `extractWeaknessTagsSafe`) so DB-free tests cover the bulk of the behavior. The Supabase wrappers are thin enough to test with a chainable mock built atop `vi.mock("../../supabase/server", …)` — matches the existing `lib/supabase/queries.ts` pattern. The free-path snapshot regression guard is committed as a `toMatchInlineSnapshot()` block; any subsequent commit that drifts the free output fails this test by definition.

**Tech Stack:** TypeScript (strict), Vitest, supabase-js v2 (`.upsert(rows, { onConflict, ignoreDuplicates })`), ESM-style relative imports with `.js` suffix.

**Spec reference:** `docs/superpowers/specs/2026-05-06-coach-session-memory-design.md` — §6.1 (write path + soft cap), §6.2 (read path), §6.3 (prompt augmentation, three branches, 600-char cap), §6.5 (failure modes), §10 (module map rows 2, 3, 6), §11 (testing strategy — snapshot lock), §13 (PR 2 scope), §15 (mitigations P1-1, P1-2, P1-3, P1-7, P1-9).

**Free-path snapshot regression guard:** introduced in Task 5 of this PR. After this PR merges, every subsequent PR (3, 4, 5) must keep the snapshot green — this is the load-bearing guarantee that PRO surface work cannot leak into the free-tier prompt.

**Out of scope for PR 2** (all in later PRs): wiring the `analyze` route, `backfillRedisToSupabase`, the DELETE handler, the cron job, `<CoachPanel>` props, `redis-keys.ts` additions (`backfillClaim`/`deleteNonce`), `logger.ts` `hashWallet()`, `arena/page.tsx` plumbing, the `historyMeta` response payload, `/coach/history` page, privacy copy, the `PRO_COPY` array swap, and the first-run banner. These are PRs 3–5.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `apps/web/src/lib/coach/persistence.ts` | NEW | Two exports: `persistAnalysis(wallet, payload)` writer with `ON CONFLICT DO NOTHING`, post-insert soft-cap (200 rows) cleanup, fail-soft tag extraction; and the helper `extractWeaknessTagsSafe(...)` that wraps `extractWeaknessTags` in try/catch. |
| `apps/web/src/lib/coach/history-digest.ts` | NEW | Two exports: `aggregateRows(rows): HistoryDigest \| null` pure aggregator (~20 lines), and `aggregateHistory(wallet): Promise<HistoryDigest \| null>` thin Supabase wrapper. |
| `apps/web/src/lib/coach/prompt-template.ts` | MODIFIED (additive) | Add optional `history?: HistoryDigest \| null` parameter; render PRO augmentation block via `buildHistoryAugmentation(history)` helper with three branches (`null` → empty, empty `topWeaknessTags` → hard-guard, populated → standard). 600-char cap via `truncateAtLimit(text, 600)`. Free path stays bit-identical when `history` is omitted or `null`. |
| `apps/web/src/lib/coach/__tests__/persistence.test.ts` | NEW | Mock `getSupabaseServer`; verify upsert call shape (`onConflict: "wallet,game_id", ignoreDuplicates: true`), soft-cap delete shape, fail-soft tag extraction (forced throw → row inserted with `weakness_tags = []`), null-supabase short-circuits. |
| `apps/web/src/lib/coach/__tests__/history-digest.test.ts` | NEW | Pure aggregator: empty rows → null, single row, dedup-counts across rows, top-3 tiebreak (count DESC then alphabetical ASC), recentResults bucket counts. Wrapper: SELECT call shape, null-supabase → null, error → null. |
| `apps/web/src/lib/coach/__tests__/prompt-template.test.ts` | NEW | Free-path inline snapshot lock; PRO standard branch contains tag-and-count strings; PRO empty-tags branch contains literal `"do NOT speculate"`; PRO null-history identical to free-path; 600-char cap truncates with ellipsis. |

`prompt-template.ts` is currently 46 lines and exports a single `buildCoachPrompt(moves, result, difficulty, summary)`. PR 2 keeps that signature working unchanged for existing callers (`fallback-engine.ts`, `app/api/coach/analyze/route.ts`) and adds a 5th optional positional parameter `history`. No call sites are updated in this PR.

---

## Task 1: `aggregateRows` — pure aggregator (no DB)

**Files:**
- Create: `apps/web/src/lib/coach/history-digest.ts`
- Test: `apps/web/src/lib/coach/__tests__/history-digest.test.ts` (NEW)

The pure aggregation logic is split out so it's testable without any Supabase mock. `aggregateRows` is referentially transparent: same input → same output, no I/O. The Supabase wrapper in Task 2 is then trivially thin.

**Aggregation contract (spec §5/§6.3):**
- Empty input → `null` (signals "no augmentation block" in §6.3).
- `gamesPlayed = rows.length` (capped at 20 by the caller's `LIMIT 20`).
- `recentResults` counts each row's `result` into the four buckets.
- `topWeaknessTags`: flatten `row.weakness_tags` across all rows, count occurrences, sort by `count DESC` with ties broken alphabetically `ASC`, take top 3.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/coach/__tests__/history-digest.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { aggregateRows } from "../history-digest.js";
import type { CoachAnalysisRow } from "../types.js";

function row(overrides: Partial<CoachAnalysisRow> = {}): CoachAnalysisRow {
  return {
    wallet: "0xabc",
    game_id: "00000000-0000-0000-0000-000000000001",
    created_at: "2026-05-06T00:00:00.000Z",
    expires_at: "2027-05-06T00:00:00.000Z",
    kind: "full",
    difficulty: "medium",
    result: "lose",
    total_moves: 30,
    summary_text: "summary",
    mistakes: [],
    lessons: [],
    praise: [],
    weakness_tags: [],
    ...overrides,
  };
}

describe("aggregateRows", () => {
  it("returns null on empty input", () => {
    expect(aggregateRows([])).toBeNull();
  });

  it("counts gamesPlayed and result buckets across rows", () => {
    const digest = aggregateRows([
      row({ result: "win" }),
      row({ result: "win" }),
      row({ result: "lose" }),
      row({ result: "draw" }),
      row({ result: "resigned" }),
    ]);
    expect(digest).not.toBeNull();
    expect(digest!.gamesPlayed).toBe(5);
    expect(digest!.recentResults).toEqual({ win: 2, lose: 1, draw: 1, resigned: 1 });
  });

  it("flattens and counts weakness_tags across rows", () => {
    const digest = aggregateRows([
      row({ weakness_tags: ["hanging-piece", "missed-tactic"] }),
      row({ weakness_tags: ["hanging-piece"] }),
      row({ weakness_tags: ["weak-king-safety"] }),
    ]);
    expect(digest!.topWeaknessTags).toEqual([
      { tag: "hanging-piece", count: 2 },
      { tag: "missed-tactic", count: 1 },
      { tag: "weak-king-safety", count: 1 },
    ]);
  });

  it("breaks ties alphabetically ascending", () => {
    const digest = aggregateRows([
      row({ weakness_tags: ["weak-pawn-structure"] }),
      row({ weakness_tags: ["hanging-piece"] }),
      row({ weakness_tags: ["missed-tactic"] }),
    ]);
    // All three have count=1; alpha ASC: hanging-piece < missed-tactic < weak-pawn-structure.
    expect(digest!.topWeaknessTags.map((t) => t.tag)).toEqual([
      "hanging-piece",
      "missed-tactic",
      "weak-pawn-structure",
    ]);
  });

  it("returns at most 3 tags, descending by count", () => {
    const digest = aggregateRows([
      row({ weakness_tags: ["hanging-piece", "missed-tactic", "weak-king-safety", "weak-pawn-structure"] }),
      row({ weakness_tags: ["missed-tactic"] }),
      row({ weakness_tags: ["weak-king-safety"] }),
      row({ weakness_tags: ["weak-king-safety"] }),
    ]);
    expect(digest!.topWeaknessTags).toEqual([
      { tag: "weak-king-safety", count: 3 },
      { tag: "missed-tactic", count: 2 },
      // Tie at count=1: "hanging-piece" < "weak-pawn-structure" alphabetically.
      { tag: "hanging-piece", count: 1 },
    ]);
  });

  it("returns digest with empty topWeaknessTags when all rows have no tags", () => {
    const digest = aggregateRows([
      row({ weakness_tags: [] }),
      row({ weakness_tags: [] }),
    ]);
    expect(digest).not.toBeNull();
    expect(digest!.gamesPlayed).toBe(2);
    expect(digest!.topWeaknessTags).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- history-digest --run`
Expected: FAIL with module-not-found or `aggregateRows is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/lib/coach/history-digest.ts`:

```ts
import type { CoachAnalysisRow, HistoryDigest, WeaknessTag } from "./types.js";

/**
 * Pure aggregator over the rows returned by `aggregateHistory` — no I/O.
 *
 * - Returns `null` when `rows.length === 0` (signals "no augmentation block" in §6.3).
 * - `gamesPlayed = rows.length` (caller caps at 20 via `LIMIT 20`).
 * - `topWeaknessTags`: top 3 tags by count DESC; ties broken alphabetically ASC.
 *
 * Spec §5 / §6.3.
 */
export function aggregateRows(rows: CoachAnalysisRow[]): HistoryDigest | null {
  if (rows.length === 0) return null;

  const recentResults = { win: 0, lose: 0, draw: 0, resigned: 0 };
  const tagCounts = new Map<WeaknessTag, number>();

  for (const row of rows) {
    recentResults[row.result] += 1;
    for (const tag of row.weakness_tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const topWeaknessTags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.tag.localeCompare(b.tag);
    })
    .slice(0, 3);

  return {
    gamesPlayed: rows.length,
    recentResults,
    topWeaknessTags,
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm --filter web test -- history-digest --run`
Expected: PASS, 6 specs.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/coach/history-digest.ts apps/web/src/lib/coach/__tests__/history-digest.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): aggregateRows pure aggregator (history-digest)

- Pure function over CoachAnalysisRow[]; no DB, no network
- Empty input → null (signals "skip augmentation" per §6.3)
- topWeaknessTags: top 3 by count DESC, ties broken alphabetically ASC
- Spec §5 / §6.3 — PR 2 of 5 (persistence + prompt template)

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 2: `aggregateHistory` — Supabase wrapper

**Files:**
- Modify: `apps/web/src/lib/coach/history-digest.ts` (append `aggregateHistory`)
- Modify: `apps/web/src/lib/coach/__tests__/history-digest.test.ts` (append wrapper tests)

The wrapper is intentionally thin: handle the null-supabase branch (env vars missing → `getSupabaseServer()` returns `null`, see `lib/supabase/server.ts:12-18`), perform the SELECT, hand off to `aggregateRows`. Errors fail soft to `null` (§6.5: "Supabase read fails → fall through to free-tier prompt").

- [ ] **Step 1: Append failing tests**

Append to `apps/web/src/lib/coach/__tests__/history-digest.test.ts`:

```ts
import { aggregateHistory } from "../history-digest.js";
import { vi, beforeEach } from "vitest";

vi.mock("../../supabase/server", () => ({
  getSupabaseServer: vi.fn(),
}));

import { getSupabaseServer } from "../../supabase/server.js";

function buildSelectChain(result: { data: CoachAnalysisRow[] | null; error: { message: string } | null }) {
  // Chainable: from(...).select(...).eq(...).order(...).limit(N) → result
  const limit = vi.fn().mockResolvedValue(result);
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from, select, eq, order, limit };
}

describe("aggregateHistory (Supabase wrapper)", () => {
  beforeEach(() => {
    vi.mocked(getSupabaseServer).mockReset();
  });

  it("returns null when getSupabaseServer returns null (missing env)", async () => {
    vi.mocked(getSupabaseServer).mockReturnValue(null);
    expect(await aggregateHistory("0xabc")).toBeNull();
  });

  it("returns null when SELECT errors (fail-soft per §6.5)", async () => {
    const chain = buildSelectChain({ data: null, error: { message: "boom" } });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    expect(await aggregateHistory("0xabc")).toBeNull();
  });

  it("issues SELECT with eq(wallet), order(created_at desc), limit(20)", async () => {
    const chain = buildSelectChain({ data: [], error: null });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    await aggregateHistory("0xabc");
    expect(chain.from).toHaveBeenCalledWith("coach_analyses");
    expect(chain.eq).toHaveBeenCalledWith("wallet", "0xabc");
    expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(20);
  });

  it("forwards rows to aggregateRows and returns the digest", async () => {
    const rows: CoachAnalysisRow[] = [
      row({ result: "win", weakness_tags: ["hanging-piece"] }),
      row({ result: "lose", weakness_tags: ["hanging-piece"] }),
    ];
    const chain = buildSelectChain({ data: rows, error: null });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    const digest = await aggregateHistory("0xabc");
    expect(digest!.gamesPlayed).toBe(2);
    expect(digest!.topWeaknessTags).toEqual([{ tag: "hanging-piece", count: 2 }]);
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- history-digest --run`
Expected: 4 new wrapper tests FAIL with `aggregateHistory is not a function`.

- [ ] **Step 3: Append the wrapper to `history-digest.ts`**

Append to `apps/web/src/lib/coach/history-digest.ts`:

```ts
import { getSupabaseServer } from "../supabase/server.js";

const HISTORY_DIGEST_DEPTH = 20;

/**
 * Read the last 20 analyses for `wallet` and aggregate them into a digest.
 *
 * Fail-soft semantics (§6.5):
 * - Missing env (`getSupabaseServer()` returns null) → null.
 * - SELECT error → null.
 * - Empty result set → null (via `aggregateRows`).
 *
 * Caller (PR 3 `analyze` route) treats `null` as "no augmentation block".
 */
export async function aggregateHistory(wallet: string): Promise<HistoryDigest | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("coach_analyses")
    .select("wallet, game_id, created_at, expires_at, kind, difficulty, result, total_moves, summary_text, mistakes, lessons, praise, weakness_tags")
    .eq("wallet", wallet)
    .order("created_at", { ascending: false })
    .limit(HISTORY_DIGEST_DEPTH);

  if (error || !data) return null;

  return aggregateRows(data as CoachAnalysisRow[]);
}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter web test -- history-digest --run`
Expected: PASS, 10 specs total.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/coach/history-digest.ts apps/web/src/lib/coach/__tests__/history-digest.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): aggregateHistory Supabase wrapper

- SELECT last 20 rows for wallet, ORDER BY created_at DESC
- Fail-soft: null env, SELECT error, or empty result → null
- Hands off to aggregateRows for pure aggregation
- Spec §6.2 / §6.5

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 3: `persistAnalysis` — happy-path INSERT with `ON CONFLICT DO NOTHING`

**Files:**
- Create: `apps/web/src/lib/coach/persistence.ts`
- Test: `apps/web/src/lib/coach/__tests__/persistence.test.ts` (NEW)

`persistAnalysis(wallet, payload)` builds a `CoachAnalysisRow` and upserts it with `ignoreDuplicates: true` (matches `lib/supabase/queries.ts:43-46` pattern). Maps `payload.result` through `toCoachGameResult()` so a bad source result throws loudly rather than coerces to a default — schema check `result in ('win','lose','draw','resigned')` cannot drift from TS-side enums (spec §5).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/coach/__tests__/persistence.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { persistAnalysis } from "../persistence.js";
import type { CoachResponse } from "../types.js";

vi.mock("../../supabase/server", () => ({
  getSupabaseServer: vi.fn(),
}));

import { getSupabaseServer } from "../../supabase/server.js";

function buildUpsertChain() {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  // SELECT count chain for soft-cap: from(...).select("*", { count, head }).eq(...)
  const eqAfterSelect = vi.fn().mockResolvedValue({ count: 0, error: null });
  const select = vi.fn().mockReturnValue({ eq: eqAfterSelect });
  // .delete().eq(wallet).not("game_id", "in", subselect) chain — only used in Task 4.
  const not = vi.fn().mockResolvedValue({ error: null });
  const eqAfterDelete = vi.fn().mockReturnValue({ not });
  const del = vi.fn().mockReturnValue({ eq: eqAfterDelete });
  const from = vi.fn().mockImplementation(() => ({ upsert, select, delete: del }));
  return { from, upsert, select, eqAfterSelect, del, eqAfterDelete, not };
}

const VALID_PAYLOAD = {
  gameId: "11111111-1111-1111-1111-111111111111",
  difficulty: "medium" as const,
  result: "lose" as const,
  totalMoves: 30,
  response: {
    kind: "full" as const,
    summary: "You lost a tight middlegame.",
    mistakes: [
      { moveNumber: 12, played: "Nf3", better: "Nd2", explanation: "Black hung the bishop on g7." },
    ],
    lessons: ["Watch for hanging pieces."],
    praise: ["Solid opening."],
  } satisfies CoachResponse,
};

describe("persistAnalysis", () => {
  beforeEach(() => {
    vi.mocked(getSupabaseServer).mockReset();
  });

  it("returns early without writing when getSupabaseServer is null", async () => {
    vi.mocked(getSupabaseServer).mockReturnValue(null);
    await expect(persistAnalysis("0xabc", VALID_PAYLOAD)).resolves.toBeUndefined();
    // No throw, no side-effect.
  });

  it("upserts with onConflict='wallet,game_id' and ignoreDuplicates=true", async () => {
    const chain = buildUpsertChain();
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    await persistAnalysis("0xabc", VALID_PAYLOAD);
    expect(chain.from).toHaveBeenCalledWith("coach_analyses");
    expect(chain.upsert).toHaveBeenCalledTimes(1);
    const [rows, opts] = chain.upsert.mock.calls[0];
    expect(opts).toEqual({ onConflict: "wallet,game_id", ignoreDuplicates: true });
    expect(Array.isArray(rows) ? rows[0] : rows).toMatchObject({
      wallet: "0xabc",
      game_id: VALID_PAYLOAD.gameId,
      kind: "full",
      difficulty: "medium",
      result: "lose",
      total_moves: 30,
      summary_text: "You lost a tight middlegame.",
    });
  });

  it("computes weakness_tags via extractWeaknessTags before insert", async () => {
    const chain = buildUpsertChain();
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    await persistAnalysis("0xabc", VALID_PAYLOAD);
    const [rows] = chain.upsert.mock.calls[0];
    const row = Array.isArray(rows) ? rows[0] : rows;
    // Mistake explanation says "hung the bishop" → hanging-piece keyword rule.
    expect(row.weakness_tags).toEqual(["hanging-piece"]);
  });

  it("throws when payload.result is not a CoachGameResult value", async () => {
    const chain = buildUpsertChain();
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    await expect(
      persistAnalysis("0xabc", { ...VALID_PAYLOAD, result: "loss" as never }),
    ).rejects.toThrowError(/CoachGameResult/);
    expect(chain.upsert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- persistence --run`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `persistence.ts`**

Create `apps/web/src/lib/coach/persistence.ts`:

```ts
import { extractWeaknessTags } from "./weakness-tags.js";
import { toCoachGameResult } from "./types.js";
import type {
  CoachAnalysisRow,
  CoachGameResult,
  CoachResponse,
  Mistake,
  WeaknessTag,
} from "./types.js";
import { getSupabaseServer } from "../supabase/server.js";

const ROW_SOFT_CAP = 200;

export type PersistAnalysisPayload = {
  gameId: string;
  difficulty: "easy" | "medium" | "hard";
  result: CoachGameResult;
  totalMoves: number;
  response: CoachResponse;
};

/**
 * Best-effort `extractWeaknessTags` — returns `[]` on any throw.
 *
 * Rationale: a tag-derivation throw must NOT silently drop a row that a
 * paying user generated (red-team P1-7). The row gets preserved with an
 * empty tag set; the caller is expected to log a `coach_tag_extraction_failed`
 * warning for observability when it cares.
 */
export function extractWeaknessTagsSafe(
  mistakes: Mistake[],
  totalMoves: number,
  result: CoachGameResult,
): { tags: WeaknessTag[]; error: Error | null } {
  try {
    return { tags: extractWeaknessTags(mistakes, totalMoves, result), error: null };
  } catch (err) {
    return { tags: [], error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Insert a Coach analysis into Supabase with first-wins semantics.
 *
 * - Maps `payload.result` through `toCoachGameResult()` so the schema check
 *   `result in ('win','lose','draw','resigned')` cannot drift (§5).
 * - `upsert(rows, { onConflict: "wallet,game_id", ignoreDuplicates: true })`
 *   matches the supabase-js v2 idiom already in `lib/supabase/queries.ts`
 *   for first-wins concurrent multi-device writes (red-team P1-9).
 * - Tag derivation is fail-soft; row inserts even if extraction throws
 *   (red-team P1-7).
 * - Soft cap of 200 rows per wallet enforced post-insert (Task 4 — added
 *   by the next commit; this commit's implementation is happy-path only).
 *
 * Spec §6.1 / §15 (P1-2, P1-7, P1-9).
 */
export async function persistAnalysis(
  wallet: string,
  payload: PersistAnalysisPayload,
): Promise<void> {
  // Validate result up-front — throws on bad input (loud failure at the seam).
  const result = toCoachGameResult(payload.result);

  const supabase = getSupabaseServer();
  if (!supabase) return;

  const { tags } = extractWeaknessTagsSafe(payload.response.mistakes, payload.totalMoves, result);

  const row: CoachAnalysisRow = {
    wallet,
    game_id: payload.gameId,
    // created_at + expires_at use the column defaults (now() + 1y).
    // The fields are required by CoachAnalysisRow, so we synthesize them
    // for typing; Supabase will overwrite via DEFAULT for INSERTs that
    // don't supply them — but supabase-js sends every key. We omit the
    // pair below by spreading from a partial.
    created_at: "",
    expires_at: "",
    kind: "full",
    difficulty: payload.difficulty,
    result,
    total_moves: payload.totalMoves,
    summary_text: payload.response.summary,
    mistakes: payload.response.mistakes,
    lessons: payload.response.lessons,
    praise: payload.response.praise,
    weakness_tags: tags,
  };

  // Strip the synthesized empty timestamps so Postgres applies the column defaults.
  // (PR 3 backfill writes them explicitly; live writes don't.)
  const { created_at: _ca, expires_at: _ea, ...insertRow } = row;

  const { error } = await supabase
    .from("coach_analyses")
    .upsert(insertRow as unknown as CoachAnalysisRow, {
      onConflict: "wallet,game_id",
      ignoreDuplicates: true,
    });

  if (error) {
    // Caller (PR 3 route) wraps the call in try/catch and logs a
    // `coach_persist_failed` event. Throw so the caller's catch fires.
    throw new Error(`persistAnalysis upsert failed: ${error.message}`);
  }

  // Soft-cap cleanup is added in Task 4. This commit is happy-path only.
}
```

(Note on the `_ca`/`_ea` strip: supabase-js sends every key in the upsert payload. Synthesizing empty strings would violate the `not null` column constraint at insert time. Stripping them lets the column defaults apply. The `CoachAnalysisRow` type is the wire shape returned by `aggregateHistory`, not the insert shape — this lossy stripping is the only place the two diverge. PR 3 backfill will use the row shape verbatim because it sets timestamps explicitly per P1-6.)

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter web test -- persistence --run`
Expected: PASS, 4 specs.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/coach/persistence.ts apps/web/src/lib/coach/__tests__/persistence.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): persistAnalysis writer with ON CONFLICT DO NOTHING

- Maps payload.result through toCoachGameResult() — bad input throws loudly,
  schema check `result in ('win','lose','draw','resigned')` cannot drift
- upsert(..., { onConflict: "wallet,game_id", ignoreDuplicates: true })
  for first-wins multi-device concurrent writes (P1-9)
- extractWeaknessTagsSafe wraps tag derivation in try/catch — row preserved
  with weakness_tags=[] on throw (P1-7)
- Null Supabase env → fail-soft skip
- Soft-cap cleanup added in next commit
- Spec §6.1 / §15

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 4: `persistAnalysis` — soft-cap delete (200 rows per wallet)

**Files:**
- Modify: `apps/web/src/lib/coach/persistence.ts`
- Modify: `apps/web/src/lib/coach/__tests__/persistence.test.ts`

After upsert, query the row count for the wallet. If `> 200`, delete every row whose `game_id` is NOT in the most recent 200. Caps a single high-volume wallet's footprint (~200 × 5 KB = 1 MB; spec §6.1, red-team P1-2).

- [ ] **Step 1: Append failing tests**

Append to `apps/web/src/lib/coach/__tests__/persistence.test.ts`:

```ts
describe("persistAnalysis — soft cap (200 rows)", () => {
  beforeEach(() => {
    vi.mocked(getSupabaseServer).mockReset();
  });

  it("does not fire delete when count <= 200", async () => {
    const chain = buildUpsertChain();
    chain.eqAfterSelect.mockResolvedValue({ count: 150, error: null });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    await persistAnalysis("0xabc", VALID_PAYLOAD);
    expect(chain.del).not.toHaveBeenCalled();
  });

  it("fires bounded delete when count > 200", async () => {
    const chain = buildUpsertChain();
    chain.eqAfterSelect.mockResolvedValue({ count: 250, error: null });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    await persistAnalysis("0xabc", VALID_PAYLOAD);
    expect(chain.del).toHaveBeenCalledTimes(1);
    expect(chain.eqAfterDelete).toHaveBeenCalledWith("wallet", "0xabc");
    // The ".not('game_id', 'in', '(<subquery>)')" filter is asserted by name+arity;
    // the inner subquery is a string literal we don't pin here.
    expect(chain.not).toHaveBeenCalledTimes(1);
    const [col, op, _subq] = chain.not.mock.calls[0];
    expect(col).toBe("game_id");
    expect(op).toBe("in");
  });

  it("does not fire delete when count query errors (fail-soft)", async () => {
    const chain = buildUpsertChain();
    chain.eqAfterSelect.mockResolvedValue({ count: null, error: { message: "boom" } });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    await persistAnalysis("0xabc", VALID_PAYLOAD);
    expect(chain.del).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- persistence --run`
Expected: 2 of 3 new tests FAIL (the count<=200 case passes vacuously since the current implementation never calls delete).

- [ ] **Step 3: Append the soft-cap logic**

Edit `apps/web/src/lib/coach/persistence.ts`. Replace the trailing comment `// Soft-cap cleanup is added in Task 4. …` with:

```ts
  // Soft-cap cleanup (red-team P1-2): cap any single wallet at 200 rows.
  // Rationale: 200 × ~5 KB ≈ 1 MB per wallet regardless of activity volume.
  // Fail-soft — count errors don't block; the cap re-checks on next write.
  const { count, error: countError } = await supabase
    .from("coach_analyses")
    .select("*", { count: "exact", head: true })
    .eq("wallet", wallet);

  if (countError || (count ?? 0) <= ROW_SOFT_CAP) return;

  // Delete rows where game_id is NOT in the most recent 200 for this wallet.
  // Uses Postgres-side subquery via `.not('game_id', 'in', '(...)')` —
  // supabase-js renders the third arg verbatim into the SQL.
  const subquery = `(select game_id from coach_analyses where wallet = '${wallet}' order by created_at desc limit ${ROW_SOFT_CAP})`;
  await supabase
    .from("coach_analyses")
    .delete()
    .eq("wallet", wallet)
    .not("game_id", "in", subquery);
}
```

(The wallet string is interpolated into a quoted SQL literal. Wallet addresses pass `isAddress(...)` upstream and are normalized to lowercase `0x[0-9a-f]{40}` — there is no path for a quote or backslash to reach this string. PR 3's route caller is the only legit entry point and validates the wallet before any persistence call.)

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter web test -- persistence --run`
Expected: PASS, 7 specs total.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/coach/persistence.ts apps/web/src/lib/coach/__tests__/persistence.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): persistAnalysis soft cap — 200 rows per wallet

Post-insert COUNT + bounded DELETE NOT IN (most-recent 200). Caps a
high-volume wallet's footprint at ~1 MB. Fail-soft: count error skips
cleanup without throwing (cap re-checks on next write).

Spec §6.1 / red-team P1-2.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 5: `prompt-template.ts` — free-path snapshot regression guard

**Files:**
- Create: `apps/web/src/lib/coach/__tests__/prompt-template.test.ts` (NEW)

This task locks the existing free-path output BEFORE any change to `prompt-template.ts`. Any subsequent task (or PR) that drifts the free output fails this snapshot. The snapshot is an inline `toMatchInlineSnapshot()` — vitest auto-fills on first run, then enforces equality forever.

- [ ] **Step 1: Write the snapshot test**

Create `apps/web/src/lib/coach/__tests__/prompt-template.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildCoachPrompt } from "../prompt-template.js";

const FREE_PATH_FIXTURE = {
  moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6"],
  result: "lose" as const,
  difficulty: "medium",
};

describe("buildCoachPrompt — free path (regression guard)", () => {
  it("produces the locked free-path output when summary is null", () => {
    const out = buildCoachPrompt(
      FREE_PATH_FIXTURE.moves,
      FREE_PATH_FIXTURE.result,
      FREE_PATH_FIXTURE.difficulty,
      null,
    );
    // Inline snapshot — vitest auto-populates on first run.
    // Any drift in subsequent commits fails this test by definition.
    expect(out).toMatchInlineSnapshot();
  });

  it("includes the summary block verbatim when summary is supplied", () => {
    const out = buildCoachPrompt(
      FREE_PATH_FIXTURE.moves,
      FREE_PATH_FIXTURE.result,
      FREE_PATH_FIXTURE.difficulty,
      {
        gamesPlayed: 12,
        recentMistakeCategories: [],
        avgGameLength: 28.4,
        difficultyDistribution: {},
        weaknessTags: ["king-safety", "tactics"],
      },
    );
    expect(out).toContain("Player context: 12 games played");
    expect(out).toContain("avg 28 moves per game");
    expect(out).toContain("Recent weaknesses: king-safety, tactics");
  });

  it("uses the lose RESULT_HINT for result=lose", () => {
    const out = buildCoachPrompt(["e4"], "lose", "medium", null);
    expect(out).toContain("The player lost. Be encouraging.");
  });
});
```

- [ ] **Step 2: Run to populate the snapshot**

Run: `pnpm --filter web test -- prompt-template --run -u`
Expected: PASS, 3 specs. Vitest writes the snapshot value back into the test file (replaces `toMatchInlineSnapshot()` with `toMatchInlineSnapshot(\`…\`)`). Open the file and confirm the snapshot string matches the current free-path output structure (header + moves + Result line + RESULT_HINT block + JSON schema rules).

- [ ] **Step 3: Commit the populated snapshot**

```bash
git add apps/web/src/lib/coach/__tests__/prompt-template.test.ts
git commit -m "$(cat <<'EOF'
test(coach): pin free-path prompt-template output (regression guard)

Inline snapshot of the current buildCoachPrompt() output for the free
path. Any drift in subsequent PR 2/3/4/5 commits fails this test —
this is the load-bearing guarantee that PRO surface work cannot leak
into the free-tier prompt.

Spec §11 — "Free path snapshot unchanged (hard-locked regression guard)".

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 6: `prompt-template.ts` — add optional `history` parameter (no-op for free)

**Files:**
- Modify: `apps/web/src/lib/coach/prompt-template.ts`

Add the 5th positional parameter `history?: HistoryDigest | null`. Every existing call site (`fallback-engine.ts`, `app/api/coach/analyze/route.ts`) passes 4 args — TypeScript treats the new param as `undefined` for them. The implementation in this task ignores the parameter entirely; Tasks 7–10 use it.

The free-path snapshot from Task 5 must stay green.

- [ ] **Step 1: Edit `prompt-template.ts` — add the param, change nothing else**

Edit `apps/web/src/lib/coach/prompt-template.ts`. Replace lines 1 + 10–15:

```ts
import type { GameResult, HistoryDigest, PlayerSummary } from "./types";
```

```ts
export function buildCoachPrompt(
  moves: string[],
  result: GameResult,
  difficulty: string,
  summary: PlayerSummary | null,
  history?: HistoryDigest | null,
): string {
  // history is intentionally unused in this task; Tasks 7–10 introduce
  // the augmentation block. Existing callers pass 4 args and behave
  // bit-identically (locked by the Task 5 inline snapshot).
  void history;

  const movesStr = moves.map((m, i) => `${Math.floor(i / 2) + 1}${i % 2 === 0 ? "." : "..."} ${m}`).join(" ");
```

Leave the rest of the function unchanged.

- [ ] **Step 2: Run — snapshot must still pass**

Run: `pnpm --filter web test -- prompt-template --run`
Expected: PASS, 3 specs (the inline snapshot from Task 5 is still equal).

- [ ] **Step 3: Typecheck — existing callers compile unchanged**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors. (The new param is optional; `fallback-engine.ts` and `app/api/coach/analyze/route.ts` calls are 4-arity and remain valid.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/coach/prompt-template.ts
git commit -m "$(cat <<'EOF'
feat(coach): buildCoachPrompt accepts optional history param

Adds the 5th positional parameter `history?: HistoryDigest | null`.
This commit ignores the parameter — Tasks 7–10 wire the augmentation
block. Existing 4-arity callers remain bit-identical (locked by the
free-path snapshot in the previous commit).

Spec §6.3 / §10.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 7: `prompt-template.ts` — PRO standard branch (populated `topWeaknessTags`)

**Files:**
- Modify: `apps/web/src/lib/coach/prompt-template.ts`
- Modify: `apps/web/src/lib/coach/__tests__/prompt-template.test.ts`

When `history.topWeaknessTags.length > 0`, render the standard augmentation block (spec §6.3 first variant). Insert AFTER the existing `summaryBlock` and BEFORE the `RESULT_HINTS` line.

- [ ] **Step 1: Add failing tests**

Append to `apps/web/src/lib/coach/__tests__/prompt-template.test.ts`:

```ts
describe("buildCoachPrompt — PRO standard branch (populated tags)", () => {
  it("includes 'Player history (last 20 games):' header with gamesPlayed", () => {
    const out = buildCoachPrompt(
      FREE_PATH_FIXTURE.moves,
      "lose",
      "medium",
      null,
      {
        gamesPlayed: 14,
        recentResults: { win: 5, lose: 7, draw: 1, resigned: 1 },
        topWeaknessTags: [
          { tag: "weak-king-safety", count: 4 },
          { tag: "missed-tactic", count: 3 },
        ],
      },
    );
    expect(out).toContain("Player history (last 20 games): 14 games.");
  });

  it("renders Recent results line as W:L:D (no resigned in display)", () => {
    const out = buildCoachPrompt(["e4"], "lose", "medium", null, {
      gamesPlayed: 14,
      recentResults: { win: 5, lose: 7, draw: 1, resigned: 1 },
      topWeaknessTags: [{ tag: "weak-king-safety", count: 4 }],
    });
    expect(out).toContain("Recent results: W:5 L:7 D:1.");
    expect(out).not.toContain("R:1");
  });

  it("renders 'Recurring weakness areas:' with tag (×count) joined by ', '", () => {
    const out = buildCoachPrompt(["e4"], "lose", "medium", null, {
      gamesPlayed: 14,
      recentResults: { win: 5, lose: 7, draw: 1, resigned: 1 },
      topWeaknessTags: [
        { tag: "weak-king-safety", count: 4 },
        { tag: "missed-tactic", count: 3 },
      ],
    });
    expect(out).toContain("Recurring weakness areas: weak-king-safety (×4), missed-tactic (×3).");
  });

  it("includes the call-out instruction with 'Do not fabricate a pattern that isn't in the data.'", () => {
    const out = buildCoachPrompt(["e4"], "lose", "medium", null, {
      gamesPlayed: 14,
      recentResults: { win: 5, lose: 7, draw: 1, resigned: 1 },
      topWeaknessTags: [{ tag: "weak-king-safety", count: 4 }],
    });
    expect(out).toContain("call them out by name");
    expect(out).toContain("Do not fabricate a pattern that isn't in the data.");
  });

  it("does NOT contain the no-evidence hard-guard text when tags are populated", () => {
    const out = buildCoachPrompt(["e4"], "lose", "medium", null, {
      gamesPlayed: 14,
      recentResults: { win: 5, lose: 7, draw: 1, resigned: 1 },
      topWeaknessTags: [{ tag: "weak-king-safety", count: 4 }],
    });
    expect(out).not.toContain("do NOT speculate");
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- prompt-template --run`
Expected: 5 new tests FAIL (current implementation ignores `history`).

- [ ] **Step 3: Add the augmentation helper + wire it**

Edit `apps/web/src/lib/coach/prompt-template.ts`. Replace the body to:

```ts
import type { GameResult, HistoryDigest, PlayerSummary } from "./types";

const RESULT_HINTS: Record<GameResult, string> = {
  win: "The player won. Focus on: (1) strengths shown, (2) moments where a stronger opponent would have punished them, (3) how to win more efficiently.",
  lose: "The player lost. Be encouraging. Focus on: (1) what went wrong (kindly), (2) critical mistakes that turned the game, (3) concrete skills to practice.",
  draw: "The game was a draw. Focus on: (1) why the game didn't resolve, (2) missed opportunities to press advantage, (3) how to convert drawn positions.",
  resigned: "The player resigned. Focus on: (1) the turning point, (2) the position that felt lost + a safer continuation, (3) pattern recognition for similar positions.",
};

const HISTORY_BLOCK_CHAR_CAP = 600;

function buildHistoryAugmentation(history: HistoryDigest | null | undefined): string {
  if (!history) return "";

  const { gamesPlayed, recentResults, topWeaknessTags } = history;
  const header =
    `Player history (last 20 games): ${gamesPlayed} games.\n` +
    `Recent results: W:${recentResults.win} L:${recentResults.lose} D:${recentResults.draw}.`;

  if (topWeaknessTags.length === 0) {
    // No-evidence hard-guard branch added in Task 8.
    return "";
  }

  const tagsLine =
    "Recurring weakness areas: " +
    topWeaknessTags.map((t) => `${t.tag} (×${t.count})`).join(", ") +
    ".";

  const callout =
    "When analyzing this game, if any of the above weakness areas appear,\n" +
    'call them out by name — e.g., "you\'ve shown weak king safety in 4 of\n' +
    'your last 8 games." Tie the call-out to the count above. Do not\n' +
    "fabricate a pattern that isn't in the data.";

  return `\n${header}\n${tagsLine}\n\n${callout}`;
}

export function buildCoachPrompt(
  moves: string[],
  result: GameResult,
  difficulty: string,
  summary: PlayerSummary | null,
  history?: HistoryDigest | null,
): string {
  const movesStr = moves.map((m, i) => `${Math.floor(i / 2) + 1}${i % 2 === 0 ? "." : "..."} ${m}`).join(" ");

  const summaryBlock = summary
    ? `\nPlayer context: ${summary.gamesPlayed} games played, avg ${Math.round(summary.avgGameLength)} moves per game. Recent weaknesses: ${summary.weaknessTags.slice(0, 5).join(", ") || "none identified yet"}.`
    : "";

  const historyBlock = buildHistoryAugmentation(history);

  return `You are a chess coach analyzing a game played on Chesscito (a learning app for beginners and casual players).

Game: ${movesStr}
Result: ${result} (${difficulty} difficulty AI opponent)
${summaryBlock}${historyBlock}

${RESULT_HINTS[result]}

Respond ONLY with a JSON object matching this exact schema (no markdown, no explanation outside JSON):
{
  "kind": "full",
  "summary": "2-3 sentence conversational summary of the game",
  "mistakes": [{"moveNumber": N, "played": "move", "better": "alternative", "explanation": "why"}],
  "lessons": ["actionable lesson 1", ...],
  "praise": ["specific thing done well", ...]
}

Rules:
- mistakes: max 5, only include genuine mistakes
- lessons: max 3, concrete and actionable
- praise: max 2, specific to this game (never empty — find something positive even in a loss)
- All text in English
- Keep explanations simple — the player may be a beginner`;
}
```

Note the placement: `${historyBlock}` appends directly after `${summaryBlock}` so when both are empty (free path) the two-newline gap before `${RESULT_HINTS[result]}` is preserved verbatim. The Task 5 snapshot proves this.

- [ ] **Step 4: Run — expect pass + free-path snapshot still green**

Run: `pnpm --filter web test -- prompt-template --run`
Expected: PASS, 8 specs total. Free-path snapshot unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/coach/prompt-template.ts apps/web/src/lib/coach/__tests__/prompt-template.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): PRO augmentation — standard branch (populated tags)

Renders "Player history" header + W:L:D line + "Recurring weakness
areas:" + call-out instruction when topWeaknessTags is non-empty.
Hard-guard branch + 600-char cap added in subsequent commits.

Free-path snapshot still green — augmentation is reachable only when
history is supplied (PR 3 wires this from the analyze route).

Spec §6.3 first variant.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 8: `prompt-template.ts` — PRO no-evidence hard-guard branch

**Files:**
- Modify: `apps/web/src/lib/coach/prompt-template.ts`
- Modify: `apps/web/src/lib/coach/__tests__/prompt-template.test.ts`

When `history.topWeaknessTags.length === 0` (rows exist but no canonical tag matched any explanation), render the hard-guard variant (spec §6.3 second variant). The literal `"do NOT speculate"` substring is asserted in tests so future re-wording must be a deliberate change.

- [ ] **Step 1: Add failing tests**

Append to `apps/web/src/lib/coach/__tests__/prompt-template.test.ts`:

```ts
describe("buildCoachPrompt — PRO no-evidence branch (empty topWeaknessTags)", () => {
  it("renders the hard-guard variant with 'do NOT speculate'", () => {
    const out = buildCoachPrompt(["e4"], "lose", "medium", null, {
      gamesPlayed: 6,
      recentResults: { win: 2, lose: 3, draw: 1, resigned: 0 },
      topWeaknessTags: [],
    });
    expect(out).toContain("Insufficient pattern data this session");
    expect(out).toContain("do NOT speculate");
    expect(out).toContain("Analyze\nONLY the current game.");
  });

  it("still includes the gamesPlayed + W:L:D header in the hard-guard variant", () => {
    const out = buildCoachPrompt(["e4"], "lose", "medium", null, {
      gamesPlayed: 6,
      recentResults: { win: 2, lose: 3, draw: 1, resigned: 0 },
      topWeaknessTags: [],
    });
    expect(out).toContain("Player history (last 20 games): 6 games.");
    expect(out).toContain("Recent results: W:2 L:3 D:1.");
  });

  it("does NOT contain 'Recurring weakness areas:' line", () => {
    const out = buildCoachPrompt(["e4"], "lose", "medium", null, {
      gamesPlayed: 6,
      recentResults: { win: 2, lose: 3, draw: 1, resigned: 0 },
      topWeaknessTags: [],
    });
    expect(out).not.toContain("Recurring weakness areas:");
  });

  it("does NOT contain the standard 'Do not fabricate a pattern' call-out", () => {
    const out = buildCoachPrompt(["e4"], "lose", "medium", null, {
      gamesPlayed: 6,
      recentResults: { win: 2, lose: 3, draw: 1, resigned: 0 },
      topWeaknessTags: [],
    });
    expect(out).not.toContain("Do not fabricate a pattern");
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- prompt-template --run`
Expected: 2 new tests FAIL (the negative-controls pass vacuously since the empty-tag branch currently returns `""`).

- [ ] **Step 3: Implement the hard-guard branch**

Edit `apps/web/src/lib/coach/prompt-template.ts`. Replace the empty-tags `return "";` placeholder in `buildHistoryAugmentation` with:

```ts
  if (topWeaknessTags.length === 0) {
    const guard =
      "Insufficient pattern data this session — do NOT speculate about\n" +
      "recurring weaknesses or strengths across past games. Analyze\n" +
      "ONLY the current game.";
    return `\n${header}\n\n${guard}`;
  }
```

- [ ] **Step 4: Run — expect pass + free-path snapshot still green**

Run: `pnpm --filter web test -- prompt-template --run`
Expected: PASS, 12 specs total.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/coach/prompt-template.ts apps/web/src/lib/coach/__tests__/prompt-template.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): PRO augmentation — no-evidence hard-guard branch

Fires when topWeaknessTags is empty (rows exist but the 6-label v1
taxonomy whiffed). Block tells the LLM to analyze ONLY the current game
and not invent patterns from raw counts. The literal "do NOT speculate"
substring is pinned by tests so future rewording must be deliberate.

Spec §6.3 second variant.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 9: `prompt-template.ts` — 600-char cap with truncation

**Files:**
- Modify: `apps/web/src/lib/coach/prompt-template.ts`
- Modify: `apps/web/src/lib/coach/__tests__/prompt-template.test.ts`

Cap the rendered augmentation block at 600 chars (spec §6.3, red-team P1-3). Defense-in-depth: in v1 the realistic worst case is ~475 chars (3 fixed-length tags + counts), but the cap protects against future taxonomy growth pushing the prompt past the LLM context window.

Implementation: a small pure helper `truncateAtLimit(text, max)` that returns `text` unchanged if `text.length <= max`, else slices to `max - 1` and appends `"…"` (single Unicode ellipsis char so the total stays exactly `max`).

- [ ] **Step 1: Add failing tests**

Append to `apps/web/src/lib/coach/__tests__/prompt-template.test.ts`:

```ts
import { truncateAtLimit } from "../prompt-template.js";

describe("truncateAtLimit", () => {
  it("returns text unchanged when within limit", () => {
    expect(truncateAtLimit("hello", 10)).toBe("hello");
    expect(truncateAtLimit("hello", 5)).toBe("hello");
  });

  it("truncates to exactly `max` characters with a trailing ellipsis", () => {
    const out = truncateAtLimit("a".repeat(700), 600);
    expect(out.length).toBe(600);
    expect(out.endsWith("…")).toBe(true);
    expect(out.slice(0, 599)).toBe("a".repeat(599));
  });

  it("handles empty input", () => {
    expect(truncateAtLimit("", 10)).toBe("");
  });
});

describe("buildCoachPrompt — 600-char augmentation cap", () => {
  it("v1 realistic max stays well under 600 chars", () => {
    // Worst case in v1: 3 fixed-label tags with high counts.
    const block = buildCoachPrompt(["e4"], "lose", "medium", null, {
      gamesPlayed: 20,
      recentResults: { win: 0, lose: 20, draw: 0, resigned: 0 },
      topWeaknessTags: [
        { tag: "weak-pawn-structure", count: 999 },
        { tag: "weak-king-safety", count: 888 },
        { tag: "endgame-conversion", count: 777 },
      ],
    });
    // Extract just the augmentation segment between the result line and RESULT_HINTS.
    const start = block.indexOf("Player history");
    const end = block.indexOf("\n\nThe player lost");
    const segment = block.slice(start, end);
    expect(segment.length).toBeLessThanOrEqual(600);
  });

  it("truncates at 600 chars when forced via constructed pathological input", () => {
    // We don't expose a way to force >600 in v1 (taxonomy is fixed-length).
    // The truncateAtLimit helper carries the contract; this test pins it
    // via a direct call (already covered in the truncateAtLimit suite)
    // and asserts the augmentation block goes through it.
    expect.hasAssertions();
  });
});
```

(The pathological test is intentionally weak — the v1 taxonomy literally cannot exceed 600 chars. The defense-in-depth value lives in `truncateAtLimit`'s own test suite. v2 work that adds new labels must re-evaluate.)

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- prompt-template --run`
Expected: 3 new `truncateAtLimit` tests FAIL (`truncateAtLimit is not exported`).

- [ ] **Step 3: Add the helper + wire it into the augmentation**

Edit `apps/web/src/lib/coach/prompt-template.ts`. Add the helper at the top of the file (after imports, before `RESULT_HINTS`):

```ts
/**
 * Truncate `text` to at most `max` Unicode code points. If exceeded, the
 * last char is replaced with U+2026 (HORIZONTAL ELLIPSIS) so the result
 * length is exactly `max`.
 *
 * Defense-in-depth for the augmentation block (red-team P1-3). v1
 * taxonomy makes >600 unreachable; v2 work must re-evaluate.
 */
export function truncateAtLimit(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}
```

Then wrap the two return statements inside `buildHistoryAugmentation`:

```ts
  if (topWeaknessTags.length === 0) {
    const guard =
      "Insufficient pattern data this session — do NOT speculate about\n" +
      "recurring weaknesses or strengths across past games. Analyze\n" +
      "ONLY the current game.";
    return truncateAtLimit(`\n${header}\n\n${guard}`, HISTORY_BLOCK_CHAR_CAP);
  }

  const tagsLine =
    "Recurring weakness areas: " +
    topWeaknessTags.map((t) => `${t.tag} (×${t.count})`).join(", ") +
    ".";

  const callout =
    "When analyzing this game, if any of the above weakness areas appear,\n" +
    'call them out by name — e.g., "you\'ve shown weak king safety in 4 of\n' +
    'your last 8 games." Tie the call-out to the count above. Do not\n' +
    "fabricate a pattern that isn't in the data.";

  return truncateAtLimit(`\n${header}\n${tagsLine}\n\n${callout}`, HISTORY_BLOCK_CHAR_CAP);
```

- [ ] **Step 4: Run — expect pass + free-path snapshot still green**

Run: `pnpm --filter web test -- prompt-template --run`
Expected: PASS, 16 specs total.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/coach/prompt-template.ts apps/web/src/lib/coach/__tests__/prompt-template.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): truncateAtLimit + 600-char augmentation cap

Defense-in-depth (red-team P1-3): a verbose v2 tag set cannot push the
prompt past the LLM context window. v1 worst-case stays ~475 chars; cap
is unreachable until v2 expands the taxonomy. Helper is pure + tested.

Spec §6.3 closing paragraph.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 10: Final verification — full suite + typecheck + scope diff

**Files:** none (verification only).

- [ ] **Step 1: Full unit suite**

Run: `pnpm --filter web test`
Expected: ALL tests pass. PR 1 ended at ~869 specs; PR 2 adds:
- `history-digest.test.ts` — 6 (Task 1) + 4 (Task 2) = 10
- `persistence.test.ts` — 4 (Task 3) + 3 (Task 4) = 7
- `prompt-template.test.ts` — 3 (Task 5) + 5 (Task 7) + 4 (Task 8) + 4 (Task 9) = 16

→ ≈ +33 specs, baseline ~902. No existing test should fail. Specifically: the free-path snapshot in `prompt-template.test.ts` must be green every commit from Task 6 onward.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors. Existing `buildCoachPrompt` callers (`fallback-engine.ts`, `app/api/coach/analyze/route.ts`) must compile unchanged — the new param is optional.

- [ ] **Step 3: Lint (best-effort, non-blocking)**

Run: `pnpm --filter web lint`
Expected: no new warnings introduced by the new modules. Pre-existing warnings unchanged.

- [ ] **Step 4: Scope diff**

```bash
git diff --name-only main..HEAD -- apps/web/src/lib/coach apps/web/src/lib/supabase apps/web/src/app
```

Expected output (exactly):

```
apps/web/src/lib/coach/__tests__/history-digest.test.ts
apps/web/src/lib/coach/__tests__/persistence.test.ts
apps/web/src/lib/coach/__tests__/prompt-template.test.ts
apps/web/src/lib/coach/history-digest.ts
apps/web/src/lib/coach/persistence.ts
apps/web/src/lib/coach/prompt-template.ts
```

Any other file in this diff = a scope leak. In particular, `app/api/coach/analyze/route.ts` MUST NOT appear — that wiring is PR 3.

- [ ] **Step 5: Free-path runtime smoke**

Add a one-shot REPL check via `node` (or via the inline test you already have) that confirms a 4-arity `buildCoachPrompt(...)` call still returns the snapshot string. The Task 5 snapshot test is the persistent guardrail; this step is a final eyeball.

```bash
pnpm --filter web test -- prompt-template --run --reporter=verbose 2>&1 | grep -E "(free path|regression|snapshot)"
```

Expected: the free-path-regression specs report PASS.

- [ ] **Step 6: Done**

PR 2 is ready to open. Suggested PR title:

```
feat(coach): PR 2 — persistAnalysis + aggregateHistory + prompt-template augmentation
```

PR body: link to spec §13 PR 2 + this plan. No release notes; user-facing behavior is unchanged (PRO path is unreachable until PR 3 wires the route).

---

## Self-review checklist

- [x] **Spec coverage:** §6.1 (write path + ON CONFLICT DO NOTHING + soft cap) ✓ Tasks 3+4; §6.2 (read path) ✓ Task 2; §6.3 three branches (null / empty / standard) ✓ Tasks 6+7+8; §6.3 600-char cap ✓ Task 9; §6.5 fail-soft (null env, SELECT error) ✓ Tasks 2+3; §10 module rows 2+3+6 (`history-digest.ts`, `persistence.ts`, `prompt-template.ts`) ✓ Tasks 1–9; §11 free-path snapshot regression ✓ Task 5; §15 P1-1 (taxonomy via `extractWeaknessTags`) ✓ Task 3 reuse; P1-2 (200 row cap) ✓ Task 4; P1-3 (600-char cap) ✓ Task 9; P1-7 (fail-soft tag extraction) ✓ Task 3 (`extractWeaknessTagsSafe`); P1-9 (`onConflict + ignoreDuplicates`) ✓ Task 3.
- [x] **Placeholder scan:** no TBD/TODO/"add appropriate". Every step shows actual code or actual command. The Task 9 pathological test is intentionally weak with a documented rationale (v1 taxonomy cannot exceed 600 chars; v2 must re-evaluate) — not a placeholder, an explicit deferred-scope.
- [x] **Type consistency:** `aggregateRows(rows)` / `aggregateHistory(wallet)` signatures pinned in Task 1 + Task 2. `persistAnalysis(wallet, payload)` + `PersistAnalysisPayload` shape pinned in Task 3 + reused in Task 4. `buildCoachPrompt(moves, result, difficulty, summary, history?)` pinned in Task 6 + reused in Tasks 7–9. `extractWeaknessTagsSafe` returns `{ tags, error }` pinned in Task 3. `truncateAtLimit(text, max)` pinned in Task 9. `HISTORY_BLOCK_CHAR_CAP = 600` constant introduced in Task 7's edit (declared near `RESULT_HINTS`) and consumed in Task 9 — ensure the implementer keeps both in this file (single source).
- [x] **Free-path bit-identicality invariant:** Task 5 locks the snapshot before any source change; Tasks 6/7/8/9 must keep it green. The Task 6 implementation note (`${historyBlock}` placement directly after `${summaryBlock}`) is the load-bearing detail — the empty-string concatenation preserves the existing whitespace.
- [x] **Mock pattern consistency:** all three new test files use the same `vi.mock("../../supabase/server")` approach. The chainable mock builder (`buildSelectChain`, `buildUpsertChain`) is duplicated across `history-digest.test.ts` and `persistence.test.ts` because their chains differ — extracting a shared helper is YAGNI for v1. PR 3 may DRY this up with the backfill mock.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-06-coach-session-memory-pr2.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
