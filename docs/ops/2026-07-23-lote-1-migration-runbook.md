# Runbook — Observabilidad Lote 1: migraciones + smoke de producción

**Fecha:** 2026-07-23 · **PR de código:** `feat/observability-lote-1-code`
**Migraciones:** `20260723040000_analytics_dimensions.sql`, `20260723041000_session_first_seen.sql`

> ⛔ **NO aplicar a producción sin aprobación humana explícita.** Este documento deja el
> dry-run y las consultas pre/post listas; la ejecución la autoriza y corre un humano.
>
> **Orden obligatorio de release:**
> 1. PR de Privacy Policy (#270) **live en producción**.
> 2. Aplicar estas 2 migraciones (aditivas) — **requiere aprobación humana**.
> 3. Mergear el PR de código.

Ambas migraciones son **aditivas y backward-compatible**: `ADD COLUMN ... IF NOT EXISTS`
(metadata-only en PG11+, sin reescribir la tabla), `CREATE INDEX` no concurrente (toma un SHARE
lock breve durante el build — a volumen actual es trivial; `analytics_events` está podada a 90d),
CHECK `NOT VALID` (no escanea filas viejas), y `CREATE TABLE IF NOT EXISTS`. Sin `DROP`, sin
`ALTER TYPE`, sin backfill. Reversibilidad: ver §5.

---

## 1. Dry-run (sin persistir)

Correr contra una **copia**, nunca contra prod directo. Dos opciones:

**A. Supabase branch / snapshot restaurado (preferida).** Aplicar los dos archivos con el CLI
sobre una branch de preview o un restore del snapshot de prod, y correr las consultas POST (§4).

**B. Transacción con ROLLBACK** sobre una copia (valida sintaxis + que aplican sobre el schema
actual, sin dejar cambios):

```sql
begin;
\i supabase/migrations/20260723040000_analytics_dimensions.sql
\i supabase/migrations/20260723041000_session_first_seen.sql
-- correr las consultas POST (§4) aquí adentro para verificar el estado resultante
rollback;
```

> Ya ensayado localmente (docker `supabase_db_web`, 2026-07-23): ambas aplican limpio, son
> idempotentes (constraint DO-guarded), el CHECK rechaza `us` / acepta `US`/`null`, y el
> `on conflict do nothing` conserva la cohorte original.

---

## 2. Consultas PRE (estado esperado ANTES de aplicar)

```sql
-- (a) Las 8 columnas NO deben existir todavía → 0 filas
select column_name from information_schema.columns
where table_name = 'analytics_events'
  and column_name in ('surface','container','locale','country',
                      'source','campaign','app_version','visit_id');

-- (b) El CHECK de country NO debe existir → 0 filas
select conname from pg_constraint where conname = 'analytics_events_country_iso2';

-- (c) La tabla de cohortes NO debe existir → NULL
select to_regclass('public.session_first_seen');

-- (d) Baseline de filas (para comparar POST y descartar pérdida de datos)
select count(*) as analytics_events_rows_pre from analytics_events;
```

---

## 3. Aplicar (SOLO con aprobación humana)

```sql
\i supabase/migrations/20260723040000_analytics_dimensions.sql
\i supabase/migrations/20260723041000_session_first_seen.sql
```

(o `supabase db push` apuntando al proyecto de prod, según el flujo del founder.)

---

## 4. Consultas POST (estado esperado DESPUÉS de aplicar)

```sql
-- (a) Las 8 columnas presentes, todas nullable, text → 8 filas is_nullable='YES'
select column_name, is_nullable, data_type from information_schema.columns
where table_name = 'analytics_events'
  and column_name in ('surface','container','locale','country',
                      'source','campaign','app_version','visit_id')
order by column_name;

-- (b) Los 3 índices nuevos → 3 filas
select indexname from pg_indexes
where tablename = 'analytics_events'
  and indexname in ('idx_analytics_events_surface',
                    'idx_analytics_events_container',
                    'idx_analytics_events_country');

-- (c) CHECK presente y NOT VALID → 1 fila, convalidated = false
select conname, convalidated from pg_constraint
where conname = 'analytics_events_country_iso2';

-- (d) Tabla de cohortes + índice + PK + RLS habilitada
select to_regclass('public.session_first_seen');                 -- session_first_seen
select indexname from pg_indexes where tablename = 'session_first_seen';
select relrowsecurity from pg_class where relname = 'session_first_seen';  -- t

-- (e) Sin pérdida de datos: igual al baseline PRE (d)
select count(*) as analytics_events_rows_post from analytics_events;

-- (f) El CHECK funciona (test seguro, con rollback)
begin;
  insert into analytics_events(session_id, event, country) values ('runbook','post_check','US'); -- OK
  -- La línea siguiente DEBE fallar con SQLSTATE 23514 (country lowercase):
  -- insert into analytics_events(session_id, event, country) values ('runbook','post_check','us');
rollback;
```

---

## 5. Rollback (si hiciera falta)

Aditivo ⇒ reversible sin pérdida de datos de negocio (las columnas nuevas están vacías en filas
existentes):

```sql
drop index if exists idx_analytics_events_surface;
drop index if exists idx_analytics_events_container;
drop index if exists idx_analytics_events_country;
alter table analytics_events drop constraint if exists analytics_events_country_iso2;
alter table analytics_events
  drop column if exists surface, drop column if exists container,
  drop column if exists locale, drop column if exists country,
  drop column if exists source, drop column if exists campaign,
  drop column if exists app_version, drop column if exists visit_id;
drop table if exists session_first_seen;
```

> Solo tiene sentido si aún no se escribieron dimensiones. Una vez que hay datos en las columnas,
> el rollback los descarta — evaluar antes.

---

## 6. Smoke checklist de producción (tras deploy del PR de código)

Correr con el código ya desplegado y las migraciones aplicadas.

### 6.1 Dimensiones
- [ ] Abrir la app live y disparar un evento (p.ej. ver el hub). Luego:
```sql
select event, surface, container, locale, source, app_version, visit_id, country, created_at
from analytics_events order by created_at desc limit 10;
```
- [ ] `surface` ∈ {learn, play}; `container` ∈ {minipay, browser}; `locale` seteado;
      `app_version` = sha de 7 chars (no `dev`); `visit_id` seteado; `country` = código de 2
      letras (o `null` si el edge no mandó el header).

### 6.2 `app_opened` once-per-visit
- [ ] Pestaña nueva → exactamente **un** `app_opened` para ese `visit_id`. Verificar que ninguno
      se duplique:
```sql
select visit_id, count(*) from analytics_events
where event = 'app_opened' and created_at > now() - interval '1 hour'
group by visit_id having count(*) > 1;   -- esperado: 0 filas
```

### 6.3 `session_first_seen`
- [ ] Primer `app_opened` de un install nuevo inserta una fila; una segunda visita NO la sobrescribe:
```sql
select session_id, first_seen, first_surface, first_container, first_country, first_source
from session_first_seen order by first_seen desc limit 10;
```
- [ ] `first_seen` estable para el mismo `session_id` entre visitas.

### 6.4 Filtros `/stats`
- [ ] Cargar `/stats`, `/stats?surface=learn`, `/stats?surface=play&container=minipay`, y un
      inválido `/stats?surface=bogus`.
- [ ] Los chips reflejan el filtro activo; el inválido cae a **All**; los números cambian por
      filtro (App Opens, activación, top countries, retención D1/D7); la página nunca 500ea;
      el sello "as of" está presente.

### 6.5 Privacidad + fail-open
- [ ] En `country` solo aparecen códigos de 2 letras — ningún IP/ciudad/coordenada en ninguna
      columna ni en `props`.
- [ ] Bloquear `/api/telemetry` (outage simulado) NO rompe ninguna acción de usuario.
- [ ] Dentro del WebView de MiniPay (device real) `container` = `minipay`.

Wolfcito 🐾 @akawolfcito
