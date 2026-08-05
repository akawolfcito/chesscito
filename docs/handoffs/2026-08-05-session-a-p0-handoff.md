# Handoff — Sesión A: los dos P0 + la consulta de activación (2026-08-05)

> **✅ DESPLEGADO Y VERIFICADO EN PRODUCCIÓN.** Ver *Ejecución en producción* al final:
> los dos P0 están cerrados en `brsbdzpuvotxsadmcxyj`, con evidencia por rol.
> El cuerpo de este doc quedó escrito **antes** del deploy; el apéndice manda donde
> difieran. **No arrancar la Sesión B sin un GO nuevo.**

**Documento madre de la verificación previa:** `docs/audits/2026-08-05-prod-audit-verification.md`.
Este handoff no lo repite: cubre sólo lo que se hizo hoy.

---

## Branch y commits

Branch: `main` (local, sin pushear). Base: `7ef0c2c3`.

| # | Commit | Qué cierra |
|---|--------|-----------|
| 1 | `fbbe33ff` `fix(payments): prevent duplicate pro checkout execution` | P0 rail PRO |
| 2 | `083094b2` `fix(db): close public access to privileged views` | P0 vistas |
| 3 | `1c892eb2` `docs(analytics): add reproducible daily focus activation query` | Fase 3 |

Los P0 no se mezclaron: un commit cada uno, más el artefacto de analítica aparte.

### Archivos

**Commit 1**
- `apps/web/src/lib/pro/use-pro-rail.ts` (+18/−1)
- `apps/web/src/lib/pro/__tests__/use-pro-rail.test.ts` (+161)

**Commit 2**
- `apps/web/supabase/migrations/20260805000000_close_public_access_to_privileged_views.sql` (nueva)
- `apps/web/src/lib/supabase/__tests__/privileged-views-schema.test.ts` (nueva)
- `apps/web/scripts/privileged-views-role-probe.sql` (nueva)

**Commit 3**
- `docs/audits/2026-08-05-daily-focus-activation-d1.sql` (nueva)

### Migración creada

Una sola: `20260805000000_close_public_access_to_privileged_views.sql`. No destructiva —
no toca ninguna tabla, política ni fila; sólo `alter view`, `revoke`, `grant` y `comment`.
Rollback explícito documentado en su sección 5.

---

## Divergencia con el prompt de la orden

**La numeración P0/P1/P2 del handoff previo no es la de tu orden.** El handoff del
2026-08-05 llama "P0" a la salud de lectura de balance y numera el mutex como **P2**.
Tu orden define P0 = mutex + vistas. **Se ejecutó tu orden.** El "P0" del handoff previo
(`BalanceReadHealth`, separar *unreadable* de *insufficient*, botón de reintento) **no se
tocó** y sigue esperando decisión.

---

## P0 — Rail PRO

### Evidencia de que el defecto existía

`use-pro-rail.ts:pay()` no tenía ningún guard de concurrencia. Su hermano
`use-payment-rail.ts` tiene `payInFlightRef` desde que entró el carril canary
(líneas 120, 141, 269-270, 475).

Reproducido en test antes de tocar el código:

```
AssertionError: expected "vi.fn()" to be called 1 times, but got 2 times
  at use-pro-rail.test.ts:214  expect(writeMock).toHaveBeenCalledTimes(1)
```

Dos toques en el mismo tick → **dos `writeContractAsync`** → dos transferencias firmadas.

### Los dos niveles, verificados por separado

**Cliente:** era el hueco. Ahora cerrado.

**Servidor: ya era correcto, y no puede cubrir este defecto.** Las dos claves de
idempotencia de `/api/verify-payment` son **por `txHash`**:

- `REDIS_KEYS.proProcessedTx(txHash)` (`route.ts:334`) — evita extender PRO dos veces por la misma tx.
- `consume_pro_treasury_payment` con `${pack.source}:${chainId}:${txHash}:${logIndex}` (`route.ts:320`).

