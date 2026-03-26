# Asset Treatment System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a unified CSS treatment system for all visual assets — tokens, category classes, and hero selector migration from emoji to PNG images.

**Architecture:** Shared CSS custom property tokens (materiality + state) in `globals.css` `:root`, consumed by category-specific classes. Components apply classes instead of inline treatments. Hero selector migrates from emoji to `<Image>` with `/art/pieces/` assets.

**Tech Stack:** CSS custom properties, Tailwind utility classes, Next.js `<Image>`, existing PNG/WebP/AVIF assets.

**Spec:** `docs/superpowers/specs/2026-03-26-asset-treatment-system-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `apps/web/src/app/globals.css` | Add treatment tokens + all category classes |
| Modify | `apps/web/src/lib/content/editorial.ts` | Add `PIECE_IMAGES` map, keep `PIECE_ICONS` until migration done |
| Modify | `apps/web/src/components/play-hub/mission-panel.tsx` | Hero selector: emoji → `<Image>` + treatment classes |
| Modify | `apps/web/src/components/play-hub/badge-sheet.tsx` | Replace inline badge image treatments with classes |
| Modify | `apps/web/src/components/arena/arena-board.tsx` | Add depth treatment class to arena pieces |
| Modify | `apps/web/src/components/play-hub/persistent-dock.tsx` | N/A (dock icons live in trigger components) |
| Modify | `apps/web/src/components/play-hub/shop-sheet.tsx` | Add dock treatment class to trigger icon |
| Modify | `apps/web/src/components/play-hub/badge-sheet.tsx` | Add dock treatment class to trigger icon |
| Modify | `apps/web/src/components/play-hub/leaderboard-sheet.tsx` | Add dock treatment class to trigger icon |
| Modify | `apps/web/src/components/play-hub/invite-button.tsx` | Add dock treatment class to trigger icon |

---

### Task 1: Add Treatment Tokens to globals.css

**Files:**
- Modify: `apps/web/src/app/globals.css:6-77` (`:root` block)

- [ ] **Step 1: Add materiality + state tokens to `:root`**

In `apps/web/src/app/globals.css`, inside the `:root` block, after line 46 (`--header-zone-border: rgba(255, 255, 255, 0.08);`), add:

```css
    /* ── Asset Treatment System — materiality tokens ── */
    --treat-carved-hi: inset 0 1px 2px rgba(255, 255, 255, 0.05);
    --treat-carved-lo: inset 0 -1px 2px rgba(0, 0, 0, 0.25);
    --treat-depth-outer: 0 2px 4px rgba(0, 0, 0, 0.22);
    --treat-neutral-tint: brightness(0.75) saturate(0.7);
    --treat-neutral-tint-active: brightness(1.0) saturate(0.85);

    /* ── Asset Treatment System — state tokens (graduated warm) ── */
    --treat-warm-glow: 0 0 10px rgba(200, 170, 100, 0.15);
    --treat-warm-border: rgba(180, 160, 110, 0.30);
    --treat-warm-tint: sepia(0.25) saturate(1.3) brightness(1.1);
    --treat-semi-glow: 0 0 6px rgba(200, 170, 100, 0.08);
    --treat-semi-border: rgba(180, 160, 110, 0.15);
    --treat-semi-tint: sepia(0.15) saturate(1.1) brightness(1.0);
```

- [ ] **Step 2: Verify build passes**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && pnpm --filter web build`
Expected: Build succeeds (tokens are declared but not yet consumed).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "style: add asset treatment system tokens — materiality + graduated warm"
```

---

### Task 2: Add Category Classes to globals.css

**Files:**
- Modify: `apps/web/src/app/globals.css` (after line 734, after `.hero-rail-tab.is-inactive:active`)

- [ ] **Step 1: Add piece treatment classes**

After the `.hero-rail-tab.is-inactive:active` block (line 734), add:

```css

  /* ═══════════════════════════════════════════════════
     Asset Treatment System — Category Classes
     ═══════════════════════════════════════════════════ */

  /* ── 1. Piece Icons (hero selector) ── */
  .piece-hero {
    filter: var(--treat-warm-tint);
    box-shadow: var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-warm-glow);
    border: 1px solid var(--treat-warm-border);
    border-radius: 8px;
  }

  .piece-inactive {
    filter: var(--treat-neutral-tint);
    box-shadow: var(--treat-carved-hi), var(--treat-carved-lo);
    border-radius: 8px;
  }

  .piece-pressed {
    filter: brightness(0.90) saturate(0.85);
    box-shadow: var(--treat-carved-lo);
    border-radius: 8px;
  }
