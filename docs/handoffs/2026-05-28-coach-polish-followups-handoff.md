# Coach Game Viewer — Polish Follow-ups (sub-cluster)

**Date:** 2026-05-28
**Branch:** `main`
**Commit range:** `0db1d9c3..d589f7b1` (7 commits)
**Status:** SHIPPED — full follow-up sweep complete; cluster Coach Game Viewer 100% closed.

---

## Context

The Coach Game Viewer cluster (handoff `2026-05-28-coach-game-viewer-handoff.md`, commits `12489b06..a82a375b`) shipped 13 tasks with **6 known limitations** captured in its handoff §Known Limitations and 1 deferred-work entry. This sub-cluster knocks down every one of them in a single session.

Same-session GH housekeeping pass turned the 6 limitations into issues #114–#119, which then got shipped + closed individually.

---

## What Shipped

### 7 atomic commits, 1 commit per issue/topic

| # | Topic | Commit | Files |
|---|---|---|---|
| ledger | Persist `startingFen` on resumed games | `0db1d9c3` | 4 |
| #114 | Backdrop-tap guard on victory popup w/ mint pending | `51f307a0` | 3 |
| #115 | Coach-section parity post-mint (VictoryClaimSuccess) | `097a877d` | 2 |
| #116 | `router.prefetch` /coach/[gameId] while popup visible | `6d4696e6` | 1 |
| #117 | Restore `historyMeta` surfacing on CoachPanel post-T13 | `5fa1d29d` | 3 |
| #118 | Localize hook error strings (i18n sweep) | `89a76ae9` | 5 |
| #119 | VR baselines /coach/[gameId] + refresh win-success | `d589f7b1` | 8 |

### Test count delta

| Milestone | Affected suite | Result |
|---|---|---|
| Pre-cluster baseline | full | ~2120+ passing |
| After `0db1d9c3` | arena-persistence | 15/15 (+3) |
| After `51f307a0` | victory-popup-shell | 4/4 new file |
| After `097a877d` | arena components | 50/50 (no regressions) |
| After `6d4696e6` | arena page + components | 50/50 |
| After `5fa1d29d` | use-coach-analysis + threading | 334/334 (+2 hook tests) |
| After `89a76ae9` | coach + arena | 334/334 |
| After `d589f7b1` | playwright VR | 5/5 (4 new vr10 + 1 refreshed vr9) |

tsc clean at every commit.

---

## Surfaces Touched

### `useChessGame` + arena-persistence
- New `startingFen` field on `ArenaGameSave` (round-trip, drop-on-corrupt validators).
- `useChessGame` exposes `startingFen?: string` on `ChessGameState`; captured on resume effect; resets in `startGame` / `reset`.
- `arena/page.tsx runPersist` posts `startingFen` when defined.
- Legacy saves (sans `startingFen`) capture `saved.fen` as new origin AND reset `moveHistory` — fresh contract starts at the resumed FEN.

### Victory popup family
- `VictoryPopupShell.disableBackdropClose` prop; `VictoryCelebration` activates it when `onClaimVictory` is defined (mint CTA visible).
- `VictoryClaimSuccess` now renders the full `arena-result-coach-section` block (kicker COACH REVIEW + headline + body + amber pill + wolf RIGHT) — silhouette parity with pre-mint. PLAY AGAIN drops to tertiary row alongside Share.
- `arena-end-state.tsx` forwards `proActive`, `coachCtaDisabled`, `coachCtaBusy`, `coachTooShort` to `VictoryClaimSuccess`.

### `arena/page.tsx`
- New sibling useEffect to the pendingNavRef consumer: `router.prefetch(/coach/[gameId]?wallet=…)` while popup visible + wallet + persistedGameId.
- Threads `historyMeta={coach.historyMeta}` into the `<CoachPanel>` mount.

### `useCoachAnalysis`
- New `coachHistoryMeta` state populated on all 3 ready paths (POST analyze inline, analyzeFromHistory, reanalyze). Exposed via `historyMeta` on `CoachAnalysisState`.
- Offline-guard switched from raw EN copy to semantic code `"offline"` (sister values are `"not_persisted"` / `"error"`).

### `useMintVictory`
- `useTranslations("RESULT_OVERLAY_COPY")` injected; `translateTxError` moved into closure.
- "Signature expired …" literal replaced with `t("error.signatureExpired")` (new key, EN+ES).

### Editorial
- `RESULT_OVERLAY_COPY.error.signatureExpired` (EN in editorial.ts, ES in messages/es.ts).

### Playwright VR
- New fixture `/dev/coach-viewer/` (page + fixture). 4 variants: win-unminted, win-minted, loss, partial-replay.
- 4 new baselines `vr10-coach-viewer-*-minipay-darwin.png`.
- Refreshed baseline `vr9-arena-end-state-win-success-minipay-darwin.png` (stale post-#115 coach-section refactor; PNG delta 260KB → 277KB).

---

## Risks Live on Main

| Risk | Severity | Mitigation |
|---|---|---|
| Coach-overlay analyze states have no VR baselines | Low | Deferred inside #119; structural tests + manual smoke cover routing |
| Desktop viewport for /coach/[gameId] unbaselined | Low | Minipay-first per VR baseline discipline; desktop not a priority |
| `signatureExpired` ES copy untested in MiniPay smoke | Low | Hook localizes correctly per unit test; ES MiniPay session would confirm |
| `router.prefetch` UX gain unverified in prod build | Low | Idempotent; worst case is no improvement (no regression risk) |

---

## Sub-cluster Closure Protocol (CLAUDE.md §)

1. **GitHub housekeeping** — ✅ Created issues #114–#119 mid-session; all 6 closed via commit log + manual `gh issue close` with shipping notes.
2. **Milestone closure** — ✅ No applicable milestone. M13 + M14 carry independent roadmap items.
3. **README sync** — ⏳ No live-state delta this cluster. `/coach/[gameId]` was already shipped in the parent cluster; this sub-cluster is polish. README "What's live" needs no edits.
4. **MEMORY.md sync** — ✅ This handoff + new `project_coach_polish_followups.md` memory file land alongside (see next section).
5. **Branch hygiene** — N/A. Worked direct on `main` per the cluster's convention.
6. **Handoff doc** — ✅ This file.

---

## References

| Document | Path |
|---|---|
| Parent cluster handoff | `docs/handoffs/2026-05-28-coach-game-viewer-handoff.md` |
| Parent cluster memory | `memory/project_coach_game_viewer.md` |
| This cluster's memory | `memory/project_coach_polish_followups.md` |
| Deferred work ledger | `_bmad-output/implementation-artifacts/deferred-work.md` (line ~264 marked closed) |
| Issues closed | #114, #115, #116, #117, #118, #119 |

---

## Next Steps

1. **MiniPay ES smoke** — validate `signatureExpired` + `RESULT_OVERLAY_COPY.error.*` render in Spanish during a real claim error. Production deploy + manual session.
2. **`router.prefetch` smoke** — production build validation per #116 acceptance §3.
3. **VR sprint expansion** — coach-overlay analyze states (PRO bypass / paywall / loading / ready) + desktop viewport for /coach/[gameId] — out of scope this sub-cluster, deferred inside #119 commit body.
4. **Next session priorities** — see `_bmad-output/next-session-prompt-2026-05-28.md` for the picked-up brief.

