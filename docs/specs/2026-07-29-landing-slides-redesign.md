# Spec — landing-slides-redesign

**Date**: 2026-07-29
**Status**: v2 — P0 del red team cerrados
**Audit**: `docs/audits/2026-07-29-landing-slides-audit.md`
**Red team**: `docs/specs/2026-07-29-landing-slides-redesign-redteam.md`
**App**: `apps/landing` · route `/[locale]` (`localePrefix: "as-needed"` → EN en `/`, ES en `/es`)

---

## Problem

Los 4 slides del onboarding renderizan **arte genérico dentro de un marco dorado PNG**: un
fondo único para los cuatro, un marco de aspect ratio fijo `980/1398`, y el contenido
apretado adentro con `px-[9%] py-[6%]` y `overflow-y-auto`. El marco impone un ancho
derivado de la altura (`min(100%, calc(54dvh * 0.9))`), así que en pantallas bajas el
contenido se comprime o scrollea dentro de un recuadro — la peor lectura posible de una
pantalla de bienvenida.

Además, quien ya eligió su modo **nunca vuelve a ver el carrusel**: `page.tsx` lo desvía a
`WelcomeBack`, una pantalla separada con su propio copy. El visitante que quiere cambiar de
opinión tiene que descubrir un link secundario ("Not sure? See other modes") que lo saca
del onboarding hacia `/classic`.

## Goal

Cada slide es una ilustración a pantalla completa con su chrome encima, y el visitante que
ya eligió aterriza en el slide 4 con su elección anterior marcada, pudiendo cambiarla en un
tap.

## Non-goals

- No se rediseña `/classic` ni `/stats`.
- No se agrega analítica, animaciones de transición entre slides, ni precarga de assets.
- La franja PRO **no vende**: es evidencia visual, no un checkout.
- No se toca `/api/enter` ni el contrato de cookies.

---

## Contracts (SDD)

### Assets por slide

```ts
// lib/onboarding/slides.ts  (reemplaza SlideAssets / SLIDE_ASSETS / FRAME_SRC /
//                            MOBILE_SCENE_SRC / DESKTOP_SCENE_SRC)
import type { Locale } from "@/i18n/routing";

export type SlideStep = 1 | 2 | 3 | 4;

export interface SlideVisual {
  step: SlideStep;
  /** Ilustración full-bleed, sin extensión (ArtImage agrega avif/webp/png). */
  backgroundSrc: string;
  /**
   * Título como arte, por locale. El slide 1 apunta al MISMO archivo en `en` y
   * `es` — el wordmark "CHESSCITO" no se traduce. Es un Record completo, no un
   * opcional con fallback: un locale nuevo debe fallar en tipos, no renderizar
   * inglés en silencio.
   */
  titleSrc: Record<Locale, string>;
}

export const SLIDE_VISUALS: Readonly<Record<SlideStep, SlideVisual>>;

export const TOTAL_SLIDES = 4;
```

### Estado de entrada del carrusel

```ts
// lib/onboarding/types.ts  (agregado; PreferredMode y ONBOARDING_COOKIE sin cambios)

/**
 * Lo que `page.tsx` (server) le pasa al carrusel (client). Se deriva de
 * `resolveOnboardingState`, que NO cambia.
 */
export interface CarouselEntry {
  /** Dónde arranca. 4 si hay preferencia guardada, 1 si no. */
  initialStep: SlideStep;
  /** Sobre qué mitad del switch va el label. `null` = primera visita. */
  lastUsedMode: PreferredMode | null;
}

export function carouselEntryFor(state: OnboardingCookieState): CarouselEntry;
```

### Componentes

