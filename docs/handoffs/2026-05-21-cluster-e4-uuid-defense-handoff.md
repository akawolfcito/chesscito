# Session Handoff — 2026-05-21 (Cluster E #4 · UUID defense-in-depth)

Sixth session of the day. Closes **Cluster E adversarial-review defer #4**
(edge-case hunter #11) — defense-in-depth UUID validation on both the
server GET path and the client parse path so a corrupt `gameId` never
reaches `/api/coach/analyze` to die silently on a 400.

Sibling sessions today:

- `2026-05-21-session-handoff.md` (editorial cleanup + DeepSeek)
- `2026-05-21-traceability-hygiene-handoff.md` (Acción B housekeeping)
- `2026-05-21-vr-fixture-harness-handoff.md` (VR-5/7/8 fixture harness)
- `2026-05-21-cluster-e-hardening-trio-handoff.md` (Blind #12 + Edge #5 + Edge #16-telemetry)
- `2026-05-21-cluster-e1-lua-atomicity-handoff.md` (defer #1 — Lua atomicity)

## Status snapshot

- **Branch**: `main` — pushed (`origin/main` at `7c0e4b8b`).
- **Build**: 1758 passing / 0 baseline failing · `tsc` clean.
- **Test trajectory**: 1743 → 1746 → 1749 → **1758** (+15 net).

## Also this session — housekeeping

- **PR #107 (`phase-1-ui-zone-map`) triage finalized.** PR was closed
  by Wolfcito earlier today (14:00:55Z) with a SHA-mapping comment
  proving all 9 commits had been cherry-picked to main
  (`e46aaa2c..11f9ff23`). Confirmed: branch deleted from origin, all 6
  named artifacts (e2e spec, `DESIGN_SYSTEM.md §10`, Phase 1 handoff,
  z-index ladder, `ContextualActionSlot` compact label, dock
  aria-label) live in `main`. `_bmad-output/deferred-work.md` ledger
  moved entry to "Closed — 2026-05-21" with metadata. `MEMORY.md`
  line 113 updated. No commits — the gitignored ledger is local-only.

## Shipped (3 atomic commits)

### `153987fa` — refactor(coach): export `UUID_RE` from game-persistence

Two inline `UUID_RE` constants existed (one in `/api/games/route.ts`,
one in `/api/coach/analyze/route.ts`) with identical bodies. Drift
risk. Consolidated as the canonical contract for every persistence
boundary that touches the per-wallet game list.

- New export: `UUID_RE` from `lib/coach/game-persistence.ts`, sibling
  of `enforceGameCap`, `GAME_LIST_CAP`, `GAME_LIST_LPUSH_LUA`.
- Both routes now consume the canonical constant.
- Tests: +3 covering case-insensitive match + corrupt-id rejection
  (empty, malformed, missing-dashes, prototype-pollution shape).

### `bd32e7d0` — fix(api): filter non-UUID gameIds in GET `/api/games`

POST already rejected non-UUID `gameId`s at write time, but the GET
response trusted whatever sat in the per-wallet Redis list. Three
realistic vectors:

1. **Legacy entries** written before the POST UUID guard landed.
2. **Future contract drift** — writes from a different code path.
3. **Redis-level corruption** — direct CLI / migration error.

Any of those would propagate to the client and ultimately silently 400
inside `/api/coach/analyze`.

- Filter `lrange` output against `UUID_RE` before fanning out to
  `redis.get`. Dropped entries:
  - Skip the per-record `redis.get` round-trip (perf side effect).
  - Emit `warn` log `game_list_invalid_id_filtered` with `dropped` +
    `total` fields and hashed wallet for corruption monitoring.
- Tests: +3 (filter passthrough + warn log on drops + no-false-positive
  on clean list). Existing GET tests updated to use real UUIDs in
  fixtures (`"g1"`/`"g2"` would now be filtered out — they weren't
  realistic anyway).

### `7c0e4b8b` — fix(coach): drop non-UUID gameIds in coach-history client parse

Client-side leg of the defense-in-depth pair. The Supabase-backed
`/api/coach/history` endpoint is a **separate code path** from the
just-patched Redis-backed `/api/games`, so the server fix alone
doesn't cover it. Without the client guard, a corrupt analyzed entry
would render in the history list and the user's Analyze tap would
silently 400.

- Extract inline parse logic to pure helpers at
  `lib/coach/coach-history-parse.ts`:
  - `parseAnalyzedHistory(input)` — type guard + UUID guard, tags
    `kind:"analyzed"`.
  - `parseUnanalyzedGames(input, analyzedIds)` — same guards + dedup
    against the analyzed set, tags `kind:"unanalyzed"`.
- Wire both into `coach-history.tsx`. Drop now-unused
  `CoachAnalysisRecord` + `GameRecord` type imports.
- Tests: +9 unit cases covering non-array inputs (rate-limit / 403),
  legacy schema gaps, type-coerced `gameId`s, dedup, and the new UUID
  rejection (empty, non-string, malformed, XSS-shaped).

## Pivots from initial plan

| Original step | Pivot | Reason |
|---|---|---|
| Refactor only `/api/games`'s `UUID_RE` | Also consolidate `/api/coach/analyze`'s identical inline copy | Both copies are identical today; leaving one inline would re-introduce drift the next time someone changes the shape. 2 lines added, atomicity preserved. |
| Filter at record level after `redis.get` | Filter at list level before `redis.get` | Early filter skips an unnecessary `redis.get` round-trip per corrupt entry. The list entry IS the source of truth — it's what's used to build the per-record key. |
| Inline UUID filter in `coach-history.tsx` parse step | Extract pure helper module | Component had no test file; inline guard would have shipped untested. Pure helper + dedicated test file gets 9 RED→GREEN cases. |
| Emit client-side telemetry on drops too | Skip — server warn-log covers it | Double-counting on both endpoints (`/api/games` server filter + `/api/coach/history` client filter) would create noisy/duplicate signals. Server is the canary. |

## Verification

- `pnpm exec tsc --noEmit` (apps/web) → 0 errors.
- `pnpm test` → **1758 passing / 0 failing**.
- RED phase verified before each GREEN:
  - Commit #1: 3 expected failures (`UUID_RE` undefined in import).
  - Commit #2: 2 expected failures (filter missing, warn log missing).
  - Commit #3: module-not-found (helper doesn't exist yet).

## Cluster Closure Protocol checklist

1. **GitHub housekeeping** — N/A this session (defer items live in the
   gitignored `_bmad-output/implementation-artifacts/deferred-work.md`;
   no GH issue threads for individual defers).
2. **README sync** — N/A (no user-visible surface change).
3. **MEMORY.md sync** — defer #4 closed; PR #107 closure noted.
4. **Branch hygiene** — N/A (worked on `main` directly).
5. **Handoff doc** — this file.

## Backlog (carried forward)

### High payoff (next session candidates)

- **`enforceGameCap` eviction race** — non-atomic `LLEN` → `LRANGE` →
  `LREM` sequence. Pre-existing, not introduced by any recent fix.
  Same Lua-script pattern as commit `e000ed3f` (defer #1) should
  apply. Worst-case over-evicts by 1 and self-corrects on next POST;
  acceptable for now but worth its own QD spec if it ever needs one.
- **Cluster E defer #5** — `LatestReviewCard` outside `role="list"`
  container. A11y polish, ~30 min with RTL test.
- **Coach-history toast surface** — deferred UX half of Edge hunter
  #16. Needs toast infra decision before implementation.

### Deferred (tracked, lower priority)

- **CI VR job** — explicit activation triggers in `deferred-work.md`.
  Canary PR #107 closed-not-merged 2026-05-21; no external PR signal
  yet.
- **VR-7 expansion** — 4 variants (win/loss/draw/resigned) of
  `<ArenaEndState>`. Needs `/dev/arena-end-state` fixture.
- **Cluster E remaining defers** (#15 + #18 polish items in
  `deferred-work.md`).

### Closed in-session

- ~~**Cluster E defer #4.** Defense-in-depth UUID validation~~ —
  commits `153987fa` + `bd32e7d0` + `7c0e4b8b`.
- ~~**PR #107 triage.**~~ — closed by Wolfcito at 14:00:55Z; ledger
  synced.

## Decisions made this session

1. **Refactor + 2 fixes pattern (not one mega-commit).** The
   consolidation, the server fix, and the client fix each stand on
   their own and are independently revertible. Same atomicity
   discipline as the e1 session.
2. **Server fix filters at list level, not record level.** Early
   filtering both saves a `redis.get` round-trip per corrupt entry
   AND keeps the warning signal grounded in the source-of-truth (the
   list, not the records).
3. **Client guard via extracted helper, not inline.** Component had
   no test file; inline would have shipped untested. Extraction makes
   the guard testable, the parse logic re-usable, and the component
   smaller.
4. **No double-telemetry on client.** Server `warn` covers the
   monitoring signal. Adding client-side telemetry on the same drops
   would create noise without new information.
5. **TDD discipline kept on all 3 commits.** RED → expected failures
   → GREEN. No "I'll just write it and check after."

## Next session — recommended order

1. **`enforceGameCap` eviction race** (Lua pattern reuse from defer #1).
   Largest open correctness item.
2. **Cluster E defer #5** (a11y) — small, knock-out item.
3. Cluster Closure Protocol if both land.

Session budget: this session used ~12 tasks (plan + PR #107 triage +
red-team-light + 6 edits + 3 verifications + 3 commits + push +
handoff). Below 30-task ceiling.

---

**Wolfcito 🐾 @akawolfcito**
