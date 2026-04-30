# Chesscito PRO — Fase 0 Handoff

**Date**: 2026-04-29
**Last updated**: 2026-04-29 (post-push, post-on-chain)
**Owner**: deployer + admin wallet
**Companion docs**:
- Plan: `docs/superpowers/plans/2026-04-29-pro-phase-0.md`
- Verify-pro shape: `docs/superpowers/plans/2026-04-29-pro-phase-0-verify-shape.md`
- UI shape: `docs/superpowers/plans/2026-04-29-pro-phase-0-ui-shape.md`
- Release checklist: `docs/release/2026-04-29-pro-phase-0-checklist.md`

## Live status (2026-04-29)

| Item | Status |
|------|--------|
| Code shipped to `origin/main` | ✅ pushed (`47a9fbc..ddcacde`) |
| On-chain `setItem(6, 1_990_000, true)` | ✅ tx `0x32c1adb4...` block 65620849 |
| Vercel `NEXT_PUBLIC_ENABLE_COACH=true` | ⏳ pending |
| Deploy ready | ⏳ pending |
| Smoke test passed | ⏳ pending |
| 7-day measurement window | ⏳ starts after smoke pass |

---

## 1. Estado final

- ✅ Fase 0 PRO completa en `main` y pusheada a `origin/main`.
- ✅ 10 commits implementados (9 código + 1 handoff).
- ✅ Suite completa passing (506/506).
- ✅ Typecheck limpio.
- ✅ Visual snapshots passing (18/18) — único cambio visible es el chip PRO top-right en `/hub`.
- ✅ **On-chain registration done** — itemId 6 publicado en Celo Mainnet.
- ⚠️ **PRO todavía NO está user-visible** hasta que Vercel deploy + env flag estén ready. Sólo falta el paso operativo de Vercel + smoke (ver §3).

### Commits Fase 0

| # | Hash | Scope |
|---|------|-------|
| 1 | `648a37b` | `feat(editorial): add PRO_COPY for Chesscito PRO Phase 0` |
| 2 | `9a695da` | `feat(shop): register itemId 6 as Chesscito PRO monthly` |
| 3 | `5aa7e11` | `feat(api): add /api/verify-pro endpoint for Chesscito PRO` |
| 4 | `b824e8e` | `feat(pro): add is-active helper` |
| 5 | `9a87f2f` | `feat(coach): PRO bypasses credits in analyze` |
| 6A | `2dc4e61` | `feat(api): add GET /api/pro/status` |
| 6B.1 | `ef82f68` | `feat(pro): add ProChip + ProSheet + useProStatus` |
| 6B.2 | `304717b` | `feat(play-hub): wire PRO chip + sheet + purchase flow` |
| 7 | `16ebd6a` | `docs(release): add Chesscito PRO Phase 0 release checklist` |
| 8 | `a63c1e1` | `feat(telemetry): wire Chesscito PRO funnel events` |

---

## 2. Qué se implementó

### Producto
- SKU **Chesscito PRO** mensual, `itemId = 6`.
- Precio **$1.99** (`priceUsd6 = 1_990_000`).
- Duración **30 días** (renovación manual).
- Pago **stablecoin only** — no CELO.

### Backend
- `POST /api/verify-pro` — valida tx en Celo, decodea `ItemPurchased`, dedupe por `txHash`, extiende `coach:pro:<wallet>` con Lua atómico (max(now, currentExpiresAt) + 30d).
- `GET /api/pro/status?wallet=...` — read-only mirror de `isProActive`.
- `lib/pro/is-active.ts` — helper puro consultado server-side.
- Bypass del ledger de credits en `app/api/coach/analyze/route.ts` cuando PRO activo: skip credit read + skip `redis.decr` + emite `coach_pro_bypass_used` (console.info).

