# Fase A — las ocho RPC de `/stats`: migración diseñada, revisada y **NO aplicada**

**Fecha:** 2026-08-04 · **HEAD:** `cdab130f6106` (= `origin/main`)
**Estado:** revisión **aprobada con una corrección obligatoria, ya aplicada**.
Detenido antes de aplicar la migración y antes de commitear.
**Ningún commit, ningún push, ningún deploy, ninguna escritura remota, ninguna variable tocada.**

> **✅ VEREDICTO: LISTO PARA APLICAR.** Los tres derrames a disco desaparecieron,
> medidos contra la base real. Sin bloqueos abiertos. Detalle en §8ter.

---

## Decisiones del founder — cerradas

| # | Decisión | Estado |
|---|---|---|
| 1 | **`stats_activation_funnel` con prefijo anidado** | ✅ **APROBADO** — funnel estricto, monótono por construcción. Sin cambios |
| 2 | **`session_first_seen`: retención filtra la cohorte, el trend no filtra el nacimiento** | ✅ **APROBADO**. Sin cambios |
| 3 | **`vitest.config.ts` conserva el `include`** de `supabase/migrations/__tests__` | ✅ **APROBADO** — los tests quedan en su ubicación natural |
| 4 | **`stats_account_lifecycle` con bandas de ocho días calendario** | ❌ **RECHAZADO** → reescrito con ventanas móviles. Ver §3bis |
| 5 | **`set work_mem = '8MB'` sólo en `stats_top_countries` y `stats_habit_depth`** | ✅ **APLICADO y medido**. Ver §8ter |

---

## 0. Verificación inicial

| Eje | Resultado |
|---|---|
| HEAD vs `origin/main` | `cdab130f610608038c7ade9254436e7666c5b1ca` — **idénticos** |
| `SESSION.md` | modificado, **fuera del stage** (`git diff --cached` vacío) |
| `pnpm ops:health` (production) | 🟢 **GREEN (partial)** · `2026-08-04T20:34:18Z` |
| `pnpm ops:health:preview` | 🟢 **GREEN (partial)** |
| `play.chesscito.com` | HTTP **200** · commit `b90ee4f6f0f2` · READY |
| `learn.chesscito.com` | HTTP **200** · commit `b90ee4f6f0f2` · READY |
| preview (ambos) | HTTP **200** · commit `cdab130f6106` · READY |
| 5XX | **ninguno** en los cuatro dominios |
| `/api/telemetry` | 12 req · 0 err (play) · 13 req · 0 err (learn) |
| Hotfix de `/stats` | **desplegado** — es `b90ee4f6`, que descansa sobre `ebdc5c1c` |
| Incidente activo | **ninguno** |

Los dos ejes no medidos siguen siendo Active CPU y la cuota de Upstash, ambos ya
conocidos y sin credencial. No bloquean la Fase A.

---

## 1. Archivos

| Archivo | Líneas | Qué |
|---|---|---|
| `apps/web/supabase/migrations/20260805000000_stats_aggregation_rpcs.sql` | **807** | las ocho funciones + privilegios + rollback |
| `apps/web/supabase/migrations/__tests__/stats-rpc-privileges.test.ts` | **344** | guard del texto de la migración · **29 tests** |
| `scripts/ops/verify-stats-rpcs.ts` | **879** | verificación contra la base real |
| `scripts/ops/__tests__/verify-stats-rpcs.test.ts` | **622** | tests del verificador · **57 tests** |
| `apps/web/vitest.config.ts` | **+6** | una línea de `include` (ver §9) |

### ⚠️ Dos desviaciones de la ruta literal del encargo

**1. La migración vive en `apps/web/supabase/migrations/`, no en `supabase/migrations/`.**
No existe un directorio `supabase/` en la raíz del repo: las 40 migraciones reales
están bajo `apps/web/supabase/migrations/`. El plan usaba la forma corta.

**2. El nombre es `20260805000000_stats_aggregation_rpcs.sql`, no `2026-08-05-…`.**
La CLI de Supabase exige `<timestamp>_<nombre>.sql`; las 40 migraciones existentes
lo cumplen sin excepción. Un archivo con guiones **no se aplicaría**. Preferí la
convención que hace que el archivo funcione antes que la cadena literal del encargo.

---

## 2. Firmas exactas y tipos de retorno

Las ocho son `language sql · stable · security definer · set search_path = public`,
y las ocho toman la **misma** firma `(p_surface text default null, p_container text default null)`.
`null` = sin filtro; **la cadena `'all'` nunca llega al SQL** (hay un test que lo fija).

```sql
public.stats_install_counts(p_surface text, p_container text)
  returns table (sessions_7d bigint, sessions_30d bigint,
                 app_opens_rows_30d bigint, app_open_sessions_30d bigint)

public.stats_activation_funnel(p_surface text, p_container text)
  returns table (step text, sessions bigint)

public.stats_access_funnel(p_surface text, p_container text)
  returns table (step text, sessions bigint, failed_sessions bigint)

public.stats_top_countries(p_surface text, p_container text)
  returns table (country text, sessions bigint)

public.stats_retention(p_surface text, p_container text)
  returns table (bucket text, returned bigint, cohort bigint)

public.stats_account_lifecycle(p_surface text, p_container text)
  returns table (known bigint, new_today bigint, new_7d bigint, active_7d bigint,
                 dormant bigint, inactive bigint, resurrected_7d bigint)

public.stats_habit_depth(p_surface text, p_container text)
  returns table (min_days int, installs bigint, cohort bigint, median_active_days int)

public.stats_activity_trend(p_surface text, p_container text)
  returns table (day date, sessions bigint, new_installs bigint, returning_installs bigint)
```

