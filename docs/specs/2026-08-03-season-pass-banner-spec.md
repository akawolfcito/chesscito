# Spec — El banner del Season Pass, una sola forma en dos superficies

**Fecha:** 2026-08-03 · **Estado:** propuesto · **Decisiones del founder:** cerradas (ver §2)

## 1. Qué se busca

Hoy el Season Pass se anuncia con dos formas distintas:

| Superficie | Hoy | Archivo |
| --- | --- | --- |
| Landing slide 2 (LEARN) | `Pill` — chip HUD chico, sin precio | `apps/landing/src/components/onboarding/slide-bodies.tsx:63` |
| Hub (Chesscito Lite) | Botón verde `Unirme al reto` + badge de precio flotante | `apps/web/src/components/hub/challenge-card.tsx:476` |

Un jugador que ve el pass en el onboarding y lo vuelve a encontrar en el Hub no
reconoce que es **la misma cosa**. El objetivo es **recordación**: una sola forma
de banner, el mismo icono, en las dos pantallas.

Precedente: slide 3 ya hizo este movimiento con `ProStrip` (`onboarding/pro-strip.tsx`),
portado de `.kingdom-card-pro-cta` del Hub. Este spec hace lo mismo para el pass,
pero en la dirección inversa — la forma nace en el landing y baja al Hub.

## 2. Decisiones cerradas (founder, 2026-08-03)

1. **El banner del landing NO navega.** Slide 2 es onboarding puro; el checkout
   está a dos navegaciones. Misma regla que `ProStrip`.
2. **El chevron se queda en las dos superficies.** La recordación depende de que
   se vean idénticas. En el landing va `aria-hidden` y el contenedor no es
   focusable — se ve como botón, no lo es.
3. **En el Hub el banner reemplaza SOLO el botón verde**, no la tarjeta. La
   cabecera (título, racha, llamitas, stats) queda intacta.
4. **Un solo icono para el pass en todo el producto:** el arte de
   `landing-slides/season-pass-icon` (calendario cremita con estrella y 21).
   Reemplaza al `21-day-icon` (calendario con cerebro) que usa el Hub.
5. **El precio va como chip dorado dentro del banner.** Esto invierte la regla
   "los precios no son pills" (commit `206abf43`): esa regla nació de pills
   *decorativos* del HUD. Acá el chip vive dentro de una forma que en el Hub SÍ
   es un botón, y es la señal de recordación más fuerte que tiene el banner.

## 3. El icono: cómo se unifica sin tocar el catálogo

El slot `hub.21-day-icon` tiene **tres consumidores** en `apps/web`:

- `challenge-card.tsx:217` — cabecera de la tarjeta
- `hub-tour.tsx:296` — beneficio del mini-tour
- `season-pass-sheet.tsx:104` — beneficio del sheet de compra

**Enfoque: reemplazar los ARCHIVOS, no el slot.** Se sobreescriben
`apps/web/public/art/21-day-icon.{png,webp,avif}` con el arte de
`season-pass-icon`, redimensionado. Consecuencias:

- ✅ Los tres consumidores se unifican de una, sin tocar código.
- ✅ Cero slots nuevos → no se rompen las 3 baselines de conteo de temas
  (script de audit + 2 tests) ni el `tsc` de las claves.
- ✅ El test que pinea `/art/21-day-icon.png` (`season-pass-sheet.test.tsx:138`)
  sigue verde: pinea la RUTA, no el contenido.
- ⚠️ **Se pierde el arte del calendario-cerebro.** Recuperable por git; el
  founder lo confirmó en §2.4.
- ⚠️ **Peso:** `season-pass-icon.png` pesa 870 KB y el icono se pinta a ~66px.
  Hay que bajarlo al orden del actual (~30 KB) antes de copiarlo. Un PNG de
  870 KB en la cabecera del Hub es una regresión de performance, no un cambio
  de arte.

El landing **no cambia de asset**: sigue apuntando a `ICONS.seasonPass`.

## 4. Anatomía del banner

```
┌──────────────────────────────────────────────────┐
│  ┌────┐  Título (0.8rem, bold)      ┌────────┐   │
│  │icon│  Beneficios · dos líneas    │ $0.99  │ › │
│  └────┘  (0.62rem, opacity .8)      └────────┘   │
└──────────────────────────────────────────────────┘
```

Cuatro zonas, en este orden de lectura: **icono → copy → precio → chevron**.
El copy es el único bloque que crece (ES es más largo que EN) y envuelve a dos
líneas en vez de truncar — misma decisión que `ProStrip`.

### Copy por superficie

| Zona | Landing slide 2 | Hub (estado `join`) |
| --- | --- | --- |
| Título | `onboarding.slide2.passLabel` | `CHALLENGE_CARD_COPY.joinCta` ("Unirme al reto") |
| Beneficios | `onboarding.slide2.passBenefits` | — (los stats ya están arriba en la tarjeta) |
| Precio | literal del slide | `challenge.priceLabel` |

En el Hub el título **conserva el verbo del CTA**. No repite "Reto Mental de 21
Días": la cabecera de la tarjeta ya lo dice tres líneas más arriba, y un banner
que repite el título convierte el CTA en un cartel.

### Tratamiento visual (founder, 2026-08-03 — vale para las DOS superficies)

- **Fondo:** degradado horizontal **dorado → cream**, el dorado saturado detrás
  del icono y desaturándose hacia la derecha, de modo que el copy quede sobre la
  zona clara y conserve contraste.
