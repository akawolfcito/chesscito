# Spec — M1: `/exercises` migration to canonical primitives

**Date**: 2026-05-08
**Status**: v1.1 — patched per red-team v1 (READY for /tdd)
**Parent**: `_bmad-output/planning-artifacts/ux-design-application-audit-2026-05-08.md` §M1
**Red-team**: `2026-05-08-m1-exercises-migration-redteam.md`
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

## v1.1 patch summary (post-red-team)

Three P0 corrections from `2026-05-08-m1-exercises-migration-redteam.md`:

- **AC3 reframed**: there is no `<TutorialBanner>` component. The
  pre-existing `pieceHint?: string` prop on `<MissionPanelCandy>`
  is defined but never rendered. M1 introduces a new
  `<MissionRibbon surface="exercises">` row inside the panel that
  consumes `pieceHint`. No editorial map needed; the existing
  `pieceHint` value (computed in `exercises-screen.tsx:1219`) is
  fed to the ribbon as-is.
- **Slot scope extended**: M1 migrates **all 6**
  `<ContextualActionSlot>` actions, not just retry/useShield.
  Leaving half the slot legacy would defeat the parchado-fix.
- **Primitive extensions specified**: §"Primitive extensions"
  enumerates new variants required (PrimaryPlayCta `size="pin"` +
  `badge` slot prop, MissionRibbon `surface="exercises"`).

Two P1 corrections:

- AC11 split into AC11a (Playwright visual) + AC11b (DOM
  snapshot).
- Animation ownership decided: **slot owns layout
  animations** (`animate-in fade-in zoom-in-95`); primitive owns
  internal state animations (pulse, press-down).

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
//   - <ContextualActionSlot> rendering raw <button> with bespoke
//     styling for ALL 6 actions: submitScore, useShield, claimBadge,
//     retry, connectWallet, switchNetwork
//   - pieceHint?: string prop on <MissionPanelCandy> defined but
//     never rendered (dead code path)

// After (M1, exercises-screen.tsx):
//   - <HudResourceChip tone="default" icon="shield"
//                      value={shieldCount} /> for shield count
//   - <ContextualActionSlot> renders <PrimaryPlayCta size="pin"
//                                                    surface={...}
//                                                    badge={...} />
//     for ALL 6 actions. claimBadge keeps its candy-frame visual
//     via a new tone variant (or a primitive prop) — NOT a one-off.
//   - <MissionRibbon surface="exercises"> renders pieceHint inside
//     <MissionPanelCandy>. The dead pieceHint prop is wired live.
```

### Primitive extensions (NEW per red-team P1)

#### `<PrimaryPlayCta>` — three additions

```ts
type PrimaryPlayCtaSurface =
  | "playhub"
  | "arena-entry"
  | "landing-final-cta"
  | "exercises-failure"        // retry / useShield in failure state
  | "exercises-success"        // submitScore / claimBadge in success state
  | "exercises-system";        // connectWallet / switchNetwork system states

type PrimaryPlayCtaSize =
  | "md"
  | "compact"
  | "pin";                     // NEW — 44×44 circular w/ external label

type PrimaryPlayCtaTone =
  | "default"                  // amber gradient (current)
  | "claim";                   // candy-frame gold (claimBadge today)

type PrimaryPlayCtaProps = {
  surface: PrimaryPlayCtaSurface;
  size: PrimaryPlayCtaSize;
  tone?: PrimaryPlayCtaTone;
  /** Optional floating badge slot (replaces the inline badge in
   *  contextual-action-slot.tsx:113-120). Renders at -right-1 -top-1
   *  on size="pin". On other sizes, renders inline ml-1. */
  badge?: ReactNode;
  // ... existing props (label, sublabel, onPress, disabled, isLoading)
};
```

The `size="pin"` variant produces a 44×44 circular button matching
the current slot's compact pin footprint, with an external label
rendered below by the slot.

#### `<MissionRibbon>` — surface addition only

```ts
type MissionRibbonSurface =
  | "hub" | "arena" | "pro-sheet" | "landing-cta-bar"
  | "exercises";  // NEW — exercise piece-hint surface
