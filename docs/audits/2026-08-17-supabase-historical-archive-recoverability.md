# Prueba de recuperabilidad — el histórico de Supabase fuera de Postgres

**Fecha:** 2026-08-17 · **Tipo:** prueba de recuperabilidad. **Nada se borró de producción.**
**Acceso a producción:** ⛔ **sólo lectura, impuesta por la conexión** — DuckDB adjunta Postgres
con `(TYPE POSTGRES, READ_ONLY)`, así que una sentencia de escritura habría sido rechazada por
el motor, no evitada por mi cuidado.
**Resultado:** ✅ **PASS**

---

## ARCHIVE WINDOW

**W2 — 2026-08-10 00:00:00+00 → 2026-08-17 00:00:00+00** (7 días completos).

**Por qué es representativa:** es la ventana que el informe de tendencia ya usó como *régimen
estable*, y **contiene todo lo que la prueba necesita ejercitar**: 934 wallets, 1.261 sesiones,
70 wallets que vuelven otro día y 26 con ≥3 días activos, Daily (360), Arena (474), Coach (268),
Learn (135), PRO (236 impresiones), mint (98 starts) y 60 ejercicios con id. Si el modelo
funciona acá, funciona.

⛔ **No incluye P2P como demanda:** las 12 filas de duelo son del 08-15/08-16 y son el smoke de
dos dispositivos. Quedan **fuera de la ventana**, así que la prueba no puede confundirlas con
adopción.

⚠️ **Se archivó una ventana, no la base.** Es deliberado: probar el modelo, no mover el histórico.

## SOURCE TABLES

| Tabla | Alcance exportado | Por qué |
|---|---|---|
| `analytics_events` | W2 (7 días) | El histórico de producto |
| `account_first_seen` | **completa** (6.287 filas) | ⛔ **Sin ella no hay D1/D3/D7** |
| `session_first_seen` | **completa** (8.315 filas) | Primer contacto por sesión |

### Verificación de dependencias (Parte 1)

**[FACT] Se comprobó, métrica por métrica, qué tabla hace falta:**

| Métrica | Fuente | ¿Depende de algo externo? |
|---|---|---|
| DAU · WAU · sesiones · días activos | `analytics_events` | No |
| Daily · Arena · Coach · Learn | `analytics_events` | No |
| Embudo PRO · embudo del mint | `analytics_events` (`props`) | No |
| Nivel de ejercicio | `analytics_events` (`props->>'exerciseId'`) | No |
| País · container · superficie | columnas propias | No |
| **D1 / D3 / D7** | `analytics_events` + **`account_first_seen`** | ⛔ **Sí** |

⛔ **`account_first_seen` es la dependencia que rompería un archivo ingenuo.** Pesa 1,3 MB.
Olvidarla haría **irreproducibles para siempre** todas las métricas de retención.

⚠️ **`session_first_seen` NO fue necesaria** para ninguna métrica reproducida — todas cuentan
`session_id` directo desde `analytics_events`. Se archiva igual porque cuesta 137 KB y preserva
la capacidad de atribución por sesión. **Se declara como opcional, no como requerida.**

**[FACT] Ninguna otra tabla resultó necesaria.** Las de `PRODUCT_STATE` (`peones_ledger`,
`score_attempts`, `score_saves`) **no participan** de ninguna métrica de este informe.

## PARQUET FILES

Ruta local: **`private/archive/`** — ⛔ dentro de `.gitignore:112`, verificado con
`git check-ignore`. `git status` **no ve un solo archivo**.

```
private/archive/
  analytics_events/event_date=2026-08-{10..16}/part-0.parquet   (7 particiones, Hive)
  account_first_seen/part-0000.parquet
  session_first_seen/part-0000.parquet
  restore-proof.duckdb        (base local desechable de la prueba de restauración)
```

Compresión **ZSTD**. Particionado **`event_date=YYYY-MM-DD`**, que es la unidad de retención y
la de consulta.

⚠️ **El nombre real es `part-0.parquet`, no `part-0000.parquet`:** DuckDB expande
`FILENAME_PATTERN 'part-{i}'` sin relleno de ceros. Lo documento en vez de fingir que salió
como estaba especificado.

## MANIFEST

