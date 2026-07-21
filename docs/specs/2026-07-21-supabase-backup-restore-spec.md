# Spec — Respaldo de Supabase y restauración local

**Fecha:** 2026-07-21
**Estado:** aceptado, no implementado
**Motivo inmediato:** la migración `20260721030000_peones_v1_economy.sql` está en el repo
pero **no aplicada a producción**. No se aplica hasta que exista un respaldo verificado.

---

## Problema

El proyecto corre en el free tier de Supabase, que **no incluye backups automáticos**.
Hoy no existe ninguna copia de la base de producción, y tampoco una forma de ensayar
una migración contra datos reales antes de aplicarla.

Dos necesidades, una sola herramienta:

1. **Respaldo** — tener la base en disco, recuperable.
2. **Réplica local** — poder ensayar migraciones contra una copia fiel, en Docker,
   sin tocar producción.

## No-objetivos (decididos, fuera de alcance)

- **Retención / rotación de backups viejos.** Cada corrida acumula. Se limpia a mano.
  Razón: el borrado automático es la parte que, con un bug, destruye el respaldo que
  necesitabas. El script arranca sin dientes.
- **Subida off-site (S3 / R2 / Drive).** El respaldo vive solo en la máquina del founder.
  Razón: abre un frente propio — proveedor, credenciales, y cifrado obligatorio del dump
  (contiene datos de jugadores). Merece su propio spec, después de que este flujo se use.

Ambos son el siguiente paso natural, no parte de éste.

---

## Contexto verificado del entorno

Medido en la máquina, no asumido:

| Cosa | Valor |
|---|---|
| Supabase CLI | `2.98.2` (hay `2.109.1` disponible; no requerido) |
| Docker | `29.2.0` |
| `pg_dump` en el host | **no existe** — todo pasa por contenedores |
| Proyecto linkeado | ref en `apps/web/supabase/.temp/project-ref` |
| `project_id` local | `web` → contenedor `supabase_db_web` |
| Puerto DB local | `55322` (`config.toml:29`) |
| Password de prod | `SUPABASE_DB_PASSWORD` en `apps/web/.env` |
| Destino de dumps | `private/` — ya gitignored (`.gitignore:112`) |
| Runner de scripts | `tsx` (`apps/web/package.json:24-32`) |
| Tests de scripts | `vitest.config.ts:13` ya incluye `scripts/**/__tests__/**` |

---

## Arquitectura

Tres comandos, un módulo de lógica pura compartida. Todo bajo `apps/web/scripts/db/`.

```
apps/web/scripts/db/
  lib.ts               # lógica pura, sin I/O de red — la parte testeable
  backup.ts            # prod  → disco
  restore-local.ts     # disco → stack local
  verify-restore.ts    # compara local contra el manifiesto
  __tests__/lib.test.ts
```

**Regla de higiene de comandos** (CLAUDE.md): ninguna invocación usa `cd`. Todas las
llamadas a la CLI pasan `--workdir apps/web`.

---

## Componente 1 — `backup.ts`

**Comando:** `pnpm db:backup`

Crea `private/backups/db/<UTC-ISO-timestamp>/` con cinco archivos:

| Archivo | Comando | Por qué |
|---|---|---|
| `roles.sql` | `supabase db dump --linked --role-only` | Roles del cluster y sus grants |
| `schema.sql` | `supabase db dump --linked` | DDL completo |
| `data.sql` | `supabase db dump --linked --data-only --use-copy` | Filas, en formato `COPY` |
| `migration_history.sql` | `supabase db dump --linked --data-only --schema supabase_migrations` | **Ver abajo — el detalle que hace funcionar todo** |
| `manifest.json` | generado | Metadatos + integridad |

### Por qué `migration_history.sql` no es opcional

`supabase db dump` **no** incluye el schema `supabase_migrations` por defecto. Ese schema
es el registro de qué migraciones ya corrieron.

Sin él, al restaurar en local la CLI cree que la base está virgen y
`supabase migration up` intenta aplicar **las 29 migraciones** — la mayoría contra objetos
que ya existen. Falla, y el fallo no dice nada sobre la migración que querías probar.

Con él, la réplica local sabe exactamente dónde quedó producción, y `supabase migration up`
aplica **solo la pendiente**. Que es precisamente el ensayo que este spec existe para hacer.

### `manifest.json`

```jsonc
{
  "createdAt": "2026-07-21T18:04:11Z",
  "projectRef": "brsbd…",              // ref del proyecto linkeado
  "gitSha": "2c58a4de",                 // HEAD del repo al momento del dump
  "latestMigration": "20260721020000_get_peones_intent_expiry_reuse.sql",
  "cliVersion": "2.98.2",
  "files": [
    { "name": "schema.sql", "bytes": 84210, "sha256": "…" }
    // … uno por archivo
  ],
  "tableRows": { "public.peones_ledger": 1420, "public.score_saves": 87 }
}
```

`tableRows` se deriva **del propio `data.sql`**, contando líneas dentro de cada bloque
`COPY … FROM stdin;` hasta su terminador `\.`. Sin red, sin `psql`, sin segunda consulta
que pueda desincronizarse. `pg_dump` escapa los backslashes en la salida `COPY`, así que
un `\.` solo en su línea no puede aparecer dentro de los datos — el parseo es seguro.

### Manejo de secretos

- La password se lee de `apps/web/.env` y se pasa a la CLI por **variable de entorno**
  (`SUPABASE_DB_PASSWORD`), nunca como argumento en la línea de comando (los argumentos
  son visibles en `ps`).
