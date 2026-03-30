# Phase E3 — Visual Reset + Hero Vertical Slice

## Objective

Transform Chesscito from "polished web app with game theming" to "premium mobile game product" through a focused visual reset on the Play Hub screen. The change must be unambiguous — a before/after that reads as a language shift, not incremental polish.

The approach is a **Hero Vertical Slice**: reset one surface completely to target quality, then scale the language to the rest of the app.

## Scope

**IN**: Play Hub screen (mission-panel.tsx) + result overlay + arena end state text treatment + globals.css design tokens.

**Hero Slice components**:
- `mission-panel.tsx` — shell, piece rail, phase flash
- `board.tsx` — board wrapper panel
- `gameplay-panel.tsx` — mission/stats/action panel
- `contextual-action-slot.tsx` — CTA buttons
- `persistent-dock.tsx` — bottom navigation bar
- `result-overlay.tsx` — reward ceremony v1
- `arena-end-state.tsx` — victory text treatment only
- `globals.css` — surface tokens, font imports, keyframes, panel classes

## Out of Scope

- Body/paragraph font changes (SF Pro stays for body text)
- Sheet interior redesign (shop, badges, leaderboard, exercise drawer)
- Arena-specific background asset
- Arena defeat ceremony
- Dock icon illustration/replacement
- Character/mascot art
- Color palette overhaul
- Particle systems
- `arena-board.tsx` redesign (inherits wrapper changes passively)
- `arena-hud.tsx` redesign (minimal, inherits font if applicable)
- `status-strip.tsx` (dev-only)

## Core Pillars

### 1. Bold Surfaces & Materials

Replace frosted-glass/transparency aesthetic with solid, physical game surfaces. Every panel, button, and slot must feel like a tangible object — not a floating card on a blurred photo.

Key shifts:
- `backdrop-blur` removed from game surfaces (app language → game language)
- `rgba` semi-transparent backgrounds replaced with solid multi-stop gradients
- Borders from 1px `white/0.06` to 2px with bevel treatment (highlight top, shadow bottom)
- Box-shadows from subtle to multi-layer (outer depth + inset highlight + inset shadow)
- CTA buttons gain 3D press depth (shadow shift + scale on active)

### 2. Chunky Display Typography

Game font for the display layer only. Body text stays neutral (SF Pro / system). The contrast between chunky display and clean body is intentional hierarchy, not inconsistency.

Font: **Fredoka One** (Google Fonts, free, ~15-20KB via `next/font`).
- Bold, rounded, friendly — aligned with Chesscito's educational tone
- High readability at mobile scale over complex backgrounds
- Single display face (weight 700). Hierarchy comes from size, text-shadow intensity, and casing — not from multiple font weights

Text treatment: multi-layer `text-shadow` system.
- Layer 1: color glow (e.g., `0 0 20px rgba(34,211,238,0.3)`)
- Layer 2: dark outline (e.g., `0 2px 0 rgba(0,0,0,0.7)`)
- Intensity scales with element importance (titles > CTAs > labels)

### 3. World Building & Environment

The UI lives inside a world, not on top of a wallpaper. One hero background with depth and atmosphere replaces the current static PNG.

Constrained to 1 asset for P0. Quality gate applies — if the generated background doesn't meet quality bar, P0 ships without it (see Background Non-Blocking rule).

### 4. Reward Ceremony & Spectacle

The moment of reward is theatrical, not transactional. Exercise completion and victory feel like events worth celebrating. Staged reveals replace instant panel displays.

### Support: Motion & Particle FX

Motion reinforces the other pillars. It does not lead. Button press feedback, panel entrances, and score tick-ups add life to surfaces and rewards. No standalone motion work.

## Hero Slice Definition

**Screen**: Play Hub — everything the player sees on app open + the moment of completing an exercise.

### Components modified in P0:

| Component | File | Change |
|-----------|------|--------|
| Mission shell | `mission-panel.tsx` | New background, atmosphere recalibration |
| Piece rail | `mission-panel.tsx` (hero-rail) | Solid material slots, depth on active state |
| Board wrapper | `board.tsx` | `.panel-base` inherits new material |
| Gameplay panel | `gameplay-panel.tsx` | `.panel-elevated` with bevel + game font labels |
| CTA button | `contextual-action-slot.tsx` | 3D depth, press state, Fredoka One text |
| Dock | `persistent-dock.tsx` | Solid bar, thick top highlight, item depth |
| Result overlay | `result-overlay.tsx` | Reward ceremony v1 (staged reveal sequence) |
| Phase flash | `mission-panel.tsx` | Game font + dramatic entry animation |
| Victory text | `arena-end-state.tsx` | Fredoka One 3xl + multi-shadow + scale bounce |
| Design tokens | `globals.css` | Surface tokens, font, keyframes, panel classes |

### Components NOT modified in P0:

