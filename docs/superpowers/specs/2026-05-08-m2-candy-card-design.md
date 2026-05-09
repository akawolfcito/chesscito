# Spec — M2: `<CandyCard>` primitive (v1.0 DRAFT)

**Date**: 2026-05-08
**Status**: DRAFT v1.0 — pending red-team v1
**Predecessors**: M1 SHIPPED (`2026-05-08-m1-exercises-migration-design-v1.3.md`)
**Source of truth (audit)**: `_bmad-output/planning-artifacts/ux-design-application-audit-2026-05-08.md` §0 Corrections + the M1 v1.1 red-team v1 discovery (`<CandyBanner>` is sprite-asset renderer, NOT a card primitive)
**UX validation (Sally session)**: 2026-05-08 — slot map + atmosphere + frame default + size variants + JourneyRail boundary all validated by user before SDD draft

> M2 is greenfield. There is no card primitive in `apps/web/src/components/redesign/` today. This spec designs and builds it.

## Problem

After M1, the Phase 1+2 primitive set (`<CandyBanner>`, `<CandyButton>`, `<CandyChip>`, `<CandyGlassShell>`, `<CandyIcon>`, `<JourneyRail>`, `<PageSection>`, `<PlayerCard>`, `<WoodenBanner>`, `<ActionPin>`) covers atoms, sprite assets, modal shell, list-row tray, and contextual action pins — but has **no general-purpose content card** primitive.

This forces every feature surface that needs a "loseta de contenido residente" (mission tile, achievement panel, daily highlight, summary stat, briefing block, coach card) to either:
- (a) re-implement bespoke card markup with ad-hoc `rounded-* + bg-* + border-* + shadow` stacks, OR
- (b) abuse `<CandyGlassShell>` outside its modal-only contract, OR
- (c) use raw `.candy-frame` ornaments without a chassis to hang them on.

The current code shows all three paths in the wild: `welcome-overlay.tsx`, `daily-tactic-card.tsx`, `coach-paywall.tsx`, `coach-welcome.tsx` each ship slightly different card-ish containers that share atmosphere but diverge on padding, header hierarchy, slot grammar, and frame application. This is the **second largest** source of visual seams identified in the parent audit (after the now-closed M1 `/exercises` seam).

## Goal

Ship `<CandyCard>` as the canonical **vertical content-block primitive** — the residential cousin of `<CandyGlassShell>`'s transient-modal role. After M2, future feature work composes inside `<CandyCard>` instead of re-rolling the card chassis. Existing surfaces that re-rolled their own (welcome, daily-tactic, coach-paywall, coach-welcome) become migration targets for **M3+**, not M2.

## Non-goals (explicit)

