# `<ContextualHeader />` — Red-Team Review (2026-05-01)

> **Reviewer**: Sally (BMad — adversarial mode).
> **Subject**: `docs/specs/ui/contextual-header-spec-2026-05-01.md` (commit `2ae2487`).
> **Method**: Cynical-review pass per `bmad-review-adversarial-general`. Premise: assume problems exist. Look for what's missing, not just what's wrong.
> **Scope**: Spec only — no code yet.

---

## 1. Veredicto

**Approve with fixes.**

Foundation is sound: 14-section coverage, explicit out-of-scope, 5-commit phased plan, real visual QA matrix. The thinking is honest — the spec admits where it doesn't yet solve PRO chip split, mission detail surface, or other-screen migration.

But: the type-safety story is overstated, the `piece-objective` variant is the exact thing the variant-explosion mitigation warns against, and at least three "enforced by the type system" claims will compile-pass code that the prose forbids. Implementation today would lock in a primitive with leaks that re-create the inline-JSX problem inside the abstraction.

**Fix the 8 P0 items below, then green-light commit #1.** No need to re-spec from scratch.

---

## 2. Hallazgos por severidad

### P0 — Must fix before any code is written (8)

**P0-1. `trailingControl?: ReactNode` does not enforce "max 1".**
Prose says "single ReactNode, never an array." TypeScript's `ReactNode` includes `ReactNode[]`, `Iterable<ReactNode>`, fragments. A caller can pass `<><Chip/><Chip/></>` and the compiler is happy. The cap is documented intent, not a contract.

**P0-2. `back + modeTabs` mutual exclusion is not actually typed.**
Spec claims "back + modeTabs together is illegal" and "the type system" enforces it. The shown `interface ContextualHeaderProps` is flat — both fields are independently optional. Without a discriminated union per variant, both can be passed simultaneously and compile. Tests file even hedges: "compile-time error case is acceptable."

**P0-3. `back` is not gated by variant.**
A caller using `variant="title"` can still pass `back={...}` and the spec is silent on what renders. Same for `modeTabs` with `variant="title"`. Result: undefined behavior at the ground floor.

**P0-4. `piece-objective` variant violates the variant-explosion mitigation.**
The spec's own §11 risk row says "if 3+ screens want 'almost variant X but slightly different,' that's a missing primitive elsewhere." `piece-objective` exists for **exactly one screen**. By the spec's own rule it is wrong on day one — it should be `title-control` with subtitle, not a dedicated variant. Today: 5 variants. Day-2 pressure: trophies-stats, missions-progress, levels-overview will each demand their own.

**P0-5. The play-hub canary example puts a sheet *inside* `trailingControl`.**
The example renders `<PiecePickerSheet ... />` as the `trailingControl` value. But `PiecePickerSheet` IS a Type-C sheet — it portals out of the DOM tree when open. Z2 then "owns" a trigger AND a sheet that lives elsewhere visually. This conflates two concepts. The trailing control should be the trigger button only; the sheet should be rendered as a sibling, opened by lifted state.

**P0-6. `mode-tabs` cap of 4 is not enforced.**
Type is `ReadonlyArray<{key, label}>`. That's a readonly array of any length. To get a real cap, use a tuple type like `readonly [T, T?, T?, T?]`. The "runtime guard in dev mode" is a backup, not the contract. Same prose claim as P0-1.

**P0-7. Visual QA expects "zero pixel delta" outside Z2 — physically impossible.**
If the Z2 strip changes height by 1px, every pixel below it reflows by 1px. Acceptance criterion #6 reads "delta is bounded — only the Z2 strip changes; everything below is identical pixel-for-pixel." Snapshot tests will fail any honest refactor. Either:
- redefine criterion as "Z3/Z4/Z5 shape unchanged" (logical, not pixel), or
- commit to *exact* current Z2 height (52px or whatever) and call out that the primitive's height is locked to today's measured value.

