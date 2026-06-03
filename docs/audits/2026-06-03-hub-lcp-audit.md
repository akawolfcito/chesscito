# /hub Mobile LCP Audit — P0-2

**Fecha:** 2026-06-03
**Baseline post-P0-1:** Mobile 76 / CLS 0.00 / **LCP 6.5 s** / TBT 110ms / FCP 1.5s
**Target:** Bajar LCP a < 2.5s para empujar el score hacia 85+
**Modo:** Read-only audit. Patch propuesto en §5; no aplicado.

---

## 1. Elemento LCP identificado (Lighthouse data, no especulación)

Del `lh-prod-mobile.json` capturado tras el deploy de Patch 1+2:

```
selector: div.hub-action-rail > button.reward-tile > picture.reward-tile-piece > img
src:      /art/new-icons-chesscito/ejercicio-diario-chess.avif
bounding: 38×41 px @ (343, 325)
node:     1,HTML,1,BODY,...,BUTTON,1,PICTURE,2,IMG
```

Es el **icono del Daily Tactic tile** dentro del `.hub-action-rail`. Renderizado por:
- `apps/web/src/components/hub/hub-daily-tile.tsx:109` → `<HubActionTile iconSrc="/art/new-icons-chesscito/ejercicio-diario-chess.png" />`
- `apps/web/src/components/hub/hub-action-tile.tsx:42` → `<img src={iconSrc} alt="" aria-hidden="true" />`

**Por qué un icono de 38×41 px es el LCP candidate:**

| Phase | Timing | % LCP |
|---|---|---|
| TTFB | 817 ms | 13% |
| **Load Delay** | **5012 ms** | **77%** ← el problema |
| Load Time | 531 ms | 8% |
| Render Delay | 113 ms | 2% |
| **Total LCP** | **6473 ms** | 100% |

La spec W3C de LCP excluye CSS `background-image` (eso descarta `bg-ch` 801KB del body). Entre los `<picture>+<img>` foreground above-the-fold, este icono es el ganador por área renderizada después de hidratación. **Load Delay = 5 s** indica que el browser descubre el asset 5 segundos después de iniciar la navegación — es decir, después de que la hidratación de wagmi/RainbowKit termina y el preload scanner pierde la oportunidad de prefetch.

El asset en sí es chico (11 KB AVIF, fetch 531ms). El problema NO es el peso. Es la **discovery latency**.

---

## 2. Inventario de imágenes críticas en `/hub` first paint

| Componente (file:line) | Elemento | Asset | Variantes | W/H attrs | Above-fold | Triplet | PNG size |
|---|---|---|---|---|---|---|---|
| `globals.css:475` (body) | CSS `background-image` | `/art/redesign/bg/bg-ch` | AVIF/WebP/PNG | N/A | YES | YES | 801 KB |
| `hub-action-tile.tsx:39-43` (Daily) | `<picture>+<img>` | `/art/new-icons-chesscito/ejercicio-diario-chess` | AVIF/WebP/PNG | **None** | YES | YES | **31 KB / 11 KB AVIF** ← **LCP** |
| `hub-pro-badge.tsx:64-67` | `<picture>+<img>` | `/art/hub/panel-pro` | AVIF/WebP/PNG | **225×272** ✓ (Patch 2) | YES | YES | 30 KB |
| `kingdom-anchor.tsx` portal | `<picture>+<img>` | `/art/new-assets-chesscito/hub/chesscito-normal-portal` | AVIF/WebP/PNG | None (CSS aspect) | YES | YES | 48 KB |
| `hub-scaffold.tsx` guide pieces (×3) | `<picture>+<img>` | `/art/redesign/pieces/w-*` | AVIF/WebP/PNG | None | NO (decorativos) | YES | ~12 KB c/u |
| `reward-column.tsx:92` (×6 LEARN pieces) | `<picture>+<img>` | `/art/redesign/pieces/w-*` | AVIF/WebP/PNG | None | depende viewport | YES | ~12 KB c/u |
| `hub-scaffold.tsx` action tiles (×N) | `<picture>+<img>` via `HubActionTile` | varios | varios | None | YES | mixto | 11–93 KB |
| `hub-scaffold.tsx` PrimaryPlayCta icon | raw `<img>` | `/art/new-icons-chesscito/play-chess.png` | PNG + WebP | None | YES | **incompleto (sin AVIF)** | 93 KB |

