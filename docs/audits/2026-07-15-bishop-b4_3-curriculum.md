# Bishop B4.3 — Implementación del currículo del alfil (sin commit)

**Fecha:** 2026-07-15 · **Branch:** `fix/exercise-obstacles-a0`
**Alcance:** currículo de 9 ejercicios del alfil (baseline = torre). Sin captura, sin multi-target, sin
tocar Pivot Challenge / Rook Rails / FENs de los 9 conservados / ExercisesScreen.

---

## 1. Resultado del overlay (paso crítico previo)

Probe read-only `scripts/check-overlay-bishop9.ts` (imprime solo estado de fila, nunca secretos):

```
OVERLAY: no bishop-9 row found. Safe to drop from baseline.
```

**No existe fila `bishop-9`** en `content_overlay` (ni activa ni disabled) → nada que respaldar/eliminar;
el overlay **no puede resucitarla** (no hay fila; el merge solo re-añade filas existentes y re-BFS-verificadas).

## 2. Matriz final del currículo (9 ejercicios, orden por maestría)

| # | id | mover→target | opt | obst | principle | tags |
|---|---|---|---|---|---|---|
| 0 | bishop-1 | a1→h8 | 1 | 0 | diagonal-movement | long-diagonal |
| 1 | bishop-2 | h1→a8 | 1 | 0 | both-diagonals | long-diagonal, same-color |
| 2 | bishop-3 | d4→g7 | 1 | 0 | diagonal-choice | short-diagonal, ray-choice |
| 3 | bishop-4 | a1→g1 | 2 | 0 | no-straight-line | pivot, no-straight-line |
| 4 | bishop-5 | c3→g3 | 2 | 0 | pivot-choice | pivot |
| 5 | bishop-6 | b2→f2 | 3 | 1 | friendly-blocker | friendly-blocker, detour |
| 6 | bishop-7 | c3→g3 | 3 | 2 | friendly-blocker-advanced | friendly-blocker, detour |
| 7 | bishop-8 | a1→g7 | 4 | 1 | blocked-diagonal | blocked-diagonal, detour, long-diagonal |
| 8 | bishop-10 | a1→h8 | 5 | 1 | route-planning | blocked-diagonal, detour, long-diagonal, route-planning |

`optimalMoves` = `[1,1,1,2,2,3,3,4,5]` (verificado por BFS vs generated). Obstáculos = `[0,0,0,0,0,1,2,1,1]`,
todos **load-bearing** (quitarlos baja el óptimo). FENs **sin cambios**. **bishop-9 eliminado**;
tag engañoso `straight-line` retirado; título "Capture detour" (fuera de alcance) eliminado con bishop-9.

## 3. Copy EN / ES (título + prompt)

| id | Título EN | Prompt EN | Título ES |
|---|---|---|---|
| bishop-1 | The diagonal move | The bishop moves diagonally. Slide it to the star. | El movimiento diagonal |
| bishop-2 | The other diagonal | This bishop lives on light squares and always will. Take its diagonal to the star. | La otra diagonal |
| bishop-3 | Pick the diagonal | Four diagonals leave this square. Choose the one that reaches the star. | Elige la diagonal |
| bishop-4 | The bishop is not a rook | The bishop cannot slide straight along the row. Turn on a diagonal to reach the star. | El alfil no es una torre |
| bishop-5 | Choose the turn | There are two squares where you can turn toward the star. Pick either one. | Elige el giro |
| bishop-6 | Your own piece blocks the turn | Your own knight blocks the turn. You cannot jump it, so find the way around. | Tu propia pieza bloquea el giro |
| bishop-7 | Both turns blocked | Both turning squares are blocked. Plan a longer route to the star. | Ambos giros bloqueados |
| bishop-8 | Blocked on the long diagonal | A knight sits on your diagonal. Step off, go around, and rejoin the diagonal past it. | Bloqueado en la diagonal larga |
| bishop-10 | The long way around | Plan the whole route around the knight before you move. | El camino largo |

**Conservación de color:** enseñada por copy en bishop-2 (tag `same-color` + "never leaves its colour /
light squares"), **nunca** con un target insoluble — verificado: todos los targets conservan color.

## 4. Archivos modificados

- `content/exercises.json` — 9 ejercicios con pedagogía; bishop-9 fuera; bishop-10 order 8; tags corregidos
- `src/lib/content/lint.ts` — `CURATED_PIECES += "bishop"` (gate de pedagogía activo)
- `src/lib/content/editorial.ts` + `messages/es.ts` — títulos EN/ES nuevos; bishop-9 removido
- `src/lib/game/generated/puzzles.generated.ts` — regenerado (flujo oficial, 78 puzzles)
- `src/lib/game/__tests__/generated-merge.test.ts` — orden final + bishop-9 ausente
- **Nuevos:** `bishop-pedagogy.test.ts`, `bishop-rules.test.ts`, `e2e/bishop-nine-exercises-smoke.spec.ts`
- **Tests actualizados por el cambio de tamaño del pool (10→9):** `rotation.test.ts`,
  `pool-mastery-equivalence.test.ts`, `badge-sheet.test.tsx`
- `scripts/check-overlay-bishop9.ts` — probe read-only del overlay (reutilizable)

## 5. Validaciones

- **Overlay limpio:** sin fila bishop-9. ✅
- **Exactamente 9 ejercicios visibles del alfil:** `content` = 9, `EXERCISES.bishop` = 9. ✅
- **bishop-9 ausente** de baseline, generated (0), editorial, ES; solo persiste en aserciones que verifican
  su ausencia. ✅
- **optimalMoves conservados** (`[1,1,1,2,2,3,3,4,5]`) + **blockers load-bearing** — `bishop-rules.test.ts`. ✅
- **Progreso id-keyed intacto** — smoke persiste por id; ids únicos. ✅
- **Unit** (`content`, `game`, `training`, `components/exercises`): **1023/1023** (69 files), +22 nuevos del alfil.
- **E2E smoke de los 9 ejercicios** (minipay): **9/9** — resume + blockers-como-caballos (sin muro) + solución óptima → 3★.
- `tsc --noEmit` → limpio. · `git diff --check` → exit 0.

## 6. Discrepancias encontradas

1. **Warnings de "duplicate position"** en `bishop-4` (a1→g1) y `bishop-5` (c3→g3): comparten posición con
   `bishop-pivot-1`/`bishop-pivot-2` (Pivot Challenge reutiliza esa geometría **por diseño**). Cross-kind,
   **warning no error** — aceptado.
2. **3 tests asumían alfil = 10 ejercicios** → actualizados: el denominador de estrellas del Badge Sheet
   pasa de **180 → 177** (5 piezas ×10 + alfil ×9 = 59 ejercicios ×3). Legítimo tras retirar bishop-9.

## 7. Veredicto

### 🟢 DONE (sin commit)

Currículo del alfil a paridad con la torre: 9 ejercicios curados, pedagogía completa (gate activo), orden
por maestría, bishop-9 retirado, tags/títulos corregidos, color enseñado por copy. Overlay confirmado
limpio. Sin commit. **Restricciones respetadas:** sin captura, sin multi-target, FENs conservados, Pivot
Challenge / Rook Rails intactos, ExercisesScreen sin cambios.
