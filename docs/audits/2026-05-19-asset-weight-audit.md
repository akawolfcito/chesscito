# Asset Weight Audit — 2026-05-19

## TL;DR

- **`apps/web/public/` pesa 85MB** — 87% es PNG sin optimizar.
- **El asset más caro es un ícono de 52×52 que se sirve como PNG de 1224×1251 = 1.27MB**. Ratio de sobre-servicio: ~23,000% más píxeles de lo necesario.
- **Cero imports de `next/image`** en todo el código. 11 `<img>` raw — sin optimización automática del bundler.
- **`design/` está dentro de `public/`** sirviendo 576KB de assets de diseño al usuario final (no debería estar ahí).
- **Reducción esperada con limpieza + optimización: 85MB → ~5-8MB** (≈90%).

## Inventario por formato

| Formato | Tamaño total | % del payload |
|---------|-------------:|--------------:|
| PNG     | 73.9 MB      | 87%           |
| WebP    | 5.7 MB       | 7%            |
| AVIF    | 2.6 MB       | 3%            |
| JPG     | 0.4 MB       | <1%           |
| **Total** | **~85 MB** | 100%          |

Total archivos imagen: **325**.

## Top 25 ofensores (PNG sin AVIF/WebP sibling)

| KB      | Path                                                |
|--------:|-----------------------------------------------------|
| 2646.4  | `art/bg-badges-chesscito.png`                       |
| 2440.9  | `art/bg-splash-chesscito.png`                       |
| 2440.3  | `art/badge-chesscito.png`                           |
| 2313.7  | `art/bg-chesscitov3.png`                            |
| 2200.3  | `art/new-icons-chesscito/avatar-blue.png`           |
| 2198.1  | `art/new-icons-chesscito/avatar-red.png`            |
| 2115.0  | `art/redesign/bg/splash-loading.png`                |
| 2046.1  | `art/score-chesscito.png`                           |
| 2022.2  | `art/shop-magic-chesscito.png`                      |
| 1934.6  | `art/panel-frame-rune.png`                          |
| 1856.8  | `art/target-circle.png`                             |
| 1761.3  | `art/redesign/bg/bg-new-hub.png`                    |
| 1709.5  | `art/redesign/bg/bg-app.png`                        |
| 1707.7  | `art/reward-glow.png`                               |
| 1689.7  | `art/leaderboard-hall-chesscito.png`                |
| 1564.3  | `art/landing/progress-trophies.png`                 |
| 1550.1  | `art/chesscito-board.png`                           |
| 1531.1  | `art/redesign/board/board-ch.png`                   |
| 1455.1  | `art/landing/hero-play-hub.png`                     |
| 1439.2  | `art/redesign/avatars/player-you.png`               |
| 1273.9  | `art/hub/train-pieces.png` ← ícono 52px             |
| 1142.1  | `art/redesign/avatars/player-opponent.png`          |
| 1117.7  | `art/redesign/bg/bg-ch.png`                         |
| 1101.1  | `art/scene-rooted/portal-centered.png`              |
| 1088.2  | `art/hub/enter-arena.png` ← ícono 52px             |

Sólo el top 25 = **~42MB** (50% del payload total).

## Problemas detectados

### P0 — Limpieza inmediata (sin riesgo)
1. **`public/design/` no debe existir** — está sirviendo `community-pool.png` (573KB) que duplica `art/arena/community-pool.png`. Quitar carpeta.
2. **`avatar-blue/` (sin `.png`)** — hay un archivo binario sin extensión de 2.45MB en `art/new-icons-chesscito/`. Probablemente residuo, revisar y borrar.

### P1 — Resize de iconos sobreservidos
Los siguientes son íconos que en pantalla miden 32-65px pero se sirven a >1000px:

| Asset                                          | Real (px)   | Display (px) | KB actual |
|------------------------------------------------|-------------|--------------|----------:|
| `hub/train-pieces.png`                         | 1224×1251   | ~65          | 1274      |
| `hub/enter-arena.png`                          | 1216×1246   | ~65          | 1088      |
| `new-icons-chesscito/avatar-blue.png`          | 1254×1254   | ~80          | 2200      |
| `new-icons-chesscito/avatar-red.png`           | similar     | ~80          | 2198      |
| `new-icons-chesscito/laberinto.png`            | 1034×954    | ~48          | 991       |
| `new-icons-chesscito/training.png`             | similar     | ~48          | 806       |
| `new-icons-chesscito/learning.png`             | similar     | ~48          | 821       |
| `hub/new-train-pieces1.png`                    | similar     | ~65          | 775       |
| `hub/new-enter-arena1.png`                     | similar     | ~65          | 570       |