Dos toques producen **dos txHash distintos y ambas transferencias son genuinas**. Cada una
llega con su propia clave, ninguna es "duplicate", ambas liquidan: cobro doble y PRO
extendido dos veces.

**No se agregó protección server-side, y es deliberado.** En un rail de transferencia
directa el servidor ve el pago *después* de que el dinero se movió. Rechazar la segunda
liquidación se quedaría con la plata sin entregar nada — estrictamente peor que
extender de más. La postura correcta del servidor es la que ya tiene: no duplicar por
una tx, no tragarse un pago real. **El mutex es la única capa que puede evitar el cobro
doble**, y por eso el arreglo va ahí. No se implementó un arreglo imaginario.

### Comportamiento anterior → nuevo

| | Antes | Ahora |
|---|---|---|
| Doble tap sincrónico | 2 transferencias firmadas | 1 |
| Tap durante la firma | 2ª transferencia solicitada | ignorado |
| `reset()` en vuelo | CTA se reactivaba bajo firma pendiente | bail-out |
| Rechazo / error RPC / fallo de verify | — | mutex liberado, reintento intencional funciona |

Liberación en `finally`, cubriendo éxito, rechazo del usuario, error RPC, error de
verificación y excepción inesperada.

### CTA

**Ya estaba cubierto**, no hizo falta tocarlo: `pro-sheet.tsx:82,85` (`resolveCta`)
devuelve `onClick: undefined` + spinner durante `purchasing`/`verifying`. El hueco era
estrictamente el tap en el mismo tick, antes del re-render. Ahí actúa el mutex.

---

## P0 — Vistas

### Evidencia y causa raíz

La causa raíz está **escrita en el repo como una creencia falsa**.
`20260607000000_peones_ledger_init.sql:261` cierra su sección de RLS con:

```sql
-- Note: the view inherits RLS from the underlying table; no extra policy needed.
```

Una vista de Postgres **no hereda RLS**. Sin `security_invoker` corre con privilegios de
su **owner** y lee `peones_ledger` salteando `peones_ledger_own_reads` — la política que
esa misma migración escribió para que una wallet no lea el ledger de otra. La segunda
mitad la pone Supabase: `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon,
authenticated`, que le da a `anon` un SELECT **explícito** sobre cada vista nueva en
`public`.

Resultado: la anon key podía leer `wallet, balance, last_event_at, event_count` de **todas**
las wallets.

### Validación con roles reales (Postgres 15, no revisión)

El probe afirma que el agujero está **abierto antes** de aplicar la migración, así que no
puede pasar contra una base donde las vistas nunca existieron:

```
BEFORE  anon -> peones_ledger      : 0 filas          (la RLS sí funciona)
BEFORE  anon -> peones_balances    : 2 wallets FILTRADAS
BEFORE  anon -> leaderboard_full_v : 2 filas legibles

AFTER   anon          -> las 3 vistas : DENIED (insufficient_privilege)
AFTER   authenticated -> las 3 vistas : DENIED
AFTER   service_role  -> peones_balances        : 2 wallets (la app sigue)
AFTER   service_role  -> leaderboard_combined_v : 2 filas   (Leaders sigue)

view_name              | owner    | options                 | anon | auth | service
leaderboard_combined_v | postgres | {security_invoker=true} | f    | f    | t
leaderboard_full_v     | postgres | {security_invoker=true} | f    | f    | t
peones_balances        | postgres | {security_invoker=true} | f    | f    | t
```

Se verificó el privilegio **efectivo** (`has_table_privilege`) *y* un intento real de
`select`, no la sentencia escrita. Exit 0.

### Por qué no rompe nada

Todos los consumidores son server-side con service role: `lib/supabase/queries.ts`
(leaderboard) y `app/api/peones/balance/route.ts` (balances), ambos vía
`getSupabaseServer()` (`lib/supabase/server.ts:14`, `SUPABASE_SERVICE_ROLE_KEY`).
**No existe cliente Supabase de navegador**: `NEXT_PUBLIC_SUPABASE_*` no aparece en
ningún lado de `apps/web/src`.

