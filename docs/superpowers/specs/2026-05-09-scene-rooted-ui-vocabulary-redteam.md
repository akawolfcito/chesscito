# Red Team Review — Scene-Rooted UI Vocabulary

**Date**: 2026-05-09
**Reviewer mindset**: hostile QA + senior engineer
**Spec under review**: `2026-05-09-scene-rooted-ui-vocabulary-design.md`

## Findings

### P0 — Must address before implementation

(All addressed inline in the spec v1.0 itself; this section documents the issues that triggered the inline fixes.)

- **[Asset coupling] CSS-var fallback strategy underspecified** — original draft said "swapping asset = updating CSS var" without naming convention or location. **Fixed**: Spec now includes "CSS variable convention" section with naming pattern `--{primitive-kebab}-bg-{variant}` and globals.css declarations.
- **[Image asset performance] No size budget** — rendering 5 instances of `<StonePedestal>` could blow LCP on slow MiniPay connections. **Fixed**: Spec now includes "Asset performance budget" table with per-asset budgets and a pre-deploy verification step.
- **[Reduced motion fallback fidelity]** — original draft removed scale on `prefers-reduced-motion` but didn't define a replacement. Users couldn't perceive tap registration. **Fixed**: Spec behavior #7 now specifies a 200ms `border-color` flash as guaranteed minimum feedback.
- **[Test contract for asset-missing state]** — `is-placeholder` class was mentioned but unverified. **Fixed**: Acceptance criterion added — "Asset-missing fallback CSS placeholder renders with `is-placeholder` class on root."

### P1 — Should address (decisions made inline)

- **[Polymorphic disabled, daily-tactic exception]** — Daily-tactic "completed" state should feel "logrado-orgullo, not muerto" (Sally consultation). Current spec keeps disabled = `<button disabled>`. **Decision**: Out of v1 scope. Spec "Open questions" notes a future `<StonePedestal variant="trophy">` for the trophy state, hooked to "Mint your Moment". v1 ships disabled-as-disabled; post-vocabulary, separate spec adds the trophy variant.
- **[Loading + disabled simultaneously]** — Spec didn't define behavior. **Fixed**: Behavior #5 — `loading` takes visual precedence; click suppressed by either flag.
- **[`<TreasureTile>` ribbon enum scope]** — Open question. **Decided**: Enum `"BEST" | "NEW" | "SALE"` for v1, lockdown via TypeScript type. Arbitrary `ReactNode` ribbons rejected.
- **[GemPill purpose drift]** — Dual-mode `pressable` prop was a smell. **Fixed**: Split into `<GemBadge>` (presentational) + `<GemButton>` (pressable), 2 explicit primitives.
- **[Surface audit gap]** — Risk of hybrid app where some chrome is diegetic and some isn't. **Decision**: Listed in "Out of scope / future" as a follow-up audit task. NOT blocking v1.
- **[Spanish vs English copy]** — Spec mentions "Save my Moment" as English, asset filenames in Spanish (piedra, hongo, treasure-chest). **Decision**: Asset filenames are internal tokens; user-facing copy stays English per CLAUDE.md. No conflict.
- **[`action-pin tone="claim"` migration architecture]** — Replacement vs composition unspecified in earlier draft. **Fixed**: Migration mapping locks "composition — action-pin internally renders `<PrincipalButton>` when tone='claim'." All call sites preserved.

### P2 — Nice to clarify (mostly resolved)

- **[Stone rotation default = 2]** — Spec says default is 2. **Resolution**: Document the rationale during implementation (visual choice — piedra2 has neutral weathering). Not blocking.
- **[Treasure tile sizing in 2-col grid]** — paywall renders 2 tiles in a grid; does `large` chest visually stretch beyond `small`? **Resolution**: Implementation session must verify. Recommendation: tiles in same grid use equal column widths; visual scale is intrinsic to chest asset, not container.
- **[Migration mapping omits non-compact branch deletions]** — **Fixed**: Spec migration table now lists `mini-arena-bridge-slot.tsx (non-compact)` and `daily-tactic-card.tsx (non-compact)` as DELETE rows.
- **[Open question on PrincipalButton color variants]** — **Decided**: Generate variant assets, not CSS hue-rotate. Documented in Open questions.
- **[Iconography library coupling]** — **Fixed**: Behavior #10 explicitly forbids type-checking on icon prop.

