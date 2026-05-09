# Spec — M2: `<CandyCard>` primitive (v1.2 consolidated)

**Date**: 2026-05-08
**Status**: SHIPPED 2026-05-08 (5 commits `316d371..3407d57` on main; spec-final commit pending)
**Predecessors**: v1.0 (`2026-05-08-m2-candy-card-design.md`) + v1.1 patch (`2026-05-08-m2-candy-card-design-v1.1-patch.md`) + v1.1.1 patch (`2026-05-08-m2-candy-card-design-v1.1.1-patch.md`)
**Red-team rounds**: v1 (`2026-05-08-m2-candy-card-redteam.md`), v2 drift check (`2026-05-08-m2-candy-card-redteam-v2.md`)
**Source of truth (audit)**: `_bmad-output/planning-artifacts/ux-design-application-audit-2026-05-08.md` §0
**UX validation**: Sally session 2026-05-08 — slot map + atmosphere + size variants + JourneyRail boundary all locked

> v1.2 supersedes v1.0, v1.1 patch, and v1.1.1 patch. /tdd should read THIS doc only. Prior versions kept for audit trail.

---

## Problem

After M1, the Phase 1+2 primitive set in `apps/web/src/components/redesign/` covers atoms, sprite assets, modal shell (`<CandyGlassShell>`), list-row tray (`<JourneyRail>`), and contextual action pins (`<ActionPin>`) — but has **no general-purpose content card** primitive.

This forces every feature surface that needs a "loseta de contenido residente" (mission tile, achievement panel, daily highlight, summary stat, briefing block, coach card) to either:
- (a) re-implement bespoke card markup with ad-hoc `rounded-* + bg-* + border-* + shadow` stacks, OR
- (b) abuse `<CandyGlassShell>` outside its modal-only contract, OR
- (c) use raw `.candy-frame` ornaments without a chassis to hang them on.

The current code shows all three paths in the wild: `welcome-overlay.tsx`, `daily-tactic-card.tsx`, `coach-paywall.tsx`, `coach-welcome.tsx`, `mini-arena-bridge-slot.tsx` each ship slightly different card-ish containers. After M1 closed the `/exercises` seam, this is the **second largest** source of visual seams identified in the parent audit.

## Goal

Ship `<CandyCard>` as the canonical **vertical content-block primitive** — the residential cousin of `<CandyGlassShell>`'s transient-modal role. After M2, future feature work composes inside `<CandyCard>` instead of re-rolling the card chassis. Existing surfaces that re-rolled their own become migration targets for **M3+**, not M2.

## Architecture decisions (locked)

1. **Atmosphere** — Configurable via prop: `atmosphere?: "hub" | "amber" | "gold"`, default `"hub"`.
   - `"hub"` → applies `sheet-bg-hub` class (forest bg + cream wash) — same painting as `<CandyGlassShell>`.
   - `"amber"` → applies `candy-frame candy-frame-amber` (warm peek-card painting; matches welcome-overlay, daily-tactic-card, mini-arena-bridge-slot).
   - `"gold"` → applies `candy-frame candy-frame-gold` (claim-CTA painting; matches coach-paywall claim card, coach-welcome).
2. **Slot map**: `corner` (absolute) → `media` (top, optional) → `header` (eyebrow + title, optional) → `body` (children) → `footer` (cta row, optional).
3. **Frame ornament**: NOT in v1. Deferred to a future spec when a real rune asset exists.
4. **Tap behavior**: pure container. No `onPress`.
5. **Size variants**: `compact | regular | feature`. Three breath levels, no more.
6. **JourneyRail**: NOT absorbed. CandyCard wraps it when composed (M3+).
7. **Heading semantics**: `titleAs?: "h2" | "h3" | "h4"` (default `"h3"`) + auto `aria-labelledby` to the title's id when title is present.
8. **Tokens**: All sizes/paddings/gaps/colors driven by `--candy-card-*` CSS custom properties (single-value grammar, `-y`/`-x` split for shorthand cases).
9. **Test queries**: via `data-component="candy-card"` + `data-size` + `data-atmosphere` attrs (matches ActionPin pattern).
10. **Naming**: `<CandyCard>` locked. `<PlayerCard>` renamed to `<PlayerAvatar>` as M2 precondition (M1-era misnaming fix).