```ts
// components/onboarding/art-image.tsx  (firma AMPLIADA — P0-3)
export function ArtImage(props: {
  src: string;
  alt: string;
  /** Clases del <picture> (posicionamiento del contenedor). */
  className?: string;
  fit?: "contain" | "cover";
  /**
   * Clases del <img> INTERNO. Existe porque `object-position` afecta al
   * elemento reemplazado: una clase pasada por `className` aterriza en el
   * <picture> y no hace nada, en silencio. Sin este prop el anclaje del
   * recorte es inexpresable.
   */
  imgClassName?: string;
  /** Dimensiones intrínsecas, para reservar la caja y no saltar al cargar. */
  width?: number;
  height?: number;
}): JSX.Element;

// components/onboarding/slide-shell.tsx  (firma modificada)
export function SlideShell(props: {
  /** Ilustración de ESTE slide. El shell ya no conoce un fondo global. */
  backgroundSrc: string;
  topSlot?: ReactNode;
  children: ReactNode;
  /**
   * La fila de acción al pie del slide. NO es "el botón": en los slides 1-3
   * lleva el botón dorado y en el 4 lleva el switch + su nota. Se llama slot
   * porque su contrato es la POSICIÓN, no el control.
   */
  actionSlot?: ReactNode;
  footer: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}): JSX.Element;

// components/onboarding/mode-switch.tsx  (nuevo)
export function ModeSwitch(props: {
  /** Marca qué mitad lleva el label flotante. `null` → ninguna. */
  lastUsedMode: PreferredMode | null;
  /** Texto del label ("Last used" / "Última vez"). */
  lastUsedLabel: string;
  learnLabel: string;
  playLabel: string;
}): JSX.Element;

// components/onboarding/pro-strip.tsx  (nuevo, presentacional puro)
export function ProStrip(props: {
  title: string;      // "PRO · $1.99 / 30 days"
  benefits: string;   // "Full Play · Unlimited Coach · Season Pass included"
}): JSX.Element;

// components/onboarding/locale-switch.tsx  (nuevo)
export function LocaleSwitch(): JSX.Element;
```

### Copy (claves nuevas / modificadas)

```ts
onboarding: {
  progress: "{current} of {total}",            // era "{current} / {total}"
  slide1: { welcomeTo, titleAlt, support, cta },
  slide2: { titleAlt, support, passLabel, passBenefits, cta },
  slide3: { titleAlt, support, proTitle, proBenefits, cta },
  slide4: { titleAlt, support, learnLabel, playLabel, lastUsed, switchNote },
  legal:  { privacy, terms, support },          // sin cambios
  nav:    { previous, next, regionLabel },       // aria-labels, hoy hardcodeados en inglés
  language: { label, switchTo },                 // aria del selector
}
// ELIMINADAS: onboarding.welcomeBack.*  (headline, cta, notSureLink)
// ELIMINADAS: slideN.headline, slideN.price, slide1.learnPill*/playPill*,
//             slide2.passport*, slide3.savedGamesPill/coachReviewPill,
//             slide4.learnDescription/jumpToPlay
```

---

## Behavior

### Estructura visual

1. El shell renderiza, dentro de una columna centrada de `max-w-[420px]` y `h-dvh`:
   la ilustración del slide como capa `absolute inset-0` con `object-cover`, y encima
   una grilla de 3 filas — `topSlot` pegado al borde superior, contenido al centro,
   `footer` pegado al inferior. **No hay marco.** El color plano `#1a3fae` que ya pinta
   el shell queda visible fuera de la columna en viewports anchos.
2. La ilustración se ancla con `object-position: center bottom`, pasado por `imgClassName`
   (nunca por `className`, ver contrato de `ArtImage`). El lobo vive en la mitad inferior
   del arte y el cielo superior es zona de sacrificio: recortar por arriba pierde nube,
   recortar por abajo decapita al personaje. El anclaje **sólo se hace sentir cuando el
   alto disponible es menor a `420 / (941/1672) ≈ 746px`**; por encima de eso `cover`
   escala por altura y recorta a los lados, donde `bottom` es inerte.
3. **Los cuatro fondos se montan a la vez**, con el del paso activo en `opacity-100` y los
   otros tres en `opacity-0` (`aria-hidden`, `pointer-events-none`). Montar sólo el activo
   obliga al navegador a decodificar una imagen nueva en cada tap y produce un parpadeo al
   azul de fondo — un costo que **no existía** cuando los cuatro slides compartían un
   fondo. No es optimización prematura: es el comportamiento base.

### Chrome compartido (los 4 slides)

4. `SlideNav` (◀ · contador · ▶) se mantiene sin cambios estructurales. El contador
   pasa a mostrar **estrella + `1 of 4`** (`CandyIcon name="star"` +
   `t("progress", { current, total })`).
5. `LegalFooter` se mantiene (Privacy · Terms · Support) y suma el `LocaleSwitch` a su
   derecha, en la misma fila.
6. **Superficie de swipe**: los handlers pasan del div interno del marco (que ya no existe)
   a la **fila de contenido central**, no a la columna entera. El `topSlot`, el
   `actionSlot` y el `footer` quedan fuera: son las tres zonas con controles, y un arrastre
   que empieza sobre un enlace no debe navegar de slide *y* activarlo. Umbral sin cambios
   (`SWIPE_THRESHOLD_PX = 40`, y se descarta si `|dy| >= |dx|`).

### Contenido por slide