- **Borde:** hairline dorado claro. **Radio:** grande (la forma tiende a
  cápsula, no a tarjeta cuadrada).
- **Sombra:** glow externo suave y cálido — la misma familia que ya usa el HUD,
  no una drop-shadow gris.
- **Icono:** flota sobre el extremo izquierdo, ligeramente mayor que la altura
  del copy.
- **Chip de precio:** dorado sólido con borde dorado oscuro y texto marrón
  oscuro — más saturado que el fondo, para que gane el ojo dentro de una pieza
  que ya es dorada.
- **Copy:** marrón oscuro, no negro. Título bold; beneficios un escalón menor y
  atenuados.
- **Chevron:** dorado oscuro, alineado al borde derecho.

En el Hub esto **reemplaza el verde** del `principal-button`. El pass no compite
con ningún otro CTA dentro de esa tarjeta, así que no pierde jerarquía; lo que
gana es ser reconocible como la misma pieza del onboarding.

## 5. Estados de UI

### 5.1 Landing slide 2 — un solo estado

Estático. Sin hover, sin focus, sin `:active`. `role` ausente, `tabIndex`
ausente, chevron `aria-hidden`. Un lector de pantalla anuncia el título y los
beneficios como texto, no como control.

### 5.2 Hub — el banner vive SOLO en `ctaState === "join"`

`ChallengeCard` tiene cuatro estados de CTA (`challenge-card.tsx:52`). Sólo uno
cambia:

| `ctaState` | Cuándo | Qué se renderiza | Cambia? |
| --- | --- | --- | --- |
| `join` | sin pass activo | **BANNER** (reemplaza el botón verde) | ✅ sí |
| `start` | pass activo, día pendiente | botón `principal-button` actual | ❌ no |
| `tomorrow` | pass activo, día hecho | `<p>` con skin de CTA (`role="status"`) | ❌ no |
| `complete` | reto terminado | `<p>` con skin de CTA | ❌ no |

Sub-estados del banner en `join`:

| Sub-estado | Condición | Comportamiento |
| --- | --- | --- |
| Disponible | `onJoinChallenge != null` | `<button>` habilitado + pulso (`is-pulsing`) |
| Resolviendo | `onJoinChallenge == null` | `disabled`, **sin pulso** — un CTA que late deshabilitado publicita un botón muerto (regla ya vigente en `:478`) |
| Con tour | `data-tour-spotlight` en el ancestro | la flecha `season.story-arrow` sigue apuntándole; el ancla sigue siendo la ROW, no el botón |

**Invariantes que no se tocan:**
- La flecha del tour es hermana del banner dentro de `.challenge-card-cta-row`.
  Su nudge anima `translateX` → tiene que quedar **al lado**, nunca arriba.
- `data-testid="challenge-cta"` y `data-cta-state="join"` se conservan en el
  banner: hay tests que los leen.
- `aria-label` sigue siendo `joinAriaLabel` con el precio adentro (el precio es
  visualmente un chip; para un lector de pantalla tiene que ser parte de la
  frase del botón, no un fragmento suelto).

## 6. Dónde vive el CSS

- **Hub:** `apps/web/src/app/globals.css` — ÚNICO archivo CSS del app. Familia
  nueva `.challenge-card-pass-banner*`.
- **Landing:** el landing porta las clases verbatim, como ya hizo con
  `.candy-tray-pill` y `.onboarding-pro-strip`. No comparte hoja con el Hub.
- ⚠️ **Riesgo conocido:** dos copias de la misma geometría no las delata ningún
  test de comportamiento (ver `feedback_duplicated_geometry_passes_every_behavioural_test`).
  Mitigación: un comentario en cada copia que nombre a la otra, y la medida
  canónica escrita una sola vez en prosa en el CSS del Hub.

## 7. Plan de trabajo (TDD)

1. **Arte** — redimensionar `season-pass-icon` y sobreescribir los tres archivos
   de `21-day-icon`. Verificar `art:sync-landing:check`.
2. **CSS del Hub** — `.challenge-card-pass-banner` y sus partes.
3. **Test rojo (Hub)** — el estado `join` renderiza el banner con precio,
   chevron oculto a a11y, y conserva testids + `disabled` sin pulso.
4. **Hub verde** — reemplazar el `<button>` de `join` por el banner.
5. **Test rojo (landing)** — slide 2 renderiza el banner y **no** expone ningún
   control (`queryByRole("button")` / `"link"` → null).
6. **Landing verde** — `SeasonPassBanner` decorativo reemplaza al `Pill`.
7. **VR** — revisar si algún baseline fotografía el Hub o slide 2; regenerar
   sólo esos, mirando el diff (un VR verde puede fotografiar un error).
8. Suite completa **una sola vez** antes de commitear.

## 8. Preguntas abiertas

1. ¿El `Pill` queda sin consumidores después de esto? Si sí, ¿se borra o se
   deja? (Slide 1 podría estar usándolo — verificar antes de tocarlo.)
2. ¿El banner del Hub mantiene el verde del `principal-button` o adopta el
   dorado/cremita del landing? La recordación pide cremita; el verde es el color
   de "acción primaria" de todo el Hub. **Recomendación:** cremita con el chip
   dorado — es lo que hace reconocible al banner, y el pass no compite con
   ningún otro CTA en esa tarjeta.
