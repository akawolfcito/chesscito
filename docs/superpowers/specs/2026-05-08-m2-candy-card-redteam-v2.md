# Red-team v2 — M2 v1.1 patch drift check

**Reviewed**: v1.1 patch verified against v1.0 + redteam v1 + actual codebase
**Date**: 2026-05-08
**Verdict**: **NEEDS PATCH (P0×2, P1×2, P2×2)** — two real bugs would break /tdd as written
**Recommendation**: author v1.1.1 micro-patch (~15 lines), then consolidate v1.2 and proceed to /tdd. No further redteam round.

## Summary

The v1.1 patch successfully folds 6 of 8 redteam-v1 findings cleanly. Two introduced new bugs (Δ1 and Δ8); two have minor convention concerns (Δ5 and Δ6); the rest land clean. The structural choices in v1.1 are correct — the issues are surgical and resolvable in a 15-line micro-patch.

## Drift check matrix (Δ1–Δ8)

| Δ | Folds finding? | New bug introduced? | Notes |
|---|---|---|---|
| **Δ1** atmosphere prop | ✅ | **🔴 YES (P0-A)** | Forgets that `.candy-frame:active:not(:disabled){ transform:translateY(2px); ... }` (globals.css:2148) will fire on tap of a non-interactive `<section>` when `atmosphere="amber"\|"gold"`. `:active` matches any element. The card will visually press down on touch — wrong for a presentational card. |
| **Δ2** drop frame=rune | ✅ | ✅ none | Clean removal. AC4 dropped, T5–T7 dropped. Math holds. No orphan refs. |
| **Δ3** PlayerCard rename | ✅ partial | ⚠️ minor | "grep importers" produces exactly **1 importer**: `apps/web/src/components/arena/arena-hud.tsx:8`. Patch should have listed it. CSS classes `.player-card`, `.player-card-img`, `.player-card-you`, `.player-card-bot` (globals.css:2008-2034) survive — patch acknowledges as "separate concern." Defensible punt. |
| **Δ4** CandyGlassShell TODO | ✅ | ✅ none | Single-line comment, low risk. |
| **Δ5** tokens | ✅ | **🟡 YES (P1-A)** | Existing token grammar is **strictly single-value** (`--shell-radius: 16px`, `--cta-brand-from: #23C8F3`, `--duration-snap: 120ms`). Patch introduces shorthand-string tokens like `--candy-card-pad-compact: 0.75rem 0.875rem`. Works in CSS but breaks the grammar. |
| **Δ6** Vitest snapshot | ✅ | **🟡 YES (P1-B)** + internal contradiction | (1) **Zero precedent** for component `toMatchSnapshot` in `apps/web/**/__tests__/`. M1 used class/attribute assertions. New convention without justification. (2) **Internal contradiction**: line 251 says "3×2 = **6 cells**, since rune is dropped"; lines 268, 291, 301 all say **9 cells** (3×3). |
| **Δ7** data-component | ✅ | ✅ none | ActionPin emits `data-component="action-pin"` + `data-action` + `data-size` + `data-tone` (action-pin.tsx:182-185). New `data-atmosphere` consistent. No grep collision. |
| **Δ8** titleAs + aria-labelledby | ✅ | **🔴 YES (P0-B)** Rules of Hooks violation | Patch line 370: `const titleId = title ? useId() : undefined;` — **conditional Hook call**. React's Rules of Hooks require unconditional calls. With `title` toggling, hook order changes between renders → React strict-mode dev throws "Rendered more hooks than during the previous render." |

## P0 findings (must fix before /tdd)

### P0-A — `.candy-frame:active` press-down on non-interactive cards

**Where**: Δ1 + globals.css:2148-2155

**Symptom**: When a user taps anywhere inside a `<CandyCard atmosphere="amber">`, the entire card translates 2px down and shadows shift (per `.candy-frame:active:not(:disabled)` rule). For a *presentational* container this is wrong — `:active` semantics imply pressable.

**Why P0**: Visual regression on every touch interaction inside an amber/gold card. Will be visually obvious at /tdd visual review.

**Fix** (CSS one-block):