- El script **nunca** imprime la password, ni el `project ref` completo, ni la connection
  string. El log de salida son rutas, tamaños y conteos.

### Errores

Falla ruidosa y temprana, sin dejar una carpeta a medias:
- `SUPABASE_DB_PASSWORD` ausente → abortar con instrucción de dónde ponerla.
- Cualquier `db dump` con exit code ≠ 0 → **borrar la carpeta parcial** y abortar.
  Un backup incompleto que parece completo es peor que ninguno.
- Un `data.sql` de 0 bytes se trata como fallo, no como "base vacía".

---

## Componente 2 — `restore-local.ts`

**Comando:** `pnpm db:restore-local <backup-dir>`

1. Verificar que el directorio tiene los 5 archivos y que cada `sha256` coincide con el
   manifiesto. Si un dump se corrompió, se sabe **antes** de restaurar.
2. `supabase start --workdir apps/web` (idempotente si ya corre).
3. **Guarda de seguridad** (ver abajo).
4. Dropear y recrear la base local, y aplicar los dumps en orden:
   `roles.sql` → `schema.sql` → `data.sql` → `migration_history.sql`.
   Se ejecutan con `docker exec -i supabase_db_web psql -U postgres` — el host no tiene
   `psql`, el contenedor sí.

### La guarda anti-producción

Es el requisito de seguridad central del spec. `restore-local.ts` es un script
**destructivo**: borra la base a la que apunta.

Antes de emitir un solo comando destructivo:

```
assertLocalTarget(dbUrl)
```

Aborta salvo que **todo** esto sea cierto:
- host ∈ { `127.0.0.1`, `localhost` }
- puerto === `55322`
- el nombre del contenedor destino empieza con `supabase_db_`

La URL no se construye a mano: se lee de `supabase status -o env --workdir apps/web`, y
se valida. Si el stack local no corre, o si el status devuelve algo que no pasa la guarda,
el script **no adivina** — aborta.

`assertLocalTarget` vive en `lib.ts` como función pura sobre un string, así que se testea
sin Docker, sin red y sin base.

---

## Componente 3 — `verify-restore.ts`

**Comando:** `pnpm db:verify <backup-dir>`

Responde con evidencia la pregunta *"¿la copia sirve?"*. Consulta la base local y compara
contra `manifest.json`:

1. **Tablas presentes** — cada tabla del manifiesto existe localmente.
2. **Conteo de filas** — `SELECT count(*)` local === `tableRows[tabla]`. Reporta cada
   diferencia, no solo la primera.
3. **Historial de migraciones** — `supabase_migrations.schema_migrations` no está vacío y
   su última entrada coincide con `latestMigration` del manifiesto.

Salida: una tabla legible + exit code. `0` = la réplica es fiel. `≠0` = no lo es, con el
detalle de qué no cuadra.

Lo que este paso valida es la **fidelidad de la restauración** — el tramo riesgoso, donde
un dump truncado o un `COPY` fallado pasan desapercibidos. La integridad del dump contra
producción la cubren el exit code de `pg_dump` y los `sha256`.

---

## Flujo de uso

```bash
pnpm db:backup                        # 1. respaldo de producción
pnpm db:restore-local private/backups/db/2026-07-21T18-04-11Z
pnpm db:verify        private/backups/db/2026-07-21T18-04-11Z   # ← acá se sabe

supabase migration up --workdir apps/web   # 2. ensayo de la migración pendiente, en local
```

Con `db:verify` en verde y `migration up` en verde, recién ahí se aplica a producción.

---

## Plan de tests (SDD → TDD → EDD)

`lib.ts` concentra la lógica que puede estar mal en silencio. Se escriben los tests primero:

| Función | Casos |
|---|---|
| `assertLocalTarget(url)` | acepta `127.0.0.1:55322` y `localhost:55322`; **rechaza** host remoto, rechaza puerto distinto, rechaza string vacío o malformado, rechaza una URL de `supabase.co` |
| `countCopyRows(sql)` | cuenta un bloque `COPY`; cuenta varios; devuelve 0 para una tabla sin filas; no confunde un `\.` que aparece dentro de un valor; ignora comentarios y `SET` |
| `parseManifest(json)` | rechaza manifiesto sin `files`, sin `tableRows`, o con versión desconocida |
| `diffRowCounts(expected, actual)` | sin diferencias → lista vacía; reporta faltantes, sobrantes y tablas ausentes **todos juntos** |

Los tres scripts de entrada quedan como orquestación fina sobre estas funciones. No se
testea `docker exec` ni la red.

Los tests van en `apps/web/scripts/db/__tests__/lib.test.ts`, recogidos automáticamente
por el glob que ya existe en `vitest.config.ts:13`. Cero cambios de configuración.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El script destruye producción | `assertLocalTarget`, con tests que verifican el **rechazo**, no solo la aceptación |
| Un dump se commitea por accidente | `private/` ya está en `.gitignore:112`; el manifiesto no contiene secretos |
| Backup parcial que parece completo | Fallo de cualquier dump ⇒ se borra la carpeta entera |
| La password aparece en un log o en `ps` | Se pasa por env var, nunca por argv; nunca se imprime |
| El dump queda obsoleto respecto al repo | `gitSha` y `latestMigration` en el manifiesto lo fechan |
| Copia local infiel sin que se note | `db:verify` es un paso obligatorio del flujo, con exit code |

## Preguntas abiertas

Ninguna bloqueante. Off-site y retención quedan registrados como trabajo futuro
explícitamente descartado de este alcance.
