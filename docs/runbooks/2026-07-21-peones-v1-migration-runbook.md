# Runbook — Peones V1 economy migration to production

**Fecha:** 2026-07-21
**Migración:** `20260721030000_peones_v1_economy.sql`
**Estado:** ensayada contra una réplica fiel de producción. **No aplicada a producción.**

---

## 0. Placeholders

Sustituir en todos los comandos de este documento:

| Placeholder | Qué es |
|---|---|
| `<REPO_ROOT>` | Raíz del checkout de chesscito |
| `<BACKUP_DIR>` | Carpeta del backup validado (sección 1) |
| `<BACKUP_COPY_DIR>` | Carpeta de la segunda copia verificada (sección 1) |

Cómodo para exportarlos una vez por sesión:

```bash
export REPO_ROOT="$(git rev-parse --show-toplevel)"
export BACKUP_DIR="$HOME/backups/chesscito/db/2026-07-21T16-14-25Z"
export BACKUP_COPY_DIR="$HOME/backups/chesscito-verified-copies/2026-07-21T16-14-25Z"
```

## 1. Backup validado

```
<BACKUP_DIR>/
```

Segunda copia verificada:

```
<BACKUP_COPY_DIR>/
```

| Archivo | Bytes | SHA-256 (16) |
|---|---:|---|
| `roles.sql` | 297 | `25873cec56a2cc65` |
| `schema.sql` | 82 660 | `b41a878f7272fb83` |
| `data.sql` | 7 584 456 | `e95dc6690332e7aa` |
| `migration_history.sql` | 127 879 | `6681bbd0a239b436` |

Ambas copias viven en el **mismo disco físico**. No es un respaldo off-site: si la máquina
falla, se pierden las dos. Es una limitación conocida y aceptada para este lanzamiento.

## 2. Baseline

### 2.1 Referencia histórica (al momento del backup, 2026-07-21T16:14Z)

| Objeto | Valor |
|---|---:|
| `public.peones_ledger` | 208 |
| `public.treasury_payment_intents` | 24 |
| `public.treasury_payment_consumptions` | 9 |
| `supabase_migrations.schema_migrations` | 28 |
| Última migración aplicada | `20260721020000` |

> ⚠️ **Estos números NO son el criterio de aceptación.** Son el estado en que se tomó el
> backup. Producción sigue recibiendo escrituras: para cuando se aplique la migración,
> `peones_ledger` casi con certeza será > 208. Compararlo contra 208 produciría una falsa
> alarma en el peor momento posible.

### 2.2 Baseline real: capturarlo justo antes de aplicar

**Correr esto contra producción inmediatamente antes del push**, y guardar la salida:

```sql
select
  now()                                                        as captured_at,
  (select count(*) from public.peones_ledger)                  as ledger,
  (select count(*) from public.treasury_payment_intents)        as intents,
  (select count(*) from public.treasury_payment_consumptions)   as consumptions,
  (select count(*) from supabase_migrations.schema_migrations)  as migrations,
  (select max(version) from supabase_migrations.schema_migrations) as latest;
```

**Verificar antes de seguir:** `migrations` = 28 y `latest` = `20260721020000`. Si no, el
historial remoto no es el que este runbook asume — **abortar** (sección 8).

Los tres conteos de datos son el baseline contra el que se compara después. La migración es
un `CREATE OR REPLACE` de una función: **no debe mover ninguno de los tres**. Un aumento
pequeño entre las dos capturas es tráfico normal, no daño — lo que importa es que ninguno
**baje**.

La migración a aplicar es **exactamente una**: `20260721030000`.

## 3. Qué cambia

Forward-only `CREATE OR REPLACE` de `public.peones_balance_with_caps(text, date)`.
Sin `DROP`, sin `ALTER`, sin mutación de datos. Ninguna fila del ledger se toca.

1. **FIX** — un `spend` con `pro_bypass = true` deja de restar del balance.
2. **Política** — el cap diario de earn gratuito baja de 6 a 3.

## 4. Orden de despliegue