Todo conteo es `bigint`. `min_days` y `median_active_days` son `int` a propósito:
son un umbral y una cuenta de días, no poblaciones.
**Ninguna devuelve `session_id`, `account_ref`, wallet, `visit_id` ni `player`** —
hay un test que inspecciona la lista de columnas de las ocho.

---

## 3. Contratos e invariantes fijados

| Función | Invariante |
|---|---|
| `stats_install_counts` | un solo escaneo de 30 d; el de 7 d es un `filter`. `app_opens_rows_30d` cuenta **FILAS** y hereda el 8,6 % de duplicados exactos → **declarada aproximada** en el `comment on function` |
| `stats_activation_funnel` | cohorte de `app_opened` **+ prefijo anidado**: el paso *k* exige haber emitido 1..*k*. `sessions` **no creciente por álgebra**, no por suerte |
| `stats_access_funnel` | **conserva el scoping actual** de `computeAccessFunnel` (cohorte `web_access_gate_viewed`, pasos independientes). `failed_sessions` es un escalar de embudo repetido en las 5 filas |
| `stats_top_countries` | `count(distinct session_id)`, top 8, `order by sessions desc, country asc` → **orden total**. `country` null/vacío excluido |
| `stats_retention` | `d1` día exacto +1 · `d7` día exacto +7 · `week3` **ventana días 15–21**. `LEFT JOIN`: las **tres** filas salen siempre, cohorte 0 incluida |
| `stats_account_lifecycle` | `active_7d + dormant + inactive = known` por construcción. `resurrected_7d` ⊂ `active_7d`. `new_today` = día UTC; `new_7d` = **ventana móvil de 7 d** |
| `stats_habit_depth` | bandas 1/3/7/14/21 **acumulativas** → `installs` no creciente. `median` = `percentile_disc(0.5)` |
| `stats_activity_trend` | **exactamente 30 filas** desde `generate_series`, densas, más viejo primero. `new + returning = sessions` en cada fila |

### ⚠️ Tres decisiones que cambian semántica respecto del JS que reemplazan

**1. El embudo de activación ahora es de prefijo anidado.**
El encargo exige *«monotónico por construcción; ningún paso puede superar al anterior»*.
Scopear a la cohorte **sólo garantiza que el paso 1 acota a los demás** — no ordena
los pasos 2..5 entre sí. La única construcción que da monotonía real es exigir el
prefijo. **Costo:** los números son más bajos que un conteo por paso independiente.
Verificado en el fixture: una sesión con `app_opened` + `hub_viewed` +
`exercise_completed` pero **sin** `exercise_started` desaparece de los pasos 4 y 5,
no sólo del 3. Sin esto, esa sesión produce exactamente el `37 < 41` de hoy.

**2. ~~Las bandas del ciclo de vida son edad en días UTC~~ → CORREGIDO.** Ver §3bis.

**3. `session_first_seen` se filtra en retención y NO en el trend.**
En retención selecciona una **cohorte** («installs nacidos en Learn») → se filtra.
En el trend es una **búsqueda de cumpleaños** → no se filtra: un install nacido en
Play y activo hoy en Learn no es «nuevo» sólo porque su fila de nacimiento cayó
fuera del filtro. Filtrarlo recontaría installs viejos como nuevos — la forma del
defecto que publicó «100 % new, 0 % returning». Hay un test para cada lado.

---

## 3bis. Corrección obligatoria — `stats_account_lifecycle` reescrito

**El rechazo era correcto.** Una tarjeta rotulada *«Active (7d)»* que cuenta ocho
días calendario es la misma clase de defecto que la auditoría vino a cerrar: un
número que el lector no puede reconciliar con su etiqueta. La definición anterior
está eliminada, no marcada como deprecada.

### Definición nueva — ventanas móviles exactas, medias abiertas

```sql
with clock as (select now() as t)   -- ⬅ el ÚNICO instante de evaluación
...
active_7d : last_seen >= t - interval '7 days'
dormant   : last_seen >= t - interval '30 days' and last_seen < t - interval '7 days'
inactive  : last_seen is null or last_seen < t - interval '30 days'
```

`last_seen` pasó de `min(edad en días)` a **`max(created_at)`** — un timestamp, no
una edad en días. Los bordes son `>=` abajo y `<` arriba en las tres bandas, así
que **encajan sin costura y sin solape**: la partición es una identidad, no una
coincidencia.

**Un solo reloj.** `now()` aparece **exactamente una vez** en toda la función, en
el CTE `clock`; las seis comparaciones leen `c.t`. Aunque `now()` ya es el
timestamp de transacción y es estable dentro de una sentencia, fijarlo una vez
hace la garantía **estructural** — nadie que lea o refactorice puede introducir
una segunda referencia que derive. Hay un test que cuenta las ocurrencias:
`expect(body.match(/now\(\)/g)).toHaveLength(1)`.

`resurrected_7d` también se reexpresó en la misma métrica: dentro de la ventana
de 7 d, **sin** evento en la banda dormante, y `first_seen < t - 7 días` (nació
antes de la ventana, así que el silencio fue ausencia y no inexistencia).

