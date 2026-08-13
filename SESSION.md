# Session Handoff — 2026-08-13 (tarde)

## Completed
- **El builder abre por PIEZA y por su TABLA** (`6f15978d`) — el bucle real de autoría
  (elegir pieza → abrir un record) eran los dos paneles más separados de la página, con la
  tabla **al fondo** de una columna de varias pantallas. Ahora son los dos primeros y son
  contiguos; todo lo demás baja.
- **Primitivas de chrome para `/dev`** (`ea000d0a`) — `Section`/`Field`/`Segmented`/
  `Legend`/`Mono`. Encodean estructura (h2 real, label real, `aria-pressed`), no estética.
- **Barra fija** con `Save draft` + `Editing <id>`, columna de tablero **sticky**,
  **validación debajo del tablero**, herramientas en grid con icono y leyenda.
- **Cero funcionalidad agregada o removida** — verificado por diff de identificadores
  contra `HEAD`: los 12 handlers idénticos, cero perdidos, cero agregados.
- **Validado a mano en `localhost:3002`**, no sólo por tests (ver handoff).

## Current State
- **Branch**: `main` — **8 commits sin pushear**
- **Build**: `tsc` exit 0; lint sin avisos nuevos; Vitest web **645 archivos / 7883 tests**
  (baseline medida hoy en `main` limpio: **643 / 7871** — el delta son mis 2 archivos y 12
  tests). El VR **no se corrió, y no aplica**: `visual-regression.spec.ts` tiene **0**
  referencias a `labyrinth-builder`.
- **Uncommitted work**: `SESSION.md` + el handoff nuevo
- **PRs abiertos**: ninguno

## Next Tasks
1. 🎯 **Los cuatro ítems del mockup que SON funcionalidad nueva** (por eso no entraron hoy).
   El orden por valor sigue igual, y el ⭐ es el primero:
   ⭐ **`Unsaved changes in <id>` + Discard** — hoy se carga otro record encima de una
   edición y se pierde **sin ningún aviso**. Después: nombre en vez de id en la librería,
   badge de TIER con la tabla ordenada por dificultad, y fila en estado `Editing`.
   ⚠️ Respetar: `targets` es **UI-owned**, y el brush `Star` **se esconde** donde el sweep
   no corre (fuera de exercise/labyrinth, y en el peón) — ambas siguen vivas y verificadas.
2. **P2P** — sin spec. ⚠️ Si va a tener algo de valor en juego, su spec debe incluir
   server-verified progress: hoy el riesgo está aceptado *porque* nada vale.
3. **Theme builder** — marketplace de creadores; el más grande y el que menos urge.
4. **Terminar de convertir**: 30 tableros, sobre todo laberintos de caballo (5) y dama (3).

## Blockers
- None.

## Open questions
- **¿Agrandamos el tablero del builder?** Son 349 px de grilla en 1440. Es el tamaño de
  siempre, así que no lo toqué — pero se opera tocando 64 casillas y es **una línea**
  (`maxWidth` a `ProceduralBoard`).
- **¿El chrome nuevo se extiende al resto de `/dev/*`?** Las primitivas ya están; hay ~35
  páginas. No lo empecé sin pedido.

## Notes
- ⛔ **El tablero del builder es `ProceduralBoard`, intacto.** El mock del founder dibujaba
  uno propio y no entró. Si alguien lo "simplifica" a divs de colores, se pierde la
  paridad con lo que ve el jugador.
- ⚠️ **La columna del tablero en `26rem` no es un número al azar**: `GameBoard` se capea
  solo en `maxWidth = "23.5rem"`. Los `35rem` viejos **no agrandaban nada**, sólo aire
  muerto. Para agrandarlo hay que pasar `maxWidth`, no ensanchar el track.
- ⚠️ **Un orden de paneles no lo delata NADA** (sin comportamiento, `tsc` ciego, fuera del
  VR). Queda pineado en `__tests__/panel-order.test.tsx` **por heading**, y ese test
  stubea la lista **vacía** para no leer contenido autorado.
- ⚠️ **El nombre accesible de los botones de pieza es MINÚSCULA** (`rook`, `pawn`…); el
  `Rook` visible es `capitalize` de CSS. Una sonda que busque `"Pawn"` timeoutea.
- ⚠️ **Un `pnpm dev` arriba invalida la suite de Vitest** — bajarlo antes de medir. El
  síntoma es que BAJA el conteo de ARCHIVOS, no que se ponga roja.
- **Verificar el deploy es del founder**, salvo pedido explícito.
- Handoff largo: `docs/handoffs/2026-08-13-exercise-builder-layout-handoff.md`
