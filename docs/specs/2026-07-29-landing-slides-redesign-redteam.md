# Red Team Review — landing-slides-redesign

**Date**: 2026-07-29
**Reviewer mindset**: hostile QA + senior engineer
**Spec bajo revisión**: `docs/specs/2026-07-29-landing-slides-redesign.md`

---

## Findings

### P0 — Must address before implementation

**[switch/visual] El switch se contradice consigo mismo: resalta LEARN *y* marca "Última vez" en PLAY.**
El pedido dice reusar el switch "con ese estilo como resaltando LEARN", y el CSS de origen
lo hace con `.hub-app-mode-switch-pill[aria-pressed="true"]`
(`apps/web/globals.css:8269`): degradado dorado en la mitad activa. En la app eso significa
*"estás en LEARN"* — un hecho. En el landing no hay modo activo, así que ese resaltado
pasaría a significar *"elegí LEARN"*, una recomendación.
Ahora crucemos con la decisión #13 del spec: el visitante que la última vez eligió PLAY ve
**la mitad de LEARN en dorado** y **el label verde sobre PLAY**. Dos señales opuestas en
120px de ancho, y la que grita más fuerte (el dorado) es la equivocada.
— **Por qué bloquea**: no es un detalle de CSS, es qué le está diciendo la pantalla al
jugador. Hay que elegir una: (a) ninguna mitad resaltada, el label es la única marca;
(b) LEARN siempre resaltado como recomendación del producto, y el label se acepta como
señal secundaria; (c) el resaltado sigue a `lastUsedMode`, lo que deroga la decisión #13.
El spec afirma (a) en el punto 13 pero hereda el CSS de (b) en el punto 11.

