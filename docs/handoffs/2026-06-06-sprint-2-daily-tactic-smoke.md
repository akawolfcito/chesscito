# Sprint 2 — Daily Tactic Evolution — Smoke Note

**Date:** 2026-06-07
**Performer:** Wolfcito (manual smoke on local dev at `localhost:3002`)
**Status:** PASSED — sufficient confidence to push.
**Range pushed:** `21fb30ac..26bd9d07` (7 commits, Sprint 2 A-F).

## Smoke executed

- **Daily Tactic opens correctly** from the Hub right rail. Sheet renders, board is interactive, hint and streak badges work.
- **Pool 14 → 30 validated visually** — today's puzzle landed inside the expanded pool (UTC 2026-06-07 served `dt-queen-2`, an existing pre-Sprint-2 entry, but the rotation index now operates `% 30` instead of `% 14`. New puzzles will surface as the calendar advances).
- **Reward preview reviewed** — connected user saw the `+3 Peones preview` block on the "Solved!" screen with the explainer copy `Daily rewards unlock in the next economy sprint.` Telemetry confirmed:
  - `daily_tactic_completed` carries `peonesEarned: 0` **AND** `rewardPreviewPeones: 3`.
  - `daily_streak_updated` carries `streakType: "first"` and `bonusPeonesEarned: 0`.
  - **No `peones_earned` event** appears anywhere in the trace.

## What is NOT live (intentional)

- **No real Peones balance.** No new localStorage key. No spendable currency.
- **No ledger.** No Supabase writes, no economy endpoints, no on-chain ops added.
- **No HUD chip of Peones.** Header/dock unchanged.
- **PRO extras do not render.** `getProDailyExtras(today)` exists as pure plumbing; no HUB tile mounts it. UI consumer is deferred to Sprint 2.1 (visual cluster) or later.
- **Difficulty chip not rendered.** Tag exists as data only.

## Open follow-ups (carry into Sprint 3)

- Sprint 3 — Peones=Estrellas + ledger off-chain on Supabase. This is where the schema fields reserved in Sprint 2 (`peonesEarned`, `bonusPeonesEarned`) become non-zero.
- Sprint 4 — Compendio TX (Coach/hints/retries via Peones, PRO bypass matrix).
- Sprint 2.1 (visual cluster, optional) — mount `getProDailyExtras()` results in the HUB rail for PRO users.
- Badge Earned visual parity (pre-existing debt from before Sprint 1).
- `result-overlay.tsx` X/15 display refactor when `StarsRow` takes a `piece` prop.

## Production status

**Production remains on hold** until the Sprint 4 retrospective per the calibration doc §6. Vercel will deploy `main` to preview only; `origin/production` does NOT advance with this push.

## Telemetry note for future smokes

`NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY=1` in `apps/web/.env.local` is required to observe `/api/telemetry` POSTs during local development — by default `lib/telemetry.ts` no-ops in dev to avoid StrictMode double-fires and unattended profiler sessions burning Supabase rows. Wolfcito enabled it for this smoke and is expected to revert/remove the flag before the next coding session.

## Next step

Begin Sprint 3 calibration — same shape as the Sprint 2 calibration doc (`docs/product/chesscito-sprint-2-daily-tactic-calibration-2026-06-06.md`): inventory the current Peones surface, map the ledger schema, identify risks before writing code. NO implementation yet.
