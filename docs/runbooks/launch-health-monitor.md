# Runbook — Monitor de salud de lanzamiento

Un comando que reemplaza abrir tres paneles. **Solo lectura**: no escribe, no
hace DDL, no cambia configuración, no toca infraestructura.

```bash
pnpm ops:health
```

---

## 1. Instalación

No hay instalación propia. El monitor usa lo que el repo ya tiene:

| Requisito | Para qué | Verificar |
|---|---|---|
| **Docker corriendo** | `psql` vive en un contenedor efímero; no hay psql local y el host directo de la base es IPv6-only | `docker ps` |
| **Vercel CLI autenticado** | deployments y logs, sin token | `vercel whoami` |
| `pnpm install` hecho | `tsx` | ya está |

La primera corrida descarga `postgres:16-alpine` (~80 MB). Después es instantáneo.

---

## 2. Variables

Se leen de `apps/web/` y de la raíz; una variable real del entorno gana sobre el
archivo. **El informe solo dice si cada una está configurada, nunca su valor.**

### Requeridas para el eje Supabase

| Variable | Sin ella |
|---|---|
| `SUPABASE_URL` | eje Supabase → `not_configured` |
| `SUPABASE_DB_PASSWORD` | ídem |

### Requeridas para el eje Upstash (data plane)

| Variable | Sin ella |
|---|---|
| `UPSTASH_REDIS_REST_URL` | sin claves ni latencia |
| `UPSTASH_REDIS_REST_TOKEN` | ídem |

### Recomendadas

| Variable | Qué desbloquea | Sin ella |
|---|---|---|
| `LOG_SALT` | digests de sesión estables entre snapshots | las sesiones salen como `session#1`, `session#2`… en vez de un digest |

### Opcionales — **los dos ejes de costo**

| Variable | Qué desbloquea |
|---|---|
| `VERCEL_TOKEN` | invocations del período y Fluid Active CPU |
| `UPSTASH_EMAIL` + `UPSTASH_API_KEY` | comandos del período, % de la cuota de 500 K, bandwidth |

Sin estas cuatro, el monitor **funciona igual** pero no puede dar verde pleno:
son precisamente los dos ejes por los que el proyecto puede quedarse sin
capacidad sin que aparezca ningún error. Se activan solas en cuanto existan.

`SUPABASE_SERVICE_ROLE_KEY` **no se usa**: el monitor no toca PostgREST.

---

## 3. Ejecución

```bash
pnpm ops:health              # informe en consola + artefactos en disco
pnpm ops:health; echo $?     # ver el exit code
```

Cada corrida escribe en `artifacts/ops/` (gitignoreado):

```
2026-08-04T07-22-55Z.json    datos crudos
2026-08-04T07-22-55Z.md      informe legible
latest.json / latest.md      copia de la última — es lo que se compara la próxima vez
```

Duración típica: **~10 s**. Supabase ~1,5 s; el resto es el CLI de Vercel.

---

## 4. Exit codes

| Code | Significado | Qué hacer |
|---|---|---|
| **0** | verde | nada |
| **1** | amarillo | leer los indicadores; no es urgente |
| **2** | rojo | atender |
| **3** | **el monitor falló** | arreglar el monitor, **no** asumir que el sistema está mal |

**El 3 es deliberadamente distinto del 2.** "No pude medir" y "el sistema está
en llamas" piden reacciones opuestas, y confundirlos enseña a ignorar los dos.

---

## 5. `not_configured` vs `unreachable`

La distinción más importante del informe.

| Estado | Qué pasó | Nivel |
|---|---|---|
| **`unreachable`** | Preguntamos y la base **no contestó** | 🔴 **ROJO** |
| **`not_configured`** | **Nunca preguntamos** — falta una credencial | eje sin medir → parcial |

Solo el primero dice algo sobre producción. El segundo habla de esta máquina.

> Esto salió de correr el monitor desde un checkout limpio: un clone recién
> hecho reportaba **ROJO exit 2** sobre una base perfectamente sana. Si ves rojo
> por Supabase, lo primero es confirmar cuál de los dos es.

---

## 6. `GREEN (partial)` — qué significa y qué no

`(partial)` = **al menos un eje crítico no se pudo medir**. Los ejes críticos son
`supabase`, `vercel_cpu` y `upstash_quota`.

- **Sí significa:** nada de lo observado está mal.
- **No significa:** que todo esté bien. El CPU de Vercel puede estar al 99 % y el
  monitor no lo sabría.

Un monitor que dijera "GREEN" sin haber mirado el eje más caro convertiría
ignorancia en tranquilidad. Por eso el `(partial)` y el conteo de ejes.

**Un rojo observado sigue siendo rojo** por más ejes que falten: se muestra como
`RED (partial)`, con exit 2. La ausencia nunca ablanda un hecho.

---

## 7. Ventanas: 15m / 1h / 6h / 24h / peak day

El informe da **una tasa por ventana y nunca una sola cifra diaria**. Las
ventanas discrepan por diseño, y esa discrepancia es información:

