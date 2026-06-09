# Chesscito — Rotation Engine Implementation Calibration (2026-06-08)

**Author:** John (PM) · **Status:** Technical calibration, pre-code.
**Predecessor:** Content MVP 10/15 cerrado — `docs/handoffs/2026-06-08-exercise-content-10-of-15-milestone.md`.
**Spec base:** `docs/product/chesscito-rotation-and-labyrinths-2026-06-08.md`.

> Este doc NO implementa código. Diseña el plan técnico para consumir el contenido 10/15 ya listo con un rotation engine.

---

## 0. Decisiones ya cerradas (input)

1. Contenido MVP = **10/15 por pieza** (Easy + Medium). Hard tier = wave 2.
2. Free y PRO desbloquean tiers **al mismo ritmo educativo** (PRO no adelanta).
3. **Guest:** canonical 5 first touch → wallet prompt → `session_uuid` fallback.
4. **10★ across pool de la pieza:** suma de estrellas únicas, cada ejercicio max 3★, reintentos no duplican.

---

## 1. Estado actual (grounded en código)

- **60 ejercicios totales**, las 6 piezas en 10/15. Metadata `tier` / `objective` / `tags` presente y completa (untiered: 0).
- **Progress por índice de array.** `PieceProgress = { piece, exerciseIndex, stars: number[] }` en `apps/web/src/hooks/use-exercise-progress.ts`. `stars[i]` = mejor resultado (0-3) del ejercicio en la posición `i` del pool. `localStorage` key `chesscito:progress:<piece>`.
- **Migración de longitud ya segura.** `migrateStarsLength(stars, count)` (exportada): pad-right con ceros si crece, truncate-preservando-prefijo si encoge. Las migraciones 5→10 y 9→10 ya están cubiertas y testeadas.
- **El array es positional y FROZEN.** El milestone King demostró que reordenar el array remapea progreso live. Orden = contrato implícito.
- **🔑 El badge YA es across-pool.** `badgeEarned = totalStars(stars) >= BADGE_THRESHOLD(10)`, y `totalStars` suma el mejor-por-ejercicio sobre TODO el array. Como `stars[idx] = max(bestBefore, nuevo)`, eso ES exactamente "suma de estrellas únicas across pool, max 3★/ejercicio, reintentos no duplican". **La decisión #5 ya está implementada — no requiere cambio de badge contract.**
- **Earn ya es por `exerciseId`.** `submitTrainingExerciseEarn({ wallet, piece, exerciseId, bestStarsBefore, bestStarsAfter })` se dispara solo con wallet conectada y delta de best-stars > 0. La rotación no rompe earn: cada ejercicio acredita una vez por mejora, independiente de qué día sea visible.
- **Guest ya es local-only.** El hook gatea el earn POST por `isConnected`. Guests mantienen progress local + telemetría. No hay seed de rotación todavía (todos ven el pool completo en orden).
- **UI actual = senda lineal.** El hook expone `exerciseIndex` + `advanceExercise()` + `goToExercise()`; la pantalla recorre los índices del pool en orden. Hoy la UI muestra/permite navegar el pool completo por pieza (no hay subset diario).
- **Superficies consumidoras** (slices E/F las tocarán): `exercises-screen.tsx`, `exercise-drawer.tsx`, `badge-sheet.tsx`, `journey-rail.tsx`, `derive-reward-tiles.ts`.

---

## 2. Target behavior

### Usuario conectado (wallet)
- **seed = `hash(wallet, ISODate, piece)`** → set determinístico de 5 ids del pool.
- Mostrar **5 ejercicios diarios** por pieza (subset del pool de 10).
- Elegir **solo entre tiers desbloqueados**: Easy desde inicio · Medium @ 5★ en la pieza · Hard @ 9★ (cuando exista).
- **Bias** hacia ejercicios menos completados (0★/1★ antes que 3★) dentro de tiers desbloqueados.
- **Badge threshold = 10★ across pool** (ya vigente; el subset diario NO cambia el array subyacente, los 10 slots siguen acumulando su mejor resultado).

