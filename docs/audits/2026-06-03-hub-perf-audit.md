# /hub Mobile Performance Audit — P0-1

**Fecha:** 2026-06-03
**Baseline:** Mobile 72 / Desktop 95 (PageSpeed Insights)
**Target:** Mobile 85–90+ sin romper MiniPay zero-click ni features nuevas
**Modo:** Read-only audit. Patch propuesto en §5; no aplicado.

---

## 1. Diagnóstico corto

`/hub` paga el costo de wallet/RainbowKit eagerly en root layout (aplica a TODAS las rutas) y monta 4 sheets pesados estáticamente sin abrirlos. CLS viene del panel PRO sin dimensiones reservadas. Global CSS de 329 KiB / 11.7k líneas con familias `.arena-*` y `.coach-*` que no se usan en `/hub`. Ningún `preconnect`, ningún `next/image`, ningún script Lighthouse en `package.json`.

Las 4 oportunidades de Lighthouse mapean limpiamente:

| Lighthouse | Causa raíz | Confianza |
|---|---|---|
| Unused JS 110 KiB / 550 ms | Sheets estáticos + RainbowKit CSS eager | Alta |
| Render-blocking 290 ms | `@rainbow-me/rainbowkit/styles.css` en root | Media |
| Unused CSS 220 ms / 39 KiB | `.arena-*` + `.coach-viewer-*` en `globals.css` | Alta |
| CLS 0.187 | `HubProBadge` `<img>` sin `width/height` | Alta |

---

## 2. Archivos relevantes

| Archivo | Rol |
|---|---|
| `apps/web/src/app/[locale]/hub/page.tsx` | Server entry, delega a client scaffold |
| `apps/web/src/components/hub/hub-scaffold-client.tsx:10-15,446-451` | **4 sheets imported estáticos** |
| `apps/web/src/components/hub/hub-scaffold.tsx` | Estructura HUD + body 3 columnas |
| `apps/web/src/components/hub/hub-pro-badge.tsx:60` | **CLS suspect: `<img>` sin dims** |
| `apps/web/src/components/hub/kingdom-anchor.tsx:97` | Ya tiene `aspect-ratio` ✓ (safe) |
| `apps/web/src/components/wallet-provider.tsx:3-17,32-40,51-75` | **RainbowKit CSS eager + auto-connect MiniPay** |
| `apps/web/src/lib/minipay.ts:28-36` | `isMiniPayEnv()` — must stay eager |
| `apps/web/src/app/[locale]/layout.tsx:117` | `<WalletProvider>` en root |
| `apps/web/src/app/globals.css` | **329 KiB / 11.7k líneas / 743 selectores** |
| `apps/web/next.config.js` | Sin `optimizePackageImports`, sin `modularizeImports` |

---

## 3. Mapa de imports pesados en `/hub`

```
[ROOT layout.tsx]
└── <WalletProvider>            ← eager, en todas las rutas
    ├── wagmi (createConfig, http, useConnect, WagmiProvider)
    ├── wagmi/chains (celo, celoSepolia)
    ├── @rainbow-me/rainbowkit (connectorsForWallets)
    ├── @rainbow-me/rainbowkit/styles.css   ← RENDER BLOCKING
    └── @rainbow-me/rainbowkit/wallets (injectedWallet)
        └── RainbowKitProvider (dynamic ssr:false) ✓ ya diferido

[/hub page.tsx]
└── HubScaffoldClient
    ├── useConnectModal (@rainbow-me/rainbowkit)   ← solo para event handler
    ├── HubScaffold
    │   ├── RewardColumn (left rail)
    │   ├── KingdomAnchor (center, aspect-ratio ✓)
    │   ├── MissionRibbon + PremiumSlot (right rail)
    │   └── HubProBadge   ← img sin dims (CLS)
    ├── ProSheet              ← ESTÁTICO, abre on tap
    ├── BadgeSheet            ← ESTÁTICO, abre on tap
    ├── ShopSheet             ← ESTÁTICO, abre on tap
    └── PurchaseConfirmSheet  ← ESTÁTICO, nested en shop
```

