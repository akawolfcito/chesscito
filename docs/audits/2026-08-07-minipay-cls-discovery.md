# Discovery — CLS 0,179 en MiniPay

**Fecha:** 2026-08-07 · **Perfil:** Slow 4G + CPU 4×, persona MiniPay, build de producción,
4 corridas. **⛔ No se arregló nada.**

> **Causa raíz:** `.kingdom-anchor` **no tiene caja** (0 × 0) hasta que llega la dimensión
> intrínseca de su imagen. Cuando llega, toma 234 × 364 px, la fila del hub crece **+153 px** y
> todo lo que hay debajo se mueve.
> `div.kingdom-anchor-tagline` es **víctima**, no causa: está `position: absolute` dentro del
> anchor y sólo refleja el colapso.

---

## 1. Timeline (run-1; idéntica en 3 de 4 corridas)

```
t = 3.799 ms   El anchor YA está en el DOM
               ├ .kingdom-anchor      rect 0 × 0        aspect-ratio 669/1040 (aplicado)
               ├ .kingdom-anchor-picture rect 0 × 0
               ├ img.naturalWidth     0                 complete=false
               ├ .kingdom-anchor-tagline rect 195,183 · 0 × 115  ← texto en columna vertical
               └ .hub-scaffold-body   rect 0,193 · 390 × 369   cols 78px 234px 78px
                                                          fonts: loaded

t = 4.199 ms   ⚡ layout-shift 0.1790
               section.hub-scaffold-body      y 192,9 → 116,5   h 369 → 521,8   (+152,8 px)
               div.kingdom-anchor-tagline     38 × 116  →  187 × 31,6

t = 4.024 ms   (primera muestra posterior)
               ├ .kingdom-anchor      rect 78,117 · 234 × 364
               ├ img.naturalWidth     256               ← APARECE la dimensión intrínseca
               ├ .kingdom-anchor-tagline rect 101,428 · 187 × 31
               └ .hub-scaffold-body   rect 0,117 · 390 × 522   cols 78px 234px 78px
```

## 2. Qué cambia y qué NO cambia

| Propiedad | Antes | Después | ¿Cambia? |
|---|---|---|---|
| `grid-template-columns` del body | `78px 234px 78px` | `78px 234px 78px` | **NO** |
| `display` del body | `grid` | `grid` | NO |
| Altura de la fila (body `h`) | 369 px | **521,8 px** | **SÍ (+152,8)** |
| Caja del anchor | **0 × 0** | **234 × 364** | **SÍ** |
| `img.naturalWidth` | **0** | **256** | **SÍ** |
| `aspect-ratio` del anchor | `669 / 1040` | `669 / 1040` | NO — ya estaba |
| Fuentes | `loaded` | `loaded` | **NO** |
| Ancho/alto del tagline | 38 × 116 | 187 × 31,6 | SÍ (consecuencia) |
| `font-family` del tagline | fallback del sistema | el mismo | **NO** |

📌 **Dos hipótesis de tu lista quedan REFUTADAS con datos**, no descartadas por opinión:

- ⛔ **No es tipografía.** `document.fonts.status` ya es `loaded` **antes** del shift, y el
  `font-family` computado del tagline es idéntico a ambos lados.
- ⛔ **No es el grid ni el track.** Las tres columnas miden `78px 234px 78px` antes y después.
  ⚠️ Esto además **exonera al token `--hub-rail-width`** que introduje en AC8: si fuera la
  causa, las columnas cambiarían. Lo verifiqué porque era mi cambio más reciente sobre esa
  grilla.
- ⛔ **No es aparición tardía del tagline.** Su contenido es estático (traducciones, sin
  estado) y ya está en el DOM antes del shift.

✅ **Confirmada: no hay espacio reservado.** El anchor no reserva su caja hasta que la imagen
declara cuánto mide.

## 3. Culpable y víctima

| Nodo | Rol | Por qué |
|---|---|---|
| `.kingdom-anchor` + su `<img>` | **CAUSA** | El `<img>` **no lleva atributos `width`/`height`**. El anchor tiene `width: 100%` y `aspect-ratio: 669/1040` inline, y aun así mide 0 × 0 mientras `naturalWidth === 0` |
| `section.hub-scaffold-body` | Víctima | Su fila crece 153 px cuando el anchor por fin ocupa lugar |
| `div.kingdom-anchor-tagline` | Víctima | `position: absolute` dentro del anchor (`left:10% right:10% bottom:6%`): con el anchor en 0 px de ancho, el texto se estruja a **38 px** — una palabra por línea — y al recuperar la caja vuelve a 187 × 31 |