**P0-8. Where does `MissionDetailSheet` access live after the refactor?**
Spec says: not in Z2, deferred to Phase 2 follow-up, "TBD: dock submenu or Z4 secondary." If the canary commit (#3) lands without a destination decided, mission detail becomes unreachable in `/play-hub`. This is a regression that ships in a "refactor" commit. Spec must either (a) name the destination now, or (b) keep `MissionDetailSheet` rendered alongside Z2 as a transitional measure with an explicit deprecation note.

---

### P1 — High; fix before merging the canary (7)

**P1-1. Title length has no truncation rule.**
Subtitle is "single line, truncated" — title has no rule. A future PIECE_LABEL like "Mounted Knight" or screen title "Mastery: K+R vs K" can overflow at 390px depending on typography. Define max chars (or `ellipsis` truncation behavior) per variant.

**P1-2. `<Chip>`, `<IconButton>`, `<LabelPill>` are ghost components.**
The "allowed children" table references three primitives that don't exist in the codebase. The play-hub example uses `<PiecePickerSheet>`. The spec is inconsistent with itself. Either:
- list these as future primitives that block this work, or
- replace the table with concrete existing components, or
- drop the "allowlist by component name" framing in favor of behavioral constraints (size, intent, output).

**P1-3. Sticky positioning is risky inside the current `mission-shell-candy` flex container.**
The current `mission-panel.tsx` shell is `flex h-[100dvh] flex-col overflow-hidden`. `position: sticky` on a child of `overflow-hidden` is a known broken combination on iOS Safari (and arguably Chromium too). The spec's mitigation says "tested during Phase 1" — but Phase 1 did NOT ship a sticky Z2 strip; the current Z2 is `shrink-0`, not sticky. Either pick `sticky="scroll"` as the default and admit sticky requires shell refactor, or commit to refactoring the shell as part of this work.

**P1-4. No empty / loading state spec.**
What does Z2 render while data loads (e.g., piece label fetched from chain, level fetched from contract)? Skeleton? Reserved space (CLS prevention)? Hidden? Without a rule, callers will inevitably mount/unmount the primitive on data ready, causing CLS regressions on MiniPay's slow networks.

**P1-5. No focus management spec for variant transitions.**
A screen that swaps `<ContextualHeader variant="mode-tabs" />` for `<ContextualHeader variant="back-control" />` (e.g., entering a sub-mode) will lose keyboard focus. Spec says nothing about focus restoration.

**P1-6. Test plan does NOT cover the canary integration end-to-end.**
The new `contextual-header.spec.ts` tests the primitive in isolation. The play-hub refactor (commit #3) relies only on visual snapshots. If a snapshot is regenerated to "absorb" a subtle regression (picker click no longer fires, focus lost, etc.) no functional test catches it. Need an E2E that opens `/hub`, asserts the piece chip inside Z2 is clickable, and that `<PiecePickerSheet>` opens.

**P1-7. Implementation plan ships dead code.**
Commits #1, #2, and #4 ship 5 variants total, but only `piece-objective` is consumed in this PR (commit #3). Three variants land as dead code with no caller. Either reorder to build-on-demand (only ship what the canary needs, defer the rest), or pre-commit a consumer per variant in the same PR.

---

### P2 — Medium; fix during implementation, not a blocker (10)

**P2-1. `mode-tabs` does not specify duplicate-key behavior.** Crash, last-wins, silent dedup? Undefined.

**P2-2. `mode-tabs` labels unbounded.** Four labels of "Achievements & Awards" each won't fit at 390px. No char cap.

**P2-3. No HTML element / ARIA role spec for the wrapper.** Should it be `<header>`, `<nav>`, `<section>`? Multiple `<header>` per page interact weirdly with screen readers without `aria-label`.

**P2-4. `ariaLabel` content rules undefined.** "Mission header" is redundant with the visible title. Either require a pattern (e.g., `${screenName} contextual header`) or derive from `title`.

**P2-5. `className?: string` escape hatch undermines "internal padding cannot be overridden."** Tailwind `!important` utilities, custom CSS, arbitrary classes — all bypass the claim. Either drop `className` entirely or accept only a typed allowlist (e.g., `"theme-emerald" | "theme-amber"`).

**P2-6. No CI lint mentioned for misuse detection.** Risk row says "ESLint rule" is "future." Without it, the medium-likelihood "callers bypass primitive" risk has no enforcement mechanism. Promote to MUST-do or accept the risk explicitly.

**P2-7. No `data-component-name="ContextualHeader"` attribute or similar runtime marker.** Makes auditing "which screens use the primitive vs not" require grep, not runtime inspection.

**P2-8. No rollback plan in implementation plan.** 5 commits, each reversible — fine — but no trigger criteria for revert (e.g., "if Sentry error rate > X%, revert commit #3").

**P2-9. Docs commit #5 ships LAST.** Anyone reviewing during commits #1–#4 sees a primitive with no DESIGN_SYSTEM.md entry. Should ship docs at #1 or alongside.

**P2-10. No coordination clause with `<GlobalStatusBar />`.** If Z1 grows beyond 40px later, Z2's "52–64px" assumption shifts. Combined budget should be stated.

---

### P3 — Nitpicks (5)

- **P3-1.** `formatTime(elapsedMs)` exists in `arena-utils.ts`; spec's "no live timers" forbidden case should reference it explicitly so a future contributor doesn't accidentally re-import.
- **P3-2.** Spec uses both "control" and "trailing control" — pick one term.
- **P3-3.** `ContextualHeaderVariant` union members use kebab-case strings; the rest of the codebase mixes camelCase and kebab-case for variant strings. Unify in `editorial.ts` or commit to one style.
- **P3-4.** Spec doesn't number the props in the `interface` block (line of types) — minor diff readability issue if the type evolves.
- **P3-5.** "Per `DESIGN_SYSTEM.md` §10" cross-link doesn't exist yet (spec adds it in commit #5). Reader hitting the spec mid-stream gets a dangling link.

---

## 3. Recomendaciones concretas

### 3.1 Replace the flat prop interface with a discriminated union

```ts
type ContextualHeaderProps =
  | { variant: "title"; title: string; ariaLabel: string; sticky?: Sticky; className?: ClassName }
  | { variant: "title-control"; title: string; subtitle?: string; trailingControl: TrailingChild; ariaLabel: string; sticky?: Sticky; className?: ClassName }
  | { variant: "mode-tabs"; modeTabs: ModeTabsProp; ariaLabel: string; sticky?: Sticky; className?: ClassName }
  | { variant: "back-control"; title: string; back: BackProp; trailingControl?: TrailingChild; ariaLabel: string; sticky?: Sticky; className?: ClassName };

type TrailingChild = ReactElement; // single element; not ReactNode
type ModeTabsProp = {
  activeKey: string;
  options: readonly [TabOption, TabOption?, TabOption?, TabOption?]; // tuple cap
  onChange: (key: string) => void;
};
type TabOption = { key: string; label: string };
```

This kills P0-1, P0-2, P0-3, and P0-6 in one move.

### 3.2 Fold `piece-objective` into `title-control`

`title-control` already accepts title + subtitle + trailingControl. The play-hub canary can render `<ContextualHeader variant="title-control" title="Rook" subtitle="Move to h1" trailingControl={<PiecePickerTrigger />} />` with no behavior loss. Drop `piece-objective` entirely. Closes P0-4.

### 3.3 Split sheet from trigger

In the canary example, render `<PiecePickerSheet>` as a sibling of `<ContextualHeader>`, lift `open` state to `mission-panel-candy.tsx`, and pass only the trigger element (a real chip button, ~44px wide) to `trailingControl`. Closes P0-5 and partially closes P1-2 (the trigger IS a chip; the sheet is not).

### 3.4 Redefine the visual QA criterion

Rewrite acceptance #6 as:

> Visual QA: `pnpm test:e2e:visual --project=minipay` shows the play-hub Z2 strip changed (snapshot regenerated and reviewed). Z3, Z4, Z5 selectors render in the same DOM order with the same dimensions ±2px (subpixel-rounding tolerance). No new pixels in Z3 are obscured by Z2.

Closes P0-7.

### 3.5 Decide `MissionDetailSheet` destination NOW

Two acceptable resolutions:

- **(a) Keep mission detail rendered as a sibling of Z2 in commit #3** with an explicit deprecation TODO comment and a follow-up issue tagged `@phase-2-z2-cleanup`. Visible regression: zero. Code debt: minor.
- **(b) Move mission detail into the dock as a 6th item.** *DEFENDED HARD* — dock is sacred per DESIGN_SYSTEM.md §8. Almost certainly wrong.
- **(c) Move mission detail into the piece-picker sheet as a tab.** Reasonable — piece + objective are conceptually paired.

Recommend option (a) for canary safety, with option (c) as the Phase-2 destination. Closes P0-8.

### 3.6 Promote ESLint rule from future to commit #5

Add to commit #5 (docs + system rules) a one-line ESLint custom rule (or grep CI check in `scripts/`) that fails when `apps/web/src/app/**/page.tsx` contains an inline `<header>` element. Closes P2-6.

### 3.7 Promote DESIGN_SYSTEM.md docs to commit #1

Ship the system entry with the primitive's first appearance, not 5 commits later. Closes P2-9.

### 3.8 Define Z1 + Z2 combined budget

Add to spec §2 a line: "Z1 + Z2 combined ≤ 104px (40 + 64). If Z1 grows, Z2 contracts via spec amendment, not silently." Closes P2-10.

---

## 4. Cambios REQUERIDOS antes de codear

These must land in the spec (commit on `main`) before commit #1 of the implementation plan:

1. **Replace flat props with discriminated union** (recommendation 3.1).
2. **Drop `piece-objective` variant**, fold into `title-control` (recommendation 3.2).
3. **Rewrite the canary example** to lift sheet state and pass only a trigger element (recommendation 3.3).
4. **Rewrite acceptance criterion #6** for realistic visual QA (recommendation 3.4).
5. **Name `MissionDetailSheet` destination** for commit #3 (recommendation 3.5, option a or c).
6. **Add empty / loading state rule** for Z2 (P1-4): "Z2 reserves its full height during data loading; uses a skeleton chip when content is unavailable; never unmounts/remounts within a single screen render."
7. **Define title length rule** (P1-1): "Max 22 characters at default typography; truncates with ellipsis past that point. Subtitle: max 32 characters, single line."
8. **Resolve sticky default** (P1-3): change `sticky` default to `"scroll"` for v1; document that `"sticky"` requires shell refactor and is out of scope for this primitive.

These are 8 spec edits. Estimated time: 30–45 minutes of doc work, no code.

---

## 5. Cambios OPCIONALES

Nice to have, do not block:

- Add `data-component="contextual-header"` for runtime auditing (P2-7).
- Add coordination clause for Z1 + Z2 budget (P2-10).
- Pick one HTML element / role and document it (P2-3).
- Tighten `ariaLabel` content rules (P2-4).
- Drop `className` escape hatch or convert to typed allowlist (P2-5).
- Add focus management note for variant transitions (P1-5) — defer if no screen actually does mid-flow variant swaps.

---

## 6. Riesgos aceptados

These remain open after the required fixes; documented for traceability:

- **Variant explosion pressure** — once 4 variants are live, future PRs WILL try to add a 5th. Mitigation is process (review checklist + spec PR), not code. Accept this is a recurring fight.
- **Caller bypass via `className`** — even with `className` removed, callers can wrap `<ContextualHeader>` in a `<div>` with custom Tailwind. Eternal vigilance, not a bug.
- **Migration churn** — moving every screen to the primitive after the canary is a 4-PR drip, each with its own visual QA. Accept the timeline.
- **Phase 2 follow-on dependencies** — `<GlobalStatusBar />` and `<ContextualActionRail />` are unwritten specs. Z2's contract may shift when Z1/Z4 land. Accept that this spec is v1.

---

## 7. Go / no-go

**No-go on commit #1 of implementation plan.**

**Go on a spec amendment** (single docs commit) that addresses the 8 P0 items in §4 above. Once that amendment lands on `main`:

- **Then go on commit #1** of the implementation plan.
- Run unit tests + visual QA after each implementation commit per the original plan.
- Halt and re-review if commit #3 (canary) shows any DOM-order or focus regression in the play-hub.

**Estimated path to "first code commit"**: spec amendment (~45 min) → quick re-review on amendment (~15 min) → green light. Total ~1h.

---

## Status

Spec is **strong but premature**. Foundation is right; sharp edges are claim-vs-reality gaps. Fix the 8 P0 items in the spec itself (no code), then proceed.

— Sally