**Lo único ya bien hecho:** `RainbowKitProvider` cargado vía `next/dynamic({ ssr: false })` en `wallet-provider.tsx:14-17`. El resto del paquete RainbowKit + CSS sigue eager.

---

## 4. Causa probable del CLS 0.187

**Sospechoso #1 (alta confianza):** `apps/web/src/components/hub/hub-pro-badge.tsx:60`

```tsx
<img src="/art/hub/panel-pro.png" alt="" />
```

Sin `width`/`height`/`aspect-ratio`. Vive en el HUD top-right; cuando la imagen decodifica empuja el texto "PRO days remaining" hacia abajo y arrastra el resto del header.

**Sospechoso #2 (baja confianza):** Connect chip aparece/desaparece según `isWalletConnected` durante el ciclo de auto-connect MiniPay. Si el chip se renderiza en SSR y luego se oculta tras el `useEffect` del auto-connect, hay layout shift. Verificar con `chrome://tracing` o LH "Avoid large layout shifts" desglose.

**Sospechosos descartados:**
- `KingdomAnchor` → tiene `aspectRatio` dinámico (`kingdom-anchor.tsx:97`) ✓
- Lottie/character mount → no se encontró Lottie en `/hub` tree
- Fonts → `next/font/google` con `display: 'swap'` (mitigado)

---

## 5. Patch 1 recomendado — `perf(bundle): lazy-load hub sheets`

**Riesgo MiniPay:** NINGUNO. Los sheets solo abren tras tap del usuario; el auto-connect ya terminó.

**Cambio único:** convertir 4 imports estáticos en `next/dynamic` en `hub-scaffold-client.tsx:10-15`:

```tsx
import dynamic from "next/dynamic";

const ProSheet = dynamic(() => import("./pro-sheet").then(m => m.ProSheet), {
  ssr: false,
});
const BadgeSheet = dynamic(() => import("./badge-sheet").then(m => m.BadgeSheet), {
  ssr: false,
});
const ShopSheet = dynamic(() => import("./shop-sheet").then(m => m.ShopSheet), {
  ssr: false,
});
const PurchaseConfirmSheet = dynamic(
  () => import("./purchase-confirm-sheet").then(m => m.PurchaseConfirmSheet),
  { ssr: false },
);
```

**Por qué empezar aquí:**
- Cero riesgo MiniPay (no toca wallet-provider).
- Cero riesgo visual (sheets siguen abriendo igual; modales tienen su propio fade).
- No mueve App URL, no toca CELO, no toca i18n, no toca Labyrinth/`/stats`/identity/AddCashCta.
- Ataca directamente el 110 KiB de "unused JavaScript" en LH (cada sheet importa transitivamente componentes de UI + handlers de compra).
- Reversible: 1 commit, 1 archivo.

**Patches 2 y 3 (separados, no incluidos en commit 1):**

- **`perf(hub): stabilize mobile layout shift`** — añadir `width/height` (o `aspect-ratio` CSS) a `<HubProBadge>` `<img>`. Verificar si el connect-chip placeholder necesita reserva de espacio mientras corre auto-connect MiniPay.
- **`perf(head): add critical preconnect hints`** — solo si LH lo justifica tras patch 1+2. Candidatos: `https://relay.walletconnect.com`, `https://mainnet.celo.org`. NO añadir si las medidas post-patch ya pasan 85.

**Diferido a cluster propio (NO entrar a este P0-1):**
- Split de `globals.css` (`.arena-*` / `.coach-viewer-*`) → cluster CSS dedicado con VR baselines completas.
- Migración `<img>` → `next/image` → cluster propio (riesgo MiniPay WebView decode).
- Mover `@rainbow-me/rainbowkit/styles.css` a lazy mount → requiere test en device MiniPay real.

---

## 6. Tests / mediciones