### Frontend
- `<ProChip>` floating top-right en `/play-hub` (3 estados: skeleton / GET PRO / PRO • Nd).
- `<ProSheet>` bottom sheet con perks active vs roadmap, CTA con 7 estados (Connect → Switch → Processing → Verifying → Renew → Buy → Error).
- `useProStatus(wallet)` hook con AbortController, sin polling, refetch manual tras compra.
- `executeProPurchase()` helper extraído (`lib/pro/purchase.ts`) — discriminated result `success | no-token | cancelled | timeout | verify-failed | error`.
- Wire en `play-hub-root.tsx`: 1 handler, 4 state vars, 2 mount points, sin tocar dock / MissionPanelCandy / ShopSheet / Coach UI / Arena.

### Telemetría (funnel PRO)
Eventos client-side vía `track()` → Supabase `analytics_events`. Sin wallet ni hash completo en ningún payload.

---

## 3. Release blockers

> Estos pasos no pueden hacerse desde código — los ejecuta el operador del release.

### 3.1 Vercel Production
- [ ] `NEXT_PUBLIC_ENABLE_COACH=true` en Production (y Preview si se valida primero ahí).
- [ ] Confirmar `COACH_LLM_API_KEY` set.
- [ ] Confirmar `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` set.
- [ ] Confirmar `NEXT_PUBLIC_SHOP_ADDRESS` apunta al Shop proxy de Celo Mainnet.

### 3.2 Celo Mainnet — ✅ DONE 2026-04-29
- [x] Admin wallet ejecutó:
  ```
  pnpm admin shop set-item --item-id 6 --price-usd6 1990000 --enabled true --chain celo
  ```
- [x] tx: `0x32c1adb4ebf6a10f13843bf51333e2c09753d797eab83a97ad566cefb074162c`
- [x] block: 65620849
- [x] `pnpm admin shop get-item --item-id 6 --chain celo` confirmó `(1990000, true)`.

### 3.3 Smoke test
Detalle en §4. Sin smoke test verde, no hacer announce público.

---

## 4. Smoke test mínimo

Wallet con ≥ $2 USDC en Celo, conectada a chainId 42220.

1. Abrir `/play-hub` (o `/hub` según ruta de producción).
2. Ver chip **`✦ GET PRO`** en top-right (gold/amber gradient).
3. Tap chip → ProSheet abre con CTA "Get PRO".
4. Tap "Get PRO" → wallet pide approve USDC (solo primera compra).
5. Confirmar approve → wallet pide `Shop.buyItem(6, 1, USDC)`.
6. Confirmar buyItem → CTA flips a "Processing…" → "Verifying…" → sheet cierra.
7. Verificar que `/api/verify-pro` se llamó y respondió `{ active: true, expiresAt }`.
8. Chip re-renders como **`★ PRO • 30d`** (purple gradient).
9. Reload `/play-hub` → chip sigue activo (status persiste).
10. Abrir Coach UI con balance `coach:credits:<wallet>` = 0 (forzar cero si hace falta).
11. Ejecutar análisis Coach → debe responder `{ status: "ready", proActive: true, response }`.
12. Confirmar en Redis que `coach:credits:<wallet>` **no** decrementó.
13. En Vercel logs: buscar `[pro-bypass] coach analyze short-circuited`.

---

## 5. Rollback

Niveles independientes — usar el mínimo necesario.

### Nivel 1 — Cosmético (Coach UI con problema)
- Vercel: setear `NEXT_PUBLIC_ENABLE_COACH=false` y redeploy.
- El chip PRO sigue visible (consulta `useProStatus`, no el flag de Coach), pero la superficie Coach que PRO desbloquea queda inalcanzable.
- Usuarios ya pagados conservan su record en Redis hasta expiración natural.

### Nivel 2 — Detener nuevas compras (verify-pro o flow con bug)
- Admin wallet: `ShopUpgradeable.setItem(6, 1_990_000, false)`.
- Nuevas compras revierten on-chain con un mensaje de Shop "item not enabled".
- PRO records existentes siguen honorando su TTL.
- El chip todavía se renderiza. Para esconderlo: ship hotfix con flag `NEXT_PUBLIC_ENABLE_PRO`.

