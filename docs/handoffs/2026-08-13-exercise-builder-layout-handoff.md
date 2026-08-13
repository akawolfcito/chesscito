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

### 3. `style(dev)` — cada columna scrollea sola (`77d01b0e`)

Pedido del founder, y describe su día: lo que sube y baja constantemente es la columna de
controles; en la del tablero ya está todo a la vista. Con un scroll de página compartido,
mover los paneles arrastra el tablero, y volver a pintar arrastra los paneles.

La página ya **no scrollea**: `h-screen` + `overflow-hidden`, header como fila flex
`shrink-0` (no `sticky` — está **fuera** de los contenedores de scroll, así que está
siempre visible por construcción), y cada columna con su `overflow-y-auto` de `lg` para
arriba. Debajo de `lg` vuelve a ser un scroll único.

⚠️ **`min-h-0` en los dos tracks no es decorativo**: sin él un hijo de grid/flex se planta
en la altura de su contenido y el overflow **se escapa a la página** — el bug exacto que
esto arregla.

### 4. `feat(dev)` — `Unsaved changes` + Discard (`330f3561`)

El ⭐ del mockup, y el único de los cuatro que arreglaba **pérdida de trabajo real**.

Las tres acciones que **reemplazan** el borrador (abrir otro record, `New`, cambiar de
bucket) pasan ahora por una guarda: sobre un borrador limpio corren igual que antes; sobre
uno sucio quedan parqueadas y el cartel pregunta. Más un `Unsaved changes in <id>`
permanente con `Discard`, que **restaura** — por eso el baseline guarda el estado entero y
no un hash.

**La asimetría que decide todo** en `lib/labyrinth-builder/dirty.ts`: un falso **positivo**
cuesta un click de más; un falso **negativo** destruye la edición. Así que sólo cuenta como
cosmético lo **demostrablemente** cosmético, y eso son exactamente dos cosas:

| se normaliza | por qué |
| --- | --- |
| orden de `walls` | `buildFenBlock` los escribe en una grilla 8×8 → el orden no llega al FEN |
| orden de `enemies` | ídem — pero se comparan **con su pieza**, no sólo su casilla |
| ⛔ `extraGoals` **NO** | viaja a `targets` como array ordenado; reordenar sí cambia los bytes |

⛔ Los enemies se comparan `casilla:pieza`. Comparar sólo casillas llamaría *"limpio"* a una
torre negra retipada a peón — la reescritura silenciosa que `AuthoredEnemy` existe para
frenar.

⚠️ **Elegir pieza sobre un borrador limpio NO ensucia.** El selector de pieza es también el
filtro de la lista: es navegación. Si cada browse diera alarma, la guarda quedaría
desentrenada en un día. Sobre un borrador sucio sí cuenta, porque ahí reescribe la pieza
del record.

⚠️ **Sólo se re-baseline si el write al baseline realmente aterrizó.** Un save fallido debe
dejar el borrador sucio, o el cartel se callaría sobre trabajo que sigue viviendo
únicamente en el browser.

⚠️ **El cartel es `sticky` y su fondo es OPACO, y las dos cosas salieron de usarlo**: hacer
click en `Edit` de otra fila la scrollea a la vista, lo que empujaba el cartel fuera del
tope de la columna. La guarda disparaba, el borrador se salvaba, y en pantalla **no parecía
pasar absolutamente nada**. Una pregunta que no se ve es lo mismo que ninguna pregunta. El
punto celeste del chip del header es la única señal **siempre** visible, porque el header
no scrollea.

**El test de flujo prueba INTERCEPCIÓN, no decoración**: cada caso verifica que el borrador
**sobrevivió** (el valor editado sigue en su campo). Verificado con un **mutante** — sacar
la guarda de `requestEdit` mata 3 de los 9. Los records del test son sintéticos.

### 5. `feat(dev)` — nombre, TIER y `Editing` en la lista (`77481f8e`)