**[layout] El punto 10 saca el control del slide 4 del lugar donde estuvo tres pantallas seguidas.**
"Sin botón dorado: `ctaSlot` va ausente" pone el switch dentro de `children`, o sea **dentro
del bloque de contenido centrado**, no en la fila del CTA. Eso mueve el único control con
destino real a una altura distinta de la que ocuparon NEXT/NEXT/NEXT.
El código actual documenta explícitamente por qué eso es malo
(`slide-bodies.tsx:164-168`: *"A button that moves on the last slide asks the thumb to
unlearn three screens of muscle memory exactly where the tap matters most"*), y la propia
referencia del founder pone los controles al pie.
— **Por qué bloquea**: el spec revierte una decisión de producto ya tomada sin decir que la
está revirtiendo. El switch debe ir **en `ctaSlot`** (con la nota "You can switch anytime."
debajo), y `ctaSlot` pasa a aceptar cualquier control, no sólo un botón.

**[assets] El punto 2 (`object-position: center bottom`) es inimplementable con `ArtImage`.**
`ArtImage` aplica `className` al `<picture>` y fija `object-cover`/`object-contain` en el
`<img>` interno (`art-image.tsx:18-25`). `object-position` afecta al **elemento
reemplazado**, o sea al `<img>` — una clase pasada por `className` aterriza en el
`<picture>`, donde no hace nada. El mismo archivo ya advierte de esta clase de error
("sizing/positioning classes passed via `className` silently no-op").
— **Por qué bloquea**: falla en silencio. El anclaje se ve correcto en el viewport del
desarrollador (donde el recorte es lateral, ver P2) y decapita al lobo en los viewports
bajos donde el anclaje era justamente el punto. `ArtImage` necesita un prop explícito
(`objectPosition` o `imgClassName`) antes de que ningún slide lo use.

---

### P1 — Should address

**[ProStrip] Portar `.kingdom-card-pro-*` arrastra un selector que apunta a un componente inexistente.**
`.kingdom-card-pro-visual` reserva `66px` de ancho y `42px` de alto, y su contenido lo
dibujan `.kingdom-card-pro-visual .hub-pro-badge` / `.hub-pro-badge-label`
(`apps/web/globals.css:9567-9590`). `HubProBadge` no existe en `apps/landing` y no se va a
portar (usa el sistema de temas). Copiar el bloque tal cual deja **un hueco de 66px** a la
izquierda de la franja.
— *Riesgo si se ignora*: la franja renderiza descentrada y alguien "arregla" el síntoma
borrando el ancho, perdiendo la alineación con la referencia. El spec debe decir que
`ProStrip` monta `<ArtImage src={ICONS.pro}>` con su propia clase de tamaño y que
`.kingdom-card-pro-visual` se porta **sin** sus dos selectores descendientes.

**[a11y] `aria-pressed` en un `<a>` es ARIA inválido, y el CSS portado depende de él.**
El punto 11 convierte las mitades en enlaces; el CSS de origen estila con
`[aria-pressed="true"]`. `aria-pressed` pertenece al rol `button`; en un link es un atributo
que ningún lector interpreta y que un linter de a11y marca. Usar `data-active` (o
`aria-current="page"` si se decide que hay una mitad "actual").
— *Riesgo si se ignora*: se cuela un atributo ARIA falso sólo para pintar, y queda como
precedente copiado en el próximo componente.

**[swipe] El spec no dice dónde vive la superficie de swipe ahora que el marco desapareció.**
Hoy los handlers cuelgan de un div **dentro** del marco (`slide-shell.tsx:114-119`,
`data-testid="slide-swipe-area"`), o sea de un área que no contiene ni el CTA ni el footer.
Con el marco eliminado hay que decidir explícitamente si el swipe cubre toda la columna. Si
la cubre, envuelve al switch del slide 4 y al footer legal: un arrastre corto que empiece
sobre "TRAINING" puede terminar navegando de slide **y** activando el link.
— *Riesgo si se ignora*: taps fantasma en el control más importante del flujo. Definir la
superficie y que un gesto reconocido como swipe cancele el tap.

**[dead end] Borrar `WelcomeBack` deja `/classic` sin un solo enlace en la UI.**
Verificado: las únicas referencias a `/classic` son `welcome-back.tsx:28` (el link
"Not sure? See other modes") y el fallback de `/api/enter` cuando no viene `mode`
(`route.ts:16`). Eliminado el primero, el landing clásico —`landing-page.tsx`,
`phone-stack.tsx`, `phone-frame.tsx`, sus assets— queda alcanzable sólo escribiendo la URL.
— *Riesgo si se ignora*: se borra un camino de navegación sin que nadie lo haya decidido, y
queda un árbol de componentes vivo que ningún flujo visita. Decidir: se acepta (y se agenda
su borrado), o el enlace reaparece en algún lado.

**[i18n] Verificado que el título ES dice otra palabra — y ningún criterio lo comprueba.**
`design/a-slides/ES-learn.png` dice **"APRENDE"**, no "LEARN". El spec pide `alt` traducido
(punto ~contratos, `titleAlt`) pero el criterio de aceptación sólo verifica que *el archivo*
cambie entre locales, no que el `alt` lo haga.
— *Riesgo si se ignora*: un lector de pantalla en ES anuncia "Learn" sobre una imagen que
dice "APRENDE". Agregar criterio: el `alt` renderizado en `es` ≠ el renderizado en `en`
para los slides 2–4.

**[i18n] El truncado del ProStrip está en edge cases pero no en criterios.**
`.kingdom-card-pro-subtitle` trae `white-space: nowrap` + `text-overflow: ellipsis`
(`globals.css:9609-9617`). "Full Play · Unlimited Coach · Season Pass included" en ES es
más largo y se corta. El spec dice que debe envolver, pero no hay `- [ ]` que lo verifique.
— *Riesgo si se ignora*: la única explicación del producto de pago se sirve cortada con
puntos suspensivos, en el idioma del founder.

**[perf] Un fondo distinto por slide convierte cada tap en una decodificación de imagen.**
El spec manda la precarga a *out of scope*, pero los cuatro fondos son 2.0–2.5 MB en PNG
(≈60–100 KB en AVIF) y hoy **no hay ninguno cargado de antemano**: cada `<ArtImage>` se
monta al cambiar de paso. Antes había un solo fondo para los cuatro slides, así que este
costo es **nuevo**, no heredado.
— *Riesgo si se ignora*: parpadeo a `#1a3fae` en cada avance, en la pantalla que forma la
primera impresión del producto, y peor en la conexión de un usuario de MiniPay. Un
`<link rel="preload">` del slide siguiente, o montar los cuatro con el inactivo en
`opacity-0`, cuesta poco y no es una optimización prematura: es el comportamiento base.

**[CLS] Ninguna imagen del flujo declara `width`/`height`.**
`ArtImage` no acepta esas props. Con fondos full-bleed y títulos que ocupan un tercio del
alto visible, el layout salta mientras cargan.
— *Riesgo si se ignora*: se hereda de la implementación actual, pero el rediseño multiplica
la superficie de imagen. Es el momento de agregarlas, no el próximo.

---

### P2 — Nice to clarify

- **[layout] `object-position: center bottom` sólo actúa en un régimen.** Con la columna en
  420px, el recorte es vertical sólo si el alto disponible es menor a ~746px; por encima de
  eso `cover` escala por altura y recorta a los **lados**, donde `bottom` no hace nada. El
  spec presenta el anclaje como si gobernara siempre.
- **[nav] El visitante onboarded que retrocede al slide 2 y cambia de idioma salta al 4.**
  Es consecuencia directa del punto 16 + 22, y es defendible, pero conviene que esté escrito
  como decisión y no como sorpresa.
- **[contratos] `TOTAL_SLIDES` queda declarado en `slides.ts` mientras el carrusel tiene su
  propia constante** (`onboarding-carousel.tsx:15`). Una de las dos sobra.
- **[no-JS] El spec dice que el slide 4 funciona sin JS**, pero sólo se llega a él sin JS si
  las cookies ya existen — o sea, únicamente quien ya eligió. Para el primerizo el carrusel
  entero es inerte. Vale decirlo así.
- **[naming] `pro-suscription-icon`** arrastra el typo del asset original (`suscription`).
  Si se toca el directorio, es el momento; si no, dejarlo y no inventar una segunda grafía.

---

## Categories audited

**Contract gaps** — `SlideVisual.titleSrc` como `Record<Locale, string>` completo está bien
(un locale nuevo rompe en tipos). `CarouselEntry` es total, sin opcionales. No hay `any`.
Falta: el tipo del prop que resuelve el problema P0-3 en `ArtImage`.

**Behavioral ambiguity** — Dos ambigüedades reales, ambas P0 (qué mitad se resalta; dónde
vive el switch). El resto de los "given/when/then" tienen disparador claro.

**Hidden assumptions** — El spec asume que `.kingdom-card-pro-*` y `.hub-app-mode-switch*`
se portan limpio; no es cierto (P1 × 2). Asume que `ArtImage` puede anclar el recorte; no
puede (P0-3). Asume que `localePrefix: "as-needed"` está contemplado — eso sí está bien
capturado en el punto 21, y es el error que habría cometido copiando el componente de
`apps/web`.

**Backward compatibility** — No se toca el contrato de cookies ni `/api/enter`, así que
nadie pierde su preferencia. Las cookies existentes de un año siguen siendo válidas y ahora
significan "aterrizá en el slide 4" en vez de "mostrá WelcomeBack": es un cambio de UI sobre
el mismo dato, sin migración. ✅

**Security & data** — Sin PII nueva, sin auth, sin endpoints nuevos. Las cookies siguen
siendo `sameSite: lax` sin `httpOnly` — ya era así y el dato no es sensible (learn|play). El
`LocaleSwitch` escribe `NEXT_LOCALE` desde el cliente, igual que la app. Nada que objetar.

**Test coverage gaps** — Los criterios cubren entrada, render y slide 4. Faltan tres:
`alt` traducido (P1), el ProStrip envolviendo en ES (P1), y que un swipe no dispare el link
del switch (P1). Además, ningún criterio verifica el comportamiento del punto 17 (el
onboarded puede navegar hacia atrás), que es la mitad del valor del cambio.

**Operational readiness** — No hay flag: el rediseño entra o no entra. Para una pantalla
estática es defendible, y el rollback es el revert del commit. Sin logging que agregar.
Lo que sí falta es decir **qué se mira en device** para dar por buena la pantalla: son 4
slides × 2 locales × 2 estados de entrada = 16 vistas, y el founder no las va a recorrer a
ciegas. Un probe `/dev` o al menos una lista de verificación.

---

## Verdict (ronda 1)

**NEEDS REVISION** — 3 P0, 8 P1, 5 P2.

---

# Ronda 2 — verificación sobre el spec v2

**Date**: 2026-07-29

## P0

| # | Hallazgo | Resolución en v2 |
|---|---|---|
| 1 | Switch contradictorio | **Decisión del founder**: LEARN va **siempre** en dorado como recomendación de producto. La contradicción con el label queda **documentada como esperada** (punto 18), no negada. El punto 13 original —"la mitad marcada no se resalta"— se reformuló: el dorado ya no depende de `lastUsedMode`, así que no hay dos reglas peleando por el mismo píxel, hay dos señales con dueños distintos. ✅ |
| 2 | Switch fuera de la posición del CTA | `ctaSlot` → **`actionSlot`**, renombrado con contrato explícito ("su contrato es la POSICIÓN, no el control"). El switch va ahí, con la nota debajo. ✅ |
| 3 | `object-position` inexpresable | `ArtImage` gana `imgClassName` (+ `width`/`height`), y el punto 2 obliga a usarlo. Criterio de aceptación agregado. ✅ |

## P1

| Hallazgo | Resolución en v2 |
|---|---|
| ProStrip hereda selectores de `HubProBadge` | Punto 12: se portan 4 clases, se descartan las 2 descendientes, el icono es `ArtImage` con clase propia. ✅ |
| `aria-pressed` en un `<a>` | Punto 16: `data-recommended="true"`. Criterio que lo prohíbe explícitamente. ✅ |
| Superficie de swipe indefinida | Punto 6: la zona es **sólo** la fila de contenido; `topSlot`/`actionSlot`/`footer` quedan fuera. Resuelto por estructura, no por `preventDefault`. ✅ |
| `/classic` huérfano | **Aceptado por el founder.** Punto 24 lo dice en el spec; el borrado del árbol va a *out of scope*. ✅ |
| `alt` no verificado por locale | Criterio: el `alt` en `es` difiere del de `en` en slides 2–4. Confirmado con el asset: dice "APRENDE". ✅ |
| ProStrip truncando en ES | Punto 13 quita `nowrap`+`ellipsis`; criterio de aceptación propio. ✅ |
| Parpadeo por fondo nuevo en cada tap | Punto 3: los 4 fondos montados a la vez, 3 en `opacity-0`. Sale de *out of scope*. ✅ |
| CLS sin `width`/`height` | `ArtImage` los acepta. ⚠️ **Parcial**: ningún criterio verifica que se pasen en cada uso. Aceptable — es visible a ojo y el prop existe. |

## P2

Sin cambios salvo dos: el régimen limitado de `object-position` quedó escrito en el punto 2,
y el salto de paso al cambiar idioma quedó como decisión explícita en el punto 27. Los otros
tres (`TOTAL_SLIDES` duplicado, no-JS, typo `suscription`) siguen abiertos y son cosméticos.

## Lo que v2 agregó por su cuenta

Una sección **Verificación en device** con las 4 vistas que la suite no puede juzgar. El
hallazgo de "operational readiness" pedía exactamente eso.

## Verdict (ronda 2)

**READY for /tdd** — 0 P0, 1 P1 parcial (CLS, aceptado), 3 P2 cosméticos.

Riesgo residual que no desaparece con más spec: el punto 18 —dorado y label en mitades
opuestas— es la clase de cosa que se juzga viéndola. Está en el cuadro de verificación en
device como ítem 1, y es lo primero que hay que mirar cuando la pantalla exista.
