# Recuperación de espacio físico en Supabase — diseño

**Fecha:** 2026-08-18 · **Tipo:** diseño, **sólo lectura**. Cero mutaciones.
**Antecedente:** archivo probado y completo (`06d5815`).
**Veredicto corto:** ⛔ **el problema medido no es el que el brief supone.**

---

## 0. Las cuatro mediciones que reencuadran la pasada

| # | Medición | Consecuencia |
|---|---|---|
| 1 | **`n_dead_tup = 0`** en `analytics_events` | ⛔ **No hay bloat.** `VACUUM FULL` y `pg_repack` compactan espacio muerto; hoy no hay ninguno que compactar. **Recuperarían ~0 MB.** |
| 2 | **7 de 9 RPC `stats_*` usan ventana de 30 días**, y `/stats` lee la tabla **directo** en 5 lugares más | ⛔ **Las cuatro ventanas del brief (24h/72h/7d/14d) son inviables.** El piso es **30 días** |
| 3 | **Sólo 43.386 filas (14,4%) superan los 30 días** | ⚠️ Una retención de 30 días hoy libera **~15 MB de 197**. El pico de lanzamiento es **reciente** |
| 4 | **`pg_repack` 1.5.2 y `pg_partman` 5.3.1 están DISPONIBLES**; `pg_cron` instalado | ✅ Las opciones B y C son viables de verdad, no hipotéticas |

⛔ **Y un descubrimiento que el brief no contemplaba: ya existe un borrado programado.**
`prune_analytics_events()` + cron **activo** `prune_analytics_events_monthly` (`0 3 1 * *`).

---

## PARTE 1 — Contrato actual de la tabla

**Columnas (14):** `id uuid NOT NULL DEFAULT gen_random_uuid()`, `created_at timestamptz NOT NULL
DEFAULT now()`, `session_id text NOT NULL`, `event text NOT NULL`, `props jsonb`, + 9 dimensiones
anulables.

| Elemento | Estado |
|---|---|
| **PK** | ⛔ **`PRIMARY KEY (id)` — `created_at` NO participa** |
| FK entrantes/salientes | **ninguna** |
| Unique | ninguno más allá de la PK |
| CHECK | 2, ambos **`NOT VALID`**: `account_ref ~ '^[0-9a-f]{32}$'`, `country ~ '^[A-Z]{2}$'` |
| Triggers | **ninguno** |
| Secuencias | ninguna (UUID) |
| **RLS** | **habilitada**, `forced=false`, **cero políticas** → denegación total salvo `service_role` |
| Índices | 8 (PK + 7), **todos con la forma `(col, created_at DESC)`** |

### Grafo de dependencias

```
analytics_events
├── ESCRITURA
│   ├── /api/telemetry           insert por lotes (≤20 filas)
│   └── lib/duel/service.ts      insert de una fila
├── LECTURA runtime
│   ├── lib/stats/public-aggregator.ts   5 lecturas DIRECTAS  → /stats
│   ├── 9 RPC stats_*                    ventanas de 30 días  → /stats
│   └── /api/admin/lite-stats            panel interno
├── LECTURA ops (fuera de Vercel)
│   ├── pnpm ops:no-token · ops:query · ops:archive
├── FUNCIONES
│   └── prune_analytics_events()  SECURITY DEFINER, borra >90 días
└── CRON
    └── prune_analytics_events_monthly  0 3 1 * *  ACTIVO
```

**[FACT] Ninguna vista ni matview la referencia.** Nada depende de que `id` sea único
globalmente: la PK tiene **0 scans**.

⚠️ **Observación de seguridad, sin acción en esta pasada:** `anon` y `authenticated` tienen
`INSERT/UPDATE/DELETE/TRUNCATE` sobre la tabla. La RLS sin políticas los frena **a nivel de
fila**, pero **`TRUNCATE` no pasa por RLS**. Hoy no es explotable por PostgREST, que no expresa
`TRUNCATE`. Lo dejo anotado porque un rediseño que recree privilegios **no debe copiar esto**.