```

- [ ] **Step 2: Add dock treatment classes**

Immediately after the piece classes, add:

```css

  /* ── 2. Dock Icons (persistent navigation) ── */
  .dock-treat-base {
    filter: var(--treat-neutral-tint);
    box-shadow: var(--treat-carved-lo);
  }

  .dock-treat-active {
    filter: var(--treat-neutral-tint-active);
    box-shadow: var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-depth-outer);
  }

  .dock-treat-pressed {
    filter: brightness(0.65) saturate(0.6);
    box-shadow: var(--treat-carved-lo);
  }
```

- [ ] **Step 3: Add badge treatment classes**

```css

  /* ── 3. Badge Images ── */
  .badge-treat-owned {
    filter: var(--treat-warm-tint);
    box-shadow: var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-warm-glow);
    border: 1px solid var(--treat-warm-border);
    border-radius: 8px;
  }

  .badge-treat-claimable {
    filter: var(--treat-semi-tint);
    box-shadow: var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-semi-glow);
    border: 1px solid var(--treat-semi-border);
    border-radius: 8px;
  }

  .badge-treat-locked {
    filter: grayscale(0.85) brightness(0.55);
    box-shadow: var(--treat-carved-lo);
    border-radius: 8px;
  }
```

- [ ] **Step 4: Add arena piece treatment classes**

```css

  /* ── 4. Arena Pieces (outside carved/relic system) ──
     Applied as compound selectors on .arena-piece-img.
     See Task 6 — color filters + drop-shadow defined together. */
```

- [ ] **Step 5: Add frame treatment classes**

```css

  /* ── 5. Decorative Frames ── */
  .frame-structural {
    filter: var(--treat-neutral-tint);
    box-shadow: var(--treat-carved-hi), var(--treat-carved-lo);
  }

  .frame-showcase {
    box-shadow: var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-depth-outer);
    border: 1px solid var(--treat-semi-border);
  }
```

- [ ] **Step 6: Verify build passes**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && pnpm --filter web build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "style: add asset treatment category classes — piece, dock, badge, arena, frame"
```

---

### Task 3: Hero Selector Migration — Editorial + Component

**Files:**
- Modify: `apps/web/src/lib/content/editorial.ts:35-39`
- Modify: `apps/web/src/components/play-hub/mission-panel.tsx:6,126-144`

- [ ] **Step 1: Add PIECE_IMAGES to editorial.ts**

In `apps/web/src/lib/content/editorial.ts`, after line 39 (the `PIECE_ICONS` block), add:

```typescript

export const PIECE_IMAGES: Record<keyof typeof PIECE_LABELS, string> = {
  rook: "/art/pieces/w-rook",
  bishop: "/art/pieces/w-bishop",
  knight: "/art/pieces/w-knight",
} as const;
```

Note: paths without extension — the component will use `<picture>` with AVIF/WebP/PNG sources.

- [ ] **Step 2: Update mission-panel.tsx imports**

In `apps/web/src/components/play-hub/mission-panel.tsx`, change line 6 from:

```typescript
import { PHASE_FLASH_COPY, PIECE_ICONS, PRACTICE_COPY } from "@/lib/content/editorial";
```

to:

```typescript
import { PHASE_FLASH_COPY, PIECE_IMAGES, PRACTICE_COPY } from "@/lib/content/editorial";
```

- [ ] **Step 3: Replace emoji render with `<picture>` element**

In `apps/web/src/components/play-hub/mission-panel.tsx`, replace lines 124-157 (the `pieces.map` block inside the `.hero-rail` div) with:

