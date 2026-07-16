# Bishop B4 — Clasificación pre-commit (sin commit)

**Fecha:** 2026-07-15 · **Branch:** `fix/exercise-obstacles-a0`

---

## 1. Total 177 como literal de producción

**No existe.** El único `177` en `src` es un color CSS (`rgba(233, 177, 77, …)` en `stats-page.tsx`),
ajeno. El denominador de estrellas del Badge Sheet se computa vía `getMaxPossibleStars(piece, catalog)`
(derivado del catálogo), no de una constante manual. `177` solo aparece como **expectativa derivada en
tests** → **no se cambia nada** (sin refactor).

## 2. Decisión de commits

`puzzles.generated.ts` es un **artefacto derivado único** que contiene BOTH `GENERATED_PIVOTS` (Pivot
Challenge) Y el currículo de 9 ejercicios (bishop-9 removido). Separarlo exigiría **regenerarlo dos veces**
(revertir `exercises.json` → regenerar → commit pivot → re-aplicar → regenerar → commit currículo) = una
**reconstrucción riesgosa del generado**, prohibida por la condición 4. Además `editorial.ts` y
`messages/es.ts` mezclan copy de pivot + descripciones del alfil.

### ➜ Recomendación: **UN solo commit** — `feat: stabilize bishop training`

Los dos commits limpios (`feat: add bishop pivot challenge` + `feat: finalize bishop curriculum`) **no son
seguros** sin editar/reconstruir a mano el generado.

## 3. Clasificación de archivos

### A. Pivot Challenge (B4.2–B4.2.3)

Nuevos: `pivot-challenge.ts`, `__tests__/pivot-challenge.test.ts`, `__tests__/pivot-lint.test.ts`,
`components/dev/pivot-challenge-spike.tsx`, `app/dev/pivot-spike/page.tsx`, `e2e/pivot-spike.spec.ts`,
`e2e/pivot-real-flow.spec.ts`.
Modificados: `content/labyrinths.json` (3 filas pivot), `fen-puzzle.ts`, `content/catalog.ts`,
`baseline-write.ts`, `game/exercises.ts` (PIVOTS), `catalog-context.tsx`, `merged-catalog.ts`,
`overlay-types.ts`, `app/[locale]/exercises/page.tsx`, `board.tsx`, `exercises-screen.tsx` (adapter),
`mission-panel-candy.tsx`, `mission-detail-sheet.tsx`, `exercise-drawer.tsx`.
Tests tocados: `resolve-exercise-description.test.ts`, `exercise-drawer.test.tsx`,
`mission-detail-sheet.test.tsx`, `celebration-order.test.tsx`, `e2e/rook-rails-shots.spec.ts` (consecuencia
del label del nodo).

### B. Currículo del alfil (B4.3)

Nuevos: `__tests__/bishop-pedagogy.test.ts`, `__tests__/bishop-rules.test.ts`,
`e2e/bishop-nine-exercises-smoke.spec.ts`.
Modificados: `content/exercises.json`, `content/lint.ts` (CURATED_PIECES += bishop),
`generated-merge.test.ts`, `rotation.test.ts`, `pool-mastery-equivalence.test.ts`, `badge-sheet.test.tsx`.

### C. Mezclados (impiden separar sin reconstrucción)

- `src/lib/game/generated/puzzles.generated.ts` — derivado: pivots + currículo.
- `src/lib/content/editorial.ts` — PIVOT_COPY + labels Special Training + `specialTrainingLabelFormat` +
  descripciones EN del alfil.
- `src/lib/content/messages/es.ts` — lo mismo en ES.

### D. Documentación / auditoría

`docs/audits/2026-07-15-bishop-*.md` (14 docs, B0→B4 + esta clasificación). Van en el mismo commit único.

### E. Ajeno al alcance (NO commitear)

- **`SESSION.md`** — ya estaba modificado (`M`) al inicio de la sesión, antes de este trabajo. No pertenece
  al cierre del alfil → **excluir del commit**.

### F. Eliminado / fuera de git

- `scripts/check-overlay-bishop9.ts` — **borrado**: probe read-only bishop-9-específico (no reusable de
  forma genérica), seguro y sin secretos, pero su resultado ("no bishop-9 row") ya quedó en la auditoría B4.3.
- Memoria (`~/.claude/.../memory/*`) — fuera del repo, no entra en git.

## 4. bishop-lab-3 / bishop-lab-4 (verificado)

- **Conservados en contenido:** `labyrinths.json` → orders 0/1, IDs intactos.
- **En baseline generado:** ambos en `GENERATED_LABYRINTHS.bishop`.
- **Fuera de la navegación activa:** el adapter `specialTrainingCatalog` usa PIVOTS para el alfil (tiene 3),
  ocultando los labs — confirmado por `pivot-real-flow` (la nav muestra los pivots).
- **Progreso/IDs intactos:** no renumerados ni borrados; el ledger sigue id-keyed.

## 5. Validación acumulada final

- **E2E (minipay) 24/24:** pivot-real-flow (5) + bishop-nine-smoke (9) + rook-rails (6) + pivot-spike (4… total 24).
- **Unit COMPLETO: 5140/5140** (435 files; baseline 5003 → +137 nuevos del alfil/pivot).
- `tsc --noEmit` → limpio. · `git diff --check` → exit 0.

## 6. Propuesta exacta de commit

**Commit único:** `feat: stabilize bishop training`
**Incluye:** todo A + B + C + D (categorías arriba).
**Excluye:** `SESSION.md` (ajeno). `check-overlay-bishop9.ts` ya borrado.
**Firma:** `Wolfcito 🐾 @akawolfcito`.

**Sin commit hasta tu OK.**
