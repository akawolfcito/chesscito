# Red Team Review — M1 `/exercises` migration v1.2 patch (v2)

**Date**: 2026-05-08
**Reviewer mindset**: hostile QA + senior engineer, mirroring v1 red-team rigor.
**Spec under review**: `docs/superpowers/specs/2026-05-08-m1-exercises-migration-design-v1.2-patch.md`
**Parent**: `docs/superpowers/specs/2026-05-08-m1-exercises-migration-design.md` (v1.1)
**Prior round**: `docs/superpowers/specs/2026-05-08-m1-exercises-migration-redteam.md` (v1)

The v1.2 patch correctly identifies the `<PrimaryPlayCta>` sprite-asset
class error and pivots to a new `<SlotCta>` primitive. The pivot is
sound. **But the patch carries forward an undiscovered P0 from v1.1
about `<MissionRibbon>` and ships several contract gaps in the new
primitive's API.**

---

## Findings

### P0 — Must address before /tdd v1.3

- **[contract/missing-prop] `<MissionRibbon>` does NOT accept a copy
  prop — its copy is hardcoded via `MISSION_RIBBON_COPY[surface]`.**
  Verified at `apps/web/src/components/pro-mission/mission-ribbon.tsx:46`:
  the primitive renders `{MISSION_RIBBON_COPY[surface]}` directly.
  There is no `children`, no `text`, no `copy` prop. v1.1 §"Editorial
  deltas" claimed `pieceHint` is "fed to the ribbon as a prop". v1.2
  carries that forward unchanged ("AC4 ribbon row…unchanged"). Neither
  version inspected the primitive's API.

  **What this breaks**: AC4 cannot be implemented as written. Adding
  `surface="exercises"` to `MISSION_RIBBON_COPY` requires either (a) a
  single static string (which defeats per-piece-hint semantics), or (b)
  extending `MissionRibbon` with a copy override prop (a NEW primitive
  extension absent from the spec).

  **Fix**: add §"`<MissionRibbon>` extension" to v1.2 patch — either a
  `children?: ReactNode` slot OR `text?: string` override prop, with a
  fallback to `MISSION_RIBBON_COPY[surface]` when omitted. Spec the
  merge order, ARIA semantics (currently `aria-label={MISSION_RIBBON_COPY.ariaLabel}`),
  and add a unit test for the override path. Without this, AC4 dies in
  TDD red phase. **Same class as the v1 CandyBanner-no-es-card
  discovery** — assumption about a primitive's API that doesn't match
  reality.

- **[contract/missing] `<SlotCta>` API omits `disabled` separate from
  `isBusy`.** The current slot uses `disabled={isBusy}` but the wider
  primitive ecosystem (`PrimaryPlayCta`, `HudResourceChip`) splits
  `loading`/`disabled` into two semantically-distinct props. v1.2's
  `SlotCta` only declares `isBusy`.

  **What this breaks**: a pure-`disabled` state (e.g., `connectWallet`
  while a parent gate is computing) has no representation, and
  `aria-busy=true` would fire incorrectly for a non-loading disabled
  state.

  **Fix**: split `isBusy?: boolean` and `disabled?: boolean` mirroring
  the `PrimaryPlayCta` contract. Wire `aria-busy` to `isBusy` only.

### P1 — Should address

- **[contract/atmosphere-decision] Open question §2 punts `atmosphere`
  but the existing primitive baseline (`PrimaryPlayCta`,
  `MissionRibbon`, `HudResourceChip`) all accept `atmosphere?:
  "adventure" | "scholarly"`.** Skipping it on `<SlotCta>` for v1
  creates a primitive-canon inconsistency. Future "add atmosphere when
  a Scholarly slot consumer appears" means a breaking-prop rev to every
  existing call site.

  **Fix**: include `atmosphere?: Atmosphere` from day-1, default
  `"adventure"`, and emit `is-atmosphere-{value}` class as canon. Zero
  runtime cost; preserves grammar.

- **[contract/badge-positioning-collision] `badge?: ReactNode` at
  `-right-1 -top-1` (pin) and `inline ml-1` (full) hard-codes
  positioning logic into the primitive.** Today's `useShield` badge is
  amber-pill text (`shieldsAvailable` raw on pin,
  `FOOTER_CTA_COPY.shieldsLeft(n)` formatted on full) — they're
  different content shapes per mode. v1.2 elides this by saying "badge
  prop" but doesn't spec the per-mode content delta.

  **Fix**: spec it explicitly — either `badge: { compact: ReactNode;
  full: ReactNode }` OR document that callers pass mode-aware content
  via `compact` prop on the slot side. Lock the contract in §"New
  primitive".

- **[contract/label-vs-arialabel-redundancy] `<SlotCta>` requires both
  `label` AND `ariaLabel` — but on `size="pin"` the visible label is
  rendered EXTERNAL by the orchestrator (slot), not by the primitive.**
  Current slot: `<button aria-label={label}>` + sibling `<span>{compactLabel}</span>`
  outside. v1.2's `SlotCta` props don't say which mode owns the label
  render.

  **Fix**: explicitly specify — `size="pin"` renders no visible label
  (slot owns the external `<span>`), `size="full"` renders inline
  label. Or: `<SlotCta>` always renders the label and orchestrator-side
  `<span>` is dropped. Pick one; otherwise TDD will produce a
  duplicate-label bug.

