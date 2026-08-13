# Session Handoff — 2026-08-13 (tarde)

## Completed — el builder de ejercicios, cerrado y usado
El mockup del founder entró entero, y después **el founder lo usó de verdad** — de ahí
salieron cinco arreglos más que ningún test habría encontrado.

**Del mockup:**
- **Abre por PIEZA y por su TABLA** (`6f15978d`) — el bucle real de autoría eran los dos
  paneles más separados, con la tabla al fondo. Ahora son los dos primeros y contiguos.
- **Primitivas de chrome para `/dev`** (`ea000d0a`) — `Section`/`Field`/`Segmented`/
  `Legend`/`Mono`. Encodean estructura (h2 real, label real, `aria-pressed`), no estética.
- **Cada columna scrollea sola, el header no se mueve** (`77d01b0e`).
- **⭐ `Unsaved changes` + Discard** (`330f3561`) — antes se perdía una edición sin aviso.
- **Nombre, badge de TIER y `Editing` en la lista** (`77481f8e`), y la lista **abre por
  dificultad** (`2ca4eb76`, decisión del founder); `order` queda a un tap.

**De usarlo:**
- **Los avisos del save salen de la columna a un popup** (`82dbdc81`) y **dicen qué trato
  merece cada uno** — que era lo que faltaba, no el filtro.
- **La carrera del save, en dos mitades** (`c7a8684d`, `7120eb2e`, `3be103e8`) — guardar
  recarga la página y la recarga puede ganarle a la respuesta.
- **La franja de estado dice una línea**; el relato entero abre el popup (`02e4bbf7`).

## Current State
- **Branch**: `main` — **21 commits sin pushear** (13 de esta sesión)
- **Build**: `tsc` exit 0; lint sin avisos nuevos; Vitest web **653 archivos / 7981 tests,
  TODO en verde**, medido en árbol limpio, 142 s. (Baseline al abrir la sesión: **643 /
  7871** — el delta son 10 archivos y 110 tests míos.)
- El VR **no aplica**: `visual-regression.spec.ts` tiene **0** referencias a
  `labyrinth-builder`; la única ruta `/dev` que fotografía es `arena-shields-chip`.
- **Uncommitted work**: `SESSION.md` + el handoff
- **PRs abiertos**: ninguno

## Next Tasks
1. **P2P** — sin spec, la apuesta grande. ⚠️ Si va a tener algo de valor en juego, su spec
   **debe** incluir server-verified progress: hoy ese riesgo está aceptado *porque* nada vale.
2. **Theme builder** — marketplace de creadores; el más grande y el que menos urge.
3. **Terminar de convertir**: 30 tableros, sobre todo laberintos de caballo (5) y dama (3).
4. **Escribir descripciones**: ahora rinde el doble — quita el genérico "Exercise N" del
   juego **y** le pone nombre a la fila del builder (hoy ninguna existe).

## Blockers
- None.

## Open questions
- **¿Agrandamos el tablero del builder?** 349 px de grilla en 1440 — el tamaño de siempre.
  Es **una línea** (`maxWidth` a `ProceduralBoard`), no ensanchar el track del grid.
- **¿El chrome nuevo se extiende al resto de `/dev/*`?** Las primitivas ya están; ~35 páginas.
- **El chip `All (0)`** del popup aparece aunque no haya notas (caso: sólo "What happened").
  Si molesta, se esconde en una línea.

## Notes
- ⛔ **Guardar RECARGA la página, y la recarga le gana a la respuesta.** Estacionar el estado
  **antes** del request, con el valor pesimista. Me costó dos intentos y las dos fallas las
  encontró el founder → [[feedback_park_state_before_the_write_not_after]]
- ⚠️ **Una sonda que intercepta `/api/dev/publish` NO puede ver esa carrera**: sin escritura
  no hay Fast Refresh, y `page.reload()` no la reproduce.
- ⛔ **En `dirty.ts` la asimetría manda**: falso positivo = un click de más; falso negativo =
  edición destruida → [[project_the_builder_guards_unsaved_edits]]
- ⛔ **El tablero del builder es `ProceduralBoard`, intacto.** El mock dibujaba uno propio.
- ⚠️ **La columna del tablero en `26rem` no es al azar**: `GameBoard` se capea solo en
  `maxWidth = "23.5rem"`.
- ⚠️ **`min-h-0` en los dos tracks del grid no es decorativo**: sin él el overflow se escapa
  a la página y las columnas dejan de scrollear solas.
- ⛔ **El canal de avisos del save NO contiene errores** (bloquean el save y nunca llegan),
  así que un filtro por severidad ordena un solo balde dentro de sí mismo. El eje es el TIPO.
- ⚠️ **El audit de obstáculos decorativos miente en sweeps** — el popup lo dice ahora.
- ⚠️ **Los tests de CONTENIDO de una fila no indexan por posición** (`rowFor(id)`).
- ⚠️ **Esperar el HEADING de la lista no espera al fetch** — esperar las **filas**.
- ⚠️ **`userEvent.setup()` instala su propio stub de `navigator.clipboard`** y pisa el tuyo;
  como el componente envuelve el copy en try/catch, falla en silencio. Leer el valor de
  vuelta del clipboard de user-event.
- ⚠️ **El nombre accesible de los botones de pieza es MINÚSCULA** (`rook`, `pawn`…); el
  `Rook` visible es `capitalize` de CSS.
- ⚠️ **Un `pnpm dev` arriba invalida la suite de Vitest** — el síntoma es que BAJA el conteo
  de ARCHIVOS. Y `TaskStop` mata el wrapper de pnpm pero **deja vivo el `next-server` hijo**:
  rematar con `pkill -f next-server`.
- ⚠️ **El contenido de prueba del founder rompe 3 tests** (`rook-pedagogy`, `exercise-bfs`,
  `use-exercise-progress-telemetry`) — derivados de contenido, verdes contra `HEAD`. Si
  aparecen, mirar `git status` antes de culpar al código.
- **Verificar el deploy es del founder**, salvo pedido explícito.
- Handoff largo: `docs/handoffs/2026-08-13-exercise-builder-layout-handoff.md`