1. Confirmar que el backup de la sección 1 existe y sus checksums coinciden.
2. **Capturar el baseline remoto (2.2) y guardarlo.** Sin esto no hay comparación válida
   después.
3. `supabase db push --dry-run` — leer la lista y confirmar que dice **una sola** migración.
4. Aplicar (sección 5).
5. Consultas post-migración (sección 6), comparando contra la captura del paso 2.
6. Smoke funcional (sección 7), incluido el chequeo de `leftovers`.
7. Desplegar la app solo después de que 5 y 6 estén en verde.

## 5. Comando exacto

**Primero, en seco:**

```bash
supabase db push --dry-run --workdir <REPO_ROOT>/apps/web
```

Debe listar **únicamente** `20260721030000_peones_v1_economy.sql`. Si lista más de una,
**abortar** — el historial remoto no es el que este runbook asume.

**Luego, de verdad:**

```bash
supabase db push --workdir <REPO_ROOT>/apps/web
```

> ⚠️ **`--linked` es el default de `db push`.** El comando sin flags apunta a
> **producción**. Para local hay que pasar `--local` explícitamente. No pasar
> `--include-all`, `--include-roles` ni `--include-seed`.

## 6. Consultas post-migración

```sql
-- (a) exactamente una migración nueva, y es la esperada
select count(*), max(version) from supabase_migrations.schema_migrations;
-- esperado: 29 | 20260721030000

-- (b) los datos no se movieron — misma consulta que 2.2, para comparar
select
  now()                                                        as captured_at,
  (select count(*) from public.peones_ledger)                  as ledger,
  (select count(*) from public.treasury_payment_intents)        as intents,
  (select count(*) from public.treasury_payment_consumptions)   as consumptions;
-- Comparar contra la captura de 2.2, NO contra 208/24/9.
-- Aceptable: igual, o levemente mayor (escrituras en vuelo).
-- Aborta: cualquiera de los tres MENOR que en 2.2.

-- (c) el cap quedó en 3
select daily_cap
from public.peones_balance_with_caps(
  (select wallet from public.peones_ledger limit 1), current_date
);
-- esperado: 3
```

## 7. Smoke funcional mínimo

Verifica el fix por **contraste**: el mismo gasto, con y sin `pro_bypass`. Se corre dentro
de una transacción que se revierte, así que no deja rastro.

`idempotency_key` lleva un sufijo único por corrida (`:run_id`). La columna tiene índice
único: reutilizar claves fijas haría fallar cualquier segunda ejecución, y —peor— podría
chocar con una clave real. Sustituir `:run_id` por algo irrepetible antes de correr, por
ejemplo la salida de `date -u +%Y%m%dT%H%M%SZ`.

```sql
\set run_id 'smoke-20260721T181500Z'   -- reemplazar por la corrida actual

begin;
insert into public.peones_ledger
  (wallet, event_type, amount, source, day_utc, pro_bypass, idempotency_key, attestation_hash)
values
  ('0x000000000000000000000000000000000000dead','earn', 10,'daily_tactic',current_date,false,:'run_id'||'-earn-bypass', 'h1'),
  ('0x000000000000000000000000000000000000dead','spend', 4,'hint',        current_date,true, :'run_id'||'-spend-bypass','h2'),
  ('0x000000000000000000000000000000000000beef','earn', 10,'daily_tactic',current_date,false,:'run_id'||'-earn-normal', 'h3'),
  ('0x000000000000000000000000000000000000beef','spend', 4,'hint',        current_date,false,:'run_id'||'-spend-normal','h4');

select 'bypass' as case, balance, daily_cap
  from public.peones_balance_with_caps('0x000000000000000000000000000000000000dead', current_date)
union all
select 'normal', balance, daily_cap
  from public.peones_balance_with_caps('0x000000000000000000000000000000000000beef', current_date);
rollback;
```

**Esperado:**

```
bypass | 10 | 3     ← el spend con pro_bypass NO resta
normal |  6 | 3     ← el spend normal SÍ resta
```