**Conservado sin cambios:** `new_today` = día calendario UTC (con el segundo
`at time zone 'utc'` que evita el corrimiento en un servidor no-UTC);
`new_7d` = ventana móvil exacta de 7 días; `resurrected_7d ⊆ active_7d`.

### Consulta de paridad — reescrita e independiente

La referencia ahora responde **seis de los siete campos** (antes cuatro), y las
tres bandas están escritas como pares **`EXISTS` / `NOT EXISTS`**, no como un
bucketing de `max(created_at)`. Son dos deletreos estructuralmente distintos del
mismo contrato, así que se controlan mutuamente en vez de repetirse.

### 🔬 Casos de borde — medidos

Los bordes «exactos» sólo son deterministas si el `now()` del seed y el de la
consulta son **el mismo**: fuera de una transacción el seed siempre cae unos
microsegundos antes y el caso «justo en el borde» es inobservable. Por eso el
fixture corre dentro de **una transacción** (`now()` = timestamp de transacción,
constante) y termina en `rollback`.

| Cuenta | Último evento | Banda esperada | **Medida** |
|---|---|---|---|
| `b_edge_active_7d` | **exactamente** `t - 7 días` | active | ✅ **active** |
| `b_just_before_7d` | `t - 7 días - 1 µs` | dormant | ✅ **dormant** |
| `b_edge_dormant_30d` | **exactamente** `t - 30 días` | dormant | ✅ **dormant** |
| `b_just_before_30d` | `t - 30 días - 1 µs` | inactive | ✅ **inactive** |
| `b_no_events` | **ninguno** | inactive | ✅ **inactive** |

```
{"known":5,"new_today":0,"new_7d":0,
 "active_7d":1,"dormant":2,"inactive":2,"resurrected_7d":1}
```

**1 + 2 + 2 = 5 = known.** La partición cierra sobre los cinco bordes.

### Consecuencia de paridad — la desviación anterior desaparece

Con la definición vieja avisé que `active_7d` **no** iba a coincidir con
`accounts_activas_7d_reales = 3.062` de §6.2 de la auditoría. Con las ventanas
móviles esa objeción **queda sin efecto**: la definición nueva es exactamente la
de la consulta de referencia de la auditoría. Un motivo más por el que el rechazo
era el correcto.

---

## 4. Privilegios

Por cada una de las ocho, **tres `REVOKE` en tres líneas separadas** (no una lista
`from public, anon, authenticated`), para que un rol faltante se vea como una
**línea** faltante:

```sql
revoke execute on function public.stats_<n>(text, text) from public;
revoke execute on function public.stats_<n>(text, text) from anon;
revoke execute on function public.stats_<n>(text, text) from authenticated;
grant  execute on function public.stats_<n>(text, text) to service_role;
```

**24 revokes · 8 grants.** Los tests cuentan ambos: un bloque copiado que repita
los revokes de una función y omita los de otra pasa cualquier `toContain` y
**falla el conteo**.

### 🔬 Probado empíricamente, no por revisión

Levanté un Postgres 16 efímero **local** (nada remoto), le apliqué
`alter default privileges in schema public grant all on functions to anon,
authenticated, service_role` — la condición real de Supabase — y luego la migración:

```
anon          | 0 de 8 pueden ejecutar
authenticated | 0 de 8 pueden ejecutar
service_role  | 8 de 8 pueden ejecutar
```

Y el contrafactual, en la misma base: una función con **sólo**
`revoke ... from public` quedó con `has_function_privilege` = **`t` para anon Y
para authenticated**. El triple revoke no es cargo cult: es la diferencia medida
entre expuesto y no expuesto.

---

## 5. Consultas de paridad

`buildComparisonSql(filters)` emite **una sola sentencia** que corre el RPC **y**
una consulta de referencia escrita a mano, lado a lado. Una sola sentencia porque
la tabla toma ~2.000 filas cada 40 min: dos viajes diferirían por tráfico real y
cada comparación necesitaría una tolerancia injustificable. **Con una sentencia la
tolerancia es cero.**

La referencia está escrita **distinto a propósito** — `count(distinct …)` con
subconsultas correlacionadas donde el RPC usa `bool_or` + `filter`. Dos deletreos
del mismo contrato se controlan mutuamente; una copia del propio SQL del RPC sólo
probaría que la consulta es determinista.

**Grilla completa 3×3:** `surface` ∈ {all, learn, play} × `container` ∈ {all,
minipay, browser} = 9 combinaciones × 8 funciones.

⛔ **Ningún conteo productivo está pineado en ningún test.** Los 3.927 de la
auditoría eran ciertos a las 18:15 UTC del 2026-08-04 y son falsos a la hora de
cenar. Los tests comparan **forma, invariantes y SQL equivalente**.

---

## 6. Tests — los 16 puntos exigidos

| # | Exigido | Dónde | Estado |
|---|---|---|---|
| 1 | las ocho existen | migración + `checkCatalog` | ✅ |
| 2 | todas SECURITY DEFINER | ambos | ✅ |
| 3 | todas fijan `search_path` | ambos (incl. `= public, extensions` → falla) | ✅ |
| 4 | los dos parámetros | ambos | ✅ |
| 5 | triple REVOKE por función | migración (presencia **y conteo = 24**) | ✅ |
| 6 | sin execute para anon/authenticated/public | `checkPrivileges` (`proacl` **y** `has_function_privilege`) | ✅ |
| 7 | activación monótona | `checkActivationMonotone` | ✅ |
| 8 | lifecycle cierra | `checkLifecyclePartition` | ✅ |
| 9 | trend 30 filas | `checkTrend` (+ densidad + orden) | ✅ |
| 10 | conteos `bigint` | migración | ✅ |
| 11 | `session_id`/`account_ref` nulos excluidos | migración | ✅ |
| 12 | filtros null = all | migración + `buildComparisonSql` | ✅ |
| 13 | top countries limita a 8 y ordena | ambos | ✅ |
| 14 | retención d1/d7/week3 | ambos | ✅ |
| 15 | ninguna devuelve identificadores | migración | ✅ |
| 16 | rollback con `drop function` | migración (las ocho) | ✅ |

