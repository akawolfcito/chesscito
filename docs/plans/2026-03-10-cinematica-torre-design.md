# Cinematica Torre — Design

**Goal:** Teach rook movement on the player's first visit via guided highlights on exercise 1. No separate tutorial screen — learn by doing.

---

## Trigger

- First time `chesscito:progress:rook` is absent from localStorage (fresh user)
- A `tutorialSeen` flag saved to localStorage after first move; never shows again

## Visual: Highlighted Lanes

- When tutorial is active, the rook's entire rank and file are highlighted as a cross/plus shape
- Cells in the same rank + same file as the piece get `is-tutorial-hint` class
- Subtle glow tint (e.g. `bg-cyan-400/10` or similar lane overlay)
- Existing target indicator on h1 pulses as usual
- Lanes disappear on first valid move (same moment `tutorialSeen` is stored)

## Text: Inline Banner

- Copy: **"The Rook moves in straight lines — horizontal or vertical"**
- Position: top of the board area, inside the game stage
- Style: frosted pill matching HUD aesthetic
- Auto-fades after first move OR after 4 seconds, whichever first
- Editorial constant: `TUTORIAL_COPY.rook`

## Scope

- Rook tutorial only for now
- Bishop and knight get their own tutorials later (same pattern, different text + highlight logic)
- No new routes, sheets, or modals — conditional overlay on existing board

## Files to Modify

- `apps/web/src/lib/content/editorial.ts` — add `TUTORIAL_COPY`
- `apps/web/src/components/board.tsx` — accept `tutorialHints` prop, apply `is-tutorial-hint` to lane cells
- `apps/web/src/app/globals.css` — add `.is-tutorial-hint` styling
- `apps/web/src/app/play-hub/page.tsx` — manage `showTutorial` state, compute lane cells, pass to board, render banner
- `apps/web/src/components/play-hub/mission-panel.tsx` — render tutorial banner in board zone
