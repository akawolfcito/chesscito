# Spec patch — M2 v1.1 (post red-team v1)

**Date**: 2026-05-08
**Status**: PATCH applied; consolidate into v1.2 next
**Predecessor**: `2026-05-08-m2-candy-card-design.md` (v1.0 DRAFT)
**Triggering review**: `2026-05-08-m2-candy-card-redteam.md` (P0×3, P1×5, verdict NEEDS REVISION)

> This patch records ONLY the deltas from v1.0. Read v1.0 first, then this. A consolidated v1.2 will be authored next that supersedes both. /tdd should NOT read v1.0 in isolation.

## Summary of changes

| # | Layer | Change | Source |
|---|---|---|---|
| Δ1 | Architecture | Atmosphere becomes a v1 prop | P0-1 |
| Δ2 | Architecture | Drop `frame="rune"` from M2 v1 | P0-2 |
| Δ3 | Naming | Rename `<PlayerCard>` → `<PlayerAvatar>` as M2 precondition | P0-3 |
| Δ4 | Migration | Add deferred-DRY note for `<CandyGlassShell>` | P1-1 |
| Δ5 | CSS | Tokenize via `--candy-card-*` custom properties | P1-2 |
| Δ6 | Visual reference | Replace `(dev)` route with Vitest visual snapshot | P1-3 |
| Δ7 | Tests | Add `data-component="candy-card"` + `data-size` + `data-atmosphere` attrs | P1-4 |
| Δ8 | A11y | Add `titleAs?` prop + auto `aria-labelledby` when title present | P1-5 |

P2-1 (compact + media TS-disallow) and P2-2 (corner Fragment pointer-events) are deferred to DESIGN_SYSTEM.md docs as known limitations, not spec-blocking.

---

## Δ1 — Atmosphere becomes a v1 prop (P0-1 fix)

### What changes in the contract

```ts
// v1.1 SDD additions
export type CandyCardAtmosphere = "hub" | "amber" | "gold";

export type CandyCardProps = {
  // … existing props …
  /** Visual painting of the card chassis. Default "hub" (sheet-bg-hub).
   *  "amber" applies .candy-frame .candy-frame-amber (warm peek-card painting,
   *  matches welcome-overlay, daily-tactic-card, mini-arena-bridge-slot).
   *  "gold" applies .candy-frame .candy-frame-gold (claim-CTA painting,
   *  matches coach-paywall claim card + coach-welcome). */
  atmosphere?: CandyCardAtmosphere;
};
```

### Rendered structure delta

```
<section
  class="candy-card candy-card-{size} {atmosphereClasses}"
  data-component="candy-card"
  data-size={size}
  data-atmosphere={atmosphere}
  …
>
```

Where `atmosphereClasses` resolves:

| `atmosphere` | classes appended |
|---|---|
| `"hub"` (default) | `sheet-bg-hub` |
| `"amber"` | `candy-frame candy-frame-amber` |
| `"gold"` | `candy-frame candy-frame-gold` |

### Why this is correct

`globals.css:2134-2173` shows `.candy-frame` already provides chassis-level painting (border, shadow, radius). When `atmosphere = "amber" | "gold"` the proposed inline border / shadow CSS in v1.0 would conflict with `.candy-frame`'s rules.

**Resolution**: scope the v1.0-proposed `.candy-card` CSS rules (border, shadow) to ONLY apply when `[data-atmosphere="hub"]` to avoid overriding `.candy-frame` tokens.

```css
/* v1.1 CSS update */
.candy-card[data-atmosphere="hub"] {
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow:
    0 10px 28px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 245, 215, 0.55);
}
/* No border/shadow rule for [data-atmosphere="amber"] or [data-atmosphere="gold"]
   — .candy-frame owns the painting in those cases. */
```

### Test plan deltas

Add 3 tests:
- T17: `atmosphere="hub"` (or omitted) → outer has `sheet-bg-hub` class, NOT `candy-frame`
- T18: `atmosphere="amber"` → outer has `candy-frame candy-frame-amber`, NOT `sheet-bg-hub`
- T19: `atmosphere="gold"` → outer has `candy-frame candy-frame-gold`, NOT `sheet-bg-hub`

