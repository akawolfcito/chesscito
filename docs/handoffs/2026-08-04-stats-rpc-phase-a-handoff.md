# Handoff — `/stats`: Fase A, las ocho RPC de agregación

**Fecha:** 2026-08-04 · **Commit desplegado y validado:** `b90ee4f6f0f2`
**Etapa que se cierra:** auditoría de exactitud de `/stats` + hotfix de honestidad.
**Etapa que se abre:** **Fase A** — migración SQL y privilegios.

---

## 1. Estado actual

### 1.1 Producción — validado

| Eje | Estado |
|---|---|
| Commit productivo | **`b90ee4f6f0f2`** |
| `play.chesscito.com` | **HTTP 200** |
| `learn.chesscito.com` | **HTTP 200** |
| Deployments | **READY** |
| 5XX | **cero** |
| `/api/telemetry` | **sin errores** |
| Monitor | 🟢 **GREEN (partial)** |
| p95 poblacional 24 h | **73** sobre **2.339 sesiones** — a 2,7× del umbral 200 |
| Métricas exactas | **visibles** |
| Métricas afectadas por truncamiento | **`—`** |
| Números parciales presentados como totales | **ninguno** |
| `/stats` | **pública y sin wallet** — MiniPay §8 intacto |

### 1.2 La causa raíz, confirmada

> **PostgREST limita cada lectura a 1.000 filas, y un `.range()` explícito NO lo
> levanta.** Medido contra el REST de producción: pedir `Range: 0-9999` devuelve
> `Content-Range: 0-999/3066`.

Como toda lectura del agregador iba ordenada `created_at desc`, el recorte no era
una muestra: era **el prefijo más nuevo**. Los 1.000 eventos más recientes
abarcan **14,9 minutos**, así que la página publicaba ese cuarto de hora bajo
etiquetas que decían **7 días** y **30 días**.

El guardián que debía avisarlo comparaba contra **10.000** — un tamaño que el
servidor no puede devolver — así que la condición era **insatisfacible** y el
aviso **nunca disparó**.

Detalle completo: `docs/audits/2026-08-04-public-stats-accuracy-audit.md` §9.

### 1.3 Qué hizo el hotfix, y qué **no**

**Hizo:** apagar las cifras falsas. Techo real a 1.000 en los dos archivos que
copiaron la constante **y su comentario falso**; `hitCeiling` disparando de
verdad; `known` / `newToday` / `new7d` desde `count: "exact", head: true`; toda
métrica de ventana construida sobre una lectura capada devuelta como `null`;
copy del aviso diciendo *temporalmente no disponible*, **no** *lower bounds*;
sello de snapshot en vez de «Updated hourly»; y el censo declarando su caída y
su antigüedad en vez de desaparecer.

**No hizo:** recuperar ni una métrica. Eso es Fase A–C.

### 1.4 Lo que sigue sin existir

| | Estado |
|---|---|
| Canonical definitivo | **`https://www.chesscito.com/stats`** — decidido, **no construido** |
| Landing `/stats` | **sigue siendo el selector Learn / Play** de dos botones |
| Play y Learn | **siguen alojando sus páginas de stats completas** |
| RPC robustas | **no existen** |
| Cliente Supabase en el landing | **no existe** |
| Credenciales de Supabase en `chesscito-landing` | **no existen** |
| Redirects | **no existen** |
| `/api/profile/stats` | **NO fue tocado** — es el perfil del jugador, privado y por wallet. Comparte el substring `stats` y nada más |

---

## 2. Commits relevantes

*(SHAs verificados con `git log` antes de escribirlos.)*

| SHA | Commit | Qué |
|---|---|---|
| `b7b070c60ee7` | `docs(stats): audit accuracy and landing consolidation` | auditoría de exactitud + §21 de consolidación |
| `ebdc5c1cc5cc` | `fix(stats): stop publishing truncated public metrics` | hotfix mínimo · 10 archivos · suite 7.172 passing / 589 files |
| `b90ee4f6f0f2` | `docs(stats): plan robust landing consolidation` | plan ejecutable A–H · **es el commit desplegado y validado** |

---

## 3. Plan vigente

**Referencia:** `docs/plans/2026-08-04-stats-consolidation-execution-plan.md`

