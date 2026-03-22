# Arena Visual Consistency — Design Spec

**Issue:** #62
**Goal:** Align the Arena screen (`/arena`) with the Play Hub's design language so both feel like the same game. Follow proven patterns from Chess.com, Lichess (minimal in-game UI), and Duolingo (celebratory end states).

**Principle:** Lichess during the game, Duolingo at the end.

---

## 1. Background

**Current:** Arena uses `bg-badges-chesscito` (badge hall art) — different vibe from the rest of the app.

**Change:** Replace with `bg-chesscitov3` (the Play Hub game background). This is the app's primary world art and should be universal.

**Implementation:** In `globals.css`, change `.arena-bg::before` `background-image` from badge hall to `var(--playhub-game-bg)`. Set `.arena-bg::after` overlay to `rgba(6, 14, 24, 0.72)` (up from `0.62`) to maintain text readability over the busier game background. Test with end-state overlays active (sparkles + `bg-black/65` scrim).

**Files:** `globals.css`

---

## 2. HUD Bar — Resign Integration

**Current:** The resign button floats alone below the board in a separate actions bar. Wastes vertical space and feels disconnected.

**Change:** Move resign into the HUD bar as a compact icon button on the right side (where there's empty space today). Remove the standalone actions bar below the board.

**Pattern:** Lichess places resign/draw-offer in a compact toolbar, never as a large standalone button.

**Visual hierarchy — back vs resign:**
- **Back** = neutral primary utility: `text-white/70 hover:text-white`
- **Resign** = low-emphasis destructive utility: `text-white/35 hover:text-rose-400`

Back should feel like navigation. Resign should feel like a deliberate, secondary action — lower visual weight prevents it from competing with back.

**Implementation:**
- `arena-hud.tsx`: Add a resign icon button (Flag icon, same as today) on the right side of the existing `.hud-bar`. Style: frosted circle (`rounded-full border border-white/10 bg-white/5`) with `text-white/35 hover:text-rose-400`. Back button uses same frosted circle but `text-white/70 hover:text-white`.
- `arena/page.tsx`: Remove the standalone actions bar `div` that wraps the resign button. Pass `onResign` prop to `ArenaHud`.

**Files:** `arena-hud.tsx`, `arena/page.tsx`

---

## 3. Back Navigation

**Current:** Text-only `← Back` link in difficulty selector. Plain `←` character + text in HUD bar.

**Change:** Use the frosted circle pattern from trophies page: `rounded-full border border-white/10 bg-white/5` + Lucide `ArrowLeft` icon. Apply in both:
- `DifficultySelector` back link
- `ArenaHud` back button

**Files:** `difficulty-selector.tsx`, `arena-hud.tsx`

---

## 4. Difficulty Selector — Frosted Container

**Current:** Buttons and title float directly over the background with no container. Feels ungrounded.

**Change:** Wrap the selector content in a frosted glass card matching the Play Hub aesthetic:
```
rounded-3xl border border-white/[0.08] bg-[#0a1424]/92 backdrop-blur-2xl
shadow-[0_0_60px_rgba(20,184,166,0.08)]
```

Max width stays at 320px (fits within 390px viewport with padding).

**Files:** `difficulty-selector.tsx`

---

## 5. End State Panels — Unified Blur

**Current:** End state sub-panels (victory celebration, claiming, claim success, claim error) have slightly different blur/border treatments.

**Change:** Ensure all panels use a consistent container style:
- Border: `border border-white/[0.08]`
- Background: `bg-[#0a1424]/92`
- Blur: `backdrop-blur-2xl`

Review each sub-component and normalize. No layout changes — only border/bg/blur tokens.

Also includes:
- **Lose-state card** in `arena-end-state.tsx` (lines ~117-148): Uses `bg-[#0b1628]/90 backdrop-blur-xl border-white/10` — normalize to the shared tokens above.

**Promotion overlay — special case:**
`promotion-overlay.tsx` currently uses `bg-slate-800/95`. It should get frosted treatment (`border border-white/[0.08] bg-[#0a1424]/92 backdrop-blur-2xl`) but keep `rounded-2xl` (not `rounded-3xl`) since it's a compact inline control centered over the board, not a full-screen panel. Larger radius on a small element looks bloated.

**Files:** `arena-end-state.tsx`, `victory-celebration.tsx`, `victory-claiming.tsx`, `victory-claim-success.tsx`, `victory-claim-error.tsx`, `promotion-overlay.tsx`

---

## Shared Design Tokens

To avoid duplicating the frosted pattern across 8+ files, these are the canonical tokens:

**Frosted panel (full-screen cards, end states, difficulty selector):**
`rounded-3xl border border-white/[0.08] bg-[#0a1424]/92 backdrop-blur-2xl shadow-[0_0_60px_rgba(20,184,166,0.08)]`

**Frosted compact (inline overlays like promotion):**
`rounded-2xl border border-white/[0.08] bg-[#0a1424]/92 backdrop-blur-2xl`
Same material, smaller radius. Use for controls that sit over the board.

**Frosted circle button:**
`rounded-full border border-white/10 bg-white/5`

These already exist implicitly in the Play Hub and victory sub-components. No CSS class extraction needed for this PR — just ensure consistent application.

---

## What Does NOT Change

- Board rendering (shared geometry from `board-geometry.ts`)
- Piece images and gold/purple CSS tint
- Game logic, chess engine, mint/claim flow
- No persistent dock in Arena (intentional — concentration mode)
- ArenaBoard cell highlight styles (already close to Play Hub)

---

## Success Criteria

- Arena background matches Play Hub world art
- All Arena containers use frosted glass pattern
- Back navigation uses circle icon pattern (not text arrow)
- Resign lives in HUD bar, no floating button below board
- Mobile-first verified at 390px viewport
