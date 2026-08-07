# Spec — AC8: `WalletShell` deja de ser una pantalla vacía

**Fecha:** 2026-08-07 · **Estado:** ✅ **READY — gates cerrados, en implementación (`/tdd`)**

| # | Experimento | Resultado |
|---|---|---|
| **EXP1** | Bloque con `linear-gradient` → medir FCP | 🔴 **FAIL** — 3.928 ms. El bloque estaba pintado a 194 ms y la métrica no se movió: Chromium cuenta **recursos** de imagen, no pintura. |
| **EXP1b** | Mismo bloque con `data:image/svg+xml` | 🟢 **Hipótesis validada** — FCP **3.974 → 1.728 ms (−2.246 ms)**, 0 requests nuevos, T2 −82 ms, LCP sin cambio, sin CLS propio. |
| **EXP2** | `curl` al HTML servido | 🟢 **PASS parcial** — el shell está en el HTML inicial de `/`, `/es`, `/terms`; no depende de hidratación. ⚠️ `/en` responde 307 → `/` (routing `as-needed`, correcto). **Pendiente**: validar `isHubRoute`/`usePathname()` en prerender cuando se implemente. |

Evidencia: `docs/audits/2026-08-07-ac8-exp1-exp2-results.md` y `…-ac8-exp1b-results.md`.

**Origen:** AC8 del spec `2026-08-07-wallet-branch-lazy-load`, movido a frente propio.
**Evidencia:** `docs/audits/2026-08-07-minipay-perceived-load-report.md`

---

## Por qué existe este frente

El split de la rama de wallet sacó **628 kB** del camino de un jugador de MiniPay. El costo que
dejó está medido, no supuesto:

| Slow 4G + CPU 4× | Valor |
|---|---|
| FCP | ~3,95–4,07 s |
| LCP | ~4,32–4,57 s |
| T2 (hub usable) | ~4,18 s |
| Filmstrip a 2.016 ms | `#0b1220` plano. Nada. |

El `WalletShell` es hoy `<div data-wallet-shell="undecided" />`: un div vacío. **Durante ~4
segundos el jugador mira una pantalla de un solo color y después el hub aparece entero de
golpe.** Y como no hay nada "contentful" en pantalla, **ese vacío ES el FCP**: la métrica no
mide otra cosa que el momento en que la rama termina de montar.

⛔ **Fuera de este spec, y no por olvido:** el CLS 0,179 de
`section.hub-scaffold-body` + `div.kingdom-anchor-tagline` ocurre **después** de que el hub
montó (~4.150 ms). Es otro frente. Mezclarlos haría que ninguna mejora sea atribuible.

## Decisión de producto (founder, 2026-08-07)

**Skeleton CSS puro con la forma general del hub.** No el fondo solo, no el hub entero: una
silueta mínima y estable que comunique "la app está cargando" sin agregar una sola descarga.

---

## Contrato

### C1. Qué rutas reciben el skeleton — ⚠️ el shell NO es del hub

`WalletProviderBoundary` vive en el **root layout**, así que su shell se renderiza en **toda**
ruta: `/terms`, `/stats`, `/exercises`, `/arena`, share… Pintar la silueta del hub en `/terms`
sería prometer una pantalla que nunca va a llegar — peor que el vacío, porque el vacío no
miente.

```ts
/** `true` sólo para el hub: `/`, `/en`, `/es`. El resto conserva el hueco actual. */
export function isHubRoute(pathname: string): boolean;
```

- El hub es la puerta de MiniPay y es donde está medido el problema. **Ahí va la silueta.**
- Las demás rutas mantienen `<div data-wallet-shell="undecided" />` **sin cambios**. No están
  medidas y no se tocan a ciegas.
- `WalletProviderBoundary` ya es un client component: `usePathname()` no agrega ningún request
  y funciona también en SSR.

⛔ **`isHubRoute` es una función pura y se testea como tal.** Un `pathname.includes("/")`
escrito a ojo acierta en el hub y también en todo lo demás.

### C2. CLS = 0 por construcción, no por suerte

⛔ **Vetado: un skeleton que participe del flujo de layout.** Aunque las medidas coincidan hoy,
cualquier drift futuro entre la silueta y el hub se paga en CLS, y el jugador de MiniPay ya
tiene 0,179 de otro frente.

El skeleton se renderiza como **capa fija fuera del flujo**:

```css
.wallet-shell-skeleton {
  position: fixed;
  inset: 0;
  /* … */
}
```

Así el hub calcula su layout **sin** que el skeleton haya ocupado nada, y su desaparición no
puede mover un solo elemento. Un elemento que aparece por primera vez no cuenta como shift:
CLS del swap = 0 **por construcción**.

📌 Esto además libera la silueta de tener que clavar medidas: puede ser aproximada sin costo
métrico. Comunica, no calca.

### C3. Cómo se adelanta el FCP — ⚠️ el detalle que decide todo el spec

**Un `<div>` con `background-color` NO dispara FCP.** El color de fondo plano está
explícitamente excluido de "first contentful paint"; por eso hoy `first-paint` ocurre a ~92 ms
y el FCP recién a ~4.000 ms. Un skeleton hecho de rectángulos con `background-color` mejoraría
la *sensación* y **dejaría la métrica exactamente donde está** — cumpliendo el criterio de
producto y fallando el AC1 de aceptación.

Lo que sí cuenta como contentful sin pedir un archivo:

- **`background-image: linear-gradient(...)`** — es una imagen para el algoritmo de FCP y no
  genera request.
- SVG inline.
- Texto (⛔ descartado: el founder pidió sin texto real, y un texto de relleno traducible es
  deuda de i18n por nada).

~~**Decisión: los bloques del skeleton se pintan con `linear-gradient`.**~~

⛔ **REFUTADO POR MEDICIÓN (EXP1, 2026-08-07).** Un `linear-gradient` **tampoco** adelanta el
FCP: el bloque estaba pintado a los 194 ms y la métrica seguía marcando 3.928 ms.
**Chromium cuenta RECURSOS de imagen, no pintura** — y un gradiente es contenido generado, no un
recurso.

✅ **Decisión vigente (EXP1b): `background-image: url("data:image/svg+xml,…")`.** Es un recurso
de imagen real **sin request de red**. Medido: FCP **3.974 → 1.728 ms (−2.246 ms)**, con 0
requests nuevos, T2 mejorando 82 ms y LCP sin cambio.

⚠️ **El piso lo pone otra cosa, y está medido:** el CSS render-blocking de 55 kB termina de
bajar a 1.679 ms y el FCP ocurre 61 ms después. **El skeleton no puede pintar antes que la hoja
de estilos que lo estiliza**, así que el umbral original de AC10 (< 1.500 ms) sólo se vuelve
alcanzable si avanza el frente de CSS. Detalle completo en
`docs/audits/2026-08-07-ac8-exp1b-results.md`.

### C4. Cómo NO se secuestra el LCP

LCP se queda con el elemento contentful **más grande**, no con el más temprano. Un panel de
skeleton a pantalla completa se convertiría en candidato y podría mejorar el número **sin que
el jugador vea nada antes** — exactamente el gaming que el founder prohibió.

Reglas:

- Ningún bloque del skeleton ocupa más área que el elemento que hoy define el LCP del hub.
- La silueta se compone de **varios bloques chicos**, nunca de un rectángulo dominante.
- **AC de aceptación: el LCP final no empeora.** No se promete que mejore: si el LCP del hub lo
  define su fondo o su panel, seguirá llegando cuando llegue la rama. Prometer otra cosa sería
  vender la métrica en vez del producto.

### C5. La geometría se DERIVA, no se copia

⚠️ Este repo ya tiene escrito que **una copia de medidas de layout no la delata nada
observable**: ningún test de comportamiento se pone rojo cuando el original cambia y la copia
no. La silueta espeja `.hub-scaffold`, y ese riesgo es real.

Mitigación, en orden:

1. **Reusar los tokens existentes** (`--app-max-width` y las medidas ya declaradas en
   `globals.css`), nunca números nuevos que digan lo mismo.
2. Las tres franjas se derivan de la estructura real, que hoy es:
   - `.hub-scaffold-hud-top` → fila superior, dos grupos (izquierda / derecha);
   - `.hub-scaffold-body` → `grid-template-columns: 78px minmax(0,1fr) 78px`;
   - `.hub-scaffold-cta-row` → fila inferior de dos CTAs.
3. **Guard de fuente** que falle si la silueta declara un ancho de riel distinto del que
   declara `.hub-scaffold-body`. ⛔ Sin este guard el drift es invisible.

### C6. Composición de la silueta