### Otras vistas con el mismo patrón

**Auditoría completa, sin deuda pendiente.** El esquema tiene exactamente **cuatro**
vistas. Tres se cierran acá; la cuarta (`leaderboard_weekly_full_v`,
`20260801000000`) ya shippeó correcta y es el patrón que se copió. Hay un guard test que
falla si aparece una quinta vista sin cubrir.

La migración además **revienta sola** si el deploy no cierra el agujero (bloque `do $$`
con `has_table_privilege`).

---

## Fase 3 — Consulta de activación

`docs/audits/2026-08-05-daily-focus-activation-d1.sql`. Read-only, parametrizada por día
de cohorte. **No se tocó producción para obtenerla.**

### Semántica real de `peones_balance_viewed` — refuta la lectura de "cazadores de recompensas"

Sale de un `useEffect` (`peones-balance-chip.tsx:164-174`) que dispara cuando el fetch del
chip del HUD resuelve en `success`. **Carga automática al montar** — sin tap, sin
intención, y el jugador ni siquiera necesita mirarlo. Tiene dedupe por número de balance,
así que suele ser 1 por instalación.

Es un **marcador pasivo de "estuvo en el hub"**, no de intención. Aparece tanto como
último evento porque **resuelve tarde**, no por motivo del jugador. Los 339 no son gente
que fue a ver su saldo y se fue. Está excluido de todos los grupos de la consulta.

### `exercise_complete` vs `exercise_completed` vs `daily_focus_completed`

| Nombre | Qué es |
|---|---|
| `daily_focus_completed` | **Nunca se emite.** Nombre canónico de lectura (`canonical-events.ts:30`). Consultarlo crudo devuelve 0 filas, en silencio. |
| `daily_tactic_completed` | El evento **real** (`lib/daily/telemetry.ts:97`), desde las superficies Daily. |
| `exercise_complete` | El evento **real** del training screen (`exercises-screen.tsx:1824`). |
| `exercise_completed` | Alias canónico; une 4 nombres crudos. |

**426 vs 415 es legítimo, no una inconsistencia instrumental.** Vienen de caminos de
código **disjuntos**: terminar el Daily **no** emite una completación de ejercicio. Son
poblaciones que se solapan, no anidadas. El fixture lo hace visible:
`daily_only=1, exercise_only=2, both=1`.

**Consecuencia — `ACTIVATION_FUNNEL` está mal ordenado.** `canonical-events.ts:36` declara
`... → exercise_completed → daily_focus_completed`, afirmando que las completaciones de
Daily son un subconjunto de las de ejercicio. No lo son, y **eso es exactamente por qué
426 > 415 parece un bug**. En la consulta los grupos 3 y 4 son **hermanos**, no pasos
consecutivos. El array quedó **sin renombrar** (fuera de alcance); es deuda a decidir.

### Identidad, zona horaria y "volvió al día siguiente"

- `session_id` es un **id persistente por instalación** en localStorage pese al nombre
  (`analytics/identity.ts:34`). Es lo que hace medible D1. **Caveat que no se puede
  corregir:** borrar storage o reinstalar acuña un id nuevo → un jugador que vuelve
  cuenta como instalación nueva y **deprime D1**.
- `visit_id` es el per-visita (sessionStorage).
- **Frontera de día: UTC.** `created_at` es `timestamptz`; la app nunca escribe una clave
  de día local.
- **Cohorte:** instalaciones cuyo **primer evento absoluto** cae en el día. Ancla en
  primer-evento (no "estuvo activo ese día") para que jugadores que vuelven no
  contaminen un D1 de nuevos.
