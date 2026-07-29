# Handoff — Overlay de celebración: titular arqueado y layout

**Fecha:** 2026-07-29
**Rama:** `main` (local; `origin/main` lo mueve el founder)
**Suite:** 6548 passing / 555 files · exit 0 · typecheck limpio
**Sin trabajo sin commitear.**

---

## Qué se hizo

### 1. El arco se reconstruyó sobre `<textPath>` (`bd5866e8`)

La versión anterior ponía los glifos en una fila flex y rotaba cada uno **sobre su
propio pie**. Falla por construcción, y no se vuelve a intentar:

- Rotar un glifo sobre su pie desplaza su **tope** ~`alto · sinθ` — un tercio de em
  en los hombros → **las letras se montan**.
- El **ángulo** salía del ÍNDICE del glifo y la **x** de su ancho real, así que `W`
  y `l` recibían el mismo paso angular y distinto paso horizontal → la curva se
  quebraba y se leía **triangular**.

`textPath` sobre un arco circular real usa las métricas de la fuente, así que
posición e inclinación siempre coinciden. Sin medir en JS, correcto en el primer
paint del server.

### 2. El borde del cartel es un stack de 5 capas (`f7194278`)

De atrás hacia adelante: **sombra dura → extrusión naranja → dorado → keyline rojo →
crema**. Cada capa es un `<use>` del mismo `<text>` en `<defs>`, así que el string
está **una sola vez** en el DOM.

> **La jerarquía que percibe el ojo la fija cuál banda es más gruesa.** Con el rojo
> en `0.12em` era la banda de color más ancha y se leía crema → rojo → naranja →
> dorado. A `0.10em` el dorado toma la delantera. Si alguien vuelve a tocar
> `INNER_EM`, ese es el efecto real.

### 3. Layout del `PhaseFlash` (`142483ee`, `0d76f46f`, `677de3ad`)

Tres invariantes que costaron cuatro rondas de device:

1. **La caja de la línea de lección mide siempre 2 líneas** (`min-height: 2.4em` +
   `line-clamp: 2`, `globals.css`). El bloque cuelga con `bottom-full` y **crece
   hacia arriba**: cada línea que gana empuja el titular fuera de la pantalla. El
   `<span>` se renderiza **aunque no haya texto**, o el titular salta entre el
   overlay de éxito y el de fallo.
2. **Cero margen negativo.** Compraba aire arriba metiendo el texto **dentro** del
   lobo — la misma colisión, movida de punta. El aire se compra achicando el avatar
   (20rem → 13.5rem): el stack está centrado, así que cada rem del lobo son ½ rem
   de aire para el arco.
3. **El ancho lo fija el wrapper** (`w-[92vw]`). Un hijo absoluto **no puede**
   superar su bloque contenedor (el marco del lobo) por más `max-width` que tenga.

### 4. La línea "You learned" dejó de ser píldora

Mismo tratamiento que "Tap to Continue" (crema + contorno duro, mismo `font-size`).
Se eliminó el glow ámbar del prompt de tap: encendía lo que tuviera debajo.

### 5. Taxonomía overlay vs modal (`7abe55e8`)

`docs/design-patterns/full-screen-surface-taxonomy.md`. **El criterio es
estructural, no emocional**: overlay = scrim con el contenido flotando; modal =
scrim + panel crema con el contenido adentro. El arco es de los overlay.

**De las 16 superficies `fixed inset-0`, sólo 2 son overlay** y las dos ya están
migradas. Los 14 modales conservan su titular plano.

---

## Estado y próximo paso

### Deuda abierta: los dos overlays no comparten código

Repiten la composición a mano y **ya divergieron en esta sesión** —
`daily-tactic-sheet.tsx:336` conservó el `-mb-6` que se sacó de ejercicios y el
avatar de `h-80`. O sea: en el Daily el titular está hoy 24px más abajo, pisando la
cabeza del lobo.

**Próximo paso recomendado — extraer, no parchear.** Arreglar el Daily a mano es la
misma edición que la extracción, sin la garantía de que no se separen otra vez:

1. Extraer `CelebrationStack` — titular + línea de apoyo (opcional) + avatar
   (tamaño por prop), con las tres invariantes de arriba adentro.
2. Ejercicios lo adopta sin cambio visual (es la referencia).
3. El Daily lo adopta → **la divergencia se cierra como efecto secundario**.
4. Test que afirme que las dos superficies montan la misma estructura.

### Preguntas abiertas

- ¿`Training Complete!` (18 caracteres) se acorta? El arco tiene techo de **≤12
  caracteres** a 13vw; más largo hay que achicarlo tanto que deja de leerse como
  cartel. Sólo aplica si ese modal alguna vez se convierte en overlay.
- ¿Se le da probe `/dev` a Mini-Arena / Welcome / Focus Day / Unlock? Sin probe no
  hay verificación barata ni foto de VR.

### Perillas, por si hay que afinar sin releer el archivo

`components/ui/arched-headline.tsx`: `HALF_SPAN_DEG` (curvatura) · `TRACKING_EM`
(separación) · `INNER_EM` / `OUTLINE_EM` / `RIM_EM` (bandas) · `EXTRUDE_DY_EM` /
`SHADOW_DY_EM` (profundidad) · `APEX_Y` / `FOOT_PAD` (aire arriba/abajo).
La fuente se puede cambiar sin romper nada: sólo `GLYPH_ADVANCE_EM` es una
estimación que quizá quiera retoque.

---

## Nota de método

El ciclo que funcionó: banco de pruebas HTML + Playwright a 390px con la fuente
real, iterar ahí, y **recién después** portar al componente. Vive en el scratchpad
de la sesión; si se retoma el tema, se rehace en 5 minutos y evita rondas de device.
