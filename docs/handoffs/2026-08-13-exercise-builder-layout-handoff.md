# Handoff — El builder abre por pieza y por su tabla (2026-08-13)

**Branch:** `main` (local) · **Commits nuevos:** 2 · **Sin pushear:** 8 en total
**Suite:** 645 archivos / 7883 tests verde · `tsc` exit 0 · lint sin avisos nuevos

---

## Qué se pidió

El founder pasó un mock (`artifacts/exercise-builder-interface.zip`, gitignored) y lo
acotó él mismo en dos frases que valen más que el mock:

> *"no agregar ni quitar nada de funcionalidad, sí puede ser de presentación"*
> *"el único ajuste importante es el orden, porque para actualizar yo primero selecciono
> la pieza y la tabla `Existing <pieza> exercises` debe estar a continuación"*

Y una advertencia: **el mock dibujó un tablero propio; el nuestro se conserva.**

## Qué se hizo

### 1. `feat(dev)` — primitivas de chrome para `/dev` (`ea000d0a`)

`components/dev/ui.tsx`: `Section`, `Field`, `Segmented`, `Legend`, `Mono`, `devInputClass`.

Lo que encodean no es estética sino **estructura**: el título de una sección es un `h2`
real, el label de un campo es un `<label>` real atado a su control, y `Segmented` reporta
`aria-pressed` en lugar de sólo pintar un fondo. Eso es lo que permite leer una página
**por estructura** — y por lo tanto asertarla.

⚠️ Usan neutrales crudos de Tailwind **a propósito**, no los design tokens del juego:
`/dev` vive fuera del producto (404 en producción) y un restyle del juego no debe mover
los muebles del builder ni al revés.

Hoy tiene **un solo importador** (la página del builder). Están listas para el resto de
`/dev/*`, pero esta sesión no las cableó a ninguna otra superficie.

### 2. `refactor(dev)` — el reorden (`6f15978d`)

| | antes | ahora |
| --- | --- | --- |
| 1 | grid Piece/Order/id/tier/tags/desc | **Piece** |
| 2 | Teaching guide | **Existing `<pieza>` exercises** |
| 3 | Validation | Identity |
| 4 | Save · Stage · Export | Teaching guide |
| 5 | Load from FEN | Stage · Export |
| 6 | **Existing** ← al fondo | Load from FEN |
| 7 | Generated catalog | Generated catalog |

Además: `Save draft` + la identidad del record (`Editing <id>` / `New exercise`) suben a
una **barra fija**; la columna del tablero es **sticky**; la **validación baja a debajo
del tablero que juzga**; las herramientas pasan a grid con icono y leyenda.

---

## Lo que NO entró, y por qué

- **`Erase`** y **`Clear`** del mock: son **funcionalidad nueva**. Fuera, por el acote
  explícito del founder. (Sospecha del founder, y coincido: v0 inventó `Erase` buscando
  un nombre mejor para lo que nosotros ya llamamos `Trace`, que se entiende mejor.)
- **El botón `Copy`** del Export: mismo motivo. El bloque sigue siendo seleccionable vía
  `data-allow-select`, que es lo que ya había.
- **`Trace` y `clear trace`**, que el mock no dibuja, **se conservan**.

---

## Invariantes nuevas que vale la pena no romper

- ⛔ **El tablero es `ProceduralBoard` con su `renderCell` y sus overlays, intacto.** El
  mock dibujaba uno propio y no entró. Si alguna vez alguien "simplifica" el board del
  builder a divs de colores, perdió la paridad con lo que ve el jugador.
- ⚠️ **La columna del tablero queda en `26rem` y eso NO es un número al azar**:
  `GameBoard` se capea solo en su prop `maxWidth = "23.5rem"` (grilla de 349 px). Los
  `35rem` de la columna vieja **no agrandaban el tablero**, sólo agregaban aire muerto.
  Para agrandar el tablero hay que pasarle `maxWidth`, no ensanchar el track del grid.
- ⚠️ **Un orden de paneles no lo delata NADA**: no tiene comportamiento, `tsc` no lo mira,
  y `/dev` está fuera del VR (`visual-regression.spec.ts` tiene **0** referencias a
  `labyrinth-builder`; la única ruta `/dev` que fotografía es `arena-shields-chip`). Por
  eso el orden queda pineado en `__tests__/panel-order.test.tsx`, **por heading**, que
  sobrevive a cualquier restyle.
- ⛔ **Ese test stubea la lista de records VACÍA a propósito.** No lee contenido autorado:
  ni ids, ni counts, ni filas del catálogo. Si mañana se autora un ejercicio más, el test
  no se entera — que es exactamente lo contrario de las tres tandas que ya se rompieron
  por pinear ids (`feedback_never_pin_authored_content_in_tests`).
- ⚠️ **El nombre accesible de los botones de pieza es MINÚSCULA** (`rook`, `pawn`…): el
  `Rook` que se ve es `text-transform: capitalize` de CSS. Una sonda que busque
  `getByRole("button", { name: "Pawn" })` **timeoutea**. Ya me pasó en esta sesión.

---

## Cómo se verificó (no sólo con tests)

- **Diff de identificadores contra `HEAD`**: los 12 handlers y todas las referencias a
  `state.*` / `result.*` son idénticas. **Cero perdidos, cero agregados.**
- **A mano en `localhost:3002`**, que es lo que los tests no ven:
  - torre/exercise ofrece `star` y **no** `capture`
  - peón/exercise **pierde** `star` y **gana** `capture` — la regla del sweep sigue viva
  - el bucket `labyrinth` conmuta y mantiene el orden de paneles
  - pintar a1 + a4 da `Optimal moves 2` y **"Ready to save."**
  - cero errores de consola, cero `pageerror`
- **Suite**: baseline medida en `main` limpio al abrir la sesión fue **643 / 7871**
  (coincide exacto con el `SESSION.md` anterior). Final: **645 / 7883** — +2 archivos y
  +12 tests, que son justo los míos. **El conteo de archivos no bajó**, así que la
  corrida vale.

---

## Open questions

1. **¿Agrandamos el tablero?** Hoy son 349 px de grilla en una pantalla de 1440. Es el
   tamaño de siempre, así que lo dejé quieto — pero es una herramienta que se opera
   tocando 64 casillas, y agrandarla es **una línea** (`maxWidth` a `ProceduralBoard`).
2. **¿Se extiende el chrome al resto de `/dev/*`?** Las primitivas ya están y hay ~35
   páginas. No es urgente y no lo empecé sin pedido.
3. **Los cuatro ítems del mockup que quedaron sin hacer** siguen siendo funcionalidad
   nueva, no presentación, y por eso no entraron en esta sesión:
   `Unsaved changes in <id>` + Discard, nombre en vez de id en la librería, badge de TIER,
   y fila en estado `Editing`. El ⭐ de esa lista sigue siendo el primero: **hoy se puede
   cargar otro record encima de una edición y perderla sin ningún aviso.**
