# Type Scale Consistency — Design Spec

**Date:** 2026-04-12
**Issue:** #91
**Status:** Reviewed (red-team pass applied)

## Problem

The app uses 9+ arbitrary text sizes (`text-[7px]`, `text-[8px]`, `text-[10px]`, `text-[11px]`, `text-[15px]`, `text-[20px]`, `text-[0.6rem]`, `text-[0.65rem]`, `text-[0.7rem]`) alongside standard Tailwind classes. This creates an unpredictable type scale that's hard to maintain and produces visual inconsistency across screens.

## Approach: Hybrid (C)

Add one custom Tailwind token (`text-nano`) for genuinely tiny UI elements (dock labels, piece-rail), and map everything else to the closest standard Tailwind size.

## Type Scale

| Token | Size | Line-height | Semantic use |
|---|---|---|---|
| `text-nano` | `0.5rem` (8px) | `0.75rem` | Dock labels, piece-rail labels only |
| `text-xs` | `0.75rem` (12px) | `1rem` | Captions, badges, metadata, section headers, hints, micro-labels |
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
| `text-[10px]` | `text-xs` | mission-panel, shop-sheet, badge-sheet, exercise-drawer, trophy-card |
| `text-[11px]` | `text-xs` | mission-panel, mission-briefing, badge-sheet |
| `text-[15px]` | `text-sm` | mission-panel (target label) |
| `text-[20px]` | `text-lg` | mission-panel (image fallback) |
| `text-[0.6rem]` | `text-xs` | stat-card, badge-sheet, coach-history, coach-paywall, ask-coach-button, victory-claiming, exercise-drawer, invite-button |
| `text-[0.65rem]` | `text-xs` | coach-welcome, coach-paywall, badge-sheet, exercise-drawer, result-overlay, victory-claiming |
| `text-[0.7rem]` | `text-xs` | mission-panel (practice badge) |

**Note on text-[10px]**: Originally proposed as `text-nano` (8px), red-team flagged this as too aggressive (-20% reduction). Trophy-card NFT metadata and exercise-drawer button text need readability. Mapped to `text-xs` (12px) instead — a slight increase that improves readability without breaking layout.

## Additional Fixes

### Victory title unification
- `victory-claim-success.tsx`: `text-2xl` → `text-3xl` (match victory-celebration)
- `app/victory/[id]/page.tsx`: `text-2xl` → `text-3xl` (match victory-celebration)

### Tracking standardization
- `leaderboard-sheet.tsx`: column header row `tracking-wide` → `tracking-widest` (this is a section header)
- Leave `tracking-wide` untouched on: mission-briefing CTA button, arena-hud AI-thinking status, contextual-action-slot buttons — these are intentional non-header uses

### Inline style cleanup
- mission-panel piece-rail: replace inline `fontFamily: "var(--font-game-display)"` with `fantasy-title` class
- mission-panel piece-rail: inline `textShadow: "var(--text-shadow-label)"` can stay (no class equivalent, and it's already using a CSS token)

## Out of Scope

- Font weights (`font-semibold` vs `font-bold`) — intentional per hierarchy
- `leading-*` values — correct in context
- Display font (Fredoka) setup — working fine
- Text colors — separate concern
- Coach components behind feature flag — still fix for when flag is enabled
- `drop-shadow-[...]` utilities on victory titles — these are Tailwind utilities, not inline styles

## Design System Update

After implementation, update `DESIGN_SYSTEM.md` typography section to:

Replace current typography table with:

```markdown
| Role             | Classes                                          |
|------------------|--------------------------------------------------|
| Hero title       | `fantasy-title text-3xl font-bold`               |
| Page title       | `fantasy-title text-xl font-bold`                |
| Section header   | `text-xs font-semibold uppercase tracking-widest`|
| Body             | `text-sm`                                        |
| Caption / label  | `text-xs`                                        |
| Micro label      | `text-nano font-bold uppercase`                  |
```

Add rule: "No arbitrary `text-[Xpx]` values. Use the scale above. If a new size is genuinely needed, add it as a named token in `tailwind.config.js` first."

## Verification

- `tsc --noEmit` passes
- Visual check on mobile viewport (390px) for each affected screen
- No arbitrary `text-[` remaining in codebase (grep verification)
- Specific readability check on trophy-card metadata at `text-xs`
