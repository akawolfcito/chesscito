# 2026-06-05 — Popup vocabulary cluster + Enter Arena training-cascade close

## TL;DR

Shipped 10 commits between `c2fba9d4..b383b6a6`. `origin/main` and
`origin/production` both sit at `b383b6a6` — Vercel auto-deploy
triggered on the production push.

The cluster aligns three exercises completion popups (All Exercises
Complete!, Labyrinth Solved!, Score Saved!) with the canonical
arena-end-state visual vocabulary — same `panel-bg1` shell, same
`candy-stat-pill` chips, same `PrincipalButton` green CTA family used
by Accept Challenge and Mission Briefing PLAY. The session also closes
the training cascade UX: finishing a King labyrinth now offers
**Enter Arena** instead of "Try again", routing the user into the
full match flow as the natural next step.

## What shipped

### Phase A — arena-end-state vocabulary adoption

| Commit | Surface |
|---|---|
| `c2fba9d4` | PieceCompletePrompt + ResultOverlay score variant migrated from CandyGlassShell to VictoryPopupShell + `panel-bg1` + `arena-result-*` tokens. Score variant inlines the CeloScan receipt chip as its own band since VictoryPopupShell has no meta slot; badge/shop/error stay on CandyGlassShell (out of scope). |
| `03053c62` | LabyrinthCompleteOverlay migrated to the same vocabulary. Hero centered (`victory-popup-hero-solo`), three stat pills (stars / moves / best), new-best celebration pill + perfect-path kicker preserved. |
| `c17968f6` | Two visual fixes spotted in the first review: Retry CTA moved OUT of `.arena-result-coach-section` so it stops inheriting the purple "Why did you win?" override (renders canonical green); Score variant CeloScan chip stacks on its own line below "chesscito · on Celo" instead of competing inline. |

### Phase B — fixture experiment, reverted

| Commit | Surface |
|---|---|
| `7b823ba8` | Added `/dev/exercises-popups` fixture + 8 vr13 baselines mirroring `/dev/arena-end-state`. Intent: lock visual regressions on the 3 popups. |
| `120a42e9` | Reverted Phase B on user feedback — the fixture did not earn its keep because the underlying button family was still wrong (see Phase C). Spec entries + 8 PNG baselines + fixture pages removed. |

### Phase C — canonical button family + structure

| Commit | Surface |
|---|---|
| `2128449a` | `VictoryPopupShell` scrim z-index bumped from `z-50` to `z-[70]` so the dimmed backdrop covers the PersistentDock (which sits at `z-60` in globals.css). The dock was visually piercing modals on `/exercises` because the layer war was lost. Arena win popups benefit too — same shell. |
| `0c42932f` | All three popups adopt `PrincipalButton` (the green family used by Accept Challenge + Mission PLAY) instead of the bespoke `.arena-result-primary-cta` pill. PieceCompletePrompt restructured to canonical TITLE → IMAGE → STARS → MESSAGE → BUTTONS stack (was hero-row icon LEFT + title RIGHT). Tertiary "Try Coach Review in Arena" hint dropped — at piece-complete the user is still learning the piece, so the Coach review framing does not apply. Avatar moved to a Sally-style bottom-right peek inside the foliage zone. |
| `f1c8b21d` | Two size clamps: title wrapped in `.victory-popup-hero-solo` so the font drops from base `clamp(38px, 8dvh, 56px)` to `clamp(26px, 5.4dvh, 36px)` (was overflowing on `All Exercises Complete!`); `PrincipalButton size="large"` (280px) → `size="medium"` (220px) to fit the 272px usable width inside the 340px panel padding. New convention: **large** for full-bleed surfaces (Accept Challenge), **medium** for inside-modal CTAs (Mission, completion popups). |
| `8f1d31e1` | Refresh icon removed from Labyrinth Try Again CTA. PrincipalButton family is text-only by convention; stat-pill icons (★ / ♟ / 🏆) stay because they are chip glyphs, not CTA glyphs. |

### Phase D — training cascade close

