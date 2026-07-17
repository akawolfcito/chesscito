# Session Handoff — 2026-07-16

> Decí **"continuemos"** y el agente lee este archivo y sigue.

## Completed

- **PROMOTION RUN — ETAPA 10 DE 10: CABLEADO. EL CARRIL 2 QUEDA 6/6.** Suite **5344/5344**
  (452 files), `tsc` limpio, **e2e del probe 28/28**. Cuatro commits:
  - `2dc3bad` **las estrellas cuentan FALLOS** (`promotionRunStars`). Decisión del founder. 3 limpio,
    −1 por fallo, **piso en 1** (quien murió cinco veces y coronó hizo lo que el nivel pidió).
    ⛔ **El escudo NO borra el fallo**: compra la consecuencia, no el registro — si no, 3★ serían
    comprables, y una estrella que se compra califica una billetera.
  - `05b21f7` **el selector de coronación**. **Reencuadra P4 por decisión del founder**: P4 decía
    "coronar enseña la cadena de valores (dama 9, torre 5…)", pero el jugador **todavía no sabe jugar
    un caballo** → "coroná caballo y das mate" es una frase que no puede evaluar, y obedecerla enseña
    obediencia. La lección de esta etapa es **"un peón que cruza INVOCA la pieza que elijas"**. Los
    números vuelven cuando haya un nivel que se los gane. El modal **dice la misión en claro**
    (condición explícita del founder para que errar cueste algo) y ofrece **las cuatro siempre**, sin
    pre-marcar la pedida.
  - `1f471d3` **el host**. ⚠️ **DOS formas de fallar, UNA promesa del escudo**: te comen, o coronás
    mal → **las dos vuelven al inicio**. El founder propuso primero que el escudo comprara un
    *re-pick* y después dijo de conservar el comportamiento anterior si costaba mucho. **No solo
    cuesta menos: es la máquina más segura** — un escudo que significa "al inicio" acá y "solo
    reelegí" allá es UN token con dos sentidos, y eso deriva.
    ⚠️ **`handleLabyrinthMove` ahora acepta un grader inyectado** (`{metric, starsFor}`). Se inyecta
    la **función**, no un número de estrellas, porque **el best se guarda y se RE-gradúa**:
    `previousBest` tiene que pasar por el mismo grader o el ledger compara fallos contra una escala
    de movidas e inventa estrellas en silencio. Los dos son `number`; nada se quejaría.
  - `01ce87b` **e2e del probe, 28/28**. Cada casilla **medida contra el solver** antes de escribirla.
  - 🧯 **Guard que no conocía**: `editorial.ts` tiene **techo de 0 em-dashes**
    (`anti-ai-prose.test.ts`). El prompt del nivel 1 venía con uno copiado del JSON.

