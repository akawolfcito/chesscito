# Auditoría de Functions y Fluid CPU de Chesscito Play

Fecha: 2026-11-07, America/Bogota. Base: `origin/main` en `b7f5457b1c5616e1235bab71a9e4706336c90c19`. Rama: `codex/play-functions-audit`.

## Actualización de acceso y destino durante preparación de release

Tras completar el operador `vercel login`, se recuperó acceso CLI de lectura al proyecto actual: `caos19/chesscito-play`, `prj_DHUy3urmBKEPluBmO8KJII1MpWNx`. Se confirmó el dominio verificado `play.chesscito.com`, raíz `apps/web`, Next.js y Node 24. La identidad `play-chess` empleada en la primera parte de esta auditoría procedía de la guía de octubre y ya no identifica el Play actual. Los 403 originales son correctos para los intentos descritos, pero no prueban falta de acceso al nuevo proyecto después del login. Se actualizó la guía canónica. El resto del informe conserva la evidencia obtenida y sus límites; no hay todavía comparación de CPU antes/después ni despliegue de esta corrección.

### Nueva evidencia operacional tras el login

La consulta de metadatos de variables (`GET /v10/projects/<Play>/env`) devolvió 34 entradas, sin paginación ni variables de producción ocultas (`hiddenProductionEnvCount = 0`). No aparecen `SUPABASE_URL` ni `UPSTASH_REDIS_REST_URL` en ningún target. Sí aparecen las credenciales asociadas en Production. No se imprimieron ni copiaron valores. El código necesita esas URLs para construir los clientes: `getSupabaseServer()` devuelve null sin URL, y el cliente Redis necesita su endpoint. Es un bloqueo de configuración previo a la publicación, no algo que corrija el cambio de polling. Se pidió al operador añadir los valores correctos directamente en el dashboard; no se alteraron variables.

Una consulta acotada de registros de solicitudes, filtro HTTP >=500, producción, ventana relativa de 1h, devolvió 15 registros de error: 11 de `/api/pro/status` (500) y 4 de `/api/coach/history` (500). Son conteos de la muestra disponible, sin denominador de todas las invocaciones y sin afirmar equivalencia con el 20,6 % histórico. Ambos endpoints usan Redis; la ausencia del endpoint Redis es una causa compatible que requiere confirmar el error interno o recuperación al corregir la configuración. No se publicaron parámetros, wallets, request IDs ni mensajes sin filtrar.

## Resultado y límites

Se confirmó una regresión reproducible en el polling de Coach y se corrigió en una rama aislada. También se confirmó HTTP 503 en tres ejecuciones consecutivas del cron de limpieza. **No está demostrada la causa del 20,6 % ni su relación con la CPU acumulada.** No se modificó producción, infraestructura, variables, permisos, cron, base de datos, progreso ni pagos.

La información histórica aportada en el chat describe 20,6 % de errores en 12 horas, 916–966 invocaciones, 160 invocaciones de middleware, 0 % de timeouts y 1h17m de CPU en 30 días frente a 4h. Son referencias del usuario, no una nueva medición autenticada. 77/240 = 32,08 % utilizado; ese acumulado no demuestra por sí solo que se agotará la cuota. No extrapolar una tendencia diaria sin serie verificable.

### Acceso y procedencia

- GitHub conectado: se leyó `.github/workflows/cron-cache-sync.yml` desde el conector; coincide con el checkout. `git fetch origin` verificó la base y `gh` permitió consultar historial y logs de Actions.
- Se consultó la guía canónica `docs/ops/deployment-topology.md`. Identidad documentada: Play = `chesscito-play`, team `play-chess`; raíz `apps/web`. Las vinculaciones locales apuntan a otros proyectos: no se usaron para desplegar.
- El conector Vercel devolvió 403 al consultar el proyecto con su equipo explícito. El intento de obtener el enlace de acceso también devolvió 403. La consulta de solo lectura mediante la sesión local de Vercel y scope `play-chess` devolvió 403. Por ello no hay acceso verificado al deployment actual, logs internos, configuración remota, desglose por ruta, CPU ni distribución de errores. No se solicitaron valores de variables.
- Tres GET públicos de lectura: `/`, `/api/hall-of-fame`, `/api/access/capacity` devolvieron 200 y `x-vercel-cache: MISS`. La raíz respondió `private, no-cache, no-store`; HOF `public, max-age=0, must-revalidate`; capacity `public` (el CDN puede consumir y retirar sus directivas de caché). **Un MISS aislado no demuestra ausencia de caché ni identifica el código desplegado.** No se consultaron cuerpos con datos de jugadores.
- Los destinos `CRON_URL` y `STATS_REFRESH_URL` son secretos. Un workflow con éxito o error no prueba que haya alcanzado Play. No se inspeccionaron ni publicaron sus valores.
- Se preservó el checkout original, que ya contenía cambios de build/caché y una rama distinta. Esta revisión usa un worktree independiente basado en main; no incorpora esos cambios previos ni presume que estén desplegados.

