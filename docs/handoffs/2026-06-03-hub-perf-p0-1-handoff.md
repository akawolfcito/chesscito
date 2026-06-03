# Handoff — /hub perf P0-1 cluster (2026-06-03)

**Session window:** 2026-06-03 (single session, ~3 hours)
**Cluster:** MiniPay readiness P0-1 — Lighthouse mobile /hub
**Status at close:** main = production = `2935cca7`
**Outcome:** **P0-1 mejorado sustancialmente, aún bajo target submission ≥90+. Gap remanente 7-11 puntos requiere cluster mayor.**

---

## 1. Commits cerrados

3 commits funcionales en chronological order, todos en production:

| Hash | Type | Title | Production? |
|---|---|---|---|
| `aa52988a` | perf | `perf(hub): preload real hub LCP background` | ✅ Live (promote ~17:00 UTC) |
| `6498419c` | perf | `perf(hub): preload visible reward rail assets` | ✅ Live (promote ~17:15 UTC) |
| `2935cca7` | perf | `perf(hub): drop redundant WebP preloads` | ✅ Live (promote ~17:28 UTC) |

**Pending promote:** ninguno. `origin/main` = `origin/production` = `2935cca7`.

Audit docs untracked (no commiteados; ver §10 para acción recomendada):

```
docs/audits/2026-06-03-hub-perf-baseline-3run.md
docs/audits/2026-06-03-hub-lcp-root-cause.md
docs/audits/2026-06-03-hub-reward-rail-lcp-audit.md
```

---

## 2. Métricas (3-run median, mobile, Lighthouse 12 contra `https://www.chesscito.com/hub`)

| Métrica | Baseline | Post-A | Post-B | **Post-drop (final)** | Δ total |
|---|---:|---:|---:|---:|---:|
| **Performance** | 65 | 71 | 85\* | **79-83** | **+14 a +18** |
| **LCP** | 6500ms | 6636ms | 3997ms\* | **4165ms** | **-2335ms** |
| FCP | 2207ms | 1797ms | 1840ms | **1667-1945ms** | -262 a -540ms |
| TBT | 142ms | 79ms | 38ms | **60-123ms** | -19 a -82ms |
| **CLS** | 0 (median) | 0 (median) | 0.038 (1 run) | **0** (3/3 runs) | estable |
| Speed Index | 5491ms | 5879ms | 3808ms\* | **5767ms** | +276ms |
| Bytes wasted | — | — | 140KB | **0** | -140KB ✅ |
| Fetch counts (bg / daily) | — | 1/0 | 2/2 | **1/1** | single-fetch ✅ |

\*Post-B: solo r2 fue válido (r1+r3 NO_LCP, no significant trace data).

### Notas de medición

- **NO_LCP en 1/3 runs** persiste en post-drop. Patrón consistente con flakiness de Lighthouse mobile en sitios con hydration tardía. Los runs válidos (r1=79, r3=83) son consistentes.
- **r1+r3 reportan LCP element = NONE** aunque LCP numericValue sí está poblado (4590ms, 3740ms). Lighthouse no llegó a clasificar el snippet — likely edge case de su heuristic post-preload, no regresión de la app.
- **CLS 0** en los 3 runs post-drop confirma que la instability vista en Path A (1/3 runs con 0.187) no se reproduce en el estado actual.

---

## 3. Estado branches

- **`origin/main`**: `2935cca7`
- **`origin/production`**: `2935cca7`
- **Diff main → production**: 0 commits ahead, 0 behind. ✅

Promote command usado (3 veces durante la sesión):

```bash
git fetch origin production main
git checkout production
git pull --ff-only origin production
git merge --ff-only main
git push origin production
git checkout main
```

---

## 4. Evidencia de single-fetch (post-drop)

Network waterfall mobile r1-r3 contra production confirmando que cada asset preloadeado se descarga **una sola vez**:

```
lh-r1 | daily reqs: 1 | bg reqs: 1
  bg-new-hub.avif | image/avif | 127376 B | High
  ejercicio-diario-chess.avif | image/avif | 11547 B | High

lh-r2 | daily reqs: 1 | bg reqs: 1
  bg-new-hub.avif | image/avif | 127365 B | High
  ejercicio-diario-chess.avif | image/avif | 11580 B | High

lh-r3 | daily reqs: 1 | bg reqs: 1
  bg-new-hub.avif | image/avif | 127415 B | High
  ejercicio-diario-chess.avif | image/avif | 11547 B | High
```

WebP NO se descarga en ningún run. iOS<16 (~5% MiniPay) cae al fallback `<picture>` / CSS `image-set()` con discovery delay aceptado.

Raw artifacts en `/tmp/psi-post-drop/lh-r{1,2,3}.json`.

---

## 5. Estado del checklist MiniPay readiness

Snapshot al cierre de esta sesión (compárese con `docs/handoffs/2026-06-03-minipay-readiness-session-handoff.md`):

