---
date: 2026-05-20
arc: post-domain-migration UX addendum
parent_spec: _bmad-output/planning-artifacts/ux-design-addendum-post-domain-migration-2026-05-20.md
session_handoffs:
  - docs/handoffs/2026-05-20-post-domain-migration-addendum-handoff.md
  - docs/handoffs/2026-05-20-cluster-e-spec-handoff.md
clusters_complete: [A, B, C, D, E]
clusters_outstanding: []
commits_shipped: 14
test_suite_after: 1710 passing / 45 baseline failing
red_team_critical_resolved: 4 / 4
red_team_high_status: tracked for PR-time resolution
---

# Release Handoff — Post-Domain-Migration UX Addendum

## TL;DR

The post-domain-migration UX addendum (Sally + Wolfcito, 2026-05-20) is **fully shipped to `main`**. All 5 clusters (A–E) land with the suite preserved at 1710 passing / 45 baseline failing across every commit. All 4 red-team CRITICAL findings are resolved in code; the 8 HIGH findings are tracked for PR-time and reviewer-discretion polish.

Production status: `chesscito.com` apex (custom domain). Vercel deploy GREEN throughout the addendum window. No regressions across MiniPay, hub, arena, coach, or shop surfaces.

---

## Cluster inventory — 14 commits

### Cluster A — Copy purge + footer dock revamp (3 commits)

| Commit | Title |
|--------|-------|
| `3f6bb516` | refactor(exercises): drop stone-pedestal from action-row + scale icons |
| `83bc8e5e` | refactor(editorial): purge miniPayWarning copy + render site |
| `593b8da9` | refactor(editorial): rename viewOnCeloscan → receiptOnCeloscan |

Closes addendum §4 (copy purges) + §3 (dock revamp). All `miniPayWarning` references removed; receipt link semantics unified.

### Cluster B — TxProgressSteps primitive (2 commits)

| Commit | Title |
|--------|-------|
| `fc5ab87b` | feat(ui): TxProgressSteps primitive (pills + toast variants) |
| `9659b3b0` | feat(ui): TxProgressSteps telemetry wiring |

Closes addendum §2.3. Reused by Cluster C (SAVE toast) and Cluster E (persistence toast). Telemetry emits `tx_progress_view`, `tx_progress_step`, `tx_progress_step_duration`, `tx_progress_done` per `flow` dim.

### Cluster C — SAVE local-first (1 commit)

| Commit | Title |
|--------|-------|
| `7c2207c4` | feat(exercises): SAVE button local-first + TxProgressSteps toast |

Closes addendum §2.2. Star score visible from 1★; on-chain SAVE fires on tap with the toast variant masking the tx wait.

### Cluster D — Onboarding hybrid (1 commit)

| Commit | Title |
|--------|-------|
| `f056a829` | feat(welcome): wallet-progress-aware onboarding carousel |

Closes addendum §2.1. Detects existing wallet/progress and reskins/routes the onboarding flow to `/exercises` when appropriate. Includes the C-2 signal-budget escape per red-team resolution (2000ms cap + localStorage cache + `[Skip]`).

### Cluster E — Coach re-entry + unconditional GameRecord persistence (7 commits)

Spec: `_bmad-output/implementation-artifacts/spec-cluster-e-coach-re-entry-game-persistence.md` (`status: in-review`).

| Commit | Slot | Title |
|--------|------|-------|
| `938a0cdb` | e1 | feat(coach): add COACH_ENTRY_COPY block for cluster-e |
| `c4891f93` | e2 | feat(coach): add enforceGameCap helper with analyzed-skip + TDD |
| `d066eeb2` | e3 | feat(api): wire enforceGameCap in /api/games POST |
| `bc9b0f10` | e7 (server) | feat(api): tag existing-analysis short-circuit as idempotent |
| `1c67e4db` | e5 | feat(arena): dual-position Coach CTA + persistence overlay |
| `77a8dae2` | e6 | feat(coach): mixed-chronological history with Analyze chip on unanalyzed |
| `9e8d2555` | e4 | feat(arena): unconditional GameRecord persistence + Coach re-entry |

