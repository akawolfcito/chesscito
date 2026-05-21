# Session Handoff — 2026-05-21 (Cluster A + C closure, perf #18, telemetry DRY, GH audit)

Eighth session of the day. Sibling of:

- `2026-05-21-session-handoff.md` (editorial cleanup + DeepSeek)
- `2026-05-21-traceability-hygiene-handoff.md` (Acción B housekeeping)
- `2026-05-21-vr-fixture-harness-handoff.md` (VR-5/7/8 fixture harness)
- `2026-05-21-cluster-e-hardening-trio-handoff.md` (Blind #12 + Edge #5 + Edge #16-telemetry)
- `2026-05-21-cluster-e1-lua-atomicity-handoff.md` (defer #1 — Lua atomicity)
- `2026-05-21-cluster-e4-uuid-defense-handoff.md` (defer #4 — UUID defense-in-depth)
- `2026-05-21-race-b-and-defer-5-handoff.md` (Race B + a11y region)

This handoff closes the longest-running open clusters from the
post-domain-migration addendum (Cluster A G2/G3 + Cluster C SAVE
residue) plus the Acceptance auditor #12 telemetry-drift item and the
Cluster E performance defer #18, ending with a one-off GH issue audit
pass that drives the open-issue count from 6 down to 4.

## Status snapshot

- **Branch**: `main` — pushed (`origin/main` at `7307b2b6`).
- **Build**: 1788 passing / 0 baseline failing · tsc clean (apps/web scope).
- **Test trajectory this session**: 1765 → 1767 → 1776 → 1778 → 1788 (+23 net, 4 distinct deltas).
- **VR**: 10/10 green against existing baselines (vr5 mint-pills + vr6 save-toast).
- **Open GH issues**: 6 → 4 (closed #105 knight puzzles + #92 sound effects as already-shipped).

## Shipped (7 atomic commits)

### `75a10146` — perf(coach): pipeline enforceGameCap evictions via redis.pipeline()

Closes Cluster E defer #18. The eviction loop in `enforceGameCap`
called `redis.eval(EVICT_IF_UNANALYZED_LUA, ...)` once per overflow
entry — paying N Upstash HTTP round-trips per `/api/games` POST that
triggered eviction. Refactored to queue every per-entry Lua eval onto
a single `redis.pipeline()` and flush with one `.exec<number[]>()`,
collapsing N RTTs to 1 regardless of overflow size.

**Properties preserved.** Per-entry EXISTS+LREM remains atomic via the
existing Lua script — Race B (orphaned analysis) stays closed.
Pipelining is a wire-level batch, not a Redis MULTI/EXEC transaction.
Falsy entries (Redis-level corruption, defer #9 territory) are
filtered before pipelining; the missed slot still surfaces via
`softOverflow` + `onOverflow`. Empty candidate set short-circuits the
network call entirely.

Type contract widened: `GameCapRedis` is now `Pick<Redis, "llen" |
"lrange" | "pipeline">` (drops "eval"). Atomicity-guard test expanded
to assert `redis.eval` is never called directly either — defends
against future fallback to N independent round-trips.

Tests: +2 net (pipeline-behaviour suite covering N→1 RTT collapse +
empty-candidate short-circuit). 1765 → 1767.

### `46c57f15` — docs(cleanup): annotate miniPayWarning removal

Closes Cluster A G2 doc-cleanup defer. The
`PURCHASE_CONFIRM_COPY.miniPayWarning` key was already removed from
`editorial.ts` in a prior session, but two historical docs still
referenced it by name as if it were live. Annotated each call site
with `[removed 2026-05-20 — addendum §4.1]`:

- `docs/superpowers/specs/2026-04-26-minipay-transaction-ux-fluidity.md:85`
- `docs/superpowers/specs/2026-04-26-minipay-transaction-ux-fluidity.md:232`
- `docs/reviews/ux-review-2026-04-23-candy-light-sweep.md:83`

Annotation preferred over deletion to preserve historical UX context
for archeology while making "removed" status unambiguous to current
readers.

### `5885f802` — chore(assets): remove unused piedra-{daily,arena} sextet

Closes Cluster A G3 asset-cleanup defer. After G3 dropped the stone
background from action-row chips, six files in
`apps/web/public/art/action-row/` lost their last code reference (the
defer note listed only the two `.png` files; verification revealed
the `.webp` + `.avif` triplet pattern, so all 6 went).

Pre-delete verification: zero refs in `apps/web/src/**`, no dynamic
path possible (`ActionRowIconName` is a closed TS union of 12 names),
no CSS/manifest/HyperFrames reference. Other `piedra*` assets
(`/art/scene-rooted/piedra1..10.webp` used by `<StonePedestal>`)
untouched.

Total freed: 33,121 B (~32 KB) from the public build payload.

### `d290a643` — refactor(coach): unify analyze telemetry behind shared helpers

Closes Cluster E Acceptance auditor #12. The two analyze flows
(`startCoachAnalysis` + `handleAnalyzeFromHistory`) emitted
`coach_analyze_*` events with drifting payload shapes, making it easy
for a future contributor to add an event in one flow and forget the
mirror in the other.

New `lib/coach/analyze-telemetry.ts` centralizes the three emit sites
behind typed helpers + lifts the `AnalyzeSource` union from the
inline declaration in `arena/page.tsx:292`. All 5 emit sites in
arena/page.tsx now route through the helpers; zero remaining inline
`track("coach_analyze_*"` calls in that file.

**Additive contract change (non-breaking):** `coach_analyze_request{source:"immediate"|"victory-mint"}`
now includes `game_id` field (was missing — only history flow
emitted it). Downstream dashboards using positional or partial field
access stay green.

Tests: +9 (analyze-telemetry suite). 1767 → 1776.

### `0b6f2005` — fix(tx-progress): truncate toast copy at narrow viewports

Closes Cluster C SAVE residue defer #3. The `variant="toast"`
container was `inline-flex … px-3 py-2` with no max-width constraint;
long sub-copy (Spanish, future i18n fallbacks, failure messages)
could push past ~358px on a 390px viewport, escaping the
mission-panel column or wrapping onto two lines.

- Container: `max-w-full overflow-hidden` so the chip caps at its
  parent's content area and clips overflow.
- Sub-copy span: `min-w-0 truncate` so inside the flex layout the
  span can shrink below its content size and ellipsize.

aria-label still carries the full untruncated text; visual ellipsis
is purely cosmetic.

Tests: +2 (toast suite — container max-w-full + sub-copy truncate
guards). 1776 → 1778.

### `c084fe88` — fix(save): surface failed state on tx revert

Closes Cluster C SAVE residue defer #1. The `<TxProgressSteps variant="toast">`
mounted in the exercises screen was driven by a 3-phase derivation
(`sign | wait | done`) with no entry for
`useWaitForTransactionReceipt().isError`. On chain revert the toast
stayed on "Waiting…" indefinitely.

New `lib/exercises/tx-toast-state.ts` extracts a pure 4-phase
derivation: `failed > done > wait > sign`. Failed is gated on
`isError && txHash !== null` — wagmi's error flag also fires on
user-rejection BEFORE a hash exists, which the error overlay owns;
rendering "failed" in that case would double-report.

`exercises-screen.tsx`:
- Destructures `isError` from `useWaitForTransactionReceipt` and
  feeds it to the new helper.
- Replaces the inline ternary with `deriveTxToastState(...)`.
- Clears `submitTxHash` at the top of `handleSubmitScore` so a retry
  after revert flips the toast back to "Signing…" immediately
  instead of lingering on "Failed".

Tests: +10 (tx-toast-state suite covers each phase precedence +
failed-without-hash carve-out). 1778 → 1788.

### `7307b2b6` — refactor(save): tokenize SAVE done-hold duration

Closes Cluster C SAVE residue defer #2. Lifted the hardcoded `1500`
literal driving the `<TxProgressSteps current="done">` hold timer
into a module-level `SAVE_DONE_HOLD_MS` constant with a docstring
linking it to the motion scale (3 × `--duration-ceremony`).

Pure rename — no functional change. The value now self-documents the
design intent instead of reading as a magic number.

Also noted in the commit body: defer #4 (rapid resubmit race) was
already shipped before this batch via the synchronous
`submittingScoreRef` guard at `exercises-screen.tsx:593 +
L1135-1138 + L1226`. Defer #5 (unmount cleanup mid-tx) does not
reproduce under the current code — the cleanup's `clearTimeout` is
synchronous and cancels the queued setState before unmount completes;
adding `isMountedRef` would defend against a scenario that can't
happen.

## Non-commit work — GH issues audit

One-off audit pass against all 6 open issues, verifying each against
current code. Closed 2 as already-shipped:

- **#105** (Caballo errante — knight puzzles) — `lib/game/rules/knight.ts`
  ships KNIGHT_DELTAS (L-shape), `exercises.ts` includes the knight
  set, 16 editorial entries cover knight copy, Knight Ascendant badge
  is live on Celo Mainnet per the README contracts table.
- **#92** (Sound effects — Clash Royale UX audit) — `lib/sfx.ts`
  ships synthesized SFX via Web Audio API (move / capture / victory
  + mute persistence in localStorage). Zero asset weight, lazy
  AudioContext init for iOS autoplay compatibility. UI-interaction
  sub-scope partial; not blocking closure.

Kept open as still-valid: #109 (VR timeout, reproduced today), #104
(Treasure hunt — UI ribbon exists but not the gameplay mechanic),
#101 (Prize pool v2 — needs game session proof first), #67
(Exercise world map — not shipped, P2 stretch).

## Verification

- `pnpm exec tsc --noEmit` (apps/web scope) → 0 errors.
- `pnpm test` → **1788 passing / 0 failing**.
- `pnpm exec playwright test visual-regression.spec.ts -g "vr5-mint-pills|vr6-save-toast"` → **10/10 passed**.
- RED phase verified before each GREEN.

## Cluster Closure Protocol checklist

Per CLAUDE.md "Cluster Closure Protocol":

1. **GitHub housekeeping** — ✅ #105 + #92 closed with code-pointer
   comments. Open: 6 → 4.
2. **README sync** — ✅ verified current. Tagline + bullets +
   on-chain contracts table + Tech Stack + Arena + Coach sections
   all align with live state. No edits needed.
3. **MEMORY.md sync** — handled inline via `_bmad-output/implementation-artifacts/deferred-work.md`
   updates (11 ledger entries marked Closed).
4. **Branch hygiene** — N/A (worked on `main` directly throughout).
5. **Handoff doc** — this file + `SESSION.md` at repo root.

## Backlog (carried forward)

### Tier 1 — empty

### Tier 2 — Bloqueados / waiting trigger

- **CI VR job in `test.yml`** — activation triggers documented
  (external PR / UI iteration stabilizes). Neither met.
- **TxProgressSteps Shop 6-step duplicate-code resolution** —
  blocked until Shop/PRO compound flow integration ships.
- **Edge #16 toast UX half** — blocked on app-wide toast
  infrastructure design decision.

### Tier 3 — Polish (all Low priority)

- **TxProgressSteps a11y live-region split** (Blind #4, B1 review).
- **TxProgressSteps test type hygiene** (Edge #9, B1 review).
- **TxProgressSteps telemetry edge cases** (5 items, B2 review).
- **Cluster D onboarding edge cases** (6 items: AbortController,
  timeout race, skip funnel telemetry, cross-tab race, ops
  follow-up, negative-cache TTL).
- **Cluster E small:** `pendingGameIdRef` collision (Very low) +
  candy-gold edge color tokenize (cosmetic).
- **VR-7 expansion** (4 ArenaEndState variants — needs
  `/dev/arena-end-state` fixture route).

### Structural by design (intentionally open)

- `enforceGameCap` Races A + C — over-evict-by-1, self-correcting.
  Documented in `EVICT_IF_UNANALYZED_LUA` docstring. Would need
  per-wallet lock or full all-up Lua only if a real "missing game"
  symptom near the 200-cap boundary is reported.

### Closed in-session

- ~~Cluster A G2 + docs + assets~~ — `46c57f15` + `5885f802`.
- ~~Cluster C SAVE residue (5/5)~~ — `0b6f2005` + `c084fe88` +
  `7307b2b6` + ledger no-ops for #4 + #5.
- ~~Cluster E perf #18 (`redis.exists` sequential loop)~~ — `75a10146`.
- ~~Cluster E Acceptance auditor #12 (analyze flow divergence)~~ — `d290a643`.
- ~~Traceability hygiene policy~~ — audit pass + ledger closure
  (existing Cluster Closure Protocol IS the policy).
- ~~#105 (knight puzzles)~~ + ~~#92 (sound effects)~~ — GH closes.

## Decisions made this session

1. **Defer #18 closure via pipeline-of-Lua, not MGET.** Initial defer
   note suggested `redis.mget` + serial LREMs, but that would reopen
   Race B. Pipelining the per-entry Lua scripts preserves all current
   atomicity properties while still collapsing N RTTs to 1. Required
   wider test rewrite (mock pipeline chain) but no architectural
   trade-off.
2. **Annotate over delete for stale doc refs.** Cluster A doc-cleanup
   defer allowed either deletion or annotation. Annotation preserves
   archeology (why the key existed) while making "removed" status
   unambiguous — better for a docs-heavy repo where specs become
   historical reference.
3. **6 files for asset cleanup, not 2.** Defer note listed only
   `.png` files; verification revealed the `.webp` + `.avif` triplet
   pattern. Removing only `.png` would have left dead `.webp` +
   `.avif` siblings.
4. **Extract `tx-toast-state` helper for the failed branch.** The
   inline 3-phase derivation in `exercises-screen.tsx` was untestable
   directly. Extracting the pure derivation to
   `lib/exercises/tx-toast-state.ts` adds a real abstraction (4
   inputs → 2 outputs with precedence) and a clean TDD seam —
   justified by the increased conditional complexity (3 → 4
   branches). Not gold-plating.
5. **Skip defer #5 (unmount cleanup).** The "(swallowed) warning"
   the defer described does not reproduce under the current code.
   `clearTimeout` is synchronous and cancels the queued setState
   before unmount completes. Adding `isMountedRef` would violate
   CLAUDE.md's "no defensive code for impossible scenarios" rule.
   Ledger updated with rationale.
6. **Skip VR run when surface change is non-rendering.** The
   analyze-telemetry refactor (`d290a643`) only changed `track()`
   call sites in `arena/page.tsx` — zero JSX/CSS/style touched.
   Running VR would produce identical baselines for no signal.
   Hook flag acknowledged + explained to Wolfcito.
7. **GH audit closures need explicit user OK.** Per CLAUDE.md
   safety rails ("actions visible to others ... always confirm
   first"), gathered all 6 issue verdicts first, presented the
   2-close shortlist with proposed comments, waited for "procede"
   before running `gh issue close`.
8. **Traceability hygiene defer closes via verification, not new
   policy.** Audit pass + README check + observing that the
   existing Cluster Closure Protocol already codifies the policy =
   sub-items resolved. No need to add new sections to CLAUDE.md;
   the rules are present, they just needed enforcement (which the
   audit IS).

## Next session — recommended order

1. **Bonus traceability** (~5 min) — assign #109 to a milestone or
   leave intentionally un-milestone'd with a `area/infra` tag.
2. **TxProgressSteps a11y live-region split** (~30 min) — real a11y
   polish, separate `polite` + `assertive` regions both always
   mounted. Defer is Low priority but a clean ship target.
3. **Cluster D onboarding micro-batch** (~30 min) — defer #4
   (skip funnel analytics — telemetry expansion) + defer #6
   (SHOP_DEPLOY_BLOCK_CELO ops follow-up — `.env.template` +
   runbook).
4. If appetite remains: TxProgressSteps telemetry edge cases (5
   items, mostly observability or expected-behavior documentation
   — could clear in one batch).

Session budget today (8 sessions) — last one closed the longest
outstanding addendum clusters (A + C). Quality stayed steady:
1727 (day start) → 1788 (day end), +61 net tests, 0 baseline
failing throughout, no VR drift.

---

**Wolfcito 🐾 @akawolfcito**
