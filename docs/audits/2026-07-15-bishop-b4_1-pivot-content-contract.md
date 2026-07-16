# Bishop B4.1 — Diseño y contrato de contenido de Pivot Challenge (read-only)

**Fecha:** 2026-07-15 · **Branch:** `fix/exercise-obstacles-a0`
**Gate:** B4.1 (diseño/contrato). **No** se implementó producción. Se detiene para aprobación humana.
**Identidad:** "encontrar la casilla que conecta las diagonales correctas". Todos los niveles `optimalMoves = 2` (`start → connector → target`).

---

## 1. Cambio mínimo al modelo de Special Training

Un `kind` nuevo, reutilizando el pipeline de labyrinths (mismo record + un campo).

| Cambio | Archivo | Detalle |
|---|---|---|
| Ampliar unión `kind` | `fen-puzzle.ts` `PuzzleInput.kind` | `"exercise" \| "labyrinth" \| "pivot"` |
| Aceptar `kind:"pivot"` | `catalog.ts` (CSV `line 176` + loader labs `line 186-195`) | el loader de labyrinths lee `rec.kind ?? "labyrinth"` y rutea |
| Nuevo bucket | `catalog.ts` / generación | `GENERATED_PIVOTS: Record<PieceId, Exercise[]>` (espejo de `GENERATED_LABYRINTHS`) |
| Ruteo en `addPuzzle` | `catalog.ts:162` | `if (kind==="pivot") pivots[piece].push(...)` |
| Gate de blocker | `catalog.ts:128` | aplicar el gate "blockers = caballos blancos" **también** a pivot (se dibujan como caballo, coherente con "pieza propia bloquea") |
| Lint específico | `lint`/`buildCatalog` | **pivot ⇒ `optimalMoves === 2`** (si no, error); solvable ≥1 connector (garantizado por opt=2) |

**Fuente de contenido:** añadir `kind?: "labyrinth" \| "pivot"` (default `"labyrinth"`) al record de
`labyrinths.json` — las filas pivot viven ahí, sin archivo nuevo ni import nuevo. Alternativa más limpia
pero con más archivos: `content/pivots.json` propio. **Preferencia: reusar `labyrinths.json` + campo `kind`.**

## 2. Campos imprescindibles del record pivot

Exactamente los pedidos (mapea 1:1 al record de labyrinth + `kind`):

| Campo | Fuente | Nota |
|---|---|---|
| `id` | autorado | estable |
| `piece` | autorado | `"bishop"` |
| `kind` | autorado | `"pivot"` |
| `mover` (start) | autorado | casilla del alfil |
| `target` | autorado | mismo color que start (obligatorio) |
| `obstacles` | **vía FEN** | caballos blancos (no columna aparte, igual que exercises/labyrinths) |
| `title` | autorado | user-facing |
| `principle` | autorado | slug único |
| `playerPrompt` | autorado | enuncia la regla, no la solución |
| `order` | autorado | 0/1/2 |
| `optimalMoves` | **derivado (BFS)** | no se almacena; lint exige `=2` |
| `connectors` | **derivado (runtime)** | `isConnectingPivot` — **NO se almacenan** |

## 3. Connectors derivados en runtime (no se almacenan)

`isConnectingPivot(start, target, candidate, blockers)` es **geometría pura y determinista** (rayos del
alfil + no-colinealidad). El conjunto de connectors usables se recomputa en runtime desde `start/target/
obstacles`. No hay caso no-determinista → **no se almacenan connectors**. (Verificado por el helper del spike + sus 8 unit tests.)

**Necesidad de blocker en pivot (definición correcta para esta mecánica):** un blocker es necesario si
**cambia el conjunto de connectors usables**, NO si cambia `optimalMoves` (que permanece 2). Bajo la
definición de `optimalMoves` un blocker de pivot parecería "decorativo"; la métrica válida aquí es el set de connectors.

---

## 4. FEN de Blocked Connection (order 2) — diseñado y validado

```
FEN:    8/8/3N4/8/1B6/8/8/8 w - - 0 1
piece:  bishop   kind: pivot   order: 2
mover:  b4       target: f4
```

| Propiedad | Valor | ✔ |
|---|---|---|
| start | b4 (oscura) | |
| target | f4 (oscura) — **mismo color** | ✅ |
| connectors geométricos (sin blocker) | **d2, d6** (exactamente dos) | ✅ |
| connector bloqueado | **d6** (caballo amigo `N`) | ✅ |
| connector correcto/usable | **d2** (exactamente uno) | ✅ |
| optimalMoves (con blocker) | **2** | ✅ |
| blockers | 1 caballo blanco en d6 | ✅ |
| ¿target alcanzable en 1 (sin pivote)? | no (exige connector) | ✅ |

**Por qué el blocker es necesario (no decorativo):** sin él hay **2** connectors usables (d2, d6); con él
hay **1** (d2). El blocker es justo lo que crea la decisión "descartá el conector obvio bloqueado". Removerlo
destruye la lección. Es **un solo** blocker y es necesario.

**Distinción visual de bishop-6/7:** bishop-6 = b2→f2 (fila 2, opt 3), bishop-7 = c3→g3 (fila 3, opt 3,
ambos pivotes bloqueados). Este es **b4→f4 (fila 4), opt 2**, con un caballo alto en d6 y un solo blocker.
Distinto en fila, en conteo de movimientos y en patrón de bloqueo. No colisiona con ninguna posición existente.

Validación corrida (`isConnectingPivot` + BFS, mismo semántica del motor):
`connectors sin blocker = {d2,d6}` · `con blocker = {d2}` · `d6→false` · `d2→true` · `opt=2`.

---

## 5. Los tres niveles (todos opt = 2)

| order | title | principle | FEN | start→target | connectors usables |
|---|---|---|---|---|---|
| 0 | The Connector | `single-connector` | `8/8/8/8/8/8/8/B7 w - - 0 1` | a1→g1 | {d4} |
| 1 | Two Connections | `connector-choice` | `8/8/8/8/8/2B5/8/8 w - - 0 1` | c3→g3 | {e5, e1} |
| 2 | Blocked Connection | `blocked-connector` | `8/8/3N4/8/1B6/8/8/8 w - - 0 1` | b4→f4 | {d2} (d6 bloqueado) |

Copy `playerPrompt` (borrador, a i18n en B4.2): "Toca la casilla que conecta las dos diagonales." /
L2: "Hay dos casillas que conectan — cualquiera sirve." / L3: "Una conexión está bloqueada. Encontrá la otra."

---

## 6. Alcance y kill-criteria (confirmados en el diseño)

- **MEDIUM**: un `kind` nuevo reutilizando el pipeline labyrinth; sin multi-target, sin motor de rutas
  nuevo, sin framework, sin segundo board (B4.2 intercepta la interacción sobre el board canónico).
- Connectors derivados → cero almacenamiento nuevo.
- Ningún kill-criterion se dispara en el diseño.

---

## 7. STOP — aprobación humana requerida antes de B4.2

**Pendiente de tu OK:**
1. El `kind:"pivot"` reusando `labyrinths.json` + campo `kind` (vs. `pivots.json` propio).
2. El FEN de Blocked Connection `8/8/3N4/8/1B6/8/8/8` (b4→f4, d6 bloqueado, d2 usable).
3. Los 3 títulos/principles/prompts provisionales.

**No** se implementó producción. **No** hay commit. Fin de B4.1.
