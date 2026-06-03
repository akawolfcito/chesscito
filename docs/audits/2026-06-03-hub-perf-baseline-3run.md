# Audit — `/hub` perf baseline (3-run median)

**Date:** 2026-06-03
**Mode:** read-only, no patches
**Target:** `https://www.chesscito.com/hub` (production, FF release `b1f36bf3` not yet promoted; `origin/production = 363890b9`)
**Tool:** `lighthouse@12` headless Chrome, default mobile preset + desktop preset
**Caveat:** invalidated runs (NO_LCP) replaced; 1 mobile retry (`r3c`) used `--max-wait-for-load=45000`

---

## 1. Median (canonical baseline)

| Metric | Mobile median | Desktop median |
|---|---:|---:|
| **Performance** | **65** | **83** |
| FCP | 2.2 s | 1.0 s |
| LCP | 6.5 s | 1.9 s |
| TBT | 142 ms | 0 ms |
| CLS | 0 | 0 |
| Speed Index | 5.5 s | 2.3 s |

Per user criteria:
- Mobile median **65 < 70** → **regresión real** vs handoff baseline 72 (Δ −7).
- CLS median 0 → no reabrir cluster CLS **pero ver §3 (inestabilidad)**.
- LCP 6.5 s + SI 5.5 s mobile → abrir audit read-only LCP/SI (este doc, §4-§5).
- Desktop sin regresión (83 vs handoff 95 sí cae, pero >70 y sin gates de submission).

## 2. Per-run table

### Mobile

| Run | Perf | FCP | LCP | TBT | CLS | SI | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| r1 | 65 | 3047 | 5095 | 142 | 0.0000 | 10994 | First sample |
| r2 | 70 | 2207 | 6997 | 54 | 0.0000 | 5491 | Cleanest TBT |
| r3 | — | 1741 | — | — | 0 | 10076 | **NO_LCP**, discarded |
| r3b | — | 1710 | — | — | 0 | 4496 | **NO_LCP**, discarded |
| r3c | 62 | 1828 | 6500 | 160 | **0.187** | 5127 | `--max-wait-for-load=45000` |

### Desktop

| Run | Perf | FCP | LCP | TBT | CLS | SI |
|---|---:|---:|---:|---:|---:|---:|
| r1 | 83 | 1030 | 1914 | 0 | 0 | 2809 |
| r2 | 82 | 1486 | 2116 | 0 | 0.0000 | 1940 |
| r3 | 87 | 748 | 1756 | 27 | 0 | 2263 |

## 3. CLS inestabilidad (1 de 3 runs)

- 2 runs reportan CLS ≈ 0, 1 run reporta CLS **0.187** (idéntico al pre-fix histórico citado en `pagespeed-report-2026-06-03.md`).
- Mediana 0 → no se reabre CLS cluster, pero **el fix NO es determinístico**.
- Hipótesis: el layout-shift solo se materializa cuando la cadena de hydration tarda lo suficiente para que el connect-pill (o un asset late-fetched) reemplace su placeholder DESPUÉS de la window de medición de CLS. En runs rápidos el shift queda fuera de la ventana; en runs lentos cae dentro.
- **Acción sugerida (no aplicar todavía):** reservar footprint exacto del connect-pill antes de hydration (skeleton con `min-width` igual al estado conectado).

## 4. LCP root cause — phase breakdown (r3c, 6500 ms total)

| Phase | Timing | % of LCP |
|---|---:|---:|
| TTFB | 1144 ms | 18% |
| **Load Delay** | **2331 ms** | **36%** |
| **Load Time** | **2957 ms** | **45%** |
| Render Delay | 68 ms | 1% |

### LCP element

```
<main class="hub-scaffold">
selector: div.desktop-app-frame > div.desktop-app-frame-inner > div.animate-in > main.hub-scaffold
boundingRect: top=0, height=823, width=390 (full mobile viewport)
```

### Interpretación

- El LCP candidate es el contenedor `<main.hub-scaffold>` que abarca el viewport completo (823×390). Esto significa que Lighthouse no encuentra una imagen/texto interior más grande que el propio frame — el contenido principal entra tarde via client hydration.
- **Load Delay 2331 ms (36%):** tiempo desde FCP hasta que el browser empieza a descargar el recurso LCP. Sugiere descubrimiento tardío del asset crítico (probablemente un background image declarado en CSS hidratado client-side, o un `<Image>` montado por `HubScaffoldClient`).
- **Load Time 2957 ms (45%):** descarga real del recurso. En Slow-4G throttling (1.5 Mbps), 3s implica un payload ~500-600 KB. El asset `train-pieces.png` (22 KB) NO es el culpable; probable suspect: `bg-game.png` o `bg-playhub-forest-mobile.png` o equivalente fondo de scaffold.
- `apps/web/src/app/[locale]/hub/page.tsx:93` ya hace `preload("/art/new-icons-chesscito/ejercicio-diario-chess.avif")` con `fetchPriority: "high"`, pero el LCP element NO es esa imagen → el preload no está ganando la carrera contra el real LCP candidate.

## 5. Diagnostics inventory (mobile r3c)

### 5.1 render-blocking-resources — 268 ms savings

| Resource | Bytes | Wasted |
|---|---:|---:|
| `_next/static/css/5ee4aa8ceb0047d4.css` | 45.5 KB | 328 ms |

Un solo CSS bloqueante. Coincide con `unused-css-rules` (87% del bundle no usado en above-fold).

### 5.2 unused-javascript — 490 ms savings

| Chunk (suffix) | Bytes | Wasted | % |
|---|---:|---:|---:|
| `chunks/6427-…` | 76 KB | 49 KB | 65% |
| `chunks/3446-…` | 71 KB | 35 KB | 50% |
| `chunks/1fa7ebf3-…` | 39 KB | 26 KB | 66% |