Mínima y estable. **Sin texto, sin datos, sin wallet, sin imágenes, sin dependencias.**

```
┌────────────────────────────┐
│ ▭▭        ▭▭▭   │ ← HUD: dos grupos (izq / der)
│                            │
│ ▭ ┌──────────────┐ ▭      │ ← body: riel 78px · panel · riel 78px
│ ▭ │              │ ▭      │
│ ▭ │    panel     │ ▭      │
│ ▭ └──────────────┘        │
│                            │
│   ▭▭▭▭      ▭▭▭▭       │ ← CTA row: dos bloques
└────────────────────────────┘
```

- 1 contenedor fijo · 2 bloques de HUD · 2 rieles con 2–3 slots · 1 panel central · 2 CTAs.
- `aria-hidden="true"`, sin `role`, sin foco, `pointer-events: none`.

### C7. Animación: **ninguna, por defecto**

El founder aceptó skeleton estático si el pulse agrega trabajo medible. Bajo CPU 4× ya hay
3–5 long tasks antes del FCP; una animación que corra durante esa ventana compite con la
hidratación.

**Decisión: se implementa estático.** Si después se quiere pulse, entra como cambio propio,
con su medición de long tasks antes y después. ⛔ No se agrega "porque queda mejor".

---

## Behavior

1. **Dado** el hub y una rama sin resolver, **cuando** se renderiza el boundary, **entonces**
   se pinta el skeleton — en SSR y en el primer render de cliente, idénticos.
2. **Dado** cualquier otra ruta, **entonces** se pinta el `<div data-wallet-shell>` actual, sin
   silueta.
3. **Cuando** la rama monta, **entonces** el skeleton desaparece en el mismo commit en que el
   hub aparece, y **ningún** elemento del hub se mueve por su causa.
4. **Mientras** el skeleton está en pantalla, no acepta interacción ni aparece en el árbol de
   accesibilidad.
5. El skeleton **no** monta `children`, ni lee wallet, ni claims, ni tema del jugador.

## Edge cases

- **E1 — Ruta que no es el hub.** Cubierto por C1. El test debe asertar la ausencia de la
  silueta fuera del hub, no sólo su presencia dentro.
- **E2 — La rama falla.** `WalletBranchErrorBoundary` muestra su estado terminal; el skeleton
  **debe** desaparecer. ⛔ "Error + skeleton cargando" es el estado ambiguo que el frente
  anterior eliminó.
- **E3 — Desktop.** El hub se centra con `--app-max-width` (390px). La silueta usa el mismo
  token; fuera de ese ancho no dibuja nada.
- **E4 — Tema activo.** El skeleton **no** resuelve assets de tema: el resolver vive dentro del
  árbol del provider y llamarlo acá reintroduce dependencia de runtime. Los gradientes salen de
  variables CSS ya declaradas.
- **E5 — El VR.** Los casos esperan por elementos de producto, así que fotografían el estado
  final: la expectativa es **62/62 sin re-baselinear**. ⚠️ Si algún snapshot cambia, se
  inspecciona de a uno; un screenshot del skeleton **no es un baseline válido**.
- **E6 — `prefers-reduced-motion`.** Sin animación no aplica hoy. Queda anotado para el día que
  entre el pulse.
- **E7 — `position: fixed` en iOS.** `globals.css` documenta que `background-attachment: fixed`
  rompió el sizing del viewport en iOS Safari. No es la misma propiedad, pero la zona ya mordió
  una vez: verificar en **390×844 y 360×640** (el mínimo del store, que ya tiene proyecto de
  Playwright). Paso de verificación, no AC.

## Acceptance criteria

**Comportamiento (unit)**

- [ ] AC1 — `isHubRoute` acepta `/`, `/en`, `/es` y rechaza `/terms`, `/en/terms`, `/exercises`,
      `/stats`, `/arena`. Función pura, casos explícitos en las dos direcciones.
- [ ] AC2 — En el hub sin hidratar, el SSR emite la silueta.
- [ ] AC3 — Fuera del hub sin hidratar, el SSR emite el shell vacío y **ninguna** clase de
      silueta.
- [ ] AC4 — El skeleton es `aria-hidden="true"` y no expone ningún elemento enfocable.
- [ ] AC5 — Cuando la rama monta, no queda ningún nodo del skeleton en el DOM.
- [ ] AC6 — En el estado terminal de error, no queda ningún nodo del skeleton (E2).
- [ ] AC7 — `children` sigue montando **exactamente una vez** (guard heredado, no debe
      regresar).

