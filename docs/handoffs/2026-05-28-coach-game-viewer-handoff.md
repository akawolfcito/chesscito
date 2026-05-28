# Coach Game Viewer — Cluster Handoff

**Date range:** 2026-05-27 (brainstorm + spec) → 2026-05-28 (T13 ship + T16 handoff)
**Branch:** `main`
**Commit range:** `12489b06..a82a375b` (20 commits)
**Status:** SHIPPED — smoke green, T14/T15 (VR baselines) deferred

---

## What Shipped

### New routes

| Route | Type | Purpose |
|---|---|---|
| `GET /api/games/[id]?wallet=…` | API | Owner-asserted gameRecord fetch; 400 on bad input, 404 on miss, 403 on wallet mismatch, read-tier rate limit |
| `POST /api/games/[id]/mint-receipt` | API | Idempotent mint outcome persist; writes `mintedTxHash` + `mintedAt` + `analysis` back onto existing Redis key |
| `/[locale]/coach/[gameId]?wallet=…` | Page | Canonical post-game review surface — `GameViewer` (board + slider + SAN list) + `GameActionsBar` (4 CTAs) + inline coach analysis |

### New hooks

| Hook | Location | Purpose |
|---|---|---|
| `useGameReplay` | `lib/game/use-game-replay.ts` | SAN[] navigator; builds fenList on mount, exposes `goTo/goPrev/goNext/goStart/goEnd`; partial-replay on illegal SAN with error boundary |
| `useCoachAnalysis` | `lib/coach/use-coach-analysis.ts` | Coach phase machine extracted from `arena/page.tsx` |
| `useCoachCreditsPurchase` | `lib/coach/use-coach-credits-purchase.ts` | Credits-purchase flow, split out for viewer portability |
| `useMintVictory` | `lib/coach/use-mint-victory.ts` | Mint claim phase machine extracted from `arena/page.tsx` |

### arena/page.tsx LOC delta

- Pre-cluster: ~1996 lines
- After T1–T12 (hooks added, legacy kept in parallel): ~2100 lines
- After T13 (legacy deleted, flag flipped): **1330 lines** — net -666 from pre-cluster; -770 from peak

### Commit log

```
a82a375b chore(arena): T13 — flip extracted hooks ON + delete legacy inline paths
4b12f4f9 feat(coach): mint-receipt wiring on both consumers
d7cd457e refactor(coach/history): tap entry routes to /coach/[gameId]; filter zero-moves
001b5960 feat(arena): T10 — X-close state machine routes to /coach/[gameId]
9e2cde52 fix(coach): replace notFound() with in-page 404 fallback
e1197b41 feat(coach): /coach/[gameId] page — viewer + actions + inline analysis
024e6b22 feat(coach): GameActionsBar — 4 CTAs with result-aware visibility
1eebd26a feat(coach): GameViewer — board + slider + SAN list + replay banner
3bb7a66e refactor(arena): T6b — transplant useMintVictory logic from arena/page.tsx
fbebc0d3 refactor(arena): T6a — useMintVictory skeleton + feature flag wire
1a35159b refactor(arena): T5c — transplant useCoachCreditsPurchase logic
29b61580 refactor(arena): T5b — transplant useCoachAnalysis logic from arena/page.tsx
fdee2b14 refactor(arena): T5a — coach hooks skeleton + feature flag wire
94d51c6b fix(lib/game): useGameReplay — guard invalid startingFen + JSDoc on mount
8ba793d4 feat(lib/game): useGameReplay — SAN[] navigator with partial-replay
9f220cd7 fix(api): mint-receipt — analysis field + HTTPS URL guard + per-wallet rate limit
88bb0097 feat(api): POST /api/games/[id]/mint-receipt — persist mint outcome
355f1f0e fix(api): GET /api/games/[id] — read-tier rate limit + 403 test + shape assert
62e883f2 feat(api): GET /api/games/[id] — wallet-asserted gameRecord fetch
0566455f test(arena): replace tautology with real handleBack regression assertion
12489b06 fix(arena): handleBack no flash selector — direct router.push to /hub
```

