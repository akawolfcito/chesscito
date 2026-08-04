# Fase A — aplicada en producción · validación post-aplicación

**Fecha:** 2026-08-04 · **SHA aplicado:** `b0e3190b5bccb462f4415e80907f88992d82f857`
**Migración:** `20260805000000_stats_aggregation_rpcs.sql` · **única aplicada**
**Ventana de aplicación:** entre `2026-08-04T22:29:26Z` (preflight) y `2026-08-04T22:33:22Z` (post)
**Rollback ejecutado:** **NO** — no hizo falta.

> **✅ RESULTADO: las ocho RPC están vivas en producción, correctas y cerradas a
> anon/authenticated/public.** Verificador **1.084 / 1.084**. Cero incidentes.
> **Ninguna aplicación las consume todavía** — eso es Fase B.

---

## 1. Lo que se aplicó, y la prueba de que fue sólo eso

El repositorio despliega migraciones con el CLI de Supabase contra el proyecto
linkeado. **Antes de aplicar** se inspeccionó la lista exacta de pendientes, por
dos caminos independientes:

**Diff del historial remoto contra los archivos locales:**

```
migraciones remotas aplicadas : 37
migraciones locales           : 38
PENDIENTES                    : 20260805000000     ← exactamente una
```

**Y el propio CLI (`supabase migration list --linked`):**

```
   20260801000000 | 20260801000000 | 2026-08-01 00:00:00
   20260805000000 |                | 2026-08-05 00:00:00   ← Remote vacío
```

Las dos fuentes coinciden: **una sola migración pendiente, la de Fase A.** No
había arrastres de migraciones viejas sin aplicar, así que no existía el riesgo
de que un `db push` empujara algo no revisado.

**Estado de partida del catálogo, verificado antes de aplicar:**

```
funciones stats_* en remoto: NINGUNA
```

Con lo cual los ocho `create or replace function` **crearon** y no
**reemplazaron** nada. Ninguna función preexistente fue modificada.

**Declaración previa** (regla de comandos destructivos):

| Eje | Valor |
|---|---|
| Entorno objetivo | Supabase **producción** — base compartida production+preview |
| Qué se pierde | **nada**. Aditivo puro: 8 funciones nuevas. Cero DDL de tablas, cero índices, cero datos, cero configuración, cero cron, cero retención |
| Reversibilidad | **total y de costo cero**: `drop function` de las ocho, documentado en el pie de la migración. Ningún consumidor las llama |

Salida del CLI:

```
Applying migration 20260805000000_stats_aggregation_rpcs.sql...
Finished supabase db push.
```

---

## 2. Verificador contra la base real — **bloqueante, y verde**

```
────────────────────────────────────────────────────────────────────────
CHESSCITO — /stats RPC VERIFICATION
checks 1084 · passed 1084 · FAILED 0
────────────────────────────────────────────────────────────────────────
🟢 every check passed
```

`scripts/ops/verify-stats-rpcs.ts` · **exit 0**.

Cubrió, contra producción: existencia y firma de las ocho, `SECURITY DEFINER`,
`stable`, `search_path` exacto, `work_mem` como conjunto cerrado en las dos
direcciones, ausencia de `EXECUTE` para los tres roles prohibidos, **paridad
exacta contra las consultas de referencia en las nueve combinaciones**
(`surface` × `container`), monotonía del embudo, cierre de la partición,
las tres bandas de retención, y las 30 filas densas del trend.

**Cero tolerancia y cero desviaciones.** No hubo un solo hallazgo.

---

## 3. `proconfig` de las ocho — leído de `pg_proc` en producción

```
stats_access_funnel      | p_surface text, p_container text | t | s | search_path=public
stats_account_lifecycle  | p_surface text, p_container text | t | s | search_path=public
stats_activation_funnel  | p_surface text, p_container text | t | s | search_path=public
stats_activity_trend     | p_surface text, p_container text | t | s | search_path=public
stats_habit_depth        | p_surface text, p_container text | t | s | search_path=public | work_mem=8MB  ⬅
stats_install_counts     | p_surface text, p_container text | t | s | search_path=public
stats_retention          | p_surface text, p_container text | t | s | search_path=public
stats_top_countries      | p_surface text, p_container text | t | s | search_path=public | work_mem=8MB  ⬅
```

Las ocho: firma idéntica `(p_surface text, p_container text)`, `prosecdef = t`
(SECURITY DEFINER), `provolatile = s` (STABLE), `search_path=public` **exacto**.
`work_mem=8MB` en **exactamente dos**, y en ninguna otra.

