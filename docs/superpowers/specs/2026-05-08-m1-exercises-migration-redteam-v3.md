# Red Team Review — M1 v1.3 consolidation drift check (v3)

**Date**: 2026-05-08
**Reviewer mindset**: drift detection only — narrow scope, NOT a fresh
adversarial review.
**Spec under review**: `docs/superpowers/specs/2026-05-08-m1-exercises-migration-design-v1.3.md`
**Prior rounds**: v1
(`2026-05-08-m1-exercises-migration-redteam.md`), v2
(`2026-05-08-m1-exercises-migration-redteam-v2.md`).

v1.3 consolidates v1.1 + v1.2 patch + red-team v2 prescriptions into a
single source-of-truth spec. v3 verifies the merge folded every
prescription correctly without introducing drift, contradictions, or
new contract surface.

---

## Prescription verification

1. **MissionRibbon `text?: string` override** — ✅ correctly folded.
   v1.3 §"`<MissionRibbon>` extension" defines `text?: string` with
   explicit fallback to `MISSION_RIBBON_COPY[surface]`, ARIA preserved
   (`role="note"` + `aria-label={MISSION_RIBBON_COPY.ariaLabel}`).
   AC5 + AC6 cover the override + surface variant. Test plan adds 3
   mission-ribbon tests covering both default + override paths.

2. **ActionPin `isBusy` and `disabled` orthogonal** — ✅ correctly
   folded. Type def separates the two; comments lock semantics
   ("aria-busy wires only when isBusy"). AC12 explicitly states "both
   block onPress; aria-busy fires only when isBusy=true". Test #7 +
   #8 cover each path.

3. **Atmosphere day-1 on ActionPin** — ✅ correctly folded. Type alias
   `Atmosphere = "adventure" | "scholarly"` exported, `atmosphere?:
   Atmosphere` in props, day-1 rationale in JSDoc. Test matrix #10
   covers both values.

4. **Badge per-mode content shape** — ✅ correctly folded.
   `ActionPinBadgeContent { pin?, full? }` defined. Behavior table row
   for `useShield` shows `{shieldsAvailable}` vs `${n} left` split.
   AC9 wires `pin: shieldsAvailable, full:
   FOOTER_CTA_COPY.shieldsLeft(n)`. Tests #4-#6 cover positioning +
   ignore-other-mode.

5. **Label rendering owned by primitive** — ✅ correctly folded. JSDoc
   on `label` prop explicitly states ActionPin renders external
   `<span class="action-pin-label">` BELOW button on `size="pin"` and
   inline on `size="full"`. AC11 reinforces "Slot's external `<span>`
   is removed — no duplicate labels in DOM". Behavior §6 says
   "duplicate labels become a P0 in TDD if they slip in".

6. **Test matrix ~20 enumerated** — ✅ correctly folded. ~22 ActionPin
   tests enumerated + 3 MissionRibbon tests. Each maps to a specific
   assertion. Count matches red-team v2 minimum.

7. **Primitive location locked** — ✅ correctly folded. v1.3 specifies
   `apps/web/src/components/redesign/action-pin.tsx`. Verified that
   peer primitives `candy-icon.tsx`, `candy-banner.tsx`,
   `candy-button.tsx`, `candy-chip.tsx`, `journey-rail.tsx`,
   `player-card.tsx`, `wooden-banner.tsx` all live at this path. AC7
   reinforces.

8. **Naming `<ActionPin>` over `<SlotCta>`** — ✅ correctly folded.
   All primitive references use `<ActionPin>`. `SlotCta` mentions in
   v1.3 are intentional historical/contrast references (audit-trail
   prose). No live API/contract uses `SlotCta`.

9. **Compact-vs-full mode resolution on orchestrator** — ✅ correctly
   folded. Open question #13 explicitly resolves "orchestrator-side
   `compact?: boolean` prop on `<ContextualActionSlot>`, unchanged
   from today". Behavior §2 reinforces. No ambiguity transferred to
   ActionPin's contract.

## Independent consistency checks

10. **Internal consistency** — ✅ pass. Behavior table row for
    `useShield` matches `ActionPinBadgeContent` shape and AC9. No
    contradictions detected between type def, behavior table, and ACs.

11. **AC ↔ contract coverage** — ✅ pass. Each contract surface
    (HudResourceChip adoption, ActionPin primitive, MissionRibbon
    extension, editorial deltas) maps to ACs (AC1, AC2/3/7/9/10/11/12,
    AC4/5/6, AC4 respectively). AC8 covers retained 6s window behavior.
    AC13a/13b/14 cover testing layer.

12. **PR shape independence** — ✅ pass with one ordering observation.
    Commits 1-3 (introduce ActionPin, extend MissionRibbon, add
    editorial fallback) are independent and can land in any order.
    Commits 4-7 each consume earlier work in graph order: chip
    refactor (4) is independent; ribbon-row wire (5) depends on 2+3;
    slot migration (6) depends on 1; e2e baselines (7) depends on 4-6.
    Order honors dependency graph. Each is independently testable.

13. **Editorial deltas** — ✅ correct (one minor note). Verified
    `FOOTER_CTA_COPY` (editorial.ts:24-34) already contains `label`,
    `compactLabel`, `loading` for all 6 actions plus `shieldsLeft(n)`.
    v1.3 §"Editorial deltas" correctly states "FOOTER_CTA_COPY already
    has labels for all 6 actions — REUSED". The
    `MISSION_RIBBON_COPY.exercises = "Watch the piece. Move it."`
    fallback is small and justified as a safety net (live use always
    passes `text`). Verified `MISSION_RIBBON_COPY`
    (editorial.ts:1619-1626) does NOT have an `exercises` key today,
    so addition is necessary.

14. **Stale references** — ✅ clean. No `size="pin"` on
    `PrimaryPlayCta`, no `tone="claim"` on `PrimaryPlayCta`, no
    `PrimaryPlayCta` extension. The mentions of `PrimaryPlayCta` in
    v1.3 are all either: (a) explicit non-modification statements,
    (b) parallel-canon comparisons, (c) test-file untouched note, or
    (d) v1.2-pivot history. The 3 `SlotCta` mentions are audit-trail
    prose (items above). No carryover drift.

---

## Verdict

**READY for /tdd** — no drift detected.

All 9 red-team v2 prescriptions correctly folded into v1.3.
Independent consistency checks (10-14) all pass. The consolidation is
internally coherent: type definitions, behavior table, acceptance
criteria, test plan, and PR shape mutually reinforce without
contradicting one another. Audit-trail mentions of `SlotCta` and
`PrimaryPlayCta` are intentional historical context, not live contract
surface.

**Items folded correctly**: 9/9 prescriptions + 5/5 independent checks.
**Items drifted**: 0.

v1.3 is the active contract for /tdd. v1.1 and v1.2 patch are kept for
audit trail; future readers should consume v1.3 only.