| Archivo | Filas | min_ts | max_ts | Bytes | SHA-256 (12) |
|---|---:|---|---|---:|---|
| `analytics_events/event_date=2026-08-10/part-0.parquet` | 6.824 | 00:00:54.633 | 23:40:40.925 | 179.900 | `13f6fee20ef6` |
| `…2026-08-11/part-0.parquet` | 6.052 | 00:03:08.736 | 23:55:34.122 | 162.535 | `d5ad56dd5933` |
| `…2026-08-12/part-0.parquet` | 6.953 | 00:01:17.074 | 23:48:12.382 | 183.066 | `c71410ee523d` |
| `…2026-08-13/part-0.parquet` | 5.827 | 00:01:41.180 | 23:59:32.129 | 160.646 | `f30630accb61` |
| `…2026-08-14/part-0.parquet` | 6.727 | 00:01:31.243 | 23:59:01.755 | 180.798 | `ba748818fae0` |
| `…2026-08-15/part-0.parquet` | 6.026 | 00:03:18.219 | 23:56:01.805 | 160.745 | `c0faea1bbc76` |
| `…2026-08-16/part-0.parquet` | 6.915 | 00:06:37.742 | 23:58:39.715 | 187.066 | `f16388e20b16` |
| `account_first_seen/part-0000.parquet` | 6.287 | 2026-07-25 21:46:57 | 2026-08-18 01:49:37 | 164.814 | `730538b74fea` |
| `session_first_seen/part-0000.parquet` | 8.315 | 2026-07-23 15:02:03 | 2026-08-18 01:49:37 | 136.829 | `2df42618ff70` |
| **TOTAL** | **45.324** + lookups | | | **1.516.399** | |

*SHA-256 completos en el manifiesto local; acá van 12 caracteres para que la tabla se lea.*

## INTEGRITY RESULTS

**Verificación POR PARTICIÓN**, no un total global. ⛔ Un total que coincide puede esconder dos
días cruzados.

| Día | Filas PG | Filas Parquet | min_ts | max_ts | ✅ |
|---|---:|---:|---|---|---|
| 2026-08-10 | 6.824 | 6.824 | idéntico | idéntico | ✅ |
| 2026-08-11 | 6.052 | 6.052 | idéntico | idéntico | ✅ |
| 2026-08-12 | 6.953 | 6.953 | idéntico | idéntico | ✅ |
| 2026-08-13 | 5.827 | 5.827 | idéntico | idéntico | ✅ |
| 2026-08-14 | 6.727 | 6.727 | idéntico | idéntico | ✅ |
| 2026-08-15 | 6.026 | 6.026 | idéntico | idéntico | ✅ |
| 2026-08-16 | 6.915 | 6.915 | idéntico | idéntico | ✅ |

**[FACT] Los `min`/`max` de cada partición caen dentro de su propio día** — ninguna fila quedó
en el archivo equivocado. Cero desajustes. **Checksums registrados para los 9 archivos.**

## POSTGRES VS DUCKDB PARITY

| # | Métrica | Postgres | DuckDB | Match |
|---|---|---:|---:|---|
| 1 | Wallets distintos | 934 | 934 | ✅ |
| 2 | Sesiones | 1.261 | 1.261 | ✅ |
| 3a | Wallets con 1 solo día | 864 | 864 | ✅ |
| 3b | Con ≥2 días | 70 | 70 | ✅ |
| 3c | Con ≥3 días | 26 | 26 | ✅ |
| 3d | Con ≥4 días | 13 | 13 | ✅ |
| 4a | Daily iniciado | 360 | 360 | ✅ |
| 4b | Daily completado | 199 | 199 | ✅ |
| 5a | Arena iniciada | 474 | 474 | ✅ |
| 5b | Arena terminada | 268 | 268 | ✅ |
| 6 | Coach | 268 | 268 | ✅ |
| 7a | Learn iniciado | 135 | 135 | ✅ |
| 7b | Learn completado | 110 | 110 | ✅ |
| 8a | PRO impresiones | 236 | 236 | ✅ |
| 8b | PRO taps | 141 | 141 | ✅ |
| 8c | PRO `no-token` | 135 | 135 | ✅ |
| 9a | Mint start | 98 | 98 | ✅ |
| 9b | Mint éxito | 44 | 44 | ✅ |
| 9c | Mint error | 41 | 41 | ✅ |
| 9d | Mint cancelado | 38 | 38 | ✅ |
| 10 | Top 5 ejercicios | `rook-1` 139, `rook-distance-1` 133, `rook-2` 124, `rook-no-diagonal-1` 83, `rook-9` 67 | idéntico | ✅ |
| 11 | Top 5 eventos | `peones_balance_viewed` 3.939 … `arena_coach_signal_viewed` 1.518 | idéntico | ✅ |
| 12 | País/container/superficie | NG·minipay·play 11.813 … ID·minipay·play 1.877 | idéntico | ✅ |
| R1 | **D1** (cohortes 08-10..08-13, n=471) | 14 | 14 | ✅ |
| R2 | **D3** (misma cohorte) | 3 | 3 | ✅ |

