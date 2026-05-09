# Red-team v1 — M2 CandyCard spec

**Reviewed**: `2026-05-08-m2-candy-card-design.md` v1.0 DRAFT
**Date**: 2026-05-08
**Verdict**: **NEEDS REVISION** (P0 × 3, P1 × 5, P2 × 3)
**Recommendation**: author v1.1 patch (not full rewrite); then optional red-team v2 drift check; then /tdd.

## Summary

The spec's biggest crack is its central UX premise: it claims `<CandyCard>` will use `sheet-bg-hub` "like CandyGlassShell," but **none of the five named migration-target consumers (welcome-overlay, daily-tactic-card, coach-paywall, coach-welcome, mini-arena-bridge-slot) actually use `sheet-bg-hub` today** — they all paint with `.candy-frame candy-frame-amber/gold` (wooden scroll). M2 is therefore designing a primitive whose atmosphere matches *zero* of the M3+ migration targets it lists. Either the migration list is wrong, or the atmosphere is wrong. This wasn't surfaced in Sally's session because the consumers weren't audited against the painting.

Compounding that: the proposed DOM is a near-byte-clone of `<CandyGlassShell>` (same border, same shadow, same padding scale, same `rounded-3xl`, same flex column gap-3) minus the close button, which makes "presentational sibling of the modal shell" a more accurate framing than "general-purpose content card." That framing has knock-on consequences for naming, scope, and Q1 (atmosphere lock).

Three P0s below block /tdd; five P1s should be addressed in v1.1; tone of the spec is right but the technical assumptions about existing CSS and consumers are not.

## P0 — must fix before /tdd

### P0-1 — Atmosphere mismatch with stated migration targets

**Claim challenged**: "After M2, future feature work composes inside `<CandyCard>` … existing surfaces that re-rolled their own (welcome, daily-tactic, coach-paywall, coach-welcome) become migration targets for M3+."

**Evidence**:
- `apps/web/src/components/welcome/welcome-overlay.tsx:87` — `className="candy-frame candy-frame-amber …"`
- `apps/web/src/components/daily/daily-tactic-card.tsx:50,85` — `candy-frame candy-frame-amber`
- `apps/web/src/components/coach/coach-paywall.tsx:49,62` — `candy-frame candy-frame-amber` and `candy-frame candy-frame-gold`
- `apps/web/src/components/coach/coach-welcome.tsx:25` — `candy-frame candy-frame-gold`
- `apps/web/src/components/mini-arena/mini-arena-bridge-slot.tsx:40,55` — `candy-frame candy-frame-amber`
- Grep for `sheet-bg-hub` in `apps/web/src` returns 12 files; **every one is a sheet/modal** (`mini-arena-sheet`, `piece-picker-sheet`, `daily-tactic-sheet`, `share-modal`, `trophies-sheet`, `arena-entry-panel`, `arena-entry-sheet`, `candy-glass-shell`, `coach-paywall` shell wrapper, `exercise-drawer`, `mission-detail-sheet`). No "card" in the audit list uses it.
- `globals.css:2133-2173` — `.candy-frame` is a sculpted wooden gradient with `border-radius: 14px` and four box-shadow stops; visually unrelated to `sheet-bg-hub`'s painting.

**Why this is P0**: The spec's main downstream value-proposition (residential cousin = "M3+ migration of these 5 surfaces") cannot be realized as written. If `<CandyCard>` lands with `sheet-bg-hub` hardcoded, none of those consumers can adopt it without a visual redesign — explicitly out of M2 scope.

**Recommended fix**: Make atmosphere a v1 prop: `atmosphere?: "hub" | "amber" | "gold"`, default `"hub"`. Remove `sheet-bg-hub` from the hardcoded class list; emit conditionally. Re-evaluate Q1's "YAGNI" answer — the demand exists today.

### P0-2 — `.candy-card-frame` selector overlap with `.candy-frame` is incompatible

**Claim challenged**: Q7 v1.0 default — "`.candy-card-frame` should *include* `.candy-frame` ornamentation by composition (apply both classes), not duplicate it."

**Evidence**:
- `globals.css:2134-2155` — `.candy-frame` sets a yellow→gold gradient *background*, `border: 2px solid …`, `border-radius: 14px`, plus four box-shadow stops, and a `:active` translate.
- Spec §"CSS tokens" defines `.candy-card-frame` as `position: absolute; inset: 0; border-radius: inherit; pointer-events: none` — meant to overlay an *ornamental rune* on top of the card.
- Composing both: applying `.candy-frame` to an `absolute inset:0 pointer-events:none` div will repaint the entire card with a yellow gradient background and 14px corners (overriding `border-radius: inherit`), pushing a 4px box-shadow drop, and setting the `:active` translate — the opposite of an "ornament overlay."
- Additionally `.candy-frame` is used today as the **primary chrome** of the migration targets (P0-1 evidence). Reusing the same class as a transparent rune-overlay layer is semantic collision.

