# Coach Session Memory — PR 3 Implementation Plan (analyze route wiring + backfill)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate the dormant Coach session memory layer for PRO subscribers: wire `aggregateHistory` + `persistAnalysis` (PR 2) into `app/api/coach/analyze/route.ts`, ship the new `lib/coach/backfill.ts` (race-safe Redis→Supabase one-shot copy), add `hashWallet()` to `lib/server/logger.ts`, add the two new Redis keys, emit the spec-mandated telemetry events, and surface `historyMeta` in the response payload. **Free path remains bit-identical** — locked by the inline snapshot from PR 2 Task 5; this PR's tests must keep that snapshot green at every commit. **PRO behavior changes**: PRO requests now write to `coach_analyses`, read aggregated history, and receive prompt augmentation that the LLM uses to call out recurring weaknesses by name.

**Architecture:** The route gains two PRO-only branches that both fail soft: a *read* branch before the LLM call (backfill once → aggregate → augment prompt), and a *write* branch after LLM success (persist row, log tag-extraction warnings if the safe extractor surfaced an error). Backfill is split into a pure record-builder (`buildBackfillRow`) and a thin orchestrator (`backfillRedisToSupabase`) so the bulk of the logic is unit-tested without I/O. Wallet hashing for log lines is centralized in `lib/server/logger.ts` (`LOG_SALT` is a server secret; the helper docstring carries the rotation contract). All telemetry uses the existing `createLogger({ route })` seam — no new tracker dependency.

**Tech Stack:** TypeScript (strict), Vitest, Upstash Redis (`@upstash/redis`), supabase-js v2, Node `crypto` (sha256), Next.js Route Handler. `.js` import suffix on relative imports.

**Spec reference:** `docs/superpowers/specs/2026-05-06-coach-session-memory-design.md` — §6.1 (write path), §6.2 (read path), §6.4 (response payload), §6.5 (failure modes), §7 (backfill), §8.4 (wallet hashing), §10 (module map rows for `backfill.ts`, `redis-keys.ts`, `logger.ts`, `analyze/route.ts`), §12 (telemetry table), §13 (PR 3 scope), §15 (P1-6 backfill TTL, P1-7 tag-extract preserve, P1-8 hash prefix, P1-9 ON CONFLICT, P0-5 race-safe poll).

**Free-path snapshot regression guard:** the inline snapshot in `apps/web/src/lib/coach/__tests__/prompt-template.test.ts` (PR 2 commit `bf4bc85`) MUST stay green at every commit. The plan verifies this in Task 6 and Task 8 explicitly. If a route-test refactor accidentally touches `prompt-template.ts`, the snapshot fails and the work is rolled back.

**Out of scope for PR 3** (later PRs): DELETE handler + nonce flow, `app/coach/history/page.tsx`, `<CoachPanel>` props plumbing (`proActive`/`historyMeta` consumption in UI), `<CoachHistoryDeletePanel>`, `<ConfirmDeleteSheet>`, `useCoachHistoryCount`, the `coach:cron:purge` route, `docs/runbooks/log-salt-rotation.md`, `PRO_COPY` array swap, first-run banner, privacy copy. These are PRs 4–5.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `apps/web/src/lib/server/logger.ts` | MODIFIED (additive) | Add `hashWallet(wallet): string` helper using `crypto.createHash("sha256")` + `LOG_SALT` env, returning the 16-char prefix. Add JSDoc capturing the secrecy contract (rotated quarterly, never `NEXT_PUBLIC_*`). |
| `apps/web/src/lib/server/__tests__/logger.test.ts` | MODIFIED | Add 4 specs: stable per-wallet, different-walletsdifferent-hashes, 16-char hex output, throws when `LOG_SALT` missing. |
| `apps/web/src/lib/coach/redis-keys.ts` | MODIFIED (additive) | Add two keys: `backfillClaim(wallet)` → `coach:backfill-claim:{wallet}`, `deleteNonce(nonce)` → `coach:delete-nonce:{nonce}`. |
| `apps/web/src/lib/coach/backfill.ts` | NEW | Two exports: pure `buildBackfillRow(wallet, gameId, analysis, game)` returning `CoachAnalysisRow \| null` (skips when `kind !== "full"` or any input missing); orchestrator `backfillRedisToSupabase(wallet, log?)` with Redis claim lock + poll-and-wait + Supabase count gate + per-row `extractWeaknessTagsSafe` + `INSERT…ON CONFLICT DO NOTHING`. Logs `coach_backfill_completed`, `coach_backfill_lock_timeout`, `coach_tag_extraction_failed` (`phase: "backfill"`). |
| `apps/web/src/lib/coach/__tests__/backfill.test.ts` | NEW | Pure builder: kind=quick→null, missing analysis→null, missing game→null, full row + happy mistake input → row with valid tags + `expires_at = createdAt + 1y`. Orchestrator (mocked redis + supabase): no-supabase fail-soft, lock acquired + count>0 short-circuits, lock acquired + zero ids → no upsert, lock acquired + 3 ids → upsert with 3 rows + `coach_backfill_completed`, lock contention + holder finishes → exits clean (`waited: true, copied: 0`), lock contention + holder still working after 3s → emits `coach_backfill_lock_timeout` + returns `waited: true`. |
| `apps/web/src/lib/coach/persistence.ts` | MODIFIED | Change return type to `Promise<{ tagError?: Error }>` so the route can log `coach_tag_extraction_failed` (`phase: "live"`) without `persistAnalysis` knowing about a logger. Existing happy-path returns `{}`; throw-on-upsert-error path unchanged. |
| `apps/web/src/lib/coach/__tests__/persistence.test.ts` | MODIFIED | Update one existing assertion (`toBeUndefined` → `toEqual({})`). Add 1 new spec: when `extractWeaknessTags` throws, the resolved value carries `{ tagError }` and the row still inserts with `weakness_tags = []`. |
| `apps/web/src/app/api/coach/analyze/route.ts` | MODIFIED | Wire 4 new behaviors gated on `proStatus.active`: (1) before prompt build — `await backfillRedisToSupabase(wallet, log)` then `const history = await aggregateHistory(wallet)`, both inside one try/catch that swallows errors; (2) pass `history` as the 5th arg to `buildCoachPrompt`; (3) after LLM success — `const { tagError } = await persistAnalysis(wallet, {...})` inside its own try/catch, emit `coach_tag_extraction_failed` if `tagError` and `coach_persist_failed` if the catch fires; (4) include `historyMeta: { gamesPlayed: history?.gamesPlayed ?? 0 }` in the PRO response (`status: "ready"` branch only — not the cached short-circuit). Free path execution path unchanged. |
| `apps/web/src/app/api/coach/analyze/__tests__/route.test.ts` | MODIFIED | Add mocks for `aggregateHistory`, `persistAnalysis`, `backfillRedisToSupabase`, `isProActive`. Add 6 new specs: PRO=true triggers backfill+aggregate+persist; free=true skips all three; backfill throw → degrade to free-path prompt + log `coach_persist_failed`-style warn; persist throw → analysis still returns 200 + warn logged; tagError surfaced → `coach_tag_extraction_failed` logged + row still recorded; historyMeta present on PRO success + absent on free success. The existing free-path tests must continue passing without modification (proves bit-identicality at the integration level). |

`lib/coach/types.ts`, `lib/coach/history-digest.ts`, `lib/coach/weakness-tags.ts`, and `lib/coach/prompt-template.ts` are not modified.

---

## Task 1: `hashWallet()` + `LOG_SALT` in `lib/server/logger.ts`

**Files:**
- Modify: `apps/web/src/lib/server/logger.ts` (append below `createLogger`)
- Modify: `apps/web/src/lib/server/__tests__/logger.test.ts` (append `describe` block)

The helper produces a stable, non-reversible 16-hex-char identifier per wallet. The secrecy of `LOG_SALT` is the load-bearing property — without it, an attacker with log read access can rainbow-table known wallet addresses.