| Component | Reason |
|-----------|--------|
| `exercise-drawer.tsx` | Inherits surface changes passively via panel classes |
| `shop-sheet.tsx` | P1 — sheet interior redesign |
| `badge-sheet.tsx` | P1 — sheet interior redesign |
| `arena-board.tsx` | Inherits board wrapper changes |
| `arena-hud.tsx` | Minimal — only font if naturally applicable |
| `status-strip.tsx` | Dev-only, no visual investment |

## P0 Implementation Scope

Everything required for the perceptual leap. P0 can ship as a complete, coherent visual reset even if background asset is deferred.

### E3.1 — Surface Material Reset

Redefine the material language for all panel tiers, buttons, piece rail, and dock.

**Panel system redesign:**

| Token | Current | Target |
|-------|---------|--------|
| `.panel-base` | `rgba` gradient + blur + 1px border | Solid 2-3 stop gradient (dark→darker), 2px border with top highlight, multi-layer box-shadow |
| `.panel-elevated` | Slightly darker + carved inset | Richer gradient, pronounced bevel (inset white/0.08 top + inset black/0.3 bottom), outer drop shadow |
| `.panel-showcase` | Heaviest opacity + shadow | CSS-first decorative border (gradient border or multi-layer box-shadow for corner emphasis), deepest shadow stack. No 9-slice asset or border-image unless CSS proves insufficient. |

**CTA buttons:**
- Multi-layer box-shadow: outer shadow (depth) + inset highlight (top edge) + inset shadow (bottom edge)
- Active state: shadow collapses, `translateY(1px)`, scale 0.97 — "push into surface" feel
- Game font (Fredoka One), text-shadow for readability over any background

**Piece rail tabs:**
- Inactive: solid dark background, visible border, subtle carved inset
- Active: raised platform effect — brighter gradient, stronger outer shadow, scale 1.05 maintained
- Locked: current treatment stays (brightness 0.35, saturate 0, lock icon)

**Dock:**
- Background: solid (no transparency), rich gradient top→bottom
- Top border: 2px highlight (not 1px)
- Dock items: button depth (subtle shadow + inset), press feedback
- Center action: maintains teal identity, gains depth treatment

**Kill list:**
- `backdrop-blur` on `.panel-base`, `.panel-elevated`, `.panel-showcase`
- `rgba` backgrounds below 0.85 opacity on game panels (they become solid or near-solid)

### E3.2 — Display Typography

Import Fredoka One. Apply to display layer only. Add text-shadow system.

**Elements that get Fredoka One:**

| Element | Selector / location | Size | Shadow |
|---------|---------------------|------|--------|
| Screen titles | `.fantasy-title` | 2xl (24px) | 2-layer: glow + outline |
| "VICTORY!" / "CHECKMATE!" | Arena end state headings | 3xl+ (30px) | 3-layer: color glow + outline + depth |
| CTA button text | Contextual action buttons | base (16px) | 1-layer: subtle outline |
| Score / star numerics | Result overlay, star counts | xl (20px) | 2-layer: glow + outline |
| Key game labels | "Score", "Level", difficulty, mission type | sm (14px) | 1-layer: subtle outline |
| Piece names | Hero rail tab labels | xs (12px) | None or 1-layer minimal |

**Elements that stay SF Pro (system font):**

- Mission description body text
- Hint text, subtitles, secondary copy
- Sheet body copy (shop, badges, leaderboard)
- Exercise descriptions in drawer
- Status/debug text
- Editorial paragraphs

**Text-shadow intensity scale:**

```
--text-shadow-hero:   0 0 24px rgba(COLOR, 0.4), 0 2px 0 rgba(0,0,0,0.8);
--text-shadow-display: 0 0 12px rgba(COLOR, 0.25), 0 1px 0 rgba(0,0,0,0.6);
--text-shadow-label:  0 1px 2px rgba(0,0,0,0.5);
```

Where COLOR matches the element's semantic context (cyan for game, amber for reward, rose for defeat).

### E3.3 — Reward Ceremony v1

Staged reveal sequences for result overlay and victory text. Replace instant panel display with theatrical moments.

**Result Reveal (result-overlay.tsx) — ~2s total:**

```
Phase A — Panel entrance (0–400ms)
  Scrim: fade in 200ms
  Panel: translateY(40px)→0 + scale(0.95)→1, 300ms ease-out
  Reward icon: scale(0.8)→1 + opacity(0)→1, 200ms (starts at 200ms)

Phase B — Stars reveal (400–1200ms)
  Stars appear one by one, stagger 150ms per star
  Each star: scale(0)→1.2→1 with cubic-bezier bounce
  Star glow: brief pulse on landing (box-shadow expand→contract)
  Score total: counter ticks up from 0 (JS animation, 400ms)

Phase C — Celebration (1200–2000ms)
  Background burst: CSS radial animation (golden particles via animated box-shadows)
  OR Lottie confetti if free asset found (LottieFiles, <100KB)
  CTA buttons: fade in + translateY(8px)→0
```

