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
| `VERCEL_TOKEN` | **invocations por proyecto** del ciclo de facturación, vía Observability API — ver §12bis. **No** desbloquea Active CPU ni % de cuota |
| `UPSTASH_EMAIL` + `UPSTASH_API_KEY` | comandos del período, % de la cuota de 500 K, bandwidth |

Sin estas cuatro, el monitor **funciona igual** pero no puede dar verde pleno:
son precisamente los dos ejes por los que el proyecto puede quedarse sin
capacidad sin que aparezca ningún error. Se activan solas en cuanto existan.

`SUPABASE_SERVICE_ROLE_KEY` **no se usa**: el monitor no toca PostgREST.

---

## 3. Ejecución

```bash
pnpm ops:health              # PRODUCTION (por defecto)
pnpm ops:health:preview      # PREVIEW
```

Forma técnica, si necesitás el flag explícito:

```bash
pnpm -C apps/web exec tsx ../../scripts/ops/launch-health-snapshot.ts --target production
pnpm -C apps/web exec tsx ../../scripts/ops/launch-health-snapshot.ts --target preview
```

Un `--target` desconocido **falla con exit 3** y no cae al default: `--target prod`
es un typo plausible que reportaría production mientras creés estar mirando preview.

Cada corrida escribe bajo el directorio de **su** target (gitignoreado):

```
artifacts/ops/production/2026-08-04T13-20-52Z.json|.md
artifacts/ops/production/latest.json|.md      ← lo que compara la próxima corrida production
artifacts/ops/preview/2026-08-04T13-22-42Z.json|.md
artifacts/ops/preview/latest.json|.md         ← lo que compara la próxima corrida preview
```

Duración típica: **~10 s**. Supabase ~1,5 s; el resto es el CLI de Vercel.

---

## 3bis. Targets: production y preview

### Topología

| Dominio público | Proyecto Vercel | Target | Git ref |
|---|---|---|---|
| `play.chesscito.com` | `chesscito` | production | **`production`** |
| `learn.chesscito.com` | `lite-chesscito` | production | **`production`** |
| `preview.chesscito.com` | `chesscito` | preview | **`main`** |
| `learn-preview.chesscito.com` | `lite-chesscito` | preview | **`main`** |
| `www.chesscito.com` | `chesscito-landing` | — | **fuera del monitor** |

El landing es un proyecto aparte, con su propio ciclo de vida y sin backend
compartido. El monitor nunca lo consulta.

### Por qué la separación importa

**No es hipotético.** El 2026-08-04, medido justo después de un push:

```
production → 986bb383      preview → 5d6083f8      (7 commits de diferencia)
```

Un monitor sin separación, corrido contra preview y comparado con el `latest.json`
de production, reportaría *"el commit desplegado cambió de 986bb383 a 5d6083f8"* —
describiendo un avance que **no ocurrió**.

### Validación cruzada: se chequean DOS señales

- `deployment.target` — la clasificación de Vercel
- `meta.githubCommitRef` — lo que git reportó al construir

Vienen de sistemas distintos. Si coinciden en una y discrepan en la otra, la
topología cambió (rama renombrada, dominio repuntado) y el monitor lo rechaza en
vez de disimularlo.

> **Detalle de la API:** Vercel codifica un deployment preview como
> `target: null`, con la clave presente. `null` **es** el marcador de preview,
> no un valor faltante. Leerlo como desconocido hacía que toda corrida preview
> reportara mismatch contra sí misma.

### `target_mismatch` = NOT OBSERVABLE

Si pedís un target y Vercel devuelve otro, el proyecto sale como **no observable**,
no como amarillo ni rojo. El sistema puede estar perfectamente sano: lo que falló
es que el monitor **no encontró lo que se le pidió mirar**. El informe imprime los
dos lados:

```
  ⛔ TARGET MISMATCH — deployment NO corresponde al perfil pedido
     esperado : target=preview ref=main
     recibido : target=production ref=production
```

Además, un mismatch **corta antes de leer los logs**: números de un entorno
etiquetados con el target de otro serían peor que no tenerlos. Y como es un eje
crítico sin medir, **no puede producir verde pleno** — el informe sale `(partial)`.

### Incompatibilidades: doble defensa

| Caso | Resultado |
|---|---|
| Snapshot production vs preview | **rechazado** — `son entornos distintos` |
| Snapshot **schema v1** vs **v2** | **rechazado** — `written by a different version` |

Los directorios separados hacen improbable el cruce; el guard en
`checkCompatibility` lo hace **imposible** aunque alguien copie un `latest.json`
a mano.

**`SNAPSHOT_SCHEMA_VERSION` = 2.** Los snapshots v1 que quedaron sueltos en
`artifacts/ops/` (fuera de los subdirectorios) **siguen ahí intactos y no se
borran**, pero **no se comparan**: fueron tomados sin saber de qué entorno
hablaban, y adivinarlo ahora sería exactamente la clase de dato con aspecto de
verdad que este guard existe para impedir.