- **"Volvió":** al menos un evento en `[día+1, día+2)` UTC. Regla de **día calendario**,
  no ventana móvil de 24 h — quien juega 23:50 y de nuevo 00:10 cuenta como que volvió.
  Es la más laxa de las dos y la que corresponde a "volvió al día siguiente".

### Grupo 5 — no disponible, no fabricado

No hay evento fiable de "vio el cierre/recompensa". `daily_streak_updated` se emite
**del mismo bloque** que la completación (`lib/daily/telemetry.ts:118`), así que mediría
la completación una segunda vez. Reportarlo como grupo 5 inventaría una distinción.
Instrumentar uno real es trabajo de Fase 5.

### Resultado de `daily_focus_completed → D1`

**No hay resultado de producción: falta acceso.** Ver bloqueos.

Lo que sí está probado es la consulta, contra un fixture sintético con respuesta
calculada a mano, en Postgres 15. Todos los grupos, el total y las exclusiones coinciden:

```
0. opened, never reached hub          1   0.0%
1. hub viewed, never started          3  33.3%
2. exercise started, none completed   2  50.0%
3. exercise completed, no daily       2  50.0%
4. daily focus completed              2 100.0%
6. buyers (descriptivo, se solapa)    1 100.0%
TOTAL (cohorte)                      10  50.0%
```

Verificado además: una instalación vista el día anterior queda **fuera** del cohorte, y
una que vuelve el día **dos** no cuenta como D1. En la sección 2a `daily_focus_completed`
**no aparece** — confirma empíricamente que nunca se emite.

La consulta trae checks de instrumentación (2a alias reales, 2b duplicados por
instalación, 2c el solape 426/415, 2d sensibilidad de frontera, 2e eventos legacy) que
**hay que correr antes** de creerle a la sección 1.

---

## Pruebas ejecutadas

| Qué | Resultado |
|---|---|
| `use-pro-rail.test.ts` | **14/14** (6 nuevos; los 6 fallaban antes del fix) |
| `privileged-views-schema.test.ts` | **13/13** (nuevo) |
| Vecindario pro + payments + verify-payment | **498/498** (48 archivos) |
| Vecindario supabase + scores + peones | **749/749** (37 archivos) |
| **Suite completa `apps/web`** | **7302/7302 · 593/593 archivos** |
| `tsc --noEmit` | `No errors found` |
| `pnpm build` | limpio |
| Probe de roles en Postgres 15 | exit 0 |
| Consulta D1 contra fixture | exit 0, coincide con el cálculo a mano |

Los stack traces al final de la suite son de `primitive-boundary.test.tsx`, que lanza
`Error: boom` a propósito. No hay sección `Unhandled Errors`.

> Nota: el baseline de `CLAUDE.md` dice 6515/552 (2026-07-29). El real hoy es **7302/593**.
> Conviene actualizarlo.

**VR / Playwright: NO se corrió.** No lo pedía la orden y CI no lo corre.

---

## Revisión manual mobile

**No aplica a esta sesión y no se hizo.** Los tres commits no cambian ni un pixel: un ref
en un hook, una migración SQL y un archivo `.sql` de documentación. El único componente
del vecindario (`pro-sheet.tsx`) **no se tocó** — se verificó que su gate de CTA ya
existía. La revisión mobile corresponde a la Sesión B.

---

## Bloqueos reales

**Uno solo: no hay credenciales de producción en esta sesión.** Deja pendiente
exactamente dos cosas, ambas *sólo* el probe contra prod:

1. **Sección 6 de `privileged-views-role-probe.sql`** — read-only, safe contra prod.
   Confirma el estado desplegado (owner, `reloptions`, privilegios efectivos por rol).
   Correr **después** de aplicar la migración.
2. **La consulta D1 contra los datos reales** del cohorte 2026-08-04.

No bloquearon nada más: toda la validación se hizo local y reproducible.

Menores, no bloqueantes:
- Docker Desktop estaba apagado; se levantó (≈250 s) para los probes.
- `rtk` recorta la salida de `grep`; hubo que usar `rtk proxy`.