### Nivel 3 — Endpoint verify-pro (NO ELIMINAR)
- Aunque desactivemos compras, **mantener `/api/verify-pro` desplegado**. Si un usuario completó `Shop.buyItem` antes del rollback y su POST a verify-pro nunca llegó, el endpoint debe seguir disponible para reconciliar (es idempotente sobre `txHash`).

### Nivel 4 — Caso "pagó pero no activó"
1. Buscar tx en Celoscan por `Shop` address y wallet del usuario.
2. Si `ItemPurchased(itemId=6, buyer=wallet, token=stablecoin)` existe y `verify-pro` nunca lo procesó, llamar `POST /api/verify-pro` server-side con el txHash. Activación inmediata.
3. Si por alguna razón verify-pro falla: refund off-chain a discreción del operador (treasury holds 80%, prize pool 20%).

---

## 6. Métricas post-launch

Disponibles en Supabase `analytics_events` table.

| Evento | Source | Uso primario |
|--------|--------|--------------|
| `pro_card_viewed` | client | Awareness — distinguir `surface: "chip" \| "sheet"` |
| `pro_cta_clicked` | client | Intent — `source: "chip" \| "sheet_buy" \| "sheet_renew"` |
| `pro_purchase_started` | client | Top of funnel comercial |
| `pro_purchase_confirmed` | client | Conversion — incluye `tx_hash_prefix` |
| `pro_purchase_failed` | client | Loss — `kind: "no-token" \| "timeout" \| "verify-failed" \| "error"` |
| `coach_pro_bypass_used` | server (Vercel logs) | Adoption — ratio sobre `coach analyze` total |

### Funnels clave
- **Conversion**: `pro_purchase_confirmed / pro_purchase_started`
- **Intent rate**: `pro_purchase_started / pro_card_viewed{surface=chip}`
- **Bug signal**: `pro_purchase_failed{kind=verify-failed}` debe tender a 0
- **Adoption**: `coach_pro_bypass_used` / total Coach analyses

### Ausencias deliberadas
- **Cancelaciones**: no se trackean (`cancelled` excluido del schema). Derivable como `started - confirmed - failed(non-cancelled)`.
- **Wallet / hash completo**: nunca en payloads.

---

## 7. Limitaciones conocidas

| Limitación | Impacto | Mitigación |
|-----------|---------|-----------|
| Renovación manual | User olvida → PRO expira sin warning | UX banner "Expira en X días" → diferido a Fase 0.1 |
| Sin auto-renewal | No revenue recurrente automático | Wallet flow on Celo no soporta pull-payment trivial; aceptado para Fase 0 |
| Sin benefits extra fuera de Coach | PRO solo desbloquea Coach unlimited | Roadmap perks visibles como "Coming later" en sheet |
| No server-side Supabase telemetry para bypass | `coach_pro_bypass_used` solo en Vercel logs (no Supabase) | TODO en `analyze/route.ts`. Resolver cuando exista `lib/server/telemetry.ts` |
| Verify-failed UX sin retry dedicado | User pagó pero no activó → refresh manual reconcilia (verify-pro idempotente) | Botón retry-verify dedicado → diferido (ver §8) |
| PRO depende de Redis TTL | Si Upstash pierde data → PRO records desaparecen | Upstash tiene durabilidad. Worst case: re-procesar `Shop` events on-chain para reconstruir |
| In-memory rate limit de verify-pro | Cold-start reset, atacante puede burst en boundary | Mismo límite que verify-purchase preexistente. Aceptable Fase 0 |
| Self-extension multi-tab race | Imposible vencer al Lua atómico (extiende desde max(now, current)) | Resuelto a nivel código |
| `apps/admin shop set-item` post-state read race | Audit log a veces muestra post-state stale `(0, false)` justo después del send aunque la tx fue exitosa. Confirmado en el send de itemId 6 (2026-04-29). On-chain state correcto, solo el log es engañoso. | Bug menor del `tx-runner.ts` — agrega delay o re-read confirmado post-receipt antes de imprimir post-state. No urgente. |

---

## 8. Próximo frente recomendado

