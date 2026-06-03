# /hub Perf Cluster — MiniPay Readiness Handoff

**Fecha cierre:** 2026-06-03
**Estado:** Cerrado parcialmente — objetivo MiniPay readiness cumplido. Sub-cluster perf P0-4+ diferido.
**HEAD `origin/production` final:** `6baf78193a0d10b0388a03e79528aae2c453745e`
**HEAD `origin/main` final:** `6baf78193a0d10b0388a03e79528aae2c453745e` (aligned)

---

## Resultado consolidado

PSI mobile sobre `https://www.chesscito.com/hub` antes y después del cluster:

| Métrica | Baseline | Final | Δ |
|---|---|---|---|
| Performance score | 72 | **81** | **+9** |
| LCP | n/d (baseline solo reportó share) | **4883 ms** | — (6489 → 4883 en runs intermedios = −1606 ms) |
| CLS | 0.187 | **0.00** | **−0.187** ✓ |
| TBT | n/d | 130 ms | bajo |
| FCP | n/d | 1.4 s | bueno |
| Speed Index | n/d | 2.3 s | bueno |
| Render-blocking | 290 ms | ~278 ms | sin cambio material |

Desktop quedó intacto en 95.

---

## Commits shipped (orden cronológico)

| Hash | Commit | Sub-cluster |
|---|---|---|
| `9152bc3b` | `perf(bundle): lazy-load hub sheets` | P0-1 |
| `308a7976` | `perf(hub): stabilize Pro badge image layout` | P0-1 |
| `dc5828a3` | `docs(audits): record P0-2 LCP preload outcome` | docs |
| `ea70b033` | `perf(images): prioritize hub daily tactic LCP icon` | P0-2 |
| `e3da6238` | `perf(template): hide build version chip in production` | P0-3 |
| `6baf7819` | `docs(audits): add /hub render delay P0-3 audit` | docs |
| `84b2ac9c` | `docs(audits): record /hub perf P0-1 audit and outcome` | docs |

**6 commits funcionales + 3 commits doc = 9 total.** Todos atomic, granular, conventional.

### Archivos tocados (código)

- `apps/web/src/components/hub/hub-scaffold-client.tsx` — 4 sheets → `next/dynamic({ ssr: false })`
- `apps/web/src/components/hub/hub-pro-badge.tsx` — `width={225} height={272}` en el `<img>` PRO panel
- `apps/web/src/components/hub/hub-action-tile.tsx` — props opt-in `priority`, `iconWidth`, `iconHeight`
- `apps/web/src/components/hub/hub-daily-tile.tsx` — pasa `priority` + 256×273 al `<HubActionTile>`
- `apps/web/src/app/[locale]/hub/page.tsx` — `preload()` de `react-dom` para el AVIF del Daily icon (route-scoped)
- `apps/web/src/app/[locale]/hub/__tests__/page.test.tsx` — `vi.mock` de `react-dom` `preload`
- `apps/web/src/app/[locale]/template.tsx` — chip gateado por `VERCEL_ENV !== "production"`

### Archivos NO tocados (decisión explícita)

- `apps/web/src/components/wallet-provider.tsx` — wagmi/RainbowKit imports eager intactos; MiniPay zero-click preservado
- `@rainbow-me/rainbowkit/styles.css` — sigue render-blocking, no movido
- `apps/web/src/app/globals.css` — sin split de `.arena-*`/`.coach-*` (cluster propio en backlog)
- Sin migración a `next/image` (cluster propio en backlog)
- Sin preconnects nuevos
- Cero impacto en Labyrinth / `/stats` / identity / ODIS / AddCashCta / CELO / copy

---

## Cumplimiento de las HARD RULES

- **`plan-before-edit`**: cada patch propuesto con audit + diff exacto antes de aplicar.
- **`vr-baseline-discipline`**: VR completa corrida antes del push final (39/39 green; chip preservado en VR local porque `VERCEL_ENV` undefined → no drift).
- **`granular commits`**: 1 cambio lógico por commit; doc commits separados de code commits.
- **`exact version pins`**: no se tocó `package.json`.
- **`image triplet`**: no se introdujeron assets nuevos.
- **MiniPay zero-click**: preservado por construcción (wallet-provider intacto).

---

## Lecturas críticas a no perder

