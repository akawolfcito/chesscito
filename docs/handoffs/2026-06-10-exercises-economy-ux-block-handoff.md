# Handoff — Exercises economy/UX polish block (2026-06-10)

> Continuation of the SaveScore + economy work. Triggered by smoke
> feedback: spending Peones is painful, RETRY invisible, free-saves never
> communicated, insufficient = dead end, icons mismapped, hint loop.
> Focus per founder: **exercises + labyrinth first**, then chess + coach.

## NEXT SESSION — start here

1. **User pushes the D commits to `main`** → fresh preview build (I do NOT
   push unless asked).
2. **Re-smoke** the preview, validate-before-adding:
   - Exercises **numbered contiguous 1,2,3,4…** = rotation OFF confirmed
     (the #1 check; preview is OFF only if the env was false BEFORE the build).
   - Complete a piece → **SAVE + CLAIM both visible** (SAVE=chest score-saved,
     CLAIM=badge-save-icon, no bg).
   - 4th save w/o Peones → **"Get Peones" + "Not now"** (not just Dismiss),
     copy with no "5".
   - Free save → **"X free saves left"** pill.
3. **If green** → do the Remaining (HINT icon+label, hint circle, hint race)
   and build **Deep Hint (3 Peones)** as the next economy-v2 sink.

## Done this block (commits on `main`, LOCAL — not pushed yet)

| Commit | What |
|---|---|
| `f8e64ac3` | SAVE + CLAIM independent reward actions (no slot fight) — both pins show side by side |
| `04973f8c` | docs: rotation loop investigation (root cause: advanceExercise is rotation-unaware) |
| `476f5c2b` | **D1** insufficient-save recovery (Get Peones CTA + "Not now") + free-saves quota pill + stale "5 free saves" copy → "out of free saves / need 1 Peón" (EN+ES) |
| `0748cf1e` | **D2** retry marked deprecated/inactive sink (already free; doc-only) |
| `ba947740` | **D3 (icons)** SAVE→score-saved (chest), CLAIM→badge-save-icon (pedestal, no bg tile) — swap + bare-sprite |

Earlier same session (already pushed `main` + hosted db push applied):
SaveScore Slices A–C, leaderboard combined, economy recalibration
(cap 6, training +1 flat, quota 3), rotation flag investigation.

Suite **3490/3490**, tsc + eslint clean.

## Remaining (NOT done — next pass)

1. **D3 — HINT as icon+label** (founder): the HINT action should show as
   icon+label using `design/iconsx/hint-icon.png` (it exists), consistent
   with SAVE/CLAIM, not a plain text label. Needs: add `hint-icon` triplet
   to `apps/web/public/art/new-icons-chesscito/`, wire into the hint
   surface (`PeonesHintButton` / wherever HINT renders).
2. **D4 — hint on-board indicator**: currently a square on the cell;
   founder wants a **pulsing circle** so it reads as an overlay, not a
   mismatched square. (`peonesHintSquare` reveal in board/exercises.)
3. **Hint low-balance "weird message" + race**: user hit a confusing
   message when spending the last Peón on hint; worked after a delay.
   Repro + fix the insufficient/spend UX on hint.
4. **Rotation advance bug (the real loop)**: `advanceExercise`
   (`use-exercise-progress.ts:416`) advances by linear pool index, ignoring
   the visible set → with rotation ON you loop on 1,2,3 and never reach
   6,7,8. **Workaround chosen = turn the flag OFF** (the user redeployed
   production with the flag changed). Proper fix (rotation-aware advance +
   the 4 founder calibration decisions) is its own spec when rotation is
   prioritized.

## Economy v2 — direction (founder-confirmed, design pending)

Do NOT tighten earn further (cap 6 / training +1 / quota 3 / retry-free are
set). Make spending **desirable, visible, understandable**:
- Show cost before the spend; never charge what the user didn't choose.
- Communicate the free-save quota in the moment (started: post-save pill).
- Insufficient → Get Peones, never just Dismiss (done for SaveScore).
- Priority sinks: Hint (1), **Deep Hint (3 — next real sink to build)**,
  SaveScore (3 free + 1), Streak protection (near future), Cosmetics/
  themes (long term, `theme-system-foundation` dormant), Coach (manual).
- Retry returns later only as a manual/visible "Second Chance".

## Notes / gotchas

- The 5 D-commits are LOCAL. Push to `main` → preview build (rotation OFF
  if the env was changed before the build). Production was redeployed
  separately by the user for the flag.
- `notEnoughPeones` copy no longer hardcodes a count (avoids drift).
- `ResultOverlay` new props: `recoveryCta` (error primary CTA) +
  `freeSavesLeft` (score quota pill).
- Icon semantics locked: score-saved = saved/chest, badge-save-icon =
  badge/pedestal. SavedChip (saved state) also uses score-saved.
- Pre-launch: production has no real users (safe to iterate).
