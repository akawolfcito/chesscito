# Session Handoff — 2026-07-27 (Focus Days ledger, Stage 1)

## Completed

Stage 1 entero: el server ya sabe contar Focus Days. Nada de esto se ve todavía —
la UI es Stage 2 y el gate arranca apagado.

| commit | qué | tests |
|---|---|---|
| `5d54273` | `seasonId` canónico en `/status` + fix del spread | 29 (10 nuevos) |
| `2645817` | `focus-ledger-init.ts`: count, parseo del reporte y backfill | 22 |
| `718bf54` | slice `focusDays` + gate + init cableados en `/status` | 10 |
| `492fc8e` | `POST /api/focus-day` + regla pura de fechas + rate limit | 32 |

**Decisión estructural de Stage 1**: el fast path de Redis **dejó de retornar temprano**.
El spec exige el `seasonId` resuelto antes de cualquier rama (AC30) y para un comprador ese
dato sólo existe en `lite_season_passes`. Redis conserva su único trabajo real — probar
acceso: si Supabase cae, el entitlement se sirve igual y la slice queda `unavailable`.

Otras dos cosas que aparecieron y se cerraron en el camino:

- **Rate limit por wallet, no por IP** (`enforceFocusDayRateLimit`, bucket
  `rl:focus-day:wallet`, 10/10min). Lo que se protege es el ledger de una wallet, y una
  casa detrás de un NAT no es abuso. La idempotencia **no** depende de esto: es el UNIQUE.
- **`/status` logueaba la wallet completa en tres líneas viejas** (`pro_status_check_failed`,
  `redis_status_check_failed`, `supabase_unavailable`). El logger no redacta wallets: sólo
  matchea claves tipo `key|secret|token|…`. Pasan por `hashWallet()` (AC22).

## Current State

- **Branch**: `feat/focus-days-ledger`, 9 commits, **sin mergear a `main`**
- **Build**: suite **6081 passing / 529 files, EXIT=0, 0 `Unhandled Errors`**, `tsc` limpio
- **Uncommitted work**: ninguno
- ⏳ **`main` local sigue 10 commits adelante de origin.** El founder pushea.
- 🔒 **El gate arranca apagado.** Sin `FOCUS_DAYS_LEDGER_ENABLED=true` ni override en Redis,
  `/status` devuelve `focusDays: { status: "disabled" }` y el POST responde `disabled`.
  Nada lee ni escribe el ledger hasta que se prenda.

## Antes de prender el flag

1. **Aplicar la migración** `apps/web/supabase/migrations/20260728000000_focus_day_ledger.sql`
   en el Supabase hosted. Sin las tablas, la slice queda `unavailable` — degrada, no rompe.
2. Recién después: `FOCUS_DAYS_LEDGER_ENABLED=true` (server-side, **nunca** `NEXT_PUBLIC_*`)
   + redeploy, o el override `focus-days-ledger:enabled` en Redis para prenderlo sin deploy.

## Next Tasks — Stage 2 (UI)

1. `use-hub-data.ts`: consumir `focusDays` del `/status` y mandar `streak` +
   `lastCompletedDate` como params (**presentes**, aunque sean `0`: ausentes = "no sé" y el
   backfill no latchea).
2. `ChallengeCard`: los cinco estados de `challengeProgressView` (`offer`, `disabled`,
   `degraded`, `active` con `unreachable`, `completed`). El CTA **sobrevive** a `unreachable`.
3. i18n en `editorial.ts` + `messages/es.ts` (tabla del spec), cero em-dashes (AC23),
   `pnpm content:audit` (AC24).
4. Cliente del POST al completar el Daily + el reintento `daily_retry` del behavior 16.
5. Borrar `challenge-day.ts`, su test, `dayOfChallenge` y sus 11 referencias (AC1).
6. AC20 — el test de camino real `/status` → `use-hub-data` → `ChallengeCard`.
7. AC18 — el test que espía los cuatro caminos de acreditación y los deja en cero.

## Cola anterior, TODAVÍA ABIERTA

Detalle en `docs/handoffs/2026-07-27-challenge-card-and-vr-handoff.md`.

1. **Refactor `HubLiteScaffold` → `dailySlot: ReactNode`.** Bloquea lo demás.
2. `/dev/learn-hub` + `vr18-learn-hub-*`.
3. `hub-clean` → `exercises-clean` + `mask`.
4. Regenerar `vr9`–`vr17` (~39 fotos).

⚠️ El punto 1 **choca con Stage 2**: los dos tocan la ChallengeCard y su host. Recomendación:
hacer el refactor del scaffold **primero** — Stage 2 va a reescribir la tarjeta entera y
mezclar las dos cosas hace irrevisable el diff.

## Blockers

Ninguno.

## Notes

- **El `/status` declara `no-store` + `force-dynamic`.** Puede inicializar el ledger; una capa
  que lo cachee produce un bug irreproducible.
- **`disabled` ≠ `unavailable`** hasta el cliente. Uno es una decisión nuestra, el otro una
  falla nuestra, y una tarjeta que los pinta igual esconde un incidente detrás de un flag.
- **Orden dentro de la slice: gate → backfill → count.** Contar antes de sembrar le reporta
  cero a alguien que tiene historia, y ese cero es justo lo que la tarjeta renderiza.
- **El backfill nunca latchea después de un write fallido.** Un sembrado perdido no se
  recupera; uno repetido es gratis bajo el UNIQUE.
- **`?streak=` vacío y el param ausente NO latchean; `?streak=0` sí.** Además: un streak
  positivo **sin** `lastCompletedDate` válido tampoco latchea — no hay dónde apoyarlo en el
  calendario y latchear ahí congelaría a ese jugador en cero para siempre.
- **PRO no tiene ventana comprada**: el backfill le siembra 0 filas y cuenta desde hoy. Su
  regla de fecha es sólo "PRO no había vencido antes de esa fecha".
- **Honestidad de proceso**: los tests de `focus-days.ts`, `focus-ledger-init.ts` y del
  `/status` se corrieron en rojo antes de implementar. Los del `POST /api/focus-day` se
  escribieron primero pero **no se corrió el rojo** (el módulo no existía: el import habría
  fallado, no es un rojo verificado sobre lógica).
- **CI NO corre Playwright.** VR local necesita `BASE_URL=http://localhost:3002 PORT=3002`.