| Commit | Surface |
|---|---|
| `b383b6a6` | `LabyrinthCompleteOverlay` accepts an optional `onEnterArena` callback. When provided, the primary CTA switches from "Try again" to "Enter Arena" routing to `/arena?fresh=1`. `exercises-screen` wires the callback only when `selectedPiece === "king"` (the final piece in `PIECE_ORDER`), so the substitution fires exactly once — at the moment the user closes the last training milestone. `LABYRINTH_COPY.enterArena` added to `editorial.ts` + `messages/es.ts` ("Enter Arena" / "Ir a la Arena") per the i18n parity HARD RULE. |

## State at session end

- `origin/main` = `origin/production` = `b383b6a6`.
- tsc clean across all commits.
- `pnpm vitest run src/components/exercises` → 43/43 affected tests passing.
- VR baseline coverage for these surfaces deliberately NOT locked. The
  `/dev/exercises-popups` fixture attempt was reverted because the
  popups are exercised through the real `/exercises` flow going
  forward; future regressions surface in user testing, not in CI.
- No new strings without ES mirrors; i18n parity preserved.

## How to verify in production

1. **Scrim covers the dock** — open `/exercises`, complete a piece (or
   trigger any of the 3 popups). The PersistentDock must be dimmed by
   the scrim — no live items visible through the modal.
2. **PrincipalButton family** — the green CTA inside each popup must
   look identical to the `Accept Challenge` button on `/victory/1`.
   Same gradient, same border-radius, same bevel, same width family.
3. **Title fits the panel** — "All Exercises Complete!" must lay out
   on three lines without horizontal clipping. "Labyrinth Solved!"
   must lay out on two. "Score Saved!" on one or two.
4. **No icon on CTAs** — Start `<piece>`, Try again, Enter Arena,
   Share are all text-only. Stat pills retain their ★ / ♟ / 🏆 glyphs.
5. **Enter Arena swap** — complete every King exercise, then complete
   any King labyrinth. The primary CTA must read **Enter Arena** and
   route to `/arena?fresh=1` (difficulty + color selector). For every
   other piece's labyrinth the CTA stays "Try again".

## Open questions / deferred work

1. **Badge/shop/error variants of ResultOverlay** still render through
   CandyGlassShell. Migration to the arena-end-state vocabulary is a
   small follow-up — same recipe as the score variant migration in
   `c2fba9d4`. Not blocking; the variants the user actually sees most
   (score, error in MiniPay) feel coherent.
2. **`/api/og/exercise` share card** — the piece-complete share card
   still encodes the old structure ("piece icon left + title right").
   Restyle to match the new in-app popup if we want the share funnel
   to feel cohesive with the redesigned celebration. Not blocking the
   /exercises flow.
3. **Multi-labyrinth per piece** — the `Enter Arena` swap currently
   triggers on **any** King labyrinth solve. When more King labyrinths
   land, swap should fire only on the last one. Track per-piece
   labyrinth completion in `useExerciseProgress` and gate
   `onEnterArena` on "all King labyrinths solved" instead of
   `selectedPiece === "king"`. Small follow-up, can wait until v0.2.
4. **VR baseline strategy for these popups** — open question whether
   to lock them at all. The previous attempt failed because the
   button family was still in flux; with PrincipalButton settled,
   baselines would be stable. If we want CI guardrails, a smaller
   fixture (3 captures: piece-complete-final, labyrinth-king-solved,
   score-saved) would be enough.
5. **Phase E TODO from MEMORY** — `feedback_avatar_emotion_selection`
   and `project_panel-mision-as-destination-pattern` memory entries
   suggested at the end of the 2026-06-05 popup-polish handoff
   (commit `bb79d2dc`) are still unwritten. Worth adding before too
   many sessions pass.

## Housekeeping shipped same session

- `.gitignore` now ignores `lh-*.json` (Lighthouse audit reports per
  session). The six untracked artifacts that had been sitting in repo
  root + `apps/web/` since the perf cluster were deleted.

## Cross-refs

- Inventory `docs/audits/2026-06-04-distant-screens-inventory.md` — items 3-7 closed in earlier sessions; the completion popups touched today were items 3 + 4 + 7 (score saved / piece complete / labyrinth solved). Item 8 (Badge art consolidation, P2) deferred indefinitely per audit recommendation.
- Memory entries `cta-token-system` (commit `4f08e5c5`) and `hud-chip-family` confirm the broader move toward a single button vocabulary; this cluster is the same direction extended to the completion popups.
- `release-process.md` 6-step flow followed verbatim for the deploy: push main, switch to production, ff merge, push production, return to main.