| Fase | Qué | Estado |
|---|---|---|
| **A** | RPC y privilegios | **← la próxima** |
| B | cliente server-only del landing | pendiente |
| C | agregador | pendiente |
| D | UI | pendiente |
| E | caché | pendiente |
| F | validación | pendiente |
| G | redirects 307 | pendiente |
| H | observación, 308 y retirada del código antiguo | pendiente |

El plan trae, por fase: archivos, dependencias, tests, rollback, criterio de
aceptación y commit propuesto. **No re-derivarlo — leerlo.**

---

## 4. Próxima fase, exclusiva: **Fase A**

### 4.1 Las ocho funciones

Todas `SECURITY DEFINER`, todas con `search_path` fijado, todas tomando
`p_surface text default null` y `p_container text default null` (null = sin filtro).

| Función | Devuelve |
|---|---|
| `stats_install_counts` | `sessions_7d`, `sessions_30d`, `app_opens_rows_30d`, `app_open_sessions_30d` |
| `stats_activation_funnel` | `(step, sessions)` — **scopeada a la cohorte de `app_opened`** |
| `stats_access_funnel` | `(step, sessions)` + `failed_sessions` |
| `stats_top_countries` | `(country, sessions)`, top 8 |
| `stats_retention` | `(bucket, returned, cohort)` para `d1`, `d7`, `week3` |
| `stats_account_lifecycle` | `known`, `new_today`, `new_7d`, `active_7d`, `dormant`, `inactive`, `resurrected_7d` |
| `stats_habit_depth` | `(min_days, installs)` + `cohort` + `median_active_days` |
| `stats_activity_trend` | 30 filas densas: `day`, `sessions`, `new_installs`, `returning_installs` |

### 4.2 Privilegios — los **tres** `REVOKE`

```sql
revoke execute on function public.stats_<n>(text, text) from public;
revoke execute on function public.stats_<n>(text, text) from anon;
revoke execute on function public.stats_<n>(text, text) from authenticated;
```

⛔ **`REVOKE EXECUTE FROM PUBLIC` NO alcanza en Supabase.** Los default privileges
otorgan `EXECUTE` **explícito** a `anon` y `authenticated`; revocar sólo de
`public` deja la función expuesta a cualquiera con la anon key.

⚠️ **Y un regex sobre el `.sql` pasa en verde con la función expuesta.** La
validación tiene que correr **contra la base real**, leyendo `proacl` /
`has_function_privilege('anon', …, 'EXECUTE')`.

### 4.3 Invariantes que las funciones deben satisfacer

- `session_id` nulo o vacío **excluido**; `account_ref` nulo **excluido**.
- Embudo de activación **scopeado a la cohorte** → monótono por construcción.
  Hoy la página muestra `App opened 37 < Hub viewed 41`.
- `new_today` = `first_seen >= date_trunc('day', now() at time zone 'UTC')`.
- `new_7d` = **ventana móvil de 7 días**, y la etiqueta lo dice — **no** «this
  week». El producto ya usa semana UTC desde el lunes en Leaders Weekly, y dos
  definiciones de «semana» en el mismo producto es un defecto aunque las dos
  estén bien calculadas.
- `active_7d + dormant + inactive = known`, verificable en SQL.
- `week3` = **ventana días 15–21**, no día 21 exacto.
- `stats_activity_trend` devuelve **exactamente 30 filas**, ceros incluidos.

### 4.4 Paridad

Comparar cada función contra las **consultas SQL de referencia** de la auditoría
(§6 y §22), sobre **la misma ventana**, tolerando sólo la deriva de minutos.

Valores de referencia del 2026-08-04 (~18:15–18:28 UTC):

```
sesiones 7d 3.927 · 30d 6.446        app_opened sesiones 30d 3.976
cuentas históricas 3.063             cuentas activas 7d 3.062
cuentas inactivas 30d 0              cohorte D1 1.562 · D7 107
países 30d: NG 1462 · NL 677 · KE 281 · ZA 244 · ID 223 · BR 188 · UG 123 · CO 103
```

### 4.5 Lo que la Fase A **no** hace

**No modifica consumidores.** El agregador de `apps/web` no se toca: las
funciones quedan creadas y sin llamar. Por eso su rollback es `drop function` y
cuesta cero.

