# `<ContextualHeader />` — Spec Re-Review (2026-05-01, follow-up)

> **Reviewer**: Sally (BMad — adversarial mode, 15-min re-review pass).
> **Subject**: `docs/specs/ui/contextual-header-spec-2026-05-01.md` after amendment commit `b38cfa3`.
> **Method**: Verify each of the 8 P0 from `contextual-header-spec-red-team-2026-05-01.md` was actually closed (not just claimed). Re-attack the new prose for new gaps introduced.
> **Scope**: Spec only — no code yet.

---

## 1. Veredicto

**Approve with minor notes.**

7 of 8 P0 are cleanly closed. 1 P0 (the `trailingControl` ReactElement narrowing) is **functionally closed but technically over-claimed** — the spec asserts "fragments are rejected" at compile time, which is false at the TS type level (`<></>` IS a `ReactElement<typeof Fragment>`). The right fix is a one-line runtime guard already implied by the §4 dev-mode warning list — the spec just needs to drop or soften the "fragments are rejected" claim. **Not a blocker for code.**

**Go on commit #1 of the implementation plan**, with one trivial spec follow-up captured below.

---

## 2. P0 status

| # | P0 finding (original) | Closure claim in amendment | Verified? | Notes |
|---|---|---|---|---|
| 1 | `trailingControl?: ReactNode` did not enforce "max 1" | §4: narrowed to `ReactElement` | ⚠️ **Partial** | Arrays, iterables, `null`, `undefined` are now type errors — confirmed. **But fragments (`<></>`) are still legal `ReactElement<typeof Fragment>` instances**, so a caller can wrap multiple children in a fragment and bypass the cap. See §3 below. |
| 2 | `back + modeTabs` mutex was prose | §4: discriminated union | ✅ Closed | `back` only on `BackControlHeaderProps`; `modeTabs` only on `ModeTabsHeaderProps`. Cannot coexist by construction. |
| 3 | `back` and `modeTabs` not gated by variant | §4: discriminated union | ✅ Closed | Same fix as P0-2. Passing `back={...}` on `variant="title"` is a TS error. |
| 4 | `piece-objective` variant violated own anti-explosion rule | §7: removed; play-hub uses `title-control` + `subtitle` | ✅ Closed | Variant gone. Canary example uses `title-control`. v1 ships 4 variants. Two amendment notes (§7.2, §7.4) cite the rationale for traceability. |
| 5 | Canary embedded sheet inside `trailingControl` | §8: state lifted; sheet renders as sibling | ✅ Closed | `mission-panel-candy.tsx` example shows `useState` lifted to parent, `<PiecePickerTrigger>` inside `trailingControl`, `<PiecePickerSheet>` outside. Pattern is unambiguous. |
| 6 | `mode-tabs` cap of 4 was prose | §4: tuple `readonly [TabOption, TabOption?, TabOption?, TabOption?]` | ✅ Closed | TS does enforce optional-tuple length. A 5th literal entry is `TS2322`. Callers passing `as readonly TabOption[]` can still bypass — this is the standard `as` escape hatch and is acceptable. |
| 7 | "Zero pixel delta" outside Z2 was impossible | §10 #6 + §14 rewritten | ✅ Closed | Acceptance now reads "DOM order + functional footprint preservation with ±2px tolerance on `.playhub-board-hitgrid`." §14 matrix replaced "zero pixel" cells with realistic per-zone language. Snapshot regen is explicit and reviewed. |
| 8 | `MissionDetailSheet` destination was TBD | §8: Phase-2 destination named (piece-picker sub-tab); sibling-render in canary; new acceptance #11 | ✅ Closed | TODO comment in the example names the destination. Acceptance #11 makes "MissionDetailSheet remains accessible in /play-hub post-canary" a hard gate. No regression risk. |

**Score**: 7 fully closed + 1 over-claimed (functionally closed, prose needs softening).

---

## 3. New finding from this re-review (1)

**RR-1. Fragments are NOT rejected by `ReactElement`.**

The spec asserts (§3 amendment note, §4 contract list):

> "fragments and arrays are rejected" / "fragments, iterables, null, and undefined no longer compile"

This is **half true**: arrays / iterables / `null` / `undefined` are correctly rejected by narrowing to `ReactElement`. But `<></>` desugars to `React.createElement(React.Fragment, null, ...)` which returns a `ReactElement<{children?: ReactNode}, typeof Fragment>` — a valid `ReactElement`. A caller can write:

```tsx
trailingControl={<><Chip /><Chip /></>}
```