- **No migration of existing cards in M2.** Welcome / daily-tactic / coach-paywall / coach-welcome continue to ship their bespoke containers until M3+ migrates them. M2 ships the primitive only, plus a single representative consumer used as visual reference (see AC8).
- **No `<JourneyRail>` absorption.** JourneyRail is a `.paper-tray` of horizontal `.paper-row` items — a list-row pattern, NOT a card pattern. CandyCard may *contain* JourneyRail in future composition (e.g., `<CandyCard title="Your Journey"><JourneyRail … /></CandyCard>`), but the primitive itself is not absorbed.
- **No interactive variant (`onPress`).** CandyCard is presentational. Consumers that need tappable cards wrap children in their own `<button>` / `<Link>` / `<CandyButton>` inside the body or footer slot. This was explicitly validated by user during Sally session (#4) — keeps primitive single-purpose.
- **No close button, no scrim, no portal.** Those are `<CandyGlassShell>`'s contract.
- **No multi-atmosphere theming in v1.** Atmosphere is hardcoded to the same `sheet-bg-hub` painting that `<CandyGlassShell>` uses. Variants like `parchment` / `wooden` / `solid-cream` are deferred to a future spec if real consumers demand them.

## Architecture decisions (locked by Sally validation)

1. **Atmosphere** = `sheet-bg-hub` (forest bg-ch + cream wash). Same painting as `<CandyGlassShell>`. Distinguishes from shell only by *role* (residente vs visitante), not by paint. ✅
2. **Slot map**: `corner` (absolute) → `media` (top-block, optional) → `header` (eyebrow + title, optional) → `body` (children) → `footer` (cta row, optional). ✅
3. **Frame**: opt-in via `frame?: "none" | "rune"`, default `"none"`. Rationale: ornament is *ceremony*, not wallpaper. The hub must not look like a treasure-chest tile-grid. ✅
4. **Tap behavior**: pure container. No `onPress`. ✅
5. **Size variants**: `compact | regular | feature`. Three breath levels, no more. ✅
6. **JourneyRail**: NOT absorbed. CandyCard wraps it when composed (M3+). ✅

## SDD — TypeScript contract

```ts
// apps/web/src/components/redesign/candy-card.tsx

import type { ReactNode } from "react";

export type CandyCardSize = "compact" | "regular" | "feature";
export type CandyCardFrame = "none" | "rune";

export type CandyCardProps = {
  /** Padding + header hierarchy + slot density. Default "regular". */
  size?: CandyCardSize;

  /** Optional ornamental rune frame overlay. Default "none" — opt in for ceremony. */
  frame?: CandyCardFrame;

  /** Optional small eyebrow above the title (category, status). */
  eyebrow?: ReactNode;

  /** Optional title rendered with fantasy-title styling. */
  title?: ReactNode;

  /** Optional media slot rendered above the header (sprite, avatar, banner). */
  media?: ReactNode;

  /** Body content. Required. */
  children: ReactNode;

  /** Optional CTA row pinned below the body. */
  footer?: ReactNode;

  /** Optional absolute-positioned corner element (badge, timer, status pip). */
  corner?: ReactNode;

  /** Extra class on the outer wrapper (width overrides, margin nudges). */
  className?: string;

  /** Aria label for the card region (semantic surface). */
  "aria-label"?: string;
};

export function CandyCard(props: CandyCardProps): JSX.Element;
```

## Rendered structure (DOM)

```
<section
  class="candy-card candy-card-{size} sheet-bg-hub {className}"
  aria-label={ariaLabel}
>
  {corner && <div class="candy-card-corner">{corner}</div>}
  {frame === "rune" && <div class="candy-card-frame" aria-hidden="true" />}
  {media && <div class="candy-card-media">{media}</div>}
  {(eyebrow || title) && (
    <header class="candy-card-header">
      {eyebrow && <div class="candy-card-eyebrow">{eyebrow}</div>}
      {title && <h3 class="candy-card-title fantasy-title">{title}</h3>}
    </header>
  )}
  <div class="candy-card-body">{children}</div>
  {footer && <div class="candy-card-footer">{footer}</div>}
</section>
```

## CSS tokens (planned — added to `globals.css`)

```css
.candy-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border-radius: 1.5rem; /* rounded-3xl */
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow:
    0 10px 28px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 245, 215, 0.55);
}
.candy-card-compact { padding: 0.75rem 0.875rem; gap: 0.5rem; }
.candy-card-regular { padding: 1.25rem 1.25rem; gap: 0.75rem; }
.candy-card-feature { padding: 1.75rem 1.5rem; gap: 1rem; }

.candy-card-corner {
  position: absolute;
  top: 0.625rem; right: 0.625rem;
  pointer-events: none;
}
.candy-card-corner > * { pointer-events: auto; }

.candy-card-frame {
  position: absolute; inset: 0;
  border-radius: inherit;
  pointer-events: none;
  /* leverages existing .candy-frame ornament — see globals.css */
}

.candy-card-media {
  display: flex; align-items: center; justify-content: center;
}
.candy-card-header { display: flex; flex-direction: column; gap: 0.125rem; }
.candy-card-eyebrow {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(110, 65, 15, 0.70);
}
.candy-card-title {
  color: rgba(110, 65, 15, 0.95);
  text-shadow: 0 1px 0 rgba(255, 245, 215, 0.80);
  font-weight: 800;
}
.candy-card-compact .candy-card-title { font-size: 1rem; }
.candy-card-regular .candy-card-title { font-size: 1.125rem; }
.candy-card-feature .candy-card-title { font-size: 1.375rem; }

.candy-card-body { display: flex; flex-direction: column; gap: 0.5rem; }
.candy-card-footer { display: flex; align-items: center; gap: 0.5rem; }
```

## Acceptance Criteria

| AC | What | Notes |
|----|------|-------|
| **AC1** | Primitive ships at `apps/web/src/components/redesign/candy-card.tsx`, exports `<CandyCard>`, `CandyCardProps`, `CandyCardSize`, `CandyCardFrame` | greenfield create |
| **AC2** | Smoke render: `<CandyCard title="Hello">body</CandyCard>` produces a `<section class="candy-card candy-card-regular sheet-bg-hub">` containing an `<h3 class="candy-card-title fantasy-title">Hello</h3>` and a body div with the children | minimal contract |
| **AC3** | `size` prop maps `compact|regular|feature` → `.candy-card-compact|regular|feature` class. Default = `regular` when omitted | variant grammar |
| **AC4** | `frame="rune"` renders an extra `<div class="candy-card-frame" aria-hidden="true">` inside the card. `frame="none"` (or omitted) renders nothing | opt-in ornament |
| **AC5** | `eyebrow`, `media`, `footer`, `corner` slots render when provided and are entirely omitted from the DOM when not. No empty wrappers | strict slot semantics |
| **AC6** | `corner` slot renders inside `.candy-card-corner` (absolute-positioned) | per CSS contract |
| **AC7** | `className` is appended to the outer wrapper without overwriting `candy-card`, size, or `sheet-bg-hub` classes | composition-safe |
| **AC8** | `aria-label` prop is forwarded to the outer `<section>`. Default semantic is `<section>` with no implicit aria role | a11y baseline |
| **AC9** | Component is `"use client"` (matches every other primitive in `redesign/`) | client-side render |
| **AC10** | Reference visual story: 1 representative consumer (NEW dev-only route or scratch test snapshot) shows `regular` + `compact` + `feature` × `frame: none|rune` = 6 visual cells. NOT a production migration | verifies CSS without coupling to existing surfaces |

## Test plan

**Location**: `apps/web/src/components/redesign/__tests__/candy-card.test.tsx`

**Target**: ~14–16 unit tests, mirroring `<ActionPin>`'s test density (24 tests for a richer primitive).

| # | Test | AC |
|---|------|----|
| 1 | smoke — title + body only renders section + title h3 + body div | AC2 |
| 2 | default size class is `candy-card-regular` when prop omitted | AC3 |
| 3 | size="compact" applies `.candy-card-compact` | AC3 |
| 4 | size="feature" applies `.candy-card-feature` | AC3 |
| 5 | frame="rune" renders `.candy-card-frame` aria-hidden div | AC4 |
| 6 | frame="none" renders no frame div | AC4 |
| 7 | frame omitted = none (no frame div) | AC4 |
| 8 | eyebrow renders inside `.candy-card-eyebrow` | AC5 |
| 9 | media renders inside `.candy-card-media` | AC5 |
| 10 | footer renders inside `.candy-card-footer` | AC5 |
| 11 | corner renders inside `.candy-card-corner` | AC5/AC6 |
| 12 | omitted slots produce no empty wrappers (assert `.candy-card-media` etc. NOT in DOM when prop nullish) | AC5 |
| 13 | `.candy-card.candy-card-regular.sheet-bg-hub` all present on outer | AC2 |
| 14 | `className` prop appends to outer without dropping canonical classes | AC7 |
| 15 | `aria-label` forwards to `<section aria-label=…>` | AC8 |
| 16 | header omitted entirely when both eyebrow + title nullish | AC5 |

**Visual reference (AC10)**: rather than a Playwright baseline (premature for a brand-new primitive without a real consumer), ship a single dev-only scratch route at `apps/web/src/app/(dev)/candy-card-gallery/page.tsx` that renders all 6 cells for design review during /tdd. **Mark this route gitignored from production builds** if the codebase has a convention; otherwise, document it as `(dev)` route group not exposed in nav. *(Open question Q3 — see below.)*

## Affected files

| File | Change |
|------|--------|
| `apps/web/src/components/redesign/candy-card.tsx` | NEW |
| `apps/web/src/components/redesign/__tests__/candy-card.test.tsx` | NEW |
| `apps/web/src/app/globals.css` | ADD `.candy-card*` token block (see CSS section) |
| `DESIGN_SYSTEM.md` | ADD primitive entry under "Redesign primitives" with API + size matrix |
| `apps/web/src/app/(dev)/candy-card-gallery/page.tsx` (or alternate dev surface) | NEW — visual reference (see Q3) |

## Estimated commit plan

Mirroring M1's atomic-commit pattern:

1. `feat(redesign): introduce <CandyCard> primitive with full test matrix` — primitive + tests (AC1–AC9, ~14 tests)
2. `style(redesign): add .candy-card* CSS tokens to globals.css` — CSS only
3. `docs(design): document <CandyCard> primitive in DESIGN_SYSTEM.md` — doc only
4. `chore(dev): add /candy-card-gallery scratch route for visual reference` — AC10
5. `docs(spec): M2 v1.0 SHIPPED — append handoff + close spec evolution` — final

5 commits target. Lower than M1 because no orchestrator changes — pure greenfield primitive.

## Open questions (for red-team v1 to resolve)

| # | Question | v1.0 default |
|---|----------|--------------|
| **Q1** | Is hardcoded `sheet-bg-hub` atmosphere acceptable, or should `<CandyCard>` accept `atmosphere?: "hub" \| "parchment" \| "wooden"` from day-1 to avoid having to refactor consumers later? | Hardcoded. Defer until real demand surfaces. Strong recommendation: yes-defer (YAGNI). |
| **Q2** | Should `corner` placement be fixed to `top-right`, or accept a `cornerPosition?: "top-right" \| "top-left" \| "bottom-right" \| "bottom-left"` prop? | Fixed top-right. Most consumer use cases are status pips / counters that conventionally live top-right. |
| **Q3** | How is AC10 (visual reference) shipped? Options: (a) `(dev)` route group with note "not in nav"; (b) Playwright snapshot test only (no human review); (c) Storybook (does not exist in repo). | (a) `(dev)` route. Aligns with mobile-first policy of not surfacing dev tools in prod nav. |
| **Q4** | Does `frame="rune"` interfere with `corner` slot z-stacking when both are present? `.candy-card-frame` is `absolute inset:0 pointer-events:none`; `.candy-card-corner` is `absolute top:.. right:..`. CSS source-order means corner wins (later child) — but verify visually during /tdd. | No conflict expected — corner has `pointer-events: auto` only on its child, frame has `pointer-events: none`. |
| **Q5** | When `compact` size is used WITH `media` slot, does it look broken? (Compact has tight padding; media expects breathing room.) | Allowed, but add a visual cell to AC10 gallery to verify. If broken, document as "compact + media not recommended" in DESIGN_SYSTEM.md. Open to red-team challenge. |
| **Q6** | Should `<CandyCard>` accept `as?: "section" \| "article" \| "div"` for semantic flexibility, or hardcode `<section>`? | Hardcode `<section>` in v1.0. Add `as` prop only if a real consumer needs it. |
| **Q7** | Existing `.candy-frame` CSS rule lives in `globals.css` and is used by `welcome-overlay`, `daily-tactic-card`, `coach-paywall`, `coach-welcome`, `action-pin`, `mini-arena-bridge-slot`. Does the new `.candy-card-frame` selector overlap or conflict with `.candy-frame`? | Need to inspect `globals.css` `.candy-frame` rule during red-team. Recommendation: `.candy-card-frame` should *include* `.candy-frame` ornamentation by composition (apply both classes), not duplicate it. |
| **Q8** | Naming: `<CandyCard>` vs `<CandyTile>` vs `<CandyPanel>`. The audit explicitly named "card"; M1 v1.4 lesson was to honor canonical naming. Lock as `<CandyCard>`? | Lock as `<CandyCard>`. Matches audit, matches Sally validation. |

## Behavior beyond unit tests

- **No e2e baseline** in M2. The primitive is not yet wired into a production surface. Re-baseline of existing Playwright suites is unnecessary because no real route changes.
- **Visual review** happens via the AC10 dev-route gallery + manual screenshot during /tdd. The handoff at end of M2 will include the gallery URL for designer review.

## Migration impact (downstream)

After M2 ships, the following surfaces become **eligible for migration** in M3+ (NOT in M2 scope):

- `apps/web/src/components/welcome/welcome-overlay.tsx` (currently rolls its own card)
- `apps/web/src/components/daily/daily-tactic-card.tsx`
- `apps/web/src/components/coach/coach-paywall.tsx`
- `apps/web/src/components/coach/coach-welcome.tsx`
- `apps/web/src/components/mini-arena/mini-arena-bridge-slot.tsx`
- Any future achievement / mission-summary surface

Each of those becomes its own scoped patch in M3+ with its own red-team gate.

## Definition of Done

- [ ] All 16 unit tests passing
- [ ] AC1–AC10 verified
- [ ] DESIGN_SYSTEM.md updated
- [ ] Dev-route gallery screenshots reviewed and approved
- [ ] Vitest baseline: 1130 → ≥1144 passing (M1 final + M2 additions)
- [ ] Typecheck passing (no new errors beyond the 2 pre-existing carryovers)
- [ ] No existing surface visually regressed (no migrations performed in M2)
- [ ] M2 spec evolution chain locked + handoff doc written

---

## Next step

This is **v1.0 DRAFT**. Do not start /tdd. Submit to red-team v1 (Plan agent in hostile-QA mode) to:
- Hammer Q1–Q8 with adversarial alternatives
- Cross-check claims about existing primitives (especially Q7 `.candy-frame` inspection)
- Look for hidden contract gaps
- Verify no naming collision with existing `<*Card>` components elsewhere in the codebase
- Surface any P0/P1 the SDD missed

After red-team v1, write v1.1 patch (or v1.1 if structural rewrite) and optionally a red-team v2 drift check before /tdd, exactly as M1 did.
