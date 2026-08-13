# Session Handoff — 2026-08-13 (tarde)

## Completed
- **El builder abre por PIEZA y por su TABLA** (`6f15978d`) — el bucle real de autoría
  (elegir pieza → abrir un record) eran los dos paneles más separados de la página, con la
  tabla **al fondo**. Ahora son los dos primeros y son contiguos.
- **Primitivas de chrome para `/dev`** (`ea000d0a`) — `Section`/`Field`/`Segmented`/
  `Legend`/`Mono`. Encodean estructura (h2 real, label real, `aria-pressed`), no estética.
- **Cada columna scrollea sola y el header no se mueve** (`77d01b0e`) — la página ya no
  scrollea; el header está **fuera** de los contenedores de scroll.
- **⭐ `Unsaved changes in <id>` + Discard** (`330f3561`) — las tres acciones que reemplazan
  el borrador (abrir otro record, `New`, cambiar de bucket) pasan por una guarda. Antes la
  edición desaparecía sin aviso, sin undo y sin rastro.
- **Validado a mano en `localhost:3002` en cada paso**, no sólo por tests — así aparecieron
  dos defectos que ningún test veía (ver Notes).

## Current State
- **Branch**: `main` — **11 commits sin pushear**
- **Build**: `tsc` exit 0; lint sin avisos nuevos; Vitest web **647 archivos / 7916 tests**
  (baseline medida hoy en `main` limpio: **643 / 7871**; el delta son mis 4 archivos y 45
  tests). El VR **no aplica**: `visual-regression.spec.ts` tiene **0** referencias a
  `labyrinth-builder`.
- **Uncommitted work**: `SESSION.md` + el handoff
- **PRs abiertos**: ninguno

## Next Tasks
1. **Tres ítems del mockup**, ninguno urgente ahora que el ⭐ cerró: nombre en vez de id en
   la librería, badge de TIER con la tabla ordenada por dificultad, fila en estado
   `Editing`.
2. **P2P** — sin spec. ⚠️ Si va a tener algo de valor en juego, su spec debe incluir
   server-verified progress: hoy el riesgo está aceptado *porque* nada vale.
3. **Theme builder** — marketplace de creadores; el más grande y el que menos urge.
4. **Terminar de convertir**: 30 tableros, sobre todo laberintos de caballo (5) y dama (3).

## Blockers
- None.

## Open questions
- **¿Agrandamos el tablero del builder?** 349 px de grilla en 1440. Es el tamaño de siempre,
  así que no lo toqué — es **una línea** (`maxWidth` a `ProceduralBoard`).
- **¿El chrome nuevo se extiende al resto de `/dev/*`?** Las primitivas ya están; ~35 páginas.
- **La fila activa de la lista no dice que tiene cambios sin guardar** — el punto celeste
  vive en el chip del header. Si en el uso confunde, es un punto más.

## Notes
- ⛔ **El tablero del builder es `ProceduralBoard`, intacto.** El mock del founder dibujaba
  uno propio y no entró.
- ⚠️ **La columna del tablero en `26rem` no es al azar**: `GameBoard` se capea solo en
  `maxWidth = "23.5rem"`. Para agrandarlo hay que pasar `maxWidth`, no ensanchar el track.
- ⚠️ **`min-h-0` en los dos tracks del grid no es decorativo**: sin él el overflow se escapa
  a la página y las columnas dejan de scrollear solas.
- ⛔ **En `dirty.ts` la asimetría manda**: falso positivo = un click de más; falso negativo =
  edición destruida. Sólo se normaliza el orden de `walls` y `enemies` (probado: la grilla
  8×8 de `buildFenBlock` se come el orden). `extraGoals` **no** — viaja ordenado a `targets`.
  Los enemies se comparan `casilla:pieza`, o una torre negra retipada a peón daría "limpio".
- ⚠️ **Elegir pieza sobre un borrador limpio NO ensucia** — el selector es también el filtro
  de la lista. Si cada browse diera alarma, la guarda quedaría desentrenada en un día.
- ⚠️ **Dos defectos que sólo aparecieron USÁNDOLO**: (1) el cartel de la guarda se scrolleaba
  fuera de vista al hacer click en `Edit` — disparaba, salvaba el borrador, y en pantalla no
  parecía pasar nada (por eso es `sticky` y opaco); (2) los `35rem` de columna no agrandaban
  el tablero, sólo dejaban aire muerto.
- ⚠️ **Un orden de paneles no lo delata NADA** (sin comportamiento, `tsc` ciego, fuera del
  VR). Pineado en `__tests__/panel-order.test.tsx` **por heading**, con la lista stubeada
  **vacía** para no leer contenido autorado.
- ⚠️ **El nombre accesible de los botones de pieza es MINÚSCULA** (`rook`, `pawn`…); el
  `Rook` visible es `capitalize` de CSS. Una sonda que busque `"Pawn"` timeoutea.
- ⚠️ **Un `pnpm dev` arriba invalida la suite de Vitest** — bajarlo antes de medir. El
  síntoma es que BAJA el conteo de ARCHIVOS, no que se ponga roja. Y `TaskStop` mata el
  wrapper de pnpm pero **deja vivo el `next-server` hijo**: rematar con `pkill -f next-server`.
- **Verificar el deploy es del founder**, salvo pedido explícito.
- Handoff largo: `docs/handoffs/2026-08-13-exercise-builder-layout-handoff.md`