**Victory Text (arena-end-state.tsx):**

- "VICTORY!": Fredoka One 3xl, scale(0.5)→1.05→1 with cubic-bezier bounce, 400ms
- Text-shadow: `--text-shadow-hero` with cyan glow
- Subtitle: fade in 200ms after title lands

**Phase Flash Enhancement (mission-panel.tsx):**

- "Well done!" / "Try again": Fredoka One bold
- Text-shadow: `--text-shadow-display`
- Entry: scale(0.85)→1.02→1, 250ms

**prefers-reduced-motion:**
All animations collapse to instant state. Elements appear at final position immediately. No stagger, no bounce, no scale, no Lottie playback. Sequence still works — just instant.

### E3.4 — Hero Background

Generate 1 Play Hub background. This step is **non-blocking** for P0 closure.

**Asset spec:**
- Format: WebP primary, PNG fallback
- Resolution: 1170×2532 (3x iPhone, covers 390×844 viewport)
- Target file size: <300KB WebP
- Direction: fantasy medieval atmosphere, nocturnal, warm light sources (candles/torches/magic), deep navy + amber + teal tones, painterly digital art, no characters, no text, slightly depth-of-field blurred for subordination to UI
- Must work as subordinate background — the board and panels are foreground, the background provides world context without competing

**Production pipeline:**
1. Generate 3-5 candidates via AI (Midjourney / DALL-E)
2. Select best composition
3. Post-process: color-grade to match existing palette, crop to mobile vertical, adjust brightness/contrast for UI readability
4. Optimize: WebP conversion, target <300KB
5. Replace `bg-chesscitov3` assets (png, webp, avif)
6. Recalibrate `.atmosphere::before`, `.atmosphere::after`, `.board-stage-focus::before` overlay values for new background

**Generation prompt:**
```
Fantasy medieval chess sanctuary at night, warm candlelight and
soft magical glow, stone architecture with arched elements,
deep navy blue and warm amber tones, painterly digital art style,
atmospheric depth with subtle fog, vertical mobile game background
9:19.5 aspect ratio, no characters, no text, no UI elements,
background should feel rich but not busy, slightly out of focus
for depth of field, dark mood with warm light pools
```

**Non-blocking rule:** If the generated asset doesn't meet quality bar after 2 iteration rounds, P0 ships with current `bg-chesscitov3` + recalibrated atmosphere overlays. The background becomes an immediate P1 follow-up, not a P0 blocker.

## P1 Follow-up Scope

After P0 ships and the new visual language is validated:

| Item | Description |
|------|-------------|
| Reward ceremony v2 | Badge claim reveal (dark→light sweep→materialize→glow), submit score celebration (elaborated counter), arena defeat treatment (board gray-out + somber fade) |
| Arena background | Derivation or variant of Play Hub hero bg. Color-shifted or new generation with arena/colosseum direction |
| Motion polish | Button press micro-feedback (transform + shadow shift), panel entrance transitions (slide-up + fade), dock item tap feedback, score counter tick-up refinements |
| Sheet inheritance | Shop, badges, leaderboard sheets absorb new surface system (panel classes, font for headers). No interior redesign — just token inheritance |
| Confetti Lottie | If P0 shipped with CSS fallback, source or produce proper Lottie confetti for result overlay |

## Typography Scope Rules

1. **Fredoka One** applies ONLY to display layer elements listed in E3.2
2. **SF Pro / system font** stays for all body text, descriptions, hints, sheet content
3. The contrast between display font and body font is intentional visual hierarchy
4. **`text-shadow`** is mandatory on all Fredoka One elements for readability over complex backgrounds
5. Shadow intensity scales with element importance (hero > display > label)
6. No font change to any element not listed in the E3.2 table
7. Font loaded via `next/font/google` — no external CDN, no FOUT

## Reward Ceremony v1 Scope

### P0 includes:

- **Result overlay staged reveal** (3-phase: entrance → stars → celebration)
- **Victory text slam** (Fredoka One + scale bounce + glow shadow)
- **Phase flash enhancement** (game font + dramatic entry)
- **CSS confetti burst fallback** (animated box-shadows, no external dependency)
- **Lottie confetti** only if free asset found on LottieFiles (<100KB, dark-bg compatible)

### P0 does NOT include:

- Badge claim ceremony (sweep reveal + materialize)
- Submit score elaborated celebration
- Arena defeat ceremony
- Custom Lottie production
- Sound effects

### Animation budget:

- Result reveal total: ~2000ms
- Victory text entry: ~400ms
- Phase flash: ~950ms (unchanged duration, enhanced treatment)
- All behind `prefers-reduced-motion` gate