---

## Δ2 — Drop `frame="rune"` from M2 v1 (P0-2 fix)

### What changes in the contract

**Removed**: `CandyCardFrame` type, `frame?` prop, `.candy-card-frame` CSS block, AC4, tests #5–#7.

### Why

`globals.css:2134` `.candy-frame` is a yellow→gold gradient *background* — composing it onto an `inset:0 pointer-events:none` overlay div paints a giant yellow rectangle over the card body, the opposite of an "ornament rune overlay." The composition recommendation in v1.0 Q7 was structurally broken.

A real "rune ornament" requires a real rune asset (SVG/PNG) — not present in repo today. Defer until a rune asset exists; introduce in a future spec when ceremony surfaces (e.g., achievement claimed, victory recap) actually need it.

### What replaces it

Nothing in M2. Migration consumers that want a "framed" feel use `atmosphere="amber"` or `atmosphere="gold"` (Δ1). Those are the existing wooden-scroll paintings already shipping in the codebase.

### Test plan deltas

Drop tests T5, T6, T7 from the v1.0 plan. Net unit test count: 16 − 3 + 3 (atmosphere) = 16. Holds steady.

---

## Δ3 — Rename `<PlayerCard>` → `<PlayerAvatar>` as M2 precondition (P0-3 fix)

### What changes

Add a new commit at the **start** of M2 (before `<CandyCard>` itself ships):

> **Commit 0** — `refactor(redesign): rename <PlayerCard> to <PlayerAvatar>` — single-purpose name fix that resolves a M1-era misnaming. PlayerCard is a sprite-image renderer (returns `<picture>`); the correct name is PlayerAvatar.

### Files touched in commit 0

- `apps/web/src/components/redesign/player-card.tsx` → `player-avatar.tsx` (file rename)
- All importers: grep for `from "@/components/redesign/player-card"` and `import { PlayerCard }` → update.
- `apps/web/src/components/redesign/__tests__/player-card.test.tsx` (if exists) → rename + update describe blocks.
- Any CSS class `player-card` / `player-card-you` / `player-card-bot` stays — only the React export renames. (Class semantic = avatar styling on a `<picture>`; class name change is a separate concern.)

### §"Naming policy" — added to v1.2 consolidated spec

After commit 0 lands, the `redesign/` folder's residential primitives and their roles are:

| Primitive | Role |
|---|---|
| `<CandyBanner>` | Sprite asset renderer (decorative `<picture>`) |
| `<CandyButton>` | CSS-styled button atom |
| `<CandyCard>` | **NEW M2** — vertical content-block primitive (residential) |
| `<CandyChip>` | Inline status/tag pill |
| `<CandyGlassShell>` | Modal shell (transient, has close button + scrim) |
| `<CandyIcon>` | Icon atom |
| `<JourneyRail>` | Paper-tray list-row component (domain: progression) |
| `<PageSection>` | Vertical-block wrapper with optional `<h2>` heading |
| `<PlayerAvatar>` | **RENAMED** — sprite avatar `<picture>` (was `<PlayerCard>`) |
| `<WoodenBanner>` | Decorative wooden banner asset |

`<CandyCard>` does **NOT** overlap with `apps/web/src/components/ui/card.tsx` (shadcn primitives). Going forward:
- `@/components/redesign/candy-card` = canonical residential card for product surfaces
- `@/components/ui/card` = shadcn-only — kept for tooling-generated UI (auth scaffolding, CLI-bootstrapped templates), NOT for product card composition. Add a docstring at the top of `ui/card.tsx`: `// shadcn primitive — for tooling-bootstrapped surfaces only. For product cards use <CandyCard> from @/components/redesign/candy-card.`

### Migration impact

After commit 0 (rename), commit 1 (introduce CandyCard) lands cleanly. Test count for the rename commit: 0 new (rename does not change behavior); existing PlayerCard tests pass under new name.

### Test plan addition

Vitest baseline pre-rename: 1130 passing. Post-commit-0: 1130 passing (rename is non-functional). Post-commit-1 (CandyCard): 1130 + 16 = 1146.

---

## Δ4 — Deferred-DRY note for `<CandyGlassShell>` (P1-1 fix)

### What changes

