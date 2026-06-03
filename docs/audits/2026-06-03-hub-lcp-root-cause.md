# Audit — `/hub` LCP root cause (§7 follow-up)

**Date:** 2026-06-03
**Mode:** read-only, no patches
**Baseline:** `docs/audits/2026-06-03-hub-perf-baseline-3run.md`
**Target LCP:** mobile 6500 ms (median 3 runs) → expected 3500-4000 ms post-patch

---

## 1. LCP element root cause — **CSS background-image, not `<img>`**

Lighthouse reports the LCP element as `<main class="hub-scaffold">` (full mobile viewport 390×823). Tree audit + CSS audit converge on **a single culprit**:

```css
/* apps/web/src/app/globals.css:6234 */
.hub-scaffold {
  /* ... */
  background-image: image-set(
    url("/art/redesign/bg/bg-new-hub.avif") type("image/avif"),
    url("/art/redesign/bg/bg-new-hub.webp") type("image/webp"),
    url("/art/redesign/bg/bg-new-hub.png")  type("image/png")
  );
  background-size: cover;
  background-position: center;
}
```

| Asset | Size | Format |
|---|---:|---|
| `bg-new-hub.avif` | **127 KB** | AVIF (served) |
| `bg-new-hub.webp` | 126 KB | WebP fallback |
| `bg-new-hub.png` | 478 KB | PNG fallback |

Confirmado en network waterfall del run `lh-hub-mobile-r3c.json`:
- `bg-new-hub.avif` se descarga con `priority: High` y `transferSize: 127425 B`.
- Es el recurso **más pesado** descargado above-the-fold (siguiente: `chunks/6427-…` a 76 KB).

## 2. Why the LCP starts late — **CSS-gated discovery**

LCP phase breakdown (mobile r3c):

| Phase | ms | % |
|---|---:|---:|
| TTFB | 1144 | 18% |
| **Load Delay** | **2331** | **36%** ← root cause lives here |
| Load Time | 2957 | 45% |
| Render Delay | 68 | 1% |

**Mecanismo (sequence):**

1. HTML llega (`/hub` route, 30 KB).
2. Browser ve `<link rel="stylesheet" href="...5ee4aa8ceb0047d4.css">` (priority `VeryHigh`).
3. Browser descarga + parsea el CSS (45 KB) — **render-blocking**.
4. Hasta que el parser CSS NO ha tokenizado la regla `.hub-scaffold { background-image: url("…bg-new-hub.avif"); }`, el preload scanner **no puede saber** que ese asset existe.
5. Una vez descubierto, el fetch arranca → eso explica los 2331 ms entre FCP y el inicio del download.
6. Los 2957 ms de Load Time son los bytes en la red bajo throttling Slow-4G (~1.5 Mbps): 127 KB × 8 ≈ 1 Mb / 1.5 Mbps ≈ 680 ms en teoría — el resto es congestion + TLS + queue contention.

**El preload actual NO ayuda:**

```ts
// apps/web/src/app/[locale]/hub/page.tsx:93
preload("/art/new-icons-chesscito/ejercicio-diario-chess.avif", {
  as: "image",
  type: "image/avif",
  fetchPriority: "high",
});
```

Ese asset (11 KB AVIF) es el ICON del tile "Daily exercise" en el rail derecho — NO es el LCP candidate. Era el target del commit P0-2 del cluster `hub-perf-cluster-2026-06-03` (project memory: `react-dom-preload-route-scoped`) pero **se preloadeó el asset equivocado**.

## 3. Other heavy near-LCP assets (audited, descartados)

| Asset | Selector | Size | LCP candidate? |
|---|---|---:|---|
| `bg-ch.avif` | `.sheet-bg-hub::before` (sheets only) | 44 KB | ❌ off-canvas en /hub (sheets cerrados al boot) |
| `chesscito-normal-portal.avif` | `<picture>` in `<KingdomAnchor variant="playhub">` | 21 KB | ❌ pequeño, contenido en `.hub-scaffold-anchor` (no llena viewport) |
| `icon.png` (favicon) | `<link rel="icon">` | 52 KB | ❌ no visible |
| `chunks/6427-…` (JS) | render path | 76 KB | ❌ JS no es LCP candidate |

