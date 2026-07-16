# Plan — N-Queens (`kind: "queens"`)

Spec cerrado: `docs/specs/2026-07-16-signature-games-spec.md` §2. **No re-especificar.**
Referencia end-to-end: Knight's Tour (`docs/plans/2026-07-16-knight-tour-plan.md`), que dejó
la mitad del camino hecho.

## Lo que YA está resuelto por el tour (no re-derivar)

| Pieza | Estado |
|---|---|
| **Grader de cobertura** | ✅ `tourStars(placed, N)` en `lib/game/tour-score.ts` sirve **tal cual** — califica % de un conjunto. `TOUR_PASS_RATIO = 0.8`. |
| **Ledger ascendente** | ✅ `recordTourBest` — más es mejor. Sirve tal cual. |
| **Kind sin `target`** | ✅ El branch ya existe en `fen-puzzle.ts` (`isTour`) y `catalog.ts`. Queens lo replica. |
| **Bucket + contexto + merge** | ✅ Patrón mecánico: espejar `knightTour` en 6 archivos. |
| **Capa de ataque** | ✅ **`getQueenMoves(origin, blockers)` YA corta los rayos en los bloqueadores** (`lib/game/rules/queen.ts` compone rook+bishop). Queens **NO necesita** la cirugía `{pos, piece}` — confirmado leyendo el código, no asumido. |

## Modelo de datos — el paralelo exacto con el tour

- `optimalMoves` = **techo − 1** = las damas que el jugador coloca (el sistema pone la #1).
- Denominador del score = `optimalMoves + 1` = **techo** = damas totales.
- Score = `colocadas / techo`, incluyendo la #1 — igual que el tour cuenta la casilla de inicio.
- `targetPos` = `startPos` (centinela "sin destino"), igual que el tour.

Esto hace que `buildTrainingPath` funcione con **cero cambios de fórmula**:
`tourStars(best, optimalMoves + 1)` ya es la línea que está en `path.ts`.

## 🔑 La diferencia buena: acá el techo SÍ es alcanzable

El tour arrastra un problema conocido → [[feedback_reachable_is_not_achievable]]: su techo es
BFS-alcanzable, una **cota superior** que un jugador puede no lograr (el camino más largo sin
repetir es NP-hard). Por eso hubo que filtrar niveles con Warnsdorff.

**Queens no tiene ese problema.** El máximo de damas no-atacantes dado (dama #1 fija + bloques)
se computa **exacto** con backtracking: 8×8, ≤ 8 damas, espacio de búsqueda trivial. El techo
que se guarda **es alcanzable por construcción**, así que el 80% siempre es jugable.

→ **Derivar N del solver, NO autorearlo.** El spec dice "el primer nivel apunta a ~6": eso
significa que el founder autorea una posición **cuyo techo da 6**, no que escriba un 6 que
podría ser mentira. Un N autoreado por encima del máximo real hace el nivel imposible en
silencio — el mismo trap que el tour, y acá es evitable gratis.

## Stages (TDD, commit atómico por stage)

1. **`lib/game/queens.ts`** — módulo puro:
   `attackedByQueens(queens, blocks)` (usa `getQueenMoves`; **cada dama bloquea a las otras**:
   los blockers de un rayo son bloques + las demás damas) · `safeSquares(queens, blocks)` ·
   `maxQueens(fixed, blocks)` (backtracking exacto = el techo) · `isQueensStuck`.
2. **Catálogo** — `kind: "queens"`, bucket `queens`, techo por solver, mismo branch sin `target`.
   Lint: rechazar techo < 4 (no es un juego).
3. **Niveles** — 2-3 placeholders con techo ~6. **Medir el techo, no autorearlo.**
4. **Board** — `queens-board.tsx`, hermano de `knight-tour-board.tsx`. Colocación por tap.
   Ilegal → **beat de ataque + overlay explicando, rechazar, SIN penalidad** (spec).
   Mini-tour de entrada: "select the queen and place it on the board."
5. **Host** — reusar `handleTourComplete` **renombrado a `handleCoverageComplete`** (es el mismo
   handler: cobertura contra techo). Chip de misión: `<dama> ×N` (spec) en la banda.
6. **i18n** `QUEENS_COPY` EN/ES — ⚠️ **el drawer DEBE rutear el título por i18n**
   (`specialTrainingLabels`): el fallback `entry.title` es copy de autoría **en inglés** y
   shippea en silencio a jugadores ES. Ya pasó con el tour (fix `162ea1ae`).
7. **Probe `/dev/queens`** — renderizar el board REAL, NO un spike copiado (el de Diagonal Run
   forkeó el juego y hoy hay dos implementaciones que nada sincroniza).
8. **e2e** — ruta determinista hasta stuck, hallada con el solver. **Nunca `if (stuck)` dentro
   del test**: pasa en verde sin verificar nada (ya me pasó en el tour).

## Refactor que este juego pide (hacerlo acá, no después)

`tourIds` en `TrainingPathInput` (`lib/training/path.ts`) queda mal nombrado con dos juegos
usándolo. **Renombrar a `coverageIds`**: "ids que califican por cobertura". Queens es el segundo
cliente; si se agrega un `queenIds` paralelo, la próxima pieza agrega un tercero.

Mismo criterio para `handleTourComplete` → `handleCoverageComplete`, y considerar mover
`tourStars`/`recordTourBest` a nombres neutrales (`coverageStars` / `recordCoverageBest`) —
el módulo `tour-score.ts` ya se documenta como "set-covering games", no como cosa del caballo.

## Decisión abierta (preguntarle al founder ANTES de codear)

**¿Los bloques rompen los rayos para "abrir posibilidades" (spec §2 última línea)?** Leyendo el
código, `getQueenMoves` ya lo hace: un bloque entre dos damas las deja convivir en la misma línea.
Eso es ajedrecísticamente correcto Y es lo que el spec insinúa. Asumir que sí, pero confirmarlo:
cambia por completo el diseño de niveles (y el techo).

## Gate

Suite verde + `tsc` limpio **antes** del merge local. Branch → commits atómicos →
`merge --no-ff` → UN push. **El deploy NO se verifica** → `CLAUDE.md` §"Verificación de deploys".