7. **Slide 1** — fondo `slide-bg-1`; línea "WELCOME TO" en `fantasy-title`; título arte
   `title-chesscito` (mismo archivo en EN y ES); divider con estrella; texto de apoyo
   *"Train your mind. / Build your daily focus."*; botón dorado de avance; footer.
8. **Slide 2** — fondo `slide-bg-2`; título arte `title-learn-{locale}`; divider; texto
   *"Build your focus, one day at a time."*; chip con `season-pass-icon`, label
   *"21-Day Season Pass · $0.99"* y sublabel *"Daily training · Progress rewards ·
   3 welcome Shields"*; botón de avance; footer.
9. **Slide 3** — fondo `slide-bg-3`; título arte `title-play-{locale}`; divider; texto
   *"Play full games. / Learn from every move."*; `ProStrip`; botón de avance; footer.
10. **Slide 4** — fondo `slide-bg-4`; título arte `title-choose-{locale}`; divider; texto
    *"Start with training or jump into a game."*; y en el **`actionSlot`** —el lugar exacto
    donde estuvo el botón en los tres slides previos— el `ModeSwitch` con la nota sutil
    *"You can switch anytime."* debajo. No hay botón dorado: el switch **es** la acción.
    Mover el control al bloque de contenido pediría al pulgar desaprender tres pantallas
    justo donde el tap decide (razón ya documentada en `slide-bodies.tsx:164-168`).

### La franja PRO del slide 3

11. `ProStrip` es **decorativa**: un `<div>`, no un botón ni un enlace. El landing no vende;
    la franja es evidencia de que el producto existe. Sin chevron, sin handler, sin foco.
12. Porta `.kingdom-card-pro-cta`, `-copy`, `-title` y `-subtitle` de `apps/web`, y
    **descarta** `.kingdom-card-pro-visual .hub-pro-badge{,-label}`: `HubProBadge` vive del
    sistema de temas y no se porta. El icono es un `<ArtImage src={ICONS.pro}>` con clase
    propia; sin eso, el ancho reservado de 66px queda vacío.
13. `.kingdom-card-pro-subtitle` **pierde** `white-space: nowrap` + `text-overflow: ellipsis`
    y envuelve a dos líneas. Es la única vez que se explica el producto de pago, y en ES la
    línea de beneficios es más larga: truncarla con puntos suspensivos corta el argumento.

### El switch del slide 4

14. `ModeSwitch` reusa el aspecto de `.hub-app-mode-switch` (píldora cream, borde ámbar, dos
    mitades), pero **cada mitad es un `<a href="/api/enter?mode=learn|play">`**, no un botón
    de estado. No hay estado intermedio: tocar navega.
15. **La mitad de LEARN va siempre en dorado** (decisión del founder, 2026-07-29). Acá el
    dorado no dice "estás en LEARN" como en la app: dice *"empezá por acá"*. Es una
    recomendación de producto, constante, independiente de las cookies.
16. El resaltado se estila con **`data-recommended="true"`**, no con `aria-pressed`:
    `aria-pressed` pertenece al rol `button` y en un enlace es un atributo que ningún lector
    interpreta. Portar el selector `[aria-pressed="true"]` tal cual metería ARIA falso en el
    DOM sólo para pintar.
17. Si `lastUsedMode` no es `null`, un label verde flota **sobre la mitad correspondiente**,
    alineado al borde exterior de esa mitad: izquierda para `learn`, derecha para `play`.
    Dice "Last used" / "Última vez".
18. Cuando `lastUsedMode === "play"`, el dorado (LEARN) y el label (PLAY) caen en mitades
    distintas. **Es esperado**: el dorado es la recomendación del producto y el label es el
    historial del jugador, dos cosas que no tienen por qué coincidir. Fuera de ese label, la
    mitad marcada no recibe ningún énfasis extra.
19. El label es texto real, no decoración: se asocia al enlace con `aria-describedby`, así
    que un lector de pantalla anuncia "Training, Last used".

### Entrada y persistencia

20. `page.tsx` sigue leyendo las cookies con `resolveOnboardingState()`. Ya no bifurca a
    otra pantalla: siempre renderiza `<OnboardingCarousel {...carouselEntryFor(state)} />`.
21. `carouselEntryFor` devuelve `{ initialStep: 4, lastUsedMode: mode }` cuando hay
    preferencia válida, y `{ initialStep: 1, lastUsedMode: null }` cuando no.
22. El visitante que aterriza en el slide 4 **puede navegar hacia atrás** con ◀ y ver los
    slides 1–3 completos. ▶ queda deshabilitado (ya está en el último).
