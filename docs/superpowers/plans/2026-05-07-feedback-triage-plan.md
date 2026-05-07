# Feedback Triage — 2026-05-07 manual smoke regressions

> Origin: User PRO smoke (2026-05-06 → 2026-05-07) found multiple integration regressions after Coach session memory shipped. This plan triages, fixes, and adds permanent E2E coverage to prevent recurrence.

---

## Bug Inventory

| ID | Severity | Surface | Behavior | Root cause |
|----|----------|---------|----------|------------|
| **B1** | P0 | `/arena` Coach (PRO user) | After mint, "Ask the Coach" → "Quick review" → click "Unlock full analysis" → paywall with 5/20 credit packs. PRO user should NEVER see paywall. | `apps/web/src/app/arena/page.tsx:254-257` — client short-circuits to paywall when `credits === 0`, never consulting PRO status. Server is correct (`/api/coach/analyze` bypasses for PRO), but client never reaches it. |
| **B2** | P0 | `/hub` Pass Training panel + 26-day chip | "Play in Arena" button does nothing on click. Same for the chip. | Hypothesis: `<ProActiveCTA>` renders correctly with `router.push("/arena")` but click isn't reaching handler (z-index/overlay swallow OR the Button's onClick prop is dropped). Needs telemetry probe + repro test. |
| **B3** | P0 | `/arena` Coach (any user) | After dismissing paywall, no entry point back to Coach for the same game session. | `<ArenaEndState>` re-shows `onAskCoach` only when `coachPhase === "idle"`, but paywall close sets `idle`, then user can `Play Again` but cannot re-trigger Coach without completing another game. |
| **B4** | P1 | `/arena` claim cancel | "Claim cancelled" copy in red feels accusatory ("You declined the wallet prompt") when user simply hesitated. | Editorial copy is hostile. |
| **B5** | P1 | `/hub` "Play" button | Routes to old `/play-hub` layout instead of unified hub flow. | Legacy route still wired in. |
| **B6** | P1 | `/hub` Play button visual | Doesn't use `design/new-assets-chesscito/principalbutton.png` asset. | Asset created but never integrated. |
| **B7** | P2 | `/hub` mastery buttons (Queen / King / Pawn) | All three navigate to same `/badges` page; no per-piece distinction. | Single handler used for all mastery buttons. |
| **B8** | P2 | `/hub` Shield x11 chip | Routes to Arcane Store. | Verify intent — could be by design (shields are bought there). |

---

## Plan

### Phase 1 — Fix P0 bugs with TDD (commits 1-3)

**Commit 1: B1 — Coach PRO gate respects `isProActive`**

- Add failing test: `apps/web/src/app/arena/__tests__/arena-page-pro-coach-gate.test.tsx` — render arena, mock PRO=true wallet with credits=0, simulate ask-coach flow, assert `coachPhase` advances to `"loading"` (NOT `"paywall"`).
- Fix: `arena/page.tsx:startCoachAnalysis` — fetch credits AND `/api/pro/status` in parallel; only short-circuit to paywall when `!proStatus.active && credits <= 0`. Set `coachProActive` from response.
- Verify B3 simultaneously: when PRO active and credits=0, paywall is never shown, so the "no return entry point" issue evaporates for paying users.

**Commit 2: B3 — Re-entry to Coach after paywall close (free users)**

- Tests: dismiss paywall via `<CoachPaywall onOpenChange>` → assert `<ArenaEndState>` re-renders the "Ask the Coach" CTA.
- Already true per `arena/page.tsx:1139` (`onAskCoach` only shows when `coachPhase === "idle"`); the paywall close already returns to `idle`. Re-test to confirm — may be a no-op if already correct, in which case Commit 2 is just the test.

**Commit 3: B4 — Soften claim-cancel copy**

- `editorial.ts` `ARENA_COPY.claimCancel` → change "You declined the wallet prompt" → empathetic neutral: "No transaction was made. Your victory is still here whenever you're ready to claim it."
- Color: keep amber (warning), not rose (error).

### Phase 2 — Repro + diagnose B2 (Pass Training nav)

- Failing Playwright test: simulate a PRO wallet session, navigate to `/hub`, tap the 26-day chip, tap "Play in Arena" inside the sheet, assert `router` lands on `/arena`.
- If test passes locally → the bug is environment-specific (MiniPay WebView). Need to add telemetry breadcrumb in the click handler to log whether the handler fires in prod.
- If test fails → identify root cause, fix, commit.