**Correlación, 4/4 corridas:** el anchor gana ancho **en la misma muestra de 50 ms** en que
aparece `naturalWidth ≠ 0`. Está en el DOM entre **210 y 264 ms** antes de tener caja.

| Corrida | CLS | Anchor en DOM | Anchor con ancho | `naturalWidth ≠ 0` | Ventana sin caja |
|---|---|---|---|---|---|
| run-1 | 0,1790 | 3.799 ms | 4.024 ms | **4.024 ms** | 225 ms |
| run-2 | **0,0000** | 3.715 ms | 3.979 ms | **3.979 ms** | 264 ms |
| run-3 | 0,1790 | 3.703 ms | 3.961 ms | **3.961 ms** | 258 ms |
| run-4 | 0,1790 | 3.715 ms | 3.925 ms | **3.925 ms** | 210 ms |

## 4. Por qué es bimodal — y la respuesta incomoda

**El defecto NO es bimodal: ocurre en las 4 corridas, con la misma ventana de ~210–264 ms.**
Lo bimodal es que quede **registrado** como `layout-shift`.

Un shift sólo se contabiliza si el estado previo llegó a **pintarse** en un frame. Bajo CPU 4×,
durante la hidratación, a veces ese frame no se pinta y el navegador salta directo al estado
final — CLS 0,0000 con el mismo defecto debajo (run-2).

⚠️ **Consecuencia práctica:** medir CLS una sola vez para validar un fix **no sirve**. Hay que
medir varias corridas y, mejor, asertar sobre la **ventana sin caja** (`naturalWidth === 0` con
el anchor en el DOM), que es determinista, en vez de sobre el número de CLS, que no lo es.

## 5. Opciones, ordenadas por riesgo

| # | Opción | Qué haría | Riesgo | Cumple los límites |
|---|---|---|---|---|
| **1** | **`width` + `height` en el `<img>` del portal** | La relación intrínseca se conoce al parsear el HTML, antes de bajar un byte de imagen | **Bajo.** Dos atributos; ningún asset, request ni CSS nuevos; no toca layout ni JSX del hub más allá del `<img>` | ✅ No es transform, no es alto fijo arbitrario (deriva del asset real), 0 requests |
| **2** | **Reservar la caja en CSS** (`min-height` derivado de `aspect-ratio` × ancho de columna) | El anchor ocupa su lugar sin depender de la imagen | **Medio.** Es una medida derivada que hay que mantener sincronizada con `ASPECT_RATIO[variant]` — el tipo de copia que este repo ya sabe que no la delata nada | ⚠️ Deriva de un contrato real (el ratio existe), pero duplica |
| **3** | `content-visibility` / placeholder | — | **Alto**, y no ataca la causa | ❌ |
| **4** | No hacer nada | 0,179 se queda | Nulo | — |

⚠️ **La opción 1 toca una imagen, y este frente excluye "imágenes".** Lo señalo explícitamente:
**no es optimización de imágenes** (no cambia formato, peso, prioridad ni carga) — es
**reservar espacio**. Si preferís que ni siquiera eso entre acá, la alternativa es la 2.

### Lo que falta saber antes del spec

El anchor tiene `width: 100%` **y** `aspect-ratio` ya computados y aun así mide 0 × 0. Con eso
sólo, la caja debería existir sin la imagen. **No sé todavía por qué no existe**, y esa es
exactamente la pregunta que decide si la opción 1 alcanza: si algún ancestro colapsa por otra
razón, agregar `width`/`height` al `<img>` no arreglaría nada.

⛔ **Por eso no escribo el spec todavía.** Falta una sonda del encadenamiento de ancestros en
esa ventana de ~220 ms — barata, y es lo que evita proponer un fix que no toque la causa.

## 6. Gate

**No se cumple todavía** el criterio que vos fijaste: *"sólo escribe spec cuando puedas señalar
una causa concreta reproducible"*. La causa **próxima** está señalada y es reproducible
(4/4). La causa **última** —por qué el anchor no toma su caja con `width:100%` +
`aspect-ratio`— no.

**Siguiente paso propuesto:** una sonda de ancestros en la ventana sin caja. Después de eso,
spec + red team. Sin implementar nada.

---

# ADDENDUM — sonda de ancestros: **causa raíz cerrada**

**El nodo que colapsa NO es la imagen. Es `div.hub-scaffold-anchor`.**