```tsx
            {pieces.map((piece) => {
              const isActive = selectedPiece === piece.key;
              const src = PIECE_IMAGES[piece.key as keyof typeof PIECE_IMAGES];
              return (
                <button
                  key={piece.key}
                  type="button"
                  disabled={!piece.enabled}
                  onClick={() => onSelectPiece(piece.key)}
                  className={`hero-rail-tab ${isActive ? "is-active" : "is-inactive"}`}
                  aria-label={piece.label}
                >
                  <picture
                    className={[
                      "h-7 w-7 shrink-0",
                      isActive
                        ? `piece-hero ${plopping ? "animate-[hero-plop_300ms_cubic-bezier(0.34,1.56,0.64,1)]" : ""}`
                        : "piece-inactive",
                    ].join(" ")}
                  >
                    <source srcSet={`${src}.avif`} type="image/avif" />
                    <source srcSet={`${src}.webp`} type="image/webp" />
                    <img
                      src={`${src}.png`}
                      alt={piece.label}
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = "none";
                        const fallback = document.createElement("span");
                        fallback.textContent = piece.label[0];
                        fallback.className = "text-[20px] leading-none text-slate-400";
                        target.parentElement?.appendChild(fallback);
                      }}
                    />
                  </picture>
                  {isActive && (
                    <span className="text-[8px] font-extrabold uppercase tracking-[0.15em] text-[rgba(220,200,150,0.9)]">
                      {piece.label}
                    </span>
                  )}
                  {!piece.enabled && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white/10 bg-slate-600/80 text-[7px]">
                      &#128274;
                    </span>
                  )}
                </button>
              );
            })}
```

- [ ] **Step 4: Remove PIECE_ICONS if no longer imported anywhere**

Search for remaining `PIECE_ICONS` imports:

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && grep -r "PIECE_ICONS" apps/web/src --include="*.tsx" --include="*.ts" -l`

If no files import it, remove lines 35-39 from `editorial.ts`:

```typescript
export const PIECE_ICONS: Record<keyof typeof PIECE_LABELS, string> = {
  rook: "\u265C",
  bishop: "\u265D",
  knight: "\u265E",
} as const;
```

- [ ] **Step 5: Verify build passes**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && pnpm --filter web build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/content/editorial.ts apps/web/src/components/play-hub/mission-panel.tsx
git commit -m "feat: migrate hero selector from emoji to piece images with treatment classes"
```

---

### Task 4: Dock Icons — State-Aware Treatment

**Files:**
- Modify: `apps/web/src/components/play-hub/badge-sheet.tsx:196-199` (trigger icon)
- Modify: `apps/web/src/components/play-hub/shop-sheet.tsx:40-41` (trigger icon)
- Modify: `apps/web/src/components/play-hub/leaderboard-sheet.tsx:51-52` (trigger icon)
- Modify: `apps/web/src/components/play-hub/invite-button.tsx:35-36` (trigger icon)

The dock icons are rendered inside their respective sheet trigger buttons. Each renders a `<picture>` with a `<img>` inside. All dock icons get `.dock-treat-base` on the `<img>`. The `:active` pressed state is handled by the existing `.chesscito-dock-item > button:active` rule in globals.css (already reduces opacity to 0.65).

Note: `dock-treat-active` (current screen) is not applicable to these 4 icons because they are all sheet triggers, not route indicators. The center dock item (play-menu) already has its own `.chesscito-dock-center` treatment and doesn't need change.

- [ ] **Step 1: Add dock treatment to badge-sheet trigger icon**

In `apps/web/src/components/play-hub/badge-sheet.tsx`, change line 198:

From:
```tsx
            <img src="/art/badge-menu.png" alt="" aria-hidden="true" className="h-full w-full object-contain p-0.5" />
```

To:
```tsx
            <img src="/art/badge-menu.png" alt="" aria-hidden="true" className="h-full w-full object-contain p-0.5 dock-treat-base" />
```

- [ ] **Step 2: Add dock treatment to shop-sheet trigger icon**

In `apps/web/src/components/play-hub/shop-sheet.tsx`, change line 41:

From:
```tsx
            <img src="/art/shop-menu.png" alt="" aria-hidden="true" className="h-full w-full object-contain p-0.5" />
```

To:
```tsx
            <img src="/art/shop-menu.png" alt="" aria-hidden="true" className="h-full w-full object-contain p-0.5 dock-treat-base" />
```

- [ ] **Step 3: Add dock treatment to leaderboard-sheet trigger icon**