- ✅ **EL CABLEADO AL `/exercises` REAL: VERIFICADO POR EL FOUNDER** (2026-07-17, *"se ve muy bien;
  exactamente como lo esperaba"*). Era el único hueco: **ningún test monta el host** — cubren el
  selector solo, el tablero solo y el probe. ⚠️ **Ese hueco sigue abierto para el próximo cambio**:
  si alguien toca el carril, no hay red que avise. La evidencia es el ojo del founder, no la suite.

- **PROMOTION RUN — etapa 9 de 10: TABLERO + PROBE** (`a0ef796`). `promotion-run-board.tsx` +
  `/dev/promotion-run`. Suite **5333/5333** (451 files), `tsc` limpio, VR 58/59 (la roja es
  `hub-shop-sheet-open`, **preexistente en `main`**). **Falta solo la etapa 10** → cierra el carril 2 (6/6).
  - **Lo que NO se comparte con Safe Path, y es el juego**: el mapa de amenaza es **VIVO** (P2) →
    los enemigos son **estado**, no constante. Safe Path memoiza el mapa una vez por nivel porque
    sus enemigos son intocables (D1); acá el peón **se los come**. No es una optimización: los
    niveles **cuelgan su única ruta de eso** — el peón corona en casillas que siguen siendo mortales
    hasta que se come a quien las vigila. Un tablero que copiara el memo del rey los haría injugables.
  - El nivel de test se **midió contra el módulo puro antes** de escribirlo en los tests: peón c6,
    torre negra b7. `c7` es un empuje legal y una tumba; `xb7`→`b8` es la única corrida, y funciona
    **solo porque b8 estaba vigilada hasta que el peón se comió la torre**. Esa aserción es toda la
    diferencia con el tablero del rey.
  - ⛔ **Sin estrellas, a propósito.** El problema que destapó la etapa 8 llegó acá: toda corrida
    ganadora mide `7 - fila_inicial`, así que `labyrinthStars` da **3★ a cualquiera que gane**. El
    tablero reporta `(moves, optimal)` y **no dice nada del grado**; el probe lo dice en pantalla en
    vez de imprimir un número que no significa nada. **Qué miden las estrellas sigue abierto (etapa 10).**
  - **Zones (D3) dibuja el mapa VIVO** — uno congelado al arranque mentiría justo en el momento del
    que trata el nivel. Apagado por defecto: **confirmado por el founder** — el jugador deduce el
    peligro de las piezas o no aprende nada.
  - Muros = piedra (`.is-wall`), como todos los hermanos del carril. **Lo del caballo blanco es la
    convención del FEN, no del render** — el handoff anterior lo insinuaba al revés.
  - El adapter `PROMOTION_RUN` obligó a tocar el mock de `resolve-exercise-description.test.ts`, que
    enumera los exports generados a mano: **el mismo peaje que pagó cada juego firma al entrar**.

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

- **Branch**: `main`, árbol limpio. ⚠️ **8 commits SIN PUSHEAR** — `origin/main` sigue en `9a50f44`.
  **Sin PRs abiertos** — todo fue push directo a `main`.
  **Safe Path CERRADO** (el founder lo aprobó, "me gusta bastante").
  **PROMOTION RUN 10/10 — el carril 2 está COMPLETO: las 6 piezas con juego firma.**
- **Build**: passing **medido en este árbol** — vitest **5344/5344** (452 files), `tsc --noEmit` exit 0,
  **e2e del probe de promotion-run 28/28**. VR **58/59** medido en la etapa 9
  (`hub-shop-sheet-open` roja **también en `main`**, env sin treasury); **no lo re-corrí tras el
  cableado del host** — el carril del peón cambió, así que puede haber baselines que mirar.
  El `Error: boom` del output es ruido intencional de `primitive-boundary.test.tsx`.
- **Uncommitted work**: no. Árbol limpio.

## Next Tasks

1. **⬅️ ESTO SIGUE — EL BUILDER** (acordado con el founder, 2026-07-17). **No sabe autorar NINGÚN
   juego firma, y no falla ruidoso.** Solo conoce `exercise|labyrinth`
   (`labyrinth-builder/page.tsx:116`), **te los LISTA igual** porque los 5 comparten
   `labyrinths.json` (`baseline-write.ts:50` pisa el kind real con `"labyrinth"`), y al guardar el
   record se reemplaza **entero** (`:80`) con `kind` en `BUILDER_FIELDS` → **el `kind` se pierde** y
   el nivel **degrada a laberinto común**, con el BFS genérico y el lint de muros decorativos encima
   (las dos cosas que `OWN_SOLVER_KINDS` eximió por nombre porque MIENTEN sobre estos juegos).
   - ⚠️ **Tracé el código, NO ejecuté un guardado.** Primer paso: **medirlo** — ¿`buildCatalog` lo
     rechaza y falla ruidoso, o lo escribe corrupto? Ambas son malas; cuál es, no lo sé.
   - ⚠️ **Arreglar el `kind` NO alcanza**: no hay pincel para enemigos negros **typed** ni forma de
     dibujar el mapa de amenaza. **Los enemigos SON el juego.** Y el del peón es **vivo**.
   - 📐 **Bien hecho cubre los 5 juegos firma, no solo el peón.** Detalle completo:
     memoria `project_builder_only_knows_two_kinds`.
   - 🎯 Mientras tanto, la autoría real son los probes con **Zones on** (`/dev/promotion-run`,
     `/dev/safe-path`, `/dev/queens`) — ⚠️ gatean por `NODE_ENV`: **solo local, 404ean en preview**.
2. **Cluster Closure Protocol del carril 2** (CLAUDE.md) — el carril quedó **6/6**, es un cluster que
   cierra: issues + milestone · **README** (la tabla dice "Exercises + labyrinths" para piezas que ya
   no tienen laberintos: **con el peón ya son las 6**) · memoria · branches.
3. **Correr el VR** — no se re-corrió tras el cableado del host y **el carril del peón cambió**.
   Baseline de la etapa 9: 58/59 (`hub-shop-sheet-open` roja también en `main`, env sin treasury).
   ⚠️ **Un VR verde puede ser la foto de un error de Next**: mirar los baselines nuevos.
5. **Triar 5 locales no-mergeadas** que el barrido no tocó (nunca estuvieron en la lista):
   `backup/main-before-author-rewrite` (huele a red de un rewrite de historia — **no borrar sin mirar**),
   `chore/minipay-gate`, `feat/board-renderer`, `feat/progression-unlocks-celebration-queue`,
   `phase-1-ui-zone-map`.
6. **Pendientes del founder del handoff de queens** (no agendados): **overlay TRY AGAIN + feedback al
   fallar, para TODAS las piezas** (rey y peón ya lo tienen; falta el resto) · decidir la **maestría**
   perdida (Blockers).
   ⛔ **Borrado de acá**: "afinar los 3 niveles de queens en `/dev/labyrinth-builder`, no hace falta
   tocar código". **Era falso** y lo arrastraban dos handoffs — ver el punto 3.

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