---

## Test Count Delta

| Milestone | Count | Delta |
|---|---|---|
| Pre-cluster baseline | ~2049 | — |
| After T1 (handleBack fix) | 2050 | +1 |
| After T2/T2-fix (GET route) | 2056 | +6 |
| After T3/T3-fix (POST mint-receipt) | 2065–2068 | +9/+3 |
| After T4/T4-fix (useGameReplay) | 233 in lib/game suite | +10 |
| After T5a–T5c (useCoachAnalysis hooks) | ~265 in coach+arena | — |
| After T6a–T6b (useMintVictory) | ~270 in coach+arena | — |
| After T7 (GameViewer) | — | +6 |
| After T8 (GameActionsBar) | — | +11 |
| After T9 (coach page) | 306 in coach+arena | +7 from baseline |
| After T9-fix (in-page 404) | 7/7 | — |
| After T10 (X-close state machine) | 46 in arena suite | +8 new |
| After T11 (history routing) | 81 in affected suites | — |
| After T12 (mint-receipt wiring) | — | +4 |
| After T13 (flag flip + delete) | 268 arena+coach | 0 regressions |
| **Final estimate** | **~2120+ full suite** | **0 baseline failures** |

---

## Smoke Validation (2026-05-28)

Manual MiniPay + ngrok smoke on `randomly-suited-fox.ngrok-free.app`.

**Game 1 — Coach analyze path (PRO bypass):**
- Played win → end-state popup → tap "Ask Coach" → loading → Coach Review screen renders (board + summary + takeaways + reanalyze/play/history CTAs)
- PRO bypass logged: `[pro-bypass] coach analyze short-circuited`
- Result: T5 (useCoachAnalysis) validated end-to-end

**Game 2 — Full mint flow:**
- Played win → end-state popup → persistence retry needed (Next.js dev JIT cold-compile, unrelated to cluster)
- Tap "Save Victory" → signature → approve USDC → mint tx → success
- CTA mutated to "View NFT" without reload
- Server logs confirmed sequence: `POST /api/sign-victory 200`, `POST /api/cache-victory 200`, `POST /api/games/.../mint-receipt 200` with `{"msg":"mint_receipt_written"}`
- Tap X on popup → routed via T10 state machine to `/coach/[gameId]` viewer
- Result: T6 (useMintVictory) + T12 (mint-receipt wiring) + T10 (X-close) + T9 (viewer cold-load) all validated

T13 (flag flip + legacy delete) then ran with extracted hooks ON. Zero regressions post-delete.

---

## Routing Decisions Canonicalized

