# M1 spec — v1.2 PATCH (post-SDD discovery, pre-TDD)

**Date**: 2026-05-08 (next session, post Phase A SDD)
**Status**: NEEDS RED-TEAM (not READY for /tdd until red-team re-passes)
**Parent**: `2026-05-08-m1-exercises-migration-design.md` (v1.1)
**Trigger**: SDD phase A discovered that `<PrimaryPlayCta>`'s actual API
contradicts the spec's assumed extension surface. Same class of error as
the CandyBanner-no-es-card discovery from the parent audit.

---

## Discovery

The spec v1.1 §"Primitive extensions" describes `<PrimaryPlayCta>` as a
generic button primitive with:

```ts
type PrimaryPlayCtaProps = {
  surface, size, tone?, badge?, label, sublabel, onPress, disabled, isLoading
};
```

The actual primitive at `apps/web/src/components/kingdom/primary-play-cta.tsx`:

```ts
type Props = {
  surface: PrimaryPlayCtaSurface;  // 5 fixed values
  label: string;
  ariaLabel: string;
  atmosphere?: "adventure" | "scholarly";
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};
```

The implementation is **sprite-asset-driven**. Each surface is bound to a
`backplate` PNG (`principalbutton` / `btn-stone-bg`) and an `icon` PNG
(`btn-battle` / `btn-play`), rendered as `<picture>` with AVIF/WebP/PNG
fallbacks. There is no `size`, no `tone`, no `badge`, no `sublabel`. The
primitive is used in exactly 4 surfaces: `hub-scaffold` (PLAY),
`arena-select-scaffold` (START), `landing-hero`, `landing-final-cta`.

This is the same architectural class as `<CandyBanner>` — both are
**sprite-asset renderers**, not generic atoms.

## Why this blocks v1.1 → /tdd

The Phase B/G commits in the v1.1 PR shape (`extend PrimaryPlayCta with
size="pin" + badge slot + tone variants` → migrate slot to
`<PrimaryPlayCta size="pin">`) cannot be implemented as written. The
options are all worse than rebasing:

- **(a) Add 3 new sprite-asset pairs** for exercises-failure /
  exercises-success / exercises-system + a candy-frame-gold backplate
  for `tone="claim"`. Requires art assets that don't exist.
- **(b) Make `<PrimaryPlayCta>` dual-mode** (sprite-driven for hub/arena/
  landing, CSS-driven for exercises). Doubles the primitive's surface
  area; muddles its single-purpose role as the "dominant kingdom CTA".
- **(c) Build a new primitive `<SlotCta>` (or `<ActionPin>`)** owning the
  44×44 pin / 52px full grammar that the contextual slot uses today.
  Keeps each primitive single-purpose: PrimaryPlayCta = dominant CTA;
  SlotCta = contextual action atom.

## v1.2 patch — recommended path

**Option (c): build `<SlotCta>` as a new primitive.** This patches the spec
as follows:

### Replace v1.1 §"Primitive extensions" — `<PrimaryPlayCta>` block

Remove the entire `<PrimaryPlayCta>` extension (size="pin", tone="claim",
badge slot, 3 new surfaces). PrimaryPlayCta stays untouched in M1.

### Add v1.2 §"New primitive — `<SlotCta>`"

```ts
// apps/web/src/components/exercises/slot-cta.tsx (NEW)

export type SlotCtaAction =
  | "submitScore" | "useShield" | "claimBadge"
  | "retry" | "connectWallet" | "switchNetwork";

export type SlotCtaSize = "pin" | "full";  // 44×44 circle | 52px full-width
export type SlotCtaTone = "default" | "claim";  // default | candy-frame-gold

type Props = {
  action: SlotCtaAction;
  size: SlotCtaSize;
  tone?: SlotCtaTone;
  label: string;
  ariaLabel: string;
  /** Optional floating badge — renders at -right-1 -top-1 on size="pin",
   *  inline ml-1 on size="full". Used today by useShield. */
  badge?: ReactNode;
  onPress: () => void;
  isBusy?: boolean;
  className?: string;
};
```

Visual atoms migrated INTO `<SlotCta>`:
- `game-cta-depth` + per-action gradient (`var(--cta-{brand,reward,...}-{from,to,glow})`)
- `candy-frame candy-frame-gold` for `tone="claim"`
- 44×44 `rounded-full` for `size="pin"`; `52px rounded-2xl` for `size="full"`
- Spinner (`animate-spin`) when `isBusy`
- CandyIcon mapping per action (existing `ACTION_ICON` table)

