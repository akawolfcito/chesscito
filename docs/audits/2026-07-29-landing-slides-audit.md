# Auditoría — slides del landing (estado actual) + gaps del rediseño

**Fecha:** 2026-07-29 · **App:** `apps/landing` · **Ruta:** `/[locale]` (`page.tsx`)

---

## 1. Lo que existe hoy

### Árbol de componentes

```
app/[locale]/page.tsx          server; lee cookie → bifurca
├─ WelcomeBack                 si onboarded && preferredMode  ← NO ve el carrusel
└─ OnboardingCarousel          si no
   └─ SlideShell               chrome compartido (3 filas)
      ├─ topSlot = SlideNav    ◀  [ProgressPill]  ▶
      ├─ children = SlideNBody  dentro del marco dorado
      ├─ ctaSlot               botón fuera del marco
      └─ footer = LegalFooter  Privacy · Terms · Support
```

### Las tres piezas que el founder quiere conservar

| Pieza | Archivo | Estado |
|---|---|---|
| Controles ◀ ▶ | `components/onboarding/slide-nav.tsx` | Reusa `chevron-down` rotado ±90°. `disabled:opacity-0` en los extremos (desaparece, no se apaga). Se mantiene tal cual. |
| Contador | `components/onboarding/progress-pill.tsx` | Hoy `{current} / {total}` en pill `#1d2a6b`. **Sin estrella.** El string traducido `onboarding.progress` existe pero **no se usa** — el componente hardcodea `/`. |
| Footer legal | `components/onboarding/legal-footer.tsx` | 3 links + separadores punto, `LEGAL_URL`. Se mantiene tal cual. |

### Estructura visual actual (la que cambia)

`SlideShell` monta **un fondo único** para los 4 slides + **un marco dorado PNG** con aspect ratio fijo `980/1398`, y el contenido vive **adentro** del marco con `px-[9%] py-[6%]` y `overflow-y-auto`.

- Fondo móvil: `/art/bg-wallpaper-lite` · Fondo desktop: `/art/landing-slides/bg-slides-web`
- Marco: `/art/landing-slides/bg-slides`
- Ancho del marco: `min(100%, calc(54dvh * 0.9))` — derivado de altura, no de ancho.

**El rediseño elimina esta capa**: las referencias son arte full-bleed 941×1672 (≈9:16) sin marco. Es el cambio estructural más grande del trabajo.

### Contenido por slide (hoy)

| Slide | Título (imagen) | Payload |
|---|---|---|
| 1 | `chesscito-title` + "Welcome to" en texto | avatar + 2 pills (Learn / Play) |
| 2 | `21-day-challente-title` | avatar + pill Focus Passport + línea de precio |
| 3 | `play-chess-title` | avatar + 2 pills (Saved games / Coach review) + precio |
| 4 | *(sin título imagen)* | headline texto + avatar + link "Jump to Play" + CTA `START` → learn |

Copy: `lib/content/messages/{en,es}.ts` bajo `onboarding.slideN`.
Assets: `lib/onboarding/slides.ts` (`SLIDE_ASSETS`, `ICONS`) — **sin variante por locale**.

### CSS

`apps/landing/src/app/globals.css` es propio (no comparte con `apps/web`). Ya tiene copiadas:
`.chesito-card-divider` (+ `.chesito-card-spark`), `.primary-play-cta`, `.primary-play-cta--playhub`, `.slide4-jump-link`, `.onboarding-price`.
**NO tiene**: `.kingdom-card-pro-cta*` (franja PRO) ni `.hub-app-mode-switch*` (switch LEARN/PLAY). Ambos hay que portar desde `apps/web/src/app/globals.css`.

### Persistencia (lo que cambia el comportamiento pedido)

`/api/enter?mode=learn|play` escribe 2 cookies (`onboarded=true`, `preferredMode`) por 1 año y redirige.
`resolveOnboardingState()` las lee server-side. Hoy: **onboarded ⇒ `WelcomeBack`, el carrusel no se monta**.
Pedido: **onboarded ⇒ carrusel arrancando en slide 4**, con label verde sobre el botón elegido.

### Tests que tocará el cambio

- `components/onboarding/__tests__/onboarding-carousel.test.tsx`
- `components/onboarding/__tests__/welcome-back.test.tsx`
- `components/onboarding/__tests__/pill.test.tsx`
- `app/[locale]/__tests__/page.test.tsx`
- `lib/onboarding/__tests__/resolve-state.test.ts`