**Cada checker se ejercita contra un fixture que VIOLA su invariante**, no sólo
contra uno sano. Los casos reproducen defectos reales medidos: `App opened 37 <
Hub viewed 41`, `Inactive 962` contra un 0 real, `KE` tercero impreso octavo,
`known = new_today = new_7d = 1.000`, «100 % new / 0 % returning», y una función
revocada de PUBLIC pero aún concedida a `anon`.

> Un checker que sólo ha visto entrada sana no está demostrado que rechace nada —
> que es exactamente lo que le pasó a `hitCeiling` comparando contra un 10.000
> inalcanzable: nunca disparó ni una vez.

---

## 7. Rollback

Documentado en el pie de la migración, con las ocho sentencias en una transacción.
**Costo cero mientras nada las llame** — el agregador de `apps/web` no se toca en
esta fase. La migración dice explícitamente que **esa ventana se cierra en la
Fase C**: a partir de ahí un drop degrada la página a em-dashes.

---

## 8. Validación local

*(Re-ejecutada íntegra tras la corrección del lifecycle **y** tras el `work_mem`.)*

| Verificación | Resultado |
|---|---|
| Tests de la migración | **34 passed** (+3: work_mem en exactamente dos, conteo y valor exacto, search_path intacto) |
| Tests de ops (verificador) | **63 passed** (+6: work_mem perdido, valor derivado, propagado a una séptima, GUC no revisado, search_path ensanchado) |
| `pnpm exec tsc --noEmit` | **exit 0** |
| **Suite completa** | **7.269 passed / 591 files · exit 0** |
| `Unhandled Errors` en el log | **0** (grep sobre la cola, no sólo el contador) |
| `git diff --check` | **exit 0** |
| Scan de secretos | **limpio** — los dos hits son migraciones **preexistentes** que nombran `SUPABASE_SERVICE_ROLE_KEY` en un comentario de diseño; ningún valor, ningún archivo mío |
| `git diff --cached` | **vacío** — nada stageado |
| Verificador completo local | **1.034 / 1.034** |

Baseline previa: 7.172 / 589. Delta: **+97 tests, +2 archivos**. Sin regresiones.

### 🔬 Validación extra: la migración **corrió** de verdad

Contra el Postgres 16 efímero **local** descrito en §4 (nunca contra Supabase):

- las ocho se crearon: `prosecdef = t`, `provolatile = s`, `proconfig = {search_path=public}`;
- las **11 sentencias** del verificador parsean y ejecutan;
- el verificador completo corrió de punta a punta: **1.018 checks, 1.018 passed**
  (eran 1.000 antes de la corrección; las 18 nuevas son las dos claves de
  referencia extra del lifecycle × 9 combinaciones), incluida la paridad
  RPC-vs-referencia en las 9 combinaciones de filtro;
- y al conceder `execute` a `anon` sobre **una** función, el verificador **falló
  con 2 hallazgos** por sus dos lecturas independientes. **El guard dispara.**

Comportamiento confirmado sobre datos sembrados: cohorte de activación excluyendo
una sesión con `hub_viewed` sin `app_opened`; el anidado de prefijo eliminando una
sesión con `exercise_completed` sin `exercise_started`; `session_id = ''` excluido
de todo; `country` null excluido sólo del ranking; partición cerrando 2+1+2=5;
retención devolviendo las tres bandas; y el trend con 30 filas, 30 días distintos,
sin huecos.

**El contenedor fue eliminado al terminar.**

---

## 8bis. Medición de planes contra la base real — `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`

**Método.** Los cuerpos de las ocho RPC, con los dos parámetros sustituidos por
literales, medidos **contra producción**, **en serie**, una sentencia por vez.
**No se creó ninguna función, no se aplicó ninguna migración, no se escribió ni
un byte.** Cada sentencia interna pasó por `assertReadOnlySql` **antes** de
anteponerle el `EXPLAIN`.

**Combinaciones medidas: 4 de 9** — sin filtros, `surface=learn`, `surface=play`,
`container=minipay`. **32 planes en total.** Se omitieron `surface=learn` ×
`container=*` y `container=browser`: el plan es estructuralmente idéntico al de
su eje (mismo índice, mismos nodos) y sólo cambia la selectividad.

### Los 32 planes