## Non-goals (explicit)

- **No migration of existing cards in M2.** Welcome / daily-tactic / coach-paywall / coach-welcome / mini-arena-bridge continue to ship their bespoke containers until M3+ migrates them.
- **No `<JourneyRail>` absorption.** JourneyRail is a `.paper-tray` of horizontal `.paper-row` items — list-row pattern, NOT card pattern.
- **No interactive variant (`onPress`).** Pure presentational.
- **No close button, no scrim, no portal.** Those are `<CandyGlassShell>`'s contract.
- **No `frame="rune"` in v1.** Defer until rune asset exists.
- **No CSS class rename for `.player-card-*`.** Class names survive the React export rename (separate concern, follow-up ticket).

## SDD — TypeScript contract

```ts
// apps/web/src/components/redesign/candy-card.tsx

import type { ReactNode } from "react";

export type CandyCardSize = "compact" | "regular" | "feature";
export type CandyCardAtmosphere = "hub" | "amber" | "gold";

export type CandyCardProps = {
  /** Padding + header hierarchy + slot density. Default "regular". */
  size?: CandyCardSize;

  /** Visual painting of the card chassis. Default "hub" (sheet-bg-hub).
   *  "amber" → candy-frame-amber (warm peek-card).
   *  "gold" → candy-frame-gold (claim-CTA brighter painting). */
  atmosphere?: CandyCardAtmosphere;

  /** Heading element used for the title. Default "h3". Composers should pass
   *  "h2" when CandyCard is rendered at the root of a screen with no parent
   *  heading; pass "h4" when CandyCard is nested inside a section that already
   *  uses h3. */
  titleAs?: "h2" | "h3" | "h4";

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

  /** Aria label for the card region. Used ONLY when no title is provided.
   *  When title is present, aria-labelledby auto-points at the title's id. */
  "aria-label"?: string;
};

export function CandyCard(props: CandyCardProps): JSX.Element;
```

## Rendered structure (DOM)

```tsx
"use client";
import { useId, type ReactNode } from "react";

const ATMOSPHERE_CLASSES: Record<CandyCardAtmosphere, string> = {
  hub: "sheet-bg-hub",
  amber: "candy-frame candy-frame-amber",
  gold: "candy-frame candy-frame-gold",
};

export function CandyCard({
  size = "regular",
  atmosphere = "hub",
  titleAs,
  eyebrow,
  title,
  media,
  children,
  footer,
  corner,
  className = "",
  "aria-label": ariaLabel,
}: CandyCardProps) {
  const generatedTitleId = useId();           // unconditional — Rules of Hooks
  const titleId = title ? generatedTitleId : undefined;
  const TitleTag = titleAs ?? "h3";

  const chassisClasses = [
    "candy-card",
    `candy-card-${size}`,
    ATMOSPHERE_CLASSES[atmosphere],
    className,
  ].filter(Boolean).join(" ").trim();

  return (
    <section
      data-component="candy-card"
      data-size={size}
      data-atmosphere={atmosphere}
      className={chassisClasses}
      aria-labelledby={title ? titleId : undefined}
      aria-label={!title ? ariaLabel : undefined}
    >
      {corner ? <div className="candy-card-corner">{corner}</div> : null}
      {media ? <div className="candy-card-media">{media}</div> : null}
      {(eyebrow || title) ? (
        <header className="candy-card-header">
          {eyebrow ? <div className="candy-card-eyebrow">{eyebrow}</div> : null}
          {title ? (
            <TitleTag id={titleId} className="candy-card-title fantasy-title">
              {title}
            </TitleTag>
          ) : null}
        </header>
      ) : null}
      <div className="candy-card-body">{children}</div>
      {footer ? <div className="candy-card-footer">{footer}</div> : null}
    </section>
  );
}
```

## CSS contract (lands in commit 2)