**Antes del patch:**
```bash
cd apps/web
pnpm build && pnpm start
# en otra terminal:
npx lighthouse http://localhost:3000/en/hub \
  --emulated-form-factor=mobile \
  --output=json --output-path=./lh-before.json \
  --chrome-flags="--headless"
```

Capturar: Performance score, LCP, CLS, TBT, bytes JS, bytes CSS, unused JS, unused CSS.

**Validación funcional post-patch:**
- `pnpm test` — unit + integration (debe seguir verde)
- `pnpm test:e2e:visual` — VR; flag baselines si modal animation desfasa
- MiniPay smoke manual: `/hub` → tap shop → verifica spinner breve y luego sheet (esperado por chunk load)
- Browser DevTools "Slow 3G" throttle: medir delta de TTI

**Después del patch:**
```bash
npx lighthouse http://localhost:3000/en/hub \
  --emulated-form-factor=mobile \
  --output=json --output-path=./lh-after.json \
  --chrome-flags="--headless"

# diff:
node -e "
const b = require('./lh-before.json'), a = require('./lh-after.json');
console.log('score', b.categories.performance.score*100, '→', a.categories.performance.score*100);
console.log('LCP', b.audits['largest-contentful-paint'].numericValue, '→', a.audits['largest-contentful-paint'].numericValue);
console.log('CLS', b.audits['cumulative-layout-shift'].numericValue, '→', a.audits['cumulative-layout-shift'].numericValue);
console.log('unused JS bytes', b.audits['unused-javascript'].details.overallSavingsBytes, '→', a.audits['unused-javascript'].details.overallSavingsBytes);
"
```

Nota: no existe script `lighthouse` ni `lhci` en `package.json`. Vale considerar añadir `pnpm perf:lh` en un cluster posterior (no este).

---

## 7. Estimación de impacto

| Patch | JS ahorro | CLS ahorro | LH score Δ | Riesgo MiniPay |
|---|---|---|---|---|
| **1. Lazy sheets** | 40–80 KiB | 0 | +5 a +8 | Ninguno |
| **2. ProBadge dims + chip reserve** | 0 | −0.10 a −0.15 | +3 a +5 (CLS hits weighted) | Ninguno |
| **3. Preconnect (si aplica)** | 0 | 0 | +1 a +2 | Ninguno |
| **Total estimado** | 40–80 KiB | CLS → ~0.05 | **72 → 83–88** | Bajo |

Para llegar a 90+ probablemente haya que entrar al cluster CSS (split `.arena-*`/`.coach-*`) y `next/image`. Eso queda para un P0-2 separado con baselines VR completas, no para este sprint.

---

## Reglas respetadas

- ✓ No toca Labyrinth / `/stats` / identity / ODIS / AddCashCta / CELO / copy sweep
- ✓ No refactor grande
- ✓ No mueve App URL
- ✓ No rompe zero-click MiniPay (auto-connect en `WalletProviderInner` intacto)
- ✓ Commits separados por intención (`perf(bundle)` / `perf(hub)` / `perf(head)`)
- ✓ Read-only hasta aprobación

---

## Outcome (post-deploy)

**Fecha promote:** 2026-06-03
**HEAD `origin/production` final:** `308a7976`
**HEAD `origin/main` final:** `308a7976` (aligned)

### Commits shipped

| Hash | Commit | Tocado |
|---|---|---|
| `9152bc3b` | `perf(bundle): lazy-load hub sheets` | `apps/web/src/components/hub/hub-scaffold-client.tsx` |
| `308a7976` | `perf(hub): stabilize Pro badge image layout` | `apps/web/src/components/hub/hub-pro-badge.tsx` |

### Validación pre-promote

- `pnpm type-check` ✓ (next build + tsc --noEmit limpios)
- `pnpm lint` ✓ (sin warnings nuevos; solo preexistentes en arena/exercises/use-chess-game)
- `pnpm test hub shop add-cash-cta result-overlay coach-paywall` ✓ 237/237 (post Patch 1)
- `pnpm test hub` ✓ 122/122 (post Patch 2)
- Smoke funcional manual de sheets ✓ (user-validated)
- Smoke prod: `HTTP 200 | redirect:` sobre `https://www.chesscito.com/hub`