**[FACT] Coincidencia EXACTA en las 25 comparaciones.** Ningún "casi".

⚠️ **El `props` de Postgres es `jsonb` y en Parquet es `VARCHAR` (texto JSON).** No es pérdida:
`json_extract_string(props,'$.exerciseId')` reproduce lo que `props->>'exerciseId'` devolvía, y
la paridad de las métricas 8c, 9a–9d y 10 lo demuestra sobre datos reales.

⛔ **Limitación honesta de D1/D3 en esta prueba:** con una ventana de 7 días sólo son
calculables las cohortes cuyo día de seguimiento **cae dentro del archivo** (por eso
08-10..08-13). No es un límite del modelo — es un límite de haber archivado una ventana. Con el
histórico completo archivado, D1/D3/D7 salen para cualquier cohorte.

### Un hallazgo que refuerza la fidelidad

**[FACT] 53 de 1.261 sesiones de `analytics_events` NO existen en `session_first_seen`**
(join: 45.118 filas / 1.208 sesiones). **Lo primero que verifiqué fue si lo había introducido la
exportación: no.** Postgres devuelve **exactamente los mismos 45.118 / 1.208**.

⚠️ Es una propiedad de producción, y el archivo **la reproduce en vez de taparla**. Deja una
regla: **`session_first_seen` no es un índice completo de sesiones y no debe usarse como
denominador.** El join de cuentas sí cuadra al byte: 40.124 filas = 45.324 − 5.200 con
`account_ref` nulo, y 934 wallets.

## COMPRESSION RESULT

| | Huella en Postgres | Parquet ZSTD | Ratio |
|---|---:|---:|---:|
| `analytics_events` W2 (heap + índices) | **25,8 MB** | **1,16 MB** | **22,3×** |
| — sólo heap, sin índices | 11,2 MB | 1,16 MB | 9,7× |
| Lookups (`account_` + `session_first_seen`) | 2,7 MB | 0,29 MB | 9,4× |
| **Archivo total** | **28,5 MB** | **1,45 MB** | **19,7×** |

**[FACT] 45.324 filas de analítica caben en 1,16 MB.**
**[INFERENCE]** A ese ratio, **los 161,7 MB completos de `analytics_events` serían ~7 MB** de
Parquet.

⚠️ **Buena parte del ratio no es compresión, es no llevar índices:** en Postgres los índices
(91,7 MB) pesan más que los datos (70,0 MB), y un archivo analítico no los necesita.

## QUERY PERFORMANCE

**[FACT] 1,22 s de pared** para la suite entera — 16 métricas agregadas, tres rankings,
la distribución de dimensiones y las dos de retención con su join — **en frío, dentro de un
contenedor, y con `--network none`.**

Puesta en marcha, íntegra:

```
docker run --rm --network none -v <archivo>:/out duckdb/duckdb:latest /duckdb -c "<SQL>"
```

Sin instalar nada en la máquina, sin estado que sobreviva (`--rm`), sin credenciales.

**¿Puede una sesión futura hacer archivo → DuckDB → SQL → resultado → análisis, sin tocar
producción?** ⛔ **YES, y no es una opinión: la suite de paridad se corrió con la red del
contenedor DESHABILITADA.** Producción era inalcanzable por construcción mientras esos números
se calculaban.

## RESTORE TEST

**[FACT]** Se creó `private/archive/restore-proof.duckdb` (3,5 MB) desde los Parquet y se
reabrió **en `READ_ONLY`**:

| Verificación | Resultado |
|---|---|
| Esquema | **14 columnas originales + `event_date`**. `id` sigue siendo `UUID`, `created_at` conserva zona horaria |
| Filas | `analytics_events` **45.324** · `account_first_seen` **6.287** · `session_first_seen` **8.315** |
| `props` JSON | `exerciseId` → `rook-1`/`rook-2`/`rook-4`, `starsEarned` → `3`. Legible |
| Join por cuenta | 40.124 filas / **934** wallets — idéntico a Postgres |
| Join por sesión | 45.118 filas / **1.208** sesiones — idéntico a Postgres |

