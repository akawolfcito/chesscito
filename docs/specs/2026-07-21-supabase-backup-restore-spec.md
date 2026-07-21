# Spec — Respaldo de Supabase y restauración local

**Fecha:** 2026-07-21
**Estado:** aceptado, no implementado
**Alcance:** reducido (v1) — ver "Alcance de esta primera implementación"
**Motivo inmediato:** la migración `20260721030000_peones_v1_economy.sql` está en el repo
pero **no aplicada a producción**. No se aplica hasta que exista un respaldo verificado
y un ensayo local exitoso.

---

## Problema

El proyecto corre en el free tier de Supabase, que **no incluye backups automáticos**.
Hoy no existe ninguna copia de la base de producción, y tampoco una forma de ensayar
una migración contra datos reales antes de aplicarla.

Dos necesidades, una sola herramienta:

1. **Respaldo** — tener la base en disco, recuperable.
2. **Réplica local** — poder ensayar migraciones contra una copia fiel, en Docker,
   sin tocar producción.

---

## Alcance de esta primera implementación

Cuatro objetivos, nada más:

1. Crear un backup SQL válido de producción.
2. Restaurarlo de forma segura en el Supabase local.
3. Confirmar que el ledger y el historial de migraciones se restauraron.
4. Poder correr **a mano** la migración pendiente de Peones V1 contra esa copia.

### Obligatorio

- Los cuatro dumps: `roles.sql`, `schema.sql`, `data.sql`, `migration_history.sql`
- Checksums SHA-256 de cada dump
- `manifest.json` básico
- Guarda estricta anti-producción en el restore
- Validación de que el destino es `localhost` / `127.0.0.1:55322`
- Tests de **rechazo** para `assertLocalTarget`

### Fuera de alcance (decidido, no pendiente)

| Descartado | Razón |
|---|---|
| `verify-restore.ts` como script separado | La verificación mínima vive dentro de `restore-local.ts`. Un tercer comando es superficie que todavía no se gana su lugar. |
| Comparación exhaustiva de todas las tablas | Tres tablas críticas responden la pregunta que importa hoy. |
| Rotación / borrado automático de backups viejos | El borrado automático es la parte que, con un bug, destruye el respaldo que necesitabas. El script arranca sin dientes. |
| Subida off-site (S3 / R2 / Drive) | Frente propio: proveedor, credenciales, y cifrado obligatorio del dump. Merece su propio spec. |
| Cifrado del dump | Va junto con off-site. En local, el dump está tan protegido como el disco. |
| Aplicar la migración pendiente automáticamente tras el restore | El ensayo lo dispara una persona, mirando la salida. Se documenta el comando. |
| Cualquier escritura a producción | Este spec **solo lee** de prod. No hay merge, ni migración remota, ni mutación de datos. |

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
| Migraciones en el repo | 29 archivos, la última **sin aplicar** |
| Runner de scripts | `tsx` (`apps/web/package.json:24-32`) |
| Tests de scripts | `vitest.config.ts:13` ya incluye `scripts/**/__tests__/**` |

Tablas críticas — confirmadas presentes en las migraciones:
`public.peones_ledger`, `public.treasury_payment_intents`,
`public.treasury_payment_consumptions`.

---

## Arquitectura

**Dos** comandos y un módulo de lógica pura. Todo bajo `apps/web/scripts/db/`.

```
apps/web/scripts/db/
  lib.ts               # lógica pura, sin I/O de red — la parte testeable
  backup.ts            # prod  → disco
  restore-local.ts     # disco → stack local  + chequeo post-restore
  __tests__/lib.test.ts
```

**Regla de higiene de comandos** (CLAUDE.md): ninguna invocación usa `cd`. Todas las
llamadas a la CLI pasan `--workdir apps/web`.

---

## Dónde viven los backups

**Por defecto, fuera del repositorio:**

```
$HOME/backups/chesscito/db/<UTC-ISO-timestamp>/
```

Override con la variable de entorno `CHESSCITO_BACKUP_DIR`, que reemplaza la raíz
(`$HOME/backups/chesscito/db`); el subdirectorio con timestamp se sigue creando adentro.

`private/backups/` **no** se usa. Un dump de producción fuera del árbol del repo no puede
entrar a git por un `git add` distraído, por más gitignore que haya. La regla del proyecto
—stagear paths explícitos, nunca globs— ya se rompió una vez; esto saca el riesgo de la mesa
en lugar de mitigarlo.

---

## Componente 1 — `backup.ts`

**Comando:** `pnpm db:backup`

Crea el directorio con timestamp y cinco archivos:

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

Solo lo necesario:

```jsonc
{
  "createdAt": "2026-07-21T18:04:11Z",
  "gitSha": "697667a7",
  "latestMigration": "20260721020000_get_peones_intent_expiry_reuse.sql",
  "cliVersion": "2.98.2",
  "files": [
    { "name": "roles.sql",             "bytes": 2104,  "sha256": "…" },
    { "name": "schema.sql",            "bytes": 84210, "sha256": "…" },
    { "name": "data.sql",              "bytes": 39122, "sha256": "…" },
    { "name": "migration_history.sql", "bytes": 3180,  "sha256": "…" }
  ],
  "criticalTableRows": {
    "public.peones_ledger": 1420,
    "public.treasury_payment_intents": 96,
    "public.treasury_payment_consumptions": 71
  }
}
```

`criticalTableRows` se deriva **del propio `data.sql`**, contando líneas dentro del bloque
`COPY … FROM stdin;` de cada tabla crítica hasta su terminador `\.`. Sin red, sin `psql`,
sin segunda consulta que pueda desincronizarse. `pg_dump` escapa los backslashes en la
salida `COPY`, así que un `\.` solo en su línea no puede aparecer dentro de los datos — el
parseo es seguro.

Si una tabla crítica **no aparece** en `data.sql`, se registra `0` y se emite un warning.
Ausencia y vacío no se confunden en el reporte.

### Manejo de secretos

- La password se lee de `apps/web/.env` y se pasa a la CLI por **variable de entorno**
  (`SUPABASE_DB_PASSWORD`), nunca como argumento en la línea de comando (los argumentos
  son visibles en `ps`).
- El script **nunca** imprime la password ni la connection string. La salida son rutas,
  tamaños y conteos.
- El `project ref` **no** va al manifiesto.

### Errores

Falla ruidosa y temprana, sin dejar una carpeta a medias:

- `SUPABASE_DB_PASSWORD` ausente → abortar diciendo dónde ponerla.
- Cualquier `db dump` con exit code ≠ 0 → **borrar la carpeta parcial** y abortar.
  Un backup incompleto que parece completo es peor que ninguno.
- Un `schema.sql` o `data.sql` de 0 bytes se trata como fallo, no como "base vacía".

---

## Componente 2 — `restore-local.ts`

**Comando:** `pnpm db:restore-local <backup-dir>`

### Fase A — validar el artefacto

Verificar que existen los 5 archivos y que cada `sha256` coincide con el manifiesto.
Si un dump se corrompió, se sabe **antes** de tocar ninguna base.

### Fase B — la guarda anti-producción

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

La URL no se construye a mano: se lee de `supabase status -o env --workdir apps/web` y se
valida. Si el stack local no corre, o si el status devuelve algo que no pasa la guarda, el
script **no adivina** — aborta.

`assertLocalTarget` vive en `lib.ts` como función pura sobre un string: se testea sin
Docker, sin red y sin base.

### Fase B bis — precondiciones sobre la base

Tres comprobaciones más, todas antes de cualquier sentencia destructiva:

1. **Sesión superusuario.** `current_user = supabase_admin` y `is_superuser = on`,
   preguntado a la sesión viva, no inferido de los argumentos de conexión. `postgres` no
   es superusuario en la imagen de Supabase ni miembro de `supabase_admin`.
2. **Schemas gestionados presentes:** `auth`, `storage`, `extensions`, `vault`, `graphql`,
   `realtime`. Si falta alguno, la base no está inicializada y el restore aborta nombrando
   **todos** los faltantes.
3. **`supabase_migrations.schema_migrations` existe** como tabla — se trunca, no se dropea.

### Fase C — restaurar (rediseñada)

**`DROP DATABASE` está eliminado del diseño.** El primer intento dropeaba la base y la
recreaba desde `template1`; eso borra los schemas gestionados que el propio dump da por
existentes, y dejó el stack local inutilizable. La limpieza correcta es mínima y acotada.

**Las tres únicas sentencias destructivas:**

```sql
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public AUTHORIZATION pg_database_owner;
TRUNCATE TABLE supabase_migrations.schema_migrations;
```

`public` se reemplaza entero porque `schema.sql` solo **agrega** (`CREATE TABLE IF NOT
EXISTS`, `CREATE OR REPLACE FUNCTION`, cero `DROP`): sin borrarlo, cualquier objeto local
obsoleto sobreviviría al restore sin que nada lo señale. `AUTHORIZATION pg_database_owner`
conserva la propiedad que tiene una base Supabase recién creada.

El ledger se **trunca**, no se dropea: la tabla y su primary key sobreviven, y
`migration_history.sql` la rellena con exactamente lo que producción tenía aplicado.

Luego los dumps, en orden:

```
roles.sql → schema.sql → data.sql → migration_history.sql
```

