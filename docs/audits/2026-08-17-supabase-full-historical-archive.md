# Archivo histórico completo — herramienta versionada y verificación

**Fecha:** 2026-08-17 · **Tipo:** herramienta + ejecución. **Nada se borró ni se mutó.**
**Antecedente:** `docs/audits/2026-08-17-supabase-historical-archive-recoverability.md`

---

## TOOL IMPLEMENTED

**`pnpm ops:archive`** — `scripts/ops/archive.ts` (+ 49 tests).

```bash
pnpm ops:archive --from 2026-08-10 --to 2026-08-17   # rango medio abierto, UTC
pnpm ops:archive --all                               # rango resuelto DESDE producción
pnpm ops:archive --verify-only private/archive/manifest.json
```

### Por qué producción no puede escribirse, en orden de fuerza

1. **La conexión.** DuckDB adjunta Postgres con `(TYPE POSTGRES, READ_ONLY)`. Una escritura la
   rechaza **el motor**, no nuestra intención — la única garantía que vale.
2. **`assertNoWrites`**, defensa en profundidad, **antes** de que arranque el contenedor.
   ⚠️ Distingue por **destino**, no por nombre: el export legítimamente hace `COPY` a Parquet y
   `CREATE VIEW` local. Un guard que prohibiera ambos se apagaría la primera vez que estorbara,
   así que prohíbe los verbos de escritura y el único `CREATE` que aterrizaría en el servidor:
   `CREATE INDEX`.
3. **`assertUnderArchiveRoot`.** La salida sólo puede caer bajo `private/archive/`.

⛔ **Ninguna de las tres reemplaza a las otras.** La primera es la que importa; las otras dos
existen porque una herramienta que corre contra producción no debería tener un solo candado.

### Lo que exporta

`analytics_events` particionado por **fecha UTC** (`event_date=YYYY-MM-DD`, Hive) + snapshots
completos de `account_first_seen` y `session_first_seen`. **Parquet + ZSTD**, sólo bajo
`private/archive/`.

⛔ **`account_first_seen` no es opcional y hay un test que lo fija:** D1/D3/D7 **no** salen de
`analytics_events`. Un archivo sin esa tabla pierde toda la retención **y nada lo reportaría**.

## TEST RESULTS

**[FACT] 49/49 verdes.** Cubren: parseo de rango · fronteras UTC · resolución de `--all` ·
`READ_ONLY` y verbos de escritura (8 casos, más escritura escondida tras comentario y tras un
`SELECT` legítimo) · seguridad del path de salida (traversal, `/tmp`, `docs/`) · generación de
manifiesto · verificación por partición (filas, `min_ts`, `max_ts`, faltante, sobrante) ·
redacción de password, ref, connection string y wallets · determinismo y re-ejecución ·
inclusión obligatoria de `account_first_seen`.

⚠️ **No están sobreajustados a W2:** las cifras de W2 se usan como ancla, pero la lógica se
ejercita con datos sintéticos. Una suite que sólo conoce un dataset prueba el dataset.

**El test que más vale:**

> *"⛔ un TOTAL coincidente nunca rescata un desajuste por partición"* — dos días errados por la
> misma cantidad en direcciones opuestas suman bien y el archivo está corrupto.

## W2 REPRODUCTION RESULT

⛔ **Ancla obligatoria antes de tocar el histórico.**

| | Prueba del 2026-08-17 | `pnpm ops:archive` | ¿Igual? |
|---|---:|---:|---|
| Filas de `analytics_events` | **45.324** | **45.324** | ✅ |
| Particiones | 7 | 7 | ✅ |
| Archivos Parquet | 9 | 9 | ✅ |
| Tamaño comprimido | 1,45 MB | 1,45 MB | ✅ |
| Verificación | PASS | **PASS** | ✅ |

**[FACT] La herramienta versionada reproduce la prueba exactamente.**

### ⚠️ Un fallo real, encontrado por correrla contra el histórico

La primera ejecución de `--all` dio **FAIL**, y estuvo bien que lo diera: reportó
`2026-08-05`, `2026-08-07` y `2026-08-12` como *missing*, con `2026-08-12` **repetida**.