El portal (`KingdomAnchor`) ya tiene `fetchPriority="high"` en su `<img>` y se renderiza desde SSR (es un client component pero el `<picture>` está en el server tree visible). Su asset es lo suficientemente pequeño (21 KB AVIF) para no dominar la métrica. **No es el lever.**

## 4. Patch mínimo propuesto (NO aplicar todavía)

### 4.1 Preload el LCP real desde `hub/page.tsx`

```diff
- preload("/art/new-icons-chesscito/ejercicio-diario-chess.avif", {
+ preload("/art/redesign/bg/bg-new-hub.avif", {
    as: "image",
    type: "image/avif",
    fetchPriority: "high",
  });
```

**Mecanismo del fix:** el `preload()` de `react-dom` emite un `<link rel="preload" as="image" type="image/avif">` en el `<head>` SSR. El browser ve este hint ANTES de empezar a parsear el CSS render-blocking → el fetch del bg arranca en paralelo con la descarga de CSS, eliminando los 2.3 s de Load Delay.

**Browsers sin soporte AVIF:** el `type="image/avif"` hace que el browser ignore el preload y siga la cadena CSS normal (WebP/PNG fallback). Zero downside.

### 4.2 Variante "doble-preload" (opcional, mismo file)

Si queremos cobertura para iOS < 16 (sin AVIF) sin perder el fast-path AVIF:

```ts
preload("/art/redesign/bg/bg-new-hub.avif", { as: "image", type: "image/avif", fetchPriority: "high" });
preload("/art/redesign/bg/bg-new-hub.webp", { as: "image", type: "image/webp" });
```

Browsers con AVIF descartan el WebP por content-negotiation; sin AVIF descartan el AVIF y consumen WebP. Costo: 1 línea más en `<head>`. Ahorro adicional: ~5-10% del universo iOS < 16 que verán LCP mejorada también.

### 4.3 `ejercicio-diario-chess.avif` preload — **eliminar**

Era un guess equivocado del commit P0-2. Mantenerlo gasta 11 KB de bandwidth en un asset que NO es above-the-fold focus visual. Remove.

## 5. Riesgos

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| R1 | El preload de un `image-set` desde CSS no es 1:1 con `<link rel=preload as=image type=image/avif>` — el browser podría double-fetch si content-negotiation falla | Baja | Verificar en devtools post-patch que `bg-new-hub.avif` aparece UNA sola vez en el waterfall. Si se dobla → revertir |
| R2 | Browsers con AVIF disabled bajo flag (raros) descargan el AVIF preload y NO lo usan → wasted 127 KB | Muy baja | Negligible en universo MiniPay (Chromium android-default-AVIF) |
| R3 | Si en el futuro `.hub-scaffold` cambia de bg, el preload queda apuntando a asset huérfano | Baja | Lint rule futura: comentar la dependencia explícitamente en el callsite |
| R4 | El asset .png (478 KB) NO se usa en MiniPay/Chrome → seguro removerlo del repo a futuro (no parte de este patch) | Baja | Out-of-scope, separate cleanup |

## 6. Tests / smoke

### 6.1 Pre-patch

- ✅ Baseline lighthouse mobile median = 65, LCP = 6500 ms (este audit + `2026-06-03-hub-perf-baseline-3run.md`)

### 6.2 Post-patch (cuando se aplique)