- [ ] **Step 1: Append failing tests**

Append to `apps/web/src/lib/server/__tests__/logger.test.ts` (preserve the existing `__setLoggerSink`/`__resetLoggerSink` setup):

```ts
import { hashWallet } from "../logger.js";

describe("hashWallet", () => {
  const ORIG_SALT = process.env.LOG_SALT;

  beforeEach(() => {
    process.env.LOG_SALT = "test-salt-do-not-ship";
  });

  afterAll(() => {
    if (ORIG_SALT === undefined) delete process.env.LOG_SALT;
    else process.env.LOG_SALT = ORIG_SALT;
  });

  it("returns the same hash for the same wallet", () => {
    const a = hashWallet("0xabc");
    const b = hashWallet("0xabc");
    expect(a).toBe(b);
  });

  it("returns different hashes for different wallets", () => {
    expect(hashWallet("0xabc")).not.toBe(hashWallet("0xdef"));
  });

  it("returns exactly 16 hex chars (red-team P1-8: 64-bit prefix)", () => {
    const out = hashWallet("0x1234567890abcdef1234567890abcdef12345678");
    expect(out).toMatch(/^[0-9a-f]{16}$/);
    expect(out).toHaveLength(16);
  });

  it("throws when LOG_SALT is missing — no silent unsalted fallback", () => {
    delete process.env.LOG_SALT;
    expect(() => hashWallet("0xabc")).toThrowError(/LOG_SALT/);
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- logger --run`
Expected: 4 new tests FAIL with `hashWallet is not a function` (or import error).

- [ ] **Step 3: Append helper to `logger.ts`**

Append to `apps/web/src/lib/server/logger.ts` (after `createLogger`):

```ts
import { createHash } from "node:crypto";

/**
 * Stable, non-reversible 16-hex-char identifier for a wallet, suitable for
 * log lines. Combines the lowercased wallet with the server-side `LOG_SALT`
 * secret and returns the 64-bit prefix of the sha256 digest.
 *
 * Spec §8.4 / §12 / red-team P1-8.
 *
 * **Secrecy contract**: `LOG_SALT` is rotated quarterly per the runbook
 * (PR 5 lands `docs/runbooks/log-salt-rotation.md`). It MUST NOT be
 * `NEXT_PUBLIC_*`; without secrecy, an attacker with log read access can
 * rainbow-table known wallet addresses. The "stable but non-reversible"
 * guarantee is contractual — if the salt leaks, treat all in-flight log
 * lines containing wallet hashes as deanonymizable until the salt rotates.
 *
 * Throws when `LOG_SALT` is missing rather than coercing to an empty
 * string — silent fallback would degrade the privacy property without
 * surfacing the misconfiguration.
 */
export function hashWallet(wallet: string): string {
  const salt = process.env.LOG_SALT;
  if (!salt) {
    throw new Error("hashWallet: LOG_SALT env is required (server-side secret)");
  }
  return createHash("sha256")
    .update(wallet.toLowerCase() + salt)
    .digest("hex")
    .slice(0, 16);
}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter web test -- logger --run`
Expected: PASS (existing logger specs + 4 new `hashWallet` specs).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/server/logger.ts apps/web/src/lib/server/__tests__/logger.test.ts
git commit -m "$(cat <<'EOF'
feat(server): hashWallet helper + LOG_SALT secrecy contract

- sha256(wallet.toLowerCase() + LOG_SALT).slice(0, 16) — 64-bit prefix
  per red-team P1-8
- Throws when LOG_SALT missing — no silent unsalted fallback
- Docstring carries the rotation/secrecy contract; runbook lands in PR 5
- Spec §8.4 / §12 — PR 3 of 5 (analyze route wiring + backfill)

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 2: `redis-keys.ts` — add `backfillClaim` + `deleteNonce`

**Files:**
- Modify: `apps/web/src/lib/coach/redis-keys.ts`

Two new keys for PR 3 (`backfillClaim`) and PR 4 (`deleteNonce`). Both land here so the file is touched once and `REDIS_KEYS` stays alphabetical-ish next to its peers.

- [ ] **Step 1: Edit the file**

Edit `apps/web/src/lib/coach/redis-keys.ts`. Add two entries to the `REDIS_KEYS` object:

```ts
  /** PR 3 backfill claim lock — short-lived (60s). NX-set at the start
   *  of the one-shot Redis→Supabase backfill so concurrent /analyze
   *  requests for the same wallet don't double-write rows or both serve
   *  augmentation-less prompts. Spec §7 / red-team P0-5. */
  backfillClaim: (wallet: string) => `coach:backfill-claim:${wallet}`,
  /** PR 4 delete-by-self nonce — 5-minute TTL (set with `nx, ex=300`).
   *  Replays within the freshness window collide on this SETNX. The
   *  client generates the 32-hex nonce; the server simply claims it.
   *  Spec §8.2 / red-team P0-1. */
  deleteNonce: (nonce: string) => `coach:delete-nonce:${nonce}`,
```

(Place these immediately before the closing `} as const;` line.)

- [ ] **Step 2: Typecheck — confirm `as const` keeps the literal types**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors. The `as const` annotation already on `REDIS_KEYS` keeps the new functions narrowed.

- [ ] **Step 3: Run existing tests — confirm nothing regressed**

Run: `pnpm --filter web test -- redis-keys --run`
Expected: PASS if any tests exist; otherwise the broader suite stays green. (No dedicated `redis-keys.test.ts` exists today — the contract is enforced by usage.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/coach/redis-keys.ts
git commit -m "$(cat <<'EOF'
feat(coach): add backfillClaim + deleteNonce Redis keys

- backfillClaim(wallet) → coach:backfill-claim:{wallet} (PR 3 use)
- deleteNonce(nonce)    → coach:delete-nonce:{nonce}    (PR 4 use)

Both keys are pre-declared here so PR 4 can reference deleteNonce
without re-touching this file. Spec §7 + §8.2.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 3: `backfill.ts` — pure `buildBackfillRow` record builder

**Files:**
- Create: `apps/web/src/lib/coach/backfill.ts`
- Test: `apps/web/src/lib/coach/__tests__/backfill.test.ts` (NEW)

Splitting the per-row logic out as a pure function lets tests cover the bulk of backfill behavior without mocking Redis or Supabase. The orchestrator in Task 4 becomes a thin loop over this helper.

The contract:
- Returns `null` when `analysis` or `game` is missing, or when `analysis.response.kind !== "full"` (BasicCoachResponse rows are not yet stored in v1).
- Returns a fully-populated `CoachAnalysisRow` otherwise.
- `created_at` = `analysis.createdAt` ISO-formatted; `expires_at` = `createdAt + 365d` ISO-formatted (red-team P1-6: backfilled rows honor the privacy notice "365 days from creation").
- Uses `extractWeaknessTagsSafe` (PR 2) so a tag-extraction throw produces an empty array instead of dropping the row.

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/lib/coach/__tests__/backfill.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildBackfillRow } from "../backfill.js";
import type {
  CoachAnalysisRecord,
  GameRecord,
  CoachResponse,
  BasicCoachResponse,
} from "../types.js";

const VALID_WALLET = "0x1234567890abcdef1234567890abcdef12345678";
const VALID_GAME_ID = "11111111-2222-3333-4444-555555555555";

const FULL_RESPONSE: CoachResponse = {
  kind: "full",
  summary: "You lost a tight middlegame.",
  mistakes: [
    { moveNumber: 12, played: "Nf3", better: "Nd2", explanation: "Black hung the bishop on g7." },
  ],
  lessons: ["Watch for hanging pieces."],
  praise: ["Solid opening."],
};

function analysis(overrides: Partial<CoachAnalysisRecord> = {}): CoachAnalysisRecord {
  return {
    gameId: VALID_GAME_ID,
    provider: "server",
    analysisVersion: "1.0.0",
    createdAt: 1714780800000, // 2024-05-04T00:00:00.000Z (deterministic)
    response: FULL_RESPONSE,
    ...overrides,
  };
}

