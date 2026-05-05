# Hub scaffold telemetry (Story 1.13) — handoff

- **Fecha**: 2026-05-04
- **Owner**: Wolfcito
- **Branch**: `main`. 1 commit landed (`5128a81`). Working tree limpio al cierre (handoff doc pendiente de commit).

---

## 1. Estado final

- ✅ **Story 1.13 cerrada** — eventos de telemetría wireados en `<HubScaffoldClient>`, reutilizando la infra existente (`@/lib/telemetry` → `/api/telemetry` → Supabase).
- ✅ **8 nuevos tests** — 779/779 unit tests passing (+8 vs baseline 771).
- ✅ **Type-check clean**: `tsc --noEmit` exit 0.
- ✅ **Sin cambios visuales** — telemetría es 100% pura side-effect.

---

## 2. Eventos emitidos

| Event | Dims | Cuándo dispara |
|-------|------|----------------|
| `hub_view` | — | Una vez por mount. Ancla el funnel. |
| `hub_trophy_tap` | `count` | Tap del trophy chip (HUD top). Dim = trofeos visibles al momento del tap. |
| `hub_pro_chip_tap` | `pro_active: boolean` | Tap del PRO chip cuando activo (cuando inactivo el chip colapsa). |
| `hub_premium_slot_tap` | `pro_active: boolean` | Tap del slot premium derecho (PRO upgrade entry para inactive). |
| **`hub_shields_chip_tap`** | `shield_count: number` | **KEY conversion event** — valida la hipótesis monetization-as-default del scaffold. |
| `hub_play_tap` | — | Tap del PLAY CTA dominante. |
| `hub_connect_chip_tap` | — | Tap del connect chip (desktop sin wallet). Dispara *antes* de `openConnectModal()` (test asserts el orden). |
| `hub_reward_tile_tap` | `piece, state` | Tap de cualquier tile de la reward column. `state ∈ {claimable, progress, locked}`. |

---

## 3. Decisiones tomadas

1. **Reuse de `@/lib/telemetry`, no nueva infra**. El `track()` existente cubre lo necesario: fire-and-forget, throttled (100/5min/event), session id anónimo en localStorage, SSR-safe. No hay razón de bundlear otro endpoint.

2. **Naming pattern: `hub_<element>_<action>`** alineado con la convención del repo (`share_tile_tap`, `coach_buy_tx`, `victory_claim_tx`, `arena_game_start`). Permite filtros simples por prefix `hub_` en queries de Supabase.

3. **Dim `pro_active` en pro_chip_tap y premium_slot_tap** — discriminar active vs inactive sin separar eventos. Permite calcular conversion rates "PRO inactive → tapped premium → bought" en una sola query.

4. **Dim `shield_count` carried en shields chip tap** — prueba si la depleción correlaciona con tap-rate. Hipótesis: `shield_count = 0` debería tener tap-rate ≥ 2× vs `shield_count > 0`.

5. **Telemetría **antes** del side-effect**. Cada handler hace `track()` *antes* de `router.push` o `openConnectModal`. Garantiza que aún si el navegador unloads inmediato (typical en route nav rápido), `keepalive: true` del fetch deja viajar el evento.

6. **Tests asertan order via `mock.invocationCallOrder`** para `hub_connect_chip_tap` — la única donde el orden track-before-effect es semánticamente importante (los demás taps van a route nav que keepalive cubre, pero el modal-open dispara sin keepalive).

7. **Sin `hub_view` en cada page-mount cycle**. Empty deps en `useEffect` + `track` con throttling natural cubre re-mounts (escenarios edge); no agregamos beacon por route change porque scaffold solo se renderiza en `/hub`.

---

## 4. Verificación

- ✅ `pnpm test`: **779/779 passing** (+8 netos: hub_view, trophy, pro chip, premium slot, shields, play, connect, reward tile).
- ✅ `pnpm tsc --noEmit`: exit 0.
- ✅ Visual regression: sin impacto (zero render change).
- ✅ Secret scan: limpio.

---

## 5. Pendientes inmediatos

### 5.1 Validar pipeline en producción

Una vez Vercel publique, abrir DevTools → Network → filter "telemetry":
1. Refresh `/hub` → debería verse 1 POST `hub_view`.
2. Tap shields chip → POST `hub_shields_chip_tap` con `props.shield_count`.
3. Tap PRO chip activo → POST `hub_pro_chip_tap` con `props.pro_active=true`.
4. Tap reward tile → POST `hub_reward_tile_tap` con `props.piece` + `props.state`.

Luego verificar en Supabase (`SELECT * FROM analytics_events WHERE event LIKE 'hub_%' ORDER BY created_at DESC LIMIT 20`).

### 5.2 Dashboard

Para que la telemetría sea útil, hace falta un dashboard mínimo que answere:
- **`hub_view → hub_play_tap` rate** (PLAY conversion del scaffold).
- **`hub_view → hub_shields_chip_tap` rate** (monetization hypothesis).
- **`hub_pro_chip_tap[pro_active=false] → /hub?legacy=1&action=pro` → on-chain PRO buy** (full PRO funnel).
- **`hub_reward_tile_tap[state=claimable]` rate** vs total reward_tile_taps.

Opciones para el dashboard:
- Supabase SQL editor + saved queries (lightweight, sin nuevo stack).
- Metabase / Grafana on Supabase (más visual).
- Vercel Analytics si activamos Web Analytics para el panel built-in.

Recomendación: empezar con saved queries en Supabase, crear Metabase si los stakeholders piden visualización.

### 5.3 Ventana de medición

- **Single-user dev period** — ahora mismo el funnel se auto-poluta (eres el único usuario). Las queries son útiles solo cuando tengamos tráfico real.
- **Threshold para decisiones**: ≥ 50 sesiones únicas + ≥ 1 día de datos antes de actuar sobre cualquier conversion rate.

---

## 6. No hacer todavía

- ❌ **No optimizar (portar sheets) basado en datos < 50 sesiones**. Variance será dominante.
- ❌ **No agregar más eventos sin usecase específico**. Cada evento es un compromiso de mantenimiento — `hub_view` + 7 taps cubre el core funnel; expandir solo cuando una pregunta concreta lo requiera.
- ❌ **No emitir wallet address ni PII en dims**. La infra es anónima por diseño (session_id es 64-bit random, sin link a wallet). Mantener.

---

## 7. Próximos pasos del plan (A → B → C → D)

- ✅ **A — Telemetría** — DONE (este handoff).
- 🔜 **B — Asset audit + visual polish del scaffold** — identificar y reemplazar assets faltantes.
- 🔜 **C — Story 2.3: `/arena` migration** — replicar patrón scaffold en arena.
- 🔜 **D — Optimization sprint** — portar `<ShopSheet>` + `<ProSheet>` locales tras telemetría inicial.

---

## 8. Referencias

- Telemetría infra: `apps/web/src/lib/telemetry.ts` (existing).
- Endpoint: `apps/web/src/app/api/telemetry/route.ts` (existing).
- Cliente: `apps/web/src/components/hub/hub-scaffold-client.tsx`.
- Tests: `apps/web/src/components/hub/__tests__/hub-scaffold-client.test.tsx` (8 nuevos).
- Handoff anterior: `docs/release/2026-05-04-hub-flag-flip-handoff.md` §4.2.

---

**Fin del handoff.** Próximo: B (asset audit + visual polish) cuando user lo pida.
