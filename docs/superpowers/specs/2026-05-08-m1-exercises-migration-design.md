# Spec — M1: `/exercises` migration to canonical primitives

**Date**: 2026-05-08
**Status**: draft
**Parent**: `_bmad-output/planning-artifacts/ux-design-application-audit-2026-05-08.md` §M1
**Source of truth for primitives**: `_bmad-output/planning-artifacts/ux-design-specification.md` (Phase 1+2)

## Problem

`/exercises` is the most-used player-facing surface. It ships
ad-hoc visual treatments (inline retry button styling, custom
`<TutorialBanner>`, raw chip rendering for shield count) instead
of the canonical Phase 1+2 primitives that `/hub` and `/arena`
already consume. The player tabs from `/hub` (migrated, candy-
unified) into `/exercises` (legacy) and feels a **visual seam**.
This is the dominant source of the "parchado" sensation reported
during the 2026-05-08 smoke.

## Goal

Eliminate the visual seam between `/hub` and `/exercises` by
adopting the same canonical primitives — without changing
gameplay logic. After M1, both surfaces share the same chip,
ribbon, and CTA grammar.

## Non-goals

- Changing exercise mechanics, scoring, badge claim, or any
  on-chain flow.
- Touching `<MissionPanelCandy>` — it's the gameplay shell,
  surface-specific equivalent of `<ArenaBoard>`. Stays.
- Touching the piece-rail, stars-bar, or board itself — gameplay
  primitives, not visual primitives.
- Coach surface (M3) or legal pages (M5).
- Rebuilding `<TutorialBanner>` from scratch — only its container
  treatment migrates to `<MissionRibbon>`.

## Contracts (SDD)

### Primitive adoption map

```ts
// Before (legacy, exercises-screen.tsx):
//   - inline shield chip in mission panel
//   - <ContextualActionSlot> with bespoke retry button styling
//   - <TutorialBanner> with custom border + tone

// After (M1, exercises-screen.tsx):
//   - <HudResourceChip tone="default" /> for shield count
//   - <PrimaryPlayCta surface="exercises" size="compact" />
//     for the retry/use-shield CTA
//   - <MissionRibbon surface="exercises" /> wrapping the
//     tutorial-banner copy
```

### `<PrimaryPlayCta>` extension required

The current `surface` enum is `"playhub" | "arena-entry" |
"landing-final-cta"`. M1 requires extending it:

```ts
type PrimaryPlayCtaSurface =
  | "playhub"
  | "arena-entry"
  | "landing-final-cta"
  | "exercises";  // NEW — exercise retry CTA
```

The `"exercises"` variant follows the existing visual signature
(amber gradient, gold-shadow border, `text-2xl` label) at
`size="compact"`. No new aesthetic; just routing.

### `<MissionRibbon>` extension required

Current `surface` enum is `"hub" | "arena" | "pro-sheet" |
"landing-cta-bar"`. M1 adds:

```ts
type MissionRibbonSurface =
  | "hub" | "arena" | "pro-sheet" | "landing-cta-bar"
  | "exercises";  // NEW — exercise tutorial banner
```

Copy lives in `editorial.ts.MISSION_RIBBON_COPY.exercises` —
sourced from existing `TUTORIAL_COPY` per piece (no new
copywriting required in M1).

### Editorial deltas

```ts
// editorial.ts — additions only, no rewrites
MISSION_RIBBON_COPY.exercises = {
  rook: TUTORIAL_COPY.rook,
  bishop: TUTORIAL_COPY.bishop,
  knight: TUTORIAL_COPY.knight,
  // ... per piece
};

CTA_LABELS.play.exercises = "Try again";  // current retry copy
CTA_LABELS.play.exercisesShield = "Use shield";  // current shield copy
```

## Behavior

1. **Shield chip migration**. The shield count rendering inside
   `<MissionPanelCandy>` is replaced with `<HudResourceChip
   tone="default" icon="shield" value={shieldCount} />`. Visual
   parity with the chip on `/hub` (post-credit-shield migration
   already populates the same source via `readDisplayedShields()`).
2. **Retry CTA migration**. `<ContextualActionSlot>` continues to
   own the *which-action-to-show* logic, but renders
   `<PrimaryPlayCta surface="exercises" size="compact">` for the
   retry/use-shield path. The shield button (introduced in
   `f7fb9c0`) keeps its 6s window and call to `consumeOneShield()`.
3. **Tutorial banner migration**. `<TutorialBanner>` is wrapped
   by `<MissionRibbon surface="exercises">` — the banner's
   internal text rendering stays; the *frame* moves to the
   ribbon primitive.
4. **GlobalStatusBar continues unchanged**. The back-chevron
   added in `62e54d9` is part of the canonical primitive; no M1
   work needed.