### Probe del dominio público

Separado del deployment, porque fallan de forma independiente: que responda la URL
interna `*.vercel.app` dice que el build existe; que responda el dominio público
dice que el alias está efectivamente apuntado a él.

Un solo `GET /`, timeout acotado, sin escrituras. Un redirect de locale
(`/` → `/en`) que termina en 2xx cuenta como sano.

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

### ⚠️ `pnpm run` colapsa los códigos no-cero a 1

Medido capa por capa:

| Invocación | exit real |
|---|---|
| `pnpm -C apps/web exec tsx …/launch-health-snapshot.ts --target prod` | **3** ✅ |
| `pnpm ops:health -- --target prod` | **1** ❌ |

`pnpm run` normaliza cualquier código distinto de cero a 1. Es del script runner,
no del monitor.

**Consecuencia:** `pnpm ops:health` y `pnpm ops:health:preview` distinguen
**éxito de fallo**, nada más. Cualquier automatización que necesite separar
amarillo (1) de rojo (2) de fallo del monitor (3) debe invocar directo:

```bash
pnpm -C apps/web exec tsx ../../scripts/ops/launch-health-snapshot.ts
echo $?   # 0 | 1 | 2 | 3, exacto
```

El veredicto legible sale igual por consola en ambos casos.

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

## 7ter. p95 de eventos por sesión — población completa

```
distribución 24h · p50 15 · p95 73 · máx 592 (población completa: 2,403 sesiones)
```

**El percentil se calcula en PostgreSQL** (`percentile_disc(0.95) within group`)
sobre **todas** las sesiones de las últimas 24 h, ignorando `session_id` nulo o
vacío. El tamaño de la población viaja junto al número **a propósito**: un p95 sin
su *n* no se puede leer.

### ⚠️ `top_sessions_1h` es DIAGNÓSTICO, nunca una distribución

Sirve para *mirar* sesiones concretas. **No se percentila.** Está ordenado por la
misma cantidad que uno querría percentilar, así que cualquier percentil sobre él
describe la muestra, no la población — y no converge por más que crezca el
tráfico.

> **El RED del 2026-08-04 fue un defecto del instrumento, no del sistema.** El p95
> se derivaba en el cliente sobre ese top-20: `percentile(20 valores, 0.95)` =
> `sorted[18]` = **la 2.ª sesión más ruidosa de la hora**. Medido en la misma
> ventana: el top-20 daba **182** y el p95 real era **77** — 182 era el **p99**.
> Auditoría: `docs/audits/2026-08-04-telemetry-session-p95-audit.md`.

### Umbral y casos borde

- **Rojo ≥ 200, sin cambios.** Como p95 poblacional es holgado: hoy el valor real
  es **73** y sólo el 0,79 % de las sesiones cruza 200.
- **Ventana vacía → p95 `null`**, nunca `0`. Un cero se leería como "ninguna
  sesión emite nada", que es lo contrario de "no se pudo medir". Sale como eje sin
  medir, no como verde ni como rojo.
- **Una sola sesión** → `percentile_disc` devuelve el conteo de esa sesión. Es la
  semántica esperada, y está fijada por un test.
- **Bloque ausente o malformado** → `null`, sin tumbar la corrida.

---

## 7bis. Supabase = SHARED DATABASE

⚠️ **La base NO se separa por target.** Production y preview escriben en la
**MISMA** base de datos. El informe lo rotula así:

```
SUPABASE  ⚠️ SHARED DATABASE  [observable · compartida entre production y preview]
  ⚠️ Esta base NO se separa por target: production y preview escriben en la MISMA.
     Filas, ritmo y proyecciones de abajo son la SUMA de los dos entornos y no
     son atribuibles a uno solo.
```

**Por qué el rótulo es imprescindible y no cosmético:** un informe que arriba dice
`TARGET: PREVIEW` invita a leer *todo* lo que sigue como preview. Sin el aviso, un
pico de tráfico causado por production se leería como causado por preview, y una
proyección de disco se atribuiría al entorno equivocado.

Lo que **sí** está separado por target: deployments, logs, dominios, y los
snapshots en disco. Lo que **no**: nada de Supabase.

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
| `usage: 404` / `usage: 400` | **histórico** — `/v1/usage`, retirado el 2026-08-04 | ver §12bis |
| `team lookup returned 401` | token inválido | regenerar `VERCEL_TOKEN` |
| `team lookup returned 403` | el token no alcanza para el scope | revisar permisos |
| `observability query … returned 400` | forma de la petición | el mensaje del servidor **viene incluido** en el `reason` |
| Muestra de logs vacía | sin tráfico en la ventana | no es un error |

> **Todo error de la API de Vercel ahora trae el mensaje del servidor**, no sólo
> el código. Esa línea existe porque su ausencia costó tres sesiones: el 400 de
> `/v1/usage` decía ``missing required property `from` `` en un cuerpo que el
> colector descartaba, y el informe imprimía sólo `returned 400`.

