# Session Handoff — 2026-08-10

## Completed

### Web Early Access — CERRADO
- **Intake vivo y probado**: `/api/early-access/request` + pantalla dentro de `WebAccessGate`,
  detrás de un enlace secundario bajo ENTER. Tabla `public.web_early_access` con RLS deny-all.
  Diseño: `docs/specs/2026-08-10-web-early-access-design.md`. Handoff:
  `docs/handoffs/2026-08-10-web-early-access-handoff.md`.
- **Migración aplicada a hosted** (`20260810000000`), **NO** con `supabase db push`: el ledger
  estaba tres atrás y las otras dos son backfills cuyo efecto ya estaba en prod. Se ejecutó
  sólo el SQL nuevo y se registraron las tres versiones en una transacción. Verificado con
  `set role`: `anon` y `authenticated` → permission denied; `service_role` opera.
- **El bucle de aprobación se validó end-to-end en producción**: solicitud → alta en el
  allowlist de Privy → `update` a `allowlisted` → acceso.
- ⛔ **Dos apps de Privy, cada una con SU allowlist.** `cms022hew02bz0cjsq4fmd5gu` = producción
  (learn y play); `cmrxs5c28004v0dlcm5rn4mgw` = preview y local (es la de `.env.local`).
  `allowed_domains` es la forma fiable de distinguirlas; el banner "development mode" lo
  muestran las dos. Dar de alta en una NO habilita en la otra.

### P0 de seguridad — `/api/peones/spend` (pasos 1-3 de 5)
- **El agujero**: la ruta tomaba la wallet a debitar **del body**, con `service_role` salteando
  la RLS. No explotable anónimamente vía PostgREST — el vector era nuestra propia ruta.
- **Mergeado** el fix de la ruta (`4641de1c`) + **el cliente ahora adjunta el token**.
- **Dos bugs encontrados PROBANDO, no razonando** (los dos en preview con MiniPay real):
  1. `peekScoreSession()` leía **sólo memoria**: cerrar y reabrir MiniPay dejaba la sesión
     intacta en disco y aun así la primera pista daba 401. Se extrajo `peekUsableScoreSession`
     (memoria→disco) y `ensureScoreSession` la usa, para que exista UNA definición de "sesión
     usable".
  2. **La sesión dura 2h** (`SCORE_SESSION_TTL_SECONDS`), así que "no hay sesión usable" es el
     estado ORDINARIO de quien vuelve al día siguiente, no un borde. Leer disco no alcanzaba.
- **Regla final** (propuesta del founder, mejor que el parche por sink): **un gasto siempre
  puede firmar su sesión, porque un gasto siempre lo pide el jugador.** Va en `spend-client`,
  el único punto por el que pasan hint, coach y shield. `promptPolicy` queda FIJO en `"allow"`
  y **no se expone** — un flag opcional es una puerta para equivocarse. Verificado que ningún
  gasto lo dispara la máquina (hint = `onClick`, escudo = `onUseShield`, coach =
  `startCoachAnalysis`; ese módulo no importa `useEffect`).
- `signMessage` pasó a **requerido** y se propagó por los tres sinks y sus llamadores, mismo
  patrón que `promptPolicy`: `tsc` obliga a todo camino de gasto, presente y futuro.
- **Verificado en preview con cuenta real**: `spend_session_token` con `present:true,
  enforced:true`, `GET score_write_sessions` (el servidor resuelve la wallet desde la fila) y
  `POST rpc/peones_spend` (débito real). El fallback del **escudo** también funcionó solo.

### Limpieza e higiene
- **Inventario del trabajo sin mergear** → `docs/audits/2026-08-10-unmerged-work-inventory.md`.
  Las dos branches de spec-1 de mayo YA habían llegado a main por squash; se archivaron como
  tags y se borraron con sus worktrees (liberó dos copias del repo). Los dos stashes,
  archivados y descartados. **Nada se borró sin dejar un tag `archive/*` primero.**