```
last_15m       732 ev ·  48.8 ev/min   → 90d 3.8 GB
last_1h      3,212 ev ·  53.5 ev/min   → 90d 4.2 GB
last_6h     11,810 ev ·  32.8 ev/min   → 90d 2.6 GB
last_24h    58,068 ev ·  40.3 ev/min   → 90d 3.1 GB
peak_day    46,337 ev                  → 90d 2.5 GB
```

Cómo leerlas:

| Ventana | Para qué sirve | Para qué NO |
|---|---|---|
| **15m** | ver si algo está pasando **ahora** | planear capacidad — un burst no se sostiene 90 días |
| **1h** | confirmar que el pico de 15m persiste | ídem |
| **6h** | tendencia intradía; suele ser la más baja (incluye la madrugada) | ídem |
| **24h** | **el régimen real.** Ciclo completo | — |
| **peak day** | **el peor día registrado.** Lo que el sistema debe soportar | — |

**La clasificación usa solo 24h y peak day**, el peor de los dos. Las ventanas
cortas se muestran pero no deciden: si decidieran, el informe se pondría
amarillo cada vez que alguien abre la app dos veces.

---

## 8. Métricas acumulativas y `stats_reset`

Algunos contadores **acumulan desde la última vez que se pusieron en cero**:

- `pg_stat_database` (blks_read, temp_files, deadlocks…)
- `pg_stat_wal` (wal_records, wal_bytes…)
- `pg_stat_bgwriter` y `pg_stat_checkpointer`
- `pg_stat_statements`

Cada bloque trae su propio `stats_reset`, y **el diff solo resta cuando los dos
snapshots coinciden en él**. Si no, imprime la razón en vez de un número:

```
WAL records: not comparable (counters were reset between snapshots)
```

> Por qué importa: el cambio de plan Nano → Micro puso esos contadores en cero.
> Una tabla de 98 K filas reportó `n_live_tup = 126` porque la estadística se
> había reseteado minutos antes. Restar cruzando ese límite da basura con
> aspecto de dato.

También se rechaza un delta si **alguno de los dos lados no se midió** — tratarlo
como cero reportaría el valor entero como crecimiento.

**`idx_scan = 0` no significa "índice inútil"** si `stats_reset` es reciente.

---

## 9. Acciones PROHIBIDAS durante un incidente

Nada de esto lo hace el monitor, y nada de esto debe hacerse a mano bajo presión:

| Prohibido | Por qué |
|---|---|
| `VACUUM FULL` | toma `ACCESS EXCLUSIVE` y **bloquea las escrituras de telemetría** |
| `pg_stat_reset()` | destruye la línea base; los diffs quedan inservibles por días |
| `DROP INDEX` por `idx_scan = 0` | el contador puede tener minutos de vida (§8) |
| `DELETE` manual sobre `analytics_events` | existe la poda; un DELETE grande a mano es un pico de WAL en el peor momento |
| `REINDEX` en horario activo | bloquea |
| Subir el plan como primera reacción | mide antes; el incidente del 2026-08-03 era una conexión gateway→origen, no capacidad |
| Cambiar umbrales para que dé verde | — |

---

## 10. Kill switch de telemetría

Dos flags, con propósitos distintos. **Leen OFF solo ante `"0"` o `"false"`
explícitos**: una variable ausente significa ON, para que un env faltante no
ciegue el funnel por accidente.

### Freno de emergencia

```
NEXT_PUBLIC_TELEMETRY_ENABLED=0
```

`track()` queda **inerte**: no encola, no arma timer, no emite. **No** vuelve a
un-request-por-evento — apagar telemetría tiene que *bajar* carga.

### Escotilla de debug

```
NEXT_PUBLIC_TELEMETRY_BATCH_ENABLED=0
```

Vuelve a 1 POST por evento (comportamiento pre-Fase-1). **No es el freno de
emergencia**: sube la carga ~20×. Solo para depurar.

### Procedimiento

1. Definir la variable en Vercel, en **los dos proyectos** (`chesscito` = PLAY,
   `lite-chesscito` = LEARN).
2. **Redeploy** — son `NEXT_PUBLIC_*`, se hornean en el bundle.
3. Confirmar con `pnpm ops:health`: el ritmo de `last_15m` debe caer.
4. ⚠️ Los bundles cacheados en navegadores abiertos siguen emitiendo hasta que
   recarguen. La caída es gradual, no instantánea.

---

## 11. Checklist de recuperación

Tras un incidente, en orden:

- [ ] `pnpm ops:health` → confirmar exit 0 y que Supabase responde
- [ ] `last_15m` y `last_1h` en valores normales (decenas de ev/min, no cientos)
- [ ] `eventos/sesión` ≤ 35
- [ ] 5XX por ruta: ninguno; `html_gateway_errors`: vacío
- [ ] Los deployments de ambos proyectos en el commit esperado
- [ ] Si se activó el kill switch: apagarlo, redeploy, confirmar que la
      telemetría vuelve
- [ ] Correr un **segundo** snapshot a los ~15 min y revisar el diff — una
      corrida sola no distingue recuperación de una pausa