1. **X-close from arena end-state popup** → `/coach/[gameId]?wallet=…` when wallet + persisted gameId present; `/arena?fresh=1` when guest or persist failed. Never `/hub` (Sally's retention-loop guidance).
2. **`pendingNavRef` consumer** — auto-navigates if user tapped X during `persisting` phase and persistence resolves later.
3. **`/coach/history` tap entry** → `/coach/[gameId]?wallet=…`. Legacy "selected" inline branch deleted.
4. **`BACK` from `/coach/[gameId]`** uses `history.length > 1 ? router.back() : router.push("/hub")` — prevents WebView close on deep-link entry (red-team H-2).
5. **404 from `/api/games/[id]`** → in-page fallback, NOT `notFound()`. `notFound()` triggered a hydration crash when the server component rendered on a missing key (fix: `9e2cde52`).

---

## Known Limitations

1. **`startingFen` not persisted on resumed games.** When a user refreshes mid-game or backgrounds+resumes in MiniPay WebView, `moveHistory` starts at the resume point — those moves are illegal SAN from chess.js startpos. Viewer correctly degrades to partial-replay banner. Fix path: wire `startingFen` from `arena-persistence.ts` into `runPersist` body. Field already exists in `GameRecord` type (T3); `useGameReplay` already respects it (T4). Tracked in `deferred-work.md`.

2. **Backdrop-tap dismisses popup with mint pending.** T10's state machine treats backdrop tap == X-click. User noted accidental dismissal during smoke. Polish follow-up: disable backdrop-tap on victory popups when mint is available.

3. **`VictoryClaimSuccess` (post-mint) lacks candy-pill styling** that the pre-mint `VictoryCelebration` has. Visual non-parity, polish follow-up.

4. **Visual flash on `/arena` → `/coach/[gameId]` transition** in dev mode. JIT compile + first server-fetch delay. Production won't have JIT, but the server-fetch hop is unavoidable on first cold-load. Could be smoothed with `router.prefetch` on the X-close anchor.

5. **`historyMeta` prop dropped from CoachPanel mount** after T13. PRO-only "Reviewing N sessions" footer not rendered. Hook doesn't expose `historyMeta`. Cosmetic regression for PRO users in the analyze surface.

6. **i18n hardcoded strings in extracted hooks.** T5b shipped `"You are offline. Please reconnect to analyze."` as a static EN literal (originally `tEntry("offlineToAnalyze")`). T6b has similar inline error-map entries. These are user-facing strings that should be locale-aware. Tracked in `deferred-work.md`.

7. **VR baselines NOT shipped.** T14 + T15 deferred to a separate VR-sprint cluster. The new `/coach/[gameId]` surface and the new mint-pill phases have no locked PNG baselines. Production regression risk is small (manual smoke + structural tests cover routing), but visual drift will accumulate until VR baselines lock the look.

---

## Risks Live on Main

| Risk | Severity | Mitigation |
|---|---|---|
| No VR baselines for `/coach/[gameId]` | Low | Manual smoke passed; structural tests cover routing; schedule VR-sprint |
| `startingFen` partial-replay banner shows on resumed games | Low | Intentional degradation per T4+T7 design; fix tracked |
| Backdrop dismiss during mint | Low | UX polish; no data loss (mint completes server-side) |
| i18n literals in extracted hooks | Low | EN-only for now; tracked for i18n sweep |
| `historyMeta` cosmetic regression for PRO users | Low | No functional impact; fix alongside next coach polish pass |

---

## Plan vs Actual

- **Estimated:** 17 tasks / 5–6 days
- **Actual:** 13 implementation tasks + 2 deferred (VR) + 2 docs (T16 handoff + T17 memory sync)
- Hooks extraction split into sub-tasks (T5a/b/c and T6a/b) due to single-dispatch context budget; each sub-task shipped behind feature flag with parity testing before flag flip in T13

---

## References

| Document | Path |
|---|---|
| Spec | `docs/superpowers/specs/2026-05-27-coach-game-viewer-design.md` |
| Red-team review | `docs/reviews/2026-05-27-coach-game-viewer-redteam.md` |
| Implementation plan | `docs/superpowers/plans/2026-05-27-coach-game-viewer.md` |
| Arena end-state popup handoff (retention-loop precedent) | `docs/handoffs/2026-05-27-arena-end-state-popup-polish-handoff.md` |
| Hook ref stability rule | `memory/feedback_hook_ref_stability.md` |
| Arena fresh param convention | `memory/project_arena_fresh_param.md` |
| Deferred work ledger | `_bmad-output/implementation-artifacts/deferred-work.md` |

---

## Next Steps

1. **T17 — Memory sync**: create `project_coach_game_viewer.md` + add MEMORY.md index entry + cross-refs from `project_arena_end_state_popup_polish.md` and `feedback_hook_ref_stability.md`
2. **VR-sprint cluster**: lock PNG baselines for `/coach/[gameId]` and the new mint-pill phases (T14 + T15 scope)
3. **`startingFen` persistence fix**: wire from `arena-persistence.ts` into `runPersist` body (estimated: 1 task)
4. **i18n sweep for extracted hooks**: replace EN literals in `useCoachAnalysis` + `useMintVictory` with `tEntry()` calls
5. **Backdrop-tap guard on victory popup**: disable when mint is available
6. **README "What's live" update**: add `/coach/[gameId]` as a shipped surface (out of scope for this cluster)
