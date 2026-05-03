# Stabilization Sprint + verify-pro Hot Fix — Handoff (2026-05-02)

> Author: Wolfcito + agent.
> Status: **Closed.** All work pushed to `origin/main`. PRO end-to-end validated in production with a fresh MiniPay purchase. Phase 2 layout primitives remain HALTED pending the §6 follow-ups.

---

## 1. Session arc

This session opened with a HALT on Phase 2 layout primitives (the GlobalStatusBar Z1 canary had landed but a manual `/hub` review surfaced product-quality issues that overshadowed further architecture work). The session then ran a 5-commit Stabilization Sprint to make PRO purchase meaningful, daily challenges valid, the gameplay UI uncovered, and Playwright actually protect real experience. After ship + push, a PRO smoke test against the deployed mainnet caught a critical bug in `/api/verify-pro` that left a real on-chain $1.99 purchase unreflected as PRO active. The bug was diagnosed live (without Vercel function logs — free tier limitation), patched in `4c8748f`, and validated end-to-end with two distinct purchases (one compensation via manual verify-pro fetch, one fresh purchase via MiniPay shell on the deployed fix).

The handoff is narrow: lock the closed work into memory, list the follow-ups so the next session can pick the right next lever without re-deriving them.

---

## 2. Commits shipped (6, in chronological order)

| SHA | Subject | Purpose |
|---|---|---|
| `2a2be7f` | `feat(pro): add post-purchase CTA in ProSheet active state` | Closes triage P0-1. Adds "Play Arena" button + helper copy to ProSheet active state. ENABLE_COACH-aware. 5 unit tests. |
| `e1acb28` | `fix(daily): validate and repair daily tactic FENs` | Closes triage P0-3. Adds validator (side-to-move, opponent-not-prechecked, unique-mate-in-1) + repairs mt-002 / mt-005 / mt-007 FENs + replaces mt-004 with a clean K+Q vs K. |
| `942b61a` | `refactor(legal): move cognitive disclaimer out of active gameplay` | Closes triage P1-1. Drops `<CognitiveDisclaimer>` render + import from mission-panel-candy.tsx and arena/page.tsx. Component file kept alive for future landing/about/legal usage. |
| `c222af1` | `fix(mini-arena): prevent K+R turn loop freeze` | Closes triage P0-2 via Path A (~30 min of the 2h time-box). Extracts `pickAiMoveOrFallback` as pure function with chess.js fallback when js-chess-engine misbehaves. 9 new unit tests. Confirmed in real runtime: K+R completed in 9 moves with no freeze. |
| `dd7821e` | `test(visual): add baseline visual regression suite` | Foundation: rename old `visual-snapshot.spec.ts` → `visual-capture.spec.ts` (artifact-only); new `visual-regression.spec.ts` with 3 deterministic baselines (`hub-clean`, `hub-daily-tactic-open` with `page.clock.install` for date-stable puzzle, `hub-shop-sheet-open`). `package.json` scripts split. DESIGN_SYSTEM.md §9.1 documents baseline update discipline. |
| `4c8748f` | `fix(verify-pro): mark ItemPurchased.token as indexed (matches contract)` | Hot fix landed mid-smoke. ABI declared `token` as non-indexed but ShopUpgradeable.sol emits it indexed. viem decode failed silently → 400 → Redis never written → users paid but stayed PRO inactive. Test mocks updated to match real emission shape (4 topics + 128-byte data). |

Plus 3 docs commits for triage (`03f039e`), sprint plan (`03329ab`), and smoke test plan (`4316548`) that landed before the sprint commits.

---

## 3. Tests + suite state

| Surface | Result |
|---|---|
| Unit suite | **595/595** (62 files) |
| TypeScript check | 0 errors |
| Visual regression (`pnpm test:e2e:visual`) | 3/3 baselines green (minipay project) |
| Full E2E (`pnpm test:e2e --project=minipay`) | **57 pass / 26 pre-existing fail / 3 skipped** — pre-existing failures documented in `docs/reviews/e2e-baseline-red-2026-05-02.md`; sprint introduced 0 new failures. |

The verify-pro hot fix added 9 lines net (+ 9 modified test mocks); did NOT change visual surface (3/3 visual regression green pre and post).

---

## 4. PRO smoke verdict

**GO.** Two independent purchases validated end-to-end on Celo Mainnet:

1. **Compensation purchase** (existing tx `0x60150fcffb86...` from before the fix) — manual `/api/verify-pro` POST from production browser console after the ABI fix deployed → 200 → Redis written → MiniPay chip flipped to active.
2. **Fresh purchase** from MiniPay shell after `git push origin main 4c8748f` + Vercel redeploy + Redis reset for the wallet → automatic flow worked end-to-end without manual intervention. Chip flipped to "★ PRO · 30 DAYS LEFT" gold pill, ProSheet rendered active CTA, "Play Arena" routed to `/arena`.

Full smoke results + per-step notes + critical-bug root cause + lessons in `docs/reviews/pro-smoke-test-2026-05-02.md`.

---

## 5. State of the system at handoff

| Subsystem | Status |
|---|---|
| `<GlobalStatusBar />` Z1 primitive | Live on `/play-hub`, anonymous + connected variants. PRO active state visually verified. |
| `<ContextualHeader />` Z2 primitive | Live on `/play-hub` per prior canary. |
| Stabilization sprint | Closed. P0-1 / P0-2 / P0-3 / P1-1 all addressed. |
| `pro-tap-debt-due-by` | `2026-07-01` — clock continues. Trailer in commit `854d79b` (Z1 canary). |
| Visual regression CI gate | Step 1 (3 baselines) live, mobile-only (`--project=minipay`). Step 2 (7 additional states) deferred. |
| Phase 2 layout primitives | **HALTED.** No `<ContextualActionRail />` Z4 work, no per-screen Z1 migration, no `<ProChip>` deletion. Backlog after the §6 follow-ups. |
| Vercel deploy state | `4c8748f` live in production. Confirmed working via fresh MiniPay purchase. |

