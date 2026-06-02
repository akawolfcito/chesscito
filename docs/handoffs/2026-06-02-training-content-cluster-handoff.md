# Training Content Cluster — Handoff

**Date:** 2026-06-02
**Branch:** `main` (synced to `origin/main`)
**Promoted to production:** No — `origin/production` still on the previous release.
**Total commits this session:** 6 (`ae1303b3..36598e2f`)

---

## What shipped to `main`

| # | Hash | Title |
|---|------|-------|
| 1 | `ae1303b3` | docs(spec): training content v0.1 roadmap |
| 2 | `4653cb7b` | feat(exercises): King base training exercises |
| 3 | `381c6a1d` | test(exercises): allow King in training routes |
| 4 | `25d4f2ac` | feat(exercises): context-aware completion CTAs |
| 5 | `e4bf9878` | feat(exercises): fix pawn capture rules in labyrinth flow |
| 6 | `36598e2f` | feat(exercises): add King Shelter labyrinth |

---

## Phases delivered

### Phase A — Audit + roadmap
- Spec: `docs/superpowers/specs/2026-06-02-training-content-v0.1.md`
- Documented per-piece state, star progression (3★/exercise, 15★/piece max, 10★ unlock), badge claim flow (per piece via BadgesUpgradeable, gasless via `/api/sign-badge`), Arena-only on-chain save (ScoreboardUpgradeable), and future leaderboard v0.2 ideas (no implementation).

### Phase B — King base exercises
- `apps/web/src/lib/game/rules/king.ts` — `getKingMoves(origin, blockers)`, 8 deltas blocker-aware.
- `apps/web/src/lib/game/board.ts` — `case "king"` cableado en `getValidTargets`.
- `apps/web/src/lib/game/exercises.ts` — `KING_EXERCISES[5]` (king-1..5) + `"king"` añadido a `PLAYABLE_PIECES`.
- `apps/web/src/components/exercises/exercises-screen.tsx:2087` — King tile en `PiecePickerSheet` `enabled: true`.
- `page.test.tsx` (exercises + hub) — assertions actualizadas: King ahora pasa el server guard.

King exercises:
| # | id | Theme | Path | Optimal |
|---|----|-------|------|:--:|
| 1 | `king-1` | One-square move | e1 → e2 | 1 |
| 2 | `king-2` | Safe square | e1 → f2 | 1 |
| 3 | `king-3` | Avoid danger | d4 → b6 | 2 |
| 4 | `king-4` | King capture | e1 → d2 (isCapture) | 1 |
| 5 | `king-5` | Reach the shelter | e5 → h8 | 3 |

### Phase B.1 — Context-aware completion CTAs
Trigger: completing King landed the user on `ARENA` as primary CTA because PIECE_ORDER's "no nextPiece" branch defaulted to Arena. Wrong default for a piece with no follow-up content.

New cascade in `PieceCompletePrompt`:
1. `nextPiece` exists → "Start {next}"
2. `onTryLabyrinth` defined → "Try Labyrinth"
3. `onChoosePiece` defined → "Choose another piece"
4. Defensive fallback → "ARENA"

Arena demotes to a tertiary text-link ("Try Arena") whenever it's not primary AND `nextPiece` is null. Coach hint kept as before.

Plumbing: new state `pickerOpenSignal: number` in `exercises-screen.tsx`, passed as `openPickerSignal` to `MissionPanelCandy`. `useEffect` opens the picker on increment without lifting the picker state out of its current owner. Avoids a broader refactor.

Copy added (EN+ES):
- `PIECE_COMPLETE_COPY.choosePiece` — "Choose another piece" / "Elige otra pieza"
- `PIECE_COMPLETE_COPY.tryArenaSecondary` — "Try Arena" / "Probar Arena"