In `apps/web/src/components/play-hub/leaderboard-sheet.tsx`, change line 52:

From:
```tsx
            <img src="/art/leaderboard-menu.png" alt="" aria-hidden="true" className="h-full w-full object-contain p-0.5" />
```

To:
```tsx
            <img src="/art/leaderboard-menu.png" alt="" aria-hidden="true" className="h-full w-full object-contain p-0.5 dock-treat-base" />
```

- [ ] **Step 4: Add dock treatment to invite-button trigger icon**

In `apps/web/src/components/play-hub/invite-button.tsx`, change line 36:

From:
```tsx
        <img src="/art/invite-share-menu.png" alt="" aria-hidden="true" className="h-full w-full object-contain p-0.5" />
```

To:
```tsx
        <img src="/art/invite-share-menu.png" alt="" aria-hidden="true" className="h-full w-full object-contain p-0.5 dock-treat-base" />
```

- [ ] **Step 5: Verify build passes**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && pnpm --filter web build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/play-hub/badge-sheet.tsx apps/web/src/components/play-hub/shop-sheet.tsx apps/web/src/components/play-hub/leaderboard-sheet.tsx apps/web/src/components/play-hub/invite-button.tsx
git commit -m "style: apply dock-treat-base to all dock trigger icons"
```

---

### Task 5: Badge Images — Graduated Treatment

**Files:**
- Modify: `apps/web/src/components/play-hub/badge-sheet.tsx:86`

- [ ] **Step 1: Replace inline badge image treatments with classes**

In `apps/web/src/components/play-hub/badge-sheet.tsx`, replace line 86:

From:
```tsx
      <picture className={`h-12 w-12 shrink-0 ${isLocked ? "grayscale opacity-40" : isClaimed ? "drop-shadow-[0_0_8px_rgba(16,185,129,0.2)]" : ""}`}>
```

To:
```tsx
      <picture className={`h-12 w-12 shrink-0 ${isLocked ? "badge-treat-locked" : isClaimed ? "badge-treat-owned" : isClaimable ? "badge-treat-claimable" : ""}`}>
```

- [ ] **Step 2: Verify build passes**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && pnpm --filter web build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/play-hub/badge-sheet.tsx
git commit -m "style: apply graduated badge treatment classes — owned, claimable, locked"
```

---

### Task 6: Arena Pieces — Depth Unification

**Files:**
- Modify: `apps/web/src/app/globals.css:487-498` (replace `.arena-piece-img`, `.piece-white`, `.piece-black`)
- Modify: `apps/web/src/components/arena/arena-board.tsx:151-155`

- [ ] **Step 1: Update arena-piece-img to include depth drop-shadow**

In `apps/web/src/app/globals.css`, replace lines 487-498:

From:
```css
  .arena-piece-img {
    height: auto;
    object-fit: contain;
  }

  .piece-white {
    filter: sepia(0.3) saturate(1.5) brightness(1.1);
  }

  .piece-black {
    filter: hue-rotate(260deg) saturate(0.8) brightness(0.7);
  }
```

To:
```css
  .arena-piece-img {
    height: auto;
    object-fit: contain;
  }

  /* Arena piece color treatments — outside carved/relic system.
     Keep own filters for board legibility and gameplay clarity. */
  .arena-piece-img.arena-treat-white {
    filter: sepia(0.3) saturate(1.5) brightness(1.1) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
  }

  .arena-piece-img.arena-treat-black {
    filter: hue-rotate(260deg) saturate(0.8) brightness(0.7) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
  }
```

- [ ] **Step 2: Apply treatment classes in arena-board.tsx**

In `apps/web/src/components/arena/arena-board.tsx`, replace lines 151-155:

From:
```tsx
                    <img
                      src={src}
                      alt={`${p.color === "w" ? "White" : "Black"} ${p.type}`}
                      className="arena-piece-img"
                      style={{ width: "100%" }}
                    />
```

To:
```tsx
                    <img
                      src={src}
                      alt={`${p.color === "w" ? "White" : "Black"} ${p.type}`}
                      className={`arena-piece-img ${p.color === "w" ? "arena-treat-white" : "arena-treat-black"}`}
                      style={{ width: "100%" }}
                    />
```

