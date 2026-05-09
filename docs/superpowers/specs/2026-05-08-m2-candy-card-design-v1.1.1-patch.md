# Spec micro-patch — M2 v1.1.1 (post red-team v2 drift check)

**Date**: 2026-05-08
**Status**: PATCH applied; consolidate into v1.2 next
**Predecessors**: v1.0 + v1.1 patch
**Triggering review**: `2026-05-08-m2-candy-card-redteam-v2.md` (drift check verdict NEEDS PATCH — P0×2, P1×2, P2×2)

> Surgical 15-line patch. Records ONLY the deltas from v1.1. Read v1.0 + v1.1 patch first, then this. v1.2 consolidated will supersede all three.

## Summary of changes

| # | Layer | Change | Source |
|---|---|---|---|
| Δ1.1 | CSS | Add `.candy-card.candy-frame:active` neutralizer to prevent press animation on non-interactive cards | redteam-v2 P0-A |
| Δ1.2 | TSX | Rewrite `useId()` call to be unconditional (fix Rules of Hooks violation) | redteam-v2 P0-B |
| Δ1.3 | CSS | Split shorthand padding tokens into `-y` / `-x` pairs (match single-value token grammar) | redteam-v2 P1-A |
| Δ1.4 | Tests | Replace Vitest snapshot suite with 9-variant `describe.each` RTL test | redteam-v2 P1-B |
| Δ1.5 | Prose | Fix "6 cells" → "9 cells" in v1.1 line 251 | redteam-v2 P2-A |
| Δ1.6 | Docs | Add `<PlayerAvatar>`-renders-`.player-card`-class note to DESIGN_SYSTEM.md commit | redteam-v2 P2-B |
| Δ1.7 | Commit plan | Clarify atmosphere-conditional CSS lands in commit 2 (not commit 1) | redteam-v2 IC5 |
| Δ1.8 | Tests | Explicit T13 rewrite mapping in test plan | redteam-v2 IC6 |

---

## Δ1.1 — `.candy-card.candy-frame:active` press neutralizer (P0-A fix)

### Problem (recap)

`globals.css:2148-2155` `.candy-frame:active:not(:disabled)` rule applies `transform: translateY(2px)` plus shadow shift to ANY element with class `candy-frame` on tap. A `<CandyCard atmosphere="amber">` is presentational — it should NOT press down on touch.

### Fix — append to globals.css after the existing `.candy-frame:active` rule

```css
/* M2 v1.1.1 — neutralize press animation for non-interactive candy-card containers.
   .candy-card composes .candy-frame for amber/gold atmospheres but is presentational
   (no onClick), so the wooden-scroll press animation is wrong. */
.candy-card.candy-frame:active:not(:disabled) {
  transform: none;
  box-shadow:
    0 4px 0 var(--candy-frame-shadow, rgba(110, 65, 15, 0.45)),
    0 6px 14px rgba(0, 0, 0, 0.35),
    inset 0 2px 0 rgba(255, 255, 255, 0.30),
    inset 0 -2px 0 rgba(110, 65, 15, 0.20);
}
```

### Test plan addition

Add 1 test (T22) — assert that a `<CandyCard atmosphere="amber">` does NOT trigger pointer-down translation. Since pure CSS `:active` is hard to assert in jsdom, the test takes the form of a **DOM presence check**: rendered `<section>` has `class="candy-card candy-frame candy-frame-amber"` AND the override CSS rule exists in globals.css (verified by grep, not jsdom). Document as a "specification test, not a pointer-event simulation."

Net unit test count: 27 + 1 = 28.

---

## Δ1.2 — Unconditional `useId()` (P0-B fix)

### Problem (recap)

v1.1 patch line 370 shows:

```tsx
const titleId = title ? useId() : undefined;
```

This is a **conditional Hook call** — when `title` toggles between renders, the hook count changes, and React throws "Rendered more hooks than during the previous render."

### Fix — rewrite Δ8 pseudocode

```tsx
// CORRECT pattern: useId() called unconditionally; only the assignment is gated.
const generatedTitleId = useId();
const titleId = title ? generatedTitleId : undefined;
const TitleTag = titleAs ?? "h3";

<section
  data-component="candy-card"
  data-size={size}
  data-atmosphere={atmosphere}
  className={chassisClasses}
  aria-labelledby={title ? titleId : undefined}
  aria-label={!title ? ariaLabel : undefined}
>
  {(eyebrow || title) && (
    <header className="candy-card-header">
      {eyebrow && <div className="candy-card-eyebrow">{eyebrow}</div>}
      {title && (
        <TitleTag id={titleId} className="candy-card-title fantasy-title">
          {title}
        </TitleTag>
      )}
    </header>
  )}
  …
</section>
```