---

## 6. Follow-ups (queued for next session)

Listed in suggested execution order — each item carries the rationale from where it surfaced.

### Product / business

1. **Free → PRO content tier** (raised by Wolfcito during smoke). Completing 15/15 stars on a piece in `/hub` only shows "REINTENTAR" — no progression hook. Decide tier separation: free covers pieces 1-N + L1 labyrinths; PRO unlocks deeper labyrinths, additional pieces, mastery challenges. Bind to the active perks list which is currently anemic.
2. **Business model perks clarity** (raised by Wolfcito). `PRO_COPY.perksActive` only lists "AI Coach with no daily limit + contribution to free tier"; `perksRoadmap` has 4 "coming later" items. Decide the v1 bundle and reflect in copy + UI affordances.
3. **Coach signposting / discoverability** (raised by Wolfcito). The new active-state CTA helper text says "After your match, PRO unlocks Coach analysis" but `/arena` gives no in-match indication that Coach will surface post-game. Add HUD-level hints + post-game banner with explicit "Analyze with Coach" CTA.

### UX polish

4. **PRO inactive chip visibility** (raised by Wolfcito). Spec §8 P1-2 muted treatment reads as invisible against candy-green. Redesign the inactive pill: defined border + light fill, no gradient — visible without becoming a CTA. Update the spec lock at `docs/specs/ui/global-status-bar-spec-2026-05-02.md` §8 inactive row.

### Engineering hardening

5. **Server observability** (smoke lesson). Add structured logging + Sentry-equivalent on `/api/verify-pro`, `/api/pro/status`, `/api/coach/*` route handlers. Verify-pro silent-catch hid the ABI bug for an unknown number of users; would have surfaced in seconds with proper instrumentation. Vercel free-tier logs are insufficient — need a real error tracker.
6. **`executeProPurchase` verify-failed UX** (smoke lesson). When verify-pro returns non-200, the client surfaces it as `kind: "verify-failed"` but the UI doesn't render a clear retry CTA. Add a visible "Retry verification — we already have your tx, this won't double-charge" surface so users don't feel they lost money.
7. **ABI automation** (smoke lesson). Generate verifier ABIs from the contract source via a build step that emits `lib/contracts/*-event-abi.ts` from Hardhat artifacts. Stops hand-authored mismatches like the one fixed in `4c8748f`. Apply the same pattern to `/api/coach/verify-purchase` (which mirrors verify-pro's structure).

### Cleanup

8. **Delete debug artifacts**. `apps/web/scripts/check-pro.ts` was a one-off diagnostic; remove. The local `errors/` folder of mobile screenshots was added to `.gitignore` in this session.

### Resume Phase 2 layout primitives (after the above)

9. **`<ContextualActionRail />` Z4 primitive** — original Phase 2 #3 per `DESIGN_SYSTEM.md` §10.6. Same shape as the Z1/Z2 primitive cycle: spec → red-team → TDD → canary.
10. **Per-screen Z1 migration** — `/arena`, `/trophies`, `/leaderboard`, secondary pages. One PR per screen.
11. **Legacy `<ProChip>` file deletion** — Phase 2 commit #3 of the GlobalStatusBar series, ≥7 days post-canary (already past that — can ship next sprint).
12. **`onProTap` debt closure** — when Shop ships its PRO sub-section as a Type-B destination, drop `onProTap` from `ConnectedProps`, drop the tappable hit area, flip Z1 to strictly passive. Hard deadline `2026-07-01` per the `pro-tap-debt-due-by` trailer in `854d79b`.

### E2E baseline cleanup (separate sprint)

13. **26 pre-existing E2E failures** — documented in `docs/reviews/e2e-baseline-red-2026-05-02.md`. Three layers per that doc: spec drift fixes (1-2h each, mechanical), visual snapshot sweep (~half day), surface-integrity investigation (the board-canvas-non-zero is the most concerning). Total ~1-2 days.

---

## 7. Open questions for the next session

- **Push the `apps/web/scripts/check-pro.ts` deletion + `errors/` gitignore** as a small cleanup commit, or fold into the next feature commit? Recommendation: cleanup commit now (this handoff session) since it's part of closing the sprint state cleanly.
- **Which follow-up first?** The product/business items (1-3) drive long-term engagement; the engineering hardening (5-7) prevents recurrence of today's bug class. Recommendation: ship #5 (observability) first because it's the cheapest and highest leverage — every future bug becomes easier to diagnose. Then #1 (content tier) because it's the largest gap users will hit.
- **Phase 2 resume timing** — after #1-#7, or interleave? Recommendation: finish #5-#7 (eng hardening, ~2 days) before reopening Phase 2. Visible product gaps (#1-#4) can run in parallel with Phase 2 once the hardening lands.
- **`onProTap` deadline** — `2026-07-01`. ~2 months out. Plenty of time to ship the Shop PRO sub-section, but the work has not started. Add to the next planning session.

---

## 8. Bottom line

PRO purchase works end-to-end on Celo Mainnet via MiniPay. The verify-pro ABI bug that silently broke it for an unknown number of users (any USDm purchase since the Shop contract was deployed) is closed in production. The stabilization sprint hit its hard floor (commits 1, 2 + the hot fix) and its soft floor (commits 3, 4, 5).

Phase 2 layout primitives can resume after the §6 follow-ups, in particular #5 server observability — that's the gap that would have caught today's bug in minutes instead of an hour of live debugging without runtime logs.

Sprint closed. Handoff captured. Ready for next session.

— Wolfcito + agent