---

## 4. Matriz de privilegios — `has_function_privilege` en producción

| función | `public` | `anon` | `authenticated` | `service_role` |
|---|---|---|---|---|
| `stats_access_funnel` | **f** | **f** | **f** | **t** |
| `stats_account_lifecycle` | **f** | **f** | **f** | **t** |
| `stats_activation_funnel` | **f** | **f** | **f** | **t** |
| `stats_activity_trend` | **f** | **f** | **f** | **t** |
| `stats_habit_depth` | **f** | **f** | **f** | **t** |
| `stats_install_counts` | **f** | **f** | **f** | **t** |
| `stats_retention` | **f** | **f** | **f** | **t** |
| `stats_top_countries` | **f** | **f** | **f** | **t** |

**8/8 cerradas a los tres roles prohibidos. 8/8 abiertas a `service_role`.**

Esto es lo que un regex sobre el `.sql` no puede probar y por lo que el
verificador existe: una migración que revocara sólo de `PUBLIC` pasaría todos
los tests de texto y esta tabla mostraría `t` en las columnas `anon` y
`authenticated`.

---

## 5. Paridad e invariantes — valores reales

Primera vez que estas cifras salen de PostgreSQL en lugar de un `Set` sobre
1.000 filas truncadas.

### `stats_install_counts`

```json
{"sessions_7d":4410,"sessions_30d":6922,
 "app_opens_rows_30d":5264,"app_open_sessions_30d":4460}
```

La página publicaba **46 · 46 · 37**. El SQL de referencia de la auditoría, 4 h
antes, daba 3.927 / 6.446 / 3.976 — consistente con el tráfico intermedio.

### `stats_account_lifecycle` — **la partición cierra**

```json
{"known":3453,"new_today":1921,"new_7d":3447,
 "active_7d":3451,"dormant":2,"inactive":0,"resurrected_7d":0}
```

**3.451 + 2 + 0 = 3.453 = `known`** ✅
`resurrected_7d` (0) ⊆ `active_7d` (3.451) ✅
La página publicaba `Inactive 962` contra un real de **0**.

### `stats_activation_funnel` — **monótono**

```
app_opened            4460
hub_viewed            4369
exercise_started      1356
exercise_completed     581
daily_focus_completed  300
```

4460 ≥ 4369 ≥ 1356 ≥ 581 ≥ 300 ✅ — contra el `App opened 37 < Hub viewed 41`
que la página venía mostrando.

### `stats_retention` — las tres bandas, cohorte 0 incluida

```
d1     59 / 1991
d7      7 /  107
week3   0 /    0
```

### `stats_top_countries` — orden correcto

```
NG 1619 · NL 772 · KE 314 · ZA 275 · ID 250 · BR 224 · UG 135 · CO 112
```

**Kenia sale tercera**, que es su lugar real. La página la publicaba **octava,
con 1 sesión**.

### `stats_activity_trend`

```
30 rows
```

---

## 6. Monitor antes y después

| Eje | **Antes** (22:29:26Z) | **Después** (22:33:22Z) |
|---|---|---|
| Estado production | 🟢 GREEN (partial) | 🟢 **GREEN (partial)** |
| Estado preview | 🟢 GREEN (partial) | 🟢 **GREEN (partial)** |
| `now()` responde | 1.729 ms | **1.739 ms** |
| PostgreSQL | 17.6 | 17.6 |
| `analytics_events` | 162.192 filas · 93 MB | **162.439 filas** |
| Conexiones | — | **1 activas / 6 idle** |
| `play.chesscito.com` | HTTP 200 · 2.184 ms | HTTP 200 · **1.042 ms** |
| `learn.chesscito.com` | HTTP 200 · 842 ms | HTTP 200 · **523 ms** |
| `preview` / `learn-preview` | HTTP 200 | HTTP 200 |
| 5XX | ninguno | **ninguno** |
| `/api/telemetry` | 15 + 12 req · 0 err | **15 + 12 req · 0 err** |

**Sin degradación.** La latencia de los dominios de hecho bajó, que es ruido de
warm-up de Vercel y no un efecto de la migración. `now()` se movió 10 ms.

### `/stats` sigue exactamente como estaba

```
https://play.chesscito.com/en/stats → 307 → /stats → HTTP 200 · 250.506 bytes
em-dashes presentes: 8            ← el hotfix de honestidad sigue activo
valores de las RPC en el HTML: ninguno
```