> Los logs vienen **duplicados** (mismo `requestId` y mismo `id`). El monitor
> deduplica y muestra ambos números: `52 requests (de 100 filas crudas)`. Si
> alguna vez ves los dos iguales, la deduplicación se rompió.

---

## 12bis. Vercel Usage — qué se mide y qué no

**`/v1/usage` está RETIRADO.** No es un endpoint público de Vercel (ausente de los
272 paths de su OpenAPI oficial) y rechaza todo rango temporal, incluido el ciclo
de facturación real de la cuenta. No quedó como fallback: un endpoint interno que
no funciona no es una red de seguridad.

**La fuente es `POST /v2/observability/query`**, documentada y funcionando con el
token actual.

### La ventana

Sale del ciclo de facturación real (`GET /v2/teams/goodwolf` → `billing.period`),
recortada a "ahora". **El informe la imprime siempre**, y hay que leerla:

```
consumo (Observability) · ventana 2026-08-04T07:00:00.000Z → 2026-08-04T15:46:26.946Z
   ciclo de facturación desde 2026-08-04T07:00:00.000Z
```

⚠️ **El ciclo rota.** El 2026-08-04 rotó esa misma mañana: el "total del período"
cubría 8 horas, no un mes. Un número sin su ventana acá no significa nada.

### Granularidad: 60 minutos, y no es un parámetro ajustable

**Medido:** la misma ventana y la misma métrica con `{hours:24}` devolvió **53.897**
y con `{minutes:60}` **28.881**. Los buckets gruesos se alinean al **calendario** y
el `summary` suma el bucket **entero**, incluyendo tiempo anterior al `startTime`.
**87 % de sobreestimación, con HTTP 200 y sin ningún aviso.** Hay un test que lo fija.

### Filtrado por proyecto

El scope `owner` abarca **los seis proyectos del equipo**. El total in-scope suma
**sólo** `chesscito` y `lite-chesscito`. Los demás — `chesscito-landing`,
`furinkazan`, `denscope-xr`, `xymyx-dasboard` y cualquiera futuro — salen listados
aparte y **nunca se suman**:

```
   TOTAL in-scope: 24,915 invocaciones
   fuera de alcance (NO sumado): chesscito-landing, denscope-xr, furinkazan, xymyx-dasboard — 5,298 invocaciones
```

Sin ese filtro, el landing solo aportaría ~18 % de consumo ajeno al total de
Chesscito, y el sesgo crecería con cada proyecto nuevo sin que nada lo señale.

### ⚠️ Production y preview NO están separados en estas métricas

Los dos entornos comparten **nombre de proyecto**, y no se validó ninguna dimensión
de environment. Es consumo **por proyecto**, no atribución por entorno. Las cifras
salen iguales en `pnpm ops:health` y en `ops:health:preview` **a propósito**: es la
misma medición. Es el mismo matiz que `SHARED DATABASE` en Supabase.

### ⛔ Active CPU NO se reporta — y no es por falta de credencial

**Medido el 2026-08-04**, tres llamadas idénticas y consecutivas, misma ventana:

```
#1 → 1 fila  · chesscito-landing 659.512
#2 → 3 filas · 535.102 / 77.205 / 47.205
#3 → 2 filas · 526.443 / 133.069
```

Cambia la cantidad de filas, cambian los proyectos, y los valores se mueven ~25 %.
Un par anterior atribuyó **el mismo valor 46.479** a `chesscito` en una llamada y a
`lite-chesscito` en la siguiente. Las **invocaciones** sobre exactamente el mismo
`groupBy` se mantuvieron estables a ±1, así que el problema es de la medida de CPU,
no del agrupamiento.

> Es la trampa de `INFO` de Upstash otra vez (§14): un número con aspecto de métrica
> y comportamiento de ruido. Publicarlo sería peor que dejar el eje sin medir,
> porque una cifra de CPU equivocada se lee como tranquilidad.

### Qué sigue sin ser observable

| Métrica | Por qué |
|---|---|
| **Fluid Active CPU** | atribución por proyecto no determinista (arriba) |
| **% de la cuota** | hace falta el **denominador** — lo incluido en el plan — y **ninguna API lo expone**: `/v1/billing/charges` devuelve **404 `costs_not_found`** |
| **Días hasta agotar CPU** | depende de los dos anteriores |

**Por eso el informe sigue saliendo `GREEN (partial)` y el eje `vercel_cpu` sigue
contando como crítico sin medir. Es intencional.** Lo que cambió es que ahora hay
**consumo absoluto por proyecto, comparable entre snapshots** — que es exactamente
la señal que faltó el 3 de agosto. Inventar un denominador para pintar un
porcentaje sería el dato con aspecto de verdad que este monitor existe para no
producir.

---

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
