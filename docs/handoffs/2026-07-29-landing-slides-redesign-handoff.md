# Handoff — Rediseño de los slides del onboarding (landing)

**Fecha:** 2026-07-29
**Rama:** `main` — **`origin/main` está en `9261efd7`**, el founder pusheó durante la sesión.
**Suites:** landing **56 passing / 11 files** · web **6549 passing / 555 files** · `tsc` limpio en ambos · build de landing verde con `/en` y `/es` prerenderizados.
**Sin trabajo sin commitear.**
**Estado:** ✅ aprobado visualmente por el founder ("está perfecto").

---

## Qué se hizo

Siete commits, de `9ecd77be` a `9261efd7`.

### El cambio estructural: se fue el marco

El carrusel montaba **un** fondo para los cuatro slides más un **marco dorado PNG** de
aspect ratio fijo `980/1398`, cuyo **ancho se derivaba de la altura del viewport**
(`min(100%, calc(54dvh * 0.9))`). En pantallas bajas eso comprimía el copy o lo scrolleaba
dentro de un recuadro. Ahora cada slide **es** su ilustración, a sangre, detrás de una
columna de 420px con el chrome flotando encima.

### Ya no hay segunda pantalla

`page.tsx` bifurcaba: quien ya había elegido iba a `WelcomeBack`, con copy propio, y **nunca
volvía a ver el carrusel**. Ahora recibe el mismo carrusel abierto en el slide 4, con su
elección anterior marcada, y la flecha ◀ sigue llegando a los slides 1–3. El atajo saltea el
pitch sin esconderlo. `WelcomeBack`, su test y sus tres claves de copy fueron eliminados.

### Decisiones del founder tomadas en esta sesión

1. **Desktop**: columna de 420px centrada (ya era la dirección del proyecto — `--app-max-width: 390px` en web, `max-w-[420px]` en landing).
2. **Label verde**: "Last used" / "Última vez". Describe un hecho, no da una orden.
3. **La mitad de LEARN va siempre en dorado**, como recomendación de producto.
4. **`/classic` queda huérfano** (sin ningún enlace en la UI) — aceptado.
5. **Sin estrella en el contador** y **botón de avance ajustado al contenido**.
6. **La franja PRO va en morado**, no verde.

---

## Invariantes que dejó esta sesión

### ⚠️ El switch del slide 4 muestra dos señales que PUEDEN contradecirse, a propósito

- El **dorado** está siempre en LEARN: es la recomendación del producto ("empezá por acá").
  No lee el estado del visitante y no se mueve nunca.
- El **label verde** está sobre la mitad que el visitante usó la última vez.