### Phase 3 — Playwright E2E layer (NEW)

- Spin up `apps/web/e2e/` directory with Playwright config.
- Tests covering the user flows the manual smoke broke:
  - `coach-pro-flow.spec.ts` — PRO wallet → finish game → ask coach → expect Coach result (NOT paywall).
  - `coach-free-flow.spec.ts` — Free wallet → finish game → ask coach → expect paywall after 3 free analyses.
  - `pass-training-cta.spec.ts` — `/hub` → 26-day chip → Play in Arena → land on `/arena`.
  - `claim-cancel-copy.spec.ts` — Win game → click claim → cancel → assert friendly copy.
  - `hub-nav.spec.ts` — Tap each hub button (trophy, shop, mastery, play) and assert correct route.
- Add to CI as `pnpm --filter web e2e` job.

### Phase 4 — Flow Audit doc

- Create `docs/audits/2026-05-07-flow-audit.md` with a table per user flow:
  - Column A: Expected behavior (per spec / editorial intent)
  - Column B: Actual behavior (per manual smoke + Playwright assertions)
  - Column C: Gap status (✅ aligned / ⚠️ regression / 🚧 unimplemented)
- Flows covered: Hub entry, Pass Training upsell, Free Play (Arena), Victory claim, Coach (free + PRO), Trophies, Shop, Coach history.
- Generate diff list of P0/P1/P2 follow-ups.

### Phase 5 — Phase 1 deferred bugs (B5–B8) backlog

- Open GH issues for B5 (legacy /play-hub portal), B6 (principalbutton.png), B7 (mastery dest disambiguation), B8 (shield chip intent verify).
- Schedule for next sprint after B1–B4 ship.

---

## File list

| Path | Status | Why |
|------|--------|-----|
| `apps/web/src/app/arena/page.tsx` | MODIFIED | `startCoachAnalysis` parallel fetch credits + pro/status; gate paywall on PRO inactive only. |
| `apps/web/src/app/arena/__tests__/arena-page-pro-coach-gate.test.tsx` | NEW | RTL test for B1 fix. |
| `apps/web/src/lib/content/editorial.ts` | MODIFIED | Soften `ARENA_COPY.claimCancel.*` strings. |
| `apps/web/playwright.config.ts` | NEW | Playwright config (mobile viewport, base URL = http://localhost:3000). |
| `apps/web/e2e/coach-pro-flow.spec.ts` | NEW | E2E PRO flow. |
| `apps/web/e2e/coach-free-flow.spec.ts` | NEW | E2E free flow. |
| `apps/web/e2e/pass-training-cta.spec.ts` | NEW | E2E pass training nav. |
| `apps/web/e2e/claim-cancel-copy.spec.ts` | NEW | E2E claim cancel. |
| `apps/web/e2e/hub-nav.spec.ts` | NEW | E2E hub buttons. |
| `apps/web/package.json` | MODIFIED | Add `e2e` script + `@playwright/test` dep. |
| `.github/workflows/test.yml` | MODIFIED | Add Playwright job. |
| `docs/audits/2026-05-07-flow-audit.md` | NEW | Expected vs actual matrix. |

---

## Acceptance Criteria

- [ ] PRO user with 0 credits never sees `<CoachPaywall>` (regression test green).
- [ ] Free user with 0 credits sees paywall once; closing it returns the "Ask the Coach" CTA in `<ArenaEndState>` so re-entry is possible.
- [ ] `ARENA_COPY.claimCancel.title/body` updated; visible diff in `/arena` claim cancel screenshot.
- [ ] Playwright suite runs locally (`pnpm --filter web e2e`) and in CI.
- [ ] `docs/audits/2026-05-07-flow-audit.md` exists with all flows assessed.
- [ ] `git status` clean; commits granular per the project's HARD RULE.

---

## Out of Scope (deferred to next sprint)

- B5 routing: kill `/play-hub` legacy or alias to `/hub`.
- B6 `principalbutton.png` integration.
- B7 mastery per-piece pages.
- B8 shield chip nav verification (likely fine).
- Hub redesign full migration (memory says ~80% done).
