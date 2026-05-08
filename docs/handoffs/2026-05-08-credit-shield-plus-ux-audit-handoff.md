# Session Handoff — 2026-05-08 (extended: credit-shield + post-deploy fixes + Sally UX audit)

This is a continuation of `2026-05-08-credit-shield-server-side-handoff.md`.
After the credit-shield migration shipped, the user smoke-tested in
production and reported two UX bugs. Both fixed and pushed. Then Sally
(UX agent) ran a full application audit and produced the migration
plan to close the long-running "parchado" feeling.

## What this session did (additions)

After the original credit-shield-server-side ship:

1. **Smoke from user**: shield purchase x3 confirmed visible in chip,
   but two bugs surfaced:
   - Shield button on failure flashed for ~1.5s and disappeared
     before user could react.
   - No way back to /hub from /exercises.
2. **B1 fix shipped** (`f7fb9c0`): retry-shield reachability — auto-
   reset extended to 6s when shieldCount > 0; `handleUseShield`
   invalidates timer before consuming.
3. **B2 fix shipped** (`62e54d9`): back-to-hub chevron added to
   `<GlobalStatusBar>` via opt-in `onBack` prop. Renders only when
   caller defines it (so /hub doesn't show recursive frame).
4. **Sally UX agent activation**: persona switched to UX designer
   to attack the meta-feedback "se siente parchado, no quiero
   parchar parche encima de parche".
5. **Sally application audit**: full inventory of which Phase 1+2
   primitives from `ux-design-specification.md` are built (8/9) vs.
   applied (only /hub + /arena). Found the gap: /exercises, /coach,
   /legal never received the canonical primitives.
6. **M1 spec authored** (`ab7d640`): `/exercises` migration to
   canonical primitives is the highest-impact next step.

## Commits added this extended session

```
ab7d640 docs(spec): add M1 — /exercises migration to canonical primitives
62e54d9 feat(exercises): add back-to-hub chevron in GlobalStatusBar
f7fb9c0 fix(exercises): make retry-shield actually usable on failure
```

All pushed to `origin/main`.

## Sally's strong recommendations (locked)

1. **`<FrameCraftCard>` is NOT built as separate component** — evolve
   `<CandyBanner>` in place. One source of truth, no twins.
2. **Migration order is driven by player-felt impact**, not code
   complexity:
   - **M1**: `/exercises` migration (P0 — biggest visual seam)
   - **M2**: `<CandyBanner>` extension (P0 — blocks M3)
   - **M3**: `/coach` migration (P1 — monetization story)
   - **M4**: micro-copy + contextual `<HelpChip>` sweep (P2)
   - **M5**: `/legal` shell (P3)
   - **M6**: Rowdies coverage sweep (P1, parallel to M1)
3. **`<HelpChip>` is a variant of `<HudResourceChip>`**, NEVER a
   global top-corner help button. Matches Clash Royale convention:
   UI teaches itself contextually.
4. **M1 + M3 ship with new Playwright visual baselines** before/after.
5. **M6 (Rowdies sweep) runs parallel to M1** — atomic work, unblocks
   typographic coherence checks during M1 review.

User confirmed all 5 with "si a todo".

## Sally's audit findings (key data points)

| Primitive | Build status |
|---|---|
| `<KingdomAnchor>`, `<HudResourceChip>`, `<MissionRibbon>`, `<PrimaryPlayCta>`, `<HudSecondaryRow>`, `<RewardColumn>`, `<PremiumSlot>`, `<ComingSoonChip>` | ✅ Built + tested |
| `<FrameCraftCard>` | ❌ Not built. Decision: don't build; evolve `<CandyBanner>` |

| Surface | Status |
|---|---|
| `/hub` | ✅ Migrated (reference implementation) |
| `/arena` (entry) | ✅ Migrated |
| `/exercises` | ❌ **Legacy** — M1 target |
| `/coach`, `/coach/history` | ❌ **Legacy** — M3 target |
| `/trophies` | ⚠️ Partial (CandyBanner only) — low priority |
| `/privacy`, `/terms`, `/support` | ❌ Legacy — M5, lowest priority |
| `/landing` | ✅ Mostly migrated (own coherent dialect) |

Audit doc: `_bmad-output/planning-artifacts/ux-design-application-audit-2026-05-08.md`
(gitignored — local only; do not move into a tracked path).

## State at handoff

- **Branch**: `main`, all pushed (`d33683b..ab7d640`)
- **Tests**: 1103/1103 web suite green
- **Build**: clean
- **Vercel**: deploys triggered for all pushes; user confirmed smoke
  worked end-to-end before the B1/B2 fixes shipped (so the credit
  flow is genuinely live).
- **Uncommitted**: none

## Recommended next session

**Run /red-team on the M1 spec.**

The spec is at
`docs/superpowers/specs/2026-05-08-m1-exercises-migration-design.md`.

The red-team should look for:
- Unintended visual regressions in the gameplay surface — `/exercises`
  is dense; primitive adoption could collide with the mission-panel
  layout.
- `<ContextualActionSlot>` refactor risk — open question §1 of the
  M1 spec asks whether the slot should accept the CTA as a child
  vs. render a raw `<button>`. Decision impacts the structural shape.
- Tests that pin existing visual treatment (e.g., shop-sheet test)
  may break collaterally. Cross-reference.

After red-team v1 + revisions land, run /tdd on M1.

## Parallel work (M6, can be picked up independently)

Rowdies coverage sweep:
- `apps/web/src/app/layout.tsx` — confirm `Rowdies.variable` mounted.
- `apps/web/src/app/globals.css` — search for competing
  `font-family` declarations.
- Per-surface CSS for `.mission-shell`, `.chesscito-dock`, candy
  frames — confirm inheritance.

Estimated: 1-3 atomic commits. Trivial detection; medium fix if
multiple surfaces override.

## Out of scope (do not touch in next session unless requested)

- Coach surface (M3) — depends on M2 (CandyBanner extension).
- Legal pages (M5).
- Editorial micro-copy sweep (M4) — depends on M1.

## Blockers

- None.

## Open questions tracked from M1 spec

1. `<ContextualActionSlot>` refactor — decide during TDD.
2. `<MissionRibbon surface="exercises">` density — first PR review
   will tell us if a tighter vertical variant is needed for the
   mission-panel surface.