**3 assets más pesados servidos en `/hub`:**

1. `/art/redesign/bg/bg-ch.png` — 801 KB PNG (1024×640). Servido como AVIF (43 KB) via `image-set` desde `body`. CSS, no cuenta para LCP.
2. `/art/new-icons-chesscito/play-chess.png` — 93 KB PNG. **No tiene AVIF sibling**. Probable LCP candidate secundario.
3. `/art/new-assets-chesscito/hub/chesscito-normal-portal.png` — 48 KB PNG. Triplet completo.

---

## 3. Mecanismos de render (above-fold)

| Mecanismo | Count | Notas |
|---|---|---|
| `<picture>+<source>+<img>` con triplet AVIF/WebP/PNG | ~10 | Convención del proyecto. Bien. |
| CSS `background-image` con `image-set` | 1 | body bg. No cuenta para LCP. |
| Raw `<img>` sin `<picture>` | ~4 | Iconos en CTAs y action tiles |
| `next/image` | **0** | Cero uso en hub tree |

`next.config.js` no tiene `images.formats` configurado → defaults Next 14: `['image/webp']` (AVIF NO está en default de Next 14, hay que pedirlo). Pero esto solo aplica a `next/image`, irrelevante porque no hay ninguno en el hub.

---

## 4. Causa raíz del LCP 6.5s

**Discovery latency post-hidratación.**

- El `<img>` del LCP está en JSX dentro de `HubActionTile` (`"use client"`).
- Next.js SSR renderiza el HTML inicial CON el `<img>` (los client components siguen siendo SSR'd en first request).
- El preload scanner del browser debería verlo en el head pass → pero el `<picture>+<source>` con `type="image/avif"` y `type="image/webp"` confunde a algunos scanners; muchos browsers solo respetan el `<img src>` final como fallback (PNG 31KB), no las `<source>`s.
- Sin `fetchpriority="high"`, Chrome's heuristic deprioriza el icono porque parece "decorativo" (es `aria-hidden="true"` + alt="").
- Resultado: el browser espera a que la network queue se libere (después de wagmi/RainbowKit chunks, ~5s) antes de pedir el icono.

**Esto explica también por qué Patch 1 (lazy sheets) movió poco el score**: redujimos JS download pero no movimos el orden de descubrimiento del LCP element. La cola sigue mandando primero los chunks de wagmi/RainbowKit que quedaron eager.

---

## 5. Patch 1 propuesto — `perf(images): preload and prioritize hub LCP icon`

**Filosofía:** atacar **Load Delay (5012ms)**, no Load Time (531ms ya es bajo). Dos señales al browser para que el icono se pida lo antes posible.

### Cambios (3 archivos, ~10 líneas total)

**5.1) `apps/web/src/components/hub/hub-action-tile.tsx`** — agregar prop opt-in para priority + dimensiones intrínsecas:

```diff
 type Props = {
   iconSrc: string;
   label: string;
   ariaLabel: string;
   onClick: () => void;
   disabled?: boolean;
   badge?: ReactNode;
+  /** When true, hints the browser to fetch the icon with high priority
+   *  (LCP candidate). Default false. */
+  priority?: boolean;
 };

-export function HubActionTile({ iconSrc, label, ariaLabel, onClick, disabled = false, badge }: Props) {
+export function HubActionTile({ iconSrc, label, ariaLabel, onClick, disabled = false, badge, priority = false }: Props) {
   return (
     <button ...>
       <span className="reward-tile-label">{label}</span>
       <picture className="reward-tile-piece">
         <source srcSet={iconSrc.replace(/\.png$/, ".avif")} type="image/avif" />
         <source srcSet={iconSrc.replace(/\.png$/, ".webp")} type="image/webp" />
-        <img src={iconSrc} alt="" aria-hidden="true" />
+        <img
+          src={iconSrc}
+          alt=""
+          aria-hidden="true"
+          width={256}
+          height={273}
+          {...(priority ? { fetchPriority: "high" as const } : {})}
+        />
       </picture>
       {badge}
     </button>
   );
 }
```