### Guest
- **Primera experiencia:** 5 canonical curated (override del seed).
- Tras completar/recorrer los canonical → **prompt suave de wallet**.
- Si no conecta → `session_uuid` en `sessionStorage`; rotación con **seed = `hash(session_uuid, ISODate, piece)`**.
- Progress sigue local-only (sin earn POST) hasta que conecte.

---

## 3. Technical risks

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | **Progress por índice vs futuro por exerciseId.** La rotación selecciona por id/tier, pero `completeExercise` escribe `stars[exerciseIndex]`. Si el "índice diario" (0-4) se confunde con el "índice de pool" (0-9), se corrompe progreso. | Introducir capa de progreso por `exerciseId` (§4). Los selectores trabajan con ids; el índice de pool deja de ser la fuente de verdad. |
| R2 | **Reordenar el array remapea progreso.** Demostrado en King. | Mantener orden FROZEN mientras el progreso siga siendo array-indexed; o migrar a id-map (R1) que es order-independent y elimina el riesgo de raíz. |
| R3 | **Preservar estrellas existentes.** Usuarios con `chesscito:progress:<piece>` en prod. | El adapter array→id-map debe mapear `stars[i]` → `id = EXERCISES[piece][i].id` usando el orden actual (frozen), una sola vez, idempotente. `migrateStarsLength` ya es el precedente de migración segura. |
| R4 | **Unique stars across pool.** Riesgo de doble conteo con reintentos. | **No-op:** ya resuelto. `stars[idx] = max(...)` + `totalStars` = suma de bests. Mantener; no tocar el cálculo. |
| R5 | **Canonical 5 existentes.** Cuáles son los 5 canónicos por pieza. | Recomendación: los **primeros 5 del pool** (los originales pre-wave). Nota: en Knight/Pawn uno de esos 5 es Medium (knight-5, pawn-5 reclasificados) — sigue siendo válido como first-impression. |
| R6 | **No romper badge claim.** | El threshold 10★ across pool ya es el cálculo vigente. La rotación solo cambia VISIBILIDAD, no el array de stars. Badge claim intacto. |
| R7 | **No romper Daily/Training earn.** | Earn ya es por `exerciseId` con gate de delta. La rotación no cambia ids ni el gate. Verificar que el id que llega a `completeExercise` sea el del ejercicio realmente jugado (cubierto por R1). |
| R8 | **No afectar Labyrinths.** `LABYRINTHS` es un `Record` separado de `EXERCISES`; los laberintos tienen su propio progreso (`LabyrinthProgress`, por id ya). | El rotation engine opera SOLO sobre `EXERCISES`. No importar ni tocar `LABYRINTHS` en los selectores. Tests deben afirmar que `LABYRINTHS` queda intacto. |

---

## 4. Recommended data model

**Sí necesitamos progreso por `exerciseId`** (desacopla del orden del array, order-independent, robusto ante rotación y futuros cambios de pool). Propuesta:

```ts
// Nuevo shape (forward):
type PieceProgressV2 = {
  piece: PieceId;
  stars: Record<string, number>;   // { [exerciseId]: bestStars 0-3 }
  // exerciseIndex deja de ser fuente de verdad; el "current" lo decide
  // el selector diario, no un puntero lineal persistido.
};
```

Helpers puros propuestos (sin UI, testeables aislados):

- **`getExercisePool(piece): Exercise[]`** — wrapper de `EXERCISES[piece]` (single source).
- **`getPieceMasteryStars(piece, progress): number`** — suma de `progress.stars[id]` sobre el pool (= badge across-pool; envuelve el cálculo ya vigente).
- **`getUnlockedTiers(piece, progress): ExerciseTier[]`** — Easy siempre; Medium si mastery ≥ 5; Hard si mastery ≥ 9.
- **`getVisibleExercisesForToday({ piece, seedKey, date, progress }): Exercise[]`** — seed determinístico (`seedKey` = wallet o session_uuid) → 5 ids de tiers desbloqueados, con bias a menos completados.
- **`getCanonicalFive(piece): Exercise[]`** — los primeros 5 del pool (guest first touch).
- **Compat adapter `migrateArrayToIdMap(piece, legacyStars): Record<string,number>`** — `stars[i] → EXERCISES[piece][i].id`, una vez, idempotente; preserva todo valor. Convive con `migrateStarsLength` como paso previo o reemplazo.