**Prohibido tocar wagmi/RainbowKit** (constraint usuario). Pendiente identificar qué módulos viven en estos chunks (probablemente RainbowKit+Connect modal según `pagespeed-report-2026-06-03.md` §Top opportunities). Si todos son wagmi/RainbowKit → este lever queda OFF-LIMITS y el bundle savings disponible es 0 ms.

### 5.3 unused-css-rules — 0 ms savings reportados (87% no-usado)

| Resource | Bytes | Wasted | % |
|---|---:|---:|---:|
| `_next/static/css/5ee4aa8ceb0047d4.css` | 45.4 KB | 39.6 KB | 87% |

Lighthouse reporta 0 ms savings (no en path crítico de LCP) pero el bloat es real. Bajar a ~6 KB used → reduce render-blocking de §5.1 por ratio (≈ 328 × 0.13 ≈ 43 ms remanente). Candidato a `tailwind purge` o split por route.

### 5.4 modern-image-formats — 0 ms savings

Single hit: `art/hub/train-pieces.png` (22 KB → ahorro despreciable). Confirmación de que la disciplina AVIF/WebP existing en `art/**` ya está aplicada universalmente. **Lever cerrado.**

### 5.5 uses-rel-preconnect — 300 ms savings

| Origin | Wasted |
|---|---:|
| `https://forno.celo.org` | 300 ms |

Forno está siendo contactado (RTT 7.7 ms confirmado en `network-rtt`) probablemente vía wagmi RPC eager call. `<link rel="preconnect" href="https://forno.celo.org" />` en `<head>` ahorra ~300 ms del handshake TLS.

### 5.6 bootup-time top contributors

| Source | Time |
|---|---:|
| `chunks/9267-…` | 345 ms |
| Unattributable | 266 ms |
| `/hub` HTML | 230 ms |
| `chunks/8129-…` | 111 ms |

### 5.7 mainthread-work breakdown

| Category | Time |
|---|---:|
| Script Evaluation | 514 ms |
| Other | 332 ms |
| Script Parsing & Compilation | 210 ms |
| Style & Layout | 126 ms |

Total mainthread ≈ 1.2 s. TBT 142 ms es bajo pero non-zero.

## 6. Levers disponibles dentro de los constraints

Constraints usuario: NO tocar wagmi/RainbowKit, `/stats`, `founder-status`, Labyrinth.

| Lever | Surface | Effort | Expected mobile savings | Notes |
|---|---|---|---:|---|
| `<link rel=preconnect>` forno.celo.org | `<head>` en `layout.tsx` | XS (1 commit) | 300 ms LCP | Compatible con constraint (no toca wagmi, solo declara hint) |
| Preload del **real** LCP image candidate (no `ejercicio-diario`) | `hub/page.tsx` `preload()` | S (auditar qué imagen es) | 500-2000 ms LCP (mata Load Delay) | Requiere primero identificar el asset; ver §7 |
| Reserve connect-pill footprint pre-hydration | `HubScaffoldClient` skeleton | S | CLS estabilización | Cierra inestabilidad §3 |
| Purge unused Tailwind/CSS | `tailwind.config` + `globals.css` audit | M-L | 43-200 ms render-block | Lever con riesgo VR; necesita baselines refresh |
| Identify non-wagmi bundle waste in 6427/3446/1fa7ebf3 | bundle analyzer | M | TBD (0 si todo es wagmi) | Read-only investigation; no edits |

**Total upside dentro de constraints: ~800-2400 ms LCP, +5 a +15 perf points mobile.**

Esto NO alcanza la meta MiniPay submission ≥ 90 sin desbloquear el constraint wagmi/RainbowKit. Mediana 65 + 15 = 80, gap remanente 10 puntos.

## 7. Follow-up read-only para identificar el LCP real

Para ejecutar en próximo paso sin tocar código:

1. Inspeccionar `HubScaffoldClient` y el árbol DOM bajo `<main.hub-scaffold>` para enumerar candidatos LCP (imágenes con `height ≥ 800` o `width ≥ 380`).
2. Cross-reference con `Network` panel en Chrome devtools mobile emulation contra prod para ver qué image domina el critical path.
3. Verificar si el preload actual de `ejercicio-diario-chess.avif` corresponde al primer paint visible o es un asset below-the-fold.

Salida esperada: nombre + path exacto del LCP asset real → habilita commit `perf(hub): preload real LCP asset` futuro.

## 8. Resolución

| Criterio user | Resultado |
|---|---|
| Mobile median <70 → regresión real | ✅ Confirmado (65) |
| Mobile median 75-81 → ruido | ❌ N/A |
| CLS sigue 0 → no reabrir | 🟡 Median sí, pero inestable (§3) |
| LCP/SI altos → audit read-only | ✅ Este doc §4-§5 |

**Próximo paso recomendado:** ejecutar §7 (identificar LCP real) antes de cualquier patch. Sin esa info, el commit `perf(hub): preload real LCP asset` es un guess.

**Sin patches aplicados en esta sesión.**

---

## Raw artifacts

- `/tmp/psi-baseline-p0-1/lh-hub-mobile.json` (r1)
- `/tmp/psi-baseline-p0-1/lh-hub-mobile-r2.json`
- `/tmp/psi-baseline-p0-1/lh-hub-mobile-r3c.json` (extended wait)
- `/tmp/psi-baseline-p0-1/lh-hub-desktop.json` (r1)
- `/tmp/psi-baseline-p0-1/lh-hub-desktop-r2.json`
- `/tmp/psi-baseline-p0-1/lh-hub-desktop-r3.json`