1. **Unit:** `apps/web/src/app/[locale]/hub/__tests__/page.test.tsx` — actualizar mock del `preload` para esperar el nuevo path. 1 line change.
2. **VR:** baseline mobile `vr9-hub-*` debe permanecer sin cambio visual (el asset se pinta en la misma posición). Si VR rojo → algo cambió en el render, investigar.
3. **Lighthouse 3-run mobile:** target LCP mediana ≤ 4000 ms, perf score ≥ 75.
4. **Network waterfall manual** (Chrome devtools, mobile emulation Slow 4G):
   - Confirmar `bg-new-hub.avif` aparece con `Initiator: preload` y `Priority: Highest`.
   - Confirmar `startTime < 500 ms` (no espera a CSS parse).
5. **Cross-browser:** verificar en Safari iOS 17 (AVIF supported) + Chrome Android.

## 7. Estimación de impacto

| Métrica | Baseline | Post-patch estimado | Δ |
|---|---:|---:|---:|
| LCP mobile | 6500 ms | **3700-4200 ms** | −2300 a −2800 ms |
| Perf score mobile | 65 | **75-80** | +10 a +15 |
| SI mobile | 5500 ms | 4500-5000 ms | −500 a −1000 ms (secundario, mismo paint) |
| TBT mobile | 142 ms | 142 ms | 0 (no toca JS) |
| CLS mobile | 0 (median) | 0 (median) | 0 (no toca layout) |
| Desktop perf | 83 | 84-86 | +1-3 (LCP ya estaba <2s, ahorro marginal) |

**Confianza:** alta. El mecanismo es estándar (preload scanner vs CSS-gated discovery) y el caso es ortodoxo. El único riesgo de quedar corto del estimado es que la `Load Time` (2957 ms del download real) tampoco mejora — el budget de bytes sigue ahí. Si queremos atacar `Load Time` también, hay que **encoger el asset** (currently 127 KB AVIF para una imagen 852×1846 — re-encode con `cwebp -q 70` + `avifenc --speed 4 --min 30 --max 50` puede bajarlo a ~80-90 KB sin pérdida visual).

## 8. Próximo paso recomendado (sin patches todavía)

**Path A (1 commit, ~10 min):** Aplicar §4.1 — swap del preload path en `hub/page.tsx`. Mínimo blast radius. Test plan §6.2.

**Path B (1 commit, ~30 min):** Aplicar §4.1 + §4.2 + §4.3 — doble preload (AVIF + WebP) + remove icon preload errado. Cobertura adicional para iOS antiguos.

**Path C (2 commits, ~1h):** Path A/B + re-encode AVIF/WebP del `bg-new-hub` para bajar bytes (~30-50 KB savings de Load Time). Requiere correr `scripts/optimize-art-assets.sh` o `cwebp/avifenc` por separado y validar VR.

**Bias:** Path B. AVIF+WebP doble preload + eliminar el guess equivocado. Cubre el 100% del universo MiniPay con un solo commit del tamaño de ~5 líneas. Path C es overkill antes de medir si Path B llega al target.

---

## Entregables del §7 (sin código)

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | Asset LCP candidato exacto, path, size | `/art/redesign/bg/bg-new-hub.avif`, 127 KB (AVIF), 852×1846 source |
| 2 | Cómo se descubre actualmente | CSS background-image en `.hub-scaffold` (globals.css:6248); descubierto al final del parse del CSS render-blocking |
| 3 | Por qué empieza tarde | CSS-gated discovery → el preload scanner del browser no ve el URL hasta que el CSS parse termina (~2.3 s después de FCP en Slow 4G) |
| 4 | Patch mínimo propuesto | §4.1: swap del `preload()` en `hub/page.tsx` de `ejercicio-diario-chess.avif` a `bg-new-hub.avif`. Variant §4.2: doble preload AVIF+WebP. Cleanup §4.3: remover icon preload erróneo |
| 5 | Riesgos | §5 — baja severidad; principal es double-fetch si content-neg falla (mitigation: verificar waterfall) |
| 6 | Tests/smoke | §6 — unit page test update + VR baseline check + 3-run lighthouse + waterfall manual |
| 7 | Estimación impacto | LCP 6500 → ~3700-4200 ms; perf score 65 → 75-80 mobile. Confianza alta. |
