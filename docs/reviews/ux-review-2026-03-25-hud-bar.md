# UX Review — HUD Bar (Play-Hub)
**Date:** 2026-03-25
**Scope:** Zone 1 HUD bar in mission-panel.tsx, compared with arena-hud and other headers

## Critical (must fix)

1. **[mission-panel.tsx] Piece selector icon-only is not discoverable** — Unicode ♜ ♝ ♞ without labels. title= attribute invisible on mobile. New users don't know these are interactive or what they mean.
   - **Fix:** Show label on selected piece (`♜ Rook`), keep inactive as icon-only.

2. **[page.tsx:813-821] More button is 40px (below 44px minimum)** — `h-10 w-10` violates design system. Uses `rounded-[10px]` while adjacent exercise drawer uses `rounded-full`.
   - **Fix:** Change to `h-11 w-11 rounded-full border border-white/10 bg-white/5` to match arena HUD pattern.

3. **[mission-panel.tsx:111-131] Flat visual hierarchy** — Everything at 40% opacity. No clear primary element.
   - **Fix:** Inactive pieces to 55% opacity. Lv badge to 60% and text-xs. Selected piece is the only bright element (correct).

4. **[exercise-drawer.tsx:66-73] Drawer trigger is ~18px tall (below 44px minimum)** — `py-1 text-[0.65rem]` makes a tiny chip. Looks decorative, not interactive.
   - **Fix:** Add `min-h-[44px]` and increase to `text-xs`.

## Major (should fix)

5. **[mission-panel.tsx:111] No gap between piece buttons** — Touch targets abut with zero spacing. Fitts's Law violation.
   - **Fix:** Add `gap-1` to piece button container.

6. **[mission-panel.tsx] Inconsistent with arena HUD** — Arena uses bordered chips (`border border-white/10 bg-white/5 rounded-full`). Play-hub has no borders on utilities.
   - **Fix:** Adopt arena chip pattern for exercise drawer and more button.

7. **[mission-panel.tsx:118] disabled:opacity-30 vs design system :50** — Pieces at 30% are almost invisible.
   - **Fix:** Change to `disabled:opacity-50`.

## Minor (nice to fix)

8. **[mission-panel.tsx] No screen context** — User lands on cryptic icon bar with no "where am I" indicator.
   - **Fix:** Consider showing piece name on selected tab as implicit section title.

9. **[globals.css:658] HUD bar padding inconsistent with arena** — Play-hub adds extra wrapper padding (px-3) that arena doesn't.
   - **Fix:** Standardize to `mx-2 mt-2` like arena.

10. **[mission-panel.tsx:135] Right cluster cramped without separator** — Lv + stars + dots in 8px gap with no visual separation from left group.
    - **Fix:** Merge Lv into exercise drawer chip (`Lv3 ★ 7/15`) or add subtle divider.

## Passed
- Phase flash overlay (polished, animated)
- Footer HUD strip (clean, consistent)
- Board stage fills remaining space correctly
- Piece hint renders properly

## Summary
- Screens audited: 4 (mission-panel, arena-hud, trophies, about)
- Critical: 4 | Major: 3 | Minor: 3
