# Session Handoff — 2026-06-25

## Completed This Session

### Lite Season Pass MVP — 10 fases atómicas (4438/4438 tests, tsc clean)

| Commit | Fase | Descripción |
|--------|------|-------------|
| `570b010` | 1 | `rail-config.ts`: tipos + config `lite_season_pass_21` ($1.99, 21d, +3 shields) |
| `98c56a0` | 2 | Migración SQL `lite_season_passes` (RLS deny-all, idempotency UNIQUE, índices) |
| `3b5a19c` | 3+4 | `transfer-builder.ts`: `buildSeasonPassTransfer`; `redis-keys.ts`: `seasonPass()` TTL key |
| `562adda` | 5 | `verify-payment/route.ts`: branch Season Pass + Redis shields + 21 tests |
| `b1076fa` | 6 | `GET /api/season-pass/status` (Redis fast path + Supabase fallback) + 7 tests |
| `0c0ce50` | 7 | `useSeasonPassStatus` hook (Lite-only, AbortController cleanup) |
| `bb85206` | 8 | `useSeasonPassRail` hook (type-safe, sep. de `usePaymentRail`) |
| `1bb0833` | 9 | `SeasonPassSheet` component (`VictoryPopupShell`, Lite gate, success/error states) |
| `7ffac67` | 10 | Integración exercises + hub (exercises: recoveryCta override; hub: CTA + dynamic import) |

## Current State
- **Branch**: main — 9 commits ahead of `origin/main` (no pusheado aún)
- **Build**: 4438/4438 tests · tsc clean
- **Treasury confirmada**: `0x917497b64eeB85859edcf2e4ca64059eDfeC1923` (Safe wallet)
- **SKU**: `lite_season_pass_21` · $1.99 · 21 días · +3 shields
- **Season ID**: `21day-mind-challenge-2026-q3`

## Next Tasks
1. **Aplicar migración en Supabase hosted**: `apps/web/supabase/migrations/20260625120000_lite_season_passes.sql`
2. **Env vars en Vercel** (Preview + Prod ya comparten env): `CHESSCITO_TREASURY_ADDRESS` confirmada. No hay nuevas vars — rail usa las mismas de Peones.
3. **Smoke test manual**: Hub Lite → botón 🛡️ → SeasonPassSheet → pago USDC on-device.
4. **Opcional**: Welcome Package spec + Exercises Save Flow spec (backlog previo — ver MEMORY.md).

## Smoke Checklist (local)
```
CHESSCITO_LITE_MODE=true CHESSCITO_TREASURY_ADDRESS=0x917497... pnpm dev
```
1. Hub → ver botón "🛡️ 21-Day Pass — $1.99" (solo si no hay pass activo)
2. Tap → `SeasonPassSheet` abre con precio, descripción, 21 días
3. Exercises → falla ejercicio sin shields → overlay muestra "Get Season Pass" (no "Get Peones")
4. Tap → `SeasonPassSheet`
5. Con wallet Celo mainnet + USDC: pagar → success state → +3 shields confirmado
6. Botón hub desaparece (pass activo)
7. `GET /api/season-pass/status?wallet=0x...` → `{ active: true, expiresAt, seasonId }`

## Blockers
- Migración SQL pendiente de aplicar en hosted (no bloquea dev, sí bloquea smoke en staging).
