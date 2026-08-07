# Spec — CLS 0,179: el anchor del hub reserva su caja

**Fecha:** 2026-08-07 · **Estado:** ✅ **READY** — red team en 2 pases (`…-redteam.md`):
1 P0 resuelto dentro del spec (AC15/AC16), 3 P1 incorporados, **ningún P0 abierto**.
**Evidencia:** `docs/audits/2026-08-07-minipay-cls-discovery.md` (discovery + addendum)

---

## Por qué existe este frente

Bajo Slow 4G + CPU 4×, persona MiniPay, el hub sufre un layout shift de **0,179** alrededor de
T2 — zona "needs improvement" de Core Web Vitals. Atribuido a `section.hub-scaffold-body` y
`div.kingdom-anchor-tagline`.

## Causa raíz (medida, no deducida)

**El primer nodo que colapsa es `.hub-scaffold-anchor`.** Cadena, con el mismo containing
block disponible:

| Nodo | Antes | Después | ¿Colapsado? |
|---|---|---|---|
| `.hub-scaffold-center` | **234** × 158 | **234** × 521,8 | **NO** — 234 px de ancho todo el tiempo |
| **`.hub-scaffold-anchor`** | **0 × 0** | 234 × 363,8 | ⚡ **SÍ** |
| `.kingdom-anchor` | 0 × 0 | 234 × 363,8 | heredado |
| `picture` / `img` | 0 × 0 · `naturalWidth 0` | 234 × 363,8 · `256` | heredado |

### Mecanismo

```css
.hub-scaffold-center {
  display: flex;
  flex-direction: column;
  align-items: center;   /* ⚡ los items NO hacen stretch transversal */
}
```

Con `align-items: center`, `.hub-scaffold-anchor` se dimensiona **por contenido**. Su contenido
es el portal → `<picture>` → `<img>`, que no aporta ancho hasta tener tamaño intrínseco:

**contenido 0 → item 0 → el `width: 100%` de `.kingdom-anchor` resuelve contra 0 → su
`aspect-ratio` produce altura 0.**

Cuando llega `naturalWidth = 256`, el item pasa a 234 px, el anchor gana 363,8 de alto, la
columna crece 158 → 521,8 y la fila del hub 369 → 521,8: **+153 px**. Ése es el shift.

⛔ **Refutadas con datos** (no descartadas por opinión): tipografía (`document.fonts.status`
ya era `loaded`), el grid (columnas `78px 234px 78px` idénticas antes y después — lo que además
exonera al token `--hub-rail-width` de AC8), y aparición tardía del tagline (contenido estático).

---

## Contrato

### C1. El fix

```css
.hub-scaffold-anchor {
  align-self: stretch;
}
```

Una declaración, en **el nodo que colapsa**.

- **El ancho ya es un contrato existente**: el track central de la grilla (234 px a 390 de
  viewport). No se escribe ningún número.
- **El alto ya es un contrato existente**: el `aspect-ratio: 669/1040` que `KingdomAnchor` fija
  inline por variante. Tampoco se escribe ningún número.

### C2. Lo que NO se hace, y por qué

| Descartado | Razón |
|---|---|
| `width`/`height` en el `<img>` | El ancestro es el que colapsa. Un fix en el replaced element trataría el síntoma heredado, y además entra en el frente de imágenes que está excluido |
| `min-height` | Sería una medida inventada para tapar el hueco, no para resolverlo |
| `transform` | Oculta el shift en vez de eliminarlo — CLS lo ignora, el jugador no |
| Medidas hardcodeadas | Habría dos fuentes para el mismo número. Este repo ya tiene escrito que una copia de medidas **no la delata nada observable** |
| `width: 100%` en el anchor | Efecto equivalente, pero fija el ancho en vez de delegarlo al alineamiento del flex. `align-self` dice *lo que se quiere* ("ocupá la columna"), no *cuánto* |

### C3. Blast radius

`.hub-scaffold-anchor` existe en **un solo lugar** (`hub-scaffold.tsx:273`), envolviendo
`<KingdomAnchor variant="playhub" />`. Los demás hijos de `.hub-scaffold-center`
(`AppModeSwitch`, `hub-scaffold-center-stack`) **conservan `center`**: el cambio es `align-self`
en un item, no `align-items` en el contenedor.

---

## Behavior

1. **Dado** el hub cargando y **antes** de que la imagen del portal tenga tamaño intrínseco,
   **entonces** `.hub-scaffold-anchor` ya mide el ancho de su columna y el alto que dicta el
   `aspect-ratio`.
2. **Cuando** llega la imagen, **entonces** ninguna geometría cambia: la caja ya estaba.
3. **El estado final es idéntico** al actual: 234 × 363,8 en el viewport medido.
4. Los hermanos del anchor dentro de `.hub-scaffold-center` siguen centrados.

## Edge cases