§"Migration impact" gains a new bullet:

> `<CandyGlassShell>` should compose `<CandyCard>` as its content chassis once both are stable. v1.0 of `<CandyGlassShell>` predates `<CandyCard>` and inlines the same border/shadow/radius painting. Refactor is **deferred to M3** — adding a TODO comment in `candy-glass-shell.tsx:34` is sufficient for M2:
>
> ```tsx
> /* TODO(M3): refactor to compose <CandyCard atmosphere="hub">
>    once CandyCard is the canonical residential chassis. */
> ```

### Why deferred to M3, not done in M2

`<CandyGlassShell>` is consumed by 12 sheet/modal surfaces (per redteam IC6 evidence). Refactoring its composition is a 12-surface migration — explicitly out of M2 scope per the v1.0 non-goals. Adding a TODO comment is a 1-line change that preserves M2's "primitive-only" scope.

### Action

Add the TODO comment as part of commit 1 (when `<CandyCard>` is introduced). Single-line edit, no test impact.

---

## Δ5 — Tokenize via `--candy-card-*` CSS custom properties (P1-2 fix)

### What changes

Replace v1.0's hardcoded raw-value CSS block with token-driven rules:

```css
/* v1.1 — tokens added to :root in globals.css */
:root {
  --candy-card-radius: 1.5rem;
  --candy-card-pad-compact: 0.75rem 0.875rem;
  --candy-card-pad-regular: 1.25rem 1.25rem;
  --candy-card-pad-feature: 1.75rem 1.5rem;
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

/* v1.1 — base + size variants */
.candy-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: var(--candy-card-radius);
}
.candy-card-compact { padding: var(--candy-card-pad-compact); gap: var(--candy-card-gap-compact); }
.candy-card-regular { padding: var(--candy-card-pad-regular); gap: var(--candy-card-gap-regular); }
.candy-card-feature { padding: var(--candy-card-pad-feature); gap: var(--candy-card-gap-feature); }

/* Atmosphere-conditional border/shadow (Δ1 + Δ5 combined) */
.candy-card[data-atmosphere="hub"] {
  border: var(--candy-card-border-resting);
  box-shadow: var(--candy-card-shadow-resting);
}

/* Title size scales with size variant */
.candy-card-compact .candy-card-title { font-size: var(--candy-card-title-size-compact); }
.candy-card-regular .candy-card-title { font-size: var(--candy-card-title-size-regular); }
.candy-card-feature .candy-card-title { font-size: var(--candy-card-title-size-feature); }
```

### Why this matters

Existing token families (`--shell-radius`, `--cta-*`, `--duration-*`) signal a tokens-first design system. Adding 12 raw values would have been the worst-tokenized primitive in `redesign/`. Now `<CandyCard>` joins the token grammar.

### Test plan delta

No new tests. Existing layout tests still pass class-based assertions — token resolution is browser-side.

---

## Δ6 — Replace `(dev)` route with Vitest visual snapshot (P1-3 fix)

### What changes

§"Test plan" v1.0 AC10 → v1.1 AC10 (revised):

| AC | Updated text |
|----|------|
| **AC10 (was)** | dev-only route at `apps/web/src/app/(dev)/candy-card-gallery/page.tsx` rendering 6 cells |
| **AC10 (now)** | Vitest snapshot test at `__tests__/candy-card.snapshot.test.tsx` rendering all 6 representative cells (3 sizes × 2 atmospheres = 6 cells, since rune is dropped per Δ2). Snapshot is the visual contract. Manual review of the snapshot file during /tdd code review. |

### Why

- `(dev)` route group is not a precedent in this codebase (redteam P1-3 evidence).
- Next.js route groups do NOT exclude from production builds — would leak `/candy-card-gallery` to MiniPay.
- Vitest snapshot is industry-standard, framework-native, no production exposure.

### Implementation outline

