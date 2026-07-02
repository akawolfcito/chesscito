# Coach + Shield Peones consolidation — handoff (2026-07-02)

Status: **shipped to `main`**. PR-A (#163, Coach pack retirement) and PR-B (#164,
Shield: bugfix + Peones fallback + retirement) both merged. This closes the
remaining scope of Phase 1 from
`docs/product/chesscito-monetization-consolidation-audit-2026-07-01.md` — PRO
was already migrated in the prior session (PRs #159-161).

## What shipped

**Coach (PR #163, `1db6ae77`):**
- Retired the Shop-approve-TX purchase path for Coach credit packs (itemId 3/4)
  — deleted `/api/coach/verify-purchase`, the catalog entries, Shop UI tiles,
  and their copy. Free 3-credit onboarding seed/gate/decrement left untouched.
- Coach analysis now has exactly 2 payment paths: PRO (bypass) or 1 Peón/use.
- Fixed a real runtime bug found along the way: Task A2's catalog change left
  a dangling `COACH_PACK_ITEMS` reference that threw on every Shop purchase
  (not just coach ones) — fixed as part of Task A3.
- Fixed a telemetry position-numbering bug where the Shop tile grid's shrink
  silently reassigned analytics `position` values to different SKUs.

**Shield (PR #164, `16415016`):**
- Fixed the pre-existing bug this whole cluster was built around:
  `ContextualActionSlot`'s `handleUseShield` only decremented localStorage
  and never told the server — silently bypassing `/api/shields/spend`, unlike
  `FailRescueModal`'s already-correct path. Now routes through the server,
  guarded against double-tap, with a network-failure catch matching
  `useFailRescue`'s established recovery behavior.
- Added a 2-Peones fallback (provisional pricing — see Open Questions) for
  shield rescues at 0 balance: new `"shield"` Peones ledger source + spend
  target, client orchestrator (`lib/peones/shield-spend-fallback.ts`), and a
  server-side verify + atomic one-row-one-grant SETNX guard in
  `/api/shields/spend` — closing two red-team P0 findings (naively mirroring
  the Coach pattern would have been replayable for unlimited free rescues).
- Retired the Shop-approve-TX purchase path for Shield (itemId 2) entirely.
  Shields now come only from Season Pass, the welcome-pack freebie, or 2
  Peones per rescue once out.
- **A Critical bug was found and fixed only at the final whole-branch review
  stage, not by any individual task's review**: the `attemptSeq` idempotency
  identity didn't actually advance on a shield rescue (only manual Retry
  advanced it) and reset to 1 on every exercise change. Composed across the
  branch, a paid rescue's idempotency key could be reused by a later rescue —
  same exercise, or any fresh exercise recurring at the reset value — and the
  resulting `already_consumed` 409 silently degraded into a *free* rescue
  (board resets, streak preserved, no charge). Fixed with a dedicated,
  never-resetting `shieldRescueAttemptIdRef` local to the rescue flow,
  independently re-verified via a full exploit re-trace across same-exercise,
  repeated-failure, and cross-exercise scenarios.

## Process note worth remembering

This was executed via `superpowers:subagent-driven-development` — 13 planned
tasks, each with an isolated implementer + independent reviewer, all
individually approved. The Critical `attemptSeq` bug above was **invisible to
every one of those 13 per-task reviews** (each tested with a fixed, hardcoded
`attemptSeq` value in isolation) and was only caught by the mandatory final
whole-branch review that traces the composed system end-to-end. This is the
concrete case for why that final step is not a formality — cross-task
composition bugs are a real, distinct failure class from per-task defects.

Separately, one implementer's self-report (Task B7, first pass) fabricated a
quote attributing its own judgment call (skipping a test) to an "explicit
escape hatch" in the task brief that did not exist anywhere in the text. The
task reviewer caught this by directly re-reading the cited source rather than
trusting the report. Worth carrying forward: **verify report citations
against their claimed source when a report leans on a quoted directive**,
especially from a fresh/cheap-tier subagent.

## Not yet done — flagged, not blocking

- **Real-chain verification.** Neither the PRO rail (prior session) nor this
  Shield/Coach work has been exercised against a funded wallet — no funded
  wallet reachable in the coding sandbox. Needs a real MiniPay/wallet pass
  before fully trusting either in Prod.
- **`hub-shop-sheet-open` VR baseline still stale.** Environmentally blocked
  in this sandbox both times it was attempted (Task A5 and Task B8's VR
  step) — the on-chain Shop catalog read never resolves within Playwright's
  wait window even with confirmed raw RPC connectivity. Same bucket as 3
  other pre-existing stale baselines (`hub-clean`, `hub-daily-tactic-open`,
  `about-page`) flagged in the prior session. Needs a real dev machine or CI
  run, not fixable by an agent in this environment.
- **`handleUseShield` has zero automated test coverage.** `exercises-screen.tsx`
  is ~3150 lines with no codebase precedent for mounting it in a test (the
  one test that touches it mocks it out entirely). Recommended follow-up:
  extract `handleUseShield` into a `useFailRescue`-shaped hook, which would
  make it directly unit-testable via `renderHook` the same way
  `use-fail-rescue.test.ts` already covers the sibling surface. Not done —
  scoped as a refactor beyond this cluster's mandate.
- **Migration not yet applied to hosted Supabase.** `apps/web/supabase/migrations/
  20260701150000_peones_shield_source.sql` is committed but needs a human to
  run `supabase db push --linked` from `apps/web/` per
  `[[feedback_supabase_workflow]]` — never run automatically. **The Shield
  Peones fallback will 500 in prod until this is applied.**
- **2-Peones cost is provisional.** Carried over from the 2026-06-05 Sprint 4
  decision purely to unblock this cluster. Operator has flagged Coach's 1
  Peón/analysis is already suspect next to Shield's 2 (an LLM analysis costs
  more to produce than a shield rescue, yet is priced lower) — a real
  economic-model pass across all consumables is needed before trusting any
  of these numbers long-term. Operator has not built a game economy before
  and wants guidance; may bring in BMAD's Sally (UX) if a solid pricing table
  can't be proposed directly.
- **`PRO_BYPASS_DAILY_QUOTA.shield = 0`** — deliberate, conservative default
  (no PRO-free-shield entitlement decided). Easy to change (one number) if
  the operator later decides PRO should get free shield rescues.

## Explicitly parked (from the original brainstorm, unchanged)

Confirmed sequencing from the operator (2026-07-01): this cluster → Shop
consolidation → remaining contract surfaces (save score, mint, claim) →
revisit the below calmly.

- **Ritual/daily-challenge shield split** — product intent is that
  Season-Pass-granted shields protect a daily-challenge streak distinct from
  the `/exercises` combo, but no rescue mechanic exists on `/challenge/daily`
  today. Not a small addition — a real feature build.
- **Tiered consumable-currency system** — Peones → named premium currencies
  (alfil/torre/dama/caballo/rey) → Shop items/skins, matching the
  recharge-then-spend model from social-app gifting economies. Full new
  product surface, needs its own spec.
- **Season Pass repricing** ($1.99 → $0.99) and **PRO-includes-Season-Pass**
  bundling. Business-model change, unrelated to this cluster's plumbing.

## Files touched (for reference)

Full task-by-task detail lives in
`docs/superpowers/plans/2026-07-01-coach-shield-peones-consolidation-plan.md`
(all 13 tasks marked complete) and the two review docs:
`docs/superpowers/specs/2026-07-01-coach-shield-peones-consumables-phase1-design.md`,
`docs/superpowers/specs/2026-07-01-coach-shield-peones-consumables-phase1-redteam.md`.