| consulta | filtro | exec ms | plan ms | nodo raíz | seq | index scan | est→real | buffers hit/read | sort | disco |
|---|---|---|---|---|---|---|---|---|---|---|
| `stats_install_counts` | sin filtros | **137**¹ | 1 | Aggregate | 0 | `idx_…_session` | 1→1 | 152.304/0 | — | no |
| `stats_install_counts` | learn | 174 | 0 | Aggregate | 0 | `idx_…_surface` | 1→1 | 60.744/0 | quicksort 3.455 kB | no |
| `stats_install_counts` | play | 126 | 0 | Aggregate | 0 | `idx_…_session` | 1→1 | 152.304/0 | — | no |
| `stats_install_counts` | minipay | 142 | 0 | Aggregate | 0 | `idx_…_session` | 1→1 | 152.306/0 | — | no |
| `stats_activation_funnel` | sin filtros | 218 | 0 | Append | 0 | `idx_…_created_at` | 5→5 | 605.784/0 | — | no |
| `stats_activation_funnel` | learn | 50 | 0 | Append | 0 | `idx_…_surface` | 5→5 | 121.482/0 | — | no |
| `stats_activation_funnel` | play | 261 | 0 | Append | 0 | `idx_…_surface` | 5→5 | 241.122/0 | — | no |
| `stats_activation_funnel` | minipay | 352 | 0 | Append | 0 | `idx_…_container` | 5→5 | 355.938/0 | — | no |
| `stats_access_funnel` | sin filtros | 87 | 0 | Subquery Scan | 0 | `idx_…_created_at` | 1→1 | 530.075/0 | — | no |
| `stats_access_funnel` | learn | 41 | 0 | Subquery Scan | 0 | `idx_…_surface` | 1→1 | 101.235/0 | — | no |
| `stats_access_funnel` | play | 81 | 0 | Subquery Scan | 0 | `idx_…_surface` | 1→1 | 200.935/0 | — | no |
| `stats_access_funnel` | minipay | 118 | 0 | Subquery Scan | 0 | `idx_…_container` | 1→1 | 296.615/0 | — | no |
| `stats_top_countries` | sin filtros | **357** | 0 | Limit | 0 | `idx_…_country` | 8→8 | 296.766/0 | top-N 25 kB | no |
| `stats_top_countries` | learn | 74 | 0 | Limit | 0 | `idx_…_surface` | 8→8 | 101.235/0 | top-N + quicksort 2.738 kB | no |
| `stats_top_countries` | **play** | 167 | 0 | Limit | 0 | `idx_…_surface` | 8→8 | 200.935/0 | **external merge 2.232 kB** | ⛔ **SÍ** |
| `stats_top_countries` | **minipay** | 263 | 0 | Limit | 0 | `idx_…_container` | 8→8 | 296.615/0 | **external merge 3.264 kB** | ⛔ **SÍ** |
| `stats_retention` | sin filtros | 63 | 1 | Sort | 1 `session_first_seen` | `idx_…_session` | 3→3 | 47.558/0 | quicksort 25 kB | no |
| `stats_retention` | learn | **30** | 1 | Sort | 1 `session_first_seen` | `idx_…_session` | 3→3 | 132.454/0 | quicksort 25 kB | no |
| `stats_retention` | play | 61 | 1 | Sort | 1 `session_first_seen` | `idx_…_session` | 3→3 | 258.783/0 | quicksort 25 kB | no |
| `stats_retention` | minipay | 83 | 1 | Sort | 1 `session_first_seen` | `idx_…_session` | 3→3 | 371.196/0 | quicksort 25 kB | no |
| `stats_account_lifecycle` | sin filtros | 285 | 1 | Aggregate | 1 `account_first_seen` | `idx_…_account_ref` | 1→1 | 30.804/0 | — | no |
| `stats_account_lifecycle` | learn | 91 | 0 | Aggregate | 1 `account_first_seen` | `idx_…_created_at` | 1→1 | 454.381/0 | — | no |
| `stats_account_lifecycle` | play | 127 | 0 | Aggregate | 1 `account_first_seen` | `idx_…_created_at` | 1→1 | 605.684/0 | — | no |
| `stats_account_lifecycle` | minipay | 152 | 0 | Aggregate | 1 `account_first_seen` | `idx_…_created_at` | 1→1 | 605.684/0 | — | no |
| `stats_habit_depth` | sin filtros | 140 | 0 | Sort | 0 | `idx_…_session` | 5→5 | 30.500/0 | quicksort 25 kB | no |
| `stats_habit_depth` | learn | 57 | 0 | Sort | 0 | `idx_…_surface` | 5→5 | 141.729/0 | quicksort 3.093 kB | no |
| `stats_habit_depth` | **play** | 131 | 0 | Sort | 0 | `idx_…_surface` | 5→5 | 281.309/0 | **external merge 3.432 kB** | ⛔ **SÍ** |
| `stats_habit_depth` | minipay | 193 | 0 | Sort | 0 | `idx_…_session` | 5→5 | 533.071/0 | quicksort 25 kB | no |
| `stats_activity_trend` | sin filtros | 109 | 0 | Sort | 1 `session_first_seen` | `idx_…_session` | **200→30** | 30.765/0 | quicksort 471 kB | no |
| `stats_activity_trend` | learn | 41 | 0 | Aggregate | 1 `session_first_seen` | `idx_…_surface` | **200→30** | 121.818/0 | quicksort 127 kB | no |
| `stats_activity_trend` | play | 74 | 0 | Aggregate | 1 `session_first_seen` | `idx_…_surface` | **200→30** | 241.458/0 | quicksort 233 kB | no |
| `stats_activity_trend` | minipay | 109 | 0 | Aggregate | 1 `session_first_seen` | `idx_…_container` | **200→30** | 356.274/0 | quicksort 397 kB | no |

¹ **La primera corrida marcó 2.491 ms — era cache frío, no costo.** Re-medida
tres veces en serie: **139 / 139 / 137 ms**. El 2.491 fue la primera consulta de
la sesión contra la base. Ver el riesgo #9 más abajo: no es un bloqueo, pero
tampoco es cero.