El `307` es el redirect de locale de `next-intl`, preexistente y ajeno a este
cambio. **Ninguna aplicación consume las RPC nuevas** — verificado buscando en
el HTML los valores que sólo ellas producen (4.410 / 6.922 / 3.453 / 4.460):
ausentes. Es exactamente el estado esperado al cierre de Fase A.

---

## 7. Rollback

**No se ejecutó.** No se cumplió ninguna de las condiciones que lo habrían
disparado: las ocho existen, las firmas coinciden, `search_path` es exacto,
`work_mem` está sólo donde debe, los tres roles prohibidos no tienen `EXECUTE`,
`service_role` sí, la paridad es exacta en las nueve combinaciones, ninguna
invariante se rompió y no hubo timeout ni presión anormal.

El rollback documentado sigue vigente y sigue costando cero **mientras nada las
llame**. Esa ventana se cierra en Fase C.

---

## 8. Riesgos que permanecen

| # | Riesgo | Severidad | Nota |
|---|---|---|---|
| 1 | **`week3` devuelve cohorte 0 y lo seguirá haciendo hasta ~2026-08-20** | media | No es un defecto: `session_first_seen` se creó el **2026-07-23**, así que los installs de 21–28 días de antigüedad son anteriores a la tabla y no existen como filas. Se resuelve solo cuando la tabla acumule 28 días. **La UI debe distinguir «cohorte vacía» de «nadie volvió»** — la RPC ya devuelve la fila con `cohort = 0` justamente para que se pueda |
| 2 | **Los números públicos saltan de 46 a 4.410** | media | Es una **corrección**, no crecimiento. Sin una nota en la página el salto se lee como inflado. Anotarlo al llegar a Fase D |
| 3 | **`container=minipay` usa el 91 % de los 8 MB de `work_mem`** | media | 7.422 kB de 8.192. Si vuelve a derramar al crecer el tráfico, la salida es un índice `(surface, country, session_id)`, **no** un `work_mem` mayor |
| 4 | **Cache frío: 2,5 s en la primera consulta tras inactividad** | media | En caliente son 137 ms. Con `revalidate 900` sobre una ruta de bajo tráfico, quien dispara la revalidación paga esa penalidad. A resolver en Fase E, no antes |
| 5 | **`census.total` sigue sin explicación** | media | Intacto, no tocado por Fase A. **No cerrar `/stats` sin trazarlo** |
| 6 | **production y preview comparten la MISMA base** | media | Toda cifra que devuelvan las RPC es la suma de los dos entornos. Rotularlo donde se afirme el número |
| 7 | **15,5 % de filas con `surface`/`container` NULL** | media | Un filtro no-null las excluye → las vistas filtradas **no suman** a la sin filtrar. Declararlo en la superficie que afirma el número |
| 8 | **Las RPC no tienen consumidor y por lo tanto no tienen alarma** | baja | Si algo las rompiera hoy, nadie se enteraría hasta Fase C. `verify-stats-rpcs.ts` es la única red; correrlo antes de empezar Fase B |

---

## 9. NEXT ACTION — **Fase B**

> Cliente Supabase **server-only** en `chesscito-landing`:
> `@supabase/supabase-js` con pin exacto, port de
> `apps/web/src/lib/supabase/server.ts`, y el guard que impide que una clave
> llegue al bundle del cliente.
>
> **Referencia:** `docs/plans/2026-08-04-stats-consolidation-execution-plan.md`,
> Fase B. **Leerlo, no re-derivarlo.**

⚠️ **Fase B añade la primera credencial de servicio a un proyecto que nunca tuvo
secretos** — el plan lo marca como uno de los cuatro puntos donde hay que
detenerse y confirmar antes de empezar.

⛔ **Sin prefijo `NEXT_PUBLIC_`.** `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`
son server-only, en `chesscito-landing`, production y preview.

---

## 10. Referencias

| Documento | Para qué |
|---|---|
| `docs/handoffs/2026-08-05-stats-rpc-phase-a-review.md` | la revisión: contratos, invariantes, los 32 planes, `work_mem` |
| `docs/plans/2026-08-04-stats-consolidation-execution-plan.md` | **empezar acá para Fase B** |
| `docs/audits/2026-08-04-public-stats-accuracy-audit.md` | causa raíz, contratos §13, SQL de referencia §22 |
| `scripts/ops/verify-stats-rpcs.ts` | correrlo antes de Fase B y después de cualquier cambio de esquema |