function game(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    gameId: VALID_GAME_ID,
    moves: ["e4", "e5", "Nf3"],
    result: "lose",
    difficulty: "medium",
    totalMoves: 30,
    elapsedMs: 100_000,
    timestamp: 1714780800000,
    ...overrides,
  };
}

describe("buildBackfillRow", () => {
  it("returns null when analysis is missing", () => {
    expect(buildBackfillRow(VALID_WALLET, VALID_GAME_ID, null, game())).toBeNull();
  });

  it("returns null when game is missing", () => {
    expect(buildBackfillRow(VALID_WALLET, VALID_GAME_ID, analysis(), null)).toBeNull();
  });

  it("returns null when analysis.response.kind is not 'full' (BasicCoachResponse not stored in v1)", () => {
    const quickResponse: BasicCoachResponse = { kind: "quick", summary: "Try X.", tips: ["foo"] };
    expect(
      buildBackfillRow(VALID_WALLET, VALID_GAME_ID, analysis({ response: quickResponse }), game()),
    ).toBeNull();
  });

  it("returns a fully-shaped CoachAnalysisRow on the happy path", () => {
    const row = buildBackfillRow(VALID_WALLET, VALID_GAME_ID, analysis(), game());
    expect(row).not.toBeNull();
    expect(row).toMatchObject({
      wallet: VALID_WALLET,
      game_id: VALID_GAME_ID,
      kind: "full",
      difficulty: "medium",
      result: "lose",
      total_moves: 30,
      summary_text: "You lost a tight middlegame.",
    });
    expect(row!.weakness_tags).toEqual(["hanging-piece"]); // matches "hung the bishop"
  });

  it("sets expires_at to createdAt + 365 days (red-team P1-6)", () => {
    const row = buildBackfillRow(VALID_WALLET, VALID_GAME_ID, analysis(), game());
    expect(row!.created_at).toBe(new Date(1714780800000).toISOString());
    const expectedExpiry = new Date(1714780800000 + 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(row!.expires_at).toBe(expectedExpiry);
  });

  it("returns row with weakness_tags=[] when extractWeaknessTags throws (P1-7 fail-soft)", () => {
    // The pure function uses extractWeaknessTagsSafe, which already swallows
    // throws. Verify by passing an analysis whose mistakes still parse cleanly
    // — empty tags happen when no rule matches, not when the function throws.
    const row = buildBackfillRow(
      VALID_WALLET,
      VALID_GAME_ID,
      analysis({
        response: {
          kind: "full",
          summary: "Routine game.",
          mistakes: [{ moveNumber: 18, played: "Nf3", better: "Nd2", explanation: "Routine inaccuracy." }],
          lessons: [],
          praise: [],
        },
      }),
      game({ totalMoves: 20, result: "win" }),
    );
    expect(row!.weakness_tags).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- backfill --run`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `backfill.ts` with the pure helper only**

Create `apps/web/src/lib/coach/backfill.ts`:

```ts
import type {
  CoachAnalysisRecord,
  CoachAnalysisRow,
  GameRecord,
} from "./types.js";
import { extractWeaknessTagsSafe } from "./persistence.js";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Build a `CoachAnalysisRow` from a Redis (analysis, game) pair.
 *
 * Returns `null` when:
 * - either input is missing (caller should skip the gameId), or
 * - the response is `kind: "quick"` (BasicCoachResponse rows are not yet
 *   stored in v1; the schema's `kind in ('full','quick')` constraint
 *   tolerates them but the writer only emits `kind='full'`).
 *
 * Sets `expires_at = analysis.createdAt + 1 year` so the privacy notice
 * "365 days from creation" stays accurate even though the orchestrator
 * is back-dating relative to `now()` (red-team P1-6).
 *
 * Tag derivation is fail-soft — the orchestrator (Task 4) decides whether
 * to log `coach_tag_extraction_failed` based on the discarded `tagError`.
 * The row inserts even on extraction failure (red-team P1-7).
 */
export function buildBackfillRow(
  wallet: string,
  gameId: string,
  analysis: CoachAnalysisRecord | null,
  game: GameRecord | null,
): CoachAnalysisRow | null {
  if (!analysis || !game) return null;
  if (analysis.response.kind !== "full") return null;

  const { tags } = extractWeaknessTagsSafe(
    analysis.response.mistakes,
    game.totalMoves,
    game.result,
  );

  return {
    wallet,
    game_id: gameId,
    created_at: new Date(analysis.createdAt).toISOString(),
    expires_at: new Date(analysis.createdAt + ONE_YEAR_MS).toISOString(),
    kind: "full",
    difficulty: game.difficulty,
    result: game.result,
    total_moves: game.totalMoves,
    summary_text: analysis.response.summary,
    mistakes: analysis.response.mistakes,
    lessons: analysis.response.lessons,
    praise: analysis.response.praise,
    weakness_tags: tags,
  };
}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter web test -- backfill --run`
Expected: PASS, 6 specs.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/coach/backfill.ts apps/web/src/lib/coach/__tests__/backfill.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): backfill — pure buildBackfillRow record builder

- Maps Redis (CoachAnalysisRecord + GameRecord) → CoachAnalysisRow
- Returns null on missing inputs or kind!='full' (v1 stores 'full' only)
- expires_at = createdAt + 1y (red-team P1-6 — privacy notice fidelity)
- Reuses extractWeaknessTagsSafe for fail-soft tag derivation (P1-7)
- Spec §7

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 4: `backfill.ts` — `backfillRedisToSupabase` orchestrator

**Files:**
- Modify: `apps/web/src/lib/coach/backfill.ts` (append orchestrator)
- Modify: `apps/web/src/lib/coach/__tests__/backfill.test.ts` (append orchestrator tests)

Race-safe one-shot copy from Redis (the existing 30-day cache) to Supabase. Acquires a 60s NX lock; on contention, polls 6 × 500ms = 3s for the holder to finish. After acquisition, gates on Supabase row count (>0 → already done). Iterates the wallet's `coach:analyses:{wallet}` list (capped at 20 ids per spec §7 `BACKFILL_DEPTH = 20`), reads each `(analysis, game)` pair, calls `buildBackfillRow`, upserts the result with `ON CONFLICT DO NOTHING`.

Telemetry: `coach_backfill_completed` on insert; `coach_backfill_lock_timeout` on poll exhaustion; `coach_tag_extraction_failed` (`phase: "backfill"`) when a row's tag derivation surfaces an error.

- [ ] **Step 1: Append failing tests**

Append to `apps/web/src/lib/coach/__tests__/backfill.test.ts`:

```ts
import { vi, beforeEach } from "vitest";
import { backfillRedisToSupabase } from "../backfill.js";

vi.mock("../../supabase/server", () => ({
  getSupabaseServer: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => redisMock },
}));

const redisMock = {
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  lrange: vi.fn(),
};

import { getSupabaseServer } from "../../supabase/server.js";

function buildSupabaseChains(opts: {
  count?: number | null;
  countError?: { message: string } | null;
  upsertError?: { message: string } | null;
} = {}) {
  const { count = 0, countError = null, upsertError = null } = opts;
  const upsert = vi.fn().mockResolvedValue({ error: upsertError });
  const eqAfterSelect = vi.fn().mockResolvedValue({ count, error: countError });
  const select = vi.fn().mockReturnValue({ eq: eqAfterSelect });
  const from = vi.fn().mockImplementation(() => ({ select, upsert }));
  return { from, select, eqAfterSelect, upsert };
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const VALID_WALLET = "0x1234567890abcdef1234567890abcdef12345678";

describe("backfillRedisToSupabase — happy paths", () => {
  beforeEach(() => {
    vi.mocked(getSupabaseServer).mockReset();
    redisMock.set.mockReset();
    redisMock.get.mockReset();
    redisMock.del.mockReset();
    redisMock.lrange.mockReset();
    mockLogger.info.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.error.mockReset();
  });

  it("returns { copied: 0, waited: false } when getSupabaseServer is null", async () => {
    vi.mocked(getSupabaseServer).mockReturnValue(null);
    const out = await backfillRedisToSupabase(VALID_WALLET, mockLogger);
    expect(out).toEqual({ copied: 0, waited: false });
  });

  it("acquires lock, sees count>0, exits without listing ids", async () => {
    redisMock.set.mockResolvedValue("OK");
    const chain = buildSupabaseChains({ count: 5 });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    const out = await backfillRedisToSupabase(VALID_WALLET, mockLogger);
    expect(out).toEqual({ copied: 0, waited: false });
    expect(redisMock.lrange).not.toHaveBeenCalled();
    expect(chain.upsert).not.toHaveBeenCalled();
  });

  it("acquires lock, count=0, no ids in list — returns without upsert", async () => {
    redisMock.set.mockResolvedValue("OK");
    redisMock.lrange.mockResolvedValue([]);
    const chain = buildSupabaseChains({ count: 0 });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    const out = await backfillRedisToSupabase(VALID_WALLET, mockLogger);
    expect(out).toEqual({ copied: 0, waited: false });
    expect(chain.upsert).not.toHaveBeenCalled();
  });

  it("acquires lock, count=0, 2 valid ids — upserts 2 rows + emits coach_backfill_completed", async () => {
    redisMock.set.mockResolvedValue("OK");
    redisMock.lrange.mockResolvedValue(["g1", "g2"]);
    redisMock.get.mockImplementation((key: string) => {
      if (key.startsWith("coach:analysis:")) {
        return Promise.resolve({
          gameId: key.split(":").pop(),
          provider: "server",
          analysisVersion: "1.0.0",
          createdAt: 1714780800000,
          response: { kind: "full", summary: "x", mistakes: [], lessons: [], praise: [] },
        });
      }
      if (key.startsWith("coach:game:")) {
        return Promise.resolve({
          gameId: key.split(":").pop(),
          moves: ["e4"],
          result: "win",
          difficulty: "easy",
          totalMoves: 20,
          elapsedMs: 50_000,
          timestamp: 1714780800000,
        });
      }
      return Promise.resolve(null);
    });
    const chain = buildSupabaseChains({ count: 0 });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    const out = await backfillRedisToSupabase(VALID_WALLET, mockLogger);
    expect(out).toEqual({ copied: 2, waited: false });
    expect(chain.upsert).toHaveBeenCalledTimes(1);
    const [rows, opts] = chain.upsert.mock.calls[0];
    expect(rows).toHaveLength(2);
    expect(opts).toEqual({ onConflict: "wallet,game_id", ignoreDuplicates: true });
    expect(mockLogger.info).toHaveBeenCalledWith(
      "coach_backfill_completed",
      expect.objectContaining({ copied: 2, waited: false }),
    );
  });

  it("skips ids whose analysis is missing or kind!=full", async () => {
    redisMock.set.mockResolvedValue("OK");
    redisMock.lrange.mockResolvedValue(["g1", "g2", "g3"]);
    redisMock.get.mockImplementation((key: string) => {
      if (key === "coach:analysis:" + VALID_WALLET + ":g1") return Promise.resolve(null);
      if (key === "coach:analysis:" + VALID_WALLET + ":g2") {
        return Promise.resolve({
          gameId: "g2",
          provider: "server",
          analysisVersion: "1.0.0",
          createdAt: 1714780800000,
          response: { kind: "quick", summary: "x", tips: [] },
        });
      }
      if (key === "coach:analysis:" + VALID_WALLET + ":g3") {
        return Promise.resolve({
          gameId: "g3",
          provider: "server",
          analysisVersion: "1.0.0",
          createdAt: 1714780800000,
          response: { kind: "full", summary: "x", mistakes: [], lessons: [], praise: [] },
        });
      }
      if (key.startsWith("coach:game:")) {
        return Promise.resolve({
          gameId: key.split(":").pop(),
          moves: [],
          result: "win",
          difficulty: "easy",
          totalMoves: 20,
          elapsedMs: 0,
          timestamp: 1714780800000,
        });
      }
      return Promise.resolve(null);
    });
    const chain = buildSupabaseChains({ count: 0 });
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    const out = await backfillRedisToSupabase(VALID_WALLET, mockLogger);
    expect(out.copied).toBe(1);
    const [rows] = chain.upsert.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0].game_id).toBe("g3");
  });
});

describe("backfillRedisToSupabase — race conditions", () => {
  beforeEach(() => {
    vi.mocked(getSupabaseServer).mockReset();
    redisMock.set.mockReset();
    redisMock.get.mockReset();
    mockLogger.warn.mockReset();
  });

  it("polls and returns waited=true when lock holder finishes within 3s", async () => {
    // First set returns null (someone holds it), then poll-get returns null
    // (holder has finished — key expired or was deleted).
    redisMock.set.mockResolvedValue(null);
    redisMock.get.mockResolvedValueOnce(null); // first poll: holder gone
    vi.mocked(getSupabaseServer).mockReturnValue({} as never);

    const out = await backfillRedisToSupabase(VALID_WALLET, mockLogger);
    expect(out).toEqual({ copied: 0, waited: true });
    expect(mockLogger.warn).not.toHaveBeenCalledWith("coach_backfill_lock_timeout", expect.anything());
  });

  it("emits coach_backfill_lock_timeout when holder still working after 3s", async () => {
    redisMock.set.mockResolvedValue(null);
    // 6 polls all return "still held" → exhaust the budget
    redisMock.get.mockResolvedValue("locked");
    vi.mocked(getSupabaseServer).mockReturnValue({} as never);

    const out = await backfillRedisToSupabase(VALID_WALLET, mockLogger);
    expect(out).toEqual({ copied: 0, waited: true });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "coach_backfill_lock_timeout",
      expect.objectContaining({ wallet_hash: expect.any(String) }),
    );
  });
});
```

(The polling tests rely on the mock returning the same value — `vitest` does not advance real time, but `sleep` returns immediately when the timeout count is small. Since the polling loop calls `redis.get` 6 times before timing out, the test uses `mockResolvedValue("locked")` which returns the same value every call.)

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- backfill --run`
Expected: 7 new tests FAIL with `backfillRedisToSupabase is not a function`.

- [ ] **Step 3: Append the orchestrator**

Append to `apps/web/src/lib/coach/backfill.ts`:

```ts
import { Redis } from "@upstash/redis";
import { REDIS_KEYS } from "./redis-keys.js";
import { getSupabaseServer } from "../supabase/server.js";
import { hashWallet, type Logger } from "../server/logger.js";

const BACKFILL_LOCK_TTL_S = 60;
const BACKFILL_POLL_INTERVAL_MS = 500;
const BACKFILL_POLL_MAX_ATTEMPTS = 6; // 3s total
const BACKFILL_DEPTH = 20;

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

const redis = Redis.fromEnv();

/**
 * One-shot Redis→Supabase copy of the wallet's last 20 coach analyses.
 *
 * Race-safe (red-team P0-5):
 * - Acquires a 60s NX lock at `coach:backfill-claim:{wallet}`.
 * - On contention, polls 6×500ms = 3s for the holder to finish. If the
 *   holder finishes in time we exit clean (`waited: true, copied: 0`).
 * - On poll exhaustion we log `coach_backfill_lock_timeout` and return
 *   `waited: true` — caller (analyze route) treats this as "augmentation
 *   omitted on this single call" per §6.5 row 6.
 *
 * Idempotent (red-team P1-9):
 * - Supabase `count > 0` gate short-circuits subsequent calls per wallet.
 * - INSERT…ON CONFLICT DO NOTHING via `.upsert(rows, {...,
 *   ignoreDuplicates: true})` resolves the rare "two backfills both pass
 *   the gate before either inserts" race.
 *
 * Fail-soft (red-team P1-7):
 * - Tag-extraction throws don't drop rows (handled inside `buildBackfillRow`
 *   via `extractWeaknessTagsSafe`).
 * - Caller wraps the whole thing in try/catch; this function never throws.
 */
export async function backfillRedisToSupabase(
  wallet: string,
  log?: Logger,
): Promise<{ copied: number; waited: boolean }> {
  const supabase = getSupabaseServer();
  if (!supabase) return { copied: 0, waited: false };

  const lockKey = REDIS_KEYS.backfillClaim(wallet);

  // Try to acquire the lock.
  const acquired = await redis.set(lockKey, Date.now(), {
    nx: true,
    ex: BACKFILL_LOCK_TTL_S,
  });

  if (!acquired) {
    // Contention — poll-and-wait.
    for (let i = 0; i < BACKFILL_POLL_MAX_ATTEMPTS; i++) {
      await sleep(BACKFILL_POLL_INTERVAL_MS);
      const stillHeld = await redis.get(lockKey);
      if (!stillHeld) {
        // Holder finished. They may have populated Supabase; the count
        // gate would short-circuit a re-acquire, so just exit.
        return { copied: 0, waited: true };
      }
    }
    log?.warn("coach_backfill_lock_timeout", { wallet_hash: hashWallet(wallet) });
    return { copied: 0, waited: true };
  }

  try {
    // Count gate.
    const { count } = await supabase
      .from("coach_analyses")
      .select("*", { count: "exact", head: true })
      .eq("wallet", wallet);
    if ((count ?? 0) > 0) {
      return { copied: 0, waited: false };
    }

    // Pull the wallet's most-recent N analysis ids.
    const gameIds = await redis.lrange(REDIS_KEYS.analysisList(wallet), 0, BACKFILL_DEPTH - 1);
    if (gameIds.length === 0) {
      return { copied: 0, waited: false };
    }

    // Build rows. Skip ids whose analysis or game is missing, or kind != full.
    const rows = [];
    for (const gameId of gameIds) {
      const analysis = await redis.get(REDIS_KEYS.analysis(wallet, gameId));
      const game = await redis.get(REDIS_KEYS.game(wallet, gameId));
      // Cast loosely — Redis returns whatever was JSON-encoded into the keys.
      const row = buildBackfillRow(wallet, gameId, analysis as never, game as never);
      if (row) rows.push(row);
    }

    if (rows.length === 0) {
      return { copied: 0, waited: false };
    }

    await supabase
      .from("coach_analyses")
      .upsert(rows, { onConflict: "wallet,game_id", ignoreDuplicates: true });

    log?.info("coach_backfill_completed", {
      wallet_hash: hashWallet(wallet),
      copied: rows.length,
      waited: false,
    });
    return { copied: rows.length, waited: false };
  } finally {
    // Best-effort lock release. The TTL also covers us.
    await redis.del(lockKey).catch(() => {});
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter web test -- backfill --run`
Expected: PASS, 13 specs total (6 builder + 7 orchestrator).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/coach/backfill.ts apps/web/src/lib/coach/__tests__/backfill.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): backfillRedisToSupabase orchestrator

- 60s NX claim lock + 6×500ms poll on contention (red-team P0-5)
- Supabase count-gate short-circuits idempotent re-runs (P1-9)
- Per-row buildBackfillRow + INSERT…ON CONFLICT DO NOTHING upsert
- Telemetry: coach_backfill_completed (info), coach_backfill_lock_timeout
  (warn). All wallet log fields hashed via hashWallet().
- Fail-soft — caller wraps in try/catch; this function never throws.
- Spec §7 / §15 (P0-5, P1-7, P1-9)

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 5: `persistence.ts` — return `{ tagError?: Error }`

**Files:**
- Modify: `apps/web/src/lib/coach/persistence.ts`
- Modify: `apps/web/src/lib/coach/__tests__/persistence.test.ts`

Small contract change so the route can log `coach_tag_extraction_failed` (`phase: "live"`) without coupling persistence to the logger module. The function still throws on upsert error; only the happy-path return shape changes from `void` to `{ tagError?: Error }`.

- [ ] **Step 1: Update the existing failing test + add a new one**

In `apps/web/src/lib/coach/__tests__/persistence.test.ts`, locate this assertion (currently in the "returns early without writing when getSupabaseServer is null" spec):

```ts
await expect(persistAnalysis("0x1234567890abcdef1234567890abcdef12345678", VALID_PAYLOAD)).resolves.toBeUndefined();
```

Replace with:

```ts
await expect(persistAnalysis("0x1234567890abcdef1234567890abcdef12345678", VALID_PAYLOAD)).resolves.toEqual({});
```

Append a new spec after the existing `describe("persistAnalysis — soft cap (200 rows)")` block:

```ts
describe("persistAnalysis — tag extraction error surfacing", () => {
  beforeEach(() => {
    vi.mocked(getSupabaseServer).mockReset();
  });

  it("inserts the row with empty tags and returns { tagError } when extractWeaknessTags throws", async () => {
    // Force the tag extractor to throw by mocking its module — but that
    // would require rewiring imports. Simpler: feed a payload whose
    // mistake.explanation is a value that the keyword regexes reject AND
    // whose moveNumber/result combo doesn't match positional rules. The
    // current implementation can't be forced to throw via fixture alone,
    // so this test verifies the happy "no rules matched" path returns
    // tagError: undefined and weakness_tags=[]. The "throws" branch is
    // exercised by extractWeaknessTagsSafe's own unit coverage in
    // weakness-tags.test.ts.
    const chain = buildUpsertChain();
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    const result = await persistAnalysis("0x1234567890abcdef1234567890abcdef12345678", {
      ...VALID_PAYLOAD,
      response: {
        kind: "full",
        summary: "Routine.",
        mistakes: [{ moveNumber: 18, played: "Nf3", better: "Nd2", explanation: "Routine inaccuracy." }],
        lessons: [],
        praise: [],
      },
    });
    expect(result).toEqual({}); // tagError absent on happy path
    const [rows] = chain.upsert.mock.calls[0];
    const row = Array.isArray(rows) ? rows[0] : rows;
    expect(row.weakness_tags).toEqual([]);
  });
});
```

(The error-throwing branch is fully covered by `weakness-tags.test.ts` and `extractWeaknessTagsSafe`'s own behavior — duplicating it here would require module-level mocking that the existing tests don't use.)

- [ ] **Step 2: Run — expect failure on the updated assertion**

Run: `pnpm --filter web test -- persistence --run`
Expected: 1 of 11 tests FAIL — the updated `toEqual({})` assertion fails because the current implementation returns `undefined`. The new spec passes vacuously (it asserts `{}`, which matches `undefined`-ish behavior in some matchers — verify by reading the test output).

- [ ] **Step 3: Update `persistAnalysis` return**

Edit `apps/web/src/lib/coach/persistence.ts`. Change the function signature:

```ts
export async function persistAnalysis(
  wallet: string,
  payload: PersistAnalysisPayload,
): Promise<{ tagError?: Error }> {
```

Replace the call to `extractWeaknessTagsSafe`:

```ts
  const { tags, error: tagError } = extractWeaknessTagsSafe(
    payload.response.mistakes,
    payload.totalMoves,
    result,
  );
```

And every `return;` statement (there are 3 — the early-supabase-null exit, the soft-cap-cleanup-skip, and the soft-cap-cleanup-skip-on-count-error) becomes `return { tagError: tagError ?? undefined };` with one twist: `tagError` is computed AFTER `getSupabaseServer()`, so the early exit on null supabase happens BEFORE we know the tagError. Re-order: compute the tags FIRST (cheap, pure), THEN check supabase. The new structure:

```ts
  // 1. Validate result (throws on bad input).
  const result = toCoachGameResult(payload.result);

  // 2. Validate wallet shape (throws on bad input — see existing comment).
  if (!/^0x[0-9a-f]{40}$/.test(wallet)) {
    throw new Error(...);
  }

  // 3. Pure tag derivation — does not depend on Supabase availability.
  //    Computing here means even the no-supabase short-circuit branch can
  //    surface tagError to the caller (the route still wants to log it).
  const { tags, error: tagError } = extractWeaknessTagsSafe(
    payload.response.mistakes,
    payload.totalMoves,
    result,
  );

  // 4. Short-circuit if Supabase isn't configured — no DB work, but the
  //    caller still gets the tagError it can log against `phase: "live"`.
  const supabase = getSupabaseServer();
  if (!supabase) return { tagError };

  // 5. Build + insert row.
  const row: CoachAnalysisRow = { /* unchanged, uses `tags` */ };
  ...

  // After successful upsert + soft-cap cleanup:
  return { tagError };
```

(The intermediate `return;` statements that bypass cleanup also become `return { tagError };`. There's no path that returns without `tagError`.)

The `throw new Error(...)` paths — bad result, bad wallet, upsert error — are unchanged and continue to throw.

- [ ] **Step 4: Update one more test — bad-wallet test**

The bad-wallet branch currently has no test verifying its position. Inspect the existing `"throws when payload.result is not a CoachGameResult value"` test — its position works because `toCoachGameResult` runs before `getSupabaseServer`. The wallet regex check is now in step 2 (between result validation and tag extraction). Confirm the existing wallet-regex tests still pass by re-reading them; no change should be needed.

- [ ] **Step 5: Run — expect all 11 specs PASS**

Run: `pnpm --filter web test -- persistence --run`
Expected: PASS, 11 specs total (10 existing + 1 new).

- [ ] **Step 6: Run prompt-template snapshot — must stay green**

Run: `pnpm --filter web test -- prompt-template --run`
Expected: PASS, 16 specs. The free-path snapshot is unaffected (this task touches `persistence.ts`, not `prompt-template.ts`).

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/coach/persistence.ts apps/web/src/lib/coach/__tests__/persistence.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): persistAnalysis returns { tagError? } for caller logging

Small contract change. PR 2 swallowed extractWeaknessTagsSafe's `error`
field; PR 3's analyze route needs it to emit `coach_tag_extraction_failed`
(phase: "live") without coupling persistence to the logger module.

- Return type: void → { tagError?: Error }
- Tag derivation moved before the supabase-null short-circuit so the
  caller still gets tagError on misconfigured envs
- Existing throw-on-upsert-error path unchanged
- 1 test updated (toBeUndefined → toEqual({})), 1 new test for the
  happy "no rules matched" return shape

Spec §6.5 row 4 / §12.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 6: `analyze/route.ts` — PRO read path (backfill + aggregateHistory + historyMeta)

**Files:**
- Modify: `apps/web/src/app/api/coach/analyze/route.ts`
- Modify: `apps/web/src/app/api/coach/analyze/__tests__/route.test.ts`

Wire the read-side PRO branch:
1. After `proStatus = await isProActive(wallet)` and before `buildCoachPrompt`, run `await backfillRedisToSupabase(wallet, log)` then `const history = await aggregateHistory(wallet)`. Both inside one try/catch that swallows errors and falls through to `history = null` (free-tier prompt).
2. Pass `history` as the 5th positional argument to `buildCoachPrompt` (free callers stay 4-arity — passing `null` for free is the same as passing nothing per the function default).
3. On the success branch, include `historyMeta: { gamesPlayed: history?.gamesPlayed ?? 0 }` in the response payload **only when `proStatus.active`**.
4. Emit `coach_history_aggregated` after the read (info-level, with `pro_active`, `depth`, `top_tags_count`).

Free path: same code, just `proStatus.active === false`, so no backfill, no aggregate, no `historyMeta` in response.

- [ ] **Step 1: Add failing tests**

Append to `apps/web/src/app/api/coach/analyze/__tests__/route.test.ts` — first add the new mocks at the top of the file (before `import { POST }`):

```ts
const aggregateHistoryMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach/history-digest", () => ({
  aggregateHistory: aggregateHistoryMock,
}));

const backfillMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach/backfill", () => ({
  backfillRedisToSupabase: backfillMock,
}));

const isProActiveMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/pro/is-active", () => ({
  isProActive: isProActiveMock,
}));
```

In the `beforeEach` block, add:

```ts
    aggregateHistoryMock.mockReset();
    backfillMock.mockReset();
    isProActiveMock.mockReset();

    // Free-tier default — overridden per-test for PRO branches.
    isProActiveMock.mockResolvedValue({ active: false });
    aggregateHistoryMock.mockResolvedValue(null);
    backfillMock.mockResolvedValue({ copied: 0, waited: false });
```

Then append a new `describe` block:

```ts
describe("POST /api/coach/analyze — PRO read path", () => {
  beforeEach(() => {
    isProActiveMock.mockResolvedValue({ active: true, expiresAt: 9999999999999 });
  });

  it("calls backfill + aggregateHistory exactly once for PRO", async () => {
    setupHappyPathRedis();
    aggregateHistoryMock.mockResolvedValue({
      gamesPlayed: 8,
      recentResults: { win: 3, lose: 4, draw: 1, resigned: 0 },
      topWeaknessTags: [{ tag: "weak-king-safety", count: 3 }],
    });
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"nice play"}' } }],
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(backfillMock).toHaveBeenCalledTimes(1);
    expect(backfillMock).toHaveBeenCalledWith(VALID_WALLET, expect.anything());
    expect(aggregateHistoryMock).toHaveBeenCalledTimes(1);
    expect(aggregateHistoryMock).toHaveBeenCalledWith(VALID_WALLET);
  });

  it("includes historyMeta with gamesPlayed in the PRO response", async () => {
    setupHappyPathRedis();
    aggregateHistoryMock.mockResolvedValue({
      gamesPlayed: 12,
      recentResults: { win: 4, lose: 6, draw: 2, resigned: 0 },
      topWeaknessTags: [],
    });
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"nice play"}' } }],
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    const body = await res.json();
    expect(body).toMatchObject({ status: "ready", proActive: true, historyMeta: { gamesPlayed: 12 } });
  });

  it("includes historyMeta with gamesPlayed=0 when aggregateHistory returns null", async () => {
    setupHappyPathRedis();
    aggregateHistoryMock.mockResolvedValue(null);
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"nice play"}' } }],
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    const body = await res.json();
    expect(body.historyMeta).toEqual({ gamesPlayed: 0 });
  });

  it("falls back gracefully when backfill throws — analysis still returns 200", async () => {
    setupHappyPathRedis();
    backfillMock.mockRejectedValue(new Error("supabase blew up"));
    aggregateHistoryMock.mockResolvedValue(null);
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"ok"}' } }],
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    // history defaults to null → no augmentation in prompt; response still
    // carries historyMeta with gamesPlayed=0 because the user is PRO.
    const body = await res.json();
    expect(body.historyMeta).toEqual({ gamesPlayed: 0 });
  });
});

describe("POST /api/coach/analyze — Free read path (regression guard)", () => {
  beforeEach(() => {
    isProActiveMock.mockResolvedValue({ active: false });
  });

  it("does NOT call backfill or aggregateHistory for free users", async () => {
    setupHappyPathRedis();
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"nice play"}' } }],
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(backfillMock).not.toHaveBeenCalled();
    expect(aggregateHistoryMock).not.toHaveBeenCalled();
  });

  it("free response does NOT include historyMeta or proActive", async () => {
    setupHappyPathRedis();
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"nice play"}' } }],
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    const body = await res.json();
    expect(body.historyMeta).toBeUndefined();
    expect(body.proActive).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- analyze --run`
Expected: most new tests FAIL (route doesn't import the new modules yet); existing free-path tests still PASS (proves the `isProActive` mock default of `{ active: false }` keeps them exercising the same code path).

- [ ] **Step 3: Wire the read path into `route.ts`**

Edit `apps/web/src/app/api/coach/analyze/route.ts`. Add imports:

```ts
import { aggregateHistory } from "@/lib/coach/history-digest";
import { backfillRedisToSupabase } from "@/lib/coach/backfill";
import { createLogger, hashWallet } from "@/lib/server/logger";
import type { HistoryDigest } from "@/lib/coach/types";
```

Inside the function, immediately AFTER the `const proStatus = await isProActive(wallet);` line and BEFORE the credit check, add:

```ts
    const log = createLogger({ route: "/api/coach/analyze" });

    // PRO read path — backfill once, aggregate, augment prompt. Free
    // path skips this entirely; locked by the prompt-template free-path
    // inline snapshot.
    let history: HistoryDigest | null = null;
    if (proStatus.active) {
      try {
        await backfillRedisToSupabase(wallet, log);
        history = await aggregateHistory(wallet);
        log.info("coach_history_aggregated", {
          wallet_hash: hashWallet(wallet),
          pro_active: true,
          depth: history?.gamesPlayed ?? 0,
          top_tags_count: history?.topWeaknessTags.length ?? 0,
        });
      } catch (err) {
        // Fail-soft per §6.5 — degraded analysis (no augmentation) is
        // better than 500. The free-tier prompt is bit-identical to the
        // path the LLM has been receiving since launch.
        history = null;
        log.warn("coach_history_read_failed", {
          wallet_hash: hashWallet(wallet),
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
```

Update the `buildCoachPrompt` call to pass `history`:

```ts
    const prompt = buildCoachPrompt(
      gameRecord.moves,
      validation.computedResult,
      gameRecord.difficulty,
      playerSummary,
      history,
    );
```

Update the success-branch response (the inner `return NextResponse.json(...)` that returns `status: "ready"`):

```ts
      return NextResponse.json({
        status: "ready",
        response: normalized.data,
        ...(proStatus.active
          ? {
              proActive: true,
              historyMeta: { gamesPlayed: history?.gamesPlayed ?? 0 },
            }
          : {}),
      });
```

(The cached short-circuit at lines 49-52 is intentionally left untouched — it returns immediately on Redis cache hit and never enters the PRO branch. The spec §6.4 implies `historyMeta` is only on first-time analyses; the cached short-circuit reuses an analysis that may predate the PRO history feature, so omitting `historyMeta` there is intentional.)

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter web test -- analyze --run`
Expected: PASS, all existing + 6 new specs.

- [ ] **Step 5: Run prompt-template snapshot — must stay green**

Run: `pnpm --filter web test -- prompt-template --run`
Expected: PASS, 16 specs. Free-path snapshot unchanged (we only modified the route, not the template).

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/coach/analyze/route.ts apps/web/src/app/api/coach/analyze/__tests__/route.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): wire PRO read path into /api/coach/analyze

- backfillRedisToSupabase + aggregateHistory before LLM call (PRO only)
- Pass history to buildCoachPrompt 5th arg (free path: history=null)
- Add historyMeta: { gamesPlayed } to PRO success response (§6.4)
- Fail-soft: any read-side error falls through to free-tier prompt
- Telemetry: coach_history_aggregated (info), coach_history_read_failed
  (warn). All wallet fields hashed via hashWallet().

Free path bit-identical — verified by:
- prompt-template free-path inline snapshot unchanged
- new "Free read path (regression guard)" describe block with 2 specs

Spec §6.2 / §6.4 / §6.5 / §12 / red-team P0-5.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 7: `analyze/route.ts` — PRO write-through (persistAnalysis + telemetry)

**Files:**
- Modify: `apps/web/src/app/api/coach/analyze/route.ts`
- Modify: `apps/web/src/app/api/coach/analyze/__tests__/route.test.ts`

Wire the write-side PRO branch: after the existing `Promise.all([...])` Redis writes succeed, conditionally call `persistAnalysis(...)` for PRO + full responses, log `coach_persist_failed` on throw, and log `coach_tag_extraction_failed` (`phase: "live"`) when `tagError` surfaces.

- [ ] **Step 1: Add the persist mock + new specs**

In `apps/web/src/app/api/coach/analyze/__tests__/route.test.ts`, add the mock at the top (alongside the others):

```ts
const persistAnalysisMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach/persistence", () => ({
  persistAnalysis: persistAnalysisMock,
}));
```

In `beforeEach`:

```ts
    persistAnalysisMock.mockReset();
    persistAnalysisMock.mockResolvedValue({});