```css
/* :root tokens — single-value grammar, -y/-x split for shorthand cases */
:root {
  --candy-card-radius: 1.5rem;

  --candy-card-pad-compact-y: 0.75rem;
  --candy-card-pad-compact-x: 0.875rem;
  --candy-card-pad-regular-y: 1.25rem;
  --candy-card-pad-regular-x: 1.25rem;
  --candy-card-pad-feature-y: 1.75rem;
  --candy-card-pad-feature-x: 1.5rem;

  --candy-card-gap-compact: 0.5rem;
  --candy-card-gap-regular: 0.75rem;
  --candy-card-gap-feature: 1rem;

  --candy-card-title-size-compact: 1rem;
  --candy-card-title-size-regular: 1.125rem;
  --candy-card-title-size-feature: 1.375rem;

  --candy-card-shadow-resting:
    0 10px 28px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 245, 215, 0.55);
  --candy-card-border-resting: 1px solid rgba(255, 255, 255, 0.45);
}

.candy-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: var(--candy-card-radius);
}

.candy-card-compact {
  padding: var(--candy-card-pad-compact-y) var(--candy-card-pad-compact-x);
  gap: var(--candy-card-gap-compact);
}
.candy-card-regular {
  padding: var(--candy-card-pad-regular-y) var(--candy-card-pad-regular-x);
  gap: var(--candy-card-gap-regular);
}
.candy-card-feature {
  padding: var(--candy-card-pad-feature-y) var(--candy-card-pad-feature-x);
  gap: var(--candy-card-gap-feature);
}

/* Atmosphere=hub: apply resting border + shadow.
   Atmosphere=amber/gold: .candy-frame already provides border + shadow. */
.candy-card[data-atmosphere="hub"] {
  border: var(--candy-card-border-resting);
  box-shadow: var(--candy-card-shadow-resting);
}

/* Neutralize .candy-frame:active press animation for non-interactive cards.
   .candy-card composes .candy-frame for amber/gold but is presentational. */
.candy-card.candy-frame:active:not(:disabled) {
  transform: none;
  box-shadow:
    0 4px 0 var(--candy-frame-shadow, rgba(110, 65, 15, 0.45)),
    0 6px 14px rgba(0, 0, 0, 0.35),
    inset 0 2px 0 rgba(255, 255, 255, 0.30),
    inset 0 -2px 0 rgba(110, 65, 15, 0.20);
}

/* Slot CSS */
.candy-card-corner {
  position: absolute;
  top: 0.625rem;
  right: 0.625rem;
  pointer-events: none;
}
.candy-card-corner > * { pointer-events: auto; }

.candy-card-media {
  display: flex;
  align-items: center;
  justify-content: center;
}

.candy-card-header {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}
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
.candy-card-compact .candy-card-title { font-size: var(--candy-card-title-size-compact); }
.candy-card-regular .candy-card-title { font-size: var(--candy-card-title-size-regular); }
.candy-card-feature .candy-card-title { font-size: var(--candy-card-title-size-feature); }

.candy-card-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.candy-card-footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
```

## Acceptance Criteria

| AC | What | Notes |
|----|------|-------|
| **AC1** | Primitive ships at `apps/web/src/components/redesign/candy-card.tsx`, exports `<CandyCard>`, `CandyCardProps`, `CandyCardSize`, `CandyCardAtmosphere` | greenfield create |
| **AC2** | Smoke render: `<CandyCard title="Hello">body</CandyCard>` produces `<section data-component="candy-card" data-size="regular" data-atmosphere="hub" class="candy-card candy-card-regular sheet-bg-hub">` containing `<h3 id="…" class="candy-card-title fantasy-title">Hello</h3>` and a body div | minimal contract |
| **AC3** | `size` prop maps `compact\|regular\|feature` → `data-size` attr + `.candy-card-{size}` class. Default = `regular` | size variant grammar |
| **AC4** | `atmosphere` prop maps `hub\|amber\|gold` → `data-atmosphere` attr + atmosphere-specific class set: `hub`→`sheet-bg-hub`; `amber`→`candy-frame candy-frame-amber`; `gold`→`candy-frame candy-frame-gold`. Default = `hub` | atmosphere grammar |
| **AC5** | `eyebrow`, `media`, `footer`, `corner` slots render when provided and are entirely omitted from the DOM when not. No empty wrappers | strict slot semantics |
| **AC6** | `corner` slot renders inside `.candy-card-corner` (absolute-positioned via CSS) | per CSS contract |
| **AC7** | `className` is appended to the outer wrapper without overwriting `candy-card`, size, or atmosphere classes | composition-safe |
| **AC8** | A11y: when `title` provided, `<section aria-labelledby="…">` points at `<TitleTag id="…">…</TitleTag>`. When NO title, `aria-label` (if provided) is forwarded to the section. `useId()` is called unconditionally | a11y baseline |
| **AC9** | `titleAs` prop renders the title with the chosen heading level (`h2\|h3\|h4`). Default `h3` | heading hierarchy |
| **AC10** | `<CandyCard atmosphere="amber">`, when tapped, does NOT visually press-down (verified by globals.css containing the `.candy-card.candy-frame:active` neutralizer rule) | press neutralizer |
| **AC11** | Component is `"use client"` (matches every other primitive in `redesign/`) | client-side render |
| **AC12** | Re-render with `title` toggling `undefined → "x" → undefined` produces no React Hooks errors | useId regression guard |

