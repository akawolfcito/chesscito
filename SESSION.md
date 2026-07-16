# Session Handoff — 2026-07-16 (Knight's Tour shipped · merged to main)

> Retomamos EXACTAMENTE acá cuando el usuario diga **"continuemos"**.
> **Próxima tarea: N-Queens** (`kind: "queens"`). Contrato cerrado, NO re-especificar:
> `docs/specs/2026-07-16-signature-games-spec.md` §2.

## Estado

- **`main` = merge de `feat/knight-tour` (`--no-ff`, 8 commits atómicos). Pusheado.**
- **Suite: vitest 5172/5172 (439 files) · `tsc --noEmit` limpio · e2e del tour 8/8**
  contra el board real en `--project=minipay`.
- 📌 **El deploy lo verifica el founder, visualmente. NO es tarea del agente** (2026-07-16) —
  ver `CLAUDE.md` §"Verificación de deploys". No lo pongas como próxima tarea.

## Qué se construyó — Knight's Tour, end to end

Patrón Diagonal Run completo: módulo puro → grader → catálogo → niveles → board → host →
i18n EN/ES → probe `/dev/knight-tour` → e2e.

| Pieza | Archivo |
|---|---|
| Reglas + techo alcanzable | `lib/game/knight-tour.ts` |
| **Grader propio** | `lib/game/tour-score.ts` (`tourStars`, `TOUR_PASS_RATIO = 0.8`) |
| **Ledger propio** | `recordTourBest` en `lib/game/labyrinth-progress.ts` |
| Board | `components/exercises/knight-tour-board.tsx` |
| Host | `handleTourComplete` en `exercises-screen.tsx` |
| Niveles | `knight-tour-1/2/3` en `content/labyrinths.json` |

## 📌 Lo que hay que saber (y que el código no grita solo)

1. **El carril de laberinto calificaría un tour MAL, y en silencio.** Los tres puntos:
   `labyrinthStars` queda **ciega** (cubrir N casillas cuesta N−1 movimientos = el `optimal`
   del nivel, así que toda corrida cae en la banda `<= optimal` → **3★ siempre**, tour perfecto
   y callejón de 3 saltos por igual); `recordLabyrinthBest` se **invierte** (guarda el número
   más chico → la peor corrida pisa a la mejor); y `buildTrainingPath` heredaba la ceguera.
   Los tres tienen test que fija el bug. **Ninguno se dobló**: el tour trae su propio grader,
   su propio ledger y su propio handler.
   > Mi premisa inicial era otra ("el tour completo saca 0★") y **el test la tumbó**. La
   > corrección está en `docs/plans/2026-07-16-knight-tour-plan.md`.

2. **`targetPos` de un tour es su casilla de INICIO** — centinela de "no hay destino".
   `Exercise.targetPos` se lee en 100+ lugares; un opcional le pasaba la factura a todos por
   un juego que nunca lo lee. `target` es opcional en el record **solo** para `knight-tour`.

3. **`optimalMoves` de un tour NO es un camino óptimo: es el techo alcanzable** (casillas − 1).

4. ⚠️ **DECISIÓN DE PRODUCTO PENDIENTE DE TU OK:** el juego firma **reemplaza** los laberintos
   crudos de la pieza en Special Training (el precedente que sentó el alfil: `bishop-lab-3/-4`
   siguen en contenido, sin poder elegirse). Aplicado al caballo, **`knight-lab-1..5` dejan de
   ser seleccionables**. Es **una línea** en `specialTrainingCatalog` (`exercises-screen.tsx`)
   si querés que convivan los dos carriles.

5. **La geometría del tablero NO es monótona** — la medición rechazó mi primer diseño de niveles:
   pilares dispersos (58 casillas) dan **55%** con Warnsdorff, **peor que el tablero abierto**
   (100%); y la banda 1-4 (63%) es peor que la 1-3 y la 1-5. **Un nivel puede pasar el catálogo
   y ser injugable al 80%.** Por eso el techo se **mide**, y el diseño fino es tuyo en el builder.
   Los tres que shippean: bandas 1-3 (24), 1-5 (40), 1-6 (48).

6. **El probe `/dev/knight-tour` renderiza el board REAL** (envuelto en `NextIntlClientProvider`),
   NO un spike copiado. El de Diagonal Run sí forkeó el juego
   (`components/dev/diagonal-run-spike.tsx`) y hoy hay dos implementaciones de las mismas reglas
   que nada mantiene sincronizadas. **Deuda registrada, no tocada.**

## Next Tasks (en orden)

### 1. [PRIMERO] N-Queens (`kind: "queens"`) — spec §2
**📋 PLAN YA ESCRITO: `docs/plans/2026-07-16-n-queens-plan.md`. Leerlo primero — tiene el modelo
de datos derivado, los stages, el refactor que pide y la pregunta abierta para el founder.**

Titulares:
- **`tourStars` y `recordTourBest` sirven TAL CUAL.** `optimalMoves` = techo − 1; denominador =
  `optimalMoves + 1`. `buildTrainingPath` funciona sin cambiar la fórmula.
- **`getQueenMoves(origin, blockers)` YA corta los rayos en los bloques** (`rules/queen.ts`) →
  Queens **NO** necesita la cirugía `{pos,piece}`. Verificado en el código.
- **El techo de Queens SÍ es alcanzable** (backtracking exacto en 8×8), a diferencia del tour →
  **derivar N del solver, NO autorearlo**.
- **Refactor que pide:** `tourIds` → `coverageIds` en `path.ts` (Queens es el 2º cliente; si se
  agrega un `queenIds` paralelo, la 3ª pieza agrega un tercero).

### 2+3. Safe Path + Promotion Run (JUNTOS, nunca separados)
Exigen la cirugía `{pos, piece}` + capa de ataque (plan §15.6.3). **No son los baratos.**
`MappedPuzzle` lleva las casillas **sin tipo de pieza** (`fen-puzzle.ts`) — el muro que A9
rechazó a propósito. Una torre no ataca como un alfil.

## Blockers

- Ninguno funcional.
- **`contextual-header.spec.ts` falla 6/6 — PREEXISTENTE**, no es regresión (su
  `bypassFirstVisit` no setea `chesscito:hub-tour:v1`).
- **VR `hub-shop-sheet-open` roja también en `main`** (env sin treasury). No perseguir.
- ⚠️ **`hub-clean` VR pasa cambios sin verlos** (`maxDiffPixelRatio: 0.005` ≈ 12k píxeles).
- **Deploy caveat**: regenerar el catálogo NO invalida el `unstable_cache` tag `"content"`.
  Un build fresco sí. E2E lo bypassa con `CONTENT_CACHE_DISABLED=1`.

## Deuda registrada (NO aplicada, a propósito)

- **4 duplicados de ejercicios** — `docs/audits/2026-07-16-exercise-redundancy-audit.md`:
  `pawn-3/pawn-4` · `queen-6/queen-10` · `king-2/king-4` · `king-6/king-9`. Son ediciones de
  tablero para el builder, no trabajo de motor.
- **El spike de Diagonal Run** duplica el board (ver punto 6).

## Notas

- Regenerar catálogo: `pnpm -C apps/web import-puzzles`; después `rm -rf apps/web/.next`.
- La banda de misión es **el hogar del status line** (`missionStatus` en `MissionPanelCandy`).
  El tour ya la usa (`12/24 · 50%`); el contador de Queens (`<dama> ×N`) va al mismo lugar.
- El founder pule niveles en `/dev/labyrinth-builder`. **Construir la mecánica, no perfeccionar niveles.**