---

## PARTE 2 — Path de escritura

| Origen | Forma | Frecuencia | Reintento | Transacción | Conflicto | Depende de defaults |
|---|---|---|---|---|---|---|
| `/api/telemetry` | `insert(rows)`, lote ≤20 | ~450 req/día | ⛔ **ninguno — descarta** | insert único implícito | sin `ON CONFLICT` | **sí**: `id` y `created_at` |
| `lib/duel/service.ts` | `insert({…})` una fila | marginal | ninguno | implícita | sin `ON CONFLICT` | sí |

⚠️ **Producción y preview escriben en la MISMA base.** No hay dimensión que los separe.

### ¿Puede la aplicación seguir escribiendo durante una migración?

**PARCIALMENTE, y la respuesta depende de la opción** — pero hay un atenuante enorme y medido:

⛔ **La telemetría YA descarta en fallo, por diseño y a propósito** (`lib/telemetry.ts`: *"a
failed flush is discarded, NOT re-queued, NOT retried"*). Se escribió así durante el incidente
522 para no convertir una caída en una tormenta.

**Consecuencia:** una ventana de escritura corta **no rompe nada** — pierde los eventos de esa
ventana. A 6.475 filas/día, **un congelamiento de 60 s cuesta ~4,5 filas.**

**Congelamiento mínimo requerido:** con partición nativa + `ATTACH`, **cero**. Con copia+swap,
el `RENAME` (milisegundos, `ACCESS EXCLUSIVE`). Con `VACUUM FULL`, **toda la duración**.

---

## PARTE 3 — Path de lectura

| Lector | Clasificación | Ventana | Nota |
|---|---|---|---|
| `public-aggregator.ts` (5 lecturas) | ⛔ **RUNTIME_CRITICAL** | hasta 30 días | Alimenta `/stats`, **entregable del listing de MiniPay (§8)** |
| 9 RPC `stats_*` | ⛔ **RUNTIME_CRITICAL** | **30 días** (7 de 9); 7 días y 1 día las otras dos | Idem |
| `/api/admin/lite-stats` | OPS_ONLY | — | Panel interno |
| `pnpm ops:no-token` | OPS_ONLY | **7 días** en la práctica | Ventana de observación del Lote 1 |
| `ops:query` · `ops:archive` | RESEARCH_ONLY | toda | Fuera de Vercel |
| Producto (juego) | **ninguno** | — | ✅ **El juego NO lee esta tabla** |

**[FACT] El piso de retención lo fija `/stats`, no ops: 30 días.**

⛔ **Corrijo mi propia auditoría del 2026-08-17**, que dijo *"piso duro: 7 días, porque menos
deja sin ventana a `ops:no-token`"*. Era incompleto: **no miré las RPC de `/stats`.** El piso
real es **30 días**, cuatro veces más.

### ¿Particionar cambia los planes?

**[INFERENCE] Mejora, no empeora.** Los 8 índices llevan `created_at DESC` y **toda** consulta
de `/stats` filtra por `created_at >= now() - interval`, así que el *partition pruning* aplica
limpio. ⚠️ Con ~108 particiones diarias hay coste de planificación por partición; a esta escala
es despreciable, pero **es lo que un ensayo debe medir**, no asumir.

---

## PARTE 4 — Opción A: migración a tabla particionada

**Destino:** `PARTITION BY RANGE (created_at)`, particiones **mensuales** (no diarias: 108
particiones diarias multiplicarían el coste de planificación sin beneficio, y la unidad de
retención es de 30 días).

| Aspecto | Diseño |
|---|---|
| **PK** | ⛔ **`(id, created_at)`** — Postgres exige que la clave de partición esté en toda restricción única. `id` deja de ser único global y pasa a serlo **por partición** |
| ¿Rompe algo? | **[FACT] No**: sin FK, sin unique adicional, PK con **0 scans** |
| CHECK | Se recrean; los `NOT VALID` pueden recrearse igual y validarse después |
| Índices | Los 7 se recrean **por partición** (`CREATE INDEX ON ONLY` + `ATTACH`) |
| RLS | ⛔ **Se re-habilita en la tabla padre y se HEREDA**. Las particiones no la heredan solas si se crean sueltas |
| Grants | Se recrean en el padre. ⚠️ **Oportunidad de no copiar el `TRUNCATE` a `anon`** |
| Triggers | Ninguno que preservar |
| Ruteo de inserts | Nativo por rango. `/api/telemetry` **no cambia una línea** |
| Datos viejos | `INSERT INTO nueva SELECT * FROM vieja` o `ATTACH` de la vieja como partición |
| Escrituras concurrentes | ✅ **Cero congelamiento** si la vieja se `ATTACH`ea como partición histórica |
| Cutover | `RENAME` (ms) o `ATTACH` |
| Rollback | `DETACH` + `RENAME` inverso |
| Disco temporal | ⚠️ **~162 MB** si se copia; **~0** si se `ATTACH`ea la vieja |
| Locks | `ATTACH PARTITION` toma `SHARE UPDATE EXCLUSIVE` en PG14+ (no bloquea lecturas ni escrituras) |
| Downtime | **~0 s** con la ruta de `ATTACH` |
| ¿Supabase lo permite? | ✅ Es Postgres estándar. **`pg_partman` 5.3.1 disponible** para automatizar el rodado |
| Reversible | ✅ Sí |

### Archivo → verificar → `DROP` de partición

```
export a Parquet (ops:archive)  →  verificar por partición + SHA-256
                                →  DROP la partición correspondiente
```

⛔ **¿`DROP PARTITION` libera disco de verdad?** **SÍ, y ésta es la única opción de la que eso
es cierto sin más pasos.** Una partición es una tabla física propia; `DROP TABLE` devuelve sus
archivos al sistema operativo de inmediato. **`DELETE` no.**

---

## PARTE 5 — Opción B: copia + swap

| Aspecto | Evaluación |
|---|---|
| Ventana de lock | `RENAME` en `ACCESS EXCLUSIVE`: **milisegundos** |
| Doble escritura / catch-up | ⛔ **Requerida.** Entre el fin de la copia y el `RENAME` llegan filas a la vieja. Sin captura de delta **se pierden** |
| ⚠️ Atenuante medido | La telemetría **ya descarta** en fallo → perder unos segundos de eventos es **el comportamiento normal**, no una regresión |
| Riesgo de corrección | **MEDIO**: el catch-up es lógica a medida y sólo se prueba ensayándola |
| Disco temporal | ⛔ **~162 MB** — con la base en 197 de 500 MB, cabe |
| RLS / grants / índices | **Todo a mano.** Es el riesgo real: un índice o una política que no se recrea no falla, sólo se degrada en silencio |
| Rollback | `RENAME` inverso mientras la vieja exista |
| ¿Atómico? | ✅ Dos `RENAME` en una transacción son atómicos |
| **Futuro** | ⛔ **No deja arquitectura**: resuelve hoy y el problema vuelve |

---

## PARTE 6 — Opción C: pg_repack

**[FACT] DISPONIBLE — verificado, no supuesto:** `pg_available_extensions` reporta `pg_repack`
**1.5.2**, `installed_version` vacío (disponible, no instalada).

| Aspecto | Evaluación |
|---|---|
| Requisitos | Instalar la extensión **+ el binario cliente `pg_repack`**. ⚠️ **[UNKNOWN]** si Supabase permite la conexión que necesita |
| Locks | Breves al inicio y al final; el grueso corre en línea |
| Disco extra | ~1× la tabla (**~162 MB**) |
| Bajo escrituras | ✅ Las tolera |
| Rollback | Deja la tabla original hasta el swap |
| **⛔ ¿Sirve hoy?** | **NO.** **`n_dead_tup = 0`: no hay bloat que compactar.** Recuperaría ~0 MB |
| Futuro | ⛔ Ninguno: es una herramienta de compactación, no de retención |

**[FACT] `pg_repack` sólo se vuelve útil DESPUÉS de un borrado masivo** — y si vamos a borrar en
masa, particionar y hacer `DROP` es estrictamente mejor: sin copia y sin disco extra.

---

## PARTE 7 — Opción D: VACUUM FULL

| Aspecto | Evaluación |
|---|---|
| Lock | ⛔ **`ACCESS EXCLUSIVE` toda la operación**: la tabla queda **ilegible y no escribible** |
| Duración estimada | **[INFERENCE]** 162 MB en instancia compartida: **~30–90 s** |
| Disco temporal | ⛔ **~2×** — reescribe entera antes de soltar la vieja: **~162 MB libres** |
| Telemetría entrante | Se **pierde** durante la ventana (~5 filas). ⚠️ `/stats` **falla** mientras dure |
| Rollback | Ninguno: es atómico, o completa o no |
| **⛔ ¿Sirve hoy?** | **NO, por la misma razón que C: cero tuplas muertas** |
| Futuro | Ninguno |

---

## PARTE 8 — Matriz de decisión

| Opción | Libera disco HOY | Downtime | Riesgo de escritura | Disco temporal | Retención futura | Complejidad | Rollback |
|---|---|---|---|---|---|---|---|
| **A · Particionar** | ⚠️ **~15 MB** | **NINGUNO** (vía `ATTACH`) | **BAJO** | **~0** | ✅ **ALTA** | **ALTA** | ✅ `DETACH` |
| **B · Copia + swap** | ⚠️ ~15 MB | **BAJO** (ms) | **MEDIO** (catch-up) | ⛔ ALTO (162 MB) | ⛔ **NINGUNA** | MEDIA | ✅ `RENAME` |
| **C · pg_repack** | ⛔ **~0 MB** | BAJO | BAJO | ALTO | ⛔ NINGUNA | MEDIA | ✅ |
| **D · VACUUM FULL** | ⛔ **~0 MB** | ⛔ **ALTO** | ALTO | ⛔ ALTO (2×) | ⛔ NINGUNA | BAJA | ⛔ NINGUNO |

⚠️ **La columna que decide no es "libera disco", es "retención futura".** Las cuatro liberan
poco hoy; **sólo A deja una arquitectura donde soltar histórico es barato y repetible.**

⛔ **Y ninguna se justifica por urgencia:** la base está en **197 de 500 MB (39,4%)**.

---

## PARTE 9 — Ventana caliente

⛔ **Las cuatro candidatas del brief son inviables.** No es preferencia: `/stats` es entregable
del listing de MiniPay y **7 de 9 RPC piden 30 días**.

| Ventana | ¿Viable? | Por qué |
|---|---|---|
| 24 h | ⛔ NO | Rompe `/stats` y `ops:no-token` |
| 72 h | ⛔ NO | Idem |
| 7 d | ⛔ NO | Cubre `ops:no-token`, **rompe `/stats`** |
| 14 d | ⛔ NO | **Rompe `/stats`** |
| **30 d** | ✅ **Mínimo viable** | Cubre las 9 RPC y `ops:no-token` |
| **45 d** | ✅ **Recomendada** | 30 d + 15 de margen |

### CANDIDATA: **45 días**

**Por qué 45 y no 30:** 30 es el mínimo **exacto** de la RPC más exigente. Una retención pegada
al mínimo hace que **cualquier cambio de ventana en una RPC rompa `/stats` en silencio**, y el
síntoma sería un número que baja, no un error. **15 días de margen cuestan 8,9 MB.**

**Lo que rinde hoy [FACT]:**

| Retención | Filas fuera | Libera | Base resultante |
|---|---:|---:|---:|
| 30 días | 43.386 (14,4%) | ~14,9 MB | ~182 MB |
| **45 días** | **27.596 (9,3%)** | **~9,5 MB** | **~187 MB** |
| 60 días | 18.666 (6,3%) | ~6,4 MB | ~190 MB |

⚠️ **Rinde poco porque el pico de lanzamiento es RECIENTE.** El 62% de la tabla son seis días de
agosto que todavía están dentro de cualquier ventana razonable.

**[INFERENCE] Lo que rinde en régimen:** a 6.475 filas/día, una ventana de 45 días converge a
**~291.000 filas ≈ 166 MB**, y una de 30 días a **~194.000 ≈ 111 MB**. **La retención no es una
reducción, es un TECHO** — y eso es lo que realmente compra: crecimiento acotado en vez de
lineal. Sin ella, +3,7 MB/día para siempre.

---

## PARTE 10 — Fallos y rollback (para la Opción A)

| Fallo | DETECCIÓN | ROLLBACK | RIESGO DE PÉRDIDA |
|---|---|---|---|
| La copia falla a mitad | El paso aborta; la tabla vieja intacta | `DROP` de la nueva vacía | **Ninguno** |
| Desajuste de validación | `count(*)` y `min/max` por partición, misma disciplina que `ops:archive` | No hacer cutover | **Ninguno** |
| Llegan escrituras en el cutover | Comparar `max(created_at)` antes/después | Vía `ATTACH` **no aplica**: no hay ventana | ⚠️ Sólo en B: segundos de telemetría, **que ya se descarta por diseño** |
| Esquema distinto | Diff de `information_schema.columns` antes del cutover | Abortar | Ninguno |
| **RLS no coincide** | ⛔ **`SELECT relrowsecurity` + probar con `set role anon`** | `DETACH` + revertir | ⛔ **Alto si no se detecta: exposición, no pérdida** |
| Índice faltante | Comparar `pg_indexes` contra los 8 conocidos | Recrear en caliente | Ninguno; degradación |
| Pico de errores de la app | Logs de Vercel + tasa de `/api/telemetry` | `DETACH` + `RENAME` inverso | Ninguno |
| **La telemetría deja de escribir** | ⛔ **Filas/hora contra la línea base de ~270** | Rollback inmediato | Los eventos de la ventana |
| **`ops:no-token` se rompe** | El tool imprime 0 intentos con tráfico vivo | Rollback | Ninguno: el Lote 1 sigue emitiendo |

⛔ **La verificación de RLS es la que no se puede saltear**, y no se comprueba leyendo el
`CREATE`: se comprueba **corriéndola con `set role anon`**. Un fallo ahí no pierde datos —
**los expone**.

---

## PARTE 11 — Ensayo (no producción)

**Postgres desechable en Docker** (`postgres:16-alpine`, `--rm`), cargado **desde el archivo
Parquet ya probado** — 297.846 filas reales, con la forma real.

⚠️ **Ventaja específica:** el ensayo no necesita tocar producción **para nada**, porque el
archivo ya es una copia fiel verificada. Esa es una consecuencia del trabajo anterior que
conviene no desperdiciar.

Lo que el ensayo debe **probar, no suponer**:

1. La migración corre entera y es reversible.
2. **Escrituras concurrentes sobreviven** — un generador insertando mientras migra.
3. `count(*)` por partición coincide, y `min/max` caen dentro de cada partición.
4. Los 2 CHECK y la PK `(id, created_at)` existen.
5. ⛔ **RLS con `set role anon`**, no leyendo el DDL.
6. Los 8 índices existen **en cada partición**.
7. **El partition pruning ocurre de verdad** — `EXPLAIN` de una consulta `stats_*` de 30 días.
8. ⛔ **`DROP` de una partición reduce `pg_database_size`** — medir antes y después. **Es la
   afirmación central de toda esta pasada y la única que no está verificada.**
9. El rollback (`DETACH` + `RENAME`) devuelve el estado inicial.

---

## PARTE 12 — Decisión

**RECOMMENDED RECLAMATION STRATEGY:**
**Opción A — particionar por rango sobre `created_at`, particiones mensuales, adjuntando la
tabla actual como partición histórica.** Retención **45 días**, con archivo previo vía
`ops:archive` y liberación por `DROP` de partición.

**WHY:**
⛔ **Porque las otras tres no resuelven el problema medido.** `n_dead_tup = 0`: no hay bloat, así
que `pg_repack` y `VACUUM FULL` recuperarían ~0 MB. Copia+swap recupera lo mismo que A pero pide
162 MB temporales, catch-up a medida y **no deja arquitectura**. Sólo A convierte "soltar
histórico" en un `DROP` instantáneo que **sí** devuelve disco — y `pg_partman` está disponible
para automatizar el rodado.

**EXPECTED DOWNTIME:** **~0 s** por la ruta de `ATTACH` (`SHARE UPDATE EXCLUSIVE`, no bloquea
lectura ni escritura).

**EXPECTED TEMP DISK:** **~0** por `ATTACH`. ~162 MB si se copia (cabe: 197 de 500 MB).

**CAN WRITES CONTINUE:** **YES** por la ruta de `ATTACH`. **PARTIALLY** si se copia — y con el
atenuante de que la telemetría **ya descarta en fallo por diseño**: ~4,5 filas por minuto de
congelamiento.

**ROLLBACK MECHANISM:** `DETACH PARTITION` + `RENAME` inverso, con la tabla original intacta
hasta que la validación pase.

**FIRST SAFE REHEARSAL:** Postgres en Docker `--rm`, cargado desde el Parquet ya verificado, con
un generador de escrituras concurrentes. **La medición que decide todo: `pg_database_size` antes
y después de `DROP` de una partición.**

**WHAT MUST NOT BE TOUCHED:**
- ⛔ El path de escritura de `/api/telemetry` — el Lote 1 está recolectando (5 de ~200).
- ⛔ Las 9 RPC `stats_*` y `public-aggregator`: `/stats` es entregable del listing.
- ⛔ El cron `prune_analytics_events_monthly`. ⚠️ **Pero saber que existe cambia el plan:** el
  2026-09-01 borrará **10.337 filas (3,4%)** y **no liberará un solo byte** — dejará tuplas
  muertas. Es la primera vez que `pg_repack` tendría algo que hacer.
- ⛔ Índices, esquema, plan, deploy, P2P, instrumentación de PRO.
- ⚠️ **Y al recrear privilegios, NO copiar `TRUNCATE` a `anon`/`authenticated`.**

---

# READY FOR LOCAL REHEARSAL

El ensayo es gratis, aislado y no toca producción, y hay exactamente **una** afirmación sin
verificar que lo justifica: **que `DROP` de una partición reduce `pg_database_size`.**

⛔ **Pero separo el ensayo de la ejecución, porque la evidencia no sostiene ejecutar ahora:**

- La base está al **39,4%** de su límite. **No hay urgencia.**
- Hoy la migración liberaría **~9,5 MB de 197 (4,8%)** a cambio de cambiar el contrato de la PK
  en una tabla viva. **Mal negocio.**
- ⚠️ **Y mejora sola con el calendario:** el pico de lanzamiento sale de la ventana de 45 días
  alrededor del **2026-09-17**, y ahí la misma migración pasa a liberar ~80 MB.

**Lo que yo haría: ensayar ahora, ejecutar cuando el pico envejezca.** El ensayo es lo que
convierte "creemos que `DROP` libera disco" en un hecho medido, y eso conviene tenerlo **antes**
de necesitarlo.

⛔ **Nada se ejecuta sin traértelo antes.**