**Fuente**

- [ ] AC8 — Guard: el ancho de riel de la silueta y el de `.hub-scaffold-body` son el mismo
      valor. Falla si uno cambia sin el otro (C5).
- [ ] AC9 — Guard: el CSS de la silueta no contiene `url(`. Cero assets, verificable.

**Medición — mismo instrumento, mismo perfil (Slow 4G + CPU 4×)**

- [ ] AC10 — **FCP mediana < 2.000 ms** bajo Slow 4G + CPU 4×, y se registra **el valor real y
      el delta** contra el baseline de 3.974 ms.
      ⚠️ **El umbral original era < 1.500 ms y quedó invalidado por una dependencia externa al
      skeleton** (founder, 2026-08-07). EXP1b lo midió: con el primitivo correcto el FCP da
      **1.728 ms (−2.246 ms)**, y los 228 ms que faltaban para 1.500 ms **no son del skeleton**.
      **El piso actual es ~1,7 s y lo impone el critical CSS**: la hoja de 55 kB termina de
      bajar a **1.679 ms** y el FCP ocurre **61 ms después**. El skeleton no puede pintar antes
      que la hoja que lo estiliza.
      ⛔ **Bajar ese piso NO pertenece a este spec.** Es el frente siguiente (CSS
      render-blocking), que ahora tiene una hipótesis cuantificada: ~1.679 ms de piso de FCP.
      No se optimiza CSS acá para perseguir 1.500 ms.
- [ ] AC11 — El filmstrip a ~1,0 s y ~2,0 s muestra la silueta, **no** color plano. ⚠️ Se mira
      **también el frame inmediatamente posterior a T2**: CLS 0 no garantiza que el swap no se
      lea como un corte brusco, y eso ningún número lo mide.
- [ ] AC12 — `encoded bytes` no aumentan materialmente (tolerancia: **+2 kB**, que es CSS).
      ⚠️ Esos bytes entran en `globals.css`, que ya es render-blocking y es el frente #4: si el
      skeleton necesitara más de 2 kB, deja de ser "sin costo" y vuelve a discusión.
- [ ] AC13 — **Requests nuevos atribuibles al skeleton = 0.** Se compara la lista de URLs
      antes/después, no sólo el total.
- [ ] AC14 — **Reformulado tras el red team** (un número global de CLS no es comprobable acá:
      el 0,179 conocido llega ~10 ms después de T2). El criterio es, sobre los registros de
      shift que el instrumento ya captura con sus nodos:
      **ningún `layout-shift` con `startMs ≤ T2`, y ninguno cuyos `sources` incluyan un nodo
      con clase `wallet-shell-*`.** El shift de `hub-scaffold-body` / `kingdom-anchor-tagline`
      se reporta aparte y **no** cuenta contra este AC.
- [ ] AC15 — T2 no empeora materialmente (tolerancia: +150 ms).
- [ ] AC16 — LCP final **no empeora** (tolerancia: +150 ms). No se exige que mejore.
- [ ] AC17 — Long tasks no aumentan (skeleton estático, C7).

⛔ **AC15/AC16 se deciden por la MEDIANA de 3 corridas antes y 3 después.** Medido: T2 osciló
4.136–4.199 ms y LCP 4.324–4.568 ms en cinco corridas del **mismo** build. Una sola corrida
puede caer dentro o fuera de la tolerancia por ruido — y eso vale también cuando el resultado
me favorece.

**Regresión**

- [ ] AC18 — Suite completa verde (baseline al abrir: **7.432 / 603**).
- [ ] AC19 — `tsc --noEmit` limpio.
- [ ] AC20 — VR **62/62 sin re-baselinear**, salvo cambio visual deliberado y revisado uno por uno.
- [ ] AC21 — `pnpm bundle:guard` sigue verde: el skeleton no arrastra código de rama.

## Out of scope

- CLS 0,179 de `hub-scaffold-body` / `kingdom-anchor-tagline` — frente propio.
- `<main>` anidado — commit semántico independiente.
- CSS render-blocking — se mide antes de decidir nada.
- Viewport / zoom — **NO ACTION**, con dependencia de gesto documentada.
- Privy, web, y el score global de Lighthouse.