## Hallazgos con evidencia

### 1. Coach: solicitudes simultáneas y callbacks posteriores al fin de sesión — corregido

Archivo: `apps/web/src/components/coach/coach-loading.tsx`.

La implementación anterior hacía `setInterval(async ..., 3000)` sin esperar a que terminara la consulta anterior. Una respuesta de más de 3 segundos permitía peticiones concurrentes a `/api/coach/job/[id]`, cada una con un GET a Redis. El plazo de 60s quedaba armado incluso después de recibir `ready` o `failed`. Ni desmontar el componente ni cambiar de job cancelaba el fetch o descartaba explícitamente su resultado tardío. El polling tampoco comprobaba si la pestaña estaba oculta.

Prueba reproducible: nueve casos ejecutados contra el archivo original de la base producen siete fallos y dos éxitos. Con la corrección los nueve pasan. El timeout posterior a un resultado solo sería visible si el componente continuaba montado; el test reproduce precisamente esa condición. No se afirma que todas las sesiones de producción la experimenten.

Cambio: timeout recursivo de 3s después de terminar cada consulta; una petición a la vez por efecto; pausa de nuevas consultas mientras `document.hidden`; AbortController y guardia para resultados tardíos; cancelación de consulta y plazo al completar, desmontar o cambiar de job. Continúan los reintentos de HTTP/transporte dentro del plazo original de 60s. No se cambia el endpoint, contrato, cobro de créditos ni proceso de análisis.

Limitación: serializar agrega el tiempo de respuesta al intervalo efectivo. El timeout de 60s sigue corriendo en segundo plano. Abortar en el navegador no garantiza cancelar una función ya iniciada en Vercel. El ahorro real depende del volumen de análisis asíncronos y de su latencia.

### 2. Limpieza diaria de Coach: fallo operacional real, causa interna pendiente

Ejecuciones de GitHub con `curl: (22) The requested URL returned error: 503`:

