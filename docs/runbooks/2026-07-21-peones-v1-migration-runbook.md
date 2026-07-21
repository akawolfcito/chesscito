# Runbook — Peones V1 economy migration to production

**Fecha:** 2026-07-21
**Migración:** `20260721030000_peones_v1_economy.sql`
**Estado:** ensayada contra una réplica fiel de producción. **No aplicada a producción.**

---

## 1. Backup validado

```
/Users/wolfcito/backups/chesscito/db/2026-07-21T16-14-25Z/
```

Segunda copia verificada:

```
/Users/wolfcito/backups/chesscito-verified-copies/2026-07-21T16-14-25Z/
```

| Archivo | Bytes | SHA-256 (16) |
|---|---:|---|
| `roles.sql` | 297 | `25873cec56a2cc65` |
| `schema.sql` | 82 660 | `b41a878f7272fb83` |
| `data.sql` | 7 584 456 | `e95dc6690332e7aa` |
| `migration_history.sql` | 127 879 | `6681bbd0a239b436` |

Ambas copias viven en el **mismo disco físico**. No es un respaldo off-site: si la máquina
falla, se pierden las dos. Es una limitación conocida y aceptada para este lanzamiento.

## 2. Baseline conocido (producción, al momento del backup)

| Objeto | Valor |
|---|---:|
| `public.peones_ledger` | **208** |
| `public.treasury_payment_intents` | **24** |
| `public.treasury_payment_consumptions` | **9** |
| `supabase_migrations.schema_migrations` | **28** |
| Última migración aplicada | `20260721020000` |

La migración a aplicar es **exactamente una**: `20260721030000`.

## 3. Qué cambia

Forward-only `CREATE OR REPLACE` de `public.peones_balance_with_caps(text, date)`.
Sin `DROP`, sin `ALTER`, sin mutación de datos. Ninguna fila del ledger se toca.

1. **FIX** — un `spend` con `pro_bypass = true` deja de restar del balance.
2. **Política** — el cap diario de earn gratuito baja de 6 a 3.

## 4. Orden de despliegue

1. Confirmar que el backup de la sección 1 existe y sus checksums coinciden.
2. `supabase db push --dry-run` — leer la lista y confirmar que dice **una sola** migración.
3. Aplicar (sección 5).
4. Consultas post-migración (sección 6).
5. Smoke funcional (sección 7).
6. Desplegar la app solo después de que 4 y 5 estén en verde.

## 5. Comando exacto

**Primero, en seco:**

```bash
supabase db push --dry-run --workdir /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web
```

Debe listar **únicamente** `20260721030000_peones_v1_economy.sql`. Si lista más de una,
**abortar** — el historial remoto no es el que este runbook asume.

**Luego, de verdad:**

```bash
supabase db push --workdir /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web
```

> ⚠️ **`--linked` es el default de `db push`.** El comando sin flags apunta a
> **producción**. Para local hay que pasar `--local` explícitamente. No pasar
> `--include-all`, `--include-roles` ni `--include-seed`.

## 6. Consultas post-migración

```sql
-- (a) exactamente una migración nueva, y es la esperada
select count(*), max(version) from supabase_migrations.schema_migrations;
-- esperado: 29 | 20260721030000

-- (b) los datos no se movieron
select
  (select count(*) from public.peones_ledger)                  as ledger,
  (select count(*) from public.treasury_payment_intents)        as intents,
  (select count(*) from public.treasury_payment_consumptions)   as consumptions;
-- esperado: 208 | 24 | 9

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

```sql
begin;
insert into public.peones_ledger
  (wallet, event_type, amount, source, day_utc, pro_bypass, idempotency_key, attestation_hash)
values
  ('0x000000000000000000000000000000000000dead','earn', 10,'daily_tactic',current_date,false,'rb-earn-1','h1'),
  ('0x000000000000000000000000000000000000dead','spend', 4,'hint',        current_date,true, 'rb-spend-bypass','h2'),
  ('0x000000000000000000000000000000000000beef','earn', 10,'daily_tactic',current_date,false,'rb-earn-2','h3'),
  ('0x000000000000000000000000000000000000beef','spend', 4,'hint',        current_date,false,'rb-spend-normal','h4');

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

Si `bypass` devuelve 6, el fix no está activo. Confirmar el `rollback` con:

```sql
select count(*) from public.peones_ledger;  -- debe seguir en 208
```

## 8. Criterios de aborto

Abortar **antes** de aplicar si:

- El `--dry-run` lista más de una migración.
- Los checksums del backup no coinciden con `manifest.json`.
- `schema_migrations` en producción no tiene 28 filas, o su máximo no es `20260721020000`.

Abortar **después** de aplicar (e ir a la sección 9) si:

- Los conteos de la consulta (b) difieren de 208 / 24 / 9.
- `daily_cap` no devuelve 3.
- El smoke devuelve `bypass = 6` en lugar de 10.
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
pnpm --dir apps/web db:restore-local /Users/wolfcito/backups/chesscito/db/2026-07-21T16-14-25Z
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