---

## Cosas deliberadamente NO implementadas

- **Fase 4-6 completas** (slice Tour → ejercicio, instrumentación, rollout) — parada firmada.
- **Protección server-side extra en el rail PRO** — argumentado arriba: sería peor.
- **El "P0" del handoff previo** (`BalanceReadHealth`, *unreadable* vs *insufficient*,
  botón de reintento) — otra numeración, fuera de tu orden.
- **Renombrar / reordenar `ACTIVATION_FUNNEL`** — hallazgo reportado, no ejecutado.
- **Dedupe de telemetría en `handlePurchase`** (`use-pro-sheet-state.ts:264`). El doble tap
  seguía emitiendo dos `pro_purchase_started` antes del re-render. El mutex protege **el
  dinero**; esto infla el denominador de conversión de PRO. Es un bug de **medición**, no
  de plata, y arreglarlo era refactor lateral. **Recomiendo tomarlo en la Sesión B**, junto
  con el resto de instrumentación.
- **`pro-sheet.tsx:453-456`** (`pro-extend-link` llama `onPurchase()` sin pasar por
  `resolveCta`) — open question heredada, sigue abierta.
- **Renombrar la columna `session_id`** — sería una migración por cosmética.

---

## Rollout

Los tres commits son **seguros de desplegar juntos**, pero el orden importa:

1. **Push del código.** Commits 1 y 3 no necesitan nada más. El 1 es puro cliente; el 3
   es un `.sql` que no se ejecuta en runtime.
2. **Aplicar la migración** `20260805000000_...` contra prod. Se autoverifica: si `anon`
   conserva el SELECT, **aborta con excepción** en vez de reportar éxito.
3. **Correr la sección 6 del probe** contra prod y confirmar `anon_can_select = f` en las tres.
4. Verificar a ojo que Leaders y el chip de Peones siguen vivos (ambos van por service role,
   no deberían moverse).

No hace falta feature flag: no hay cambio de UI ni de contrato.

## Rollback

- **Commit 1** — `git revert fbbe33ff`. Vuelve el cobro doble; sólo por incidente.
- **Commit 2** — sección 5 de la migración, copiable tal cual:
  ```sql
  alter view public.peones_balances        set (security_invoker = false);
  alter view public.leaderboard_full_v     set (security_invoker = false);
  alter view public.leaderboard_combined_v set (security_invoker = false);
  grant select on public.peones_balances        to anon, authenticated;
  grant select on public.leaderboard_full_v     to anon, authenticated;
  grant select on public.leaderboard_combined_v to anon, authenticated;
  ```
  **Restaura el estado inseguro.** Sólo para revertir un incidente, nunca como arreglo.
- **Commit 3** — nada que revertir; no corre en runtime.

---

## Medición a 24 h y 72 h

**A 24 h — que los P0 estén de verdad cerrados.**

1. Sección 6 del probe contra prod: las tres filas con `anon_can_select = f`,
   `service_can_select = t`, `options = {security_invoker=true}`.
2. Pagos PRO duplicados. Dos liquidaciones a la misma wallet con **txHash distintos** a
   pocos segundos es el patrón que el mutex debía matar:
   ```sql
   select wallet, count(*) as settlements,
          count(distinct tx_hash) as txs,
          min(created_at), max(created_at)
     from pro_treasury_payments
    where created_at >= now() - interval '24 hours'
    group by wallet having count(*) > 1
    order by settlements desc;
   ```
   > Verificar el nombre real de la tabla que escribe `consume_pro_treasury_payment` antes
   > de correrla — **no se confirmó en esta sesión**.
3. Que Leaders y balances no se hayan caído: contar respuestas no vacías de
   `get_leaderboard()` y de `/api/peones/balance`.

**A 72 h — la activación (sólo informativo hasta que exista la variante).**