```css
/* Add to globals.css, after the existing .candy-frame:active rule */
.candy-card.candy-frame:active:not(:disabled) {
  transform: none;
  box-shadow:
    0 4px 0 var(--candy-frame-shadow, rgba(110, 65, 15, 0.45)),
    0 6px 14px rgba(0, 0, 0, 0.35),
    inset 0 2px 0 rgba(255, 255, 255, 0.30),
    inset 0 -2px 0 rgba(110, 65, 15, 0.20);
}
```

This keeps the resting `.candy-frame` painting but neutralizes the press animation specifically for `<CandyCard>` containers.

### P0-B — Conditional `useId()` violates Rules of Hooks

**Where**: Δ8, patch line 370

**Symptom**: `const titleId = title ? useId() : undefined;` — when `title` toggles between renders, hook count changes, React throws.

**Why P0**: Will crash any test that asserts `title` toggling. Triggers React strict-mode dev errors. Production behavior undefined.

**Fix** (one-line spec edit in Δ8 pseudocode):

```tsx
// WRONG (v1.1 patch):
const titleId = title ? useId() : undefined;

// CORRECT:
const generatedTitleId = useId();
const titleId = title ? generatedTitleId : undefined;
```

`useId()` always called; conditional gating happens on the assignment, not the hook.

## P1 findings (should fix in v1.1.1)

### P1-A — Token grammar inconsistency (shorthand vs single-value)

**Where**: Δ5

**Symptom**: `--candy-card-pad-{size}` stores `0.75rem 0.875rem` (two values). Existing `--shell-*`, `--cta-*`, `--duration-*` tokens are all single-value.

**Fix**: Split into `--candy-card-pad-{size}-y` / `--candy-card-pad-{size}-x`:

```css
:root {
  --candy-card-pad-compact-y: 0.75rem;
  --candy-card-pad-compact-x: 0.875rem;
  --candy-card-pad-regular-y: 1.25rem;
  --candy-card-pad-regular-x: 1.25rem;
  --candy-card-pad-feature-y: 1.75rem;
  --candy-card-pad-feature-x: 1.5rem;
  /* gap, title-size, shadow, border tokens stay single-value as in v1.1 */
}
.candy-card-compact { padding: var(--candy-card-pad-compact-y) var(--candy-card-pad-compact-x); }
.candy-card-regular { padding: var(--candy-card-pad-regular-y) var(--candy-card-pad-regular-x); }
.candy-card-feature { padding: var(--candy-card-pad-feature-y) var(--candy-card-pad-feature-x); }
```

### P1-B — Vitest snapshots are a new convention

**Where**: Δ6