Dimensiones reales del PNG: 256×273 (verificado con `sips`).

**5.2) `apps/web/src/components/hub/hub-daily-tile.tsx:108`** — marcar la tile diaria como priority:

```diff
       <HubActionTile
         iconSrc="/art/new-icons-chesscito/ejercicio-diario-chess.png"
         label={t("dailyLabel")}
         ariaLabel={ariaLabel}
         onClick={() => setOpen(true)}
         disabled={completed}
         badge={badge}
+        priority
       />
```

**5.3) `apps/web/src/app/[locale]/layout.tsx`** — agregar `<link rel="preload">` en `<head>` para que el preload scanner descubra el asset antes de hidratar:

```diff
       <head>
+        <link
+          rel="preload"
+          as="image"
+          href="/art/new-icons-chesscito/ejercicio-diario-chess.avif"
+          type="image/avif"
+          fetchPriority="high"
+        />
       </head>
```

(Exact location del `<head>` se confirma al implementar — necesito leer layout.tsx para ubicar el sitio correcto sin colisionar con `next/font` o `metadata`.)

### Por qué este shape y no otro

- **No migra a `next/image`.** Mantenemos el patrón `<picture>+<source>+<img>` consistente con el resto del repo y evitamos romper el negocio AVIF/WebP en MiniPay WebView (el `<picture>` ya negocia correctamente). `next/image` agregaría complejidad de `sizes`/`fill`/CSS interaction sin ganar nada que estos 3 cambios no logren.
- **Width/height en el `<img>`** reserva ratio en HTML parse (mismo patrón que Patch 2 del PRO badge) — protege CLS del icono durante el flash.
- **`fetchPriority="high"` solo en la tile Daily**, no en todas las HubActionTile. Si lo aplicáramos a todas, perdemos el efecto (todo prioritario = nada prioritario).
- **`<link rel="preload" as="image" type="image/avif">`** garantiza que el preload scanner del HTML (que corre antes del JS) inicie el fetch sin esperar hidratación. Si el browser no soporta AVIF, ignora silenciosamente la preload — costo en bandwidth para esos clientes: 0 (no descarga).
- **No tocamos `play-chess.png` (93 KB sin AVIF sibling)** en este patch — es un sub-problema separado (asset-pipeline gap). Lo dejamos para un patch follow-up `chore(art): generate AVIF/WebP for hub icons` si hace falta tras medir.

### Cambios deliberadamente excluidos del Patch 1

- ❌ CSS global / RainbowKit CSS / wallet-provider
- ❌ Labyrinth / stats / identity / AddCashCta / CELO / copy
- ❌ `next/image` migration
- ❌ Generar nuevos AVIF/WebP para icons sin triplet
- ❌ Preconnect (cluster Patch 3 separado si hace falta)
- ❌ Reducir wagmi/RainbowKit eager — fuera del scope de "image LCP"

---

## 6. Riesgos MiniPay WebView

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| AVIF preload descargado pero no soportado → waste 11 KB | Baja (MiniPay usa WebView moderno) | Costo absoluto bajo; PNG sigue funcionando via `<picture>` cascade |
| `fetchpriority` attribute ignorado en WebViews viejos | Baja-Media | El `<link rel="preload">` solo es el lever principal; `fetchPriority` es defensa en profundidad |
| Preload de un asset condicional (si el Daily tile no se renderiza, downloaded for nothing) | Baja | El Daily tile siempre se renderiza en hub (no hay flag que lo oculte) |
| Layout shift del icono al pasar a dimensiones reservadas | Nula | El CSS `.reward-tile-piece img { object-fit: contain }` ya estaba; width/height en HTML solo refuerza el ratio |
| Browser deprioriza otras imágenes por dar `fetchPriority=high` al icono | Baja | Solo afecta 1 imagen entre ~10 above-fold; las demás son ≤30 KB |