4. La consulta de Fase 3 con `cohort_day` a 3 días atrás, corriendo **primero** las
   secciones 2a-2e. Lo que se busca: si el D1 del grupo 4 supera de forma estable al del
   grupo 3, `daily_focus_completed` es mejor unidad de activación y merece ser la métrica
   norte de la Sesión B.
5. Repetirla para 2-3 días de cohorte consecutivos. Un solo día con n≈2.700 y D1 ≈1,3%
   son ~36 personas: **cualquier diferencia entre grupos va a estar dentro del ruido**.
   No decidir con un día.

**Regla de decisión, para cuando exista la variante:** no declarar éxito por que suba
`exercise_started`. Más inicios con caída fuerte de finalización no es éxito. Las compras
son métrica secundaria.

---

## Estado final del árbol

`main` local, 3 commits por delante de `origin/main`. Sin cambios sin commitear salvo
lo que ya estaba antes de empezar:

```
 M SESSION.md
?? docs/audits/2026-08-05-cruce-local-script-verification.md
?? docs/audits/2026-08-05-prod-audit-verification.md
?? docs/handoffs/2026-08-05-prod-audit-p0-verification-handoff.md
```

Esos cuatro venían de la sesión anterior y **no se tocaron**. Decidir si entran al repo.

---

## Open questions

1. **¿GO para la Sesión B?** Es lo único que bloquea el slice Tour → primer ejercicio.
2. **`ACTIVATION_FUNNEL` mal ordenado** — ¿se corrige el array (y quién consume esa
   ordenación hoy), o se documenta y se deja?
3. **`pro_purchase_started` duplicado por doble tap** — ¿entra a la Sesión B?
4. **El "P0" del handoff previo** (`BalanceReadHealth`) — ¿sigue vivo, y con qué prioridad
   frente al experimento?
5. **`pro-sheet.tsx:453-456`** — heredada, sigue sin respuesta.
6. **Los cuatro archivos sin trackear** — ¿se commitean?

---

# Ejecución en producción — 2026-08-05

Ejecutado tras la aprobación de la Sesión A. Ambos P0 **cerrados y verificados en
producción**. Dos sorpresas, ninguna prevista por el cuerpo de este doc.

## Push

`origin/main` estaba **2 commits más atrás** de lo asumido: `c98400ec` (feat(ops),
código) y `7ef0c2c3` (docs) de la sesión de stats IA nunca se pushearon. Un push
llevaba 6, no 4, y no se podían separar (eran ancestros). Se auditó `c98400ec` antes:
1 archivo (`scripts/ops/onchain-revenue.mjs`), nadie lo importa desde `apps/`, no está
en scripts de `package.json`, no toca lockfile/migraciones/env, y sólo hace
`getBlockNumber`/`getBlock`/`getLogs` — sin claves, sin firma, sin escrituras. Único env:
`CELO_RPC` opcional. **No entra al build ni al runtime.** Aprobado y pusheado.

`b93a6972..cbfa1315`, y luego `cbfa1315..5c03d581`.

## ⚠️ Sorpresa 1 — colisión de versión: la migración se iba a saltear en silencio

`supabase db push --dry-run` antes de aplicar:

```
Would push these migrations:
 • 20260805000000_stats_aggregation_rpcs.sql
```

**La migración de las vistas no aparecía.** Había dos archivos con el prefijo
`20260805000000`, y Supabase trackea por **versión, no por nombre de archivo**. El push
habría reportado éxito, re-ejecutado una migración ya viva en prod desde el 2026-08-04, y
dejado `anon` con SELECT sobre las tres vistas. **Un no-op silencioso es el peor modo de
falla posible para un arreglo de seguridad: la salida en verde es indistinguible de la
real.**

Causa: elegí un timestamp ya ocupado. Arreglo: renombrada a `20260805010000`
(commit `5c03d581`), sin cambiar una línea del SQL. Dry-run posterior resuelve a
exactamente una migración, la correcta. Se agregó un guard que falla si dos migraciones
comparten prefijo — el defecto es invisible en un diff.