23. El label del punto 17 aparece **siempre que haya preferencia guardada**, se llegue al
    slide 4 por aterrizaje o navegando. No hay estado "ya lo vi".
24. `WelcomeBack` se elimina: componente, test y las tres claves `onboarding.welcomeBack.*`
    en EN y ES. Con eso **`/classic` queda sin ningún enlace en la UI** — alcanzable sólo
    por URL directa o por el fallback de `/api/enter` sin `mode`. Aceptado por el founder
    (2026-07-29); se anota como candidato a borrado en una limpieza futura, no acá.

### Idioma

25. `LocaleSwitch` muestra las dos opciones a la vez (EN | ES) con la activa resaltada,
    escribe `NEXT_LOCALE` por un año (`path=/; samesite=lax`) y navega duro al destino.
26. **`localePrefix` es `"as-needed"`**: el destino de `en` es `/` (sin prefijo) y el de
    `es` es `/es`. Copiar `LocaleSwitcher` de `apps/web` tal cual produce `/en`, que la
    middleware redirige — un salto de más y una URL que no queremos indexada.
27. Cambiar de idioma es navegación dura: el paso del carrusel **se reinicia** según el
    punto 21. Para el visitante onboarded eso significa volver al slide 4; si estaba
    navegando hacia atrás por los slides 1–3, salta al 4. Es consecuencia aceptada de que
    el paso sea estado de cliente y el idioma una URL.

---

## Edge cases

- **Cookie corrupta** (`onboarded=true` sin `preferredMode` válido): `resolveOnboardingState`
  ya devuelve `{onboarded:false, preferredMode:null}` → slide 1, sin label. Sin cambios.
- **`preferredMode` válido sin `onboarded`**: mismo camino, slide 1. Sin cambios.
- **Viewport más alto que `420 / (941/1672) ≈ 746px`**: la ilustración cubre por altura y
  recorta a los lados. El lobo está centrado horizontalmente, así que sobrevive.
- **Viewport muy bajo** (~600px con chrome de navegador): el contenido central es lo que
  cede. Ese bloque —y sólo ese— lleva `min-h-0 overflow-y-auto`; nav y footer nunca
  scrollean.
- **Fallo de carga del arte**: `<picture>` degrada avif → webp → png. Si los tres fallan,
  queda `#1a3fae` y el chrome sigue legible (el texto ya lleva `text-shadow` propio).
- **Texto de apoyo de dos líneas**: el copy trae un salto real (`\n`) y se renderiza con
  `whitespace-pre-line`. Un `<br/>` en la traducción metería markup en el bundle de copy.
- **ES más largo que EN**: los títulos son arte (inmunes), pero el sublabel del chip del
  slide 2 y los beneficios del ProStrip son texto. Ver punto 13: envuelven, no truncan.
- **El título ES dice otra palabra**: verificado, `ES-learn.png` dice **"APRENDE"**. El
  `alt` sale de la traducción, nunca de un literal — si no, un lector de pantalla en ES
  anuncia "Learn" sobre una imagen que dice APRENDE.
- **Arrastre que empieza sobre el switch**: no puede navegar de slide *y* activar el enlace.
  Resuelto estructuralmente por el punto 6 (el `actionSlot` está fuera de la zona de swipe),
  no por un `preventDefault` que habría que recordar mantener.
- **▶ y ◀ en los extremos**: `disabled:opacity-0` se conserva (invisible, no apagado). El
  botón sigue en el DOM y sigue siendo `disabled`, así que no roba foco.
- **Doble tap en una mitad del switch**: es un `<a>`, la segunda navegación es idempotente
  (`/api/enter` reescribe las mismas cookies).
- **JS deshabilitado**: los slides 1–3 no avanzan (el paso es estado de cliente), pero el
  slide 4 —el único con destino real— usa `<a href>`, así que la elección funciona igual
  si el visitante llega ahí.

---

## Acceptance criteria

**Assets y datos**
- [ ] Existen los 11 tripletes (`png` + `webp` + `avif`) en `apps/landing/public/art/landing-slides/`:
      `slide-bg-1..4`, `title-chesscito`, `title-learn-{en,es}`, `title-play-{en,es}`,
      `title-choose-{en,es}`.
- [ ] `SLIDE_VISUALS` tiene entrada para los 4 pasos y `titleSrc` cubre `en` y `es` en cada uno.
- [ ] `SLIDE_VISUALS[1].titleSrc.en === SLIDE_VISUALS[1].titleSrc.es`.