**Estrategia de transición recomendada:** adapter dual durante una ventana corta — leer legacy array si existe, escribir id-map; derivar el array legacy desde el id-map solo si algún consumidor aún lo requiere, hasta migrar todos los callsites. (Ver Q1.)

---

## 5. Implementation slices (commits pequeños)

| Slice | Commit | Contenido | Toca UI |
|---|---|---|---|
| A | `docs(product): rotation engine implementation calibration` | Este doc. | No |
| B | `feat(game): pure rotation selectors (no UI)` | `getExercisePool`, `getUnlockedTiers`, `getCanonicalFive`, `getVisibleExercisesForToday`, `getPieceMasteryStars`. Funciones puras. | No |
| C | `feat(game): progress id-map adapter (no UI)` | `PieceProgressV2` + `migrateArrayToIdMap` + read/write compat. Sin cambiar el hook todavía. | No |
| D | `test(game): tier unlock + daily seed + guest canonical` | Cobertura: idempotencia de seed (misma wallet+fecha+pieza → mismo set), set distinto al día siguiente, gates 5★/9★, canonical override para guest, bias verificable. | No |
| E | `feat(exercises): wire rotation behind flag / safe default` | Pantalla de ejercicios consume `getVisibleExercisesForToday`; `completeExercise` apunta al id correcto. Detrás de flag interno. | Sí |
| F | `refactor(game): badge mastery across pool via helper` | Reemplazar el cálculo inline por `getPieceMasteryStars` (comportamiento idéntico; consolida la fuente). Sin cambio funcional de threshold. | Mínimo |
| G | `chore(product): rotation engine smoke + handoff` | Smoke MiniPay 390px + handoff de cierre. | No |

Orden de seguridad: B→C→D antes de tocar UI (E). F es refactor de consolidación, no cambia el threshold.

---

## 6. Out of scope

- ❌ Hard tier authoring (wave 2).
- ❌ Daily Labyrinth.
- ❌ PRO second Daily Lab.
- ❌ Labyrinth visual refactor (obstáculos como muros/rocas).
- ❌ Peones sinks.
- ❌ P2P / visor / tipping.
- ❌ Payment rails.

---

## 7. Open questions (bloqueantes) + recomendación PM

1. **¿Migramos progress a exerciseId map ahora o adapter dual?**
   → **Recomendación: adapter dual** (slice C). Migrar lectura a id-map con fallback al array legacy una sola vez; escribir siempre id-map. Es order-independent (elimina R1/R2/R3 de raíz) sin un big-bang de migración. Pre-launch lo hace barato.

2. **¿Rotation entra behind flag o directo?**
   → **Recomendación: behind flag interno con default-on en dev** (slice E), validar smoke 390px, y remover el flag en el commit de cierre. Pre-launch permitiría ir directo, pero el flag de-riska el swap de la pantalla por ~1 commit.

3. **¿Canonical 5 = primeros 5 actuales por pieza?**
   → **Recomendación: sí.** Los primeros 5 del pool son el set curado original (first-impression). Caveat documentado: en Knight/Pawn uno de esos 5 es Medium (reclasificado), lo cual es aceptable para guest.

4. **¿Daily rotation usa UTC o local date?**
   → **Recomendación: UTC.** Consistente con el cap del Daily Tactic (UTC-day, ver memoria de economía), evita timezone-hopping para refrescar el set, y mantiene un solo modelo de "día" en toda la app.

5. **¿Badge claim across pool reemplaza el cálculo actual?**
   → **Recomendación: NO hay reemplazo.** El cálculo vigente (`totalStars` sobre best-per-exercise) YA es across-pool. Slice F solo lo envuelve en `getPieceMasteryStars` por claridad/consolidación, sin cambiar el threshold ni el resultado. Decisión #5 = ya satisfecha.

---

## 8. Qué NO cambió en esta calibración

Cero código. Sin UI, Peones, badge contract, Coach/PRO/ledger, payment rails, motor de movimiento. Solo este documento de plan técnico.
