# Audit: qué de Docker sirve y qué se puede descartar

**Fecha:** 2026-08-28 · **Motivo:** la máquina se recalienta en idle (16 GB de RAM, 4,7 GB
de swap usados, compressor en 7,5 GB). Docker es el consumidor más grande.

## El número que importa

La VM de Docker Desktop tiene **7,5 GB de los 16 GB de la máquina asignados** (`docker info`
→ `MemTotal=7.5 GB`, `NCPU=4`). Ahora mismo residentes son ~4 GB y la VM marca **22% de CPU
sin que nadie la use**. En una máquina de 16 GB con Chrome + Brave + Cursor abiertos, eso es
la causa directa del swap permanente.

## Inventario: 13 contenedores

| Contenedor | Dueño | ¿Sirve? |
|---|---|---|
| `supabase_*_web` (12) | **chesscito** — `apps/web/supabase/config.toml`, `project_id = "web"` | **Sí, pero NO 24/7** |
| `flappymar-db` | `telegram-projects/flappymar` (postgres:17-alpine) | Solo si trabajás en flappymar |
| `supabase_edge_runtime_web` | chesscito | **Exited hace 2 semanas** — muerto |

### Sobre el stack de Supabase local

Sirve: `apps/web/supabase/migrations/` se tocó hace 3 días (`980a1890`, Inbox V0), y es donde
se prueba una migración antes de prod.

**Pero la app no lo está usando.** La config de entorno apunta a la Supabase **hosted**, no a
`127.0.0.1:54321`. O sea: 12 contenedores encendidos hace 3 horas para nada, salvo los ratos
en que corrés migraciones.

⚠️ **No usar `supabase stop`** para esto: esa orden *elimina* los contenedores. Usar
`docker stop` — para el proceso, deja intactos los volúmenes, y `docker start` lo revive.

## Descartables sin discusión

| Qué | Tamaño | Por qué |
|---|---|---|
| Build cache | **2,04 GB** | 0 activo. Nada lo referencia. |
| `x402seek-facilitator:v2/v3/test` + `x402seek-demo-seller:test` | ~4,4 GB | Otro proyecto, imágenes de hace 13 días, sin contenedor. |
| `supabase/postgres:17.6.1.155` | 1,3 GB | El stack corre `.084`. Versión bajada y nunca usada. |
| `supabase/edge-runtime:v1.74.2` | 686 MB | El stack corre `v1.73.13`. |
| `postgres:17` | 476 MB | Solo la usa `docker run --rm -i postgres:17 psql` de `scripts/ops/*` → se rebaja sola si hace falta. |
| `duckdb`, `alpine:3`, `alpine:latest` | ~185 MB | Sin consumidor en el repo. |
| **17 volúmenes dangling** | ~504 MB | 15 hexadecimales huérfanos (probes sin `--rm`), + `jermes_hermes-workspace` (otro proyecto) + `supabase_edge_runtime_`. |
| `_corrupt_supabase_db_web_20260806` | — | El volumen corrupto que se **renombró** el 2026-08-06 en vez de borrarlo. El stack lleva 3 semanas sano: ya cumplió su función de red de seguridad. |

**Total recuperable en disco: ~9,1 GB** (`docker system df`: 7,08 GB de imágenes + 2,04 GB
de cache + 0,5 GB de volúmenes).

## Lo que NO se toca

- `postgres:16-alpine` (288 MB) — es la imagen de `pg-duels`
  (`apps/web/supabase/tests/duels_smoke.sql:15`), el Postgres de pruebas de la tabla `duels`.
- Los volúmenes con nombre **en uso**: `supabase_db_web`, `supabase_storage_web`,
  `flappymar_flappymar-db-data`. Ahí vive la data local.
- Las 12 imágenes del stack de Supabase que corre hoy.

## Plan, en orden de rendimiento

1. **`docker stop` de los 13 contenedores.** Libera ~4 GB de RAM y el 22% de CPU idle.
   Reversible al 100% con `docker start`. Esto solo ya corta el recalentamiento.
2. **Bajar la asignación de la VM de 7,5 GB a 4 GB** en Docker Desktop → Settings →
   Resources. Con 16 GB de RAM total, 7,5 GB reservados para Docker es insostenible.
3. **`docker builder prune -af`** → 2,04 GB, sin riesgo.
4. **Borrar las imágenes muertas** (x402seek, las dos supabase no usadas, duckdb, alpine).
5. **`docker volume prune`** → los 17 dangling, incluido `_corrupt_*`.
6. **Costumbre nueva:** el stack de Supabase se levanta cuando vas a tocar una migración y se
   baja al terminar. No queda prendido de fondo.

## Abierto

- ¿`flappymar` sigue vivo? Si el proyecto está cerrado, va el contenedor **y** su volumen.
- ¿`x402seek` está archivado? Si sí, las 4 imágenes se van sin reserva.