- [ ] **Step 3: Remove old `.piece-white` / `.piece-black` if unused**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && grep -r "piece-white\|piece-black" apps/web/src --include="*.tsx" --include="*.ts" -l`

If only `globals.css` references them and no TSX file uses them, they are dead code (already replaced by the new `.arena-treat-*` classes). They were removed in Step 1.

- [ ] **Step 4: Verify build passes**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && pnpm --filter web build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/components/arena/arena-board.tsx
git commit -m "style: unify arena piece depth — color filters + drop-shadow per side"
```

---

### Task 7: Decorative Frames — Structural Treatment

**Files:**
- Modify: `apps/web/src/app/globals.css:156-168` (`.rune-frame` and `.shop-slot-frame`)

The `.rune-frame` class is used by `tx-feedback-card.tsx`, `purchase-confirm-sheet.tsx`, and `status-strip.tsx`. These are structural containers — they get `.frame-structural` treatment. The `.shop-slot-frame` is used for shop item slots.

- [ ] **Step 1: Enhance rune-frame with structural treatment**

In `apps/web/src/app/globals.css`, replace lines 156-168:

From:
```css
  .rune-frame {
    border: 1px solid rgba(125, 211, 252, 0.32);
    box-shadow:
      inset 0 0 0 1px rgba(103, 232, 249, 0.12),
      0 8px 24px rgba(2, 12, 22, 0.22);
    border-radius: 18px;
    background: rgba(2, 18, 32, 0.36);
    backdrop-filter: blur(3px);
  }

  .shop-slot-frame {
    background: rgba(2, 18, 32, 0.36);
  }
```

To:
```css
  .rune-frame {
    border: 1px solid rgba(125, 211, 252, 0.32);
    box-shadow:
      var(--treat-carved-hi),
      var(--treat-carved-lo),
      0 8px 24px rgba(2, 12, 22, 0.22);
    border-radius: 18px;
    background: rgba(2, 18, 32, 0.36);
    backdrop-filter: blur(3px);
  }

  .shop-slot-frame {
    background: rgba(2, 18, 32, 0.36);
    box-shadow: var(--treat-carved-hi), var(--treat-carved-lo);
  }
```

Note: `.rune-frame` keeps its cyan border (structural, not warm). We add carved depth via tokens but preserve the existing outer shadow. `.shop-slot-frame` gets carved depth only.

- [ ] **Step 2: Verify build passes**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && pnpm --filter web build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "style: add carved depth to decorative frames via treatment tokens"
```

---

### Task 8: Cleanup — Remove Dead CSS

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Verify .piece-white / .piece-black are unused**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && grep -rn "piece-white\|piece-black" apps/web/src --include="*.tsx" --include="*.ts"`

If no TSX/TS file references them, confirm they were already removed in Task 6 Step 1. If they still exist in globals.css but are unused, remove them.

- [ ] **Step 2: Verify PIECE_ICONS is unused**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && grep -rn "PIECE_ICONS" apps/web/src --include="*.tsx" --include="*.ts"`

If already removed in Task 3, confirm. If still exported but not imported anywhere, remove it from `editorial.ts`.

- [ ] **Step 3: Final full build**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && pnpm --filter web build`
Expected: Build succeeds with zero errors.

- [ ] **Step 4: Commit cleanup if any dead code was removed**

```bash
git add -A
git commit -m "chore: remove dead CSS and unused PIECE_ICONS after treatment migration"
```

---

## QA Guardrails (post-implementation, manual)

These are not automatable — validate visually on device:

1. **Hero selector silhouettes**: piece-inactive must show clear piece shape. If too dim, raise `--treat-neutral-tint` brightness to `0.80` max.
2. **Dock contrast delta**: `dock-treat-base` vs parent background must be perceptually distinct. If not, raise `--treat-neutral-tint` brightness to `0.78`.
3. **Progress chip vs hero tab**: confirm progress chip warm doesn't visually compete with hero selector active tab.
4. **Badge locked state**: confirm `grayscale(0.85) brightness(0.55)` reads as "locked but visible", not dead.
5. **Arena piece depth**: confirm `drop-shadow` is visible on both light and dark board squares.
6. **`--treat-depth-outer`**: validate `0.22` opacity is sufficient on textured backgrounds. Raise to `0.26` if not.
