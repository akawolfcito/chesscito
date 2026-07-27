# Session Handoff — 2026-07-27 (Focus Days ledger, Stage 1 — MERGEADO)

## Completed

Stage 1 entero, mergeado a `main` local (`078d4aa0`, `--no-ff`). El server ya cuenta
Focus Days. **Nada de esto se ve todavía**: la UI es Stage 2 y el gate arranca apagado.

| commit | qué | tests |
|---|---|---|
| `5d54273d` | `seasonId` canónico en `/status` + fix del spread | 29 (10 nuevos) |
| `26458173` | `focus-ledger-init.ts`: count, parseo del reporte y backfill | 22 |
| `718bf54b` | slice `focusDays` + gate + init cableados en `/status` | 10 |
| `492fc8ed` | `POST /api/focus-day` + regla pura de fechas + rate limit | 32 |

**Decisión estructural**: el fast path de Redis **dejó de retornar temprano**. El spec exige
el `seasonId` resuelto antes de cualquier rama (AC30) y para un comprador ese dato sólo
existe en `lite_season_passes`. Redis conserva su único trabajo real — probar acceso: si
Supabase cae, el entitlement se sirve igual y la slice queda `unavailable`.

Dos cosas que aparecieron sin estar pedidas y se cerraron:

- **Rate limit por wallet, no por IP** (`enforceFocusDayRateLimit`, bucket
  `rl:focus-day:wallet`, 10/10min). Lo que se protege es el ledger de una wallet, y una casa
  detrás de un NAT no es abuso. La idempotencia **no** depende de esto: es el UNIQUE.
- **`/status` logueaba la wallet completa en tres líneas viejas.** El logger sólo redacta
  claves tipo `key|secret|token|…`, no wallets. Ahora pasan por `hashWallet()` (AC22).

## Current State

- **Branch**: `main` (el trabajo ya está mergeado; `feat/focus-days-ledger` sigue viva)
- **Build**: suite **6081 passing / 529 files, EXIT=0, 0 `Unhandled Errors`**, `tsc` limpio
  (verificado **sobre `main` ya mergeado**, no sólo en la branch)
- **Uncommitted work**: ninguno
- ✅ **Pusheado**: `origin/main` está en `078d4aa0`.
- 🟢 **EL LEDGER ESTÁ VIVO EN PRODUCCIÓN (LEARN).** El founder aplicó la migración y puso
  `FOCUS_DAYS_LEDGER_ENABLED=true` el **2026-07-27**. `/status` ya escribe el latch de
  backfill y cuenta filas reales.

## Consecuencias de que ya esté prendido

- **El backfill es de una sola vez por `(wallet, season_id)`.** Cada wallet que abra el Hub
  con entitlement activo se siembra y se latchea con lo que el cliente reporte **hoy**. Un
  bug en el reporte del cliente NO se arregla con un redeploy: hay que borrar la fila de
  `focus_ledger_init` para esa wallet.
  ⚠️ Stage 2 todavía no manda `streak`/`lastCompletedDate`, así que hasta que llegue, cada
  llamada cae en `report = null` → **no siembra y no latchea**. Eso es correcto y a propósito
  (AC13): nadie se está latcheando en cero mientras tanto.
- **Apagarlo no requiere redeploy**: `focus-days-ledger:enabled = "false"` en Redis manda
  sobre el env var. Un valor que no sea exactamente `"true"`/`"false"` cae al default seguro
  (off) y se loguea.
- **Qué mirar si algo se pone raro**: `focus_day_ledger_unavailable` y
  `focus_days_gate_invalid_override` en los logs de `/api/season-pass/status`.

**El env var va SÓLO en el proyecto de LEARN.** PLAY no tiene quién lo consuma:
`hub-scaffold-client.tsx:15` despacha por modo y la `ChallengeCard` cuelga sólo de
`LearnHubClient`. Prenderlo en PLAY agrega una query de conteo por carga que nadie muestra.
No es peligroso: las superficies de PLAY que llaman al `/status` (`exercises-screen`,
`season-pass-sheet`, `use-effective-theme-tier`) lo hacen **sin** `streak`, y sin reporte el
backfill no siembra ni latchea.

**El kill switch de Redis es compartido entre LEARN y PLAY, y está bien así** (decisión del
founder, 2026-07-27). Si algún día hace falta separarlos, la key es una constante única
(`FOCUS_DAYS_GATE_REDIS_KEY`, `focus-days-gate.ts:17`): namespacearla es una línea + su test.

