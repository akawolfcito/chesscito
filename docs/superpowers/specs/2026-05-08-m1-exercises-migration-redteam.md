# Red Team Review — M1 `/exercises` migration (v1)

**Date**: 2026-05-08
**Reviewer mindset**: hostile QA + senior engineer. Adapted Sally
voice — less storyteller, more critic — for spec adversarial review.
**Spec under review**: `2026-05-08-m1-exercises-migration-design.md`

The audit underneath this red-team revealed that **the parent
audit doc itself rests on misidentified primitives**. Findings
range from "spec assumes a component that doesn't exist" to "the
canonical card primitive is not what we thought it was". M1 is
salvageable but needs spec revision; M2/M3 in the parent audit
need correction too.

---

## Findings

### P0 — Must address before TDD

- **[primitive/misidentification] `<CandyBanner>` is NOT a card
  primitive — it is a button-sprite renderer.** I assumed
  `<CandyBanner>` was the card-shape primitive that the parent
  audit said to "evolve into FrameCraftCard". Reading
  `apps/web/src/components/redesign/candy-banner.tsx` the
  truth is harsh: CandyBanner accepts a `name` prop (`"btn-back"`
  / `"btn-battle"` / `"btn-claim"` / `"btn-play"` / `"btn-resign"`
  / `"btn-undo"`) and renders a `<picture>` element with
  AVIF/WebP/PNG fallbacks for that filename. It is **a sprite-
  asset renderer for button images**, not a content card.
  The "76 files using CandyBanner" cited in my audit are using
  it as a button-icon, not as a card.

  **What this breaks**: The parent ux-design-specification.md says
  "FrameCraftCard is the evolution of `<CandyBanner>`". That is
  semantic confusion — there is no card primitive in the project
  today. It is an unfilled hole.

  **Why blocking M1 specifically**: M1 doesn't reference
  CandyBanner, so M1 isn't directly broken. But the audit doc that
  M1 lives under tells the wrong story about M2/M3, which sets up
  bad downstream specs.

  **Fix**: Add an audit-doc correction first: explicitly mark
  `<CandyBanner>` as button-sprite-renderer, NOT a card primitive.
  Then rename M2 from "extend CandyBanner" to "build the card
  primitive" — the project genuinely needs one. Rebrand it as
  `<CandyCard>` or similar (clearly distinct from CandyBanner).

- **[behavior/missing-target] M1 references a `<TutorialBanner>`
  that does not exist in the codebase.** Spec §"Behavior 3" says
  the tutorial banner is wrapped by `<MissionRibbon>`. There is
  no `<TutorialBanner>` component. The closest analog is
  `<MissionPanelCandy>`'s `pieceHint?: string` prop, which is
  **defined but never rendered** inside the panel body (grep
  confirms: `pieceHint` appears once in the typedef, zero times
  in the component body).

  **What this breaks**: TDD on AC3 has nowhere to land — the
  tests would assert that ribbon wraps a banner that has no DOM
  home today. The migration would be implementing-something-new,
  not migrating-existing.

  **Fix**: Either (a) reframe AC3 as "introduce a per-piece
  `<MissionRibbon>` row in `<MissionPanelCandy>` rendering
  `pieceHint`, with copy from MISSION_RIBBON_COPY.exercises", or
  (b) drop AC3 from M1 entirely and pair it with a separate
  spec that designs the tutorial-banner UX from scratch. Strong
  recommendation: (a) — keeps M1 cohesive.