```

The `"exercises"` variant uses tighter vertical spacing than the
hub variant (mission panel is dense; open question §2 confirmed
during TDD).

### Editorial deltas (NEW — minimal, post-red-team P1)

```ts
// editorial.ts — additions only, no rewrites.
// pieceHint is the existing computed value from
// exercises-screen.tsx:1219. We DO NOT introduce
// MISSION_RIBBON_COPY.exercises per-piece — that mixed two
// content types under one surface key. The ribbon receives
// pieceHint as a prop, not via the editorial map.

CTA_LABELS.play.exercisesRetry = "Try again";
CTA_LABELS.play.exercisesShield = "Use shield";
CTA_LABELS.play.exercisesSubmit = "Submit score";
CTA_LABELS.play.exercisesClaim = "Claim badge";
CTA_LABELS.play.exercisesConnect = "Connect wallet";
CTA_LABELS.play.exercisesSwitchNetwork = "Switch network";
// (these may already exist in FOOTER_CTA_COPY today; reuse if so)
```

## Behavior

1. **Shield chip migration**. The shield count rendering inside
   `<MissionPanelCandy>` is replaced with `<HudResourceChip
   tone="default" icon="shield" value={shieldCount} />`. Visual
   parity with the chip on `/hub` (post-credit-shield migration
   already populates the same source via `readDisplayedShields()`).
2. **Slot full migration — all 6 actions**. `<ContextualActionSlot>`
   keeps its which-action-to-show logic but renders
   `<PrimaryPlayCta size="pin">` for every action, mapping:
   - `retry` → `surface="exercises-failure" tone="default"` label "Try again"
   - `useShield` → `surface="exercises-failure" tone="default"`
     label "Use shield" + `badge={shieldCount}`
   - `submitScore` → `surface="exercises-success" tone="default"`
     label "Submit score"
   - `claimBadge` → `surface="exercises-success" tone="claim"`
     label "Claim badge" (preserves candy-frame visual via tone)
   - `connectWallet` → `surface="exercises-system" tone="default"`
     label "Connect wallet"
   - `switchNetwork` → `surface="exercises-system" tone="default"`
     label "Switch network"
   The shield button (`f7fb9c0`) keeps its 6s window and call to
   `consumeOneShield()` — that logic lives in `exercises-screen.tsx`,
   not the slot.
3. **`pieceHint` ribbon row**. A new `<MissionRibbon
   surface="exercises">` row is added inside `<MissionPanelCandy>`,
   between the chip row and the board. It consumes the existing
   `pieceHint?: string` prop (currently dead code). The ribbon
   surface variant uses tighter vertical spacing (open question §2;
   resolved during TDD with a screenshot review).
4. **GlobalStatusBar continues unchanged**. The back-chevron added
   in `62e54d9` is part of the canonical primitive; no M1 work
   needed.
5. **Animation ownership**. The slot owns layout entrance
   animations (`animate-in fade-in zoom-in-95 duration-200` for
   compact mode, `animate-in fade-in slide-in-from-bottom-2
   duration-200` for full mode). The primitive owns internal
   state animations only (pulse, press-down, focus ring).
6. **Visual regression baselines**. M1 ships with new Playwright
   baselines for `/exercises` desktop + minipay viewports.
   Existing visual suite at
   `apps/web/e2e/visual-regression.spec.ts` covers `/hub` only
   today (per `2026-05-10-shop-sheet-debug-handoff.md`); /exercises
   baselines are creations, not replacements.

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
- [ ] AC2: All 6 contextual-slot actions (retry, useShield,
      submitScore, claimBadge, connectWallet, switchNetwork)
      render as `<PrimaryPlayCta size="pin">` with the surface +
      tone mappings in §"Behavior 2".
- [ ] AC3: `claimBadge` keeps its candy-frame visual via
      `tone="claim"` on the primitive — no one-off styling
      remains in `<ContextualActionSlot>`.
- [ ] AC4: `<MissionRibbon surface="exercises">` is rendered
      inside `<MissionPanelCandy>`, consuming the live
      `pieceHint` prop. The previously dead prop is wired.
- [ ] AC5: `<PrimaryPlayCta>` accepts new `size="pin"`,
      `tone="claim"`, `badge?: ReactNode`, and three new surface
      variants. Existing primitive unit tests still pass; new
      tests cover the additions.
- [ ] AC6: `<MissionRibbon>` accepts the new
      `surface="exercises"` variant with tighter vertical
      spacing. Existing primitive unit tests still pass.
- [ ] AC7: `editorial.ts` adds the 6 CTA labels for exercises
      (retry/shield/submit/claim/connect/switchNetwork). No new
      ribbon-copy editorial map is added — `pieceHint` is fed
      directly to the ribbon as a prop.
- [ ] AC8: Shield button (6s window from `f7fb9c0`) continues
      to work — pressing it consumes one shield and resets the
      board. Auto-reset timing unchanged: 1.5s no shields, 6s
      with shields.
- [ ] AC9: Floating shield-count badge (currently rendered by
      slot at `-right-1 -top-1`) is moved to the primitive's
      `badge` prop. No badge rendering remains in the slot.
- [ ] AC10: Slot continues to own entrance animations
      (`animate-in fade-in zoom-in-95 duration-200`). Primitive
      adds no entrance animations.
- [ ] AC11a: New Playwright visual baselines for `/exercises`
      desktop + minipay added (creations, not replacements).
- [ ] AC11b: No DOM-snapshot test regression on existing
      primitive consumers (`/hub`, `/arena`, `/landing`). If
      class-merge order shifts but rendered pixels stay,
      re-snapshot.
- [ ] AC12: Full unit + E2E suites green; no Playwright visual
      regression on `/hub` or `/arena`.

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

## Open questions (resolved post-red-team)

1. **Slot becomes layout shell, primitive is the visual atom**
   (resolved). The slot dispatches handlers + manages compact-
   vs-full mode + owns entrance animation; the primitive owns
   the visual appearance + state animations + badge slot. Spec
   is locked on this division.
2. **Ribbon density** (deferred to TDD). The
   `surface="exercises"` variant uses tighter vertical spacing
   than hub; exact value confirmed via screenshot review during
   the first commit of the migration. If the dense panel can't
   accommodate the ribbon at all, fallback is a tooltip-on-tap
   pattern — but that's a v1.2 patch, not v1.1.
3. **`exercises-screen.test.tsx` does not exist today** (P2 from
   red-team). Per CLAUDE.md "max 30 tasks per session" + "no
   tests automatizados por ahora" project context, M1 defers
   exercises-screen integration testing to E2E + visual
   regression. Unit tests cover the new primitive variants
   only.

## PR shape (revised post-red-team)

Single PR. Granular commits inside, all atomic:

- `feat(kingdom): extend PrimaryPlayCta with size="pin" + badge slot + tone variants`
- `feat(pro-mission): add exercises surface to MissionRibbon`
- `feat(editorial): add CTA labels for exercises slot actions`
- `refactor(exercises): adopt HudResourceChip for shield count`
- `refactor(exercises): wire pieceHint via MissionRibbon row in mission panel`
- `refactor(exercises): migrate ContextualActionSlot to PrimaryPlayCta (all 6 actions)`
- `test(primitives): cover PrimaryPlayCta size="pin" + tone="claim" + badge slot`
- `test(e2e): create /exercises desktop + minipay visual baselines`

Estimated: 8 commits, ~350 LOC net change (revised up from 250
because the slot migration covers all 6 actions).