Si `bypass` devuelve 6, el fix no está activo → abortar (sección 8).

### Confirmar que el ROLLBACK no dejó nada

Buscar **las filas sintéticas por su propia clave**, no un total:

```sql
select count(*) as leftovers
from public.peones_ledger
where idempotency_key like 'smoke-%';   -- el :run_id de arriba
-- esperado: 0
```

> Contar `peones_ledger` y esperar un número fijo **no sirve** en producción: hay
> escrituras concurrentes, así que el total puede cambiar entre el `begin` y la
> verificación por razones que no tienen nada que ver con este smoke. Lo único que prueba
> que la transacción se revirtió es que **sus propias filas no estén**.

Si `leftovers` > 0, la transacción no se revirtió. Borrar esas filas por su
`idempotency_key` —y solo esas— antes de continuar.

## 8. Criterios de aborto

Abortar **antes** de aplicar si:

- El `--dry-run` lista más de una migración.
- Los checksums del backup no coinciden con `manifest.json`.
- La captura de 2.2 no da `migrations` = 28 y `latest` = `20260721020000`.
- No se pudo capturar el baseline de 2.2 (sin baseline no hay con qué comparar después).

Abortar **después** de aplicar (e ir a la sección 9) si:

- Cualquiera de los tres conteos de la consulta (b) es **menor** que en la captura de 2.2.
- `daily_cap` no devuelve 3.
- El smoke devuelve `bypass = 6` en lugar de 10.
- El chequeo de `leftovers` devuelve > 0 y no se puede limpiar.
- Cualquier error de la CLI durante el push.

## 9. Recuperación

**No hay rollback automático, y es deliberado.** La migración es un
`CREATE OR REPLACE` de una función: no borra ni altera datos, así que el escenario de
pérdida de datos no lo abre ella.

**Si solo la función quedó mal:** reaplicar la definición anterior, que vive en
`20260611010000_peones_labyrinth_completion_source.sql` — el último `CREATE OR REPLACE` de
`peones_balance_with_caps` antes de ésta. (`20260701150000_peones_shield_source.sql`
menciona la función pero **no** la redefine; verificado.)

Volver a esa definición **restaura los dos comportamientos viejos a la vez**: el cap
vuelve a `6::integer` y el `spend` con `pro_bypass = true` vuelve a restar del balance —
es decir, reintroduce el bug que esta migración arregla. No es un rollback limpio: es
volver al estado anterior, con su defecto incluido. Usarlo solo si la función nueva está
peor que el bug conocido.

**Si hace falta restaurar datos** (escenario ajeno a esta migración): el backup de la
sección 1 se restaura en un stack local con

```bash
pnpm --dir apps/web db:restore-local <BACKUP_DIR>
```

Ese script **solo restaura en local** — su guarda rechaza cualquier destino que no sea
`supabase_db_web` en `127.0.0.1:55322`. Restaurar sobre producción es un procedimiento
manual que este runbook no cubre y que requiere decisión humana explícita.

## 10. Deuda conocida — `daily_earned_capped`

`peones_balance_with_caps` devuelve `daily_earned_capped` **sin el cap aplicado**: en el
ensayo, con `daily_cap = 3`, esa columna devolvió `10`.

**No es un bug introducido por esta migración**, y **no debe cambiarse en este trabajo.**
La propia migración lo documenta en su cabecera como *"KNOWN, DELIBERATELY DEFERRED: the
cap is read then applied in two places"* — la función expone el cap y aplicarlo es
responsabilidad del llamador.

Queda registrado únicamente como **deuda conocida**: el nombre de la columna sugiere que el
valor ya viene capado, y quien lo lea sin abrir la migración va a asumir eso. Renombrarlo o
mover el capado adentro es un cambio funcional, con su propio spec, **después** del
lanzamiento.

## 11. Lo que este runbook no hace

- No aplica la migración: el comando de la sección 5 lo ejecuta una persona.
- No implementa rollback automático.
- No sube el backup a ningún servicio externo.
- No toca código de economía ni la migración.