⛔ **Nada se escribió de vuelta a Supabase.** La base restaurada es local y desechable.

## PRIVACY HANDLING

- **[FACT]** El archivo vive en `private/`, ignorado en `.gitignore:112`. Verificado con
  `git check-ignore`; `git status` no lo ve.
- ⛔ **El archivo crudo contiene `account_ref` completos y `props` sin redactar.** Se trata como
  **PRIVADO**. No se commitea, no se publica, no sale de la máquina.
- **[FACT] En este documento no aparece un solo identificador**: los informes usan agregados, y
  cuando hace falta señalar un wallet se usa `left(md5(...), 8)`.
- ⚠️ **Incidente menor de esta sesión, y su corrección:** un error de Docker volcó el project ref
  de Supabase en la terminal. No es una credencial, pero **el repo es público**, así que el
  driver ahora lo redacta como `[REF]` igual que a la password. Nunca llegó a un archivo.
- **[INFERENCE]** Para compartir análisis: reemplazar `account_ref` por
  `left(md5(account_ref || salt), 8)` y aplicar a `props` el mismo enmascarado de
  `scripts/ops/read-only-query.ts`.

## PARTE 10 — Qué quedaría (simulación, nada se borra)

Reusando la huella ya medida (570 B/fila: 247 heap + 323 índice):

| Retención en caliente | Filas quedan | Filas archivadas | % fuera | Base resultante |
|---|---:|---:|---:|---:|
| 24 h | 6.092 | 291.427 | 98,0% | ~38,6 MB |
| 72 h | 18.860 | 278.659 | 93,7% | ~45,7 MB |
| **7 d** | 44.416 | 253.103 | 85,1% | **~59,8 MB** |
| 14 d | 199.524 | 97.995 | 32,9% | ~145,2 MB |

⛔ **No se elige ventana permanente en esta pasada.** ⚠️ Nótese que 7 días en caliente es
justo lo que necesita `pnpm ops:no-token`.

## PARTE 11 — Arquitectura futura (SÓLO DISEÑO)

```
analytics_events → export diario (por día, ZSTD) → verificar filas + min/max + sha256
                 → manifiesto → archivo Parquet privado
                 → [ventana de retención alcanzada] → elegible para salir de caliente
```

### ⛔ Son DOS problemas distintos y sólo uno quedó probado

| | A. ARCHIVO | B. RECUPERAR DISCO |
|---|---|---|
| Qué resuelve | Preservar el histórico | Bajar `pg_database_size` |
| Estado | ✅ **PROBADO HOY** | ⛔ **NO probado, ni intentado** |

⛔ **Un `DELETE` no resuelve B.** Marca tuplas muertas; el espacio queda reutilizable por la
tabla y el tamaño de la base **no baja**.

| Opción para B | Devuelve disco | Lock / downtime | Riesgo | Complejidad |
|---|---|---|---|---|
| **Partición por tiempo + `DROP`** | ✅ Sí | Ninguno al soltar | **Bajo** | Alta: migrar una tabla de 277 k filas a particionada |
| Copia a tabla nueva + swap | ✅ Sí | Ventana de escritura | Medio | Media |
| `VACUUM FULL` | ✅ Sí | ⛔ `ACCESS EXCLUSIVE`, tabla ilegible, exige ~2× libre | **Alto** | Baja |
| `pg_repack` | ✅ Sí | Sin lock largo | Medio | **[UNKNOWN]** si Supabase la habilita |

**[INFERENCE] El camino coherente es particionar por tiempo.** Es el único donde soltar
histórico es `DROP` de una partición: instantáneo, sin lock global y **devolviendo disco de
verdad**. ⛔ **Nada de esto se implementa acá.**

## PARTE 12 — Frontera de observabilidad (SÓLO DISEÑO)