5. **Visual regression baselines**. M1 ships with new Playwright
   baselines for `/exercises` desktop + minipay viewports. Old
   baselines from `2026-05-09` are deleted in the same PR (they
   captured the legacy treatment).

## Edge cases

- **Tutorial first-visit**: the cyan-lane highlights stay on the
  board layer (`<Board>` internal); the ribbon only owns the
  copy frame.
- **No shield available**: chip renders with `value={0}` —
  `<HudResourceChip>` already supports the empty-state styling.
  No conditional render gymnastics.
- **Auto-reset 6s window**: the migrated CTA must keep the
  shield-button's 6s window from `f7fb9c0`. `<PrimaryPlayCta>`
  doesn't own timers — `<ContextualActionSlot>` does, unchanged.
- **CTA disabled state**: if `<ContextualActionSlot>` enters
  `isBusy`, the migrated `<PrimaryPlayCta>` must render its
  `disabled` state (50% opacity + grayscale + no pulse). Existing
  primitive supports this.
- **Reduced-motion**: ribbon and CTA already respect
  `prefers-reduced-motion` per their primitive specs. No new
  work.

## Acceptance criteria

- [ ] AC1: `<HudResourceChip>` renders the shield count in
      `/exercises`, sourced from `readDisplayedShields()`. Visual
      parity with `/hub` chip.
- [ ] AC2: Retry CTA in failure state renders as
      `<PrimaryPlayCta surface="exercises" size="compact">` with
      label "Try again" (or "Use shield" when shieldCount > 0).
- [ ] AC3: Tutorial banner copy is wrapped by `<MissionRibbon
      surface="exercises">`. The internal `<TutorialBanner>` text
      rendering is unchanged.
- [ ] AC4: `<PrimaryPlayCta>` accepts the new
      `surface="exercises"` variant; passes existing primitive
      tests.
- [ ] AC5: `<MissionRibbon>` accepts the new
      `surface="exercises"` variant; passes existing primitive
      tests.
- [ ] AC6: `editorial.ts` exports `MISSION_RIBBON_COPY.exercises`
      mapping per piece, sourced from existing `TUTORIAL_COPY`.
      No new copy authored.
- [ ] AC7: Shield button (6s window from `f7fb9c0`) continues
      to work — pressing it consumes one shield and resets the
      board.
- [ ] AC8: Auto-reset timing unchanged: 1.5s when no shields,
      6s when shields available.
- [ ] AC9: Playwright visual baseline for `/exercises` desktop
      added. Old baseline deleted in same PR.
- [ ] AC10: Playwright visual baseline for `/exercises` minipay
      added. Old baseline deleted in same PR.
- [ ] AC11: Full unit + E2E suites green; no regression on
      `/hub` or `/arena` baselines.

## Test plan

- **Unit**: extend `primary-play-cta.test.tsx` and
  `mission-ribbon.test.tsx` with the new `surface="exercises"`
  variant assertions.
- **Integration**: `exercises-screen.test.tsx` (if exists; create
  if not) — assert that the rendered tree contains the new
  primitives by `data-component` attribute.
- **Visual regression**: Playwright two new baselines.
- **E2E**: existing `/exercises` E2E specs (capture-only or
  flow-based) must pass without modification.

## Out of scope (deferred to later M-tasks)

- Editorial micro-copy sweep (M4): the 22-word retry-shield
  shop subtitle and similar long strings. M1 does not change
  copy beyond mapping existing strings into ribbon slots.
- Rowdies coverage audit (M6): runs in parallel to M1 but is
  its own spec.
- `<HelpChip>` introduction (M4): not built in M1.

## Open questions

1. Does `<ContextualActionSlot>` need a subtle refactor to
   accept `<PrimaryPlayCta>` as a child instead of rendering
   raw `<button>` itself? Likely yes — the slot becomes a
   layout shell, the CTA becomes the visual atom. Decide
   during TDD.
2. Should the `surface="exercises"` variant of `<MissionRibbon>`
   render slightly tighter (less vertical space) than the hub
   variant? Mission panel is dense; needs visual review.
   Defer to first PR review.

## PR shape

Single PR. Granular commits inside, all atomic:

- `feat(kingdom): add exercises surface to PrimaryPlayCta`
- `feat(pro-mission): add exercises surface to MissionRibbon`
- `feat(editorial): map TUTORIAL_COPY into MISSION_RIBBON_COPY.exercises`
- `refactor(exercises): adopt HudResourceChip for shield count`
- `refactor(exercises): wrap TutorialBanner in MissionRibbon`
- `refactor(exercises): replace contextual retry styling with PrimaryPlayCta`
- `test(e2e): rebaseline /exercises desktop + minipay`

Estimated: 7 commits, ~250 LOC net change.