- **[test/coverage-claim] AC5b says "test depth matching
  `<PrimaryPlayCta>`'s test depth".** Verified
  `primary-play-cta.test.tsx`: 13 tests covering 5 surfaces × {render,
  aria, onPress, haptics, loading, disabled, atmosphere×2,
  className-merge, decorative-img-aria}. `<SlotCta>` has 6 actions × 2
  sizes × 2 tones × badge × isBusy × disabled × atmosphere —
  combinatoric surface ~3-4× larger. "Matching depth" is undefined.

  **Fix**: enumerate the actual SlotCta test matrix in spec — minimum:
  per-action (6) × per-size (2) renders + tone="claim" candy-frame
  assertion + badge slot positioning per mode + isBusy spinner +
  onPress fires + disabled blocks + className merge. **~20 tests
  minimum.**

- **[location/decision] Patch defers `components/exercises/` vs
  `components/redesign/`.** Defer is unacceptable because TDD commit
  ordering depends on the path. Strong position:
  **`components/redesign/slot-cta.tsx`**. Reasoning: the slot grammar
  (game-cta-depth + per-action gradients + candy-frame-gold) IS the
  candy-system canon vocabulary; placing it under `exercises/`
  ghettoizes a primitive that is conceptually shared. The
  `<ContextualActionSlot>` orchestrator stays under `exercises/` (it
  IS exercises-specific). Naming asymmetry is fine — primitive in
  canon folder, orchestrator next to its consumer.

### P2 — Nice to clarify

- **[naming] `<SlotCta>` reads OK but couples the primitive to its
  current consumer ("the slot").** `<ActionPin>` reads truer to the
  visual atom (44×44 pin OR 52px full action button) and is
  consumer-agnostic. Strong lean: **`<ActionPin>`** — but no
  engineering signal blocks `<SlotCta>`; defer to author preference if
  v2 review is the only blocker.

- **[pr-shape] 7 commits, atomic, each independently testable.**
  Verified by walking the order: ribbon-surface → editorial → SlotCta
  primitive (introduces + tested) → chip refactor → ribbon-row wire →
  slot migration → e2e baselines. Reorderable: chip refactor and
  ribbon-row wire are independent and could swap. Slot migration MUST
  be last refactor commit (depends on SlotCta + editorial). PR shape
  OK.

- **[visual-baseline] Q3 — bundle SlotCta baseline with `/exercises`
  baselines.** Correct. Standalone Storybook deferral is fine.

---

## Categories audited

**Contract gaps**: P0 on MissionRibbon (no copy prop), P0 on SlotCta
disabled split, P1 on atmosphere/badge-positioning/label-vs-ariaLabel.
Patch covers tone/size/badge surface but misses orthogonal disabled
state and the orchestrator-owns-label resolution.

**Hidden assumptions**: The v1.2 patch IS itself a fix for a v1.1 hidden
assumption (PrimaryPlayCta-is-generic). It successfully avoids new
sprite-asset-driven assumptions. But it inherits v1.1's
`<MissionRibbon>`-takes-prop assumption — same class as the v1
CandyBanner-no-es-card discovery.

**Behavioral ambiguity**: Animation ownership is crisp (slot owns
layout, primitive owns state — carried from v1.1). 6s window stays in
`exercises-screen.tsx` (correct). Compact-vs-full mode resolution:
unclear who chooses — `compact` prop on slot? A media query? Spec is
silent. Resolve before TDD.

**Test coverage gaps**: AC5b "matching PrimaryPlayCta depth" is
undefined (P1). Verified that PrimaryPlayCta has 13 tests — SlotCta
needs ~20 minimum given larger combinatoric surface.

**Visual regression risk**: Ribbon copy prop addition (if accepted as
P0 fix) touches the existing primitive's class merge logic minimally.
AC11b carries forward correctly.

**Operational readiness**: PR shape (7 commits) is atomic and
re-orderable within the constraint that SlotCta primitive lands before
slot migration. Blocking factors: P0 ribbon contract gap, P0 disabled
split, location decision.

**Primitive boundary / file location**: Locked above — primitive in
`components/redesign/`, orchestrator stays in `components/exercises/`.

**Naming**: `<SlotCta>` acceptable; `<ActionPin>` superior. No P0/P1
blocker.

---

## Verdict

**NEEDS REVISION (P0 × 2) — do NOT proceed to /tdd until patched.**

Required revisions before v1.3 merge:

1. **Add §"`<MissionRibbon>` extension"** to v1.2 patch specifying a
   copy-override prop (`children` or `text`), update AC4 + AC6 to
   reflect the primitive change, and add a unit test for the override
   path. This is a v1.1-carryover P0 surfaced by re-reading the actual
   primitive.
2. **Split `<SlotCta>` `isBusy` and `disabled` props** in §"New
   primitive — `<SlotCta>`". Mirror `PrimaryPlayCta` semantics. Wire
   `aria-busy` to `isBusy` only.
3. Resolve the 4 P1 contract specifics (atmosphere day-1, badge
   per-mode content, label-vs-ariaLabel render ownership, test matrix
   enumeration with concrete count).
4. Lock the primitive location in
   `components/redesign/slot-cta.tsx` — close open question §1.
5. Resolve compact-vs-full mode-resolution ownership (slot prop?
   viewport? — silent today).

After these revisions, v1.3 RFC = v1.1 + v1.2 + this red-team's patches
merged. Re-run red-team v3 only if any P0 changes the primitive
contract surface again; otherwise READY for /tdd.

**No fundamental flaw — the SlotCta pivot is the right architectural
call.** It mirrors the PrimaryPlayCta-is-sprite-renderer pattern
correctly: each primitive stays single-purpose. The patch's authoring
discipline ("re-run red-team against v1.2 as a delta") is exactly what
caught the v1 issues; same discipline catches these v2 issues.