**Recomendación firme**: tras release real, **no abrir features nuevas durante 7 días**. Medir.

Después de 7 días, decidir basado en signal:

| Si la métrica muestra... | Siguiente trabajo |
|--------------------------|------------------|
| `pro_purchase_failed{kind=verify-failed}` > 1% | **Retry verify-pro button** dedicado en sheet |
| Usuarios renovando con `< 24h` margen | **Banner expiración** (≤ 5 días restantes) |
| Volumen suficiente para auditoría revenue | **Dashboard admin** (Supabase + Celo events) |
| `coach_pro_bypass_used` no aparece en métricas pero el funnel converte | **Server-side telemetry** real (`lib/server/telemetry.ts`) |
| Adoption < 1% sostenida | **Reposicionamiento**: ¿precio? ¿perks? Antes de migrar a Fase 1 |
| Adoption > 5% sostenida | **Fase 1**: prize pool distribution, tournament unlock, achievement-gated PRO perks |

### Lo que NO se hace mientras se mide
- ❌ Auto-renewal / suscripción
- ❌ Tournament.sol / PrizePoolDistributor
- ❌ PRO en Arena/Achievements/VictoryNFT
- ❌ Refactor del purchase flow (consolidar shop + coach + pro)
- ❌ Cambio de precio
- ❌ Cambio de duración

### Trabajo paralelo permitido (no bloquea PRO)
- Bug fixes no relacionados.
- UX micro-mejoras del play-hub fuera del chip PRO.
- Mejoras de Coach analyze (prompt tuning, modelo).
- Documentación / testing.

---

## Apéndice — Files de la Fase 0

### Nuevos
```
apps/web/src/app/api/verify-pro/route.ts
apps/web/src/app/api/verify-pro/__tests__/route.test.ts
apps/web/src/app/api/pro/status/route.ts
apps/web/src/app/api/pro/status/__tests__/route.test.ts
apps/web/src/lib/pro/is-active.ts
apps/web/src/lib/pro/__tests__/is-active.test.ts
apps/web/src/lib/pro/use-pro-status.ts
apps/web/src/lib/pro/__tests__/use-pro-status.test.tsx
apps/web/src/lib/pro/purchase.ts
apps/web/src/lib/pro/__tests__/purchase.test.ts
apps/web/src/components/pro/pro-chip.tsx
apps/web/src/components/pro/__tests__/pro-chip.test.tsx
apps/web/src/components/pro/pro-sheet.tsx
apps/web/src/components/pro/__tests__/pro-sheet.test.tsx
docs/superpowers/plans/2026-04-29-pro-phase-0.md
docs/superpowers/plans/2026-04-29-pro-phase-0-verify-shape.md
docs/superpowers/plans/2026-04-29-pro-phase-0-ui-shape.md
docs/release/2026-04-29-pro-phase-0-checklist.md
docs/release/2026-04-29-pro-phase-0-handoff.md  ← este archivo
```

### Modificados
```
apps/web/src/lib/content/editorial.ts            (+PRO_COPY)
apps/web/src/lib/contracts/shop-catalog.ts       (+PRO constants)
apps/web/src/lib/contracts/__tests__/shop-catalog.test.ts
apps/web/src/lib/coach/redis-keys.ts             (+pro, +proProcessedTx)
apps/web/src/app/api/coach/analyze/route.ts      (PRO bypass + console.info)
apps/web/src/app/api/coach/analyze/__tests__/route.test.ts
apps/web/src/components/play-hub/play-hub-root.tsx (chip + sheet + handler)
```

### Inalterados (verificación explícita)
```
apps/contracts/                                  (sin redeploy)
apps/web/src/components/play-hub/mission-panel-candy.tsx
apps/web/src/components/play-hub/persistent-dock.tsx
apps/web/src/components/play-hub/shop-sheet.tsx
apps/web/src/components/play-hub/purchase-confirm-sheet.tsx
apps/web/src/app/arena/page.tsx
apps/web/src/components/coach/                   (todo el directorio)
apps/web/.env.template                           (default sigue =false)
```
