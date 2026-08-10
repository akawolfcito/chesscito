# Session Handoff — 2026-08-10

## Completed
- **Deep product/data/business audit** (7 parallel agents) → `docs/audits/2026-08-10-deep-product-data-business-audit.md` + published artifact (https://claude.ai/code/artifact/3be2e5fa-1214-4be4-9284-9e39ab970b41). Finding: the one problem is **Day-1 retention (~2.6%, motivational not mechanical)**; not content, not monetization, not conversion.
- **Falsifiable activation/retention experiment design** (6 parallel agents) → `docs/experiments/2026-08-10-activation-retention-experiment-design.md`. Commit `9c402b59` on branch `docs/2026-08-10-audit-and-experiment-design`.
- **Security P0 fixed** — `/api/peones/spend` unauthorized debit. Gated by `PEONES_SPEND_REQUIRE_SESSION` (default OFF = no-op). Guard + route + 45 tests; blast-radius 754 tests green; tsc clean. Commit `4641de1c` on branch **`security/peones-spend-authz`** + `docs/security/2026-08-10-peones-spend-authz.md`.
- **E0 pre-flight closed + ramp runbook** → `docs/experiments/2026-08-10-e0-ramp-runbook.md` (commit `345e0eb1`).
- **Telemetry health warning interpreted** (not a regression) → memory `feedback_events_per_session_is_heavy_tail_not_a_regression`. No analytics refactor.
- **Founder manually ran the E0 ramp 10→50** on `lite-chesscito` production (redeploy at **2026-08-10 17:23:56 UTC**). Verified: assignment NOT broken (works post-deploy). Confirmed: `NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT`=10 (pre-ramp, deployed behavior), `NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT`=5 (empirical+prior read); E0's auto-opened Daily does **not** consume the session quota (`session-quota.ts:10`).

## Current State
- **Branch**: `docs/2026-08-10-audit-and-experiment-design` (clean). P0 work isolated on `security/peones-spend-authz`.
- **Build**: passing (targeted: 754 tests green on peones+scores+api/peones; tsc clean). Full suite not run this session.
- **Uncommitted work**: none. **Nothing pushed** — founder pushes to origin/main and runs deploys/ramps manually.

## Next Tasks
1. **E0 ramp verification (waiting on sample, ~2026-08-11).** Founder pastes the split + guardrail rows once **≥15 post-deploy assignments** accrue (~1 LEARN tour-finish/hour → ~a day). Then do ONLY: (a) confirm `first-activity` ≈ 40-50% → bundle took the 50 (if stuck ~10% with 15+ → it didn't); (b) `onboarding_activity_failed` < 5%; (c) first **mechanical** readout (counts by arm) — **no statistical T2 interpretation until ~750 assigned**. Queries in the runbook use `::timestamptz`, deploy = `'2026-08-10 17:23:56+00'`. psql wrapper: `scratchpad/psql.mjs`.
2. **P0 rollout (needs founder decisions):** ship the client token-attach (spec'd in `docs/security/2026-08-10-peones-spend-authz.md`) BEFORE flipping `PEONES_SPEND_REQUIRE_SESSION=true`; the durable grantor-side migration is drafted but **NOT applied** — needs founder OK for a prod migration.
3. **Attribution producers (DO NOW candidate):** tag owned outbound links (`editorial.ts:2370` + `es.ts:69` + `/share/*`) with the allow-list tokens already wired — content change; enables the real acquisition-vs-retention split.

## Blockers
- **E0 readout blocked on traffic volume, not code** — decayed to ~1 LEARN tour-finisher/hour. Powered T2 (~750 assigned) ≈ 2 weeks; a powered D1 read is unreachable at this traffic (would need bought traffic).
- `SESSION_LIMIT` exact value not re-decrypted (token lacks decrypt perm; `apps/web/.vercel` links `chesscito`=PLAY, not `lite-chesscito`=LEARN). =5 by converging evidence; non-blocking for T2.

## Notes
- **E0 was already live at ~10% since 08-05** before the ramp — never truly dark. The ramp is 10→50.
- Metric discipline: T2 = **existence of ≥1 canonical completion per `account_ref`** (never SUM). Render events (`peones_balance_viewed` = 9% of all telemetry) and the `exercise_complete`/`training_exercise_completed` alias double-fire must not inflate it. No sub-1-min filter in contrasts (collider).
- Sequencing: E0 alone → freeze → E1 (ship as truth-restoration, don't A/B for D1). **E2 impossible** (MiniPay origination ceiling = zero, per official docs). **Web EA = RUN SEPARATELY** (channel/research, not experiment).
- Agent evidence ledgers (13) live in the session scratchpad `.../scratchpad/{agent-*,phase2-*}.md`.