| Familia | Clasificación | Razón |
|---|---|---|
| `training_exercise_*`, `exercise_*`, `daily_tactic_*`, `arena_game_*`, `victory_claim_tx`, `pro_*`, `labyrinth_complete`, `badge_claim_tx` | **PRODUCT HISTORY** → al archivo | Sostienen todo el informe de tendencia |
| `modal_open`, `dock_tap`, `play_hub_*`, `coach_viewer_*` | **SHORT-LIVED TELEMETRY** → caliente un tiempo, archivo opcional | Diagnóstico de UI; su valor caduca |
| `app_opened`, `arena_mount`, `arena_fresh_reset_fired`, `tx_progress_view` | **OPERATIONAL OBSERVABILITY** → deberían ser métricas/logs, no filas eternas | `app_opened` tiene `account_ref` en **8** wallets de 10.341 filas: no responde preguntas de producto |
| `peones_balance_viewed` | ⚠️ **OPERATIONAL, con reserva** | Es el 8,7% del volumen y lo dispara el render — pero hoy es **la única señal de alcance universal**. ⛔ No degradar sin reemplazo |
| `score_save_failed` | **[UNKNOWN]** | 844 filas en W2, 22,2 por sesión, 7 en 24 h. No se clasifica hasta saber qué fue |

⛔ **Cero OpenTelemetry en esta pasada.**

## FAILURES / LIMITATIONS

1. ⚠️ **Se archivó 7 días, no el histórico.** La prueba vale para el modelo; mover 297.519 filas
   no está probado a escala (**[INFERENCE]** 297 k filas ≈ 7 MB y ~8 s, extrapolando).
2. ⛔ **D1/D3 sólo para cohortes con seguimiento dentro de la ventana.** Límite del recorte.
3. ⚠️ **`session_first_seen` está incompleta en producción** (53 sesiones de 1.261). El archivo
   lo reproduce con fidelidad; **la tabla no sirve como denominador de sesiones.**
4. ⚠️ **Nombres `part-0.parquet`**, no `part-0000.parquet`.
5. ⛔ **No se probó recuperación de disco.** Fuera de alcance a propósito.
6. ⚠️ **No hay export automatizado todavía** — esto se corrió con un driver desechable del
   scratchpad, no con herramienta versionada.
7. ⚠️ **Los Parquet quedaron con dueño `root`** (los escribió el contenedor). Sin consecuencia
   para leerlos por el mismo camino; a anotar si alguien los toca desde el host.

---

# CAN HISTORICAL ANALYTICS LEAVE HOT POSTGRES?
**YES.** 45.324 filas exportadas, verificadas por partición, con checksums, y reproduciendo las
25 métricas con coincidencia exacta.

# CAN WE STILL REPRODUCE PRODUCT METRICS?
**YES.** Las 25 comparaciones dieron idénticas, incluidas D1 y D3 — **siempre que
`account_first_seen` viaje con la analítica.**

# CAN WE QUERY HISTORY WITHOUT TOUCHING PRODUCTION?
**YES.** La suite corrió con `--network none`: producción era **inalcanzable** mientras se
calculaban los números.

# WHAT MUST REMAIN HOT?
- **[FACT]** Todo `PRODUCT_STATE`: `peones_ledger`, `score_attempts`, `score_saves`,
  `score_write_sessions`, `welcome_pack_claims`, `pro_subscriptions`, `treasury_*`, `duels`,
  `content_overlay`, `victories`. **~19,5 MB.**
- **[INFERENCE]** Una ventana corta de `analytics_events`. **Piso duro: 7 días**, porque menos
  deja sin ventana a `pnpm ops:no-token` mientras el Lote 1 está recolectando.

# WHAT MUST BE ARCHIVED TO PRESERVE RETENTION?
⛔ **`account_first_seen`, sin excepción.** D1/D3/D7 **no** salen de `analytics_events`.
Son 1,3 MB en Postgres, 165 KB en Parquet. `session_first_seen` es opcional (137 KB).

# WHAT IS STILL REQUIRED TO ACTUALLY RECLAIM DISK?
⛔ **Todo.** Esta prueba resolvió el archivo, **no** el espacio. Hace falta particionar
`analytics_events` por tiempo (hoy no lo está) para que soltar histórico sea un `DROP` que
devuelva disco. Las alternativas —`VACUUM FULL`, copia y swap, `pg_repack`— quedan comparadas
arriba y **ninguna se probó**.

# NEXT SAFE STEP:
**Traerte este resultado y no seguir.** El paso siguiente que yo tomaría —y que **no tomé**— es
versionar el exportador como `pnpm ops:archive` con su manifiesto y verificación, para que
archivar deje de depender de un script desechable. **Todo lo que toque retención, particionado
o borrado espera tu decisión.**
