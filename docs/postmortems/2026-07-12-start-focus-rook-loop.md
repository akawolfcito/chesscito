# Postmortem — START FOCUS devolvía siempre al último ejercicio de la torre

- **Fecha:** 2026-07-12 · **Fixes:** `27c08be9`, `f28b4267`, `9dfa36c5`
- **Detectado por:** el founder, en device · **Severidad:** medio (recorrido roto, sin pérdida de estado)

## Síntoma

Entrar por **START FOCUS** siempre aterrizaba en el último ejercicio de la **torre** —
una pieza ya terminada, con badge minteado — y resolverlo devolvía al mismo lugar.

## Causalidad — tres puertas al rook

Toda esto era **deuda de Lite v1**, de cuando la torre era la única pieza jugable. Hoy se
juegan las seis.

**Puerta 1: el Content Loop solo miraba la torre.**
`const piece = LITE_PRIMARY_PIECE` — el loop evaluaba *siempre* el camino de la torre,
aunque el jugador viviera en el peón.

**Puerta 2: no podía salir de ella.**
`nextAvailablePiece: null` estaba **hardcodeado** en `use-hub-data`, lo que volvía la
variante `next-piece` **código inalcanzable**. Bajo ninguna condición el loop podía mandar
a otra pieza.

**Puerta 3: START FOCUS no lo escuchaba.**
Empujaba un `/exercises` pelado y **tiraba a la basura el `destination`** que el loop
acababa de derivar. `initialPiece` caía a su default `"rook"`, y la pantalla abría el
`currentId` de la torre: el último ejercicio ya resuelto, sin nada hacia dónde avanzar.

## Mis dos diagnósticos equivocados (el valor de este postmortem)

**Error 1.** Afirmé que la torre "todavía tenía trabajo" porque `rook-gen-00q06dtn` parecía
un ejercicio sin jugar. **Es un LABERINTO** (`GENERATED_LABYRINTHS`, no
`GENERATED_EXERCISES`). La torre estaba correctamente terminada.

**Error 2.** Después de arreglar las puertas 1 y 2, di el bug por muerto. El founder volvió
con el build correcto (`f28b426`) y el mismo síntoma: **quedaba la puerta 3**, los destinos
que no llevan `?piece=` (`daily-pending` → `/exercises?slot=daily`, y los de `destination:
null`).

**La lección:** *"arreglé la causa"* no es lo mismo que *"el síntoma murió"*. Solo el device
lo dice.

## Fix

- `selectPrimaryPiece` / `selectNextAvailablePiece` — puros, derivan la pieza de verdad.
- Los tres CTAs de camino (`continue-path`, `labyrinth-ready`, `improve-stars`) traían
  `?piece=rook` **cocido en la tabla**: razonar sobre una pieza y caminar al jugador a otra
  es el mismo bug. Ahora apuntan a la primaria.
- **`startFocusDestination` nombra la pieza en TODA entrada a `/exercises`.**
- `LITE_PRIMARY_PIECE` borrado junto con su último consumidor.

## Decisión de producto que salió de acá

**Los EJERCICIOS mandan el avance de pieza. Los laberintos NO retienen el foco.** La torre
tiene 4 laberintos; contarlos como "trabajo pendiente" habría dejado al jugador clavado en
una pieza cuyo badge ya reclamó. El laberinto es contenido lateral: **debe verse, no
secuestrar el camino.**

Wolfcito 🐾 @akawolfcito