---

## 2. Assets del rediseño

En `design/a-slides/` (raíz, fuera de `apps/`), **PNG solo**:

| Archivo | Dimensiones | Destino |
|---|---|---|
| `slide01..04.png` | 941×1672 | fondo full-bleed por slide |
| `EN-ES-chesscito.png` | 2083×459 | título slide 1 (mismo en EN y ES) |
| `EN-learn.png` / `ES-learn.png` | ~2085×531 | título slide 2 |
| `EN-play.png` / `ES-play.png` | — | título slide 3 |
| `EN-choose.png` / `ES-choose.png` | 1642×557 | título slide 4 |

**Patrón del proyecto**: triplete `png + webp + avif` en `apps/landing/public/art/landing-slides/`, consumido por `<ArtImage src="/art/..." />` **sin extensión**.
Herramienta ya existente: `scripts/gen-triplet.sh <src> <out-dir>` (requiere `cwebp` + `avifenc`).

Iconos ya presentes en `public/art/landing-slides/`: `season-pass-icon` ✅ · `pro-suscription-icon` ✅ (tripletes completos).

⚠️ Los 4 fondos pesan 2.0–2.5 MB en PNG. El AVIF los deja en ~60–100 KB (referencia: `chesscito-slide-web-*` 2.0 MB → 89 KB). El PNG igual se sirve como fallback, así que conviene **redimensionar la fuente** antes de generar el triplete si 941px de ancho excede lo necesario (no excede: 941 ≈ 2.4× de 390px, correcto para retina).

---

## 3. Decisiones que ya tomé (aviso, no pregunta)

1. **La franja PRO del slide 3 es decorativa**, no un botón. En el HUB abre el sheet de compra; el landing no vende. Replico la forma y los colores, sin chevron ni handler.
2. **El switch LEARN/PLAY del slide 4 son dos botones de navegación**, no un toggle de estado. Visualmente reusa `.hub-app-mode-switch` (píldora cream con la mitad activa resaltada), pero cada mitad es un `<a href="/api/enter?mode=...">`. Un toggle real implicaría un estado intermedio que nadie confirma.
3. **El selector de idioma va en el footer**, a la derecha de los links legales. La fila superior es navegación simétrica (◀ pill ▶); meter un cuarto elemento la desbalancea. Si el founder lo prefiere arriba, es un cambio de una línea.
4. **`WelcomeBack` queda huérfano** cuando el carrusel absorbe el caso "ya eligió". Lo borro junto con su test, salvo indicación contraria.
5. **El contador se traduce**: `1 of 4` / `1 de 4` vía la clave `onboarding.progress` que ya existe y hoy nadie usa.

---

## 4. Lo que necesito del founder

### Bloqueantes (afectan qué construyo)

1. **Desktop.** Hoy hay un fondo dedicado `bg-slides-web` para `md:`. Los nuevos slides son 9:16. ¿Qué se ve en desktop?
   - (a) el slide móvil centrado en una columna de ~420px sobre un color/blur de fondo,
   - (b) seguir usando `bg-slides-web` detrás,
   - (c) no importa, desktop no es prioridad (patrón del proyecto) → tomo (a).

2. **Copy del label verde.** Propuestas en el vocabulario actual: **"Last used"** / **"Your pick"** / **"Continue here"**. Mi recomendación: **"Last used"** — describe un hecho, no da una orden, y sobrevive a que el jugador cambie de opinión. ES: **"Última vez"**.

3. **El label verde, ¿solo posición o también preselección?** El pedido dice "flotante superior a la derecha si es play o a la izq si es learn". ¿El botón correspondiente además se ve resaltado/más grande, o los dos botones quedan idénticos y solo el label los distingue?

### No bloqueantes (sigo con mi criterio si no hay respuesta)

4. Cambiar idioma a mitad del carrusel **resetea a slide 1** (el step es estado de cliente y el switch es navegación dura). ¿Lo dejo así, o preservo el paso? Preservarlo cuesta un `?slide=` que la spec original prohibió explícitamente. Por defecto: **lo dejo resetear**, salvo para el caso onboarded (que siempre arranca en 4 de todos modos).

5. Los textos de slides 1–3 del rediseño están en inglés en el pedido. Necesito la traducción ES o la escribo yo siguiendo `editorial.ts`. Por defecto: **la escribo yo** y la marco para revisión.

6. `EN-play.png` / `ES-play.png` no los medí — asumo el mismo tratamiento que learn/choose.