Se ejecutan con `docker exec -i supabase_db_web psql -U supabase_admin`. El host no tiene
`psql`; el contenedor sí. La contraseña del stack local sale del `DB_URL` que la guarda ya
validó y viaja por entorno, nunca por argv.

### Lo que se borra y lo que se conserva

| Se borra en local | Se conserva |
|---|---|
| Todo el schema `public` (13 tablas + índices, políticas, funciones, vistas, secuencias, triggers) | `auth`, `storage`, `extensions`, `vault`, `graphql`, `graphql_public`, `realtime`, `_realtime`, `net`, `pgbouncer`, `supabase_functions` — schemas **y** datos |
| Las filas de `supabase_migrations.schema_migrations` | La tabla `schema_migrations` y su primary key |
| — | Todos los roles del cluster |

**Efecto colateral verificado:** `schema.sql` instala `pg_cron` en local (crea el schema
`cron`), algo que `supabase start` no puede hacer. Probado como `supabase_admin`: funciona.

### Fase D — chequeo post-restore (mínimo, integrado)

No hay script aparte. Al terminar el restore, `restore-local.ts` consulta la base local y
verifica exactamente esto:

1. **Existen** `public.peones_ledger`, `public.treasury_payment_intents`,
   `public.treasury_payment_consumptions`.
2. `supabase_migrations.schema_migrations` **no está vacía**.
3. Su **última** entrada coincide con `latestMigration` del manifiesto.
4. `count(*)` de `public.peones_ledger` === `criticalTableRows["public.peones_ledger"]`.

Salida: una tabla legible + exit code. `0` = la réplica sirve para el ensayo. `≠0` = no
sirve, con el detalle de qué falló. Se reportan **todos** los fallos, no solo el primero.

### Lo que NO hace

No aplica la migración pendiente. Al terminar en verde, imprime el comando para correrlo
a mano:

```
supabase migration up --workdir apps/web
```

---

## Flujo de uso

```bash
pnpm db:backup
# → $HOME/backups/chesscito/db/2026-07-21T18-04-11Z

pnpm db:restore-local ~/backups/chesscito/db/2026-07-21T18-04-11Z
# → restaura + chequeo post-restore + imprime el siguiente comando

supabase migration up --workdir apps/web
# ← ensayo manual de 20260721030000_peones_v1_economy.sql
```

Con el chequeo post-restore en verde y `migration up` en verde, recién ahí se evalúa
aplicar a producción — decisión humana, fuera de este spec.

---

## Plan de tests (SDD → TDD → EDD)

`lib.ts` concentra la lógica que puede estar mal en silencio. Los tests van primero.

| Función | Casos |
|---|---|
| `assertLocalTarget(url)` | **acepta** `127.0.0.1:55322` y `localhost:55322`; **rechaza** host remoto, un `*.supabase.co`, puerto distinto de `55322`, string vacío, y URL malformada |
| `countCopyRows(sql, table)` | cuenta el bloque `COPY` de la tabla pedida; devuelve 0 para una tabla presente pero vacía; distingue **ausente** de **vacía**; no confunde un `\.` que aparece dentro de un valor; ignora comentarios y `SET` |
| `parseManifest(json)` | rechaza manifiesto sin `files` o sin `criticalTableRows`; rechaza uno con versión desconocida |
| `resolveBackupRoot(env, home)` | usa `$HOME/backups/chesscito/db` por defecto; `CHESSCITO_BACKUP_DIR` lo reemplaza; **nunca** devuelve una ruta dentro del repo |

Los dos scripts de entrada quedan como orquestación fina sobre estas funciones. No se
testea `docker exec` ni la red.

Tests en `apps/web/scripts/db/__tests__/lib.test.ts`, recogidos por el glob que ya existe
en `vitest.config.ts:13`. Cero cambios de configuración.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El script destruye producción | `assertLocalTarget`, con tests que verifican el **rechazo**, no solo la aceptación |
| Un dump se commitea por accidente | El destino por defecto está **fuera del repo**; `resolveBackupRoot` tiene un test que lo garantiza |
| Backup parcial que parece completo | Fallo de cualquier dump ⇒ se borra la carpeta entera |
| La password aparece en un log o en `ps` | Se pasa por env var, nunca por argv; nunca se imprime |
| El dump queda obsoleto respecto al repo | `gitSha` y `latestMigration` en el manifiesto lo fechan |
| Copia local infiel sin que se note | El chequeo post-restore es parte del mismo comando, con exit code |
| La migración se aplica sin que nadie mire | No se aplica automáticamente, ni en local ni en prod |

## Preguntas abiertas

Ninguna bloqueante. Off-site, cifrado, retención y verificación exhaustiva quedan
registrados arriba como trabajo futuro explícitamente descartado de esta v1.