**Confirmado a posteriori:** el historial de prod tiene `20260805000000` **y**
`20260805010000` como filas distintas, o sea que la versión vieja efectivamente ya
estaba tomada.

## Migración aplicada

`supabase db push` → `Applying migration 20260805010000_...` → exit 0. El bloque `do $$`
de autoverificación **no abortó**, que era la primera señal de cierre.

## Verificación por rol contra producción (paso 4)

```
v                        | opts                    | anon  | auth  | svc
-------------------------|-------------------------|-------|-------|------
leaderboard_combined_v   | {security_invoker=true} | false | false | true   ✓
leaderboard_full_v       | {security_invoker=true} | false | false | true   ✓
leaderboard_weekly_full_v| {security_invoker=true} | false | false | true   ✓ (ya estaba)
peones_balances          | {security_invoker=true} | false | false | true   ✓
leaderboard_v            | {security_invoker=on}   | true  | true  | true   ⚠️ ver abajo
```

Intento real como `anon`:

```
ERROR: 42501: permission denied for view peones_balances
```

> **Nota de método:** `supabase db query` apunta a la base **LOCAL** por defecto. La
> primera corrida devolvió las tres vistas abiertas y un historial de migraciones vacío
> — no era producción. Hay que pasar **`--linked`**. Una lectura apresurada de esa
> primera salida habría reportado que el arreglo falló.

## ⚠️ Sorpresa 2 — hay una QUINTA vista en producción

El cuerpo de este doc afirma *"el esquema tiene exactamente cuatro vistas, auditoría
completa, sin deuda pendiente"*. **Eso era cierto del set de migraciones, no de
producción**, que tiene cinco. `leaderboard_v` no la crea ninguna migración.

**No es una vulnerabilidad**, verificado y no asumido:
- Es el predecesor legacy de `leaderboard_combined_v`: sólo lee `scores` +
  `passport_cache`, top-10, y conserva el cast `::integer` que la migración del
  2026-07-29 tuvo que ensanchar a bigint porque desbordaba.
- Tiene `security_invoker=on`, así que la RLS **sí** se aplica.
- `scores` tiene la policy `scores_select_public` con `using (true)` y roles `{}` — esa
  tabla es **pública por diseño explícito**. La vista no escala privilegios: expone lo
  que `scores` ya expone.
- La app no la lee. Sólo aparece en tests como "la legacy que nunca hay que tocar".

**Deuda separada, no P0:** una vista stale, fuera del historial de migraciones, con el
bug de overflow que el resto del sistema ya corrigió. Decidir si se dropea.

## Verificación funcional (paso 5)

| Chequeo | Resultado |
|---|---|
| `service_role` → `leaderboard_combined_v` | **10** filas (top-10 intacto) |
| `service_role` → `leaderboard_full_v` | **441** jugadores rankeados |
| `service_role` → `peones_balances` | **4.567** wallets |
| `anon` → `peones_balances` | **denegado** (42501) |
| `play.chesscito.com` | HTTP 200 |
| `learn.chesscito.com` | HTTP 200 |
| `/stats` renderiza Leaders | **441 aparece 3 veces en el HTML**, coincide con la base |
| `/api/peones/balance?wallet=…` | HTTP 200, payload correcto |

> `/stats` contiene el string "Something went wrong" 8 veces. **No es un error**: es copy
> serializado del bundle editorial (`ERROR_PAGE_COPY`, `errorGeneric`). Se verificó antes
> de reportar.

## Estado final

`origin/main` = `5c03d581`. Árbol limpio salvo los 4 archivos preexistentes sin trackear.
Migración `20260805010000` registrada en el historial de Supabase de prod.

**Ya no queda nada pendiente contra prod de la Sesión A.** El "pendiente: probe contra
producción" que declara el cuerpo de este doc está **resuelto**.
