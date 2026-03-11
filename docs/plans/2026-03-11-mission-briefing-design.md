# Mission Briefing Overlay — Design

**Goal:** Replace the easily-missed tutorial banner with a prominent mission briefing overlay that appears before every exercise, plus a persistent piece-hint during gameplay.

---

## How It Works

### 1. Mission Briefing Overlay (`MissionBriefing`)

A modal card centered over the dimmed board. Appears **every time** a new exercise starts (not just first visit).

**Layout (top to bottom):**
- Avatar mascot (wolf) — circular, ~80px, with glow
- "MISSION" label — cyan, small caps
- Objective text — "Move your Rook to h1" (dynamic per exercise)
- Piece hint — "The Rook moves in straight lines" (per piece type)
- "PLAY" button — cyan gradient, prominent

**Board behind:** visible but dimmed with dark scrim (~70% opacity).

**Interaction:**
- Board is non-interactive while briefing is shown (pointer-events: none on hitgrid)
- Player presses "PLAY" → overlay closes with shrink-to-center + fade animation (~400ms)
- Board becomes interactive, timer starts

**State:** `showBriefing: boolean` in page.tsx. Set `true` on exercise start, set `false` on PLAY press.

### 2. Persistent Piece Hint

Replaces the current `TutorialBanner` (which fades after 4s and causes layout shift).

**Behavior:**
- Small text line always visible below the HUD bar during gameplay
- Shows piece movement rule: "♜ Straight lines" / "♝ Diagonal moves" / "♞ L-shaped jumps"
- For capture exercises: "♜ Capture the target"
- Fixed height, never collapses — eliminates layout shift entirely

### 3. What Gets Removed

- `TutorialBanner` component (the fading banner)
- `showTutorial` state + localStorage tutorial flags
- `showCaptureHint` state
- `min-h-[32px]` wrapper in mission-panel.tsx
- Tutorial banner CSS animations (`tutorial-banner-in`, `tutorial-banner-out`)

## Components

### New: `MissionBriefing`
- Props: `pieceType: PieceId`, `targetLabel: string`, `isCapture: boolean`, `onPlay: () => void`
- File: `apps/web/src/components/play-hub/mission-briefing.tsx`
- Uses copy from `MISSION_BRIEFING_COPY` in editorial.ts

### Modified: `MissionPanel`
- Remove `tutorialBanner?: ReactNode` prop
- Add `pieceHint?: string` prop — rendered as fixed-height line below HUD

### Modified: `page.tsx`
- Add `showBriefing` state, set `true` on exercise change
- Remove `showTutorial`, `captureHintSeen`, `TutorialBanner` component
- Pass `pieceHint` string to MissionPanel

## Editorial Copy

```ts
export const MISSION_BRIEFING_COPY = {
  label: "MISSION",
  play: "PLAY",
  moveHint: {
    rook: "The Rook moves in straight lines",
    bishop: "The Bishop moves diagonally",
    knight: "The Knight jumps in an L-shape",
  },
  captureHint: "Capture the target piece",
  pieceHint: {
    rook: "♜ Straight lines",
    bishop: "♝ Diagonal moves",
    knight: "♞ L-shaped jumps",
  },
  captureHintCompact: "♜ Capture the target",
} as const;
```

## CSS

- `.mission-briefing-scrim` — fullscreen dark overlay (rgba(10,20,25,0.70))
- `.mission-briefing-card` — frosted glass card (bg rgba(2,12,24,0.92), backdrop-blur, border cyan/25%)
- `.mission-briefing-exit` — keyframe: scale(1)→scale(0.85) + opacity(1)→opacity(0) in 400ms
- `.piece-hint` — fixed-height line (font-size 11px, text-cyan-100/60, centered)

## Files to Modify

- Create: `apps/web/src/components/play-hub/mission-briefing.tsx`
- Modify: `apps/web/src/components/play-hub/mission-panel.tsx` — remove tutorialBanner, add pieceHint
- Modify: `apps/web/src/app/play-hub/page.tsx` — add showBriefing state, remove tutorial states
- Modify: `apps/web/src/lib/content/editorial.ts` — add MISSION_BRIEFING_COPY, remove TUTORIAL_COPY
- Modify: `apps/web/src/app/globals.css` — add briefing CSS, remove tutorial banner CSS

## Scope

- No new dependencies
- No blockchain interaction
- Client-side only
- Mobile-first (390px viewport)
