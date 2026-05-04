# Hub flag flip + monetization-aware wiring (Story 1.12 final) — handoff

- **Fecha**: 2026-05-04
- **Owner**: Wolfcito
- **Branch**: `main`. 5 commits landed (`aaf24ce` → `e9f1df2`). Working tree limpio al cierre (handoff doc pendiente de commit).

---

## 1. Estado final

- ✅ **Story 1.12 final cerrada**: `/hub` default ahora renderiza el Game Home scaffold; `<PlayHubRoot>` legacy queda accesible via `/hub?legacy=1`.
- ✅ **Shields chip visible** en el scaffold (HUD secondary row, lee `chesscito:shields` localStorage). Es la home de conversión al shop, siempre visible.
- ✅ **Delegación monetization-first** del scaffold a legacy via deep links:
  - PRO chip / Premium slot → `/hub?legacy=1&action=pro`
  - Shields chip → `/hub?legacy=1&action=shop`
  - Reward tile → `/hub?legacy=1&piece=X&action=badges`
  - PLAY → `/hub?legacy=1`
  - Trophy → `/trophies` (sin legacy)
- ✅ **Commits atómicos**:
  - `aaf24ce` — `<HudSecondaryRow>` tap handlers + `<HubScaffold>` prop forwarding (5 tests).
  - `942a836` — `<HubScaffoldClient>` shields read + monetization routing (5 tests).
  - `3fc78d8` — `<PlayHubRoot>` URL seed props (`initialPiece`, `initialAction`).
  - `a8eab0a` — Flag flip en `apps/web/src/app/hub/page.tsx` + 11 page tests.
  - `e9f1df2` — `e2e/visual-regression.spec.ts` apunta a `?legacy=1` para preservar baselines.
- ✅ **Test suite verde**: 765/765 unit tests passing (+21 netos vs baseline 744).
- ✅ **Type-check clean**: `tsc --noEmit` exit 0.
- ✅ **Smoke**: 7 URLs probadas con curl, todas → 200:
  - `/hub` (scaffold default)
  - `/hub?legacy=1`, `/hub?legacy=1&piece=bishop`
  - `/hub?legacy=1&action=shop|pro|badges&piece=knight`
  - `/hub?hub=new` (canary alias preserved)
- ⚠️ **Visual regression**: 2/3 passing — baseline match. `hub-shop-sheet-open` flaky pre-existente desde `858a52a` (no introducido por este sprint).

---

## 2. Decisiones tomadas

1. **Delegación-a-legacy en lugar de hospedar sheets en scaffold**. ProSheet tiene 14+ props con flujo on-chain pesado (purchase + verify + retry + connect + switch). Hospedarlo en scaffold significa portar `useWriteContract`, `useConnectModal`, `useSwitchChain`, transaction confirms, telemetría — scope medio-alto. Delegar via route push es 1 línea, mantiene el flujo completo en un único componente, y evita drift entre dos hosts. Trade-off aceptado: friction de route nav. **Plan de salida**: telemetría en cada delegate-tap; cuando los datos confirmen tap-rate decente, portar el sheet específico al scaffold (Story posterior).

2. **Shields chip = primary monetization surface en home**. La directiva del owner: "el lugar donde pueden hacer tx debe estar a la vista — es nuestro punto más grande de conversion y monetización". Por eso el scaffold ahora siempre muestra "Shield ×N" (incluso N=0). Un chip de "Shield ×0" actúa como recordatorio fuerte de replenishment — funciona como Clash Royale's "Out of stock" badges. El comportamiento depleted-as-strongest-cue está cubierto por test explícito.

3. **`?legacy=1` no `?hub=legacy`**. Más conciso, alinea con el patrón "boolean-like flag" usado en otras canaries del repo.

4. **`?hub=new` queda como alias del default scaffold** (cero handler especial). Bookmarks de la era preview que usuarios MiniPay puedan tener guardados siguen aterrizando en el scaffold. No-op cost.

5. **Validación de `?piece` y `?action` en server component**. La whitelist `VALID_PIECES` + `VALID_ACTIONS` rechaza valores arbitrarios silenciosamente — hardening contra deep-link abuse y typo-resilience. Test cubre `?piece=dragon` → cae a `undefined`, `?action=trophies` → cae a `undefined`.

6. **Server component sigue sin `useSearchParams`**. Un click-driven render en cliente bailout-éa al render fully-client del root, rompiendo timing del e2e (problema documentado en handoff anterior §2.4). Mantenemos lectura via props.

7. **`<HudSecondaryRow>` tap handlers son opt-in**. Si el caller no provee `onShieldsTap`, el chip sigue siendo `role="status"` (no clickable). Sin breaking change para legacy o futuros callers.

8. **Visual regression spec actualizado en commit aparte** (`e9f1df2`) para mantener historia limpia: el flag flip está en `a8eab0a`, el follow-up de e2e en su propio commit. Bisect-friendly.

---

## 3. Verificación

- ✅ `pnpm test`: **765/765 passing** (+21 netos: 5 HudSecondaryRow taps + 5 HubScaffoldClient + 11 page tests).
- ✅ `pnpm tsc --noEmit`: exit 0.
- ✅ `pnpm next lint`: 0 warnings nuevos en archivos tocados (warning pre-existente en `play-hub-root.tsx:381` no introducido por este sprint).
- ✅ Secret scan: limpio en cada commit.
- ✅ Smoke `pnpm dev`:
  - `GET /hub` → 200, HTML contiene `class="hub-scaffold`, "Trophies: 0", "Start training", "0 retry shields available".
  - `GET /hub?legacy=1` → 200, HTML contiene `playhub-board-canvas` (legacy mounted).
  - 5 variantes de query strings → todas 200.