### Lectura de los planes

- **Cero `read` de disco en los 32 planes.** Todo `Shared Hit`, `Shared Read = 0`:
  los 90 MB de `analytics_events` viven en la cache compartida.
- **Ningún sequential scan sobre `analytics_events`.** Los cuatro índices
  existentes (`created_at`, `session`, `surface`, `container`, `country`,
  `account_ref`) cubren las ocho consultas. El planner elige el índice correcto
  por combinación de filtro sin ayuda.
- **Los tres seq scans son sobre `session_first_seen` (3.988 filas) y
  `account_first_seen` (3.077 filas)** — tablas de 4 K filas donde un seq scan es
  la elección correcta, no un defecto.
- **Estimaciones vs reales: exactas en 28 de 32.** Las cuatro discrepancias son
  todas `stats_activity_trend` con **200→30**: es la estimación por defecto de
  `generate_series`, que Postgres no puede conocer. Sin impacto — el nodo produce
  30 filas y el resto del plan no depende de esa cardinalidad.
- **Buffers: entre 30 K y 606 K bloques tocados** (240 MB – 4,7 GB de tráfico de
  buffers). El peor es `stats_activation_funnel` sin filtros y
  `stats_account_lifecycle` filtrado, ambos ~605 K.
- **Consulta más lenta (en caliente): `stats_top_countries` sin filtros, 357 ms.**
  Ninguna de las 32 pasa de 400 ms en caliente.

### ⛔ Bloqueos

| # | Consulta | Qué | Severidad |
|---|---|---|---|
| 1 | `stats_top_countries` · `surface=play` | **external merge, 2.232 kB a disco** | ⛔ bloqueo |
| 2 | `stats_top_countries` · `container=minipay` | **external merge, 3.264 kB a disco** | ⛔ bloqueo |
| 3 | `stats_habit_depth` · `surface=play` | **external merge, 3.432 kB a disco** | ⛔ bloqueo |

**Mecanismo, no misterio.** *Sin* filtro, `stats_top_countries` entra por
`idx_analytics_events_country`, que **ya viene ordenado por país**, así que el
agregado no necesita ordenar. *Con* `surface=play` el planner entra por
`idx_analytics_events_surface`, y entonces **sí** tiene que ordenar por país para
agrupar — y ese sort excede `work_mem` y se derrama a disco. Lo mismo en
`stats_habit_depth`, donde el `count(distinct fecha)` por sesión fuerza un sort
del conjunto filtrado.

**Es contraintuitivo y vale decirlo:** la versión **filtrada** derrama a disco y
la **sin filtrar** no. Nadie que probara sólo la vista por defecto lo vería.

**No lo arreglé, a propósito.** El encargo dice **no crear índices en esta sesión**
y **no cambiar la consulta persiguiendo milisegundos sin evidencia**. Los tres
derrames son de 2–3 MB — pequeños, y en una Micro con almacenamiento de red no
son gratis pero tampoco catastróficos a 4 lecturas cada 15 minutos. **Es una
decisión suya**, y hay tres caminos:

1. **Aceptar y aplicar.** 2–3 MB temporales, ~200 ms, cada 15 min por combinación.
2. **Subir `work_mem` a nivel de función** (`set work_mem = '8MB'` en el
   `create function`). Contenido a estas ocho, sin tocar la config global.
   Es una línea por función y elimina los tres derrames.
3. **Un índice `(surface, country, session_id)`** — pero eso es tocar índices,
   explícitamente fuera de alcance en esta sesión.

**Mi recomendación: la opción 2.** Es local a las funciones que la necesitan, no
cambia ninguna consulta, no toca índices, y ataca la causa medida en vez de
perseguir milisegundos a ciegas.

---

## 8ter. `work_mem = '8MB'` — aplicado y medido · **los tres derrames desaparecen**

Decisión del founder: opción 2, **sólo** en las dos funciones con derrame medido.

### `proconfig` final de las ocho

Leído de `pg_proc` tras reaplicar en el Postgres efímero con los default
privileges de Supabase simulados:

```
stats_access_funnel      | search_path=public
stats_account_lifecycle  | search_path=public
stats_activation_funnel  | search_path=public
stats_activity_trend     | search_path=public
stats_habit_depth        | search_path=public | work_mem=8MB   ⬅
stats_install_counts     | search_path=public
stats_retention          | search_path=public
stats_top_countries      | search_path=public | work_mem=8MB   ⬅
```

**Dos y sólo dos.** `SECURITY DEFINER`, `stable`, firmas y retornos sin cambios;
privilegios reverificados: **anon 0/8 · authenticated 0/8 · service_role 8/8**.

### ⚠️ Un gotcha que costó una medición falsa

**El primer intento midió con `PGOPTIONS="-c work_mem=8MB"` y dio EXACTAMENTE el
mismo plan que el default** — mismos `external merge`, mismos 2.248 / 3.280 /
3.456 kB. La conclusión fácil habría sido «8MB no alcanza». Es falsa.

**`PGOPTIONS` no atraviesa el pooler de Supavisor.** Verificado directo:

```
sin PGOPTIONS  → show work_mem = 3500kB
con PGOPTIONS  → show work_mem = 3500kB      ⬅ ignorado
con SET        → show work_mem = 8MB         ✅
```