## Test plan

**Location**: `apps/web/src/components/redesign/__tests__/candy-card.test.tsx`

**Total**: 29 tests (1130 → 1159 vitest baseline target post-M2).

### Single-purpose tests (T1–T20)

| # | Test | AC |
|---|------|----|
| T1 | smoke — title + body only renders `<section data-component="candy-card">` + title + body | AC2 |
| T2 | default size attr is `data-size="regular"` when prop omitted | AC3 |
| T3 | size="compact" → `data-size="compact"` + `.candy-card-compact` class | AC3 |
| T4 | size="feature" → `data-size="feature"` + `.candy-card-feature` class | AC3 |
| T5 | default atmosphere attr is `data-atmosphere="hub"` when prop omitted | AC4 |
| T6 | eyebrow renders inside `.candy-card-eyebrow` | AC5 |
| T7 | media renders inside `.candy-card-media` | AC5 |
| T8 | footer renders inside `.candy-card-footer` | AC5 |
| T9 | corner renders inside `.candy-card-corner` | AC5/AC6 |
| T10 | omitted slots produce no empty wrappers (assert `.candy-card-media` etc. NOT in DOM when prop nullish) | AC5 |
| T11 | header omitted entirely when both eyebrow + title nullish | AC5 |
| T12 | `className` prop appends to outer without dropping canonical classes | AC7 |
| T13 | when `title` provided, section has `aria-labelledby={id}` and TitleTag has matching `id={id}` | AC8 |
| T14 | when no `title` and `aria-label="Custom"`, section has `aria-label="Custom"` and no `aria-labelledby` | AC8 |
| T15 | when `title` provided AND `aria-label="Override"`, `aria-labelledby` wins (aria-label not on section) | AC8 |
| T16 | `titleAs="h2"` renders title as `<h2>` | AC9 |
| T17 | `titleAs="h4"` renders title as `<h4>` | AC9 |
| T18 | `titleAs` omitted defaults to `<h3>` | AC9 |
| T19 | press neutralizer rule `.candy-card.candy-frame:active` exists in globals.css (specification test, grep-style) | AC10 |
| T20 | re-render with title toggling `undefined → "hello" → undefined` does not throw React error (regression for conditional useId pattern) | AC12 |

### Variant matrix (T21–T29 generated by `describe.each`)

```tsx
const SIZES = ["compact", "regular", "feature"] as const;
const ATMOSPHERES = ["hub", "amber", "gold"] as const;

describe.each(
  SIZES.flatMap((size) => ATMOSPHERES.map((atmosphere) => [size, atmosphere] as const))
)("CandyCard variant — size=%s atmosphere=%s", (size, atmosphere) => {
  it("renders the correct chassis", () => {
    const { container } = render(
      <CandyCard size={size} atmosphere={atmosphere} title="Title">
        Body
      </CandyCard>
    );
    const root = container.querySelector('[data-component="candy-card"]');
    expect(root).not.toBeNull();
    expect(root?.getAttribute("data-size")).toBe(size);
    expect(root?.getAttribute("data-atmosphere")).toBe(atmosphere);
    expect(root).toHaveClass(`candy-card-${size}`);
    if (atmosphere === "hub") {
      expect(root).toHaveClass("sheet-bg-hub");
      expect(root).not.toHaveClass("candy-frame");
    } else {
      expect(root).toHaveClass("candy-frame", `candy-frame-${atmosphere}`);
      expect(root).not.toHaveClass("sheet-bg-hub");
    }
  });
});
```

This generates **9 tests** (3 sizes × 3 atmospheres). Folds v1.0 T13's class-presence assertion into the matrix. No snapshot files.

