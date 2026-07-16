# Handoff — N-Queens shipped (2026-07-16)

Merge `2d42d53b` a `main`. 13 commits atómicos. Suite **5212/5212 (444 files)** ·
`tsc --noEmit` limpio · e2e queens **12/12** (`--project=minipay`).

## Qué se construyó

El juego firma de la dama (`kind: "queens"`), end to end: módulo puro · catálogo con
techo por solver · 3 niveles · board · host · i18n EN/ES · probe `/dev/queens` · e2e.

**El invariante que lo define**: el techo es **exacto**, no una cota superior.
`maxQueens` hace backtracking sobre la colocación real, así que lo que guarda el
catálogo es alcanzable por construcción y el 80% siempre es jugable. Es la diferencia
con el tour, cuyo techo es BFS-alcanzable → [[feedback_reachable_is_not_achievable]].

**Regla del founder (2026-07-16)**: los bloques **rompen los rayos** de la dama. Un bloque
entre dos damas las deja convivir en la misma línea. Por eso `queens-3` mete **nueve** damas
en un 8×8 que solo admite ocho — el nivel que enseña la regla.

## Hallazgos que el trabajo destapó (no eran de queens)

1. **`getRookMoves` corta el rayo ANTES del bloqueador** (`rules/rook.ts:38`): modela piezas
   propias, así que la casilla bloqueadora **no** queda atacada. El plan afirmaba que
   `getQueenMoves` servía tal cual para la capa de ataque; servía a medias. Pasar **solo los
   bloques** es el modelo correcto: en posición legal una dama nunca puede escudar a otra.
2. **El unlock mentía a 5 de 6 piezas.** `PROGRESSION_COPY` está keyed por milestone, así que
   "First Maze Unlocked / Guide the rook through it" saludaba a todas. Arreglado con `byPiece`
   + tests locale-aware. **Ya estaba en producción desde antes del tour.**
3. **El chip enmarcaba juegos de cobertura con "Move to"**: el tour venía diciendo
   "Move to Cover 80%". Arreglado con `coverageMode`.
4. **El fix i18n del tour (`162ea1ae`) shippeó sin tests.** El ruteo vivía en un componente de
   3000 líneas. Extraído a `lib/content/special-training-labels.ts` con guardián: ningún juego
   firma puede renderizar copy de autoría (inglés).

## Decisiones de producto tomadas en review (founder)

- **Sin puntos de casillas seguras en el juego.** "Qué casillas son seguras" ES el puzzle;
  marcarlas lo reemplaza por tap-the-dot. `showSafeSquares` queda como ayuda de **autoría**
  (builder + toggle en `/dev/queens`, apagado por defecto para que el probe fotografíe lo que
  se shippea). El spec ya lo decía: "rechazar sin penalidad, reintentar libremente" solo
  significa algo si el jugador razona y arriesga.
- **Sin peaje de selección.** El tour necesita seleccionar porque movés *ese* caballo; acá cada
  tap coloca una dama *nueva*. El spec pedía un mini-tour (momento instructivo), no una puerta.
- **El chip es contador** (`dama 1/5`), la banda lleva el objetivo. Antes la banda llevaba ambos
  y truncaba la frase — lo único que un jugador trabado necesita leer.

## Pendiente

### Del founder (no agendado)
1. **Niveles**: los 3 son andamio, construidos para medir. Se afinan en
   `/dev/labyrinth-builder`; el techo se recalcula solo. **No hace falta tocar código.**
2. **Overlay TRY AGAIN + feedback por pieza al fallar** — para **todas** las piezas, no solo
   la dama: un beat corto + el objetivo en una línea. Es una capa sobre la mecánica.
3. **Maestría de la dama**: quien completó `queen-lab-1..3` y reclamó el badge **pierde la
   maestría** (`complete` → `available`), porque el pool ahora exige `queens-1..3`. Le pasó
   igual al alfil y al caballo. Decisión diferida del founder.

### Siguiente juego firma
4. **Safe Path (rey) + Promotion Run (peón)** — spec §3/§4. **JUNTOS, nunca separados**:
   comparten la cirugía `{pos, piece}` + capa de ataque (plan §15.6.3). **No son los baratos.**

### Cluster closure (pendiente de este merge)
5. GitHub housekeeping (issues/milestone), README sync si cambió "What's live", MEMORY.md sync.

### Deuda preexistente (no tocada)
- El probe de Diagonal Run forkeó el board en un spike copiado
  (`components/dev/diagonal-run-spike.tsx`) — dos implementaciones sin nada que las sincronice.
  Los probes del tour y de queens renderizan el board REAL para no repetirlo.
- 4 duplicados de ejercicios (`docs/audits/2026-07-16-exercise-redundancy-audit.md`).
- `contextual-header.spec.ts` falla 6/6 — **PREEXISTENTE**, no es regresión.
- VR `hub-shop-sheet-open` roja también en `main` (env sin treasury). No perseguir.

## Notas para la próxima sesión

- ⚠️ **El patrón del tour es un mal default.** Tres veces esta sesión el spec decía una cosa y
  yo implementé el patrón del tour: los puntos, el chip ("counter chip" era literal), y la
  puerta de selección ("mini-tour" era instructivo). **Leer el spec antes que el hermano.**
- ⚠️ **Metacaracteres de zsh en `git commit -m`**: `?? []` se lo comió como glob y mutiló el
  mensaje — mismo modo de falla que los backticks
  ([[feedback_backticks_in_commit_messages_get_eaten]]). Usar `git commit -F <archivo>`.
- ⚠️ **`git checkout -- <archivo>` para revertir una mutación se lleva TODO lo no commiteado
  de ese archivo.** Me pisó un cambio ICU. Revertir la mutación, no el archivo.
- Los deploys los verifica el founder → `CLAUDE.md` §"Verificación de deploys".