**Why this is P0**: If TDD writes "frame=rune overlays an inset-0 div with `.candy-card-frame .candy-frame`" the visual will be a giant yellow rectangle covering the card body. The spec's recommendation under Q7 will produce a broken render.

**Recommended fix**: Drop `frame="rune"` from M2 v1 entirely and ship it in M3 with a real rune asset (the spec admits the look is "ceremony"; without an asset it's vapor). Remove the `.candy-card-frame` CSS block. Drop tests #5–#7. Update AC4.

### P0-3 — Naming collision with seven existing `*Card*` files (incl. one in the SAME folder)

**Claim challenged**: Q8 v1.0 default — "Lock as `<CandyCard>`. Matches audit, matches Sally validation."

**Evidence** (Glob `apps/web/src/**/*card*.tsx`):
- `apps/web/src/components/redesign/player-card.tsx` — exports `<PlayerCard>`, lives in the SAME `redesign/` folder. Sprite-image renderer (returns `<picture>`) — same misclassification problem M1 found with `<CandyBanner>`.
- `apps/web/src/components/ui/card.tsx` — exports shadcn primitives `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`. **`CardFooter` collides with CandyCard's `footer` slot vocabulary.**
- `apps/web/src/components/daily/daily-tactic-card.tsx` — `<DailyTacticCard>`.
- `apps/web/src/components/trophies/trophy-card.tsx` — `<TrophyCard>`.
- `apps/web/src/components/arena/paper-stat-card.tsx` — `<PaperStatCard>`.
- `apps/web/src/lib/og/card-shell.tsx` — `<CardShell>` (OG image renderer).

**Why this is P0**:
1. The shadcn `card.tsx` already provides `CardHeader/CardTitle/CardContent/CardFooter` slot grammar with the same vocabulary the spec uses ("eyebrow + title + body + footer"). DESIGN_SYSTEM.md and IDE auto-complete will surface both. Spec needs to explicitly name the relationship.
2. `<PlayerCard>` is in the **same `redesign/` folder** but is a sprite-image renderer (it's misnamed — it's a `PlayerAvatar`). Adding `<CandyCard>` next to it amplifies the M1-CandyBanner-was-misnamed-card problem.

**Recommended fix**: (a) rename `<PlayerCard>` → `<PlayerAvatar>` as precondition of M2 — small, decoupled fix to a M1-era misnaming; AND (b) add §"Naming policy" cross-referencing `@/components/ui/card` shadcn family with explicit non-overlap statement.

## P1 — should fix before /tdd

### P1-1 — Proposed DOM is a clone of `<CandyGlassShell>` minus the close button

**Evidence**: side-by-side compare:

| | `CandyGlassShell` (`candy-glass-shell.tsx:43-50`) | `CandyCard` (spec §"Rendered structure") |
|---|---|---|
| outer | `sheet-bg-hub flex w-full flex-col gap-3 rounded-3xl px-5 py-5` | `candy-card candy-card-{size} sheet-bg-hub` |
| border | `1px solid rgba(255, 255, 255, 0.45)` | `1px solid rgba(255, 255, 255, 0.45)` |
| shadow | `0 10px 28px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 245, 215, 0.55)` | identical |
| title style | `fantasy-title px-2 text-lg font-extrabold` + warm-brown text-shadow inline | `.candy-card-title fantasy-title` + identical text-shadow in CSS |
| body | `flex flex-col gap-2` | `.candy-card-body { display:flex; flex-direction:column; gap:0.5rem }` |

**Why P1**: Two sources of truth for the same paint. Drift guaranteed.

**Recommended fix**: Add §"Refactor of CandyGlassShell" to the spec — either (a) compose CandyGlassShell on top of CandyCard in M2, or (b) explicitly defer + add a TODO marker in `candy-glass-shell.tsx`.

### P1-2 — Tokenization regression vs. existing motion / size token system

**Evidence**:
- `globals.css:84` `--app-max-width: 390px`, `:194` `--duration-snap: 120ms`, `:135-139` `--shell-radius: 16px; --shell-gap-xs: 4px; --shell-gap-sm: 8px`, `:262-280` full `--cta-*` token family.
- Spec hardcodes 12+ raw values (paddings, gaps, border-radius, font-sizes, shadow stops).

**Why P1**: Codebase tokenizes its design system; spec adds raw values. AC9 says "matches every other primitive in `redesign/`" but this primitive will be the worst tokenized.

**Recommended fix**: Add `--candy-card-pad-{compact|regular|feature}`, `--candy-card-gap-{…}`, `--candy-card-radius`, `--candy-card-shadow-resting` to `:root` in v1.1.

### P1-3 — `(dev)` route group is invented, not a precedent

**Evidence**: `ls apps/web/src/app/` shows: `__tests__`, `about`, `api`, `arena`, `coach`, `error.tsx`, `exercises`, `favicon.ico`, `globals.css`, `hub`, `layout.tsx`, `manifest.ts`, `page.tsx`, `privacy`, `support`, `template.tsx`, `terms`, `trophies`, `victory`, `why`. **No route group `(dev)`, `(internal)`, `_dev`, or similar.** Glob for `apps/web/src/app/**/page.tsx` returns 12 production routes — none are dev-only.

**Why P1**: Spec proposes `apps/web/src/app/(dev)/candy-card-gallery/page.tsx` as if a convention exists. It doesn't. Next.js App Router does NOT exclude `(dev)` from production by default — route groups are organization-only.

**Recommended fix**: Replace dev-route plan with: (a) Vitest snapshot test rendering all 6 cells with RTL, OR (b) Playwright story file at `apps/web/playwright/visual/candy-card.spec.ts` — mirrors existing `visual-regression.spec.ts` pattern. **Strong recommendation: (a) or (b).**

### P1-4 — Test plan does NOT match repo conventions

**Evidence** (`action-pin.test.tsx`, `welcome-overlay.test.tsx`):
- ActionPin uses `data-component="action-pin"` + `document.querySelector('[data-component="action-pin"]')` to find root, then `screen.getByRole("button", { name })` for accessible queries.
- WelcomeOverlay uses `screen.getByTestId("welcome-overlay")` — explicit `data-testid` is convention.
- Spec test plan refers to `"renders section + title h3 + body div"` — but proposed DOM has no `data-testid` and no `data-component`. RTL queries by `getByRole("region", …)` only work when `aria-label` is provided; AC8 makes label optional.

**Why P1**: Without `data-component="candy-card"`, half the tests fall back to `container.querySelector(".candy-card")` — couples tests to class names.

**Recommended fix**: Add `data-component="candy-card"` to the rendered `<section>`, plus `data-size` and `data-frame` data attributes for variant tests. Update test plan to assert against data attributes.

### P1-5 — `<section>` semantics + missing `<h3>` problem

**Evidence**: Spec AC2 + DOM template renders `<h3 class="candy-card-title">` UNCONDITIONALLY whenever `title` is truthy.

**Why P1**:
1. Heading hierarchy bug: a `<CandyCard>` rendered at the root of a screen creates h1-skip-to-h3.
2. `<section>` without an accessible name is reported by axe-core as "section has no accessible name."

**Recommended fix**: (a) auto-`aria-labelledby` to the title's auto-generated id; AND (b) make heading level configurable via `titleAs?: "h2" | "h3" | "h4"` (defaults `"h3"`).

## P2 — nice-to-have / future spec

### P2-1 — Compact + media not just "open to challenge" — it's broken

`<CandyCard size="compact" media={…}>` with the spec CSS produces `padding: 0.75rem 0.875rem; gap: 0.5rem` around an unconstrained-height media slot. There's no `max-height` or aspect-ratio guard. **Strong recommendation: explicitly disallow via TS overload or runtime warn.**

### P2-2 — `corner` prop pointer-events with multiple children

`.candy-card-corner { pointer-events: none } .candy-card-corner > * { pointer-events: auto }` — fine for a single child, but `corner={<><Badge/><Pip/></>}` produces a Fragment where only direct children get `pointer-events: auto`. Document.

### P2-3 — Shadcn `Card` / `CardHeader` / `CardFooter` parallel naming

Already covered as P0-3 evidence — worth a docs cross-link in DESIGN_SYSTEM.md so contributors don't import the wrong primitive.

## Open questions resolved

| # | Question | Recommended answer | Evidence |
|---|---|---|---|
| Q1 | Hardcoded `sheet-bg-hub` or `atmosphere?` prop? | **`atmosphere?: "hub" \| "amber" \| "gold"` from v1, default `"hub"`** | P0-1 — five migration targets all use `candy-frame-amber/gold` today |
| Q2 | `corner` fixed top-right or `cornerPosition`? | Fixed top-right v1 — agree with spec | No counter-evidence |
| Q3 | Visual reference shipping? | **Vitest snapshot test or Playwright spec file. NOT a `(dev)` route.** | P1-3 — no precedent in repo |
| Q4 | Frame + corner z-stacking conflict? | Moot if P0-2 lands (frame=rune dropped from v1) | P0-2 |
| Q5 | Compact + media broken? | **Disallow at TS layer** | P2-1 |
| Q6 | `as?: "section" \| "article" \| "div"` | Defer — but add `titleAs?` instead | P1-5 |
| Q7 | `.candy-card-frame` composes with `.candy-frame`? | **NO. Drop the composition. Drop `frame="rune"` from v1.** | P0-2 |
| Q8 | Lock name as `<CandyCard>`? | **Lock with caveats**: rename `<PlayerCard>`→`<PlayerAvatar>` precondition; document non-overlap with shadcn | P0-3 |

## Independent checks (not in spec's open questions)

| # | Check | Pass/Fail | Evidence |
|---|---|---|---|
| IC1 | Does any existing primitive own a `<section>` root? | **Pass** — `PageSection` uses `<section>` (page-section.tsx:23). Convention exists. | — |
| IC2 | Does the project use `data-component` on primitive roots? | **Mixed** — `ActionPin` does (action-pin.tsx:182); `CandyGlassShell`, `JourneyRail`, `PlayerCard`, `PageSection` do NOT. Spec must pick one. | — |
| IC3 | Does Tailwind class for `rounded-3xl` (=`1.5rem`) match `<CandyGlassShell>`? | **Pass** — both use `rounded-3xl`. | — |
| IC4 | Do existing tests rely on `getByRole("region")` for `<section>`? | **Fail** — none of the 3 redesign tests inspected query by `role="region"`. The spec's test plan would be the first. `<section>` without `aria-label` has no implicit role per WAI-ARIA — queries fail silently. | P1-5 |
| IC5 | Does `globals.css` already have a `--candy-card-*` token family? | **Fail** — zero hits for `--candy-card`. Spec adds raw values, no tokens. | P1-2 |
| IC6 | Does `mission-shell` (used by coach-paywall:26) compose `sheet-bg-hub`? | **Pass** — coach-paywall uses `mission-shell sheet-bg-hub` together. Suggests `sheet-bg-hub` is composed with sheet-specific class, not standalone. | — |
| IC7 | Does `JourneyRail` actually render `paper-tray` rows (spec claim)? | **Pass** — `journey-rail.tsx:90` `<div className="paper-tray">`. | — |
| IC8 | Does the spec's count of `.candy-frame` consumers (8) match reality? | **Mostly Pass** — Grep found 8 files; spec listed 6 explicitly + 2 inferred. Action-pin only uses `candy-frame` for `tone="claim"` (`action-pin.tsx:153`), not as default chrome. Minor accuracy nit. | — |

## Recommendation

**Do NOT proceed to /tdd. Author v1.1 patch (not full rewrite).**

Required v1.1 patches:

1. **P0-1 fix**: Add `atmosphere?: "hub" | "amber" | "gold"` to props, default `"hub"`. Remove `sheet-bg-hub` from hardcoded class list; emit conditionally.
2. **P0-2 fix**: Drop `frame="rune"` from M2 v1. Defer to a future spec when a real rune asset exists. Remove `.candy-card-frame` CSS block. Drop tests #5–#7. Update AC4.
3. **P0-3 fix**: Add precondition step "Rename `<PlayerCard>` → `<PlayerAvatar>` (1 commit)." Add §"Naming policy" cross-referencing `@/components/ui/card` shadcn family.
4. **P1-1 fix**: Add §"Migration: CandyGlassShell composes CandyCard" — either in M2 (preferred) or explicit deferral with TODO marker.
5. **P1-2 fix**: Tokenize via `--candy-card-*` custom properties in `:root`.
6. **P1-3 fix**: Replace `(dev)` route plan with Vitest visual snapshot or Playwright story.
7. **P1-4 fix**: Add `data-component="candy-card"`, `data-size`, `data-frame` data attributes; rewrite test plan to query them.
8. **P1-5 fix**: Add `titleAs?: "h2" | "h3" | "h4"` (default `"h3"`) AND auto-`aria-labelledby` when title is present.

After v1.1, run a quick red-team v2 drift check (M1 precedent), then proceed to /tdd. Test count likely drops from 16 → 13 (drop 3 frame tests) but adds 2 atmosphere tests, net 15.

## Critical files for implementation reference

- `apps/web/src/app/globals.css` (lines 449-515 `sheet-bg-hub`; 2133-2173 `.candy-frame`; tokens at 84, 194)
- `apps/web/src/components/redesign/candy-glass-shell.tsx` (DOM is the prior-art the new primitive duplicates)
- `apps/web/src/components/redesign/action-pin.tsx` (test convention reference; data-component pattern)
- `apps/web/src/components/redesign/__tests__/action-pin.test.tsx` (test infrastructure reference)
- `apps/web/src/components/redesign/player-card.tsx` (rename target — naming-collision blocker)