- **[behavior/incomplete-coverage] `<ContextualActionSlot>` has 6
  actions; M1 only migrates 2.** The slot dispatches to:
  `submitScore`, `useShield`, `claimBadge`, `retry`,
  `connectWallet`, `switchNetwork`. Each has its own styling —
  including a special `"candy-frame candy-frame-gold action-pin-
  attention"` treatment for `claimBadge`. M1 spec only addresses
  the failure-state paths (retry, useShield). After M1, **half the
  slot still ships legacy treatments** while the other half uses
  `<PrimaryPlayCta>`. That defeats the "one primitive grammar"
  goal at the slot level — same surface, two dialects, one
  conditional render away from each other.

  **What this breaks**: The user's "parchado" experience returns
  on /exercises the moment they win an exercise (submitScore) or
  claim a badge (claimBadge). The migration claims success while
  visually the surface is still split.

  **Fix**: Either (a) extend M1 to migrate all 6 slot actions,
  not just retry/useShield, or (b) explicitly scope M1 as "failure
  path only" and add a follow-up M1.5 spec for success/claim
  paths. Strong recommendation: (a) — slot is small enough that
  splitting feels artificial. The `claimBadge` candy-frame
  treatment specifically deserves promotion to a primitive
  variant or an explicit `tone="claim"` on PrimaryPlayCta, not
  preservation as a one-off.

### P1 — Should address

- **[layout/sizing] `<ContextualActionSlot>`'s `compact` variant
  is `h-11 w-11` (44×44px circular pin).** The slot's compact
  mode does not render a horizontal CTA — it renders a circular
  button with an external label below. `<PrimaryPlayCta>` was
  specced for full-width `text-2xl` rectangles. The compact
  primitive variant must match the 44×44 circular footprint
  used by the slot, including the floating shield-count badge
  positioned at `-right-1 -top-1` on the button. The current
  PrimaryPlayCta size variants (`md` | `compact`) likely don't
  cover this. Risk: TDD discovers PrimaryPlayCta needs a third
  `size="pin"` variant or a layout escape hatch.

  **Fix**: Spec needs a §"Primitive extensions" section that
  enumerates the new variants on PrimaryPlayCta required by M1
  (`size="pin"` with circular layout + floating-badge slot).
  Without this, TDD writes the wrong tests.