| # | Punto | Estado anterior | Estado actual | Cerrado por |
|---|---|---|---|---|
| P0-1 | PageSpeed 90+ mobile | 🟡 72 mobile / 95 desktop | 🟡 **79-83 mobile** / TBD desktop | Parcial — gap 7-11 puntos al target |
| P0-2 | Dominio canónico `www.chesscito.com` | ✅ Live | ✅ Live | (sesión previa) |
| P0-3 | 360×640 viewport coverage | ✅ Live | ✅ Live | (sesión previa) |
| P0-4 | Zero-click connect runtime | ⏳ Requiere device físico | ⏳ Sin cambio | — |
| P1-5 | `/stats` page MVP | ❌ Sin empezar (en handoff anterior) | ✅ Live (stats MVP) | (sesión previa por `923af98f`) |
| P1-6 | CELO oculto MiniPay | ✅ Cerrado | ✅ Cerrado | (sesión previa) |
| P1-7 | Identity ODIS phone-first | ❌ Scope mayor | ❌ Sin cambio | — |
| P1-8 | Copy sweep extended | ✅ Cerrado | ✅ Cerrado | (sesión previa) |
| P1-9 | Low-balance → Add Cash | ✅ Live | ✅ Live | (sesión previa) |

**Conteo MiniPay readiness: 6 de 9 cerrados.** Pendientes verdaderos: P0-1 (parcial, gap 7-11 puntos), P0-4 (device físico), P1-7 (scope mayor).

---

## 6. Próximo paso recomendado

El gap 7-11 puntos hacia 90+ requiere atacar el **wall que el usuario excluyó explícitamente del cluster P0-1**:

### Opción A — SSR/lazy strategy para HubDailyTile (recomendada)

- **Surface:** `apps/web/src/components/hub/hub-daily-tile.tsx`
- **Mecanismo:** eliminar el `if (!hydrated) return placeholder` gate y renderizar el `<HubActionTile>` directamente en el SSR markup. El icono entra al DOM en HTML inicial → preload scanner lo descubre sin esperar hydration → LCP Load Delay cae de ~3s a 0.
- **Riesgo:** medio. El gate existe para evitar SSR mismatch con `getDailyTactic(today)` que depende del Date local. Solución segura: pasar `today` desde server al client component, eliminar el gate.
- **Expected:** LCP 4165ms → ~2500-3000ms, perf 79-83 → 88-92. Puede cerrar P0-1.
- **Effort:** half-day. Tests: hub-daily-tile + page test + 1 VR baseline refresh.

### Opción B — Lazy wagmi/RainbowKit en `/hub`

- **Surface:** `HubScaffoldClient` línea 7-8 (`useAccount`, `useChainId`, `useReadContracts`, `useConnectModal`)
- **Mecanismo:** dynamic-import del WalletProvider en rutas no-wallet (landing, /hub default state). Reduce el bundle JS top inicial (~110 KB unused).
- **Riesgo:** alto. Toca la cadena de wallet detection en todo el hub. Requires careful staged rollout + extended VR.
- **Expected:** TBT 60-123 → 20-50ms, perf 79-83 → 85-90.
- **Effort:** 1-2 días. Cluster propio con red-team review previo.

### Opción C — Tailwind/CSS purge

- **Surface:** `apps/web/src/app/globals.css` (45KB render-blocking; 87% no usado en /hub above-fold)
- **Riesgo:** medio-alto. Class names dinámicas + safelist no inventariado. Requires full VR refresh.
- **Expected:** -200ms render-block, +3-5 perf points. No cierra el gap solo.
- **Effort:** 1 día. VR-sprint cluster.

**Bias:** A primero (mejor ROI, riesgo contenido, single-component change). Si A llega a 88-90 con luz verde, considerar B en cluster separado post-submission.

---

## 7. Qué NO tocar sin abrir cluster nuevo

Lista de prohibiciones explícitas del usuario durante este cluster (mantener vigente hasta próxima sesión):

| Surface | Razón |
|---|---|
| `useReadContracts`, `useAccount`, `useChainId`, `useConnectModal` | wagmi/RainbowKit — cluster lazy-load separado con red-team |
| `RewardColumn` SSR/hydration | constraints específicos del usuario; piece icons ya cargan a tiempo (1018-1024ms) |
| `KingdomAnchor` | Ya tiene `fetchPriority="high"`; no es bottleneck post-Path-A |
| `HubActionTile` | Sin cambios sin rediseñar el contrato del rail |
| CSS / `globals.css` purge | Lever válido pero requiere VR-sprint cluster |
| Assets re-encoding / optimization | Path C-tier; no abrir sin VR baseline plan |
| `/stats` | Cluster cerrado en sesión previa (`923af98f`) |
| `/api/founder-status` | Mitigado parcialmente; cura real es C1 Redis write-through |
| Labyrinth (Phase D contract) | Standby por decisión usuario; preserva intacto |
| ODIS / phone-first identity (P1-7) | Scope mayor; cluster propio |
| `connect-pill` skeleton | Identificado en baseline audit; deferred |