---

## 5. Riesgos vigentes

| # | Riesgo | Severidad | Nota |
|---|---|---|---|
| 1 | **`SECURITY DEFINER` mal protegida** | **alta** | los tres `REVOKE` + validación contra `proacl` en la base real. Un regex sobre la migración no prueba nada |
| 2 | **`census.total` sigue sin explicación** | media | es `null` en producción mientras el mismo `HEAD … Prefer: count=exact` contra `leaderboard_full_v` responde `0-290/291` desde local. **No cerrar `/stats` sin trazarlo** |
| 3 | **Production y preview comparten la MISMA base Supabase** | media | toda cifra es la suma de los dos entornos. Rotularlo donde se afirme el número |
| 4 | **`session_id` no representa una visita** | media | no rota entre visitas: 217 sesiones abarcan hasta 8 visitas en 21 h. Por eso el contrato lo llama **install**, nunca «sesión» |
| 5 | **`visit_id` NO es usable todavía** | **alta si se usa** | es **más grueso** que `session_id` (4.898 distintos contra 6.450) y **nulo en 15,5 %** de las filas. Contradice el pendiente 7 del handoff de estabilización: no sustituirlo hasta entender por qué |
| 6 | **Duplicados exactos inflan los conteos de FILAS** | media | 8,6 % de las filas en 24 h, mismo evento y mismo `created_at`. Los contratos cuentan **entidades distintas**, así que sólo lo hereda `app_opens_rows_30d`, que por eso se declara aproximada |
| 7 | **Redirects antes de que la Fase F esté verde** | **alta** | el link del listing de MiniPay apunta al destino. Redirigir hacia una página a medias manda al reviewer a un error |
| 8 | **La Data Cache de Next no se purga al desplegar** | media | un censo caído sobrevivió 18 h 34 min **y un deploy entero**. La invalidación necesita `revalidateTag`, no un redeploy |

---

## 6. Restricciones de la próxima sesión

- **No tocar el landing.**
- **No añadir variables de entorno.**
- **No añadir redirects.**
- **No modificar `/api/profile/stats`.**
- **No tocar el monitor.**
- **No tocar la telemetría.**
- **No tocar cron, retención ni índices.**
- **No aplicar ninguna migración en esta sesión** — Fase A es diseño y revisión.
- **No asumir que `REVOKE FROM PUBLIC` es suficiente.**
- **`SESSION.md` fuera del stage.**

### Recordatorios operativos

- 🩺 Correr **`pnpm ops:health`** antes de abrir paneles a mano. ⚠️ `pnpm run`
  colapsa los exit codes no-cero a 1.
- ⛔ **No verificar deploys por iniciativa propia** — el founder lo ve en <1 s.
- **No imprimir wallets, `account_ref` ni `session_id` en crudo.** Usar
  `left(md5(...), 10)`, como en la auditoría del p95.
- ⛔ **`/stats` no se gatea.** Es un entregable del listing de MiniPay (§8):
  debe seguir pública y sin wallet. Alcanzable ≠ indexable.

---

## 7. NEXT ACTION

> Diseñar y revisar la migración de las ocho RPC de estadísticas, incluyendo
> firmas, tipos de retorno, search_path, privilegios, filtros, invariantes y
> consultas de paridad. Detenerse antes de aplicarla a Supabase.

---

## 8. Referencias

| Documento | Para qué |
|---|---|
| `docs/audits/2026-08-04-public-stats-accuracy-audit.md` | causa raíz, contratos §13, consolidación §21, SQL de referencia §22 |
| `docs/plans/2026-08-04-stats-consolidation-execution-plan.md` | **empezar acá** — Fase A con archivos, tests, rollback y criterio de aceptación |
| `docs/handoffs/2026-08-04-public-stats-audit-handoff.md` | el encargo que abrió la auditoría |
| `docs/handoffs/2026-08-04-launch-stabilization-handoff.md` | estado estable heredado |
| `docs/audits/2026-08-04-telemetry-session-p95-audit.md` | duplicados, persistencia de `session_id`, y el mismo error de categoría en otra forma |
| `docs/runbooks/launch-health-monitor.md` | operar el monitor |