- ⚠️ `pnpm test:e2e:visual`: 2/3 passing — baseline match con `?legacy=1` redirect. `hub-shop-sheet-open` flaky pre-existente.

---

## 4. Pendientes inmediatos

### 4.1 Validación en MiniPay físico

- **Sin esto, el flag flip no debería ir a producción**. Probar en MiniPay con:
  - Wallet desconectado (estado más común para usuarios anónimos).
  - Wallet conectado con 0 trophies.
  - Wallet conectado con N trophies (N=1, N=3, N=6).
  - PRO activo / inactivo / próximo a expirar.
  - Shields >0 / =0.
- Verificar específicamente:
  - Tap del shields chip → llega al ShopSheet en legacy.
  - Tap del PRO chip activo → llega al ProSheet en legacy.
  - Reward tile tap → BadgeSheet abre con la pieza correcta.
  - Back-button del browser regresa al scaffold sin reload completo.

### 4.2 Telemetría (Story 1.13)

Eventos a wirear en `<HubScaffoldClient>`:
- `kingdom_anchor_viewed` (KingdomAnchor render).
- `mission_ribbon_viewed` (MissionRibbon render).
- `primary_cta_clicked` (PLAY tap).
- `premium_slot_tapped`.
- `pro_chip_tapped` (active vs inactive como dimension).
- **`shields_chip_tapped`** ← key conversion event para validar la hipótesis de monetization-as-default.
- `reward_tile_tapped` (con `piece` + `state` como dimensions).

El sentido: la conversion-from-shields-tap es el supuesto central del flag flip. Sin telemetría, no podemos cerrar el loop ni decidir el porte del ShopSheet al scaffold.

### 4.3 Re-baseline visual del scaffold

- Cuando layout esté validado en MiniPay físico, agregar `hub-scaffold-clean.png` baseline al e2e.
- Posibles baselines adicionales: `hub-scaffold-pro-active.png`, `hub-scaffold-shields-empty.png`.

### 4.4 Investigar `hub-shop-sheet-open` flaky

- Pre-existente desde `858a52a` (handoff §4.2). No bloquea ship pero conviene resolver antes de ampliar la suite visual al scaffold.

### 4.5 Optimización post-telemetría

- Si telemetría muestra tap-rate alto en shields chip + PRO chip, **portar `<ShopSheet>` y `<ProSheet>` a hospedaje local en scaffold** (eliminar route nav, reduce friction). Story 1.15+.

---

## 5. No hacer todavía

- ❌ **No hospedar sheets pesadas en scaffold** sin datos de telemetría. La friction de route nav es aceptable hasta que sepamos cuántos taps/min están en juego.
- ❌ **No re-baseline visual del scaffold** hasta validación física + posible iteración rápida de layout.
- ❌ **No expandir el dock del scaffold**. La directiva: shields = primary monetization surface, PRO chip + reward tiles = secundarios. Más entries diluyen el foco.
- ❌ **No tocar `play-hub-root.tsx` fuera de scope de migración**. Sigue siendo el host de mutaciones on-chain.

---

## 6. Riesgos conocidos

1. **Pérdida temporal de "Free Play" entry desde `/hub`**. La tab "Arena" del dock legacy NO está en el scaffold. Mitigación: `/arena` es una ruta directa accesible desde el menú principal o bookmarks.
2. **Pérdida temporal de "Leaderboard" entry desde `/hub`**. Misma situación: `/leaderboard` route directa.
3. **Pérdida temporal de "Invite" entry desde `/hub`**. Sin ruta directa actualmente — es una funcionalidad puramente del dock legacy. Si tap-rate de invite es relevante, surface alternativo en scaffold (e.g. share button en HUD top-right).
4. **MiniPay back-button**: depende de que el browser/MiniPay maneje correctamente la navegación scaffold → legacy → scaffold. Sin validar en físico.

---

## 7. Referencias clave

- Util: `apps/web/src/lib/hub/derive-reward-tiles.ts` (Story 1.12.1, sin cambios).
- Cliente: `apps/web/src/components/hub/hub-scaffold-client.tsx` — añadidos `shieldCount`, `loadShieldCount()`, `legacyHubFor()`, monetization routing.
- Primitiva: `apps/web/src/components/hud/hud-secondary-row.tsx` — `onStreakTap`, `onStarsTap`, `onShieldsTap` opcionales.
- Composición: `apps/web/src/components/hub/hub-scaffold.tsx` — forwarding de los 3 tap handlers a `<HudSecondaryRow>`.
- Legacy host: `apps/web/src/components/play-hub/play-hub-root.tsx` — `PlayHubRootProps` exportado, `PlayHubInitialAction` type exportado.
- Page: `apps/web/src/app/hub/page.tsx` — flag flip + whitelist validation.
- Tests: `apps/web/src/app/hub/__tests__/page.test.tsx` (nuevos), `hub-scaffold-client.test.tsx` (5 nuevos), `hud-secondary-row.test.tsx` (5 nuevos).
- Handoffs: `2026-05-04-arena-primitives-and-hub-scaffold-handoff.md` (Story 1.12 scaffold), `2026-05-04-hub-scaffold-data-wiring-handoff.md` (Story 1.12.1).
- Epic: `_bmad-output/planning-artifacts/epics.md` Story 1.12.

---

**Fin del handoff.** Próxima sesión: telemetría (1.13) + validación MiniPay físico (1.14). Las dos juntas desbloquean (a) baselining visual del scaffold, y (b) decisión basada en datos de portar sheets pesadas al scaffold.
