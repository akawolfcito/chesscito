# Session Handoff — 2026-07-16

> Decí **"continuemos"** y el agente lee este archivo y sigue.

## Completed

- **PROMOTION RUN — etapa 8 de 10: CONTENIDO** (`617bdb4`). Los tres niveles del peón están en el
  catálogo (`pawn-promotion-1/2/3`), medidos por el solver. Suite **5316/5316** (450 files), `tsc`
  limpio, `import-puzzles` sin errores (sus 12 warnings son todos preexistentes).
  - ⚠️ **Promotion Run es la primera kind SIN casilla objetivo que NO se gradúa por cobertura.**
    Corona en una **FILA**: el solver corona en a8 en un nivel dibujado sobre la columna c, así que
    un `target` fijo miente. `isCoverageKind` significaba dos cosas a la vez (no-tiene-target Y
    cobertura) → separado en `isTargetlessKind` (targeting) + `isCoverageKind` (grading). Un
    predicado con dos significados es cómo un porcentaje termina donde va un contador de movidas.
  - ⛔ **`optimalMoves` NO puede graduar este juego, y nunca va a poder.** Cada movida del peón sube
    exactamente una fila → **toda corrida ganadora desde la fila r mide exactamente `7-r`**. La ruta
    más fácil y la más difícil miden IGUAL. Lo que las separa son las **capturas** → el warning de
    "nunca captura" cuenta **cambios de columna**, que es exacto (un peón no tiene otra forma de
    dejar su columna). **Esto le llega a la etapa 10**: las estrellas por movidas darían 3★ siempre.
  - **El lint mentía sobre los muros.** El peel decorativo declaró droppable el muro **b6** de
    `pawn-promotion-2`, con "optimal 0" — y b6 es lo único que fuerza la **segunda** captura del
    sketch del founder. No se equivocaba sobre el nivel, se equivocaba sobre el **juego**: rutea
    peones en diagonal sobre casillas vacías. Las kinds con solver propio ahora están exentas por
    nombre (**`OWN_SOLVER_KINDS`**), la misma decisión que las de cobertura ya tenían. Safe Path
    entró a la exención también: hoy no dispara (ningún nivel del rey tiene muros), pero es la misma
    pregunta equivocada esperando.
  - **Nivel 3 está medido, no razonado**: sacá el caballo que vigila y el solver toma la columna b;
    con él, se ve forzado a la d. La amenaza decide la ruta, no es decoración.
  - ⚠️ **Abierto para el founder — la misión de `pawn-promotion-3` pide CABALLO y es andamio.** Sin
    una razón *en el tablero* para querer un caballo (un mate, un tenedor), la misión enseña a
    obedecer, no ajedrez. P4 (cadena de valores) es de la etapa 10: ahí se decide si el nivel gana
    su pedido o si pasa a dama.

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
- **SAFE PATH — TERMINADO Y EN EL JUEGO** (6/6). El rey ya tiene su juego firma en `/exercises`
  (carril Special Training) y en el probe `/dev/safe-path`. Suite **5281/5281** (448 files), `tsc`
  limpio, **e2e 7/7**.
  - `cb9cff0` **etapa 4 — contenido**. 3 niveles (`king-safe-1/2/3`), bucket propio, y el BFS genérico
    se **saltea** (camina al rey con `getKingMoves`, que no sabe de amenazas). Nivel injugable = error
    de import. **Warning nuevo**: si la ruta segura == la caminata libre, las amenazas son decorativas.
    ⚠️ Dos trampas de autoría: el refugio es una **casilla vacía** (pieza blanca encima = muro = nunca
    llega) y una torre negra en d8 vigila **toda la fila 8**, refugio incluido.
  - `3b5311f` **etapa 5 — tablero + probe**. Pisar vigilado es **tappable y mata** (lo opuesto a queens,
    que rechaza). Zonas invisibles al jugador; el toggle **Zones** del probe es la superficie de autoría.
  - `701c6f2` **review del founder**: gate de selección (rey empieza sin levantar, zoom, "Tap your piece
    first"), refugio con arte `refuge.png` + glow verde-amarillo, y **láser** desde el enemigo que lo vio.
  - `b2b40ca` **etapa 6 — cableado**. Reemplaza el laberinto de relleno del rey. ⚠️ **Es el PRIMER juego
    de Special Training que se puede PERDER** → toma prestada la máquina de fallo de ejercicios entera
    (phase, modal, gate FTUX, auto-reset). Escudos: gratis, `use-fail-rescue` ya era genérico.
  - `93aae14` **beat de ataque, 850ms** antes del fallo: el modal tapaba el láser y el jugador leía
    "caught" sin ver **de qué**. Medido en pantalla real: láser a 53ms, modal a 924ms → 871ms de rayo
    limpio (antes ~0). El timer vive en un ref y se cancela en `resetBoard` + unmount.
    ⚠️ **`SAFE_PATH_ATTACK_BEAT_MS` (850) debe quedar POR ENCIMA** de los 460ms de
    `.playhub-board-laser`; si se retimea la animación, retimear esto.
- **PROMOTION RUN (peón) — lógica pura hecha** (etapa 7 de 10), `ee793fd`. **Decisiones del founder
  cerradas** en el plan §3.3 (P1-P6). Lo que el spec dejaba abierto ya no lo está:
  - **El mapa de ataque SÍ aplica** y es la misma regla del rey (caés en vigilada, te comen → TRY
    AGAIN → escudos, por la máquina que Safe Path ya cableó). **Pero es VIVO**: el peón come, y el
    comido deja de vigilar.
  - ⚠️ **El mapa dinámico es barato SOLO acá, y la razón es la regla del peón: nunca retrocede.**
    Cada movida sube exactamente una fila → grafo DAG de ≤6 plies × 3 ramas → **~3⁶ caminos**. El
    solver los enumera TODOS y es exacto por fuerza bruta. **NO llevar esto al rey**: capturar +
    deambular es búsqueda cíclica sobre (posición × sobrevivientes), que es justo lo que D1 evita.
  - ⛔ **REVIERTE D7 (auto-dama)**: la misión nombra la pieza a coronar ("coroná una dama o un
    caballo") → **elegir ES la mecánica**, el selector entra al MVP. La misión es contrato tipado
    (`{ promoteTo }`), no una dama hardcodeada.
  - **Par de alfiles: diferido** (§3.5), y **no por costo** — es una 2da condición de victoria y
    enseña una lección *del alfil* dentro del juego *del peón*, que ya tiene la suya.
  - ⚠️ **Trampas de autoría que encontré midiendo, no razonando** (viven en los tests):
    la víctima está viva en todos los pasos previos, así que **no puede atacar el arranque ni el
    camino** — un caballo en b4 ataca **c2**, y el peón muere antes de mover. Las dos víctimas del
    sketch son **torres, y es forzado**. · La Ta6 del founder **no amenaza** a través del muro en b6
    (su sketch no tenía muros): el equivalente es **h6**. · Y dejada en a6, esa torre **no amenaza:
    ALIMENTA** — `b5 ×a6` es una captura nueva y el peón corona por la columna a. **Sumar un enemigo
    puede hacer el nivel más fácil**: los enemigos son los escalones.
- **Safe Path — lógica pura** (etapas 1-3). Plan aprobado por el founder:
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

- **Branch**: `main` limpia y **sincronizada con `origin/main`** (verificado contra el remoto, no
  contra la ref local). El trabajo de la sesión es `617bdb4`; arriba va solo este handoff.
  **Sin PRs abiertos** — todo fue push directo a `main`.
  **Safe Path CERRADO** (el founder lo aprobó, "me gusta bastante"). **Promotion Run: 8 de 10.**
- **Build**: passing **medido en este árbol** — vitest **5316/5316** (450 files), `tsc --noEmit` exit 0.
  El `Error: boom` del output es ruido intencional de `primitive-boundary.test.tsx`.
- **Uncommitted work**: no. Árbol limpio.

## Next Tasks

1. **Afinar los 3 niveles del rey** (founder, no requiere código): `/dev/safe-path` con **Zones on** es
   la superficie — el juego no dibuja las zonas, así que sin ese toggle no se puede diseñar. Los tres
   son andamio a propósito. ⚠️ `/dev/labyrinth-builder` **NO conoce `safe-path`** todavía: no sabe
   dibujar enemigos typed ni el mapa de amenaza. Si el founder quiere autorar ahí, es trabajo aparte.
2. **⬅️ ESTO SIGUE — Promotion Run, etapa 9 de 10: TABLERO + PROBE.** `promotion-run-board.tsx` +
   `/dev/promotion-run` que **dibuja el mapa de amenaza** (D3, el toggle Zones es la superficie de
   autoría — igual que `/dev/safe-path`). El contenido (8) ya está en el catálogo, en
   `GENERATED_PROMOTION_RUN`. Ojo con lo que el tablero tiene que hacer distinto a Safe Path: el mapa
   es **VIVO** (P2 — el comido deja de vigilar, recalcular por posición) y las negras son **las dos
   cosas a la vez**: víctimas para comer y ojos que matan. Después: **10** (host — **reusa la ruta de
   fallo de Safe Path tal cual** — + selector de promoción + cadena de valores + i18n + e2e). Plan §4.
   Cierra el carril 2 (**6/6**).
   - ⚠️ **La etapa 10 hereda un problema de grading que la 8 destapó**: toda corrida ganadora mide lo
     mismo (`7 - fila_inicial`), así que `labyrinthStars` por movidas le da **3★ a cualquiera que
     gane**. Es el juego, no un bug: el peón no puede hacer una ruta más corta. Si las estrellas
     tienen que significar algo acá, hay que decidir **qué miden** (¿capturas?, ¿intentos?, ¿el
     escudo gastado?) — es decisión de producto, no de código.
3. **Triar 5 locales no-mergeadas** que el barrido no tocó (nunca estuvieron en la lista):
   `backup/main-before-author-rewrite` (huele a red de un rewrite de historia — **no borrar sin mirar**),
   `chore/minipay-gate`, `feat/board-renderer`, `feat/progression-unlocks-celebration-queue`,
   `phase-1-ui-zone-map`.
4. **Pendientes del founder del handoff de queens** (no agendados): afinar los 3 niveles en
   `/dev/labyrinth-builder` (**no hace falta tocar código**, el techo se recalcula solo) · **overlay
   TRY AGAIN + feedback al fallar, para TODAS las piezas** (el rey ya lo tiene; falta el resto) ·
   decidir la **maestría** perdida (Blockers).

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
- 🧮 **Los muros del contenido son caballos BLANCOS (`N`)**, las negras son los enemigos typed. Es la
  convención que ya usaban los `pawn-lab-*`, y `promotion-run` la hereda: el peel de obstáculos
  decorativos exige que los blockers sean caballos porque **el tablero los dibuja como caballos**.
- 📐 **El carril 2 hoy**: **4 de 6** piezas con juego firma (alfil → Diagonal Run, caballo → Knight's
  Tour, dama → N-Queens, **rey → Safe Path**). **Torre = 4 laberintos `rook-rail-*` curados** (su juego
  firma ES un laberinto). **Solo el peón** sigue en relleno sin título (4 labs) → Promotion Run lo cierra.
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
