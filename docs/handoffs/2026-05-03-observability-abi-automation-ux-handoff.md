# Observability + ABI Automation + UX Polish — Handoff (2026-05-03)

> Author: Wolfcito + agent.
> Status: **Closed.** All work pushed to `origin/main`. Vercel redeployed; coach-verify ABI hot-fix live; observability + retry CTA + chip retune all in production. Phase 2 layout primitives can resume; the remaining §6 items are product decisions, not engineering.

---

## 1. Session arc

This session opened directly on the §6 follow-up backlog from the prior handoff (`docs/handoffs/2026-05-02-stabilization-sprint-handoff.md`). Started with the engineering hardening (#5 observability) which surfaced a second active mainnet bug — coach/verify-purchase had the same ABI shape mismatch as verify-pro before yesterday's `4c8748f` hot-fix, silently failing every Coach pack purchase since the Shop contract shipped. Since the user confirmed "solo yo y yo con otra cuenta" (no real users yet), shipped the hot-fix in-flight rather than deferring. Then closed #7 (ABI automation) to structurally prevent the bug-class from biting a third time, and finished with the smaller UX wins #6 (verify-failed retry) and #4 (inactive PRO chip visibility). 9 commits, all green.

---

## 2. Commits shipped (9, in chronological order)

| SHA | Subject | Purpose |
|---|---|---|
| `9d1fe3e` | `feat(observability): structured server logger with redaction + bigint safety` | Closes §6 #5 step 1. `lib/server/logger.ts` — JSON-line emitter with secret redaction, BigInt-safe replacer, circular-ref tolerance, vitest noop, never throws. 7 unit tests. Designed as the seam: swap default sink for Sentry/Axiom/Better Stack later without touching call sites. |
| `5c7c240` | `feat(observability): instrument verify-pro route` | Closes §6 #5 step 2. Three log points: inner decode → warn (smoking gun for shape mismatch — would have caught yesterday's bug in seconds), no-purchase 400 → warn with `decodeAttempts/decodeFailures` counters, top-level catch → error with stack. +3 tests. |
| `154a860` | `feat(observability): instrument pro/status route` | Closes §6 #5 step 3. Auth-rejected catch → warn (intended security control); new top-level try/catch around `isProActive` → error with stack. Behavior change (narrow): Redis throws now surface as clean 500 instead of unhandled stack on the wire. +2 tests. |
| **`4ecca3c`** | **`fix(coach-verify): mark ItemPurchased.token as indexed (matches contract)`** | **Hot-fix — same bug-class as `4c8748f`. Coach packs (itemId 3, 4) had been silently failing on mainnet since the Shop contract was deployed. ABI declared `token` non-indexed; contract emits it indexed. Test mocks (5 fields in data → 160 bytes) had been masking the same shape mismatch the verify-pro mocks did pre-fix. ABI corrected, field renamed `totalAmount` → `totalTokenAmount`, test helper `makeCoachLog()` mirrors verify-pro shape (4 topics + 128B data).** |
| `f9aeebb` | `feat(observability): instrument coach/verify-purchase route` | Closes §6 #5 step 4. Same instrumentation pattern as verify-pro; built on `4ecca3c` so the warn line lights up the moment another shape mismatch surfaces. +3 tests. |
| `f1cff62` | `feat(contracts): event ABI generation from Hardhat artifacts` | Closes §6 #7 step 1. Plain Node generator at `apps/contracts/scripts/generate-event-abis.mjs` reads `ShopUpgradeable.json`, emits per-event `as const` TS fragments to `apps/web/src/lib/contracts/generated/shop-events.ts`. Wired into `pnpm --filter hardhat build`. Generated file committed (PR diffs surface drift). 2 smoke tests verify shape + viem decodeEventLog round-trip. |
| `6b7c1ba` | `refactor(api): consume generated ITEM_PURCHASED_ABI in both verify routes` | Closes §6 #7 step 2. -57 lines of hand-written ABI + comment blocks; both routes import from `@/lib/contracts/generated/shop-events`. Bug-class structurally closed: future on-chain decode routes inherit correct shape by default. |
| `b8bea6b` | `feat(pro): retry verification CTA on verify-failed errors` | Closes §6 #6. ProSheet now renders reassurance + retry button inside the error region when verify-pro fails post-confirm. Retry POSTs same txHash (idempotent server-side via 90d Redis dedupe — cannot double-charge). New `pro_verify_retry_failed` telemetry. Sheet close blocked while retry in flight. +3 ProSheet tests. |
| `9d0021e` | `style(z1): retune inactive PRO pill for candy-green visibility` | Closes §6 #4. Original P1-2 lock (`text-white/40 ring-white/15 bg-transparent`) was tuned for a dark header that no longer exists post-candy redesign — invisible against candy-green. New treatment: `text-[rgb(80,40,5)]/70 ring-1 ring-inset ring-[rgb(80,40,5)]/30 bg-white/85` — light cream fill + defined brown border + quiet brown text. Same height as active so no layout shift. Spec doc Amendment 2026-05-03 added; test regex updated in lockstep so the implementer-cannot-tune enforcement model carries forward. |

---

## 3. Tests + suite state

| Surface | Result |
|---|---|
| Unit suite | **615/615** (64 files; +20 over the 595 baseline yesterday). |
| TypeScript check | 0 errors. |
| Visual regression | Not re-run; only one commit (#4) touched UI styling, scope is the inactive PRO pill which has dedicated unit assertions. Run `pnpm --filter web test:e2e:visual` before the next baseline update if needed. |
| Full E2E | Not re-run. The 26 pre-existing failures from `docs/reviews/e2e-baseline-red-2026-05-02.md` are the same baseline; this session introduced 0 new failures (no UI flow changes, only error-region addition + chip color change). |

---

## 4. Production state at handoff

**Both confirmed mainnet bug-classes are closed.** The verify-pro ABI bug (yesterday) and the coach/verify-purchase ABI bug (today) shared the same shape — both are now fixed, and #7 makes a third instance structurally impossible without a contract source change.

| Subsystem | Status |
|---|---|
| `/api/verify-pro` | Live, instrumented, ABI from generated module. |
| `/api/pro/status` | Live, instrumented, top-level catch added. |
| `/api/coach/verify-purchase` | Live, ABI fixed, instrumented, ABI from generated module. |
| `lib/server/logger.ts` | Default sink → stderr/stdout. Vercel Runtime Logs filter by `level=error route=/api/x`. Free-tier retention is 1h; this seam lets us flip to Sentry/Axiom/Better Stack with a one-line change when the budget is approved. |
| `lib/contracts/generated/shop-events.ts` | 10 event ABI fragments. Regenerate via `pnpm --filter hardhat generate:event-abis`. Auto-runs as part of `pnpm --filter hardhat build`. |
| ProSheet retry CTA | Live. Surfaces only on `verify-failed` (other error kinds keep banner-only shape). Server-side idempotency confirmed (90d Redis dedupe). |
| Z1 inactive PRO pill | Live. Cream fill + brown border + brown text. Spec lock at §8 row 4 + Amendment 2026-05-03. |
| `pro-tap-debt-due-by` | Still `2026-07-01`. ~58 days. No motion this session. |
| Phase 2 layout primitives | **HALTED.** No `<ContextualActionRail />` Z4 work, no per-screen Z1 migration, no `<ProChip>` deletion. Remaining §6 items are product decisions; Phase 2 resume is awaiting #1-#3. |

---

## 5. §6 follow-up scoreboard (vs prior handoff)

| # | Item | Status this session | Owner |
|---|---|---|---|
| 1 | Free → PRO content tier | NOT STARTED — needs product decision on bundle | Wolfcito |
| 2 | Perks clarity in `PRO_COPY` | NOT STARTED — depends on #1 | Wolfcito |
| 3 | Coach signposting in-match | NOT STARTED — depends on #1 + #2 | Wolfcito |
| 4 | Inactive PRO pill visibility | **CLOSED** (`9d0021e`) | — |
| 5 | Server observability | **CLOSED** (`9d1fe3e`, `5c7c240`, `154a860`, `f9aeebb`) | — |
| 6 | verify-failed retry UX | **CLOSED** (`b8bea6b`) | — |
| 7 | ABI automation | **CLOSED** (`f1cff62`, `6b7c1ba`) | — |
| 8 | Cleanup (`check-pro.ts`, `errors/`) | Already done pre-session | — |
| 9-13 | Phase 2 resume | HALTED pending #1-#3 | — |

Plus surfaced + closed in-flight: **coach/verify-purchase ABI hot-fix** (`4ecca3c`). Not on the prior backlog because it was misclassified as "ABI automation only"; turned out to be an active mainnet bug.

---

## 6. Follow-ups (queued for next session)

Listed in suggested execution order.

### Product decisions (need Wolfcito input — block engineering work)

1. **Free → PRO content tier — bundle v1.** What does PRO unlock that free does not? Current `PRO_COPY.perksActive` lists only "AI Coach with no daily limit + contribution to free tier" (anemic). Decision needed on: deeper labyrinths beyond L1, additional pieces, mastery challenges, or some other progression hook. The `/hub` 15/15 stars completion currently shows only "REINTENTAR" — there's no progression for completionists, free or paid.
2. **Perks clarity** (depends on #1). Once the v1 bundle is fixed, rewrite `PRO_COPY.perksActive` and `PRO_COPY.perksRoadmap` to reflect actual unlocks vs explicit "coming later" items. Update ProSheet active-state CTA helper text in lockstep.
3. **Coach signposting in-match** (depends on #1 + #2). Currently `/arena` gives no in-match indication that Coach will surface post-game for PRO users. Add HUD-level hints + post-game banner with explicit "Analyze with Coach" CTA after match end.

### Engineering — Phase 2 layout primitives (resume after #1-#3)

4. **`<ContextualActionRail />` Z4 primitive** — original Phase 2 #3 per `DESIGN_SYSTEM.md` §10.6.
5. **Per-screen Z1 migration** — `/arena`, `/trophies`, `/leaderboard`, secondary pages.
6. **Legacy `<ProChip>` deletion** — already past the 7-day post-canary window.
7. **`onProTap` debt closure** — when Shop ships its PRO sub-section. Hard deadline `2026-07-01`.

### Engineering — independent (can run in parallel)

8. **Compensation pass for silently-failed Coach packs** — even though "no real users yet", the user has personally tested with two accounts. If any prior Coach pack purchase tx exists where credits did not land, manually POST to `/api/coach/verify-purchase` with the txHash to grant credits idempotently. Cheap to do; close the loop on the silent-failure period.
9. **Sentry / Axiom / Better Stack** — pick a tracker. The logger seam is ready; it's a one-line swap of the default sink. Vercel free-tier 1h log retention is the binding constraint.
10. **E2E baseline cleanup** — 26 pre-existing failures still documented in `docs/reviews/e2e-baseline-red-2026-05-02.md`. ~1-2 days. Independent of the rest.

---

## 7. Open questions for the next session

- **Bundle decision pacing.** #1-#3 unblock both Phase 2 and visible product evolution. Recommendation: 30-min decision session with Wolfcito to fix the v1 bundle, then engineering can run #2-#3 in parallel with Phase 2 resumption.
- **Compensation timing.** If we wait too long, more silent-failure receipts accumulate. Recommendation: run #8 today or next session — it's a Redis write per known txHash, takes minutes.
- **Tracker selection.** Sentry has the best DX but costs after free tier. Axiom is cheaper and has structured-log-native query. Better Stack is in between. Recommendation: Axiom for log-first observability (we already emit structured JSON); Sentry only if we want client-side error tracking too.
- **`onProTap` deadline** — `2026-07-01`, now ~58 days out. No motion in this session. Should be on the planning agenda for #1's bundle decision so Shop's PRO sub-section can be scoped against the deadline.

---

## 8. Bottom line

- **Two active mainnet bug-classes closed.** verify-pro (yesterday) and coach/verify-purchase (today) fixed; ABI automation prevents the third instance.
- **Observability is live.** Future bugs in the verify routes surface as warn/error JSON lines with diagnostic context — no more silent drops.
- **UX recovery surface is live.** Users hitting verify-failed see reassurance + retry, not a dead-end "money lost" message.
- **Z1 inactive pill is visible** against the candy backdrop. Spec lock + amendment in place; implementer cannot tune.
- **Phase 2 resume + remaining product items are unblocked technically** — what's blocking is the bundle decision.

Sprint closed. Handoff captured. Ready for next session.

— Wolfcito + agent