La medición no había comparado dos configuraciones: había medido **dos veces la
misma**. La correcta usa un `SET` de sesión, que psql conserva entre varios `-c`
sobre una conexión. `SET work_mem` no escribe ni un dato; toda sentencia medida
sigue siendo un `SELECT`.

> Vale como invariante reusable: **contra este pooler, verificá que el ajuste
> tomó antes de creerle a la medición.** Un parámetro silenciosamente descartado
> produce un «no funcionó» perfectamente convincente.

### Los tres casos, antes y después

Servidor default medido: **`work_mem = 3500kB`**.

| Caso | work_mem | Sort Method | Memoria/Disco | Tipo | Exec ms |
|---|---|---|---|---|---|
| `top_countries` · `surface=play` | 3500kB | **external merge** | 2.248 kB | ⛔ **Disk** | 172 |
| `top_countries` · `surface=play` | **8MB** | **quicksort** | **6.050 kB** | ✅ **Memory** | **167** |
| `top_countries` · `container=minipay` | 3500kB | **external merge** | 3.280 kB | ⛔ **Disk** | 276 |
| `top_countries` · `container=minipay` | **8MB** | **quicksort** | **7.422 kB** | ✅ **Memory** | **276** |
| `habit_depth` · `surface=play` | 3500kB | **external merge** | 3.456 kB | ⛔ **Disk** | 125 |
| `habit_depth` · `surface=play` | **8MB** | **quicksort** | **6.642 kB** | ✅ **Memory** | **133** |

### Confirmaciones pedidas

| Criterio | Resultado |
|---|---|
| Cero `external merge` | ✅ los tres pasan a `quicksort` |
| Cero `Disk Usage` | ✅ `Sort Space Type` = `Memory` en los tres |
| Sort en memoria | ✅ |
| Memoria por sort **< 8MB** | ✅ 6.050 · 7.422 · 6.642 kB (tope 8.192 kB) |
| Tiempos no peores significativamente | ✅ −5 ms · ±0 ms · +8 ms (+6 %) |
| Resultados idénticos | ✅ byte a byte en los tres pares |

Los resultados de cada par se compararon corriendo la consulta real (no el
`EXPLAIN`) con y sin el ajuste, con segundos de diferencia:

```
top_countries play     NG|1029 NL|465 ZA|200 KE|199 ID|170 BR|151 UG|95 CI|62   (idéntico)
top_countries minipay  NG|1603 NL|771 KE|311 ZA|273 ID|249 BR|221 UG|132 GH|88  (idéntico)
habit_depth   play     1|2871 3|6 7|1 14|0 21|0 · cohorte 2871 · mediana 1      (idéntico)
```

### ⚠️ El margen es más estrecho de lo que sugiere el tamaño del derrame

**Un sort necesita bastante más memoria que lo que ocupan los mismos datos
empaquetados en disco.** El derrame de 3.280 kB necesita **7.422 kB** de
`work_mem` — un factor de **2,3×**.

Esto importa porque invita a un error de lectura: «derramó 3,2 MB, con 8 MB
sobra». No sobra. **`container=minipay` queda al 91 % de los 8 MB.** Hoy pasa,
pero no con holgura. Está escrito en el comentario de la migración, junto al
`set`, para que quien lo lea no repita la cuenta equivocada.

**Si ese combo vuelve a derramar al crecer el tráfico, el paso siguiente es un
índice que cubra `(surface, country, session_id)`, no un número más grande acá.**
Subir `work_mem` en una Micro se paga por conexión concurrente y tiene techo.

El `include` de vitest cubre `src/**/__tests__/**`, `scripts/**/__tests__/**` y
`../../scripts/ops/**/__tests__/**`. **No cubre `supabase/migrations/__tests__/`**.

El test de privilegios en la ruta que pidió el encargo **nunca se habría
recolectado**: 344 líneas de guard verdes por no existir. Agregué **una línea** de
`include`. Es el mismo modo de falla que estos guards existen para prevenir, así
que preferí arreglarlo antes que mover el archivo.

Alternativa si preferís no tocar la config: mover el test a
`apps/web/src/lib/stats/__tests__/`, donde ya viven dos precedentes que leen texto
de migraciones (`get-peones-canary-schema.test.ts`, `focus-day-ledger-schema.test.ts`).

---

## 10. Riesgos vigentes