**Entrada**
- [ ] `carouselEntryFor({onboarded:false, preferredMode:null})` → `{initialStep:1, lastUsedMode:null}`.
- [ ] `carouselEntryFor({onboarded:true, preferredMode:"play"})` → `{initialStep:4, lastUsedMode:"play"}`.
- [ ] Con cookies de `learn`, la página monta el slide 4 (no el 1) y no monta `WelcomeBack`.
- [ ] `WelcomeBack` no existe en el repo, y `onboarding.welcomeBack` no existe en EN ni ES.

**Render por slide**
- [ ] Los 4 fondos están montados en todo momento; exactamente uno es el visible.
- [ ] Ningún slide renderiza el marco `bg-slides`.
- [ ] El título de cada slide 2–4 cambia de archivo entre locale `en` y `es`.
- [ ] El `alt` del título renderizado en `es` **difiere** del renderizado en `en` (slides 2–4).
- [ ] `ArtImage` aplica `imgClassName` al `<img>` y `className` al `<picture>` — no al revés.

**Slide 3**
- [ ] `ProStrip` no monta ningún elemento focusable (ni `<a>`, ni `<button>`, ni `tabindex`).
- [ ] La línea de beneficios en ES se ve completa: sin `nowrap` ni `text-overflow` en su clase.

**Slide 4**
- [ ] El switch monta dos enlaces, a `/api/enter?mode=learn` y `/api/enter?mode=play`.
- [ ] La mitad de LEARN lleva `data-recommended="true"` **siempre**, y la de PLAY nunca.
- [ ] Ninguna mitad lleva `aria-pressed`.
- [ ] Con `lastUsedMode="learn"` el label aparece una sola vez y está asociado por
      `aria-describedby` al enlace de learn.
- [ ] Con `lastUsedMode="play"` el label se asocia al de play, y LEARN sigue siendo el
      `data-recommended`.
- [ ] Con `lastUsedMode=null` no hay label en el DOM.
- [ ] El slide 4 no renderiza el botón `.primary-play-cta`.
- [ ] El switch está dentro del `actionSlot`, no del bloque de contenido.
- [ ] Desde el slide 4, ◀ lleva al 3 y los slides 1–3 se renderizan completos.

**Chrome**
- [ ] El contador dice `1 of 4` en EN y `1 de 4` en ES.
- [ ] El contador incluye el icono estrella.
- [ ] El footer monta los 3 links legales **y** el selector de idioma.
- [ ] El selector apunta a `/` para EN y a `/es` para ES (nunca a `/en`).
- [ ] Los `aria-label` de ◀ / ▶ salen de las traducciones, no de literales en inglés.

**No-regresión**
- [ ] Swipe sigue avanzando y retrocediendo.
- [ ] La zona de swipe **no** cubre el `topSlot`, el `actionSlot` ni el `footer`.
- [ ] ◀ invisible en el slide 1, ▶ invisible en el slide 4.
- [ ] `/api/enter` sigue escribiendo las dos cookies con `maxAge` de un año.

---

## Verificación en device

Son **4 slides × 2 locales × 2 estados de entrada = 16 vistas**. Lo que no cubre la suite y
hay que mirar con el ojo, en 390px:

1. Slide 4 en ES con `lastUsedMode="play"`: el dorado (LEARN) y el label (PLAY) caen en
   mitades opuestas. Es lo diseñado — confirmar que se lee como dos señales, no como un
   error de render.
2. Slide 3 en ES: la línea de beneficios del ProStrip envolviendo a dos líneas sin desbordar.
3. Viewport bajo (Safari iOS con la barra visible): que el lobo no quede decapitado.
4. Los 4 títulos ES sobre su fondo: contraste del arte crema contra el cielo azul.

## Out of scope / future

- Transición animada entre slides.
- Borrar los assets huérfanos (`bg-slides`, `avatar-*`, títulos viejos) y `AvatarWithFade`,
  que queda sin consumidores — commit de limpieza aparte, tras confirmar que nada los usa.
- Borrar `/classic` y su árbol (`landing-page.tsx`, `phone-stack`, `phone-frame`), huérfano
  por el punto 24.
- Un probe `/dev` para las 16 vistas del cuadro de arriba.

## Open questions

- El copy ES lo escribo yo siguiendo `editorial.ts` y queda marcado para revisión del
  founder en device. No bloquea.
- `EN-play.png` / `ES-play.png` no fueron medidos; se asume el mismo tratamiento que
  learn/choose (alto ~530px, ancho variable).