## Affected files

| File | Change |
|------|--------|
| `apps/web/src/components/redesign/player-card.tsx` | **RENAME** to `player-avatar.tsx` (commit 0); rename React export `PlayerCard` → `PlayerAvatar` |
| `apps/web/src/components/arena/arena-hud.tsx` | **UPDATE** import (line 8) — sole consumer of PlayerCard |
| `apps/web/src/components/redesign/candy-card.tsx` | **NEW** (commit 1) |
| `apps/web/src/components/redesign/__tests__/candy-card.test.tsx` | **NEW** (commits 1 + 3) |
| `apps/web/src/app/globals.css` | **ADD** `--candy-card-*` tokens + `.candy-card*` rules + `:active` neutralizer (commit 2) |
| `apps/web/src/components/redesign/candy-glass-shell.tsx` | **UPDATE** — add 1-line TODO comment referencing M3 DRY refactor (commit 1, alongside primitive intro) |
| `DESIGN_SYSTEM.md` | **UPDATE** — `<CandyCard>` primitive entry + Naming policy section + `<PlayerAvatar>` historical-class note (commit 4) |

## Commit plan (6 commits)

| # | Commit | Scope |
|---|--------|-------|
| **0** | `refactor(redesign): rename <PlayerCard> to <PlayerAvatar>` | File rename + import update in `arena-hud.tsx:8`. Vitest 1130 → 1130 (no behavior change). |
| **1** | `feat(redesign): introduce <CandyCard> primitive with atmosphere prop + a11y wiring` | Primitive `.tsx` (markup, props, useId, slots). Tests T1–T20 (markup + a11y). **No CSS yet** — primitive references token vars added in commit 2. Tests use `data-*` attr + slot DOM assertions. Plus 1-line TODO comment in `candy-glass-shell.tsx:34`. Vitest 1130 → 1150. |
| **2** | `style(redesign): add --candy-card-* tokens + atmosphere CSS to globals.css` | All `--candy-card-*` tokens, `.candy-card*` base rules, `[data-atmosphere="hub"]` border/shadow, `.candy-card.candy-frame:active` neutralizer. Vitest 1150 (no test changes; visual-only commit). |
| **3** | `test(redesign): add CandyCard variant matrix (3 sizes × 3 atmospheres)` | The `describe.each` block (T21–T29 = 9 tests). Asserts atmosphere class composition now that CSS exists. Vitest 1150 → 1159. |
| **4** | `docs(design): document <CandyCard> primitive in DESIGN_SYSTEM.md + Naming policy` | DESIGN_SYSTEM.md addition: primitive entry with API + size matrix + atmosphere matrix; Naming policy section; `<PlayerAvatar>`-renders-`.player-card`-class historical note. |
| **5** | `docs(spec): M2 v1.2 SHIPPED — full evolution chain (v1.0 + v1.1 + v1.1.1 patches)` | Final consolidation commit. Marks v1.2 status SHIPPED. |

**Vitest baseline**: 1130 → 1159 (+29 tests).

**Commit-1 caveat**: ships primitive that **looks unstyled** until commit 2 brings CSS online. This is intentional — TDD red→green should split the markup contract from the visual contract. Tests in commit 1 verify markup; tests in commit 3 verify visual class composition.

## Definition of Done

- [ ] All 29 unit tests passing (29 / 29)
- [ ] AC1–AC12 verified
- [ ] Vitest baseline: 1130 → ≥1159 passing
- [ ] Typecheck passing (no new errors beyond the 2 pre-existing carryovers from M1)
- [ ] DESIGN_SYSTEM.md updated with primitive entry + Naming policy + `<PlayerAvatar>` note
- [ ] No existing surface visually regressed (no migrations performed in M2)
- [ ] `<PlayerCard>` → `<PlayerAvatar>` rename complete (commit 0); `arena-hud.tsx:8` import updated; CSS classes `.player-card-*` survive intact (deferred separate concern)
- [ ] TODO comment in `candy-glass-shell.tsx` referencing M3 DRY refactor
- [ ] `useId()` called unconditionally (verified by T20)
- [ ] `.candy-card.candy-frame:active` neutralizer present in globals.css (verified by T19)
- [ ] M2 spec evolution chain locked + handoff doc written

## Migration impact (downstream — out of scope for M2)