### Phase B.2 — King Shelter I labyrinth
- `king-lab-1` "King Shelter I" (Easy): e1 → a1 with obstacle c1, optimal 4.
- Path: `e1 → d2 → c2 → b1 → a1` (king's 8-direction reach lets it walk around a blocker without losing optimal distance).
- Threats NOT modeled (v0.1). "Reach the shelter" is framing copy.
- New test file `labyrinths-catalog.test.ts` pins per-piece counts as regression guards (Rook 3 / Bishop 2 / Knight 5 / Pawn 3 / Queen 3 / King ≥ 1).

### Phase B (labyrinth design) — Pawn capture rule fix
- Spec: `docs/superpowers/specs/2026-06-02-labyrinth-design-v0.1.md`
- Bug: in L1 pawn capture exercises (`pawn-3..5`), `board.ts` treated `captureTargets === undefined` as "all diagonals allowed", so the pawn could pseudo-capture on empty diagonal squares.
- Fix in `board.ts` Pawn case:
  ```
  : isCapture && targetPos
    ? [targetPos]   // L1 capture: only target square is a valid diagonal
    : undefined;    // backward-compat for direct-API callers (tutorialHints, tests)
  ```
- The `backward compat` test at `labyrinth.test.ts:589-593` still passes because it calls `getValidTargets` without `targetPos` → fallback returns `undefined` → all-diagonals behavior preserved for that direct-API path.
- 5 new regression tests in `labyrinth.test.ts` under `describe("L1 pawn capture exercise — diagonal restricted to targetPos")`.

---

## What did NOT change

- Contracts (BadgesUpgradeable, VictoryNFTUpgradeable, ScoreboardUpgradeable, ShopUpgradeable).
- Scoring rules (`scoring.ts`, `labyrinthStars`).
- Thresholds (`BADGE_THRESHOLD = 10`, `EXERCISES_PER_PIECE = 5`).
- Monetization, PRO, Peones, Shop, leaderboard infra.
- Layouts, asset packs, ContextualHeader warnings (preexistentes dev-only).
- On-chain save behavior (still Arena-only).

---

## Tests

| Suite | Status |
|-------|--------|
| `labyrinth.test.ts` (130 pre + 5 nuevos) | 135/135 ✅ |
| `labyrinths-catalog.test.ts` (nuevo) | 9/9 ✅ |
| `piece-complete-prompt.test.tsx` (nuevo) | 5/5 ✅ |
| `scoring.test.ts` | 8/8 ✅ |
| `queen-rules.test.ts` | 24/24 ✅ |
| `page.test.tsx` exercises + hub | 19/19 ✅ |
| `sign-badge` route | 1/1 ✅ |
| **Total focalizado a lo largo del cluster** | **~201 ✅** |
| `pnpm content:audit` | 152 findings baseline, sin nuevos |
| Full suite | NOT re-run — pre-existing 194 `localStorage.clear` failures persist (separate cluster pending) |

---

## Smoke pendiente en MiniPay viewport (antes de promover a production)

- [ ] `/en/exercises?piece=king` → completar los 5 ejercicios → confirmar progresión de estrellas + claim de King badge cuando llegue a 10★.
- [ ] A 10★ con King: abrir tab "Labyrinths" → confirmar que **ya no queda disabled silencioso**, juega `king-lab-1`.
- [ ] `/en/exercises?piece=pawn` → seleccionar pawn-3 desde c5 → confirmar que `b6` (vacío) **ya no aparece como casilla válida**; solo `c6` (forward) y `d6` (target).
- [ ] Completar Queen → confirmar que primary CTA dice "Start King" (no Arena).
- [ ] Completar King → confirmar que primary CTA dice "Choose another piece" + "Try Arena" como text-link secundario.

---

## Open follow-ups (parqueados, ordenar por prioridad cuando se retome)

### P1 — Critical infra
1. **`localStorage.clear` vitest env regression** — 194 tests rojos en suite completa. Pre-existente; pre-Phase B baseline `1727 passing (2026-05-21)` ya no se sostiene. Cluster propio para restaurar vitest env config (`apps/web/vitest.config.ts` o setup file post-update).

### P2 — Labyrinth polish (Phase C)
2. **True Easy pawn labyrinth** (`pawn-lab-?` con 1 forced capture continuando forward) — atenúa el dead-state risk de pawn-lab-3..5 introduciendo un onramp más amable.
3. **FEN tweaks** para easy labs por pieza — actualmente Rook lab-1 y lab-3 son variaciones del mismo concepto (`a1→h8`); Queen labs todos optimal=3 sin progresión.
4. **Dead-state UX** para pawn labyrinths — opciones: warning chip "no progressing moves", hint copy, o solo confiar en reset visible.

### P3 — Visual polish (separate cluster)
5. **DRY del picker `pieces` array** — actualmente duplicado en `exercises-screen.tsx:2081-2088` vs. `PLAYABLE_PIECES` en `exercises.ts:77`. Riesgo de drift.
6. **ContextualHeader warnings preexistentes** — `PIECE_COMPLETE_COPY.title = "All Exercises Complete!"` (23 chars vs cap 22) + trailing control 86px (probable close affordance labelled). Dev-only; sin urgencia.

### P4 — v0.2 / Medium-Hard tiers (Phase D + E)
7. **`attackedSquares` modeling** — habilita King Hard ("Avoid danger" mecánico real) + Pawn captures con enemigos reales como entidades.
8. **Medium/Hard tiers por pieza** — Knight ya tiene progresión implícita Easy→Medium→Hard; Rook/Bishop/Queen/King/Pawn necesitan diseño dedicado.

### P5 — Documentation
9. **Bishop/Pawn ID naming gap** (lab-3+ sin lab-1/lab-2) — decisión registrada en spec: NOT renombrar (orfanaría localStorage best-scores). Migration script opcional si producto decide normalizar.
10. **Spec `training-content-v0.1.md` §10** — falta marcar Phase B.1 + B.2 + labyrinth-design B como ✅ (1-line update opcional).

---

## Key references

- Spec — Training Content v0.1: `docs/superpowers/specs/2026-06-02-training-content-v0.1.md`
- Spec — Labyrinth Design v0.1: `docs/superpowers/specs/2026-06-02-labyrinth-design-v0.1.md`
- Pawn rule contract: `docs/superpowers/specs/2026-06-02-labyrinth-design-v0.1.md` §4
- Catalog regression: `apps/web/src/lib/game/__tests__/labyrinths-catalog.test.ts`

---

## Outstanding question for next session

Cuando se reactive el cluster: ¿priorizar visual polish, Phase C labyrinth polish, o el vitest env fix (P1)? El env fix desbloquea CI completa y debería ir primero si hay urgencia de release; visual polish + Phase C son ortogonales y pueden ir en cualquier orden.
