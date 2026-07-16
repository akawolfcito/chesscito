# Bishop B2 — Auditoría técnica (read-only)

**Fecha:** 2026-07-15 · **Branch:** `fix/exercise-obstacles-a0`
**Entradas:** `2026-07-15-bishop-b0-inventory.md`, `2026-07-15-bishop-b1-pedagogy.md`
**Alcance:** solo verificación. No se editó código, contenido, tests ni datos. Sin FEN nuevos, sin laberintos visuales.

---

## 1. Runtime de obstáculos y reglas (verificado en código)

| Chequeo | Resultado | Evidencia |
|---|---|---|
| Exercises pasan `obstacles` al motor | ✅ | `board.ts:48` → `getBishopMoves(position, blockers)` con `blockers = exercise.obstacles` |
| Ray-casting corta en el primer blocker | ✅ | `rules/bishop.ts:28` `if (blockers.some(...)) break` |
| No aterriza en el blocker | ✅ | `board.ts:73` `withoutBlockers(moves)` filtra la casilla del obstáculo |
| No atraviesa el blocker | ✅ | el `break` detiene el rayo antes de continuar |
| Blockers no capturables | ✅ | `fen-puzzle.ts:108-110`: piezas negras en no-peón → `FenError`; todos los obstáculos del alfil son `N` **blancas** (amigas) → nunca son captureTargets |
| Cuatro diagonales | ✅ | `rules/bishop.ts:12-17` (NE/SE/NW/SW) |
| Conserva color | ✅ (estructural) | los rayos solo suman ±1/±1 → `(file+rank)` mantiene paridad; imposible cambiar de color |
| Fila/columna no dan targets legales | ✅ | no hay direcciones ortogonales en el set de `directions` |

Render de obstáculos como piezas amigas: cubierto por `components/exercises/__tests__/exercise-obstacles.test.tsx` (genérico). La **no-capturabilidad/no-traspaso** está garantizada por el modelo de movimiento, no solo por el render.

---

## 2. Matriz técnica de los 10 ejercicios (BFS recomputado)

Recomputado con semántica idéntica a `exercise-bfs.ts` (estado = posición, expansión = `getValidTargets`).
`#optFirst` = cantidad de **primeros movimientos óptimos** (amplitud de decisión real en el 1er movimiento).

| id | mover→target | blockers | opt (gen) | opt (recalc) | ✔ | #optFirst | primeros óptimos | obstáculo |
|---|---|---|---|---|---|---|---|---|
| bishop-1 | a1→h8 | — | 1 | 1 | ✅ | 1 | h8 | — |
| bishop-2 | h1→a8 | — | 1 | 1 | ✅ | 1 | a8 | — |
| bishop-3 | d4→g7 | — | 1 | 1 | ✅ | 1 | g7 | — (4 rayos legales, 1 óptimo) |
| bishop-4 | a1→g1 | — | 2 | 2 | ✅ | 1 | d4 | — |
| bishop-5 | c3→g3 | — | 2 | 2 | ✅ | 2 | e5, e1 | — |
| bishop-6 | b2→f2 | d4 | 3 | 3 | ✅ | 2 | c3, c1 | **necesario** |
| bishop-7 | c3→g3 | e5, e1 | 3 | 3 | ✅ | 2 | d4, d2 | **ambos necesarios** |
| bishop-8 | a1→g7 | d4 | 4 | 4 | ✅ | 2 | b2, c3 | **necesario** |
| bishop-9 | a1→g7 | d4, f6 | 4 | 4 | ✅ | 2 | b2, c3 | d4 necesario · **f6 DECORATIVO** |
| bishop-10 | a1→h8 | e5 | 5 | 5 | ✅ | 3 | b2, c3, d4 | **necesario** |

**Los 10 `optimalMoves` del generated son correctos** (BFS independiente coincide 10/10).

### Confirmación específica bishop-9 vs bishop-8 (solicitada)

- Mismo `optimalMoves` = **4**.
- Mismo conjunto de primeros movimientos óptimos = **{b2, c3}**.
- El 2º blocker `f6` **NO altera el perfil de decisión**: no cambia el número de moves ni el set de aperturas óptimas → **decorativo**. Confirma la redundancia dura de B1. **bishop-9 = bishop-8 en términos de decisión.**

Ningún otro obstáculo del alfil es decorativo (quitar cualquiera de los demás cambiaría `optimalMoves`).

---

## 3. Progreso, persistencia y reordenamiento

**Esquema:** `chesscito:progress:{piece}` → `{ stars: Record<exerciseId, number> }` (id-keyed).
- Escritura por id: `exercises-save-flow-logic.ts:48` `return { ...stars, [exerciseId]: best }`.
- Lectura id-keyed y filtrada: `exercise-progress.ts:28 readPieceStars`.
- Legacy positional `stars: number[]`: `readPieceStars` devuelve `{}` (conservador) — **no** hay remapeo índice→id en ningún lado; un perfil legacy degrada a "sin jugar", **nunca reasigna**.

**Implicaciones de eliminar bishop-9 + reordenar:**
- El progreso es **independiente del índice**. Reordenar los 9 restantes **no transfiere estrellas** (las claves son ids, no posiciones).
- Una clave huérfana `bishop-9` en localStorage queda **inerte**: `buildTrainingPath` indexa por id de ejercicio, así que una clave sin ejercicio se ignora. No hay fuga a otro ejercicio.
- No se requiere código de migración para el progreso del jugador: se auto-sana. (Opcional: limpieza cosmética de la clave huérfana; no necesaria.)

