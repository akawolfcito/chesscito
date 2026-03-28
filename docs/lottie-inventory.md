# Chesscito — Lottie Animation Inventory

**Date**: 2026-03-27
**Status**: Planning — ready for sourcing

---

## Strategy

- **Generic animations** → source free from LottieFiles.com
- **Wolf mascot animations** → keep static PNG now, replace with custom Lottie later
- **Game-specific animations** → source free where possible, mark for custom if needed

---

## Already Using Lottie

| File | Where Used | Status |
|------|-----------|--------|
| `sparkles.json` | Victory screens (4 components) | Active |
| `trophy.json` | Victory screens + victory page | Active |
| `sparkles-loading.json` | **Unused** — dead weight | Delete or repurpose |

---

## Lottie Sourcing Plan

### Free from LottieFiles

| # | Element | Where | Current | Free Lottie Source | Search Keywords | Search Filters | Priority |
|---|---------|-------|---------|-------------------|-----------------|----------------|----------|
| 1 | **Star burst** (exercise completion) | Board — on target square hit | None — no celebration | LottieFiles.com | `star burst`, `star explosion`, `particle pop`, `success stars` | Free, Loop: No (one-shot), Small (<50KB), Background: transparent | **P0** |
| 2 | **Error/warning shake** | `result-overlay.tsx` error variant | `!` text in div | LottieFiles.com | `error alert`, `warning shake`, `error icon`, `alert animation` | Free, Loop: Yes, Small (<30KB), Colors: red/rose tones | **P0** |
| 3 | **Thinking dots** (wait states) | Coach loading, AI thinking | CSS `animate-pulse` | LottieFiles.com | `loading dots`, `thinking dots`, `typing indicator`, `bounce dots` | Free, Loop: Yes, Tiny (<20KB), Colors: customizable or neutral | **P1** |
| 4 | **Confetti / celebration** | Badge earned prompt | Static piece image | LottieFiles.com | `confetti`, `celebration`, `party popper`, `reward burst` | Free, Loop: No (one-shot), Small (<50KB), Background: transparent | **P1** |
| 5 | **Checkmark success** | Score submitted / badge claimed overlay | Static layout | LottieFiles.com | `success checkmark`, `check circle`, `done animation` | Free, Loop: No (one-shot), Small (<30KB), Colors: green/emerald | **P2** |
| 6 | **Empty state illustration** | Leaderboard empty, trophies empty | Plain text | LottieFiles.com | `empty state`, `no data`, `empty box`, `nothing here` | Free, Loop: Yes (subtle), Small (<40KB), Style: minimal/flat | **P2** |
| 7 | **Coin/token spin** | Shop purchase confirmation | Text state change | LottieFiles.com | `coin flip`, `token spin`, `payment success` | Free, Loop: No, Small (<30KB) | **P3** |

### Custom Required (use static PNG now, replace later)

| # | Element | Where | Current | Why Custom | Placeholder Now | Future Custom Lottie | Priority |
|---|---------|-------|---------|-----------|----------------|---------------------|----------|
| 8 | **Wolf celebrate** | Phase flash success, badge earned | `favicon-wolf.png` static | Mascot is brand identity — must match art style | Keep static PNG | Wolf jumping/cheering, ~1s loop, match existing wolf art style | **P0 future** |
| 9 | **Wolf sad/defeated** | Phase flash failure, arena lose, error pages | Same `favicon-wolf.png` | Emotional differentiation needs custom expression | Keep static PNG | Wolf ears down/head tilt, ~2s subtle loop | **P0 future** |
| 10 | **Wolf idle breathing** | Mission card, briefing modal, about page | `favicon-wolf.png` static | Subtle life in the always-visible mascot | Keep static PNG | Gentle breathing/blink, ~3-4s loop, very subtle | **P1 future** |
| 11 | **Wolf thinking** | Coach loading (up to 60s wait) | Lucide Brain icon + pulse | Long wait state needs engaging branded animation | Keep Lucide icon + pulse | Wolf scratching chin/looking at board, ~2s loop | **P1 future** |
| 12 | **Wolf waving/greeting** | Mission briefing first visit | `favicon-wolf.png` static | First impression moment for new players | Keep static PNG | Wolf waving hello, one-shot ~1.5s | **P2 future** |

---

## How to Source Free Lotties from LottieFiles.com

### Step-by-step

1. Go to [lottiefiles.com/free-animations](https://lottiefiles.com/free-animations)
2. Search using the keywords listed above
3. Apply filters:
   - **License**: Free (Lottie Simple License)
   - **File size**: prefer < 50KB for mobile performance
   - **Background**: Transparent
   - **Loop**: match the "Loop" column (one-shot vs looping)
4. Preview on dark background (Chesscito is dark theme)
5. Download as `.json` (not `.lottie` — we use `lottie-react` which expects JSON)
6. Place in `apps/web/public/animations/`
7. Import via `import data from "@/../public/animations/{name}.json"`

### Quality checklist before importing

- [ ] File size < 50KB (ideally < 30KB)
- [ ] Renders well at small sizes (48px or less for inline, 120px for overlays)
- [ ] Looks good on dark background (`#0a1424`)
- [ ] Colors can be tinted or are neutral enough to fit the cyan/gold/dark palette
- [ ] Animation duration feels right (one-shots < 1.5s, loops 2-4s)
- [ ] No text or language-specific content baked in
- [ ] No brand logos or watermarks

### Color compatibility

Chesscito palette:
- Primary: `cyan-400` (#22d3ee), `teal-400` (#2dd4bf)
- Accent: `amber-400` (#fbbf24), gold `rgb(217,180,74)`
- Success: `emerald-400` (#34d399)
- Error: `rose-400` (#fb7185)
- Surfaces: dark navy `#0a1424`

Prefer Lotties with white/neutral elements that work on dark backgrounds.
Avoid: bright white backgrounds, neon colors, overly colorful animations.

---

## Integration Pattern

```tsx
// Example: adding a star burst on exercise completion
import starBurstData from "@/../public/animations/star-burst.json";
import { LottieAnimation } from "@/components/ui/lottie-animation";

// One-shot usage
<LottieAnimation
  animationData={starBurstData}
  loop={false}
  className="h-16 w-16"
/>

// Looping usage
<LottieAnimation
  animationData={thinkingDotsData}
  loop={true}
  speed={1}
  className="h-4 w-12"
/>
```

The `LottieAnimation` component already exists at `apps/web/src/components/ui/lottie-animation.tsx`.

---

## Implementation Order

### Wave 1 — Free Lotties (implement now)
1. Star burst → exercise completion celebration
2. Error shake → result overlay error state
3. Thinking dots → coach loading + AI thinking

### Wave 2 — Free Lotties (implement soon)
4. Confetti → badge earned celebration
5. Success checkmark → score/badge success overlays
6. Empty state → leaderboard/trophies empty

### Wave 3 — Custom Wolf Pack (commission later)
7. Wolf celebrate → phase flash success
8. Wolf sad → phase flash failure + lose screen
9. Wolf idle → mission card + briefing
10. Wolf thinking → coach loading
11. Wolf greeting → first visit briefing

---

## Notes

- `sparkles-loading.json` is unused and should be deleted or repurposed
- The existing `LottieAnimation` component supports `loop`, `speed`, and `className` props
- All Lotties should be committed to `apps/web/public/animations/`
- File naming convention: `kebab-case.json` (e.g., `star-burst.json`, `error-shake.json`)