```tsx
// apps/web/src/components/redesign/__tests__/candy-card.snapshot.test.tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CandyCard } from "../candy-card";

const SIZES = ["compact", "regular", "feature"] as const;
const ATMOSPHERES = ["hub", "amber", "gold"] as const;

describe("CandyCard visual snapshot — all variants", () => {
  for (const size of SIZES) {
    for (const atmosphere of ATMOSPHERES) {
      it(`size=${size} atmosphere=${atmosphere}`, () => {
        const { container } = render(
          <CandyCard
            size={size}
            atmosphere={atmosphere}
            title="Card title"
            footer={<button>Action</button>}
          >
            Body content here.
          </CandyCard>
        );
        expect(container.firstChild).toMatchSnapshot();
      });
    }
  }
});
```

This runs as part of the regular Vitest suite, captures all 9 (3×3) variants, and surfaces any structural drift in CI without exposing a route.

### Net test count after all deltas

| Source | Tests |
|---|---|
| v1.0 base | 16 |
| v1.0 frame tests dropped (Δ2) | −3 |
| Δ1 atmosphere tests (T17–T19) | +3 |
| Δ8 a11y tests (titleAs, aria-labelledby) | +2 |
| Δ6 snapshot suite (3×3 = 9 snapshots, 1 test file) | +9 |
| **Total** | **27** |

Vitest baseline target: 1130 → 1130 + 27 = **1157** passing post-M2.

---

## Δ7 — `data-component` + `data-*` attrs for test queries (P1-4 fix)

### What changes

The rendered `<section>` MUST emit:

```
<section
  class="candy-card candy-card-{size} {atmosphereClasses}"
  data-component="candy-card"
  data-size={size}
  data-atmosphere={atmosphere}
  aria-label={ariaLabel}    {/* optional, see Δ8 */}
  aria-labelledby={titleId}  {/* auto-set when title present, see Δ8 */}
>
```

Test query convention (matches `action-pin.tsx:182-185`):

```tsx
// Find the root
const card = container.querySelector('[data-component="candy-card"]');

// Variant assertions
expect(card).toHaveAttribute("data-size", "compact");
expect(card).toHaveAttribute("data-atmosphere", "hub");

// Atmosphere class assertions stay class-based (CSS contract is the class)
expect(card).toHaveClass("sheet-bg-hub");
```

### Why

- `<section>` without `aria-label` or `aria-labelledby` has no implicit ARIA role. RTL queries via `getByRole("region", …)` would fail silently for label-less cards.
- ActionPin already uses this exact pattern. Consistency.
- Decouples tests from class-naming churn — `data-size="compact"` is the source of truth for "this is a compact card."

### Test plan deltas

All v1.0 tests T1–T16 are rewritten to query via `[data-component="candy-card"]` and assert `data-size` / `data-atmosphere` instead of class strings. Class assertions are kept ONLY where the class is the actual CSS-binding source (e.g., `sheet-bg-hub` vs `candy-frame-amber`).

---

## Δ8 — `titleAs?` + auto `aria-labelledby` (P1-5 fix)

### What changes in the contract

```ts
// v1.1 SDD additions
export type CandyCardProps = {
  // … existing props …
  /** Heading level for the title. Default "h3". Composers in screens that
   *  already render an <h2> (e.g., page-section context) keep "h3".
   *  Composers rendering CandyCard at the root of a screen with no parent
   *  heading should pass "h2" to maintain heading hierarchy. */
  titleAs?: "h2" | "h3" | "h4";
};
```

### Rendered structure delta (header block)

```tsx
const titleId = title ? useId() : undefined;
const TitleTag = titleAs ?? "h3";

<section
  data-component="candy-card"
  // …
  aria-labelledby={title ? titleId : undefined}
  aria-label={!title ? ariaLabel : undefined}
>
  {(eyebrow || title) && (
    <header class="candy-card-header">
      {eyebrow && <div class="candy-card-eyebrow">{eyebrow}</div>}
      {title && (
        <TitleTag id={titleId} class="candy-card-title fantasy-title">
          {title}
        </TitleTag>
      )}
    </header>
  )}
  …
</section>
```

### Behavior

| Scenario | a11y resolution |
|---|---|
| `title="Hello"` no `aria-label` | `<section aria-labelledby="{useId}">` + `<h3 id="{useId}">Hello</h3>` |
| `title="Hello"` AND `aria-label="Override"` | `<section aria-labelledby="{useId}">` (title wins; aria-label dropped — TODO add console.warn in dev) |
| No `title`, `aria-label="Custom"` | `<section aria-label="Custom">` |
| No `title`, no `aria-label` | `<section>` (warning: no accessible name — document as known gap, but allowed for purely decorative composition) |