---

## 4. Riesgos de eliminar bishop-9 (referencias fuera del catálogo)

`bishop-9` aparece en 5 lugares — todos deben tratarse en implementación:

| Archivo | Uso | Acción en B4 |
|---|---|---|
| `content/exercises.json` | fila fuente | eliminar la fila |
| `generated/puzzles.generated.ts` | derivado | regenerar (`pnpm import-puzzles`) |
| `content/messages/es.ts` | descripción ES | eliminar clave `bishop-9` |
| `content/editorial.ts` | descripción EN | eliminar clave `bishop-9` |
| `game/__tests__/generated-merge.test.ts:50` | `expect(indexOf("bishop-9") < indexOf("bishop-10"))` | **se ROMPE** — actualizar assertion |

**Riesgo de overlay (Supabase):** `merge-overlay` es **replace/append/remove por id**, no append-only (corrige a B0). Si existe una fila `content_overlay` para `bishop-9` no-`disabled`, tras eliminarla del baseline el merge haría `list.push` y **resucitaría bishop-9** (`merged-catalog.ts:138-140`). No se puede consultar la DB desde aquí → **chequeo previo obligatorio**: confirmar que no hay fila overlay de bishop-9, o insertar una fila `disabled` para él.

---

## 5. Colisiones de IDs y contenido stale

- **Sin colisiones:** ids del alfil (`bishop-1..10`, `bishop-lab-3/-4`) son únicos en JSON, generated y descripciones. Los ids autorados se preservan por round-trip FEN; `puzzleId` (hash) solo aplica a puzzles sin id explícito.
- **Gap `bishop-lab-1` / `bishop-lab-2`:** `bishop-lab-1` **nunca aparece en el historial Git** (`git log -S` vacío) → **no es contenido stale/borrado**, es numeración de autoría original con hueco. `bishop-lab-2` tampoco figura como id de laberinto del alfil. **Veredicto: cosmético, sin acción**; opcional renumerar a lab-1/lab-2 en B3 por higiene (cambiaría ids → tratar como progreso nuevo).

---

## 6. Campos pedagógicos — resolución B0 vs B1

`jq` sobre `content/exercises.json`: los **10/10** ejercicios del alfil tienen `title`, `principle`, `learningObjective` y `playerPrompt` en `null`.

- **B0 ("todos") es CORRECTO. B1 ("8 de 10") es un ERROR** — corregir esa cifra.
- Los títulos visibles (`editorial.ts:1282-1291`) vienen del mapa i18n, **no** del JSON. Por eso el alfil "se ve" autorado sin tener pedagogía en la fuente canónica.
- Nota: el baseline compila con la pedagogía en null (no gatea `requirePedagogy` sobre el generado); poblarla en B4 es puramente aditivo.

---

## 7. Cobertura de tests: actual vs faltante

**Actual (incidental, no dedicada):**
- `generated-merge.test.ts` — orden/merge (incluye la assertion bishop-9 que se romperá).
- `exercise-obstacles.test.tsx` — render de obstáculos (genérico).
- `labyrinth.test.ts` (`bfsSlidingDepth`) — BFS deslizante genérico.
- `lint.test.ts` — lint de contenido.

**Faltante (NO escribir aún — enumerar para B4):**
1. **Reglas** `bishop-rules.test.ts` (inexistente; la reina tiene el suyo): 4 diagonales, ray-cast corta en blocker, no aterriza en blocker, invariancia de color, fila/columna no producen targets.
2. **Pedagogía** `bishop-pedagogy.test.ts` (la torre tiene `rook-pedagogy.test.ts`): principios cubiertos, unicidad de principio, orden por maestría.
3. **IDs/orden:** unicidad de ids del alfil; `bishop-9` ausente; orden esperado de los 9.
4. **BFS:** `optimalMoves` esperado por ejercicio (los 9); ausencia de obstáculos decorativos (cada obstáculo cambia `optimalMoves`).
5. **Progreso:** clave huérfana inerte; reordenar no transfiere estrellas; legacy array no reasigna.
6. **Blockers:** en cada ejercicio con obstáculo, el alfil no puede aterrizar ni atravesar.

---

## 8. VEREDICTO

### 🟡 SAFE WITH MIGRATION

El runtime, el BFS y el modelo de progreso **soportan** la propuesta B1 (currículo de 9, remover bishop-9). El progreso es id-keyed e index-independiente → reordenar es seguro y no transfiere estrellas.

**Condiciones de migración (obligatorias antes de dar por cerrado B4):**
1. Editar `exercises.json` + regenerar generated + limpiar claves `bishop-9` en `editorial.ts` y `es.ts`.
2. **Actualizar `generated-merge.test.ts:50`** (assertion bishop-9 < bishop-10 se rompe).
3. **Chequeo overlay:** garantizar que no hay fila `content_overlay` activa de `bishop-9` (o insertar fila `disabled`) para que el merge no lo resucite.
4. Añadir la batería de tests faltante (§7) en implementación.

No hay bloqueadores que exijan NEEDS REVISION. Sin FEN nuevos, sin laberintos visuales, sin implementar B1.

**Fin de B2. Sin cambios aplicados.**
