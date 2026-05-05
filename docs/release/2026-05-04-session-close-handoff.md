# Session-close handoff — Stories 1.12 final + 1.12.1 + 1.13 + prod hotfixes

- **Fecha**: 2026-05-04
- **Owner**: Wolfcito
- **Branch**: `main`. **18 commits landed** sobre `502e8e3` (`6bf1f6c` → `59b76ad`). Todo pushed a `origin/main`. Working tree limpio al cierre.
- **Tareas en sesión**: 24 (límite recomendado 30).

---

## 1. Estado final

### Stories cerradas

- ✅ **Story 1.12.1** — data wiring del scaffold (`<HubScaffoldClient>`).
- ✅ **Story 1.12 final** — flag flip: `/hub` default ahora renderiza scaffold; `?legacy=1` para `<PlayHubRoot>`.
- ✅ **Story 1.13** — telemetría en scaffold (8 eventos sobre `@/lib/telemetry`).

### Hotfixes (post-deploy feedback del owner)

- ✅ **P0** — `?piece=queen|king` crasheaba el board (EXERCISES vacío). Validación en `pageHasExercises()` + scaffold dropa `&piece=` defensivamente.
- ✅ **P0** — `/trophies` route no existe (removida en `9c907f6`). Trophy chip ahora delega a `?legacy=1&action=trophies`.
- ✅ **P0** — `/api/pro/status` 403 después de ~5 navegaciones por minuto. Nuevo `enforceReadRateLimit` (60/IP/60s) sobre prefix Redis separado.
- ✅ **P1** — sheet close en legacy ahora hace bounce automático a `/hub` (scaffold), eliminando el back-button extra.
- ✅ **P2** — connect chip en HUD top para desktop sin wallet (MiniPay auto-conecta solo).

### Métricas

- ✅ **779/779 unit tests passing** (+57 netos sobre baseline 722 al inicio de la sesión).
- ✅ **`tsc --noEmit`**: exit 0.
- ✅ **Visual regression**: 2/3 (baseline match con `?legacy=1` redirect; 1 flaky pre-existente desde `858a52a`).
- ✅ **Smoke prod**: `/hub`, `/hub?legacy=1`, `/hub?legacy=1&piece=*`, `/hub?legacy=1&action=*`, `/hub?hub=new` — todos 200.

---

## 2. Commits en orden cronológico

| # | Hash | Subject |
|---|------|---------|
| 1 | `6bf1f6c` | feat(hub): deriveRewardTiles pure util |
| 2 | `ad3421d` | feat(hub): HubScaffoldClient — on-chain + PRO wiring |
| 3 | `cda26e2` | feat(hub): wire HubScaffoldClient into ?hub=new |
| 4 | `3ce9687` | docs: handoff for 1.12.1 |
| 5 | `aaf24ce` | feat(hud): tap handlers on secondary-row chips |
| 6 | `942a836` | feat(hub): shields chip + monetization routing |
| 7 | `3fc78d8` | feat(play-hub): URL seed props |
| 8 | `a8eab0a` | feat(hub): flip /hub default to scaffold |
| 9 | `e9f1df2` | test(e2e): point legacy baselines to ?legacy=1 |
| 10 | `6c710d8` | docs: handoff for 1.12 final |
| 11 | `b535c47` | fix(test): drop unsupported eslint disable (build fix) |
| 12 | `b675926` | fix(hub): drop ?piece= for queen/king crash |
| 13 | `5ffd910` | fix(play-hub): bounce on sheet close |
| 14 | `28ba232` | fix(hub): trophy chip routes via legacy |
| 15 | `018585f` | feat(hub): connect-wallet chip (desktop fallback) |
| 16 | `5128a81` | feat(hub): telemetry events (Story 1.13) |
| 17 | `2b80b44` | docs: handoff for 1.13 |
| 18 | `59b76ad` | fix(api): bump read-only rate limit (60/IP/60s) |

---

## 3. Decisiones que vale recordar

1. **Delegate-to-legacy via deep-link, no host sheets en scaffold (v1)**. ProSheet/ShopSheet tienen flujos on-chain pesados; portarlos al scaffold es Story 1.15+ tras telemetría. Por ahora todo lo monetizable rutea a `/hub?legacy=1&action=…[&piece=…]`, y el deep-link bounce devuelve al scaffold.
2. **Shields chip = primary monetization surface**. Always visible (incluso "Shield ×0"). Hipótesis del sprint validable solo con telemetría.
3. **Auto-promotion de pieces sin ejercicios** vía `pieceHasExercises()` predicate. Cuando queen/king (PR-6/PR-9) lleguen, no hace falta editar page.tsx.
4. **`enforceReadRateLimit` = nuevo limiter separado**, no patch del strict. Signing endpoints mantienen 5/min/IP (sensible by design); read-only se libera a 60/min/IP.
5. **Server component en `/hub` page**, no `useSearchParams`. Mantiene el legacy default zero-overhead y evita fully-client bailout que rompía e2e timing en sesión anterior.
6. **Telemetría antes del side-effect**. Cada handler ejecuta `track()` antes de `router.push` o `openConnectModal`. `keepalive: true` cubre el unload race.