| Fecha de creación UTC | Run | Resultado |
| --- | --- | --- |
| 2026-11-07 09:32:51 | [42360192309](https://github.com/akawolfcito/chesscito/actions/runs/42360192309) | failure, HTTP 503 |
| 2026-11-06 10:18:12 | [42201619221](https://github.com/akawolfcito/chesscito/actions/runs/42201619221) | failure, HTTP 503 |
| 2026-11-05 10:14:26 | [42009040356](https://github.com/akawolfcito/chesscito/actions/runs/42009040356) | failure, HTTP 503 |

En el código actual de `api/cron/coach-purge/route.ts`, 503 puede significar Supabase no configurado o fallo al adquirir el lock Redis. Los eventos internos que los distinguen son `coach_purge_supabase_unavailable` y `coach_purge_lock_failed` (con indicador timeout). Un error SQL del RPC devuelve 500, no 503. Un 503 también podría originarse antes del handler o en un deployment diferente. No cambiar credenciales ni migraciones a partir del código HTTP aislado.

El runbook de octubre registra un purge exitoso después de corregir PostgREST mediante RPC; eso es evidencia histórica, no estado actual. Una tarea diaria fallida no explica por sí sola unos ~189–199 errores si las 916–966 invocaciones de la captura comparten denominador y ventana. Falta el desglose de Vercel.

### 3. Sync: actividad recurrente acotada y avance de cursor comprobado

`cron-cache-sync.yml`: cada 15 minutos nominales, sin reintentos curl; timeout curl 90s y job 2 minutos. `api/cron/sync`: autenticación fail-closed, duración máxima 60s. `sync-blockchain.ts`: 2.000 bloques como máximo por invocación; rango RPC adaptativo ante límites; cursor solo avanza tras procesar ambos contratos; Passport solo se actualiza al alcanzar el head capturado. Estas protecciones **ya existen** en main y no forman parte de este cambio.

Tres runs exitosos del 7 de noviembre muestran continuidad:

| Run | Bloques inclusivos | Scores / victories / Passport |
| --- | --- | --- |
| [42357417333](https://github.com/akawolfcito/chesscito/actions/runs/42357417333) | 68.252.128–68.254.127 | 0 / 0 / 0 |
| [42386853310](https://github.com/akawolfcito/chesscito/actions/runs/42386853310) | 68.254.128–68.256.127 | 0 / 0 / 0 |
| [42407177602](https://github.com/akawolfcito/chesscito/actions/runs/42407177602) | 68.256.128–68.258.127 | 0 / 0 / 0 |

El escaneo sin eventos puede ser reconciliación legítima; no se desactiva. No se obtuvo el head actual ni lag verificable. Los horarios reales observados están espaciados varias horas; no confundir la programación nominal (96 ejecuciones/día, 2.880 en 30 días) con ejecuciones reales o cuota CPU. No aumentar el rango ni reducir frecuencia sin medir backlog: podría perjudicar progreso derivado. Falta exclusión de concurrencia en sync a nivel workflow/servidor; revisar con evidencia de solapamientos antes de añadir una dependencia crítica de Redis.

## Revisión de las otras superficies

Búsqueda de inventario: 107 archivos de route handlers en `apps/web`; revisión focal de cron, Coach, duelo, telemetría, ranking, cachés y helpers compartidos. No equivale a validar exhaustivamente todos los handlers ni a un smoke autenticado de todas las funciones.

| Área | Evidencia en main | Decisión |
| --- | --- | --- |
| Middleware | Matcher excluye `/api`, `_next`, assets con extensión y operaciones. No consultas DB/RPC ni polling. Hace routing de modo e idioma. | Mantener; no explica llamadas API. |
| Duelos | `use-duel.ts` usa timeout posterior a respuesta: 1,2s en espera, 3s activo, pausa fetch oculto, 30s de reevaluación oculta. Para en estados terminales. GET materializa el estado y usa `freshReads`. | Mantener frescura; un caché compartido puede ocultar movimientos/relojes. Visibilidad/acciones todavía pueden coincidir con un fetch; medir antes de cambiar. |
| Relojes y animaciones | `use-chess-game`, `duel-clock`, indicadores de Coach y lobby actualizan estado cliente. | Un temporizador visual no implica invocaciones de Vercel. |
| Telemetría | Ya agrupa hasta 20 eventos, vacía por inactividad de 5s o salida; fallo de envío se descarta sin reintento. Ruta limita payload y agrupa inserts; first-seen deduplicado. | No repetir como pendiente la recomendación de batching de la auditoría de agosto. Verificar flags efectivos sin revelar valores. |
| Redis | Clientes compartidos por perfil, señales timeout nuevas por comando; request 1,5s / 1 retry, batch 10s / 2 retries. Rate limiting diferencia timeout/error y fail-open/closed. | No quitar controles financieros ni aumentar reintentos. Sus esperas no equivalen a CPU activa. |
| Supabase | Helper server-only, `freshReads` opt-in; cursor y duelos piden lecturas frescas; catálogo y censo usan `unstable_cache`. | No activar caché global de datos sensibles ni suprimir errores. No se obtuvo telemetría directa de Supabase/Redis. |
| Pro y pagos | Pro sin polling y `retry: false`; providers usan staleTime 30s y desactivan refetch por foco. Rails de verificación con lista de retrasos acotada. | Mantener confirmación y frescura de derechos; pruebas de regresión. |
| Ranking/HOF | Handlers dinámicos. Weekly depende de semana/superficie; consultas personalizadas y ranking propio comparten ruta. | No cachear indiscriminadamente URLs por wallet; separar público/personalizado solo tras medir. |
| Open Graph | `ImageResponse` + sharp en rutas OG; cabeceras CDN de una hora o un día ya presentes; errores de victory sin caché. | Trabajo potencialmente intensivo en CPU, sin volumen medido no atribuirle el problema. |
| Actions | Purge diario con concurrency; refresh stats cada 6h con concurrency; sync cada 15m nominales. Ninguno usa curl retries. Tests se disparan en main/PR. | No disparar crons manualmente ni modificar destinos. El refresh stats no queda atribuido a Play: Landing tiene su propio handler. |

## Verificación y comparación

Dependencias locales existentes reutilizadas, sin leer/copiar archivos de entorno. Host Node v26.7.0; Vitest requiere `NODE_OPTIONS=--no-experimental-webstorage` aquí para que el almacenamiento jsdom no choque con el experimental de Node. CI usa Node 20; no se cambió su configuración.

- 9 pruebas nuevas: concurrencia, ready, failed, deadline con resultado tardío, desmontaje con resultado tardío, pestaña oculta/visible, errores de transporte/HTTP, cambio de job y ausencia de job.
- Baseline: 7 fallos y 2 éxitos con las pruebas nuevas contra el componente original (sin fallos extra del entorno tras aplicar la opción de Node).
- Suite focal de Coach, endpoints job/cron, sync, Redis y middleware: **17 archivos / 188 pruebas aprobadas**.
- Regresión de pagos, Training, scores/progreso, juego, duelos, telemetría y rutas de guardado/verificación seleccionadas: **123 archivos / 2.105 pruebas aprobadas**.
- Total de esas dos ejecuciones: **140 archivos / 2.293 pruebas aprobadas**. No se ejecutó toda la suite del monorepo.
- `tsc --noEmit --incremental false`: aprobado. `git diff --check`: aprobado.
- No se ejecutó `next build`, smoke autenticado MiniPay ni transacciones reales. No se desplegó esta rama.

| Escenario controlado | Antes | Después |
| --- | --- | --- |
| Fetch pendiente durante 12s | 4 llamadas iniciadas | 1 llamada iniciada |
| Pestaña oculta durante 12s | 4 llamadas iniciadas | 0 llamadas iniciadas |
| Ready recibido y componente montado hasta 65s | Callback ready + timeout fallido | Solo callback ready |
| CPU / error rate de producción después | Sin medición | Pendiente de acceso y despliegue autorizado |

Los números de llamadas son pruebas con temporizadores simulados, no una reducción porcentual medida de CPU ni de errores en producción.

## Pasos pendientes para cerrar el incidente

1. Restablecer acceso de lectura al equipo Play mediante la configuración de la conexión/cuenta Vercel; el intento automático de autorización no pudo emitir un enlace. Revalidar proyecto, dominio, SHA real desplegado y ventana temporal.
2. Consultar errores por ruta/código y CPU acumulada por ruta para la misma ventana de 12h. Separar HTTP 4xx/5xx, excepciones y errores de log según la definición exacta de la métrica de la captura. Conservar agregados sin wallets, tokens ni URL privadas.
3. Correlacionar horario del purge con logs de Play para identificar el evento 503. Según resultado, proponer la reparación de conectividad/configuración o deployment con autorización; no asumir que falta el RPC ni desactivar el cron para ocultar el fallo.
4. Medir frecuencia efectiva de sync, lag del cursor, latencia y CPU por ejecución. Mantener reconciliación mientras se identifica el coste; no eliminar trabajo necesario para progreso.
5. Revisar y autorizar el cambio preparado, desplegar únicamente Play según la guía canónica y probar Coach en MiniPay móvil, Play/Training, progreso y pagos en el entorno apropiado.
6. Comparar ventanas equivalentes de 12–24h y registrar despliegue, invocaciones de job, errores por ruta, CPU total y CPU por 1.000 invocaciones; distinguir volumen/cambio de tráfico de coste por solicitud. Comparar también el mismo día de la semana. Rollback al SHA previo si Coach deja de finalizar o aparecen regresiones.

## Referencias

- [Código base](https://github.com/akawolfcito/chesscito/tree/b7f5457b1c5616e1235bab71a9e4706336c90c19).
- [Functions usage and pricing](https://vercel.com/docs/functions/usage-and-pricing): CPU activa mide ejecución de CPU y excluye espera de red/I/O; menor duración por sí sola no demuestra ahorro CPU.
- [Runtime logs](https://vercel.com/docs/logs/runtime): los registros y la retención disponible condicionan la investigación. No se presupone acceso a funciones Pro.
- Guía canónica: `docs/ops/deployment-topology.md`; auditorías de agosto y cierre de purge de octubre se trataron como contexto histórico.