| # | Riesgo | Severidad | Nota |
|---|---|---|---|
| 1 | **El anidado de prefijo baja los números de activación** | media | es correcto y es un **cambio visible**. Si el founder prefiere el conteo por paso independiente, hay que aceptar que el embudo puede volver a no ser monótono. **Decisión de producto, no técnica** |
| 2 | **`active_7d` no va a coincidir con el 3.062 de la auditoría** | media | por la costura calendario/móvil de §3.2. Esperado y documentado, **no** un defecto |
| 3 | **Los privilegios sólo están probados contra un Postgres local** | media | el default-privileges de Supabase está simulado fielmente, pero **la base real es la única prueba**. Correr `verify-stats-rpcs.ts` inmediatamente después de aplicar |
| 4 | **`census.total` sigue sin explicación** | media | intacto. **No cerrar `/stats` sin trazarlo** |
| 5 | **production y preview comparten la MISMA base** | media | toda cifra es la suma de los dos entornos. Rotularlo donde se afirme el número |
| 6 | **15,5 % de filas con `surface`/`container` NULL** | media | un filtro no-null las excluye → las vistas filtradas **no suman** a la sin filtrar. Declararlo en la superficie que afirma el número |
| 7 | ~~**Costo de las 8 RPC sobre una Micro sin medir**~~ | — | **CERRADO**: 32 planes medidos contra la base real (§8bis). Ninguna consulta pasa de 400 ms en caliente, cero seq scans sobre `analytics_events`, cero reads de disco |
| 8 | **`visit_id` sigue inutilizable** | alta si se usa | ninguna función lo lee; hay un test que lo prohíbe |
| 9 | **Cache frío: 2.491 ms en la primera consulta** | media | en caliente son 137 ms (medido 3×). Con `revalidate 900` sobre una ruta de bajo tráfico, **el visitante que dispara la revalidación paga la penalidad de cache frío**. Es exactamente el patrón que ya produjo la foto de 5 h 22 min. Mirarlo en Fase E, no acá |
| 10 | ~~**Tres consultas derraman a disco temporal**~~ | — | **CERRADO** con `set work_mem = '8MB'` en las dos funciones afectadas. Los tres pasan a `quicksort` en memoria, resultados idénticos (§8ter) |
| 12 | **`container=minipay` queda al 91 % de los 8 MB** | media | 7.422 kB de 8.192. Un sort necesita **2,3×** lo que ocupa el derrame en disco — leer el tamaño del derrame como requerimiento de memoria subestima por más del doble. Si vuelve a derramar, la salida es un índice `(surface, country, session_id)`, **no** un `work_mem` mayor |
| 13 | **`work_mem` se paga por conexión concurrente** | baja | 8 MB × sorts concurrentes. `/stats` son 95 invocaciones en 7 días y la caché las agrupa, así que la concurrencia real es ~1. A revisar si alguna vez se llama fuera de una ruta cacheada |
| 11 | **Hasta 606 K bloques de buffers por consulta** | media | ~4,7 GB de tráfico de buffers en el peor plan. Todo `hit`, cero `read`, pero no es trabajo gratis en una Micro. A vigilar cuando `analytics_events` crezca: la retención poda a 90 d y hoy son 156 K filas |

---

## 11. Diff estimado

| Alcance | Producción | Tests | SQL | Total |
|---|---|---|---|---|
| Nuevo | 879 (verificador) | 966 | **807** | **2.652** |
| Modificado | — | — | — | +6 (`vitest.config.ts`) |

El plan estimaba ~260 líneas de SQL; salieron **807**. La diferencia es casi toda
comentario: la migración explica cada decisión que un lector futuro podría
deshacer sin darse cuenta — el triple revoke, la costura calendario, el filtro que
va y el que no va, y el segundo `at time zone 'utc'` que evita que un servidor
no-UTC corra la ventana entera. Es la contramedida directa contra
[[feedback_duplicated_geometry_passes_every_behavioural_test]]: la prosa se copia
junto al código, así que la prosa tiene que ser correcta.

---

## 12. `git status --short` al cierre

```
 M SESSION.md
 M apps/web/vitest.config.ts
?? apps/web/supabase/migrations/20260805000000_stats_aggregation_rpcs.sql
?? apps/web/supabase/migrations/__tests__/
?? scripts/ops/verify-stats-rpcs.ts
?? scripts/ops/__tests__/verify-stats-rpcs.test.ts
```

`git diff --cached` **vacío**. `SESSION.md` fuera del stage, como pedía el encargo.

**No tocado:** `apps/landing`, variables de entorno, redirects, consumidores de
`apps/web`, `/api/profile/stats`, el monitor, la telemetría, el cron, la retención
y los índices.

---

## 13. Veredicto de seguridad para aplicar

| Eje | Estado |
|---|---|
| Corrección obligatoria del lifecycle | ✅ **aplicada y medida en los cinco bordes** |
| Las tres decisiones aprobadas (funnel, filtrado, vitest) | ✅ **sin cambios** |
| `work_mem` en exactamente dos funciones | ✅ **aplicado, `proconfig` verificado, derrames eliminados** |
| Privilegios | ✅ **verificados**: 0/8 para anon y authenticated bajo los default privileges de Supabase simulados; contrafactual medido |
| Suite, typecheck, diff, secretos | ✅ **todo verde** |
| Planes de consulta | ✅ **32 medidos · 32 limpios** · cero derrames · cero seq scans sobre `analytics_events` · máx 357 ms en caliente |
| **Veredicto** | ✅ **LISTO PARA APLICAR** |

**No queda ningún bloqueo abierto.** Las ocho funciones devuelven los valores
correctos (probado contra Postgres real con fixture y contra datos reales por
paridad), los privilegios cierran, y la presión sobre la Micro está medida y
mitigada donde hacía falta.

---

## 14. NEXT ACTION

> **Aplicar la migración a Supabase**, y acto seguido correr
> `scripts/ops/verify-stats-rpcs.ts` **contra la base real** — es la única prueba
> de que los privilegios tomaron y de que el `work_mem` quedó donde debe.
> Después, Fase B.

Sin preguntas abiertas.

**Al aplicar, esperar del verificador:**

- las ocho existen, `SECURITY DEFINER`, `search_path=public` exacto;
- `work_mem=8MB` en `stats_top_countries` y `stats_habit_depth`, **y en ninguna otra**;
- `anon` / `authenticated` / `public` sin `EXECUTE` en las ocho;
- paridad exacta contra las consultas de referencia en las 9 combinaciones;
- activación monótona, partición cerrada, 30 filas densas en el trend.
