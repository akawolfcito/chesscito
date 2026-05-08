# M1 spec — v1.4 PATCH (post-TDD discovery on commit 4)

**Date**: 2026-05-08 (mid-TDD on commit 4)
**Status**: NEEDS RED-TEAM (or fast-confirm sign-off if user prefers)
**Parent**: `2026-05-08-m1-exercises-migration-design-v1.3.md`
**Trigger**: TDD on commit 4 (`refactor(exercises): adopt HudResourceChip
for shield count`) discovered that v1.3 §"Behavior 1" + §"Behavior 3"
both assume a panel structure that does not exist in
`<MissionPanelCandy>` today.

## Discovery

### What v1.3 says

- §"Primitive adoption map" — `Before: inline shield chip in mission
  panel` / `After: <HudResourceChip ...>` for shield count.
- §"Behavior 1" — "shield count rendering inside `<MissionPanelCandy>`
  is **replaced** with `<HudResourceChip ...>`".
- §"Behavior 3" — "ribbon row is added... **between the chip row and
  the board**".

### What the codebase says

`apps/web/src/components/exercises/mission-panel-candy.tsx` has the
following row order:

1. `<ContextualHeader>` (Z2 — title + subtitle + piece picker trigger)
2. `<MissionDetailSheet>` trigger button row (chip-like but it's the
   mission objective peek, not a shield chip) + `exerciseDrawer` slot
3. *(optional)* L2 labyrinth toggle
4. *(optional)* `headerSlot` (e.g., Daily Tactic mini)
5. Board stage (`<Board>`)
6. Contextual action row (the slot pin)
7. Persistent dock

The shield count (`shieldCount` from `exercises-screen.tsx:278`) is
**not rendered inline anywhere in the panel**. It is consumed only by:

- `<ContextualActionSlot shieldsAvailable={shieldCount}>` — slot's
  `+N` floating amber badge on the useShield button, visible **only
  during phase=failure**.
- Auto-reset timer logic (`shieldCount > 0 ? 6_000 : 1_500`).

There is no "chip row" in the panel today.

### Implication

AC1 in v1.3 is an **ADD**, not a **REPLACE**. The shield chip will be
NEW UI on `/exercises`. AC4's ribbon-row placement ("between the chip
row and the board") presupposes the chip row that this patch creates.

This is the same class as v1.1/v1.2/v1.3 prior patches (assumption
about existing UI that's not actually there). Caught during TDD
because §"Open question §2" — mission-panel density — was deferred to
"first PR review screenshot".

## v1.4 patch — recommended path

### Replace v1.3 §"Behavior 1" with:

> **Shield chip ADD**. A `<HudResourceChip tone="default" icon="shield"
> value={shieldCount} ariaLabel={...}>` is **inserted** as a new
> standalone row inside `<MissionPanelCandy>`, immediately AFTER the
> `<MissionDetailSheet>` trigger row (between row 2 and the optional
> L2 toggle). The chip is right-aligned within a horizontally-padded
> container (`mx-2 mt-1 flex justify-end`). It is rendered
> unconditionally — `value={0}` is acceptable and matches the
> primitive's empty-state styling. Visual parity target: the
> persistent shield chip on `/hub`'s `<HudSecondaryRow>`.

### Replace v1.3 §"Behavior 3" with:

> **`pieceHint` ribbon row ADD**. A `<MissionRibbon
> surface="exercises" text={pieceHint}>` is **inserted** as a new
> standalone row inside `<MissionPanelCandy>`, immediately AFTER the
> shield chip row (i.e., between the new chip row and the optional L2
> toggle row). When `pieceHint` is undefined, the ribbon falls back to
> `MISSION_RIBBON_COPY.exercises`. The row is rendered unconditionally;
> the ribbon is dense per its `surface="exercises"` modifier (CSS
> tightening lives in globals.css per UX-spec — not added in this
> commit, deferred to a CSS-only follow-up if visual review demands).

### Prop wiring update

`<MissionPanelCandy>` needs two new props:

```ts
type MissionPanelProps = {
  // ... existing props
  /** Live shield count from `readDisplayedShields()`. Rendered by the
   *  new chip row inserted between the mission-detail row and the
   *  L2 toggle. Pass `0` when shields-shop is unavailable. */
  shieldCount: number;
  // pieceHint?: string;  ← already exists as dead prop, now wired live
};
```

`exercises-screen.tsx` passes `shieldCount={shieldCount}` to the panel
component. `pieceHint` was already passed in v1.0 — no callsite change
needed beyond ensuring the value is computed for all 6 pieces (already
true: `exercises-screen.tsx:1219` computes pieceHint per selectedPiece).

### Acceptance criteria delta

- AC1 → "**`<HudResourceChip>` is rendered as a new persistent row
  inside `<MissionPanelCandy>`** between the mission-detail row and
  the L2 toggle. Sourced from `readDisplayedShields()` via the new
  `shieldCount` prop on the panel. Visual parity with `/hub` shield
  chip."
- AC4 → "**`<MissionRibbon surface="exercises" text={pieceHint}>` is
  rendered as a new persistent row inside `<MissionPanelCandy>`**,
  AFTER the shield chip row and BEFORE the optional L2 toggle row.
  The previously dead `pieceHint` prop is now wired live."
- AC1b NEW: "`<MissionPanelCandy>` accepts a new `shieldCount: number`
  prop. `exercises-screen.tsx` passes the live `shieldCount` state."

All other ACs (AC2, AC3, AC5-AC14) carry forward unchanged.

### PR shape

No changes — same 8 commits. Commit 4 still introduces the chip; commit
5 still wires the ribbon row. The interpretation shifts from "refactor
to" to "introduce as new row".

For commit-message clarity, suggest renaming:

- Commit 4 (was `refactor`) → `feat(exercises): add HudResourceChip
  shield row to MissionPanelCandy`
- Commit 5 (was `refactor`) → `feat(exercises): add MissionRibbon
  pieceHint row to MissionPanelCandy`

Both `feat`s, since they are NEW UI on `/exercises`, not refactors.

## Open question for red-team v4 (optional)

1. Should the shield chip be **conditionally rendered** (only when
   `shieldCount > 0`) or **always rendered** (`value={0}` when empty)?
   Strong lean: always rendered, because: (a) parity with /hub which
   shows `0` shields without hiding the chip, (b) user discoverability
   (player learns the resource exists), (c) avoids layout jump when
   shieldCount transitions 0↔1. Lock this in v1.4 unless red-team
   objects.

2. Should the chip be left-aligned, right-aligned, or full-width?
   Strong lean: right-aligned (`flex justify-end`). Reasoning: the
   left side of the panel below the header is occupied by the
   mission-detail trigger and the L2 toggle when present. A
   right-aligned shield chip mirrors the upper-right placement on
   /hub's HudSecondaryRow.

## Verdict (self)

This patch resolves the §"Behavior 1+3" panel-structure assumption.
The fix is small (placement decisions + one new prop on
MissionPanelCandy). No new primitive contract surface — `<ActionPin>`,
`<MissionRibbon>`, and `<HudResourceChip>` all stay locked at v1.3.

**Risk profile**: low. The decisions (always-render, right-aligned,
between rows 2 and 3) follow /hub canon directly.

**Proposal**: fast-confirm sign-off OR red-team v4 narrowly scoped to
the placement decisions only. User picks.
