# Spec — M1: `/exercises` migration to canonical primitives (v1.3)

**Date**: 2026-05-08
**Status**: SHIPPED 2026-05-08 (8 commits `4b79948..d46e362` on main)
**Predecessors**: v1.1 (`2026-05-08-m1-exercises-migration-design.md`) +
v1.2 patch (`2026-05-08-m1-exercises-migration-design-v1.2-patch.md`) +
v1.4 patch (`2026-05-08-m1-exercises-migration-design-v1.4-patch.md` —
mid-TDD discovery: chip-row + ribbon-row are ADDs, not REPLACEs)
**Red-team rounds**: v1 (`2026-05-08-m1-exercises-migration-redteam.md`),
v2 (`2026-05-08-m1-exercises-migration-redteam-v2.md`),
v3 (`2026-05-08-m1-exercises-migration-redteam-v3.md`)
**Source of truth for primitives**: `_bmad-output/planning-artifacts/ux-design-specification.md`
(Phase 1+2)

> v1.3 supersedes v1.1 + v1.2. /tdd should read THIS doc only. Prior
> versions are kept for audit trail.

## Problem

`/exercises` is the most-used player-facing surface. It ships ad-hoc
visual treatments (inline retry button styling, custom shield chip,
dead `pieceHint` prop) instead of the canonical Phase 1+2 primitives
that `/hub` and `/arena` already consume. The player tabs from `/hub`
(migrated, candy-unified) into `/exercises` (legacy) and feels a
**visual seam**. This is the dominant source of the "parchado"
sensation reported during the 2026-05-08 smoke.

## Goal

Eliminate the visual seam between `/hub` and `/exercises` by adopting
the same canonical primitives — without changing gameplay logic. After
M1, both surfaces share the same chip, ribbon, and CTA grammar.

## v1.3 patch summary (vs v1.1)

Two architectural pivots since v1.1, both surfaced by adversarial
review:

### From v1.2 patch (post-SDD discovery)

- `<PrimaryPlayCta>` is sprite-asset-driven, not a generic button
  primitive. The v1.1 plan to extend it with `size="pin"`, `tone="claim"`,
  and a `badge` slot does not match the actual primitive's contract.
- **Resolution**: drop the `<PrimaryPlayCta>` extension entirely.
  Introduce a NEW primitive `<ActionPin>` that owns the
  44×44 pin / 52px full grammar used by `<ContextualActionSlot>`.
  Each primitive stays single-purpose: `<PrimaryPlayCta>` = dominant
  kingdom CTA (sprite-driven); `<ActionPin>` = contextual action atom
  (CSS-driven).

### From red-team v2 (post-v1.2 review)

Two P0s + five P1s addressed below.

- **P0**: `<MissionRibbon>` does NOT accept copy as a prop. v1.1
  assumed it does. The primitive reads from
  `MISSION_RIBBON_COPY[surface]` directly. Resolution: extend the
  primitive with a `text?: string` override prop (same class of fix as
  the v1 CandyBanner-no-es-card discovery).
- **P0**: `<ActionPin>` API needs `isBusy` and `disabled` as orthogonal
  props (not collapsed into one). Mirrors `PrimaryPlayCta` /
  `HudResourceChip` semantics. `aria-busy` wires only to `isBusy`.
- **P1**: `<ActionPin>` accepts `atmosphere` from day-1 (canon
  consistency with other primitives).
- **P1**: badge prop split per mode (`badge: { compact?, full? }`).
- **P1**: label rendering ownership locked — `<ActionPin>` always
  renders an internal label; orchestrator-side external label is
  removed.
- **P1**: SlotCta test matrix enumerated explicitly (~22 tests).
- **P1**: primitive location locked at `components/redesign/action-pin.tsx`.
- **P2**: naming locked — `<ActionPin>` (consumer-agnostic) over
  `<SlotCta>`. Visual atom name reflects the geometry (44×44 pin or
  52px full action button), not the orchestrator role.
- **P2**: compact-vs-full mode resolution lives on the orchestrator
  (`<ContextualActionSlot>` `compact?: boolean` prop, unchanged from
  today).

## Non-goals

- Changing exercise mechanics, scoring, badge claim, or any on-chain
  flow.
- Touching `<MissionPanelCandy>` beyond the new ribbon row injection.
  It stays the gameplay shell, surface-specific equivalent of
  `<ArenaBoard>`.
- Touching the piece-rail, stars-bar, or board itself — gameplay
  primitives, not visual primitives.
- Coach surface (M3) or legal pages (M5).
- Designing tutorial-banner UX from scratch — only its container
  treatment migrates to `<MissionRibbon>` via the new copy-override
  prop.