**Symptom**: Zero component `toMatchSnapshot` calls in `apps/web/**/__tests__/`. M1 used class/attribute assertions. Patch introduces a new test convention without acknowledging the regression. (Note: one snapshot exists for `lib/coach/__tests__/prompt-template.test.ts` but it's logic, not a component.)

**Fix**: Replace snapshot suite with **9 RTL render-and-assert tests** matching M1 precedent. Each test renders one (size, atmosphere) variant and asserts:
- `data-size`, `data-atmosphere` attrs match
- correct atmosphere classes present (`sheet-bg-hub` OR `candy-frame candy-frame-amber/gold`)
- title `<h3>` rendered
- footer rendered

Net test count is the same (9 variants × 1 test each = 9 tests). No snapshot files to maintain.

```tsx
// Updated v1.1.1 — replaces snapshot pattern
describe.each([
  ["compact", "hub"],
  ["compact", "amber"],
  ["compact", "gold"],
  ["regular", "hub"],
  ["regular", "amber"],
  ["regular", "gold"],
  ["feature", "hub"],
  ["feature", "amber"],
  ["feature", "gold"],
])("CandyCard variants — size=%s atmosphere=%s", (size, atmosphere) => {
  it("renders the correct chassis", () => {
    const { container } = render(
      <CandyCard
        size={size as "compact" | "regular" | "feature"}
        atmosphere={atmosphere as "hub" | "amber" | "gold"}
        title="X"
      >
        body
      </CandyCard>
    );
    const root = container.querySelector('[data-component="candy-card"]')!;
    expect(root.getAttribute("data-size")).toBe(size);
    expect(root.getAttribute("data-atmosphere")).toBe(atmosphere);
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

## P2 findings (cosmetic)

### P2-A — Δ6 internal math/prose contradiction

Line 251 says "3×2 = 6 cells"; rest of doc says "3×3 = 9". Same Δ. Fix prose: "3 sizes × 3 atmospheres = 9 cells."

### P2-B — `<PlayerAvatar>` rendering CSS class `.player-card` is a documented smell

DC10. Patch acknowledges as "separate concern." Defensible punt; add a one-line note to DESIGN_SYSTEM.md: "`<PlayerAvatar>` renders historical class `.player-card`; CSS rename deferred to a follow-up ticket."

## Independent checks

| # | Check | Result |
|---|---|---|
| **IC1** | Does any existing primitive use `useId()`? | **None found** in `apps/web/src` — patch introduces first use. Reinforces P0-B importance: no prior pattern to copy. |
| **IC2** | Does Vitest config support `__snapshots__`? | Yes by default. Single existing snapshot is `lib/coach/__tests__/prompt-template.test.ts` (`.ts`, logic). No component snapshots. Δ6 would be the first. |
| **IC3** | Patch contains TODO/TBD/FIXME? | All 6 TODO mentions are intentional design notes (M3 deferral, console.warn aspiration). No accidental TBDs. |
| **IC4** | `data-atmosphere` attr collision? | Zero existing occurrences in `apps/web/src`. Clean. |
| **IC5** | Commit-plan disambiguation: where does atmosphere-conditional CSS land? | Commit 1 = primitive + a11y; commit 2 = CSS tokens. The `.candy-card[data-atmosphere="hub"] { border; box-shadow; }` block lands in commit 2. Patch should note this explicitly to avoid commit 1 shipping a primitive that looks unstyled until commit 2. |
| **IC6** | Does T13 (`.candy-card.candy-card-regular.sheet-bg-hub`) survive Δ1? | Partially. With `atmosphere="hub"` (default) the assertion holds; with amber/gold, `sheet-bg-hub` is absent. Δ7's "rewrite all v1.0 tests T1–T16 to query via data attrs" handles this implicitly, but v1.2 should EXPLICITLY say T13 = `data-atmosphere="hub"` + `sheet-bg-hub` class assertion; atmosphere=amber/gold variants are covered by T17–T19 (which become the 9-variant matrix per P1-B fix). |
| **IC7** | Does `<section>` semantic still get queried correctly when no `aria-label`/`aria-labelledby`? | Yes — Δ7's `data-component="candy-card"` query side-steps the role-less-section problem. |

## Recommendation

**NEEDS PATCH — author a quick v1.1.1 micro-patch** before consolidating v1.2.

Required v1.1.1 deltas (estimated 15-line spec edit):
1. **P0-A fix**: add `.candy-card.candy-frame:active` neutralizer CSS to Δ1 / globals.css commit 2.
2. **P0-B fix**: rewrite Δ8 pseudocode to call `useId()` unconditionally.
3. **P1-A fix**: split shorthand padding tokens into `-y`/`-x` pairs.
4. **P1-B fix**: replace snapshot suite with 9-variant `describe.each` RTL test.
5. **P2-A fix**: prose fix line 251 ("9 cells, not 6").
6. **P2-B fix**: one-line addendum in DESIGN_SYSTEM.md docs commit.
7. **IC5 fix**: explicit "atmosphere-conditional CSS lands in commit 2" note.
8. **IC6 fix**: explicit T13 rewrite mapping in test plan.

After v1.1.1, **proceed directly to v1.2 consolidation** — no further redteam needed. Fixes are surgical and well-bounded.

## Critical files for implementation reference

- `apps/web/src/app/globals.css` (lines 2008-2034 player-card CSS, 2134-2173 candy-frame + `:active` rule)
- `apps/web/src/components/redesign/action-pin.tsx` (data-attr precedent for Δ7, lines 182-185)
- `apps/web/src/components/redesign/player-card.tsx` (rename target, Δ3)
- `apps/web/src/components/arena/arena-hud.tsx` (only PlayerCard importer — Δ3 commit-0 scope, line 8)
- `docs/superpowers/specs/2026-05-08-m2-candy-card-design-v1.1-patch.md` (lines 251, 370 — the prose + hook-violation fixes)