1. **CLS=0 en localhost es engañoso** (Patch 2 P0-1 en local mostró 0 falso positivo). El CLS real se mide solo contra prod URL bajo throttling móvil.
2. **"Unused JS savings" de Lighthouse no captura el beneficio de `next/dynamic`** — los chunks ya no se descargan en first paint pero la métrica solo cuenta lo descargado-y-no-usado. El beneficio real vive en First Load JS (429 KB en `next build`).
3. **El LCP se mueve.** Cada patch que aceleraba el LCP candidate previo descubría uno nuevo: daily icon → BuildVersionGate → (post P0-3) elemento desconocido (LH no capturó el audit del element). Esto significa que el cuello de botella restante es estructural (hidratación / post-mount paint).
4. **El BuildVersionGate ahora vive solo en local + preview.** El comentario en `template.tsx:8-12` documenta la decisión y referencia `docs/audits/2026-06-03-hub-render-delay-audit.md`. Smoke-testers en preview siguen viendo el chip.
5. **Lighthouse TraceProcessor flakiness**: 2 de 3 runs post-P0-3 fallaron con `TypeError` en `@paulirish/trace_engine`. El run válido entregó el score 81. Si se re-mide en el futuro y falla, re-correr — no es regresión.

---

## Backlog post-MVP (NO en este sprint)

### Perf follow-ups diferidos

| Idea | Razón de diferir | Estimación |
|---|---|---|
| `perf(bundle): defer wagmi/RainbowKit init until first interaction` | Refactor grande, requiere VR completa y MiniPay smoke en device | Score esperado +3-6 |
| `refactor(images): adopt next/image across hub tree` | Cluster propio con MiniPay WebView AVIF nego testing | LCP esperado −1-2s |
| `perf(css): split arena/coach families from globals.css into route stylesheets` | 329 KB / 11.7k líneas; requiere VR completa | Unused CSS −20-30 KB |
| `perf(head): add critical preconnect hints` | Bajo ROI sin atacar hydration primero | +1-2 |
| `chore(art): generate AVIF for play-chess icon (93 KB PNG sin sibling AVIF)` | Asset-pipeline gap, bandwidth saving | LCP marginal |

### Follow-ups funcionales (sub-clusters cortos siguientes)

1. **`fix(i18n): add missing PRO_COPY.daysLeftActiveLabel`**
   - Origen: console errors capturados en smoke manual P0-2
   - Stack: `ProfileSheet (profile-sheet.tsx:373:19)` lanza `IntlError: MISSING_MESSAGE` en locale `en`
   - Impacto: UX roto en `en` para usuarios PRO activos
   - Scope esperado: `apps/web/src/lib/content/editorial.ts` o catálogo i18n `en.json` — agregar la string + verificar otros locales

2. **`perf(api): bound or cache founder-status ownership lookup`**
   - Origen: warning persistente en stdout — `SHOP_DEPLOY_BLOCK_CELO is not set. Falling back to fromBlock=earliest. Public Celo RPC providers will likely reject the unbounded range and the route will 500.`
   - Impacto: `/api/founder-status` puede timeoutear ~40s contra Forno
   - Scope esperado: agregar `SHOP_DEPLOY_BLOCK_CELO` env (~37800000 según `apps/contracts/deployments/celo.json`) + considerar caching server-side de la ownership lookup

Ambos son independientes del cluster perf, del wallet stack, y de MiniPay zero-click.

---

## Producción al cierre

- `origin/production` y `origin/main` en `6baf7819`.
- VR baselines: 39/39 green (no drift introducido).
- Tests focalizados pre-push: 237/237 (hub, shop, add-cash-cta, result-overlay, coach-paywall) + 122/122 (hub solo, runs P0-2 y P0-3).
- Type-check + lint: limpios (warnings preexistentes en arena/exercises/use-chess-game persisten, no introducidos).
- Smoke prod `/hub`: `HTTP 200 | redirect:` ✓

### Artefactos locales (NO commiteados intencionalmente)

- `apps/web/lh-patch1.json`
- `apps/web/lh-prod-mobile.json`
- `apps/web/lh-prod-post-p0-2.json`
- `apps/web/lh-prod-post-p0-3.json` (run fallido, performance score 0)
- `apps/web/lh-prod-post-p0-3-r2.json` (run válido, score 81)
- `apps/web/lh-prod-post-p0-3-r3.json` (run fallido)

Mediciones puntuales para referencia; no son contrato del proyecto. Si en el futuro hace falta un baseline JSON estable, generarlo en CI vía script + commit, no a mano.

---

## Open questions

1. ¿`/hub` necesita seguir siendo accesible vía ambos `/en/hub` y `/hub` (el 307 redirect del primero suma 380ms)? Si la decisión es deprecar `/en/hub` para evitar el redirect, podría sumar marginalmente al score. Fuera del scope perf.
2. ¿El `animate-in fade-in duration-200` en `template.tsx:11` aplicado a todas las rutas bajo `[locale]/` tiene UX value real? El audit P0-3 lo descartó como causa primaria del LCP pero queda como overhead estructural. Si la decisión es retirarlo, requiere validación visual en todas las rutas (cluster propio).
3. ¿Vale la pena fijar una versión específica de `lighthouse` en devDeps para evitar el TraceProcessor flakiness? Hoy se corre vía `npx lighthouse` que resuelve a la última.

Estas tres son preguntas para conversación, no para implementación inmediata.