- **Base de datos en sync**: 22/22 tablas, 34/34 funciones. El único objeto que las migraciones
  no reproducen es `leaderboard_v`, legacy documentada y con test que prohíbe hacerle DDL.
- **Iconos de marca regenerados** (`a1cb5fc8`) — el job Asset drift del CI venía rojo desde
  `74ce8037` (2026-07-28). `icons:generate:check` ahora da `drifted: []`.
- **Docs de E0 mergeados** a main (`660f8fd6`), docs-only.

## Current State
- **Branch**: `main` limpio. **6 commits sin pushear** — el founder pushea.
- **Suite**: 623 archivos / **7691 tests passing**. `tsc` limpio, **`next lint` completo**
  limpio, `next build` exit 0.
- ⚠️ **Lección de esta sesión**: `next lint --file` sobre los archivos tocados **no sustituye
  al build**. Un `eslint-disable` de `@typescript-eslint/*` —regla que este proyecto no tiene
  registrada— rompió un deploy de Vercel y no lo agarró el lint por archivo.

## Next Tasks

### 1. P0 — pasos 4 y 5 (lo único de trabajo real que queda)
**Paso 4 (founder)**: promover a prod learn Y play, después `PEONES_SPEND_REQUIRE_SESSION=true`
en ambos. ⚠️ **Código primero, flag después.** Se lee por request: no necesita redeploy para
prender/apagar. Rollback = ponerla en `false`.

**Paso 5 — guardar al que OTORGA** (`docs/security/2026-08-10-peones-spend-authz.md`):
hoy la wallet se resuelve en **la ruta**; si mañana aparece otro llamador con `service_role`,
el agujero se reabre. La migración la mueve **adentro** de la RPC: `p_wallet` → `p_token_hash`,
y `peones_spend` busca la sesión por sí misma (como ya hace `save_score_attempt`).
- Prerrequisitos del doc: (1) sign-off del founder — **pendiente**; (2) cliente con token en
  vivo — ✅ **cumplido esta sesión**; (3) la ruta cambia a `p_token_hash` **en el mismo deploy**.
- Reversible dejando la función vieja con nombre versionado.
- El sketch SQL está en el doc, fiel al cuerpo actual de `20260608000000_peones_spend_rpc.sql`.

### 2. E0 — readout de la rampa (sin cambios, esperando muestra)
Igual que antes: el founder pega las filas cuando acumulen **≥15 asignaciones post-deploy**.
Deploy = `'2026-08-10 17:23:56+00'`. Queries en `docs/experiments/2026-08-10-e0-ramp-runbook.md`.
**Sin interpretación estadística hasta ~750 asignados.**

### 3. Early Access — conseguir solicitudes
El mecanismo está terminado; lo que falta no es código sino gente que pida acceso. La cola
tiene 1 fila (la prueba del founder). **Aprobar es siempre Privy → DB, en ese orden.**

## Blockers
- Ninguno técnico. El paso 5 necesita sign-off para una migración de prod.

## Notes
- **Web Early Access NO es un brazo de E0** y sus eventos no deben entrar en un análisis de
  activación. Con n≈25 se puede aprender qué confundió a la gente y si volvieron; **no** se
  puede afirmar "Web retiene mejor que MiniPay" — las cohortes no están randomizadas.
- El mensaje de rechazo de Privy quedó **decidido-y-diferido**: sólo se puede por API (el
  dashboard no expone esos campos) y hace falta el app secret de producción, que `.env.local`
  no tiene. Curl listo en el handoff de Early Access §14.
- `allowlist_enabled` **NO** es escribible por API: el POST devuelve 200 y no cambia nada. El
  toggle es sólo del dashboard, así que **no** se puede automatizar un corte al llegar a 499
  MAU. Tampoco hay endpoint documentado para leer el MAU.
- Plan de Privy: **Free hasta 500 MAU**; Core $299 hasta 2.500. Cruzar 500 cuesta $299/mes.
