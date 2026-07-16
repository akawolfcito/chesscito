# Session Handoff — 2026-07-16

> Decí **"continuemos"** y el agente lee este archivo y sigue.

## Completed

- **Cluster closure de N-Queens** — los puntos que el handoff dejó abiertos (menos branches):
  - Milestone **M13 "Future Features" cerrado** (sus 9 issues ya estaban cerrados; el milestone no).
  - **M14** verificado: #104 (treasure hunt) sigue abierto en su milestone correcto, a propósito.
  - **README sincronizado** (`dadd0403`): la tabla de gameplay afirmaba dos cosas **falsas** —
    "78 exercises" (son **59**) y "Exercises + labyrinths" para las 6 piezas (**tres** ya reemplazaron
    sus laberintos por su juego firma). Números tomados de `puzzles.generated.ts` + los lanes cableados
    en `exercises-screen.tsx`, no del README anterior.
  - **Memoria sincronizada**: `project_current_state` reemplazado (apuntaba a `2a815156` / "NEXT:
    N-Queens" — dos versiones atrás) y `project_signature_games_per_piece` corregido.
- **Branch protection en `main` y `production`** (pedido del founder): borrado y force-push denegados,
  **sin** required reviews ni status checks → el push directo sigue funcionando igual que antes.
  Verificado contra el servidor, no contra un dry-run.
- **Branch hygiene TERMINADA** — último punto del protocolo. **50 branches borradas**: 5 en `origin` +
  45 locales, todas con `git log origin/main..<b>` = 0 y borradas con `-d` (no `-D`). `origin` quedó con
  **solo `main` y `production`**. ⚠️ **El handoff decía "39 branches en origin" y era falso**: en el
  remoto quedaban 5; las ~45 eran locales.
- **`worktree-feat-pr4-learn-branding` mergeada** (`c699318b`, `--no-ff`). **`main` le mostraba
  "Chesscito Lite" al usuario** — `aria-label` del hub, manifest, `<title>`, OG/Twitter y la landing.
  Todo gateado por `CHESSCITO_MODE`: el default sigue diciendo "chesscito". Verificado buscando "Lite"
  **en el árbol del merge**: no sobrevive ningún string visible; solo quedan identificadores internos
  (`CHESSCITO_LITE_MODE`, `isLite`, `lite-stats`), que es el alcance declarado del commit.
- **SAFE PATH — la lógica pura está TERMINADA** (etapas 1-3 de 6). Plan aprobado por el founder:
  `docs/specs/2026-07-16-safe-path-promotion-run-plan.md` (**leerlo antes de seguir** — §3 son las 7
  decisiones D1-D7, §1 es lo que el código desmintió del spec padre).
  - `f3469bd` **etapa 1 — el modelo typed**. Hallazgo: **el FEN siempre supo el tipo**; `mapFenPuzzle`
    ya leía `p.type` y lo tiraba al aplanar. **El contenido NO necesita migración.** Y
    `fen-puzzle.ts:146` tiraba `FenError` ante cualquier negra si el mover no era peón → **Safe Path
    estaba bloqueado en el import**, cosa que el spec padre no menciona. `enemies` es **aditivo**: los
    27 call sites de `obstacles` no se enteraron.
  - `ed8e09a` **etapa 2 — `attack-map.ts`**. **Ningún** módulo de `rules/*` sirve, cada uno falla
    distinto (tabla en el plan §1.3). El peor es el peón: es una función de *movimiento*.
  - `3e66ba0` **fix — los muros cortan el rayo**. El primer corte de attack-map solo conocía enemigos.
    Lo destapó el test del rodeo, no una review.
  - `b46ea46` **etapa 3 — `safe-path.ts`**. `legalKingSteps` (puede pisar) vs `isCaught` (lo matan) van
    **separados a propósito**: fusionarlos reconstruye un laberinto de muros y borra la lección.

## Current State

- **Branch**: `main` = `b46ea46`. ⚠️ **ADELANTADA a `origin/main`**: pusheé hasta `8ade8d10`, así que
  los 4 commits de Safe Path (`f3469bd`, `ed8e09a`, `3e66ba0`, `b46ea46`) **están sin pushear**.
- **Build**: passing **medido en este árbol** — vitest **5252/5252** (446 files), `tsc --noEmit` exit 0.
  El `Error: boom` del output es ruido intencional de `primitive-boundary.test.tsx`.
- **Uncommitted work**: no.

## Next Tasks

0. **Pushear `main`** (`b46ea46`) — 4 commits de Safe Path sin pushear.
1. **EN CURSO — Safe Path, etapa 4 de 6: CONTENIDO.** Las etapas 1-3 (lógica pura) están hechas. Sigue:
   dar de alta el kind `safe-path` en `content/labyrinths.json` + niveles placeholder, y que
   `import-puzzles` los verifique con `safePathOptimalMoves` (null = injugable = rechazar).
   **Los niveles son andamio a propósito** — el founder los pule en `/dev/labyrinth-builder`.
   Después: etapa 5 (`safe-path-board.tsx` + probe `/dev/safe-path` que **sí** dibuja las zonas, D3) y
   etapa 6 (host desde el catálogo runtime + `use-fail-rescue` + i18n + e2e). Tabla en el plan §4.
2. **Triar 5 locales no-mergeadas** que el barrido no tocó (nunca estuvieron en la lista):
   `backup/main-before-author-rewrite` (huele a red de un rewrite de historia — **no borrar sin mirar**),
   `chore/minipay-gate`, `feat/board-renderer`, `feat/progression-unlocks-celebration-queue`,
   `phase-1-ui-zone-map`.
3. **Pendientes del founder del handoff de queens** (no agendados): afinar los 3 niveles en
   `/dev/labyrinth-builder` (**no hace falta tocar código**, el techo se recalcula solo) · **overlay
   TRY AGAIN + feedback al fallar, para TODAS las piezas** · decidir la **maestría** perdida (Blockers).

## Blockers

- ✅ **RESUELTO — `origin/production` aparece en `git branch -r --merged origin/main`** (da 0 commits
  ahead). El barrido de hoy la excluyó **por nombre**, no por filtro, y sobrevivió. **La invariante
  sigue viva para el próximo barrido**: un `--merged` ciego borra `production`. La protección es la red,
  no el plan.
- ⏸️ **Maestría perdida (decisión diferida del founder):** quien completó `queen-lab-1..3` y reclamó el
  badge **pierde la maestría** (`complete` → `available`), porque el pool ahora exige `queens-1..3`.
  Le pasó igual al alfil y al caballo. Afecta a jugadores reales en producción.
- 🔴 **Spec de server-verified progress: NEEDS REVISION**, no va a `/tdd`. Su premisa es falsa:
  `computeExerciseBfsPath()` viaja en el bundle del cliente, así que re-ejecutarlo en el servidor prueba
  que la solución es **correcta**, nunca que un humano la **jugó**. Espera decisión de producto.
- ⛔ **NO tocar `BADGE_THRESHOLD`** hasta decidir el Belt System: el gate es un bit monótono y no se
  puede des-otorgar.

## Notes

- ⚠️ **`git push --dry-run` NO valida branch protection.** No llega a proponer el ref-update, así que
  imprime `[deleted] production` aunque el servidor lo rechace. La evidencia válida es
  `gh api repos/:owner/:repo/branches/<b>/protection`. Casi lo reporto como verificado.
- ⚠️ **`enforce_admins: false`** en ambas protecciones: borrado y force-push bloqueados, pero el founder
  puede levantar la regla desde Settings. Reversible a propósito. Subir a `true` si se quiere que nadie
  pueda, ni él.
- 🗑️ **`feat/spec-1-candy-polish` y `feat/spec-1-hub-redesign` (locales, del 2026-05-18) están muertas.**
  Su contenido ya aterrizó por otra vía (`candy-frame-amber` está en `globals.css`; `hero-cta.ts`,
  `compute-tier.ts`, `display-name.ts` están en `main`). Sobreviven al `--merged` porque sus tips no son
  ancestros, pero **`globals.css` pasó de ~5k a ~17.5k líneas desde entonces**: no se mergean, se
  reescriben. Único huérfano real: `hub-onboarding-card.tsx`, que nunca aterrizó. Borrables.
- 📐 **El carril 2 hoy**: 3 de 6 piezas con juego firma (alfil → Diagonal Run, caballo → Knight's Tour,
  dama → N-Queens). **Torre = 4 laberintos `rook-rail-*` curados** (su juego firma ES un laberinto).
  Peón (4 labs) y rey (1 lab) siguen en relleno sin título.
- ✅ **RESUELTO y era peor de lo que decía** — la nota de abajo culpaba a `getQueenMoves`. La verdad:
  **los 5 módulos de `rules/*` fallan**, cada uno distinto, y por eso `attack-map.ts` (`ed8e09a`) es
  módulo nuevo y no wrapper. **No volver a intentar reusar `rules/*` para amenazas.** Tabla completa
  en el plan §1.3. Nota original, por el registro:
- ⚠️ **`getQueenMoves` NO sirve tal cual para la capa de ataque** — el plan de queens afirmaba que sí y
  servía a medias. `getRookMoves` corta el rayo **ANTES** del bloqueador (`rules/rook.ts:38`): modela
  piezas propias, así que la bloqueadora no queda atacada. **Releer antes de empezar Safe Path**, que es
  exactamente una capa de amenaza.
- 🧯 Ruido conocido, **no perseguir**: `contextual-header.spec.ts` falla 6/6 (**preexistente**) · VR
  `hub-shop-sheet-open` roja también en `main` (env sin treasury).
- 📌 Los deploys los verifica el founder, visualmente. No es tarea mía (`CLAUDE.md`).