Los tres ítems que quedaban del mockup. Lógica pura en `lib/labyrinth-builder/library.ts`.

**Nombre.** Manda la descripción; el id queda al lado como etiqueta técnica.
⚠️ El fallback al id **no es defensivo**: hoy **ni un** ejercicio autorado tiene
descripción, así que es el caso común. Por eso el id sólo se imprime **cuando agrega
algo** — sin esa regla cada fila leía `rook-1 … rook-1`, que es exactamente como se veía
hasta que lo abrí en el navegador.

> 💡 Consecuencia para el founder: escribir la **description** de un ejercicio ahora paga
> dos veces — deja de mostrar el genérico *"Exercise N"* en el juego **y** le pone nombre
> a la fila en el builder.

**TIER.** Badge con nombre y color, más un toggle de orden en el encabezado.
La lista **abre en `tier`** (decisión del founder, 2026-08-13): es donde vas a elegir el
próximo tablero a escribir, y esa elección se juega en la dificultad. `order` —la secuencia
real del juego, la vista en la que se juzga un curriculum— queda a un tap.

⚠️ **Los tests de CONTENIDO de una fila no deben indexar por posición.** Los escribí con
`rows()[0]`, y eso ató cinco aserciones sobre *lo que una fila dice* al orden por defecto
de la lista: cambiar ese default las puso rojas sin que nada del comportamiento se hubiera
roto. Ahora buscan la fila **por identidad** (`rowFor(id)`).

⚠️ Un tier **ausente** rankea como `medium`, porque es lo que el catálogo le pone
downstream (`toPuzzleInput`: `tier ?? "medium"`). Se muestra como **`medium?`** para que
una suposición no se confunda con una decisión cuando la tabla está ordenada por tier.

**Editing.** La fila activa lo dice **en palabras**. Ya se teñía, pero un tinte no es una
afirmación: sobre diez filas casi idénticas es fácil creer que estás editando la que tenés
bajo el cursor. Y repite el punto de "sin guardar" justo donde se decide abrir otra.

⚠️ **Un flake real de mis propios tests, arreglado**: `openBuilder` esperaba el HEADING, y
el panel lo renderiza haya llegado o no el fetch de records — así que volvía con la lista
todavía vacía y toda query posterior corría carrera contra el fetch. Ahora espera las
**filas**. Costó una corrida roja encontrarlo; después, cinco corridas seguidas en verde.

---

## Segunda mitad: lo que salió de USARLO

Los cinco commits de arriba salieron del mockup. Los cinco de abajo salieron del founder
autorando de verdad, y ninguno lo habría encontrado un test.

### 6. `feat(dev)` — los avisos del save salen de la columna (`82dbdc81`)

El founder los leía como decoración: *"si todo sale en warning ya sabemos que eso se obvia;
no sé qué trato debo darle"*. Tenía razón en las dos mitades.

⛔ **Y por eso el filtro NO es por severidad, que era lo pedido y lo obvio.** Ese canal no
contiene **ni un error**: los errores bloquean el save y jamás llegan ahí. Un filtro
warning/error/info habría ordenado un solo balde dentro de sí mismo. El eje que sí los
separa es el **tipo**, porque los tipos cargan obligaciones distintas:

| tipo | tratamiento |
| --- | --- |
| curva de dificultad (2 de los 3 productores) | **Consejo** por decisión de producto. No reordenar contenido por esto. |
| obstáculos decorativos | Leer, pero mirar el tablero antes de borrar. ⚠️ **Poco fiable en Star Sweep**: juzga la ruta a UN objetivo, y ya llamó decorativos a 9 de 10 muros que cuadruplicaban la ruta. |
| desconocido | Verbatim, sin archivar bajo una guía que quizá no le aplica. |

Lo que faltaba nunca fue un filtro: era la respuesta a *"¿qué trato merece esto?"*.