Con `lastUsedMode="play"` el dorado queda en LEARN y el label en PLAY. **Es lo diseñado**, no
un bug de render. Un test lo fija (`mode-switch.test.tsx`, "recommends LEARN regardless of
what the visitor last chose").

### ⚠️ El dorado se estila con `data-recommended`, NUNCA con `aria-pressed`

Las mitades son `<a>`. `aria-pressed` pertenece al rol `button`; en un enlace es ARIA que
ningún lector interpreta, presente sólo para pintar. Hay un test que lo prohíbe.

### ⚠️ `ArtImage`: `object-position` va por `imgClassName`, no por `className`

`object-position` afecta al **elemento reemplazado** (el `<img>`). Una clase pasada por
`className` aterriza en el `<picture>` y **no hace nada, en silencio** — el recorte igual
renderiza, sólo que anclado donde el navegador decida. Se ve bien en un viewport alto y
decapita al lobo en uno bajo. Tres tests fijan a qué elemento llega cada prop.

### ⚠️ Los paths de arte en `slides.ts` deben ser literales COMPLETOS

Factoricé el prefijo del directorio en una constante y lo interpolé. El audit del catálogo
(`landing-assets.test.ts`) **grepea el fuente buscando literales**: con un path compuesto el
arte queda **sin catalogar y sin poder reemplazarse desde el theme builder, sin que nada lo
diga**. El mismo scanner **lee comentarios**, así que la prosa de ese archivo tampoco puede
deletrear una ruta — se cuenta como un asset inexistente. Ambas cosas están escritas en el
archivo.

### ⚠️ Tocar slots de tema rompe TRES baselines, y `tsc` es el cuarto guardián

Los tres conocidos: el conteo `landing` en `theme-registry.test.ts` (21 → **31**), la lista
de `landing-assets.test.ts`, y el centinela del scanner (su valor viejo,
`avatar-chesscito-welcome`, había salido del fuente del landing). El cuarto: **`ThemeAssetKey`
es una unión declarada aparte** — los 165 tests de temas pasaron en verde con las 10 claves
nuevas ausentes del tipo, porque vitest no chequea tipos. Sólo `tsc` lo agarró.

### ⚠️ `renderWithIntl` cargaba el bundle EN aunque le pidieras `es`

Inofensivo mientras ES era un espejo placeholder; **ciego** desde que lleva copy real: un
test que afirmara español habría leído inglés y pasado con la evidencia equivocada.
Corregido — el helper ahora resuelve el bundle por locale.

### ⚠️ El título es arte y cambia de ARCHIVO por locale (slides 2–4)

`ES-learn` dice **APRENDE**, `ES-play` dice **JUEGA**, `ES-choose` dice **ELIGE TU CAMINO**.
Por eso son dos slots de tema por slide y el `alt` sale de la traducción: con un `alt` fijo,
un lector de pantalla en ES anuncia "Learn" sobre una imagen que dice APRENDE. **El slide 1
es la excepción deliberada**: un solo archivo, los dos locales.

### ⚠️ Los cuatro fondos se montan a la vez, tres en `opacity-0`

Montar sólo el activo hace que cada tap decodifique una imagen nueva y parpadee al azul de
fondo. Ese costo **no existía** cuando los cuatro slides compartían un backdrop, así que no
es una optimización: es el comportamiento base. Un test lo fija.

### ⚠️ La zona de swipe es SÓLO la fila de contenido

Sobre la columna entera envolvería el switch y los links legales, y un arrastre que empieza
sobre un enlace podría mover el carrusel **y** seguir el enlace. Resuelto por estructura, no
por `preventDefault`.

### ⚠️ `localePrefix` es `"as-needed"`

EN vive en `/` **sin prefijo**, ES en `/es`. Copiar el `LocaleSwitcher` de `apps/web` tal cual
manda EN a `/en`, que la middleware sólo redirige — un salto de más y una segunda URL para la
misma página.

### 🧯 `cookies()` es SÍNCRONO acá

El hook de Next sugiere `await cookies()` por Next 16. Este repo corre **Next 14.2.35**. La
sugerencia es incorrecta para esta versión; no aplicarla.

---

## Estado y próximos pasos

### Sin agenda propia

El rediseño está cerrado y aprobado. Nada de esto bloquea nada.

### Lo que sigue abierto de antes (sin tocar en esta sesión)

1. **Maestría rota — ABIERTA, y afecta a 5 de 6 piezas, no sólo la dama.**
   `exercises-screen.tsx:868` reemplaza los laberintos crudos por el juego firma, así que los
   bests guardados bajo los ids viejos quedan huérfanos y la corona vuelve a `available`:
   dama `queen-lab-1..3` → `queens-1..3` · alfil `bishop-lab-3/4` → `bishop-run-1..3` ·
   caballo `knight-lab-1..5` → `knight-tour-1..3` · peón `pawn-lab-*` → `pawn-promotion-1..3` ·
   rey `king-lab-1` → `king-safe-1..3`. La torre no se ve afectada.
   **Bug adicional encontrado y NO arreglado**: `use-hub-data.ts:374` pasa `LABYRINTHS`
   **crudo**, no el pool mergeado — el hub y la pantalla calculan caminos distintos para la
   misma pieza.
2. **Slice 2 (ventana weekly en Leaders) — no construida, pero ya DESBLOQUEADA.** Cero
   ocurrencias de "week" en `leaderboard-sheet.tsx` / `play-leaders-sheet.tsx`. La tabla
   `score_attempts` existe (migración `20260731000000`) y da la fuente temporal que faltaba.
   El spec de 2026-07-27 sigue en NEEDS REVISION: hay que reescribirlo sobre `score_attempts`.
3. **Overlays de celebración: la divergencia SIGUE ABIERTA.**
   `daily-tactic-sheet.tsx:336` conserva el `-mb-6` que ejercicios eliminó y el avatar
   `h-80/h-72` contra `h-[13.5rem]`, y **no monta el `<span class="overlay-lesson">`**, así que
   ni siquiera reserva la caja de dos líneas. La recomendación del handoff anterior sigue en
   pie: extraer `CelebrationStack`, no parchear.
4. **Theme Builder** — sigue siendo el frente grande elegido.

### Limpieza diferida (en el spec, *out of scope*)

- Borrar el arte huérfano: `bg-slides`, `bg-slides-web`, los cuatro `avatar-*`, los títulos
  viejos. Están cataloged como `deprecated` para que no se pudran invisibles.
- Borrar `/classic` y su árbol (`landing-page.tsx`, `phone-stack`, `phone-frame`).
- Un probe `/dev` para las 16 vistas (4 slides × 2 locales × 2 estados de entrada).

## Preguntas abiertas

- **El copy ES está marcado para revisión** en `messages/es.ts`. Dos puntos concretos:
  `slide1.welcomeTo` ("Bienvenido a") se eligió corto por espacio sobre el wordmark y es la
  forma con género; y `slide4.support` es la línea más larga de las cuatro.
- El `deprecated` de los 8 slots superados asume que los archivos siguen en disco. Si la
  limpieza los borra, esos slots hay que sacarlos del registry en el mismo commit o el test
  "ships every landing slot's files" se pone rojo.

---

## Nota de método

Tres de los cuatro defectos reales de la sesión los encontró la herramienta, no yo: el audit
del catálogo rechazó los paths compuestos, el mismo audit contó mis comentarios como assets, y
`tsc` agarró la unión de tipos que 165 tests verdes no vieron. El orden que funcionó fue
**spec → red team → TDD → EDD**, y el EDD fue el que más pagó: cada error de compilación
apuntó al consumidor exacto que faltaba migrar.

Lo que la suite **no** puede juzgar quedó listado en el spec como verificación en device, y el
founder lo recorrió: de ahí salieron las tres correcciones finales (estrella, ancho del botón,
morado + peso de la franja PRO).
