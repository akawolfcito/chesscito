# Visual Validation Layer — Redesign Guardrail

**Date**: 2026-04-17
**Status**: Active — validation layer for the candy-game redesign
**Relates to**: `2026-04-16-visual-redesign-candy-game-design.md`

## Problem

The existing `visual-snapshot.spec.ts` only captures entry screens (mission briefing, difficulty selector). The redesign changes render primarily in **in-game states** — the chess board, HUD, end states — which no automated check currently covers. Manual review is the only safety net.

## Goal

Add a lightweight, reproducible validation loop so every redesign sub-phase:

1. Captures in-game screenshots at mobile viewport (390×844)
2. Gets reviewed adversarially by a UI/UX expert agent against `design/redesign/escenario.png`
3. Surfaces regressions or design drift before the commit lands

## Components

### 1. Playwright spec — `e2e/redesign-validation.spec.ts`

Captures three post-interaction states that the current snapshot spec does not reach:

- **play-hub board active** — briefing dismissed, Rook visible on the board
- **play-hub piece selected** — Rook tapped, valid-move highlights rendered
- **arena board after Easy selected** — difficulty chosen, pieces rendered

Output: `apps/web/e2e-results/redesign/*.png`

Animations disabled via `page.emulateMedia({ reducedMotion: 'reduce' })` + CSS override to minimize flakiness.

### 2. NPM script — `pnpm test:e2e:redesign`

Added to `apps/web/package.json`. Runs the spec above.

### 3. UX-review agent — per sub-phase

After each sub-phase commit, invoke the `ux-review` skill with:

- Paths to the newly captured PNGs
- Path to `design/redesign/escenario.png` (reference)
- Summary of the sub-phase change (what was intended)

Agent returns: ✅ OK / 🟡 Warning / 🔴 Block with specific findings (misalignment, color clashes, disappeared elements, touch target violations).

### Disposition rules

- **Structural sub-phases** (e.g., clone shell, new component wiring): review is **blocking** — don't commit on 🔴.
- **Atomic sub-phases** (e.g., single CSS fix, piece swap): review is **advisory** — reports issues, human decides.

## Workflow per sub-phase

```
1. Implement change
2. pnpm type-check                     # passes
3. Kill stale :3000, pnpm test:e2e:visual   # passes (no regression in entry screens)
4. pnpm test:e2e:redesign              # captures in-game screenshots
5. Invoke ux-review agent              # adversarial audit
6a. Agent says OK → commit
6b. Agent says Block → iterate same sub-phase
6c. Agent flags issue outside scope → log in inventory doc, continue
```

## Why only one skill matters per commit

- `ux-review` — **essential** per sub-phase. This is the audit.
- `playwright-best-practices` — consulted once while authoring the spec. Not per commit.
- `frontend-design` — not applicable (it's a generation skill, not a validation one).

## Known limitations

- Tests run at single viewport (390×844). Does not yet verify 360px compatibility.
- Splash/briefing dismissal is best-effort — if copy/layout changes, selectors may need update.
- Agent cannot detect FPS/animation regressions; only static visual drift.

## Evolution

Future additions:

- Expand coverage to: Arena end-state (lose), Play Hub success flash, Play Hub capture exercise
- Add 360px viewport variant
- Integrate with CI as a non-blocking job (alert on drift, don't fail the pipeline)