## Next Tasks

**Orden recomendado y por qué**: el refactor del scaffold va ANTES de Stage 2. Los dos tocan
la ChallengeCard y su host; juntos el diff es irrevisable y el refactor queda escondido
debajo de una reescritura de UI. Además desbloquea `/dev/learn-hub` y los VR que Stage 2 va
a querer para verificarse.

1. **Borrar `feat/focus-days-ledger`** (mergeada, y **no existe en `origin`** — verificado).
2. **`refactor/hub-lite-daily-slot`**: `HubLiteScaffold` → `dailySlot: ReactNode`. Hoy el
   scaffold monta `HubDailyTile`, que llama `useAccount()`, así que un probe `/dev` de LEARN
   renderiza un error overlay. Bloquea los puntos 3 y 4.
3. `/dev/learn-hub` + `vr18-learn-hub-*`, espejando `/dev/play-hub`.
4. `hub-clean` → `exercises-clean` + `mask` sobre tablero y objetivo; regenerar `vr9`–`vr17`
   (~39 fotos), revisando una por una.
5. **`feat/focus-days-ui` (Stage 2)**:
   - `use-hub-data.ts`: consumir `focusDays` y mandar `streak` + `lastCompletedDate` como
     params (**presentes** aunque sean `0`: ausentes = "no sé" y el backfill no latchea).
   - `ChallengeCard`: los cinco estados de `challengeProgressView` (`offer`, `disabled`,
     `degraded`, `active` con `unreachable`, `completed`). El CTA **sobrevive** a `unreachable`.
   - i18n en `editorial.ts` + `messages/es.ts` (tabla del spec), cero em-dashes (AC23),
     `pnpm content:audit` (AC24).
   - Cliente del POST al completar el Daily + el reintento `daily_retry` (behavior 16).
   - Borrar `challenge-day.ts`, su test, `dayOfChallenge` y sus 11 referencias (AC1).
   - AC20 (camino real `/status` → `use-hub-data` → `ChallengeCard`) y AC18 (el test que
     espía los cuatro caminos de acreditación y los deja en cero).

## Blockers

Ninguno.

## Notes

- **Higiene de branches**: hay ~25 branches locales acumuladas (`chore/art-assets`,
  `feat/observability-lote-1`, `phase-1-ui-zone-map`…) más varias worktrees. Pendiente
  auditarlas contra `main` y proponer cuáles borrar. **No se tocó nada** en esta sesión.
- **El `/status` declara `no-store` + `force-dynamic`.** Puede inicializar el ledger; una capa
  que lo cachee produce un bug irreproducible.
- **`disabled` ≠ `unavailable`** hasta el cliente. Uno es una decisión nuestra, el otro una
  falla nuestra; una tarjeta que los pinta igual esconde un incidente detrás de un flag.
- **Orden dentro de la slice: gate → backfill → count.** Contar antes de sembrar le reporta
  cero a alguien que tiene historia, y ese cero es justo lo que la tarjeta renderiza.
- **El backfill nunca latchea después de un write fallido.** Un sembrado perdido no se
  recupera; uno repetido es gratis bajo el UNIQUE.
- **`?streak=` vacío y el param ausente NO latchean; `?streak=0` sí.** Un streak positivo
  **sin** `lastCompletedDate` válido tampoco latchea: no hay dónde apoyarlo en el calendario.
- **PRO no tiene ventana comprada**: el backfill le siembra 0 filas y cuenta desde hoy. Su
  regla de fecha es sólo "PRO no había vencido antes de esa fecha".
- **Honestidad de proceso**: los tests de `focus-days.ts`, `focus-ledger-init.ts` y del
  `/status` se corrieron en rojo antes de implementar. Los del `POST /api/focus-day` se
  escribieron primero pero **no se corrió el rojo** (el módulo no existía: el import habría
  fallado, no es un rojo verificado sobre lógica).
- **Spec B (21-en-30) NO está escrito.** Ahí vive el cambio de término comercial y la
  migración de los pases vivos. Sin él "12 of 21" sigue siendo incompletable tras un salteo,
  pero ahora **visible** — que era el punto de Spec A.
- **CI NO corre Playwright.** VR local necesita `BASE_URL=http://localhost:3002 PORT=3002`.