- **E1 — 360 × 640** (mínimo del store de MiniPay). La columna es más angosta; el anchor debe
  seguir ocupándola entera y el `aspect-ratio` sigue dando el alto. Verificar en el proyecto
  `minipay-360` de Playwright.
- **E2 — ⚠️ La igualdad del estado final es CONDICIONAL.** Hoy el ancho intrínseco de la imagen
  (256 px) es **mayor** que la columna (234 px), así que el shrink-to-fit siempre choca con el
  tope y da lo mismo que `stretch`. **Si `--app-max-width` creciera** hasta que la columna
  supere ~256 px, las dos reglas dejarían de coincidir y `stretch` sería más ancho. Es correcto
  —el portal debe ocupar su columna— pero **es un cambio visual que hoy no ocurre y mañana
  podría**. Queda escrito.
- **E3 — Otras superficies.** Ninguna: C3 acota el alcance a un nodo usado una vez.
- **E4 — El shift podría mudarse en vez de desaparecer.** Si algo más abajo dependiera de la
  altura de la fila, reservarla podría revelar otro shift. Los AC lo cubren midiendo el CLS
  total, no sólo el atribuible al anchor.

---

## Acceptance criteria

### A. Causa (determinista — se mide con la sonda, no con CLS)

- [ ] AC1 — En la ventana observada **no existe ninguna muestra** con `.hub-scaffold-anchor`
      en `0 × 0`.
- [ ] AC2 — `.hub-scaffold-anchor` tiene `width > 0` **antes** de que `img.naturalWidth ≠ 0`.
      Medido hoy con el probe: caja a los 3.767 ms vs imagen a los 3.931 ms.
- [ ] AC3 — `.hub-scaffold-center` conserva su ancho (234 px a 390 de viewport) antes y después.
- [ ] AC4 — No aparece ninguna medida nueva en CSS: el diff es **una sola declaración** y no
      contiene números.

### B. Resultado (multi-corrida)

- [ ] AC5 — Desaparece el `layout-shift` atribuible a `section.hub-scaffold-body` +
      `div.kingdom-anchor-tagline`. **Se valida en ≥ 4 corridas**, no en una.
      ⛔ **Por qué multi-corrida:** el defecto ocurre siempre, pero su *registro* como shift es
      bimodal — un shift sólo cuenta si el estado previo llegó a pintarse, y bajo CPU 4× a
      veces ese frame no se pinta. Una corrida en 0,0000 **no prueba nada**.
- [ ] AC6 — **Reformulado tras el red team:** el CLS total no empeora en ninguna corrida **y
      no aparece ningún `layout-shift` con `sources` distintos de los conocidos**. Cubre el
      caso "el shift se mudó de nodo en vez de desaparecer" (E4), que la versión anterior no
      podía ver. El instrumento ya captura los nodos, así que es gratis.
- [ ] AC7 — T2 no empeora materialmente (mediana de 3, tolerancia 150 ms).
- [ ] AC8 — LCP no empeora materialmente (mediana de 3, tolerancia 150 ms).
- [ ] AC9 — **0 requests nuevos** y bytes sin cambio material.
- [ ] AC10 — Estado final del anchor: **234 × 363,8** en 390 × 844.

### C. Regresión

- [ ] AC11 — Suite completa verde (baseline al abrir: **7.468 / 606**).
- [ ] AC12 — `tsc --noEmit` limpio.
- [ ] AC13 — **VR 62/62 sin re-baselinear.** Es el árbitro de cualquier diferencia visual:
      `align-self: stretch` cambia la regla transversal del item, y aunque el estado final
      medido es idéntico, eso lo decide el VR y no yo.
- [ ] AC14 — `pnpm bundle:guard` verde.

### D. Protección del fix — ⚠️ el P0 del red team

⛔ **Este fix no tiene ningún test que lo defienda.** `align-self: stretch` sólo existe en un
motor de layout real: jsdom no calcula layout, así que **borrar la declaración deja los 7.468
tests en verde y el CLS vuelve**. Y el VR tampoco lo protege, porque fotografía el estado
final, que es idéntico con y sin el fix. Es el patrón que este repo ya conoce: una propiedad
de layout cuya ausencia no la delata nada observable.

- [ ] AC15 — **Guard de fuente**: `.hub-scaffold-anchor` declara `align-self: stretch`, con la
      razón escrita **dentro del test** (sin eso el item se dimensiona por contenido y el CLS
      vuelve). ⚠️ Se declara explícitamente como guard de **implementación**, no de
      comportamiento: es lo único que un test puede ver.
- [ ] AC16 — El **camino de re-validación** queda documentado en el informe de cierre, con el
      comando exacto de la sonda de la ventana colapsada. Sin eso, nadie puede reproducir
      AC1/AC2 en el futuro.

## Out of scope

Imágenes · WalletShell · CSS render-blocking · `<main>` anidado · viewport/zoom · Privy/web.