Closes addendum §2.4 + §0.1. Persistence is now decoupled from Coach intent; every terminal game-end POSTs to `/api/games` masked by a `TxProgressSteps` toast. Coach re-entry surfaces shipped: Analyze chip on `/coach/history` for unanalyzed entries, secondary Coach CTA under Mint on win, primary Coach CTA on loss/draw/resigned. Source-dim telemetry (`coach_analyze_request{source: immediate | history | victory-mint}`) wired across all 3 call sites; idempotent re-tap fires `coach_analyze_idempotent_hit{source}` instead of consuming credit.

### Cluster F — This handoff (1 commit, doc-only)

This document. Closes addendum §6.1 commit #22.

---

## Test suite trajectory

| Checkpoint | Passing | Baseline failing | Net delta |
|------------|---------|------------------|-----------|
| Pre-addendum baseline (2026-05-19) | 1599 | 45 | — |
| Post-Cluster A–D (2026-05-20 prior session) | 1688 | 45 | +89 |
| Post-Cluster E (2026-05-20 this session) | 1710 | 45 | +22 |

Cluster E added 11 unit tests for `enforceGameCap`, 1 wiring test for `/api/games` (replaces the `ltrim` assertion), 1 invariant lock for the idempotent `redis.decr` short-circuit, and assorted spec-aligned assertions. Baseline failures remain orthogonal cleanup tracked separately (suites: arena-hud, arena-select-scaffold, coach-preview-card, coach-history-delete-panel, coach-panel, coach-paywall, contextual-action-slot, hub-scaffold, welcome-overlay, asset-integrity, pro-sheet).

---

## Red-team critical resolutions

All 4 CRITICAL findings from `docs/reviews/2026-05-20-post-domain-migration-addendum-redteam.md` are resolved in code:

- **C-1** — `/api/games` race resolved via foreground `await` in `runPersist` (Cluster E §0.1). Toast masks the wait. No `void fetch` anywhere.
- **C-2** — onboarding signal budget capped at 2000ms with localStorage cache + `[Skip]` escape (Cluster D).
- **C-3** — `/api/founder-status` route introduced for Founder Badge (Cluster D dependency; not in Cluster E scope but verified shipped before E).
- **C-4** — Full a11y contract: `role="alert"` (not `alertdialog`) on the persistence failure toast, `aria-busy` reserved for the in-flight phase (not permanently disabled), `aria-describedby` hidden span on the secondary Coach CTA, `role="listitem"` inside `role="list"` for coach-history chips, mount-only telemetry latch on `coach_history_unanalyzed_view`.

The 8 HIGH findings (H-1 lastSavedAt cache copy, H-2 SAVE flicker race, H-3 compound-step trim ownership, H-4 prepare-step mechanism, H-5 toast z-index, H-6 fee-currency SAVE verification, H-7 analyze rate-limit collision, H-8 Supabase schema/FK verification) are tracked for PR-time and live in the parent addendum §0.6.

---

## Adversarial review (Cluster E only)

Three parallel reviewers ran against the Cluster E diff (Blind hunter, Edge case hunter, Acceptance auditor). Classification:

- **intent_gap / bad_spec:** 0 — the `<frozen-after-approval>` block held; no spec amendment needed.
- **patch (applied in-cluster):** 14 — fallback POST removal, fail-closed default for `gameRecordPersisted`, idempotent split between `coach_analyze_request` and `coach_analyze_idempotent_hit`, AbortController in `runPersist`, `role="alert"`, aria-busy gated to `persisting`, 0-move POST restored, navigator.onLine offline guard, dead-ternary removed in coach-history, mount-only telemetry latch, post-mint secondary CTA double-render fix, `redis.decr` invariant test, wallet-aware CTA gating, terminal-exit reset guard.
- **defer:** 10 — appended to `_bmad-output/implementation-artifacts/deferred-work.md` (concurrent POST atomicity, duplicate-lpush `lrem` ordering, lrange null guard, UUID validation on GET, LatestReviewCard role gap, silent `handleAnalyzeFromHistory` errors, `redis.exists` pipeline opt, `pendingGameIdRef` key collision, `/api/games` POST error logging, analyze-flow DRY refactor).
- **reject:** 9 — false positives (stalemate result map, GET shape, retry mount condition, non-null assertion safety, signature drift, softOverflow correctness, JSX boolean cosmetic, overlay hoisting, `.js` extension convention).

Review log is captured in the spec's Spec Change Log section and the deferred ledger.

---

## Smoke tests pending

Per addendum §7 Done Definition:

- [ ] **Android MiniPay smoke** — full happy-path on a physical Android device + MiniPay in-app browser. Recommended flow: hub → arena → finish a game (no Coach tap) → confirm `Saving match…` toast → confirm `/coach/history` Analyze chip → tap Analyze → confirm Coach result panel.
- [ ] **Screen-reader smoke** — VoiceOver (iOS) + TalkBack (Android) over the persistence overlay, dual-position Coach CTA, and Analyze chip. Verify `aria-busy` announces during persisting state, `aria-describedby` clarifies the Mint relationship, and `role="alert"` triggers immediate announcement on failure.

Both are required before stamping the addendum "done-done". They were not gated on Cluster E because the visual + a11y contracts hold in unit tests; the smoke is a final guardrail against device-class regressions.

---

## Visual baselines pending

Pragmatic refresh "Option B" — deferred to a single batched VR sprint:

- VR-5: Victory mint flow with TxProgressSteps pills + post-mint surface
- VR-7: persistence toast on Arena end-state (win / loss / draw / resigned)
- VR-8: `/coach/history` mixed-chronological list with Analyze chip
- `/support` Telegram block baseline
- `/about` operator disclaimer baseline

These were captured naturally during e4 + e5 manual smokes but are not committed to the visual-regression corpus yet.

---

## Known production env state

- `chesscito.com` apex live; legacy `chesscito.vercel.app` deprecated.
- `SHOP_DEPLOY_BLOCK_CELO` reset to digits-only (was `37,800,000` with commas → BigInt SyntaxError; fixed during MiniPay submission stabilization sprint).
- `NEXT_PUBLIC_SUPPORT_EMAIL` populated.
- `CRON_SECRET` configured (`/api/cron/sync` ready; external trigger still pending — GitHub Actions / Upstash QStash / Cloudflare Cron).
- `NEXT_PUBLIC_ENABLE_COACH` defaults to enabled; spec memory carries the kill-switch.

---

## Open threads

- **VR sprint** (above) — combines 5 baselines into one focused batch.
- **45-test baseline cleanup** — orthogonal; not gated by this addendum.
- **External cron trigger** — `/api/cron/sync` Vercel-removed in `df53342` (requires Pro plan). Decision pending: GH Actions vs. QStash vs. Pro upgrade.
- **Deferred Cluster E hardening** — concurrency atomicity on `/api/games`, redis pipeline in `enforceGameCap`, history-flow DRY. Captured in `deferred-work.md`. None blocking.

---

## Next session opener

The addendum is closed. Suggested next arcs (no dependency on this work):

1. **MiniPay store submission follow-up** — `docs/submission/minipay-form-answers.md` has all 11 answers; awaits Wolfcito to actually file the form.
2. **VR baseline batch** — single visual-regression session covering the 5 deferred items above.
3. **45-test cleanup sprint** — pick the smallest baseline suite (e.g., `coach-paywall.test.tsx`) and drive it to green; cascade through the rest.

Wolfcito 🐾 @akawolfcito