⚠️ El clasificador se prueba **corriendo el linter real** y clasificando lo que devuelve, no
copy recordado — si alguien reescribe un mensaje, se pone rojo en vez de mandar el aviso a
`other` en silencio.

### 7–9. La carrera del save — dos mitades, dos intentos (`c7a8684d`, `7120eb2e`, `3be103e8`)

**Reporte:** cambiar un tablero → Save draft → **tablero completamente en blanco**, y para
volver a editarlo había que ir a buscar la pieza otra vez. En la acción más repetida del tool.

**Causa:** un save escribe `content/*.json` y `puzzles.generated.ts`, los dos dentro del
árbol que Next dev vigila, así que **Fast Refresh remonta la página**. `publish-toast.ts` ya
documentaba esto para el toast. El borrador no lo tenía.

⛔ **Y el arreglo obvio no alcanza, porque es una CARRERA.** El servidor escribe los archivos
**durante** el `fetch`: desde ese instante el watcher puede disparar en cualquier momento,
incluso antes de que la respuesta se lea. **Todo lo que está después del `await` puede no
ejecutarse nunca.**

Me costó dos intentos y el founder encontró las dos fallas:

1. Estacioné el borrador **después** del fetch → seguía en blanco. (Mi sonda no lo vio
   porque interceptaba `/api/dev/publish`: sin escritura no hay Fast Refresh, y yo
   simulaba la recarga con `page.reload()`.)
2. Lo moví antes del fetch pero **dejé el toast atrás** → el tablero volvía y el mensaje no,
   así que tampoco había chip y el save parecía no haber hecho nada.

Ahora **las dos cosas** se estacionan antes del request, y la respuesta las pisa con el
veredicto real si llega a tiempo.

⚠️ **`savedOk` es load-bearing.** Un save que falló no dejó nada en disco: llamarlo "limpio"
le diría al guard de cambios sin guardar que no hay nada que perder, y el próximo click
destruiría el trabajo en silencio. Un flag ausente cae en **NO-guardado**, nunca al revés.

⚠️ El veredicto provisional dice **`warn`, no `ok`**, y lo explica: la recarga *es* evidencia
de que la escritura ocurrió (nada más toca esos archivos), pero "casi seguro aterrizó" no es
"aterrizó". Las dos mitades apuntan al mismo lado.

### 10. `feat(dev)` — la franja de estado dice una línea (`02e4bbf7`)

Pregunta del founder: el mensaje del overlay caído *"no molesta mucho ahora, pero no sé si
habrá algún momento en el que salgan muchas líneas"*. **Va a pasar**: el texto de un save
fallido es `Save failed: ${errors.join("; ")}` — una entrada por fallo de validación, **sin
cota superior**.

Un toast lleva ahora dos textos: `summary` (una línea, para la franja) y `text` (el relato
entero, que abre el popup bajo *"What happened"*).

⚠️ El **commit nudge** viaja en el `summary` del camino feliz a propósito: es lo único que
queda por hacer cuando todo salió bien, y enterrarlo en un popup que nadie abre tras un save
exitoso sería perderlo.

---

## Open questions

1. **¿Agrandamos el tablero?** Hoy son 349 px de grilla en una pantalla de 1440. Es el
   tamaño de siempre, así que lo dejé quieto — pero es una herramienta que se opera
   tocando 64 casillas, y agrandarla es **una línea** (`maxWidth` a `ProceduralBoard`).
2. **¿Se extiende el chrome al resto de `/dev/*`?** Las primitivas ya están y hay ~35
   páginas. No es urgente y no lo empecé sin pedido.
3. ✅ **El mockup está cerrado entero** — los seis ítems entraron.
4. ✅ **Resuelto**: la lista abre en `tier` (founder, 2026-08-13).
5. **Ninguna descripción autorada existe todavía**, así que la columna de nombre muestra
   ids en todas las filas hasta que se empiecen a escribir. No es un bug: es contenido que
   falta, y ahora rinde el doble escribirlo.