### Test plan deltas

Add 2 tests:
- T20: `titleAs="h2"` renders title as `<h2 class="candy-card-title fantasy-title">`
- T21: `title="Hello"` (no `aria-label`) → `<section aria-labelledby="x">` + `<h3 id="x">Hello</h3>`; verify ID is consistent between attrs

### Why

- `<h3>`-hardcoded broke heading hierarchy when CandyCard is screen-root.
- `<section>` without an accessible name fails axe-core baseline.
- Auto-`aria-labelledby` is the cleanest fix — tests document the resolution rules.

---

## Updated commit plan

| # | Commit | Source |
|---|--------|--------|
| **0** | `refactor(redesign): rename <PlayerCard> to <PlayerAvatar>` | Δ3 — precondition |
| **1** | `feat(redesign): introduce <CandyCard> primitive with atmosphere prop + a11y wiring` | Δ1, Δ2, Δ4, Δ7, Δ8 |
| **2** | `style(redesign): add --candy-card-* CSS tokens to globals.css` | Δ5 |
| **3** | `test(redesign): add CandyCard variant snapshot suite (3 sizes × 3 atmospheres)` | Δ6 |
| **4** | `docs(design): document <CandyCard> primitive in DESIGN_SYSTEM.md + Naming policy section` | Δ3 §"Naming policy" + base spec |
| **5** | `docs(spec): M2 v1.2 SHIPPED — full evolution chain (v1.0 + v1.1 patch)` | Final |

**Total**: 6 commits (was 5 in v1.0; +1 for the rename precondition).

## Open questions resolution status

| # | v1.0 Q | v1.1 status |
|---|---|---|
| Q1 | Hardcoded `sheet-bg-hub` or atmosphere prop? | **RESOLVED**: atmosphere prop, default `"hub"` (Δ1). |
| Q2 | `corner` fixed top-right or `cornerPosition`? | **RESOLVED**: fixed top-right. No change. |
| Q3 | Visual reference shipping? | **RESOLVED**: Vitest snapshot suite (Δ6). |
| Q4 | Frame + corner z-stacking? | **MOOT**: frame=rune dropped (Δ2). |
| Q5 | Compact + media broken? | **DEFERRED to docs**: documented as known limitation in DESIGN_SYSTEM.md. Not enforced at TS layer in v1; revisit if abuse appears. |
| Q6 | `as?: "section" \| "article" \| "div"` | **REPLACED**: instead of `as?`, added `titleAs?` (different concern — heading level, not container element). Container stays `<section>`. |
| Q7 | `.candy-card-frame` composes `.candy-frame`? | **MOOT**: frame=rune dropped. |
| Q8 | Lock name `<CandyCard>`? | **LOCKED with caveats** (Δ3): yes, but rename PlayerCard precondition + Naming policy added. |

All 8 open questions either resolved or moot.

## Definition of Done (v1.1 patch applied)

- [ ] All 27 unit + snapshot tests passing (was 16 in v1.0)
- [ ] AC1–AC10 verified (with v1.1 deltas)
- [ ] Vitest baseline: 1130 → ≥1157 passing
- [ ] DESIGN_SYSTEM.md updated with primitive entry + Naming policy section
- [ ] No existing surface visually regressed
- [ ] `<PlayerCard>` renamed to `<PlayerAvatar>` cleanly (commit 0 lands first)
- [ ] TODO comment added to `candy-glass-shell.tsx` referencing M3 DRY refactor
- [ ] M2 spec evolution chain locked (v1.0 + v1.1 patch + v1.2 consolidated) + handoff doc

---

## Next step

Author **v1.2 consolidated spec** (`2026-05-08-m2-candy-card-design-v1.2.md`) that mergea v1.0 + this v1.1 patch into a single readable doc. /tdd should consume v1.2 ONLY. v1.0 and this patch are kept as audit-trail.

Optional intermediate step: red-team v2 drift check on v1.2 to verify no contradictions or regression of v1.1 prescriptions. Same pattern as M1 redteam-v3.