Visual atoms that stay in `<ContextualActionSlot>` (the orchestrator):
- which-action-to-show dispatch logic
- compact-vs-full mode resolution
- entrance animations (`animate-in fade-in zoom-in-95 duration-200` for
  pin, `animate-in fade-in slide-in-from-bottom-2 duration-200` for full)
- handler routing
- 6s shield window timer (lives in `exercises-screen.tsx`, unchanged)

### Replace v1.1 §"Behavior 2"

The 6-action mapping becomes:

| Action | size | tone | Notes |
|---|---|---|---|
| retry | pin (or full per compact prop) | default | — |
| useShield | pin / full | default | + `badge={shieldsAvailable}` |
| submitScore | pin / full | default | — |
| claimBadge | pin / full | claim | candy-frame-gold preserved |
| connectWallet | pin / full | default | — |
| switchNetwork | pin / full | default | — |

### Replace v1.1 §"PR shape"

```
- feat(pro-mission): add exercises surface to MissionRibbon
- feat(editorial): add CTA labels for exercises slot actions
- feat(exercises): introduce <SlotCta> primitive (new component + tests)
- refactor(exercises): adopt HudResourceChip for shield count
- refactor(exercises): wire pieceHint via MissionRibbon row
- refactor(exercises): migrate ContextualActionSlot to <SlotCta> (all 6 actions)
- test(e2e): create /exercises desktop + minipay visual baselines
```

`<PrimaryPlayCta>` extension commit is dropped. `<SlotCta>` introduction
commit is added. Net commit count: 7 (down from 8).

LOC delta: similar to v1.1 (~350 net), but now CONCENTRATED in a new
component file rather than spreading variant logic into PrimaryPlayCta.

### Acceptance criteria delta

- AC2 → "All 6 contextual-slot actions render as `<SlotCta>` with the
  size + tone mappings in §"Behavior 2"."
- AC3 → "claimBadge keeps its candy-frame-gold visual via `tone="claim"`
  on `<SlotCta>`."
- AC5 → DROP. PrimaryPlayCta is not extended in M1.
- AC5b NEW: "`<SlotCta>` primitive exists with the contract above and
  unit-test coverage matching `<PrimaryPlayCta>`'s test depth (rendering,
  states, badge slot, atmosphere, className merge)."
- AC9 → "Floating shield-count badge is the `<SlotCta>` `badge` prop. No
  badge rendering remains in `<ContextualActionSlot>`."
- AC10 → unchanged (slot owns entrance animations, primitive owns state).

All other ACs (AC1 chip migration, AC4 ribbon row, AC6 ribbon surface,
AC7 editorial, AC8 6s window, AC11a/b regression) carry forward
unchanged.

## Open questions for red-team v2

1. Should `<SlotCta>` live at `components/exercises/slot-cta.tsx` (consumer-
   adjacent) or `components/redesign/slot-cta.tsx` (with the candy-system
   primitives)? Strong lean: redesign/, since the slot grammar is shared
   visual vocabulary, not exercises-specific. But naming the file
   `slot-cta.tsx` outside the exercises folder may suggest broader reuse
   than v1 supports. Decision deferred to red-team.
2. Should `<SlotCta>` support `atmosphere?: "adventure" | "scholarly"`
   from day-1 (matching the other primitives) or stay adventure-only
   for v1? Strong lean: adventure-only — no Scholarly slot consumer
   exists. Add atmosphere when one appears.
3. Does the new primitive require its own visual baseline in
   `visual-regression.spec.ts`? Strong lean: yes, but bundled with the
   `/exercises` baselines (slot is rendered there). Standalone Storybook-
   style baseline deferred until candy-shell-previews picks it up.

## Verdict (self)

This patch resolves the v1.1 sprite-vs-generic primitive confusion. The
slot becomes the orchestrator and `<SlotCta>` becomes the visual atom —
mirroring the relationship `<HubScaffold>` has with `<PrimaryPlayCta>`.

Re-run red-team against this v1.2 patch as a delta. If red-team passes,
v1.3 RFC = v1.1 spec + v1.2 patch merged, and /tdd resumes from Phase B
with the new commit ordering.