- Extending `<PrimaryPlayCta>`. The dominant CTA primitive stays
  intact in M1.

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

// After (M1 v1.3, exercises-screen.tsx):
//   - <HudResourceChip tone="default" icon="shield"
//                      value={shieldCount} /> for shield count
//   - <ContextualActionSlot> renders <ActionPin> for ALL 6 actions
//     with action + size + tone + badge + isBusy + disabled mappings
//     in §"Behavior 2".
//   - <MissionRibbon surface="exercises" text={pieceHint}> renders
//     inside <MissionPanelCandy>. The previously dead pieceHint prop
//     is wired live.
```

### NEW primitive — `<ActionPin>`

**Location**: `apps/web/src/components/redesign/action-pin.tsx`
**Test location**: `apps/web/src/components/redesign/__tests__/action-pin.test.tsx`

```ts
import type { ReactNode } from "react";
import type { CandyIconName } from "@/components/redesign/candy-icon";

export type ActionPinAction =
  | "submitScore"
  | "useShield"
  | "claimBadge"
  | "retry"
  | "connectWallet"
  | "switchNetwork";

export type ActionPinSize = "pin" | "full";       // 44×44 circle | 52px full-width
export type ActionPinTone = "default" | "claim";  // gradient | candy-frame-gold
export type Atmosphere = "adventure" | "scholarly";

type ActionPinBadgeContent = {
  /** Rendered when size="pin" — typically a raw int (e.g. shield count). */
  pin?: ReactNode;
  /** Rendered when size="full" — typically a formatted phrase. */
  full?: ReactNode;
};

type Props = {
  action: ActionPinAction;
  size: ActionPinSize;
  /** Visual tone. `"claim"` swaps the gradient for `candy-frame
   *  candy-frame-gold` — used by `claimBadge`. Default `"default"`. */
  tone?: ActionPinTone;
  /** Visible label string. Always rendered:
   *  - size="pin"  → external `<span class="action-pin-label">`
   *                  rendered BELOW the button by THIS primitive (not
   *                  the orchestrator). Wraps the button + label in a
   *                  flex column container.
   *  - size="full" → inline label inside the button.
   *  Single source of truth for the visible text — orchestrators MUST
   *  NOT render their own label. */
  label: string;
  /** Accessibility name for the button. Often equals `label`; may
   *  differ when a contextual modifier is needed (e.g.,
   *  "Use shield (3 left)"). */
  ariaLabel: string;
  /** Optional floating badge. Per-mode content lets the consumer pass
   *  the right shape (raw int vs formatted phrase). */
  badge?: ActionPinBadgeContent;
  /** Visual register. Adventure (default) for the kingdom canon;
   *  Scholarly reserved for future Scholarly slot consumers. Day-1
   *  inclusion preserves canon consistency with `<PrimaryPlayCta>` /
   *  `<MissionRibbon>` / `<HudResourceChip>`. */
  atmosphere?: Atmosphere;
  /** Loading flag. Wires `aria-busy` and renders the spinner in place
   *  of the icon. Blocks `onPress`. Distinct from `disabled`. */
  isBusy?: boolean;
  /** Disabled flag. Sets the underlying button `disabled` attribute
   *  and applies `is-disabled`. Does NOT set `aria-busy`. Blocks
   *  `onPress`. */
  disabled?: boolean;
  onPress: () => void;
  className?: string;
};
```

#### Internal mapping tables (carried from `<ContextualActionSlot>`)

```ts
// Per-action gradient + glow tokens (unchanged from current slot).
const ACTION_STYLES: Record<ActionPinAction,
  { bg: string; glow: string; text: string }> = {
  submitScore: { bg: "bg-gradient-to-b from-[var(--cta-brand-from)] to-[var(--cta-brand-to)]", glow: "shadow-[var(--cta-brand-glow)]",  text: "text-white" },
  useShield:   { bg: "bg-gradient-to-b from-[var(--cta-reward-from)] to-[var(--cta-reward-to)]", glow: "shadow-[var(--cta-reward-glow)]", text: "text-[var(--cta-reward-text)]" },
  claimBadge:  { bg: "bg-gradient-to-b from-[var(--cta-special-from)] to-[var(--cta-special-to)]", glow: "shadow-[var(--cta-special-glow)]", text: "text-white" },
  retry:       { bg: "bg-[var(--cta-muted-bg)]", glow: "", text: "text-[var(--cta-muted-text)]" },
  connectWallet: { bg: "bg-gradient-to-b from-[var(--cta-brand-from)] to-[var(--cta-brand-to)]", glow: "shadow-[var(--cta-brand-glow)]", text: "text-white" },
  switchNetwork: { bg: "bg-gradient-to-b from-[var(--cta-reward-from)] to-[var(--cta-reward-to)]", glow: "shadow-[var(--cta-reward-glow)]", text: "text-[var(--cta-reward-text)]" },
};