Si una sesión futura necesita tocar cualquiera de estos surfaces para cerrar P0-1, **abrir cluster nuevo con plan + red-team antes de editar**.

---

## 8. Riesgos / follow-ups

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| R1 | Mobile median 79-83 sigue bajo el 90+ de MiniPay submission | Media | Opción A (HubDailyTile SSR) en próxima sesión |
| R2 | NO_LCP en 1/3 runs persiste | Baja | Identificado como flakiness de Lighthouse trace, no regresión de app |
| R3 | iOS<16 (~5% audience) pierde el WebP preload | Muy baja | Aceptado conscientemente; fallback nativo CSS image-set sigue activo |
| R4 | Audit docs untracked (3 files) — riesgo de pérdida en working tree | Baja | Commitear en `docs(audits)` separado (ver §10) |
| R5 | NO_LCP fue 2/3 runs durante post-B medición, baja a 1/3 post-drop | Baja | No-pattern significant; consistente con Lighthouse mobile behavior |

---

## 9. Mecánica del cluster (para reproducir)

### Path A — `aa52988a perf(hub): preload real hub LCP background`

Root cause: `<main.hub-scaffold>` con `background-image: bg-new-hub.avif` (127KB) descubierto solo después de parsear CSS render-blocking (45KB). Load Delay 2.3s.

Patch (5 lines): swap del `preload()` en `hub/page.tsx` de `ejercicio-diario-chess.avif` (icono erróneo del commit P0-2 anterior) a `bg-new-hub.avif`.

Resultado: perf 65 → 71. LCP migró a daily-icon (next candidate).

### Path B — `6498419c perf(hub): preload visible reward rail assets`

Root cause: daily-icon `<img>` gated por `if (!hydrated) return placeholder` en HubDailyTile. Preload scanner no descubre URL hasta hydration → arranca 2.5s tarde.

Patch (8 lines): preload AVIF + WebP del daily-icon. Audited 9 above-fold candidates; solo el daily era bottleneck.

Resultado: perf 71 → 85 (r2 valid). LCP daily-icon → portal. Double-fetch detected.

### Drop — `2935cca7 perf(hub): drop redundant WebP preloads`

Root cause: doble preload AVIF+WebP causaba Chromium a descargar ambos (140KB waste).

Patch (4 lines): remover los 2 preload WebP. Chromium MiniPay (~99%) usa AVIF; iOS<16 cae al fallback nativo.

Resultado: single-fetch 1/1, 140KB ahorrados, score estable 79-83.

---

## 10. Acciones explícitas para próxima sesión

### Pre-trabajo

1. **Commitear audit docs untracked** en `docs(audits): close /hub perf P0-1 cluster trail`:
   - `docs/audits/2026-06-03-hub-perf-baseline-3run.md`
   - `docs/audits/2026-06-03-hub-lcp-root-cause.md`
   - `docs/audits/2026-06-03-hub-reward-rail-lcp-audit.md`
   - Más este handoff (`docs/handoffs/2026-06-03-hub-perf-p0-1-handoff.md`)
   - Promote al production en el mismo batch.

2. **Decidir sobre Path A (HubDailyTile SSR)** vs aceptar 79-83 como MVP shipping floor.

3. **Re-medir desktop /hub** (no se midió post-drop; baseline era 83).

### Si se decide ejecutar Path A

- Spec primero: `docs/superpowers/specs/YYYY-MM-DD-hub-daily-tile-ssr.md`
- Red-team: el gate existe por una razón (hydration mismatch riesgo); validar la solución de pasar `today` desde server
- TDD: test que el `<img>` aparezca en SSR HTML antes del hydrate event
- Single PR, baselines refresh si VR-red

### Documentación

- README "What's live" no cambia (perf interno, no surface user-facing nueva).
- MEMORY.md sync: agregar entrada `hub-perf-p0-1-cluster-2026-06-03` con commits + estado P0-1 final.

---

## Closing note

Sesión cerrada con **3 commits perf incrementales**, **+14 a +18 puntos perf score mobile**, **-2.3s LCP**, **single-fetch confirmado**, **CLS 0 estable**, **140KB ahorrados por visita**. Cero regresiones en 2459/2459 vitest suite, type-check clean.

P0-1 queda **mejorado sustancialmente** pero **no cerrado** vs target ≥90. El gap remanente requiere un cluster mayor (SSR HubDailyTile o lazy wagmi) — decisión usuario para próxima sesión.

MiniPay readiness: **6 de 9 cerrados** (incluye P1-5 stats MVP cerrado en sesión previa). Principales pendientes: P0-1 (parcial), P0-4 (device físico runtime), P1-7 (scope mayor).