## World Building Rules

1. **P0 produces at most 1 background asset** (Play Hub)
2. No arena-specific background in P0
3. No sheet-specific backgrounds in P0
4. If hero background generation fails quality bar after 2 rounds, P0 ships without it
5. Atmosphere CSS overlays are recalibrated for whichever background ships
6. Background must be subordinate to game UI — if it competes for attention, darken/blur it until it supports
7. Board surface/altar texture is P2 — not in scope

## Success Criteria

The hero slice passes when ALL of these are true:

### Perceptual shift
- [ ] Before/after screenshots read as a **change in visual language**, not a refinement of the same language
- [ ] A first-time viewer identifies the app as a **game**, not a web app with game theming
- [ ] The visual reset is unambiguous — no one asks "what changed?"

### Surface authority
- [ ] Panels feel like **physical objects** with weight and depth, not transparent cards
- [ ] CTA buttons communicate **pressability** — they look 3D, they respond to press with depth shift
- [ ] The dock reads as a **solid architectural element**, not a floating bar
- [ ] Piece rail tabs feel like **slots in a surface**, not pills on glass

### Typography presence
- [ ] Titles and key labels read as **game typography** — bold, visible, with depth
- [ ] Text is legible over any background without squinting
- [ ] The display/body font contrast feels intentional, not inconsistent

### Reward moment
- [ ] Exercise completion feels like an **event**, not a form submission
- [ ] The star reveal has **rhythm** — staggered, bounced, celebrated
- [ ] Victory text hits with **impact** — it enters the screen with energy
- [ ] The reward moment is **shareable** — a player would want to screenshot it

### World context
- [ ] The background provides **atmosphere and place**, not just color
- [ ] The background is **subordinate** to gameplay — it supports without competing
- [ ] The overall composition feels like a **scene**, not a screen

### Guardrail compliance
- [ ] Mobile-first: everything verified at 390px viewport
- [ ] `prefers-reduced-motion`: all animations collapse to instant
- [ ] No new accessibility regressions (touch targets remain 44px+)
- [ ] WebP assets under size budgets
- [ ] No backdrop-blur on game surfaces

## Implementation Order

```
E3.1 — Surface Material Reset                    [P0 core]
  Redefine .panel-base/.panel-elevated/.panel-showcase
  CTA buttons: 3D depth + press state
  Piece rail tabs: solid slots + raised active
  Dock: solid bar + thick highlight + item depth
  Kill backdrop-blur on game surfaces
  Verify at 390px

E3.2 — Display Typography                        [P0 core]
  Import Fredoka One via next/font
  .fantasy-title → Fredoka One + text-shadow
  CTA text → Fredoka One + shadow
  Score/star numerics → Fredoka One bold
  Key game labels → Fredoka One medium
  Victory/Checkmate → Fredoka One 3xl + multi-shadow
  Body text stays SF Pro (NO change)

E3.3 — Reward Ceremony v1                        [P0]
  Result overlay: staged 3-phase reveal
  Star stagger animation (150ms each, bounce)
  Score counter tick-up
  CSS confetti burst (or Lottie if free found)
  Victory text slam (scale bounce + glow)
  Phase flash enhancement
  prefers-reduced-motion: instant reveal

E3.4 — Hero Background                           [P0, non-blocking]
  Generate 1 Play Hub background (AI)
  Post-process: color-grade + crop + optimize
  Replace bg-chesscitov3
  Recalibrate atmosphere overlays
  Fallback: ship with current bg if quality insufficient

E3.5 — Motion Polish                             [P1 support]
  Button press micro-feedback
  Panel entrance transitions
  Dock item tap feedback
  All behind prefers-reduced-motion gate
```

E3.1 + E3.2 together deliver the core perceptual leap.
E3.3 delivers the emotional payoff.
E3.4 amplifies with environmental immersion (non-blocking).
E3.5 polishes with motion reinforcement (P1).

## Guardrails

1. **No micro-polish**. Every change must be visible in a before/after screenshot. If a change requires explanation to notice, it doesn't belong in E3.
2. **No scope creep into sheets**. Shop, badges, leaderboard inherit panel tokens passively. No interior redesign.
3. **No body font change**. SF Pro stays for all non-display text. Period.
4. **No color palette overhaul**. Navy + cyan + amber + teal stays. Surface treatment changes, not hue.
5. **No character/mascot art**. Wolf favicon stays as-is.
6. **No dock icon replacement**. Current icons stay. They get the new surface treatment, not new art.
7. **Background doesn't block P0**. If the asset isn't ready or isn't good enough, ship without it.
8. **Mobile-first always**. Test at 390px. Desktop inconsistencies are acceptable.
9. **prefers-reduced-motion compliance**. Every animation has an instant fallback.
10. **One background, not three**. No asset multiplication in P0.
