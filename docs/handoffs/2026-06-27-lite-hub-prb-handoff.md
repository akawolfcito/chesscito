# Handoff — Lite hub PR B + daily-ritual groundwork (2026-06-27)

## State
- Branch **`feat/lite-hub-prb`** (~29 commits, not pushed). Full web suite
  **4515/4515**, `tsc` clean.
- **PR B is functionally complete**: `HubLiteScaffold` is built, mounted via the
  `CHESSCITO_LITE_MODE` switch in `HubScaffoldClient`, and **Stage 3b** is done —
  the dead Lite branches were removed from the Full `HubScaffold` (it no longer
  references `CHESSCITO_LITE_MODE`).

## What shipped this session (visual + cleanup)
- New Lite hub: avatar + `title-chesscito` art, `bg-wallpaper-lite`, the compact
  **21-Day Mind Challenge card** (icon-left, FOCUS PASSPORT **progress bar**
  `N/21 focus days`, inline stats with SVG icons, Join Challenge; active state =
  ACTIVE chip + `X/21 day` tile + flames-bottom). Start Focus = TRAIN-PIECES gold
  framed by `ring-start-focus` (button unchanged, ring overlaid). Training Path
  pinned to the screen bottom. HUD top-aligned. Stable panel height across
  loading/offer/active (killed the load flash).
- New art (all png+webp+avif): `avatar-lite-hub`, `bg-wallpaper-lite`,
  `title-chesscito`, `21-challenge-icon`, `ring-start-focus`.
- Stage 3b: removed `focusPassport`/`nextStepCard`/`onSeasonPassPress` from
  `HubScaffold` + the `!CHESSCITO_LITE_MODE` chip guards + dead imports + the
  Lite-branch tests; dropped `startFocusLabelKey` resolver (Start Focus is fixed).

## Next steps (sequenced, agreed with founder)
1. **Daily Ritual Loop** — its OWN spec → red-team → TDD. Core gameplay change:
   - A "focus day" (streak) = **Daily Focus + ≥ N exercises** (N=1, configurable).
   - Start Focus = guided 2-step CTA: "Start Focus" (does the Daily Focus) →
     "Practice More" (`/exercises`).
   - Streak writes on **ritual completion** (either order, once/UTC-day).
   - Specs: `docs/specs/lite-hub-daily-heartbeat.md` ("Daily ritual loop"),
     red-team `…-daily-heartbeat-redteam.md`. **Implementation risks R1–R4** there
     (R1 = move the `recordDailyCompletion` trigger; R3 = confirm
     `consumedContentIds` counts a completed exercise, excludes the daily focus).
2. **Daily heartbeat** (visual layer) on top of the ritual: 4 moments — pending
   glow / completion sweep+✓ / **cooldown chip** (`⏱ Xh` / `🌙 Tomorrow`, locked to
   the END of the progress row) / gift pulse. Reuses `cooldownLabel()` +
   `hoursUntilNextUtcDay()`.

## Open / pending
- **VR baseline for the Lite hub** was never captured (PR B acceptance item) —
  run `pnpm test:e2e:visual` and commit the Lite baseline before merge.
- **G1 content-loop plumbing**: `primaryFocus.contentLoop` is still passed to
  `HubLiteScaffold` but unused (Start Focus fixed). Will be replaced by the ritual
  loop; remove the dead plumbing when that lands.
- **G3 claim-queue notif dot** has no home in the Lite HUD (pre-existing deferred).
- Reference Image #12's side leaves/flowers are not in `ring-start-focus` (only
  the gold frame); a richer asset would be needed if wanted.
- PR B not pushed/merged; merge target `main` per repo convention.