## Tabla before/after de la cadena (t = 3.969 → 4.021 ms)

| Nodo | `rect` antes | `rect` después | ¿Colapsado antes? |
|---|---|---|---|
| `section.hub-scaffold-body` | 390 × **369** | 390 × **521,8** | no (crece de alto) |
| `div.hub-scaffold-center` | **234** × 158 | **234** × 521,8 | **NO — su ancho es 234 todo el tiempo** |
| **`div.hub-scaffold-anchor`** | **0 × 0** | **234 × 363,8** | ⚡ **SÍ — primer nodo colapsado** |
| `div.kingdom-anchor` | 0 × 0 | 234 × 363,8 | sí (heredado) |
| `picture.kingdom-anchor-picture` | 0 × 0 | 234 × 363,8 | sí (heredado) |
| `img.kingdom-anchor-img` | 0 × 0 · `naturalWidth 0` | 234 × 363,8 · `naturalWidth 256` | sí (heredado) |

`hub-scaffold-anchor` tenía un containing block de **234 × 158** y aun así medía **0 px de
ancho**. Ése es el punto exacto donde la cadena se rompe.

## El mecanismo

```css
.hub-scaffold-center {          .hub-scaffold-anchor {
  display: flex;                  position: relative;
  flex-direction: column;         display: flex;
  align-items: center;   ⚡       align-items: center;
  justify-content: center;        justify-content: center;
}                                 min-width: 0;
                                }
```

`align-items: center` en la columna hace que sus items **se dimensionen al contenido**
(shrink-to-fit) en el eje transversal, en vez de estirarse a los 234 px disponibles. El
contenido de `hub-scaffold-anchor` es el portal → `<picture>` → `<img>`, que **no aporta ancho
hasta que llega su tamaño intrínseco**. Contenido de 0 px ⇒ item de 0 px ⇒ el `width: 100%` de
`.kingdom-anchor` resuelve a 0 ⇒ su `aspect-ratio` da alto 0.

Cuando `naturalWidth` pasa a 256, el item toma 234, el `aspect-ratio` da 363,8 de alto, la
columna crece 158 → 521,8 y la fila del hub 369 → 521,8. **Ése es el +153 px del shift.**

## Verificación en vivo (diagnóstico, no implementación)

Inyectando `.hub-scaffold-anchor { align-self: stretch }` antes del render:

| | Sin la inyección | Con `align-self: stretch` |
|---|---|---|
| Primera caja del anchor | 4.024 ms, **junto con** `naturalWidth` | **3.767 ms** |
| `naturalWidth ≠ 0` | 4.024 ms | 3.931 ms |
| ¿Caja antes que la imagen? | **no** | **sí, 164 ms antes** |
| Ventana colapsada | 210–264 ms | **ninguna** |

✅ **El anchor obtiene su caja completa (234 × 363,8) con `naturalWidth = 0`.** La causa está
confirmada en el ancestro, y el fix pertenece ahí.

## Opciones

| # | Opción | Riesgo | Contra los límites que fijaste |
|---|---|---|---|
| **1** | **`align-self: stretch` en `.hub-scaffold-anchor`** | **Bajo.** Una declaración. **Verificado en vivo** | ✅ Va **en el ancestro que colapsa** · ✅ el ancho lo da el track de 234 px y el alto el `aspect-ratio` — **dos contratos que ya existen**, nada copiado · ✅ sin `min-height` arbitrario · ✅ sin transform · ✅ 0 requests, 0 assets · ✅ no toca imágenes |
| **2** | `width: 100%` en `.hub-scaffold-anchor` | Bajo. Efecto equivalente | ✅ Igual, pero fija el ancho en vez de delegarlo al alineamiento; menos idiomático dentro de un flex |
| **3** | `width`/`height` en el `<img>` | Bajo-medio | ⚠️ **Contradice tu gate**: el ancestro colapsa, así que el fix no va en el replaced element. Y entra en el frente de imágenes que excluiste |

**Recomendación: opción 1.**

### Riesgo a verificar en el spec

`align-self: stretch` cambia el alineamiento transversal de ese item. El estado **final** es el
mismo (234 × 363,8 en los dos casos), así que no debería haber diferencia visual — **pero eso
lo decide el VR, no yo**. Y por lo medido arriba: **validar el fix mirando el CLS una sola vez
no sirve**; hay que asertar sobre la ventana colapsada (`hub-scaffold-anchor` con ancho 0),
que es determinista.

⛔ **Me detengo acá, antes del spec**, como pediste.