### PSI mobile sobre prod URL

Medido contra `https://www.chesscito.com/hub` tras deploy live de Vercel:

| Métrica | Baseline | Final | Δ | Veredicto |
|---|---|---|---|---|
| Performance score | 72 | **76** | +4 | Modesto |
| **CLS** | **0.187** | **0.00** | **−0.187** | ✓ Resuelto |
| LCP | n/d | 6.5 s | — | Bottleneck restante |
| TBT | n/d | 110 ms | — | Bueno |
| FCP | n/d | 1.5 s | — | Bueno |
| Speed Index | n/d | 2.7 s | — | Bueno |
| Unused JS savings | 110 KiB | 108 KiB | −2 KiB | Métrica engañosa (ver §lectura) |
| Unused CSS savings | 39 KiB | 38 KiB | −1 KiB | Sin cambio material |
| Render-blocking | 290 ms | 278 ms | −12 ms | Sin cambio material |

### Lectura honesta de las métricas

1. **Patch 2 entregó 100% lo prometido.** CLS pasó de 0.187 a 0.00 en prod real. Atributos `width={225} height={272}` reservaron el aspect-ratio en HTML parse time, cerrando la ventana CLS durante el render-blocking CSS.
2. **Patch 1 funcionó pero la métrica "unused JS savings" lo enmascara.** PSI mide unused-pero-descargado. Los sheets ahora ni se descargan en first paint, así que dejaron de aportar a ambas categorías. El beneficio real está en First Load JS (429 KB en `next build`), no en este audit. Para cuantificarlo limpio habría hecho falta capturar First Load JS pre-patch — no lo tenemos.
3. **Score limitado por LCP 6.5s**, NO por lo que atacaron Patch 1/2. El LCP en mobile real es casi seguro la imagen de fondo/board del `/hub` servida como `<img>` raw sin `next/image`.
4. **Render-blocking apenas bajó (12 ms)**. El `@rainbow-me/rainbowkit/styles.css` sigue eager en root. Patch 3 puede recuperar ~150-280 ms aquí, traduciéndose a ~+3-5 puntos. Llegaría a ~79-81.

### Estado final P0-1

**Cerrado parcialmente.** Objetivo CLS cumplido. Objetivo score 85+ NO cumplido por bottleneck LCP fuera del scope original del audit.

| Patch propuesto | Estado |
|---|---|
| Patch 1 `perf(bundle): lazy-load hub sheets` | ✓ Shipped (`9152bc3b`) |
| Patch 2 `perf(hub): stabilize Pro badge image layout` | ✓ Shipped (`308a7976`) |
| Patch 3 `perf(head): add critical preconnect hints` | ✗ Diferido; bajo ROI sin atacar LCP primero |

### Próximo cluster recomendado: P0-2

**`perf(images): reduce /hub LCP via next/image migration`** (cluster nuevo, audit separado).

Justificación:
- LCP 6.5 s domina el score actual.
- `/hub` sirve imágenes (board background, character anchor, panel art) como `<img>` raw → sin optimización AVIF/WebP responsive, sin `priority`, sin sizing hints.
- `next/image` con `priority` en el LCP candidate + dimensiones correctas debería bajar LCP a 3-4 s y empujar score a 82-87.
- Riesgo MiniPay: medio. AVIF/WebP nego en MiniPay WebView debe verificarse manualmente en device.
- Patch 3 (preconnect + RainbowKit CSS lazy) tiene más sentido medido encima del LCP fix, no antes.

### Cierre administrativo

- ✓ `origin/main` alineado con `origin/production` en `308a7976`.
- ✓ Audit doc committed (este archivo).
- Artefactos locales NO commiteados: `apps/web/lh-patch1.json`, `apps/web/lh-prod-mobile.json` (mediciones puntuales).