## Categories audited

### Contract gaps

- ✓ All primitives have explicit `aria-label` requirements at the TypeScript type level (compile-time enforcement).
- ✓ Loading + disabled interaction defined (Behavior #5).
- ✓ `iconStack` shape: documented as `ReactNode`; no constraint on internal composition. Surface decides.
- ⚠ Type for `ribbon` is now an enum — but if a future use case needs a 4th value, contract change is required (intentional — prevents drift).

### Behavioral ambiguity

- ✓ Press animation defined (Behavior #1).
- ✓ Reduced-motion has fallback feedback (Behavior #7).
- ✓ Disabled-loading interaction explicit.
- ⚠ "Completed daily-tactic" trophy state deferred — spec is honest about this gap; ships disabled, future spec adds variant.

### Hidden assumptions

- ✓ Asset performance budget stated.
- ✓ Asset-still-loading state handled by CSS placeholder (Behavior #9).
- ✓ MiniPay WebView constraints noted in Edge cases (PNG only, no animated formats).

### Backward compatibility

- ✓ CandyCard contract NOT broken — new primitives are siblings.
- ✓ `action-pin.tsx` migration via composition preserves all call sites; no caller refactor needed.
- ✓ Existing tests (1160/1160) remain green; new tests are additive.

### Security & data

- N/A — no data flow, no auth, no inputs in this spec.

### Test coverage gaps

- ✓ Per-primitive minimal unit tests listed in acceptance criteria.
- ✓ Manual screenshot baselines required (`apps/web/e2e/screenshots/scene-rooted/`).
- ✓ Asset-fallback (`is-placeholder`) test required.
- ⚠ No automated visual regression (Chromatic/Percy) — accepted gap; manual baselines are the v1 trade-off given infra cost.

### Operational readiness

- ✓ Rollback plan: primitives are additive; revert migration commit if a surface breaks; primitive itself stays.
- ✓ Bundle size: assets in `apps/web/public/art/scene-rooted/` are served as static URLs (not bundled into JS); no tree-shaking concern.
- ⚠ No production telemetry on primitive usage — accepted; not material for visual primitives.

## Verdict

**READY for implementation** (after spec v1.0 inline fixes).

All P0 findings addressed inline in spec v1.0 itself. P1 decisions locked. P2 items either resolved or accepted as "verify during implementation."

Implementation session checklist (next session):

1. Copy assets from `design/new-assets-chesscito/` to `apps/web/public/art/scene-rooted/`.
2. Verify each asset is within performance budget (gzipped size).
3. Add CSS vars to `apps/web/src/app/globals.css`.
4. Implement `<StonePedestal>` first (TDD), then `<TreasureTile>`, `<PrincipalButton>`, `<WoodBanner>`, `<GemBadge>` + `<GemButton>`.
5. Each primitive: red-phase test → green implementation → manual screenshot baseline → commit.
6. After all 6 primitives green, update DESIGN_SYSTEM.md §16.
7. Halt before migration; await user approval to begin canary migration of `daily-tactic-card.tsx` (compact).

Ready signal: ✅ Run `/tdd` (or equivalent TDD-driven implementation skill) when ready to proceed.

## Risks remaining (acknowledged, not blocking)

| Risk | Mitigation |
|---|---|
| Asset finals delayed → app ships with placeholders | Asset Versioning Policy makes swap a CSS-var-only change; no code refactor required when finals arrive. |
| Vision regressions undetected without automated visual diff | Manual screenshot baselines + post-migration playtest from at least 1 device per migrated surface. |
| `<TreasureTile>` ribbon enum too restrictive in future | Adding a new enum value is a non-breaking minor version bump for the primitive (additive). |
| User taste shifts away from diegetic direction | Primitives are sibling family — abandoning means stop using them; no rip-out cost on existing CandyCard or other components. |