**Causa:** DuckDB parte una partición grande en varios archivos — `2026-08-05` produjo **tres**,
`2026-08-12` **dos**. Mi primer esquema de manifiesto asumía *un archivo por partición*, así que
un día multi-archivo se registraba dos veces y la verificación lo daba por perdido.

⛔ **El arreglo está en el esquema, no en el bucle: una partición TIENE archivos.** Los conteos
pertenecen a la partición, los checksums al archivo. Quedó fijado con tres tests de regresión.

⚠️ **El bug también inflaba el número:** aquella corrida reportó **361.106 filas** porque cada
archivo reclamaba el total de su partición. El real es **297.846**. Un FAIL que hubiera sido
"arreglado" bajando la exigencia habría dejado un archivo aparentemente completo con **63.260
filas fantasma**.

## FULL ARCHIVE RANGE

**[FACT] 2026-05-03 → 2026-08-19** (UTC, medio abierto). ⚠️ **Resuelto desde producción**, no
asumido: `--all` consulta `min/max(created_at)` y toma el día **siguiente** al último evento,
porque un `to` igual a la última fecha habría descartado ese día entero y la pérdida se vería
igual que un día tranquilo.

## TOTAL SOURCE ROWS · PARQUET FILE COUNT · COMPRESSED SIZE

| | |
|---|---:|
| Filas de `analytics_events` | **297.846** |
| Particiones diarias | **108** |
| Archivos Parquet | **110** *(108 de eventos + 2 snapshots)* |
| `account_first_seen` | 6.287 filas |
| `session_first_seen` | 8.315 filas |
| **Tamaño comprimido** | **8,28 MB** (8,6 MB en disco con el manifiesto) |
| Huella equivalente en Postgres | **~161,7 MB** |
| **Ratio** | **~19,5×** |
| Duración del export | **~12 s** |

## MANIFEST STATUS · CHECKSUM STATUS

`private/archive/manifest.json`: `created_at`, `range`, **108 `partitions`** (partición, filas,
`min_ts`, `max_ts`) y **110 `files`** (tabla, nombre, partición, bytes, **SHA-256**).

**[FACT] `--verify-only` corre en limpio contra el manifiesto: PASS.** Verifica **por
partición** —filas y ambos timestamps— y además **recalcula el SHA-256 de los 110 archivos**,
así que detecta corrupción o edición aunque los conteos cuadren.

## OFFLINE QUERY RESULT

⛔ **Contenedor con `--network none`. Producción era físicamente inalcanzable.**

## POSTGRES / KNOWN-EVIDENCE PARITY

| Métrica | Evidencia conocida | Archivo (offline) | Match |
|---|---:|---:|---|
| W1 wallets / sesiones / filas | 5.351 / 7.055 / 194.206 | idéntico | ✅ |
| W2 wallets / sesiones / filas | 934 / 1.261 / 45.324 | idéntico | ✅ |
| W1 días activos (1 / ≥2 / ≥3 / ≥4) | 5.142 / 209 / 46 / 21 | idéntico | ✅ |
| W2 días activos | 864 / 70 / 26 / 13 | idéntico | ✅ |
| D1 · D3 · D7 cohorte 08-03 | 51 · 15 · 17 | idéntico | ✅ |
| D1 · D3 · D7 cohorte 08-04 | 52 · 13 · 10 | idéntico | ✅ |
| D1 · D3 · D7 cohorte 08-05 | 20 · 10 · 7 | idéntico | ✅ |
| Daily W2 (inicio / completado) | 360 / 199 | idéntico | ✅ |
| Arena W2 (inicio / fin) | 474 / 268 | idéntico | ✅ |
| Coach W2 | 268 | idéntico | ✅ |
| Learn W2 (inicio / completado) | 135 / 110 | idéntico | ✅ |
| PRO W2 (impresión / tap / no-token) | 236 / 141 / 135 | idéntico | ✅ |
| Mint W2 (start/ok/error/cancel) | 98 / 44 / 41 / 38 | idéntico | ✅ |
| Ejercicios (top 6, starts/completions) | `rook-1` 1042/762 … `rook-9` 532/328 | idéntico | ✅ |
| Top 5 eventos W2 | `peones_balance_viewed` 3.939 … 1.518 | idéntico | ✅ |