…and TypeScript is happy. The single-element type constraint is satisfied (the fragment is one element), but the rendered output is two chips in Z2 — exactly what the spec is trying to prevent.

**Severity**: P1 (not P0). The discriminated union still closes the bigger leaks (P0-1, P0-2, P0-3), and the fragment escape hatch is rare in practice (no engineer wraps a single chip in a fragment by accident). The dev-mode runtime warning already listed in §4 ("`trailingControl`'s rendered DOM width > 44px → warn") catches the visual symptom.

**Required fix in spec**: soften the prose. Two edits:

1. In §3 amendment note, change:
   > "fragments and arrays are rejected"

   to:

   > "arrays, iterables, null, and undefined are rejected at compile time. Fragments wrapping multiple children pass the type check (a fragment is a single element) but trigger the dev-mode width-drift warning at render time."

2. In §4 contract list, change:
   > "arrays, fragments, iterables, null, and undefined no longer compile in `title-control`"

   to:

   > "arrays, iterables, null, and undefined no longer compile in `title-control`. Multi-child fragments compile but are caught at runtime by the width-drift warning (see §6.2 'trigger >44px wide')."

3. In §13 compile-time tests, **remove** the assertion `trailingControl={<></>}` is a type error and **add instead** a runtime test asserting that a multi-child fragment in `trailingControl` triggers the dev-mode warning.

These edits are <30 lines of prose total. Not a blocker for commit #1 — they can land alongside the implementation in commit #1 itself, OR as a tiny follow-up `docs(specs): soften ReactElement fragment claim` commit before commit #1. Reviewer's preference: roll into commit #1's PR description so reviewers see the honest contract.

---

## 4. Re-review checklist (per user-supplied list)

| # | Check | Pass? |
|---|---|---|
| 1 | `trailingControl` is `ReactElement`, not `ReactNode` | ✅ §4 line 93 / 110 |
| 2 | Props use discriminated union | ✅ §4 lines 72–113 |
| 3 | `back` / `modeTabs` / `trailingControl` gated by variant | ✅ Discriminated members. *But*: `trailingControl` is *required* on `title-control` and *optional* on `back-control` — intentional, not a bug. |
| 4 | `piece-objective` removed | ✅ §7.2 absorbs the case; §7.3 is now `mode-tabs` (renumbered correctly); §7.4 is `back-control`. |
| 5 | Canary does not embed sheets in `trailingControl` | ✅ §8 example. State lifted, sheets siblings. |
| 6 | `modeTabs.options` tuple-capped at 4 | ✅ §4 line 128. Optional-tuple positions enforce length ≤4. |
| 7 | Visual QA no longer demands "zero pixel delta" | ✅ §10 #6 + §14 matrix rewritten. |
| 8 | `MissionDetailSheet` has transitional + Phase-2 destination | ✅ §8 TODO comment + §10 #11 acceptance + Phase-2 destination named. |
| 9 | `className` no longer an escape hatch | ✅ §9 explicitly removes it. |
| 10 | Implementation plan is incremental and reversible | ✅ §12 — 4 commits (1: primitive + docs, 2: canary, 3: remaining variants, 4: cross-link follow-ons). Rollback triggers added. **Note**: commit #2 (canary) is the highest-risk single commit in the plan; everything else is independent. The §12 "Halt here for re-review before commit #3" gate is the right call. |
| 11 | API not too generic | ✅ 4 narrow variants. `trailingControl` typed to `ReactElement`. No `unknown`, no `any`, no escape props. |
| 12 | No new ambiguity blocking code | ⚠️ One small ambiguity (RR-1 above on fragments) — non-blocking. Otherwise clean. |

**Score**: 11/12 ✅, 1/12 ⚠️ (non-blocking).

---

## 5. P1 / P2 carry-forward status

These were noted in the original red-team review and accepted as carry-forward in the amendment:

| # | Item | Current status |
|---|---|---|
| P1-1 | Title length cap | ✅ Closed in amendment §6.1 (22 chars title, 32 subtitle, 12/16 tab labels). |
| P1-2 | `<Chip>` / `<IconButton>` / `<LabelPill>` ghost components | ✅ Closed in §5 amendment — table now references concrete primitives (`<PiecePickerTrigger>`, `<FilterChip>`, `<ShareIconButton>`) and explicit forbidden ones. |
| P1-3 | Sticky default | ✅ Closed — narrowed to `"scroll"` only in v1; sticky deferred. |
| P1-4 | Empty / loading state | ✅ Closed in amendment §6.2. |
| P1-5 | Focus management for variant transitions | 🟡 Carry-forward. Amendment notes "no screen in v1 swaps variants mid-flow." Reasonable. |
| P1-6 | E2E covers canary integration | ✅ Closed in §13 — new `contextual-header.spec.ts` asserts piece chip click opens picker, MissionDetailSheet reachable, no live timer / monetization in Z2. |
| P1-7 | Implementation plan ships dead code | ✅ Closed — §12 plan now: types ship in commit #1, `mode-tabs`/`back-control` runtime branches throw `assertNever` until commit #3 lands them with first consumer. |
| P2-1 | Duplicate tab-key behavior | ✅ Documented as last-wins + dev-mode warning (§4 runtime guards). |
| P2-2 | Tab labels unbounded | ✅ Closed (§6.1). |
| P2-3 | HTML wrapper / ARIA role | 🟡 Carry-forward. Amendment notes "implementer chooses `<header aria-label={...}>`." Acceptable for v1; reviewer asks the implementer to pick `<header>` explicitly to keep semantic-HTML hygiene. |
| P2-4 | `ariaLabel` content rules | 🟡 Carry-forward. `AriaLabel = string` with no pattern enforcement. Acceptable; lint rule could land later. |
| P2-5 | `className` escape hatch | ✅ Closed — removed in §9. |
| P2-6 | CI lint for misuse | 🟡 Carry-forward. Risk row in §11 still lists "ESLint rule" as future. Accept. |
| P2-7 | `data-component` runtime marker | ✅ Closed — §13 E2E selector `[data-component="contextual-header"]` makes the attribute mandatory at the test level (implementer must add it for the E2E to pass). |
| P2-8 | Rollback plan | ✅ Closed — §12 lists 4 rollback triggers. |
| P2-9 | Docs commit ordering | ✅ Closed — DESIGN_SYSTEM.md docs ship in commit #1. |
| P2-10 | Z1 + Z2 combined budget | 🟡 Carry-forward. Mentioned in amendment but not added as a hard constraint in §2; recommend adding the line "Z1 + Z2 ≤ 104px combined" as a one-liner during commit #1 if convenient. |

**5 carry-forwards**, all P1-/P2-level. None blocking.

---

## 6. Cambios requeridos antes de codear

**Only one, and it's optional / can roll into commit #1's PR**:

- **Soften the "fragments are rejected" claim in §3 amendment note + §4 contract list + §13 compile-time tests.** ~30 lines of prose. Not a blocker.

That's it. No spec re-amendment cycle needed.

---

## 7. Cambios opcionales

If the implementer has 5 spare minutes during commit #1:

- Pick `<header role="banner">` or `<header>` explicitly for the wrapper element (P2-3).
- Add `Z1 + Z2 ≤ 104px` as a one-liner constraint in spec §2 (P2-10).
- Pick the convention for `aria-label` content (e.g., `"${variant} header for ${title}"`) and document inline (P2-4).

None of these gate commit #1.

---

## 8. Riesgos aceptados (carry-forward)

These remain open after this re-review; documented for the next session:

- **Multi-child fragments in `trailingControl`** (RR-1) — caught only by dev-mode runtime warning, not by type system.
- **Focus management for variant transitions** (P1-5) — no v1 consumer needs it.
- **CI lint for misuse detection** (P2-6) — process discipline, not type-level.
- **`ariaLabel` content drift** (P2-4) — no pattern enforcement.
- **Migration churn across screens** — accepted in original spec; one PR per screen.
- **Future `<GlobalStatusBar />` and `<ContextualActionRail />` may shift Z2 contract** — accept.

---

## 9. Go / no-go

**GO on commit #1 of the implementation plan.**

`feat(ui): add ContextualHeader primitive (title + title-control variants) + design-system entry`

Pre-requisites:
- Spec is at `b38cfa3` ✓ (pushed to `origin/main`).
- Re-review (this doc) is committed ✓ (pending).
- No further spec amendment required (the §3 / §4 / §13 fragment-claim softening can roll into commit #1's PR).

Halt criteria for commit #1:
- Any new TS error introduced (`tsc --noEmit` count must stay flat).
- Any unit test failure.
- Any lint failure on the new file.

Halt criteria for commit #2 (canary):
- Visual QA snapshot for `/hub` shows Z3, Z4, or Z5 dimensions outside ±2px tolerance.
- New E2E spec `contextual-header.spec.ts` red.
- `MissionDetailSheet` open/close cycle broken.

---

## Status

Spec is **production-ready as a contract**. One small honesty fix recommended (RR-1 fragments), can roll into the first implementation commit. Proceed.

— Sally