Resize a 200×200 (4× retina para 50px display) + pngquant + AVIF/WebP esperado: **~95% reducción** por asset.

### P2 — Backgrounds sin variantes modernas
- `art/bg-badges-chesscito.png` (2.6MB), `art/bg-splash-chesscito.png` (2.4MB), `art/badge-chesscito.png` (2.4MB) — no tienen `.avif/.webp` sibling.
- Si se generan AVIF/WebP y se renderiza con `<picture>`, los browsers modernos pagan 70-90% menos.

### P3 — Falta `next/image`
- 0 imports de `next/image` en `src/`.
- 11 `<img>` raw (sin lazy-loading automático, sin srcSet responsive, sin LQIP).
- El proyecto usa `<picture>` con AVIF/WebP/PNG triplets en algunos sitios (`PrimaryPlayCta`, `RewardColumn`) — patrón ya establecido pero inconsistente.

## Tooling disponible localmente

- ✓ `cwebp` (Google WebP encoder)
- ✓ `avifenc` (AVIF encoder)
- ✓ `pngquant` (PNG lossy compressor)
- ✓ `sips` (macOS resize)
- ✗ `sharp` / `oxipng` / `vips` (instalables si se quiere pipeline en Node)

## Plan de optimización propuesto (3 fases)

### Fase 1 — Limpieza (≈15 min, -1MB sin tocar visuales)
- Borrar `public/design/`
- Borrar `art/new-icons-chesscito/avatar-blue` (sin extensión)
- Quitar PNGs huérfanos sin referencias en código

### Fase 2 — Resize + compress (≈1h, -60MB esperados)
Script que:
1. Para íconos: resize a 4× display size (e.g., 200×200 para íconos de 50px)
2. `pngquant --quality=70-90` sobre el PNG resizeado
3. `cwebp -q 80` → genera `.webp` sibling
4. `avifenc --min 24 --max 32` → genera `.avif` sibling
5. Mantiene la misma ruta `/art/...` (el PNG original es backup en `.next/cache` o renombrado).

### Fase 3 — Migración a `<picture>` o `next/image` (≈2h)
**Opción A — `<picture>` (continua patrón actual):**
- Sweep de los 11 `<img>` raw → migrarlos a `<picture>` con triplet AVIF/WebP/PNG.
- Mínimo refactor, cero dependencias nuevas.

**Opción B — `next/image`:**
- Mejor: auto srcSet responsive, lazy loading, blur placeholders, optimización CDN automática en Vercel.
- Costo: refactor de ~30 sitios + cambio de patrón.

## Decisión: CDN (Cloudinary vs Vercel native)

**Recomendación: NO uses Cloudinary todavía.**

| | Cloudinary | Vercel native (`next/image`) | DIY (`<picture>` actual) |
|---|---|---|---|
| **Costo** | Free tier 25 créditos/mes; luego de pago | Gratis en Vercel (incluido en el plan) | Gratis |
| **Setup** | Cuenta + SDK + upload pipeline | Cambiar `<img>` → `<Image>` | Ya implementado en algunos sitios |
| **Format negotiation** | Automático (AVIF/WebP/JPG según browser) | Automático | Manual con `<source>` |
| **Resize on-demand** | ✓ | ✓ (durante build/request) | ✗ (assets pre-generados) |
| **CDN edge** | Global (Cloudinary) | Global (Vercel Edge) | Vercel CDN sirve estáticos |
| **Vendor lock-in** | Sí | Bajo (Vercel) | Cero |
| **Cuándo conviene** | Transformaciones dinámicas, video, multi-tenant | Apps Next.js en Vercel | Game assets estáticos |

**Para este proyecto** (game assets estáticos en MiniPay, Vercel-hosted):
- Mejor camino: **Fase 1 + 2 (limpiar + resize/compress) + Fase 3A (`<picture>` consistente)**.
- Diferir Cloudinary hasta tener un caso concreto (ej: skins user-uploaded, NFT image transformations).
- Vercel native + assets pre-optimizados = carga prácticamente instantánea en mobile sin agregar deps ni costos.

## Métricas objetivo post-optimización

| | Antes | Objetivo |
|---|---:|---:|
| `public/` total | 85 MB | <10 MB |
| Top 25 assets | 42 MB | <4 MB |
| TTI en MiniPay (3G simulado) | TBD | -50% |
| Lighthouse Performance | TBD | +20pts |

## Siguiente paso

Esperar aprobación del usuario para ejecutar Fase 1 + 2.
