# Session Handoff — 2026-08-06 (Docker, backup de prod y cierre del baseline de 2026-04)

> 📌 Auditoría de esta sesión (committeada, **manda**):
> `docs/audits/2026-08-06-docker-local-audit.md` — §1–10 Docker + backup, §11 el incidente
> del volumen corrupto, §12 el restore, §13–14 las dos migraciones.
>
> **🟢 El baseline vacío de 2026-04 quedó cerrado.** Un `supabase db reset` limpio ahora
> produce un entorno igual a prod: antes le faltaban 2 tablas y RLS en 3.

## Estado

| | |
|---|---|
| Rama actual | `fix/baseline-schema-and-rls-parity` — commit **`5925c284`** |
| **Sin pushear** | ⚠️ **sí** — el founder pushea cuando quiera (`origin/main` sigue en `b32b9949`) |
| Trabajo sin commitear | no (árbol limpio) |
| Suite unit | **7397 passing / 596 files** — corrida completa post-migraciones |
| `tsc` / lint / build | ⚠️ **no corridos esta sesión** (cambios son SQL + markdown) |
| **VR** | ⚠️ **no corrido** — seguía 🔴 11/62 preexistente de la sesión del 2026-08-05 |
| Supabase local | levantado, con **datos de prod al 2026-08-06** |

## Completed

- **Auditoría read-only de Docker.** Eran 2 stacks completos, no 2 contenedores: `web` =
  chesscito, `qxwztvfazronkshgkckk` = **minixymyx** (`~/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/xymyx/minixymyx`).
  Los 17 volúmenes huérfanos se inspeccionaron **uno por uno**: entre los 17 había **14
  filas** en total, todas artefactos de una corrida de tests.
- **Limpieza: ~4,6 GB netos.** De 22 imágenes / 22 volúmenes / 23 contenedores a 15 / 2 / 12.
  minixymyx destruido con OK del founder (dump de seguro en
  `~/backups/2026-08-06-minixymyx-local-public.sql`, fuera de todo repo porque su
  `.gitignore` no ignora `private/`).
- **Backup de prod** en `private/backups/` (gitignoreado): `2026-08-06-prod-schema.sql`
  (138,8 KB) + `2026-08-06-prod-data.sql` (64 MB). El anterior era del 2026-07-21 (7,2 MB).
- **Restore completo en local**, verificado con `db reset` integral + recarga con **0 errores**.
- **`5925c284` — dos migraciones.** Los tres baselines de 2026-04 son placeholders vacíos;
  el DDL real vive en `src/lib/supabase/schema.sql`.
  - `20260806000000_victories_sync_state_baseline.sql` — crea las dos tablas que prod tiene
    y ninguna migración creaba.
  - `20260806010000_baseline_rls_parity.sql` — RLS de 18/21 a **21/21**. La grave era
    `analytics_events`: su propia migración **afirma** en el header que el RLS queda
    default-deny y **nunca ejecuta el `enable`** → exponía 216.409 filas de telemetría
    (`country` incluido) a la anon key en cualquier entorno reconstruido.

## Next Tasks

1. **Pushear y mergear `fix/baseline-schema-and-rls-parity`.** Listo para ir; en hosted
   ambas migraciones son no-op, así que prod no cambia de comportamiento.
2. **Actualizar el baseline de tests en `CLAUDE.md`** — dice 6515 passing / 552 files
   (2026-07-29); hoy son **7397 / 596**.
3. **VR sigue 🔴 11/62** de la sesión anterior — no se tocó ni se corrió acá.
4. Evaluar si conviene **`--rm`** donde se levanta Postgres para tests: 7 de los 17
   volúmenes huérfanos eran `chesscito_test`, a ~45 MB por corrida.
5. Supabase CLI en v2.98.2 (hay v2.111.0). Además avisa drift de servicios: local `gotrue`
   v2.188.1 vs v2.195.0 en prod, `storage-api` v1.54.0 vs v1.68.1.

## Blockers

- **Ninguno para avanzar.** La única deuda abierta es cosmética: el directorio
  `_corrupt_supabase_db_web_20260806` quedó dentro de la VM de Docker y **no se puede
  borrar por vía normal** (corrupción ext4, `bad message`). Ocupa poco. Sólo lo limpia un
  *Clean/Purge data* de Docker Desktop, que borra TODO — **no recomendado**.

## Notes

- ⚠️ **`src/lib/supabase/schema.sql` NO es fiel a prod**: no menciona RLS ni policies. Al
  rescatar algo de ahí, tomar la forma de un **dump de prod**, no del archivo.
- ⚠️ **Auditar RLS midiendo, no leyendo.** `set role anon; select count(*)` — fue lo que
  delató las 3 tablas (dos de las cuales nadie había pedido revisar). El header de una
  migración puede afirmar una postura que el SQL no implementa.
- ⚠️ **Volumen Docker corrupto:** `docker volume rm --force` y reiniciar Docker Desktop **no
  sirven**. Se resuelve **renombrando** desde dentro de la VM
  (`docker run --rm --privileged --pid=host alpine nsenter -t 1 -m -u -i -n -- mv …`),
  porque `rename()` no lee las entradas del directorio y `unlink()` sí.
- El `supabase db reset` de esta sesión **destruyó los datos de desarrollo local** (46.898
  `analytics_events` de dev). Estaba aprobado; el local hoy tiene datos de prod.
- `imgproxy` se borró y **`supabase start` lo volvió a bajar**: es parte del stack que
  levanta el CLI. Borrarlo no ahorra nada.
- Memorias nuevas: `project_prod_schema_drift_victories_sync_state`,
  `feedback_a_comment_is_not_a_control`, `feedback_corrupt_docker_volume_rename_dont_delete`.