- **[animation/coupling] Slot animations live in slot, not
  primitives.** The compact pin renders with `animate-in fade-in
  zoom-in-95 duration-200`; the full pin uses `animate-in fade-in
  slide-in-from-bottom-2 duration-200`. After migration, who owns
  the entrance animation — the slot wrapper or the
  `<PrimaryPlayCta>` itself? If the primitive owns it, every
  surface inherits it; if the slot keeps it, primitives stay
  pure. Spec is silent.

  **Fix**: Decide explicitly. Strong recommendation: slot keeps
  layout animations (it's the orchestrator); primitive owns
  internal state animations (pulse, press-down).

- **[shield-badge/responsibility] The "+3" floating amber badge
  at top-right of the useShield button is rendered by the slot,
  not the primitive.** Lines 113-120 of contextual-action-slot.tsx
  render this conditionally. M1 spec doesn't say where this lives
  post-migration. Same coupling question as the animation.

  **Fix**: Spec the badge as a slot of `<PrimaryPlayCta>` (e.g.,
  `badge?: ReactNode` prop) so it stays primitive-internal, OR
  keep it in the slot and document it as the slot's responsibility.
  Strong recommendation: primitive prop — keeps the surface clean
  in `exercises-screen.tsx`.

- **[copy/awkward-mapping] `MISSION_RIBBON_COPY.exercises` per-
  piece is awkward.** The ribbon was specced as a single mission
  statement (academia-viva). Per-piece tutorial copy isn't a
  mission statement — it's an ephemeral instruction ("the rook
  moves in straight lines"). Forcing TUTORIAL_COPY through
  MISSION_RIBBON_COPY mixes two different content types under one
  surface key.

  **Fix**: Either (a) introduce a separate `EXERCISE_HINT_COPY`
  surface for ribbon, or (b) reuse `pieceHint` as the source and
  drop the per-piece map entirely. Strong recommendation: (b) —
  pieceHint is already computed in exercises-screen.tsx:1219; just
  feed it to the ribbon. Less editorial sprawl.

- **[regression/baseline] AC11 says "no regression on /hub or
  /arena baselines" but extending PrimaryPlayCta + MissionRibbon
  with new surface variants WILL touch the primitives' internal
  class merges.** If the merge logic re-orders class names, the
  rendered `class` attribute changes, and snapshot tests
  fingerprinted on class string compare may fail. Visual
  regression should hold (the rendered pixels stay), but DOM
  snapshot tests need verification.

  **Fix**: AC11 should be split: AC11a "no Playwright visual
  regression on /hub or /arena", AC11b "no DOM snapshot test
  regression — re-snapshot if class-merge order shifts but no
  visual difference". Different criteria for different test types.

### P2 — Nice to clarify

- **[scope/playwright]** Adding new Playwright baselines (AC9,
  AC10) means updating the `visual-regression.spec.ts` test file
  to include the `/exercises` route. Today (per
  `2026-05-10-shop-sheet-debug-handoff.md`) the visual suite
  covers `/hub` only. Spec says "delete old /exercises baselines"
  — but if there were never any /exercises baselines, this is
  a creation, not a replacement. Verify before TDD.
- **[mission-panel/density]** Open question §2 already flagged:
  ribbon density on the dense mission-panel surface needs visual
  review. This is a real risk given the panel is 100dvh-bounded
  and the ribbon adds vertical chrome. Defer to first PR review
  is acceptable but TDD must collect a screenshot for the review.
- **[testing-pattern]** Spec doesn't say whether
  `exercises-screen.test.tsx` exists. Grep confirms it does NOT.
  M1 either creates it (significant TDD scope) or deferred
  integration testing to E2E. Strong recommendation: defer to
  E2E for now (the screen is a 1300-line orchestrator; unit
  testing it requires extensive mocking that's its own project).

---

## Categories audited

### Contract gaps
- PrimaryPlayCta surface enum extension (correct in spec).
- MissionRibbon surface enum extension (correct in spec).
- PrimaryPlayCta size variants — P1 above. Spec needs `size="pin"`.
- Slot's `badge` slot (P1).

### Behavioral ambiguity
- TutorialBanner doesn't exist (P0 above).
- Animation ownership (P1 above).
- Half-slot migration (P0 above).

### Hidden assumptions
- CandyBanner is a card. **NO** (P0).
- pieceHint renders in mission panel today. **NO** (P0).
- All 6 slot actions are visually identical and easy to migrate.
  **NO** — claimBadge has its own candy-frame treatment.

### Visual regression risk
- AC11 needs split (P1).
- Mission-panel density (P2).

### Test coverage gaps
- exercises-screen.test.tsx doesn't exist (P2).
- Playwright baseline creation, not replacement (P2).

### Operational readiness
- TDD will fail loudly on P0s; team will discover the issues
  the hard way unless spec is patched first.

---

## Verdict

**NEEDS REVISION (P0 × 3) — do NOT proceed to /tdd.**

The three P0s are not cosmetic. Two of them (CandyBanner
misidentification, missing TutorialBanner) are about
**building on assumptions that don't match the codebase**. The
third (slot half-migration) is about **defining "done" too
narrowly** so the user's parchado experience returns the moment
they leave the failure path.

Required revisions to M1 spec:

1. Drop the "CandyBanner is a card" framing entirely; M1 doesn't
   actually depend on it but the audit-parent does. Patch the
   audit doc separately.
2. Reframe AC3 from "wrap TutorialBanner" to "introduce a
   `<MissionRibbon surface="exercises">` row inside
   `<MissionPanelCandy>` rendering `pieceHint`. Drop the per-
   piece editorial map.
3. Extend M1 to cover all 6 slot actions, not just retry/useShield.
   Or scope M1 explicitly to failure paths and add M1.5.
4. Add §"Primitive extensions" enumerating new variants required
   on PrimaryPlayCta (`size="pin"` + `badge` slot prop) and
   confirming MissionRibbon's per-surface tone.
5. Split AC11 into visual + DOM-snapshot subcriteria.

After patching, re-run this red-team; expect READY verdict for
v2.

**Strong recommendation as Sally**: also patch the parent audit
doc (`ux-design-application-audit-2026-05-08.md`) with a §0
"Corrections" section that names the CandyBanner-is-a-sprite
finding. Future-me reading that audit needs to know the truth
before trusting M2/M3 recommendations. M2 ("extend CandyBanner")
becomes M2 ("build the card primitive — there is none"), which
is a different, larger task.
