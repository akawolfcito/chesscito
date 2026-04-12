# Type Scale Consistency — Design Spec

**Date:** 2026-04-12
**Issue:** #91
**Status:** Draft

## Problem

The app uses 9+ arbitrary text sizes (`text-[7px]`, `text-[8px]`, `text-[10px]`, `text-[11px]`, `text-[15px]`, `text-[20px]`, `text-[0.6rem]`, `text-[0.65rem]`, `text-[0.7rem]`) alongside standard Tailwind classes. This creates an unpredictable type scale that's hard to maintain and produces visual inconsistency across screens.

## Approach: Hybrid (C)

Add one custom Tailwind token (`text-nano`) for genuinely tiny UI elements (dock labels, piece-rail), and map everything else to the closest standard Tailwind size.

## Type Scale

| Token | Size | Line-height | Semantic use |
|---|---|---|---|
| `text-nano` | `0.5rem` (8px) | `0.75rem` | Dock labels, piece-rail labels, MISSION micro-label |
| `text-xs` | `0.75rem` (12px) | `1rem` | Captions, badges, metadata, section headers, hints |
| `text-sm` | `0.875rem` (14px) | `1.25rem` | Body text, descriptions, list items, target labels |
| `text-base` | `1rem` (16px) | `1.5rem` | Stat values, prominent content |
| `text-lg` | `1.125rem` (18px) | `1.75rem` | Sub-headers, image fallback text |
| `text-xl` | `1.25rem` (20px) | `1.75rem` | Page titles (legal, coach panel) |
| `text-3xl` | `1.875rem` (30px) | `2.25rem` | Hero titles (victory, arena, fantasy-title) |

`text-2xl` is reserved but not actively used after unification.

## Tailwind Config Change

```js
// tailwind.config.js → theme.extend.fontSize
fontSize: {
  nano: ['0.5rem', { lineHeight: '0.75rem' }],
}
```

## Mapping Table

| Current | New | Files |
|---|---|---|
| `text-[7px]` | `text-nano` | persistent-dock, mission-panel |
| `text-[8px]` | `text-nano` | mission-panel (piece rail label) |
| `text-[10px]` | `text-nano` | mission-panel (MISSION label) |
| `text-[11px]` | `text-xs` | mission-panel (hint text) |
| `text-[15px]` | `text-sm` | mission-panel (target label) |
| `text-[20px]` | `text-lg` | image fallback |
| `text-[0.6rem]` | `text-xs` | stat-card, badge-sheet, coach-history, trophies |
| `text-[0.65rem]` | `text-xs` | coach-welcome, coach-note |
| `text-[0.7rem]` | `text-xs` | mission-panel (practice badge) |

## Additional Fixes

### Victory title unification
- `victory-claim-success.tsx`: `text-2xl` → `text-3xl` (match celebration)
- `app/victory/[id]/page.tsx`: `text-2xl` → `text-3xl` (match celebration)

### Tracking standardization
- Section headers: standardize to `tracking-widest`
- Remove stray `tracking-wide` on elements that are semantically section headers

### Inline style cleanup
- mission-panel piece-rail: replace inline `fontFamily: "var(--font-game-display)"` with `fantasy-title` class
- victory-claim-success: replace inline `textShadow` with CSS token `--text-shadow-hero-amber` (add token if missing)

## Out of Scope

- Font weights (`font-semibold` vs `font-bold`) — intentional per hierarchy
- `leading-*` values — correct in context
- Display font (Fredoka) setup — working fine
- Text colors — separate concern
- Coach components behind feature flag — still fix for when flag is enabled

## Design System Update

After implementation, update `DESIGN_SYSTEM.md` typography section to document:
- The `text-nano` token and its permitted uses
- The full type scale table
- Rule: no arbitrary `text-[Xpx]` values without design system approval

## Verification

- `tsc --noEmit` passes
- Visual check on mobile viewport (390px) for each affected screen
- No arbitrary `text-[` remaining in codebase (grep verification)