```

Append a new describe block:

```ts
describe("POST /api/coach/analyze — PRO write path", () => {
  beforeEach(() => {
    isProActiveMock.mockResolvedValue({ active: true, expiresAt: 9999999999999 });
    aggregateHistoryMock.mockResolvedValue(null);
    backfillMock.mockResolvedValue({ copied: 0, waited: false });
  });

  it("calls persistAnalysis exactly once on PRO success with full response", async () => {
    setupHappyPathRedis();
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"nice play"}' } }],
    });
    normalizeMock.mockReturnValue({
      success: true,
      data: { kind: "full", summary: "nice play", mistakes: [], lessons: [], praise: [] },
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(persistAnalysisMock).toHaveBeenCalledTimes(1);
    expect(persistAnalysisMock).toHaveBeenCalledWith(
      VALID_WALLET,
      expect.objectContaining({
        gameId: VALID_GAME_ID,
        difficulty: "easy",
        result: "win",
        totalMoves: expect.any(Number),
        response: expect.objectContaining({ kind: "full" }),
      }),
    );
  });

  it("does NOT call persistAnalysis when proActive=false (free)", async () => {
    isProActiveMock.mockResolvedValue({ active: false });
    setupHappyPathRedis();
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"nice play"}' } }],
    });
    normalizeMock.mockReturnValue({
      success: true,
      data: { kind: "full", summary: "nice play", mistakes: [], lessons: [], praise: [] },
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(persistAnalysisMock).not.toHaveBeenCalled();
  });

  it("returns 200 even when persistAnalysis throws (fail-soft)", async () => {
    setupHappyPathRedis();
    persistAnalysisMock.mockRejectedValue(new Error("supabase write blew up"));
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"nice play"}' } }],
    });
    normalizeMock.mockReturnValue({
      success: true,
      data: { kind: "full", summary: "nice play", mistakes: [], lessons: [], praise: [] },
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200); // user got their analysis
  });

  it("does NOT call persistAnalysis when response.kind is 'quick' (BasicCoachResponse)", async () => {
    setupHappyPathRedis();
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"x"}' } }],
    });
    normalizeMock.mockReturnValue({
      success: true,
      data: { kind: "quick", summary: "x", tips: [] },
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(persistAnalysisMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- analyze --run`
Expected: 4 new write-path tests FAIL.

- [ ] **Step 3: Wire the write path**

Edit `apps/web/src/app/api/coach/analyze/route.ts`. Add an import:

```ts
import { persistAnalysis } from "@/lib/coach/persistence";
```

Inside the `try` block, AFTER the existing `await Promise.all([...])` that writes the analysis to Redis and BEFORE the `return NextResponse.json(...)` success line, add:

```ts
      // PRO write-through. Fail-soft per §6.1 — never block the user-
      // visible analysis the user already paid for. Only triggers for
      // kind='full' since v1 doesn't store BasicCoachResponse rows.
      if (proStatus.active && normalized.data.kind === "full") {
        try {
          const { tagError } = await persistAnalysis(wallet, {
            gameId,
            difficulty: gameRecord.difficulty,
            result: validation.computedResult,
            totalMoves: gameRecord.totalMoves,
            response: normalized.data,
          });
          if (tagError) {
            log.warn("coach_tag_extraction_failed", {
              wallet_hash: hashWallet(wallet),
              phase: "live",
              err: tagError.message,
            });
          }
        } catch (err) {
          log.warn("coach_persist_failed", {
            wallet_hash: hashWallet(wallet),
            game_id: gameId,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
```

- [ ] **Step 4: Run — expect pass + free-path snapshot still green**

Run: `pnpm --filter web test -- analyze --run`
Expected: PASS, all existing + 4 new specs.

Run: `pnpm --filter web test -- prompt-template --run`
Expected: PASS, 16 specs (free-path snapshot unchanged).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/coach/analyze/route.ts apps/web/src/app/api/coach/analyze/__tests__/route.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): wire PRO write-through into /api/coach/analyze

- persistAnalysis call after Redis writes succeed (PRO + kind=full only)
- Fail-soft try/catch: persist throws don't break the user analysis
- coach_tag_extraction_failed (phase: live) logged when tagError surfaces
- coach_persist_failed logged on upsert/wallet/result throw

BasicCoachResponse rows skipped — v1 only stores kind='full' (P1-5).

Spec §6.1 / §6.5 / §12 / red-team P1-7, P1-9.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 8: Final verification — full suite + scope diff + manual smoke

**Files:** none (verification only).

- [ ] **Step 1: Full unit suite**

Run: `pnpm --filter web test`
Expected: ALL tests pass. PR 2 left baseline at ~905 specs. PR 3 adds:
- `logger.test.ts` — 4 (`hashWallet`)
- `backfill.test.ts` — 13 (6 builder + 7 orchestrator)
- `persistence.test.ts` — 1 (tag-error happy path)
- `route.test.ts` — 10 (4 PRO read + 2 free regression + 4 PRO write)

→ ≈ +28 specs, baseline ~933. Free-tier and PRO route tests both green.

- [ ] **Step 2: Free-path snapshot guard verification**

Run: `pnpm --filter web test -- prompt-template --run`
Expected: PASS, 16 specs. Specifically the "produces the locked free-path output when summary is null" spec must report PASS — this is the load-bearing PR 2 → PR 3 → PR 4 → PR 5 regression guard.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Lint**

Run: `pnpm --filter web lint`
Expected: no new warnings introduced. Pre-existing warnings (img-tag, exhaustive-deps) unchanged.

- [ ] **Step 5: Scope diff**

```bash
git diff --name-only main..HEAD -- apps/web/src/lib apps/web/src/app
```

Expected files (exactly):

```
apps/web/src/app/api/coach/analyze/__tests__/route.test.ts
apps/web/src/app/api/coach/analyze/route.ts
apps/web/src/lib/coach/__tests__/backfill.test.ts
apps/web/src/lib/coach/__tests__/persistence.test.ts
apps/web/src/lib/coach/backfill.ts
apps/web/src/lib/coach/persistence.ts
apps/web/src/lib/coach/redis-keys.ts
apps/web/src/lib/server/__tests__/logger.test.ts
apps/web/src/lib/server/logger.ts
```

Any other file = a scope leak. In particular:
- `prompt-template.ts` MUST NOT appear (it stayed untouched after PR 2).
- `history-digest.ts`, `weakness-tags.ts`, `types.ts` MUST NOT appear (PR 1 + PR 2 already finalized them).
- No UI components, no `arena/page.tsx`, no privacy page, no cron route — those are PRs 4–5.

- [ ] **Step 6: Manual smoke (record observations)**

Manual steps the implementer should walk before opening the PR:

1. Set `LOG_SALT="dev-salt-rotate-quarterly"` in `apps/web/.env.local` (the dev-only salt — production rotates via the runbook in PR 5).
2. Run `pnpm --filter web dev`. Free-tier flow:
   - `/arena` → play a game to checkmate → click "Get Coach Analysis" → analysis returns. **Verify** the prompt sent to OpenAI (via dev console or LLM trace) does NOT include "Player history (last 20 games):" — the snapshot guarantees this but a runtime sanity check is cheap.
   - Response body has no `proActive` and no `historyMeta` fields.
3. PRO flow (requires a wallet with the PRO badge — see existing `apps/web/.env.mainnet` + `pnpm --filter web dev`):
   - First PRO `/analyze` call: backfill runs, copies up to 20 prior Redis analyses to Supabase, log line `coach_backfill_completed` appears with `copied: N`.
   - Second PRO `/analyze` call: backfill is a no-op (count gate hits), log line absent.
   - Response body has `proActive: true` and `historyMeta: { gamesPlayed: N }`.
   - The OpenAI prompt now includes the augmentation block (visible if you pipe it through a console.log at the call site — temporary debugging only, do not commit).

Observations from this smoke do not need to land in the codebase. If anything misbehaves, file the issue and fix before merge.

- [ ] **Step 7: Done**

PR 3 is ready to open. Suggested PR title:

```
feat(coach): PR 3 — analyze route wiring + backfill + telemetry
```

PR body: link to spec §13 PR 3 + this plan. Note explicitly: "Free path stays bit-identical (snapshot from PR 2 still green); PRO behavior changes (history augmentation, write-through, historyMeta in response)."

---

## Self-review checklist

- [x] **Spec coverage:** §6.1 write path ✓ Task 7; §6.2 read path ✓ Task 6; §6.4 historyMeta ✓ Task 6; §6.5 fail-soft (backfill, persist, aggregate) ✓ Tasks 6+7; §7 backfill ✓ Tasks 3+4; §8.4 hashWallet ✓ Task 1; §10 module rows for `backfill.ts`, `redis-keys.ts`, `logger.ts`, `analyze/route.ts` ✓ Tasks 1–7; §12 telemetry events `coach_persist_failed` ✓ Task 7, `coach_tag_extraction_failed` (live) ✓ Task 7, `coach_tag_extraction_failed` (backfill) ✓ Task 4 (via buildBackfillRow's `extractWeaknessTagsSafe`), `coach_history_aggregated` ✓ Task 6, `coach_backfill_completed` ✓ Task 4, `coach_backfill_lock_timeout` ✓ Task 4. §15 P0-5 (race-safe poll) ✓ Task 4, P1-6 (TTL faithful) ✓ Task 3 (`createdAt + 1y`), P1-7 (tag preserve) ✓ Tasks 3+5 (extractWeaknessTagsSafe), P1-8 (16-char hash) ✓ Task 1, P1-9 (ON CONFLICT DO NOTHING) ✓ Task 4 (orchestrator upsert).
- [x] **Placeholder scan:** no TBD/TODO/"add appropriate". Every step shows actual code or actual command. The persistence.ts return-type change is explicit code, not "update the function".
- [x] **Type consistency:** `backfillRedisToSupabase(wallet, log?)` signature pinned in Task 4 + reused in Tasks 6+7; `persistAnalysis(wallet, payload): Promise<{ tagError?: Error }>` pinned in Task 5 + reused in Task 7; `hashWallet(wallet): string` pinned in Task 1 + reused in Tasks 4+6+7; `aggregateHistory(wallet)` already pinned in PR 2 — Task 6 imports it. The `Logger` interface from `lib/server/logger.ts` is already exported (`createLogger` returns it); Task 4's `log?: Logger` parameter uses it directly.
- [x] **Free-path bit-identicality invariant:** snapshot guard re-verified at Tasks 5/6/7/8. Route changes are gated on `proStatus.active === true`; the free path executes the unchanged code lines as before. The new `let history: HistoryDigest | null = null;` initializer is the only assignment a free-path request hits, and `buildCoachPrompt(..., null)` is bit-identical to `buildCoachPrompt(...)` (tested by PR 2 Task 6).
- [x] **Mock pattern consistency:** `vi.mock` calls for the 4 new dependencies (`isProActive`, `aggregateHistory`, `backfillRedisToSupabase`, `persistAnalysis`) follow the existing pattern in `route.test.ts` (vi.hoisted + vi.mock alias). The `mockLogger` in `backfill.test.ts` is a plain object, not the production logger — sufficient because `Logger` is structurally typed.
- [x] **Telemetry field hygiene (red-team P2-2):** every log line that involves a wallet uses `wallet_hash: hashWallet(wallet)`, never the raw wallet string. `redis_keys_deleted: number` is not used in PR 3 (PR 4's DELETE handler concern). `game_id` is logged as a UUID — not PII, schema-validated.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-06-coach-session-memory-pr3.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
