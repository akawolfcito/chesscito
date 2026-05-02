# `<ContextualHeader />` — Implementation Review (2026-05-01)

> **Reviewer**: Sally (BMad — adversarial mode, mid-PR review).
> **Subject**: Commit `fda38a0` — `apps/web/src/components/ui/contextual-header.tsx` (318 LOC) + `apps/web/src/components/ui/__tests__/contextual-header.test.tsx` (387 LOC) + spec RR-1 prose fix.
> **Method**: Read both files end-to-end with cynical lens. Cross-check each line against the spec (`docs/specs/ui/contextual-header-spec-2026-05-01.md` v1 + amendment). Verify the runtime guards actually fire and the type contracts compile as claimed.
> **Scope**: Code only — no canary wiring yet.

---

## 1. Verdict

**Approve with minor notes.**

The primitive faithfully implements the spec. Discriminated union compiles as claimed, runtime guards fire in dev only, no `className` escape hatch, no monetization slot, no children prop, no god-component anti-patterns. 20 unit tests cover the load-bearing behaviors. 530/530 vitest, 0 tsc errors.

The two notable gaps are both ARIA refinements on the `mode-tabs` variant — neither blocks the canary because the canary uses `title-control`, not `mode-tabs`. They become P1 the moment a real consumer adopts the `mode-tabs` variant (e.g. Trophies recents/all/locked filter).

**Go on commit #2 (canary in `/play-hub`).**

---

## 2. Spec → implementation traceability

| Spec contract | Implementation | Verified? |
|---|---|---|
| Discriminated union per variant | `ContextualHeaderProps` is a union of 4 variant-specific interfaces (lines 29–65) | ✅ Switch on `props.variant` correctly narrows. Excess properties from wrong variants are TS errors. |
| `trailingControl: ReactElement` (not `ReactNode`) | Line 40 (required on title-control), line 56 (optional on back-control) | ✅ Arrays / iterables / `null` / `undefined` are TS errors. Fragments compile (documented honestly per spec amendment). |
| `back` only on `back-control` | Line 55 (only field on `BackControlHeaderProps`) | ✅ |
| `modeTabs` only on `mode-tabs` | Line 47 (only field on `ModeTabsHeaderProps`) | ✅ |
| `modeTabs.options` tuple-capped at 4 | Line 20 (`readonly [TabOption, TabOption?, TabOption?, TabOption?]`) | ✅ A 5th positional entry is a TS error. |
| Length caps with dev warnings | `emitLengthWarnings` (lines 86–130) covers title, subtitle, tab labels, back label, duplicate tab keys | ✅ Tested in 5 unit tests. |
| Multi-child fragment runtime warning | `checkFragmentEscape` (lines 132–143) | ✅ Tested. Single-child fragment correctly does NOT warn (also tested). |
| Trigger width-drift dev warning | `useTriggerWidthGuard` (lines 145–161) | ⚠️ Implemented; not unit-tested because jsdom returns 0 from `getBoundingClientRect`. Will only fire in real browser; acceptable. |
| `data-component="contextual-header"` runtime marker | Lines 202, 232, 257, 295 (one per variant) | ✅ Plus `data-variant` on each header for finer audits. |
| Semantic `<header>` wrapper | Each variant renders `<header>` directly | ⚠️ See finding §3.2 — `mode-tabs` variant overrides implicit `banner` role with `role="tablist"`. |
| Z-index 10 (per zone-map decision record §1) | Line 180 `relative z-10` | ✅ |
| 52–64px height range | Line 181 `min-h-[52px] max-h-[64px]` | ✅ |
| 390px max width | Line 180 `max-w-[var(--app-max-width)]` | ✅ |
| No `className` prop | Not present | ✅ Surface tweaks impossible from caller. |
| No `children` prop | Not present | ✅ No arbitrary content slot. |
| Runtime guards no-op in production | All wrapped in `if (!isDev)` early-return (lines 80, 87, 133, 149) | ✅ Dead-code-eliminable in production builds. |

---

## 3. Findings

### 3.1 P0 — Block canary

**None.**

### 3.2 P1 — Fix before a `mode-tabs` consumer is shipped (NOT blocking canary)

**P1-IMPL-1. `mode-tabs` lacks WAI-ARIA tablist keyboard navigation.**

Each tab renders as `<button role="tab" aria-selected={...}>` (line 263–278), which is correct for the role attributes. But the WAI-ARIA Authoring Practices for tablist also require:

- **Roving tabindex**: only the active tab has `tabIndex={0}`; inactive tabs have `tabIndex={-1}`.
- **Arrow-key navigation**: ←/→ moves between tabs and updates the active tab; Home/End jumps to first/last.

Without these, keyboard users tabbing through the page step through every tab one by one (instead of arrow-key navigation), and screen readers don't announce the tablist behavior consistently.

**Why not P0**: the canary commit (#2) uses `title-control`. No `mode-tabs` consumer exists yet. The spec implementation plan §12 only schedules a `mode-tabs` consumer in a future PR.

**Fix path**: bundle into the same PR that ships the first `mode-tabs` consumer (Trophies filter). ~30 LOC + test.

**P1-IMPL-2. `<header role="tablist">` overrides the implicit banner role.**

Putting `role="tablist"` on `<header>` (line 254) is technically valid ARIA but semantically odd: the wrapping element changes from "screen header" to "tablist." Screen readers announce it as a tablist, not a header. A cleaner pattern would be:

```tsx
<header aria-label={props.ariaLabel} data-component="contextual-header" data-variant="mode-tabs">
  <div role="tablist" aria-label={props.ariaLabel} className="flex w-full gap-2">
    {/* tabs */}
  </div>
</header>
```

The header keeps its banner identity; the tablist is a contained widget inside it. Aligns with spec §6 forbidden case "no nested headers" (since this isn't a nested `<header>`, just a contained widget) and with §2 zone ownership.

**Why not P0**: same reason — no `mode-tabs` consumer in commit #2. Bundle with P1-IMPL-1.

### 3.3 P2 — Refinement, not blocking

**P2-IMPL-1. Length-cap warnings fire on every render.**

`emitLengthWarnings` is called in the component body (line 194), not inside an effect. Every state update on the consumer (e.g. `mission-panel-candy.tsx` re-renders on tutorial step change) will re-fire the warnings. React Strict Mode doubles the spam.

Mitigation options:
- Wrap the call in `useEffect(() => emitLengthWarnings(props), [/* deps */])` — fires once per props change.
- Use a `useRef`-guarded "fired-once" pattern.
- Accept the spam (dev-only, no production cost).

Reasonable to leave as-is for v1; revisit if console noise becomes a real complaint.

**P2-IMPL-2. `Sticky = "scroll"` type is defined but never consumed.**

The `sticky?` prop is accepted on every variant but the component body never reads it (no class swap, no `position` style). The spec narrows `Sticky` to `"scroll"` only for v1, so today the prop has zero behavioral effect — it's a forward-compat placeholder.

Two acceptable resolutions:
- **Keep**: prop signals intent; future `"sticky"` value can light up without API change.
- **Remove**: dead prop today; add when the value becomes actionable.

Recommend: keep, but add a comment explaining it's a forward-compat hook so future readers don't try to "fix" it by deleting.

**P2-IMPL-3. Inline arrow function in mode-tabs map.**

Line 269 creates a new closure per tab per render. Negligible for 4-max items; would matter at 100 items. Extract if needed; leave as-is for now.

**P2-IMPL-4. Width / centering may be redundant inside an already-390px container.**

Lines 180–181 apply `mx-auto max-w-[var(--app-max-width)]`. If a caller wraps in another 390px container, the constraint is harmless. If a caller sits inside a wider modal, the strip locks at 390px. Spec mandates 390px max, so behavior is correct — but it might surprise a caller. Worth a one-line JSDoc on the exported component.

### 3.4 P3 — Nits

- **P3-IMPL-1.** `emitLengthWarnings` is a chain of 4 `if` checks; could be a `switch` on `props.variant` for cleaner reading. Cosmetic.
- **P3-IMPL-2.** Test file imports `type ContextualHeaderProps` (line 5) and only uses it inside commented-out fixtures. Not dead — it's documentation — but a comment explaining the import's role would prevent a future "remove unused import" cleanup.
- **P3-IMPL-3.** `useTriggerWidthGuard` runs without a dep array. By design — measures every render — but a future contributor might add deps and break the measurement. A short comment "intentional: re-measure every render in dev to catch CSS drift" would help.
- **P3-IMPL-4.** No JSDoc on the exported `ContextualHeader`. Pointing at the spec from the docstring would help anyone discovering it via IDE go-to-definition.

---

## 4. Tests review

| Test | What it asserts | Verdict |
|---|---|---|
| 3 × title variant tests | Rendering, data-attrs, ariaLabel derivation, override | ✅ Solid |
| 6 × title-control tests | Title + subtitle render, click, length warnings, fragment warnings (multi-child fires; single-child doesn't) | ✅ Solid; the dual fragment test (positive + negative) is the key proof |
| 6 × mode-tabs tests | 1-tab, 4-tab, active highlight, click → onChange, label warning, duplicate-key warning | ✅ Solid |
| 4 × back-control tests | Render, hit area, click, optional trailing, label warning | ✅ Solid |
| 2 × compile-time docs | Documentation for what TS rejects vs runtime warns | ✅ Honest about no `tsd` lib yet |

**Test gaps (acceptable)**:
- No production-mode test (would need `process.env.NODE_ENV` mutation mid-test).
- No trigger width-drift test (jsdom returns 0 from `getBoundingClientRect`).
- No keyboard-navigation test for tabs (no implementation to test yet — see P1-IMPL-1).

**No test smells**: no implementation-detail assertions (selectors target ARIA roles + accessible names, not classnames). `silenceWarn` helper is reused cleanly.

---

## 5. Required fixes before canary

**None.**

The two P1 findings are both `mode-tabs`-only and the canary uses `title-control`.

---

## 6. Optional follow-ups

- Bundle P1-IMPL-1 + P1-IMPL-2 into the first `mode-tabs` consumer PR.
- Add the JSDoc on `ContextualHeader` (P3-IMPL-4) — 5 lines, ~2 min.
- Add the "intentional re-measure" comment on `useTriggerWidthGuard` (P3-IMPL-3) — 1 line.

These are nice-to-have during commit #2 if there's spare attention; otherwise queue for commit #3.

---

## 7. Plan recalibration (per user note)

The original 5-commit plan in spec §12 was already collapsed to 4 in the amendment. Now that all 4 variants ship runtime branches in commit #1 (not just `title` / `title-control`), the plan needs one more pass:

| Original v1 plan | Actual |
|---|---|
| #1 — primitive (title + title-control) + DESIGN_SYSTEM.md | ✅ Done in `fda38a0`, BUT all 4 variant branches shipped (not just 2) AND DESIGN_SYSTEM.md docs were NOT updated. **Carry-over: §10 entry in DESIGN_SYSTEM.md still pending.** |
| #2 — canary in `/play-hub` | Next |
| #3 — `mode-tabs` + `back-control` runtime branches | Already shipped in #1. **Repurpose** for: (a) DESIGN_SYSTEM.md §10 entry, (b) JSDoc + comment polish (P3 items), (c) ARIA tablist follow-on if a `mode-tabs` consumer is also queued. |
| #4 — Phase 2 cross-links in DESIGN_SYSTEM.md | Still relevant; merge with #3 if scope is small. |

Recommended new sequence:

1. ~~Commit #1~~ — done (`fda38a0`).
2. **Commit #2 — canary** (`refactor(play-hub): adopt ContextualHeader…`). Includes the new E2E spec `contextual-header.spec.ts` per spec §13.
3. **Commit #3 — DESIGN_SYSTEM.md §10 + JSDoc polish** (`docs(design-system): document ContextualHeader as canonical Z2`). Carries over the doc that was supposed to ship with #1.
4. **Commit #4 — Phase 2 cross-links** in DESIGN_SYSTEM.md (`docs(design-system): cross-link ContextualHeader Phase-2 follow-ons`). Optional; can merge into #3 if scope is small.

**Carry-over flagged for honesty**: spec §12 acceptance #10 (and amendment §10 #10) said "Docs ship in commit #1, not as a trailing commit." This implementation review notes the docs commit slipped. **Not a blocker**, but should be repaired in commit #3 to honor the spec.

---

## 8. Go / no-go

**GO on commit #2 (canary in `/play-hub`).**

Halt criteria for commit #2 (per spec §10 + §12):
- Visual snapshot diff in `/hub` shows Z3, Z4, or Z5 dimensions outside ±2px tolerance.
- New `contextual-header.spec.ts` E2E red.
- `MissionDetailSheet` open/close cycle broken.
- TS error count rises above baseline.
- Vitest count drops below 530.

After commit #2 lands and is verified, queue commit #3 to repair the slipped DESIGN_SYSTEM.md docs.

---

## Status

Implementation is **clean and faithful to the contract**. Two ARIA refinements queued for the future `mode-tabs` consumer; one DESIGN_SYSTEM.md doc commit slipped and needs repair after the canary lands. Proceed with the canary.

— Sally