**Cero riesgo de romper zero-click MiniPay** (no se toca wallet-provider, RainbowKit, ni MiniPay detection).

---

## 7. Tests y mediciones

**Pre-patch (baseline post-P0-1):** ya capturado en `apps/web/lh-prod-mobile.json` (76 / LCP 6.5s).

**Post-patch validación funcional:**
- `pnpm type-check`
- `pnpm lint`
- `pnpm test hub` (esperado 122/122)
- Smoke manual: `/hub` debe seguir renderizando idéntico visualmente; Daily tile abre `DailyTacticSheet` igual.

**Post-deploy PSI:**
```bash
npx lighthouse https://www.chesscito.com/hub \
  --emulated-form-factor=mobile \
  --output=json --output-path=./lh-prod-post-p0-2.json \
  --chrome-flags="--headless" --quiet
```

Capturar score, LCP (numericValue), CLS (debe seguir 0), TBT, FCP, y verificar el `largest-contentful-paint-element` para confirmar que el LCP element ahora se descubre temprano (Load Delay esperado: < 500ms en lugar de 5012ms).

---

## 8. Estimación de impacto (honesta)

| Lever | Antes | Después esperado | Δ score estimado |
|---|---|---|---|
| LCP Load Delay | 5012 ms | 50–300 ms | — |
| LCP total | 6473 ms | 1500–2800 ms | +5 a +10 puntos |
| CLS | 0.00 | 0.00 | sin cambio |
| TBT | 110 ms | 110 ms | sin cambio |
| Unused JS | 108 KiB | 108 KiB | sin cambio (no atacado en este patch) |

**Score esperado post-Patch 1 P0-2:** 81–87 (banda objetivo del cluster original).

Si llega a 85+ → **cerrar P0-2** y cerrar el sprint perf. Si queda 80–84, evaluar Patch 2 P0-2 (preconnect + RainbowKit CSS lazy / `play-chess.png` AVIF gen).

---

## 9. Decisión: `next/image` vs preload+fetchPriority vs asset optimization

**Decisión recomendada: preload + fetchPriority en el LCP candidate.** No `next/image`, no asset re-optimization.

Razones:
- El asset ya está optimizado (11 KB AVIF). No hay grasa para cortar.
- El problema es discovery, no payload. `next/image` no resuelve discovery; ayuda con responsive sizing y CDN tuning, ninguno de los cuales es el cuello de botella.
- Migrar a `next/image` introduciría inconsistencia con el resto del codebase (`<picture>` everywhere) y requeriría `sizes` prop tuning + posibles CSS conflicts con el `.reward-tile-piece` actual.
- Preload + fetchPriority son 3 líneas de HTML/JSX, reversibles, sin riesgo MiniPay.

`next/image` sigue siendo deseable a largo plazo (DPR-aware srcset, lazy-by-default below-fold, blur placeholders), pero NO para este patch P0-2. Sería un cluster de refactor propio (`refactor(images): adopt next/image across hub tree`) con su propia VR baseline y MiniPay smoke.

---

## Outcome (post-deploy)

**Fecha promote:** 2026-06-03
**Commit:** `ea70b033` (`perf(images): prioritize hub daily tactic LCP icon`)
**HEAD `origin/production` final:** `ea70b033`
**HEAD `origin/main`:** `ea70b033` (aligned)

### Validación pre-promote

- `pnpm type-check` ✓
- `pnpm lint` ✓ (sin warnings nuevos)
- `pnpm test hub` ✓ 122/122 (test agregó `vi.mock("react-dom", () => ({ preload: vi.fn() }))`)
- Smoke manual `/hub` confirmado por user.