`useId()` always runs; the unused id when there's no title is harmless.

### Test plan addition

Add 1 test (T23) — re-render `<CandyCard>` with title toggling between `undefined` → `"hello"` → `undefined` and assert no React Hooks errors thrown. Pure smoke test against the regression.

Net unit test count: 28 + 1 = 29.

---

## Δ1.3 — Token grammar `-y` / `-x` split (P1-A fix)

### Problem (recap)

v1.1 patch defined shorthand-string tokens like `--candy-card-pad-compact: 0.75rem 0.875rem`. Existing token families in `globals.css` are strictly single-value (`--shell-radius: 16px`, `--cta-brand-from: #23C8F3`, `--duration-snap: 120ms`).

### Fix — replace v1.1 Δ5 token block

```css
:root {
  --candy-card-radius: 1.5rem;

  /* Padding tokens — single-value -y / -x pairs (matches existing grammar) */
  --candy-card-pad-compact-y: 0.75rem;
  --candy-card-pad-compact-x: 0.875rem;
  --candy-card-pad-regular-y: 1.25rem;
  --candy-card-pad-regular-x: 1.25rem;
  --candy-card-pad-feature-y: 1.75rem;
  --candy-card-pad-feature-x: 1.5rem;

  /* Gap tokens — single value (already correct in v1.1) */
  --candy-card-gap-compact: 0.5rem;
  --candy-card-gap-regular: 0.75rem;
  --candy-card-gap-feature: 1rem;

  /* Title size tokens */
  --candy-card-title-size-compact: 1rem;
  --candy-card-title-size-regular: 1.125rem;
  --candy-card-title-size-feature: 1.375rem;

  /* Resting border + shadow — applied conditionally for atmosphere=hub */
  --candy-card-shadow-resting:
    0 10px 28px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 245, 215, 0.55);
  --candy-card-border-resting: 1px solid rgba(255, 255, 255, 0.45);
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
```

`--candy-card-shadow-resting` is the lone exception (multi-stop shadow string) — but that follows existing token convention (e.g., `--cta-brand-glow` in `globals.css` is also a multi-stop shadow). Documented.

### Test plan delta

No new tests — token resolution is browser-side.

---

## Δ1.4 — `describe.each` RTL replaces snapshot suite (P1-B fix)

### Problem (recap)

v1.1 Δ6 introduced `toMatchSnapshot()` for the 9-variant matrix. **Zero precedent** for component snapshots in `apps/web/**/__tests__/`. M1 used class/attribute assertions throughout.

### Fix — replace AC10 implementation

`apps/web/src/components/redesign/__tests__/candy-card.test.tsx` (single test file, no separate `*.snapshot.test.tsx`):

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CandyCard } from "../candy-card";

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

9 tests generated by `describe.each`. No snapshot files. No new test convention. Maintainable.

### Test plan delta

- v1.1 Δ6: 9 snapshot tests (`+9`)
- v1.1.1 Δ1.4: 9 `describe.each` tests (`+9`, replacing snapshots) → no net change to total count from this fix.

Combined with Δ1.1 (+1) and Δ1.2 (+1):

| Source | Tests |
|---|---|
| v1.0 base | 16 |
| v1.0 frame tests dropped (Δ2) | −3 |
| Δ1 atmosphere tests (T17–T19) | +3 |
| Δ8 a11y tests (T20–T21) | +2 |
| Δ6 → Δ1.4 9-variant matrix | +9 |
| Δ1.1 press neutralizer | +1 |
| Δ1.2 useId regression | +1 |
| **Total** | **29** |

Vitest baseline target: 1130 → **1159** passing post-M2.

---

## Δ1.5 — Prose fix line 251 (P2-A)

In v1.1 patch, replace:

> "Vitest snapshot test at `__tests__/candy-card.snapshot.test.tsx` rendering all 6 representative cells (3 sizes × 2 atmospheres = 6 cells, since rune is dropped per Δ2)."

With:

> "RTL `describe.each` test at `__tests__/candy-card.test.tsx` covering all 9 representative cells (3 sizes × 3 atmospheres = 9 cells)."

This fix is folded into the v1.2 consolidated spec; the v1.1 patch document keeps the original "6 cells" line as audit-trail.

---

## Δ1.6 — DESIGN_SYSTEM.md note about historical class name (P2-B)

In commit 4 (`docs(design): document <CandyCard> primitive in DESIGN_SYSTEM.md`), append to the `<PlayerAvatar>` entry:

> **Note**: `<PlayerAvatar>` (renamed from `<PlayerCard>` in M2 commit 0) renders the historical CSS classes `.player-card`, `.player-card-img`, `.player-card-you`, `.player-card-bot`. CSS class rename is deferred to a follow-up ticket — separate concern from the React export rename. Do not introduce new consumers of the old class names; existing markup remains supported.

Single bullet, no behavior change.

---

## Δ1.7 — Commit plan disambiguation (IC5)

Update commit plan to clarify CSS scope:

| # | Commit | Includes |
|---|--------|----------|
| **0** | `refactor(redesign): rename <PlayerCard> to <PlayerAvatar>` | File rename + import update in `arena-hud.tsx:8` |
| **1** | `feat(redesign): introduce <CandyCard> primitive with atmosphere prop + a11y wiring` | Primitive `.tsx` + `<CandyCard>` test file (29 tests passing). **No CSS yet** — primitive references token vars that are added in commit 2. Commit 1 tests use `data-*` attr assertions only (atmosphere class assertions in commit 2 tests). |
| **2** | `style(redesign): add --candy-card-* tokens + atmosphere-conditional CSS to globals.css` | All `--candy-card-*` tokens (`-y`/`-x` split per Δ1.3), the `.candy-card[data-atmosphere="hub"]` border/shadow block, the `.candy-card.candy-frame:active` neutralizer (Δ1.1). Tests added/updated to assert atmosphere classes after CSS lands. |
| **3** | `test(redesign): add CandyCard variant matrix (3 sizes × 3 atmospheres)` | The `describe.each` block from Δ1.4 (9 tests). |
| **4** | `docs(design): document <CandyCard> primitive in DESIGN_SYSTEM.md + Naming policy section` | Includes Δ1.6 note about `.player-card` class name. |
| **5** | `docs(spec): M2 v1.2 SHIPPED — full evolution chain (v1.0 + v1.1 + v1.1.1 patches)` | Final consolidation commit. |

**Total**: 6 commits. Same count as v1.1.

**Note**: commit 1 ships the primitive WITHOUT atmosphere CSS. This is intentional — TDD red→green should split the primitive contract from its visual contract. Commit 2 brings the visual contract online. Tests in commit 1 verify markup; tests in commit 3 verify visual class composition.

---

## Δ1.8 — T13 explicit rewrite mapping (IC6)

v1.0 T13 was: `.candy-card.candy-card-regular.sheet-bg-hub` all present on outer.

In v1.2 consolidated, this test becomes:

| v1.0 test | v1.2 status |
|---|---|
| T13 — outer has `candy-card`, `candy-card-regular`, `sheet-bg-hub` classes | **Folded into the 9-variant matrix.** When `size=regular`, `atmosphere=hub`, the matrix test asserts: `data-size="regular"`, `data-atmosphere="hub"`, `class` contains `candy-card-regular` and `sheet-bg-hub`. T13 ceases to exist as a standalone test. |

This deduplication is part of why net test count is 29 (not 30) after all the additions.

---

## Updated Definition of Done

- [ ] All 29 unit tests passing (was 27 in v1.1, before P0 fixes)
- [ ] AC1–AC10 verified (with v1.1 + v1.1.1 deltas)
- [ ] Vitest baseline: 1130 → ≥1159 passing
- [ ] DESIGN_SYSTEM.md updated with primitive entry + Naming policy + `.player-card` historical note
- [ ] No existing surface visually regressed
- [ ] `<PlayerCard>` → `<PlayerAvatar>` rename complete (commit 0); `arena-hud.tsx:8` import updated
- [ ] TODO comment in `candy-glass-shell.tsx` referencing M3 DRY refactor
- [ ] `useId()` called unconditionally (no Rules of Hooks violation)
- [ ] `.candy-card.candy-frame:active` neutralizer applied (no press animation on amber/gold cards)
- [ ] M2 spec evolution chain locked (v1.0 + v1.1 + v1.1.1 + v1.2 consolidated) + handoff doc

---

## Open questions

All 8 v1.0 open questions: RESOLVED (in v1.1) or MOOT (frame removed in Δ2).
All v1.1.1 deltas surface no new open questions — they are surgical fixes to known bugs.

## Next step

Author **v1.2 consolidated spec** that mergea v1.0 + v1.1 patch + this v1.1.1 patch into a single readable doc. /tdd should consume v1.2 ONLY.

**No further redteam round.** Per redteam-v2 explicit recommendation: fixes are surgical and well-bounded. Proceed directly to v1.2 → /tdd.