After M2 ships, the following surfaces become **eligible for migration** in M3+:

| Surface | Current paint | Future composition |
|---|---|---|
| `apps/web/src/components/welcome/welcome-overlay.tsx` | `candy-frame candy-frame-amber` | `<CandyCard atmosphere="amber">` |
| `apps/web/src/components/daily/daily-tactic-card.tsx` | `candy-frame candy-frame-amber` | `<CandyCard atmosphere="amber">` |
| `apps/web/src/components/coach/coach-paywall.tsx` | mixed amber/gold | composition decision per card |
| `apps/web/src/components/coach/coach-welcome.tsx` | `candy-frame candy-frame-gold` | `<CandyCard atmosphere="gold">` |
| `apps/web/src/components/mini-arena/mini-arena-bridge-slot.tsx` | `candy-frame candy-frame-amber` | `<CandyCard atmosphere="amber">` |
| `apps/web/src/components/redesign/candy-glass-shell.tsx` | `sheet-bg-hub` (modal) | compose `<CandyCard atmosphere="hub">` as content chassis |

Each is its own scoped patch in M3+ with its own red-team gate.

## Naming policy (added to DESIGN_SYSTEM.md by commit 4)

Post-M2, the `redesign/` folder's residential primitives are:

| Primitive | Role |
|---|---|
| `<CandyBanner>` | Sprite asset renderer (decorative `<picture>`) |
| `<CandyButton>` | CSS-styled button atom |
| **`<CandyCard>`** | **NEW M2** — vertical content-block primitive (residential) |
| `<CandyChip>` | Inline status/tag pill |
| `<CandyGlassShell>` | Modal shell (transient, has close button + scrim) |
| `<CandyIcon>` | Icon atom |
| `<JourneyRail>` | Paper-tray list-row component (domain: progression) |
| `<PageSection>` | Vertical-block wrapper with optional `<h2>` heading |
| **`<PlayerAvatar>`** | **RENAMED M2** — sprite avatar `<picture>` (was `<PlayerCard>`). Renders historical CSS classes `.player-card`, `.player-card-img`, `.player-card-you`, `.player-card-bot`; CSS rename deferred to follow-up ticket |
| `<WoodenBanner>` | Decorative wooden banner asset |

`<CandyCard>` does NOT overlap with `apps/web/src/components/ui/card.tsx` (shadcn primitives). Going forward:
- `@/components/redesign/candy-card` = canonical residential card for product surfaces.
- `@/components/ui/card` = shadcn-only — kept for tooling-bootstrapped surfaces, NOT for product card composition.

A docstring is added at the top of `ui/card.tsx`:
```
// shadcn primitive — for tooling-bootstrapped surfaces only.
// For product cards use <CandyCard> from @/components/redesign/candy-card.
```

## Open questions

All 8 v1.0 open questions resolved (in v1.1) or moot (frame removed in Δ2).
All v1.1.1 deltas surface no new open questions.

**Spec is locked. Ready for /tdd.**

---

## Spec evolution audit-trail

| Doc | Date | Status |
|-----|------|--------|
| v1.0 DRAFT | 2026-05-08 | Superseded |
| Red-team v1 | 2026-05-08 | NEEDS REVISION (P0×3, P1×5) |
| v1.1 patch | 2026-05-08 | Superseded |
| Red-team v2 drift check | 2026-05-08 | NEEDS PATCH (P0×2, P1×2) |
| v1.1.1 micro-patch | 2026-05-08 | Superseded |
| **v1.2 consolidated (this doc)** | **2026-05-08** | **SHIPPED — 5 commits `316d371..3407d57`** |

## TDD execution notes (post-ship)

- **Vitest**: 1130 → 1159 passing (+29 tests as planned).
- **Typecheck**: clean (no new errors beyond the 2 pre-existing M1 carryovers).
- **Visual baselines**: 3/3 unchanged (no surface consumes CandyCard yet — expected; M3+ migrations will trigger re-baseline).
- **Spec drift**: T19 (CSS press-neutralizer existence check) was relocated from commit 1 to commit 2 to avoid Red→Green straddling commits. Final test count unchanged; only ordering. Commit 1 landed 19 tests (1149); commit 2 landed +1 (T19 = 1150); commit 3 landed +9 variant matrix (1159).
- All 12 ACs verified.