---

## 4. Pendientes inmediatos (orden de prioridad)

### 4.1 Validar telemetría escribe a Supabase

- DevTools → Network → filter "telemetry".
- Refresh `/hub` → 1 POST `hub_view` esperado.
- Tap chips → POSTs `hub_*_tap` con dims correctos.
- En Supabase: `SELECT * FROM analytics_events WHERE event LIKE 'hub_%' ORDER BY created_at DESC LIMIT 20`.

**Si no se ven**: revisar Vercel env vars de Supabase + RLS de `analytics_events` table.

### 4.2 Habilitar Vercel Web Analytics

- Console reporta 404 en `/684266321c090098/script.js`.
- No es bug de código — solo toggle en Vercel project settings → Analytics.
- Independiente de nuestra telemetría custom (que va a Supabase).

### 4.3 Story B — Asset audit + visual polish

- Owner indicó "harán falta algunos assets" pero sin lista concreta.
- Próxima sesión: pedir lista específica de assets faltantes, hacer batch.

### 4.4 Story C — Migrar `/arena` selecting state al patrón scaffold

- Aplicar `<KingdomAnchor variant="arena-preview">` + `<PrimaryPlayCta surface="arena-entry">` + `<MissionRibbon surface="arena">` en la pantalla de selección de Arena.
- Patrón ya validado en `/hub` — copy-paste con adaptaciones de copy/destinos.

### 4.5 Story D — Portar ShopSheet + ProSheet al scaffold

- **Bloqueado por telemetría**: necesitamos ≥ 50 sesiones únicas + ≥ 1 día de datos para decidir si la friction de route nav justifica el costo del port.
- Hipótesis a validar: `hub_shields_chip_tap` debe correlacionar con shop conversions on-chain.

---

## 5. No hacer todavía

- ❌ **No optimizar (portar sheets) sin datos** — variance dominará bajo 50 sesiones.
- ❌ **No re-baseline visual del scaffold** hasta validación física en MiniPay y posible iteración rápida de layout.
- ❌ **No tocar `play-hub-root.tsx` fuera de scope de migración** — sigue siendo el host de mutaciones on-chain.
- ❌ **No emitir wallet/PII en telemetry dims** — la infra es anónima por diseño.

---

## 6. Riesgos conocidos

| Riesgo | Mitigación / nota |
|--------|-------------------|
| Sheet animation accumulation tras 2-3 ciclos scaffold↔legacy | Identificado por owner. Defer a Story D (port sheets locales). |
| Vercel Analytics 404 | No es bug; toggle Web Analytics en project settings. |
| `hub-shop-sheet-open` flaky pre-existente (`858a52a`) | Pre-dates el sprint. No bloqueante. Investigar antes de expandir suite visual. |
| Quality cliff cerca de task 30/sesión | Estamos en 24/30. Cerrar limpio aquí es correcto. |
| MiniPay back-button behavior | Validado funcional via deep-link bounce; reportable si user encuentra edge case. |

---

## 7. Setup para próxima sesión

1. **Verificar telemetría**: `https://chesscito.vercel.app/hub` con DevTools, confirmar `POST /api/telemetry` con `event: "hub_view"`.
2. **Comenzar B**: pedir al owner lista de assets faltantes en scaffold.
3. **Threshold para D**: cuando `hub_shields_chip_tap` tenga ≥ 50 hits acumulados, agendar port de ShopSheet local.

---

## 8. Referencias

- **Stack scaffold**: `apps/web/src/components/hub/hub-scaffold.tsx`, `hub-scaffold-client.tsx`.
- **Util pura**: `apps/web/src/lib/hub/derive-reward-tiles.ts` (Story 1.12.1).
- **Page**: `apps/web/src/app/hub/page.tsx` (server, flag flip).
- **Legacy host**: `apps/web/src/components/play-hub/play-hub-root.tsx` (props `initialPiece`, `initialAction` + bounce effect).
- **Rate limit**: `apps/web/src/lib/server/demo-signing.ts` (`enforceReadRateLimit`).
- **Telemetría**: `apps/web/src/lib/telemetry.ts` (existing infra, reusada).
- **Handoffs anteriores en esta sesión**:
  - `2026-05-04-hub-scaffold-data-wiring-handoff.md` (1.12.1)
  - `2026-05-04-hub-flag-flip-handoff.md` (1.12 final)
  - `2026-05-04-hub-telemetry-handoff.md` (1.13)

---

**Fin de sesión.** Próxima: validación de telemetría + Story B (asset audit con input visual del owner).