const ACTION_ICON: Record<ActionPinAction, CandyIconName> = {
  submitScore: "star",
  useShield: "shield",
  claimBadge: "trophy",
  retry: "refresh",
  connectWallet: "wallet",
  switchNetwork: "refresh",
};
```

When `tone="claim"`, ACTION_STYLES is bypassed and `candy-frame
candy-frame-gold action-pin-attention` is applied instead (matching
the current `claimBadge` candy-frame treatment).

### `<MissionRibbon>` extension (P0 fix from red-team v2)

```ts
export type MissionRibbonSurface =
  | "hub" | "arena" | "pro-sheet" | "landing-cta-bar"
  | "exercises";  // NEW

type Props = {
  surface: MissionRibbonSurface;
  /** Optional copy override. When provided, renders this text instead
   *  of `MISSION_RIBBON_COPY[surface]`. Used by `surface="exercises"`
   *  to feed `pieceHint` (computed at runtime in
   *  `exercises-screen.tsx:1219`). When omitted, the primitive falls
   *  back to the editorial map — preserving v1.1 callsite signatures.
   */
  text?: string;
  tone?: MissionRibbonTone;
  atmosphere?: Atmosphere;
  className?: string;
};
```

ARIA semantics unchanged (`role="note"` +
`aria-label={MISSION_RIBBON_COPY.ariaLabel}`). The override only
swaps the inner text node.

### Editorial deltas

```ts
// editorial.ts — additions only.
//
// FOOTER_CTA_COPY already has labels for all 6 actions (label,
// compactLabel, loading) — REUSED, no new entries needed.
//
// MISSION_RIBBON_COPY.exercises is added as a fallback string for the
// case where no `text` override is passed (e.g., default rendering or
// tests). It mirrors the `pieceHint` shape — a short instructional
// phrase. Live use always passes `text` from runtime pieceHint, so
// the editorial entry is the safety net.
MISSION_RIBBON_COPY.exercises = "Watch the piece. Move it.";
```

No new `EXERCISE_HINT_COPY` map. No per-piece editorial sprawl. The
ribbon `text` prop is the single ingress for runtime instruction copy.

## Behavior

1. **Shield chip migration**. The shield count rendering inside
   `<MissionPanelCandy>` is replaced with `<HudResourceChip tone="default"
   icon="shield" value={shieldCount} />`. Visual parity with the chip on
   `/hub`.
2. **Slot full migration — all 6 actions**.
   `<ContextualActionSlot>` keeps its which-action-to-show dispatch +
   compact-vs-full mode + entrance animations + 6s shield window.
   Renders `<ActionPin>` for every action:

   | Action | size (pin) | size (full) | tone | badge.pin | badge.full |
   |---|---|---|---|---|---|
   | retry | pin | full | default | — | — |
   | useShield | pin | full | default | `{shieldsAvailable}` | `${n} left` |
   | submitScore | pin | full | default | — | — |
   | claimBadge | pin | full | claim | — | — |
   | connectWallet | pin | full | default | — | — |
   | switchNetwork | pin | full | default | — | — |

   The 6s shield window stays in `exercises-screen.tsx`. The
   `consumeOneShield()` call stays in the slot's handler. ActionPin
   never owns the timer.

3. **`pieceHint` ribbon row**. A new `<MissionRibbon
   surface="exercises" text={pieceHint}>` row is added inside
   `<MissionPanelCandy>`, between the chip row and the board. The
   previously dead `pieceHint` prop is now wired live to the ribbon
   `text` override.
4. **GlobalStatusBar continues unchanged**. Back-chevron from `62e54d9`
   stays.
5. **Animation ownership**. The slot owns layout entrance animations
   (`animate-in fade-in zoom-in-95 duration-200` for compact mode,
   `animate-in fade-in slide-in-from-bottom-2 duration-200` for full
   mode). The primitive owns internal state animations only (pulse,
   press-down, focus ring).
6. **Label ownership**. `<ActionPin>` ALWAYS renders the visible label
   (external below button on size="pin", inline on size="full"). The
   slot must not render its own `<span>` for the label — duplicate
   labels become a P0 in TDD if they slip in.
7. **Visual regression baselines**. M1 ships with new Playwright
   baselines for `/exercises` desktop + minipay viewports.

## Edge cases

- **Tutorial first-visit**: cyan-lane highlights stay on the board
  layer (`<Board>` internal); the ribbon only owns the copy frame.
- **No shield available**: chip renders with `value={0}` —
  `<HudResourceChip>` already supports the empty-state styling.
- **Auto-reset 6s window**: unchanged. Slot owns the timer.
- **CTA disabled state**: orthogonal to `isBusy`. A `connectWallet`
  pin can be `disabled` (parent gate computing) without `aria-busy`.
- **Reduced-motion**: ribbon and CTA already respect
  `prefers-reduced-motion` per their primitive specs. ActionPin
  inherits the same canon CSS.
- **MissionRibbon fallback**: when `text` is omitted, the primitive
  uses `MISSION_RIBBON_COPY[surface]`. All v1.0 callsites
  (`/hub`, `/arena`, `/landing-cta-bar`, `/pro-sheet`) keep working
  unchanged because they don't pass `text`.

## Acceptance criteria

- [ ] **AC1**: `<HudResourceChip>` renders the shield count in
      `/exercises`, sourced from `readDisplayedShields()`. Visual
      parity with `/hub` chip.
- [ ] **AC2**: All 6 contextual-slot actions render as `<ActionPin>`
      with the size + tone + badge mappings in §"Behavior 2".
- [ ] **AC3**: `claimBadge` keeps its candy-frame-gold visual via
      `tone="claim"` on `<ActionPin>` — no one-off styling remains in
      `<ContextualActionSlot>`.
- [ ] **AC4**: `<MissionRibbon surface="exercises" text={pieceHint}>` is
      rendered inside `<MissionPanelCandy>`, consuming the live
      `pieceHint` prop. The previously dead prop is wired.
- [ ] **AC5**: `<MissionRibbon>` accepts `text?: string`. When
      provided, renders the override; when omitted, renders
      `MISSION_RIBBON_COPY[surface]`. All existing callsites untouched.
- [ ] **AC6**: `<MissionRibbon>` accepts the new `surface="exercises"`
      variant with tighter vertical spacing. Existing primitive unit
      tests still pass.
- [ ] **AC7**: `<ActionPin>` exists at
      `components/redesign/action-pin.tsx`, exports the contract in
      §"NEW primitive", and has the test matrix in §"Test plan".
- [ ] **AC8**: Shield button (6s window from `f7fb9c0`) continues to
      work — pressing it consumes one shield and resets the board.
      Auto-reset timing unchanged: 1.5s no shields, 6s with shields.
- [ ] **AC9**: Floating shield-count badge moves to `<ActionPin>` `badge`
      prop with `pin: shieldsAvailable, full: FOOTER_CTA_COPY.shieldsLeft(n)`.
      No badge rendering remains in the slot.
- [ ] **AC10**: Slot continues to own entrance animations
      (`animate-in fade-in zoom-in-95 duration-200`). Primitive adds no
      entrance animations.
- [ ] **AC11**: `<ActionPin>` renders the visible label internally for
      both `size="pin"` (external below) and `size="full"` (inline).
      Slot's external `<span>` is removed — no duplicate labels in DOM.
- [ ] **AC12**: `<ActionPin>` `isBusy` and `disabled` are orthogonal:
      both block `onPress`; `aria-busy` fires only when `isBusy=true`.
- [ ] **AC13a**: New Playwright visual baselines for `/exercises`
      desktop + minipay added (creations, not replacements).
- [ ] **AC13b**: No DOM-snapshot test regression on existing primitive
      consumers (`/hub`, `/arena`, `/landing`). If class-merge order
      shifts but rendered pixels stay, re-snapshot.
- [ ] **AC14**: Full unit + E2E suites green; no Playwright visual
      regression on `/hub` or `/arena`.

## Test plan

### `<ActionPin>` test matrix (~22 tests minimum)

`apps/web/src/components/redesign/__tests__/action-pin.test.tsx`:

1. Renders for each of 6 actions × 2 sizes (12 tests, asserts
   `data-component="action-pin"` + correct icon + correct label
   placement).
2. `tone="claim"` applies `candy-frame candy-frame-gold` (1 test).
3. `tone="default"` applies the per-action gradient classes (1 test,
   parameterized for one representative action).
4. `badge.pin` renders at `-right-1 -top-1` on `size="pin"` (1 test).
5. `badge.full` renders inline `ml-1` on `size="full"` (1 test).
6. `badge.pin` is ignored on `size="full"`, and vice versa (1 test).
7. `isBusy=true` shows the spinner, hides the icon, sets
   `aria-busy="true"`, blocks `onPress` (1 test).
8. `disabled=true` sets the button `disabled` attribute, applies
   `is-disabled`, blocks `onPress`, does NOT set `aria-busy` (1 test).
9. `onPress` fires once on tap; haptic-tap fires alongside
   (mirrors `<PrimaryPlayCta>` pattern) (1 test).
10. `atmosphere="adventure"` is the default; `atmosphere="scholarly"`
    swaps the modifier class (1 test).
11. `className` merges with the base classes without breaking the
    canonical class list (1 test).
12. Decorative icons inside the button are `aria-hidden="true"` —
    button name owns the label (1 test).

### Existing primitive coverage (deltas)

- `mission-ribbon.test.tsx`: add tests for `surface="exercises"`
  (default copy fallback) + `text` override prop (renders override,
  preserves aria-label) — 3 new tests.
- `primary-play-cta.test.tsx`: untouched. PrimaryPlayCta is not
  modified in M1.

### Integration

`exercises-screen.test.tsx` does NOT exist today. M1 defers integration
testing to E2E + visual regression (per CLAUDE.md "no tests
automatizados por ahora" carryover and "max 30 tasks per session"
guardrail).

### Visual regression

Two new Playwright baselines (creations, not replacements):

- `/exercises` desktop viewport
- `/exercises` minipay viewport (390px)

`/hub` and `/arena` baselines unchanged.

## Out of scope (deferred to later M-tasks)

- Editorial micro-copy sweep (M4): the 22-word retry-shield shop
  subtitle and similar long strings.
- Rowdies coverage audit (M6): runs in parallel.
- `<HelpChip>` introduction (M4).
- Designing `<CandyCard>` (the actual card primitive that
  `<CandyBanner>` is NOT — see v1 red-team P0 — covered in revised M2
  spec).

## Open questions (all resolved)

1. **Slot is layout shell, primitive is visual atom** ✅
2. **Mission-panel density** — deferred to TDD screenshot review on
   the ribbon-row commit. If the panel cannot accommodate the ribbon
   at all, the spec falls back to a tooltip-on-tap pattern; that
   becomes a v1.4 patch.
3. **`exercises-screen.test.tsx` does not exist** ✅ — M1 defers to
   E2E + visual.
4. **`<PrimaryPlayCta>` is sprite-driven** ✅ (v1.2 pivot to
   `<ActionPin>`).
5. **`<MissionRibbon>` lacks copy prop** ✅ (v1.3 P0 fix: add `text?`).
6. **`<ActionPin>` `isBusy` vs `disabled`** ✅ (v1.3 P0 fix:
   orthogonal).
7. **Atmosphere day-1 on ActionPin** ✅ (v1.3 P1 fix: included).
8. **Badge per-mode content shape** ✅ (v1.3 P1 fix:
   `{pin?, full?}`).
9. **Label render ownership** ✅ (v1.3 P1 fix: primitive always
   renders).
10. **Test matrix size** ✅ (~22 tests enumerated).
11. **Primitive location** ✅ (`components/redesign/action-pin.tsx`).
12. **Naming** ✅ (`<ActionPin>` over `<SlotCta>`).
13. **Compact-vs-full mode resolution** ✅ (orchestrator-side
    `compact?: boolean` prop on `<ContextualActionSlot>`, unchanged
    from today).

## PR shape (final)

Single PR. 8 commits, all atomic:

1. `feat(redesign): introduce <ActionPin> primitive with full test matrix`
2. `feat(pro-mission): add text override prop + exercises surface to MissionRibbon`
3. `feat(editorial): add MISSION_RIBBON_COPY.exercises fallback string`
4. `refactor(exercises): adopt HudResourceChip for shield count`
5. `refactor(exercises): wire pieceHint via MissionRibbon row in mission panel`
6. `refactor(exercises): migrate ContextualActionSlot to <ActionPin> (all 6 actions)`
7. `test(e2e): create /exercises desktop + minipay visual baselines`
8. `chore(spec): mark M1 v1.3 SHIPPED in spec status`

`<PrimaryPlayCta>` is NOT extended in M1. The dominant CTA primitive
stays untouched.

LOC delta: ~400 net (revised up from v1.2's ~350 because the test
matrix is larger and the `<MissionRibbon>` extension added 3 tests).

## Verdict

v1.3 consolidates v1.1 + v1.2 + red-team v2 prescriptions. No new
primitive contract surface introduced beyond what red-team v2
prescribed.

**Optional red-team v3** before /tdd: only required if the consumer
(human reviewer or another agent) wants confirmation that the
consolidation didn't introduce drift. Otherwise READY for /tdd from
Fase B with the new commit ordering.