**[FACT] Coincidencia EXACTA en las 15 familias.** Cero aproximaciones.

⚠️ **D7 ahora sí es calculable** para las cohortes de lanzamiento, cosa que la prueba anterior
no podía: aquella archivó 7 días y el seguimiento caía fuera. Con el histórico completo, el
límite desaparece.

## PRIVACY STATUS

- **[FACT]** `private/archive/` sigue en `.gitignore:112`. `git check-ignore` confirma el
  manifiesto y los Parquet; **`git status` no ve un solo archivo de los 110.**
- ⛔ **El archivo crudo contiene `account_ref` completos y `props` sin redactar.** Es **PRIVADO**:
  no se commitea, no se publica, no sale de la máquina.
- **[FACT] En este documento no hay un solo identificador.**
- **[FACT] `redactSecrets` está probado** contra password, project ref (`[REF]`), connection
  strings y wallets — y también contra **sobre-enmascarar**: un test exige que
  `"rows 6824 partition 2026-08-10 mismatch"` salga intacto, porque un error ilegible es un
  error que nadie arregla.
- ⚠️ Origen de esa regla: el 2026-08-17 un error de Docker volcó el project ref en la terminal.

## LIMITATIONS

1. ⚠️ **El archivo es una foto, no un flujo.** No hay export diario programado; hoy se corre a
   mano. Automatizarlo es diseño pendiente.
2. ⚠️ **`session_first_seen` está incompleta en producción** (53 sesiones de 1.261 en W2). El
   archivo la reproduce con fidelidad; **no sirve como denominador de sesiones.**
3. ⚠️ **`props` es `VARCHAR` (texto JSON)**, no `jsonb`. `json_extract_string` reproduce lo que
   `->>` devolvía — demostrado sobre las métricas de PRO, mint y ejercicios.
4. ⚠️ **Los Parquet quedan con dueño `root`** (los escribe el contenedor).
5. ⛔ **No se probó recuperación de disco.** Fuera de alcance, y sigue sin hacerse.
6. ⚠️ **El manifiesto no tiene firma**, sólo checksums: detecta corrupción, no manipulación
   deliberada por alguien con acceso de escritura al directorio.
7. ⚠️ **`--all` re-exporta todo.** No hay modo incremental; a esta escala (12 s) no hace falta.

---

# ARCHIVE TOOL REPRODUCIBLE:
**YES** — 49/49 tests, y reproduce el ancla W2 al número (45.324 filas, 7 particiones, 1,45 MB).

# FULL HISTORY ARCHIVED:
**YES** — 2026-05-03 → 2026-08-19, **297.846 filas**, 108 particiones, 110 archivos, **8,28 MB**.

# FULL HISTORY VERIFIED:
**YES** — verificación **por partición** (filas + `min_ts` + `max_ts`) más SHA-256 de los 110
archivos. `--verify-only` en limpio: **PASS**.

# PRODUCT METRICS REPRODUCIBLE OFFLINE:
**YES** — 15 familias de métricas idénticas, con `--network none`. Incluye **D7**, que la
prueba anterior no alcanzaba.

# PRODUCTION MUTATED:
**NO** — conexión `READ_ONLY` impuesta por el motor; `assertNoWrites` antes del contenedor;
salida confinada a `private/archive/`. Cero `DELETE`, `TRUNCATE`, `DROP`, `ALTER`, `VACUUM`,
índices, esquemas, cron, plan o deploy.

# READY TO DESIGN PHYSICAL RECLAMATION:
**YES** — la historia está archivada, verificada y consultable sin producción, que era la
condición previa.

⚠️ **Pero "diseñar" no es "ejecutar", y la distinción es la de siempre:** el archivo resuelve
**preservar**; **no** resuelve **liberar disco**. Un `DELETE` no devuelve un byte.
`analytics_events` **no está particionada**, así que el diseño tiene que empezar por ahí — y
`VACUUM FULL`, copia-y-swap o `pg_repack` siguen sin probarse y sin compararse en la práctica.

⛔ **Nada de eso se hace sin traértelo antes.**