- [ ] Si hubo poda o resize: los deltas acumulativos dirán *not comparable*.
      **Es correcto**, no un error
- [ ] Anotar en el handoff qué quedó sin medir

---

## 12. Troubleshooting

### Docker

| Síntoma | Causa | Solución |
|---|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop apagado | abrirlo; `docker ps` debe responder |
| Primera corrida tarda ~1 min | descarga de `postgres:16-alpine` | esperar; solo la primera vez |
| `tenant or user not found` | host `aws-0-…` | el monitor usa `aws-1-…`; si cambió la región, actualizar `SUPABASE_POOLER_HOST` |
| `no route to host` | el host directo es IPv6-only | usar el pooler, que es lo que el monitor hace |

### Vercel CLI

| Síntoma | Causa | Solución |
|---|---|---|
| Proyecto en `not_observable` | CLI sin sesión | `vercel login` |
| `usage: 404` | **el plan Hobby no expone el endpoint de costos** | esperado; usar el panel |
| `usage: 401` | token inválido | regenerar `VERCEL_TOKEN` |
| `usage: 403` | el token no alcanza para el scope | revisar permisos |
| Muestra de logs vacía | sin tráfico en la ventana | no es un error |

> Los logs vienen **duplicados** (mismo `requestId` y mismo `id`). El monitor
> deduplica y muestra ambos números: `52 requests (de 100 filas crudas)`. Si
> alguna vez ves los dos iguales, la deduplicación se rompió.

### Credenciales

| Síntoma | Causa |
|---|---|
| Supabase `not_configured` | falta `SUPABASE_URL` o `SUPABASE_DB_PASSWORD` |
| Sesiones como `session#1` | falta `LOG_SALT` — funciona, pero no se comparan entre snapshots |
| `refusing to write an artefact containing…` | **el monitor detectó un secreto en su propia salida y abortó**. Es el backstop haciendo su trabajo: reportarlo, no desactivarlo |

### Upstash

| Síntoma | Explicación |
|---|---|
| cuota siempre `not_observable` | faltan `UPSTASH_EMAIL` + `UPSTASH_API_KEY` |
| primera latencia ~10× la mediana | es el handshake TLS. Por eso se reporta **mediana y p95**, con la primera aparte |
| «¿por qué no usan `INFO`?» | sus contadores son **por nodo**: dos llamadas con segundos de diferencia dieron 67.615 y 295.319 comandos. Un % derivado de ahí sería ruido con forma de métrica |

---

## 13. Ejemplos de salida

### Normal — verde pleno

```
ESTADO: 🟢 GREEN                                          exit 0

SUPABASE  [observable]
  now() responde en 240 ms · PostgreSQL 17.6
  filas 110,600 · eventos/sesión (2026-08-04): 22.71
  cron poda: prune_analytics_events_monthly · 0 3 1 * * · activo
VERCEL  [observable]
  chesscito: READY · 986bb38320d9 · 5XX por ruta: ninguno
  Active CPU: 34% de la cuota
UPSTASH  [observable]
  claves 6,790 · latencia mediana 88 ms · p95 376 ms
  comandos del período: 140,000 / 500,000 (28%)
```

### Parcial — lo habitual hoy

```
ESTADO: 🟢 GREEN (partial)  ⚠️ 2 critical axis/axes not measured    exit 0

VERCEL  [parcial]
  invocations y Active CPU: NO OBSERVABLE — VERCEL_TOKEN not configured
UPSTASH [parcial]
  comandos y cuota: NO OBSERVABLE — Management API credentials not configured
     copiar de: Upstash Console → your database → Usage → Commands (period)

CAMBIOS DESDE EL SNAPSHOT ANTERIOR
  ventana entre snapshots: 3 min
  filas analytics: 110,325 → 110,600 (+275)
  WAL records: 136,173 → 139,090 (+2,917)
```

Nada observado está mal. Dos ejes de costo sin medir. **Exit 0.**

### Roja

```
ESTADO: 🔴 RED (partial)  ⚠️ 2 critical axis/axes not measured      exit 2

INDICADORES QUE DISPARARON EL ESTADO
  🔴 supabase: database did not answer select now()
  🔴 gateway_522: 3 routes returning an HTML gateway error
  🟡 telemetry_volume: 48 events/session (>35)
```

El rojo **no se ablanda** porque falten ejes. Primero: ¿`unreachable` o
`not_configured`? (§5). Si es `unreachable`, es el incidente; si es
`not_configured`, falta una credencial en esta máquina.

---

## 14. Lo que el monitor NO hace

- No escribe en ninguna base ni cambia configuración.
- No ejecuta ninguna de las acciones que recomienda.
- No despliega, no toca crons, índices ni telemetría.
- No infiere Active CPU de los logs: no existe derivación honesta.
- No extrapola la muestra de logs a invocations del período.
- No calcula el ratio de batching: la muestra de logs dura ~90 s y la ventana
  más corta de la base es 15 min, así que **nunca** son comparables. Dividirlas
  da ~290 ev/req y parece prueba de que el batching funciona.