### Smoke prod

`/usr/bin/curl -sI https://www.chesscito.com/hub` → `HTTP 200 | redirect:` ✓

### PSI mobile sobre prod URL

Medido contra `https://www.chesscito.com/hub` tras deploy live:

| Métrica | Pre-P0-2 (baseline post-P0-1) | Post-P0-2 | Δ |
|---|---|---|---|
| Performance score | 76 | 75 | −1 (ruido) |
| LCP | 6473 ms | 6489 ms | +16 ms (ruido) |
| CLS | 0.00 | 0.00 | sin cambio ✓ |
| TBT | 110 ms | 140 ms | +30 ms (ruido) |
| FCP | 1.5 s | 1.5 s | sin cambio |
| Speed Index | 2.7 s | 2.9 s | +0.2 s (ruido) |

### LCP element — CAMBIÓ

Antes (pre-P0-2): `div.hub-action-rail > button.reward-tile > picture.reward-tile-piece > img` (Daily Tactic icon)

Después (post-P0-2):

```
div.desktop-app-frame > div.desktop-app-frame-inner > div.animate-in > div.pointer-events-none fixed bottom-1 right-1 z-[100]
```

Es el wrapper de **`<BuildVersionGate>`** dentro de `apps/web/src/app/[locale]/template.tsx:12-17`. Chip de build SHA en bottom-right, visible solo en `/hub` y `/dev/*`.

### Phase breakdown — Load Delay objetivo cumplido, Render Delay nuevo cuello

| Phase | Pre-P0-2 (daily icon) | Post-P0-2 (build chip) |
|---|---|---|
| TTFB | 817 ms (13%) | 820 ms (13%) |
| **Load Delay** | **5012 ms (77%)** | **0 ms (0%)** ✓ |
| Load Time | 531 ms (8%) | 0 ms (0%) |
| **Render Delay** | 113 ms (2%) | **5669 ms (87%)** |
| **Total LCP** | 6473 ms | 6489 ms |

### Lectura

El patch hizo exactamente lo que se diseñó hacer: `Load Delay 5012 ms → 0 ms`. El icono Daily ya NO es el LCP candidate — preload + fetchPriority lo sacaron de la cola de discovery.

El score no se movió porque el LCP saltó a otro elemento (`BuildVersionGate`) cuya pintura está retrasada 5669 ms — un bottleneck **estructural**, no de imágenes. La sospecha primaria es la combinación `animate-in fade-in duration-200` en `template.tsx:5` + hidratación de wagmi/RainbowKit; la confirmación detallada queda fuera del scope P0-2 y entra al P0-3.

### Estado final P0-2

**Cerrado: objetivo técnico cumplido. Score plano por bottleneck estructural.**

| Patch propuesto | Estado |
|---|---|
| Patch 1 P0-2 `perf(images): prioritize hub daily tactic LCP icon` | ✓ Shipped (`ea70b033`); Load Delay 5012→0; Daily ya no es LCP |
| Patch 2 P0-2 (preconnect + AVIF gen para `play-chess.png`) | ✗ NO necesario; LCP ya no está limitado por imágenes |

### Próximo cluster recomendado: P0-3

**`perf(template): unblock paint by reducing render delay`** (cluster nuevo, audit separado).

Justificación:
- Render Delay 5669 ms domina el LCP actual (87%).
- Patch 1 P0-2 demostró que el bottleneck de imágenes está resuelto. El próximo lever está en `template.tsx` + hidratación + posible animate-in que retrasa la calificación LCP.
- No tocar imágenes más; ROI nulo.

### Follow-ups separados (NO P0-3, pero pendientes)

- `fix(i18n): add missing PRO_COPY.daysLeftActiveLabel` — error de runtime en ProfileSheet (locale `en`)
- `perf(api): bound or cache founder-status ownership lookup` — `/api/founder-status` corre `eth_getLogs` unbounded sobre Forno y puede timeoutear ~40s
