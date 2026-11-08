# Retirada de Redis: plan inicial de Chesscito

Fecha de revisión: 2026-11-07, America/Bogota. Código observado: `ca760f5af2efd7c4746199d56581f7be4d5611a2`.
Estado: plan de migración y primera separación de almacenamiento de solo lectura en `codex/redis-retirement-foundation`. No se retiró Redis, no se exportaron datos de jugadores y no se aplicaron migraciones ni cambios de producción.

## Estado del release anterior

Play está READY en `caos19/chesscito-play`, deployment `dpl_BhxLdaEwyRqLRFbaARJ7HwKF9SV9`, con metadata de origen `ca760f5a…`. Los cuatro checks de main y una ejecución de sync figuran exitosos. Un deployment READY y un cron exitoso no sustituyen la validación móvil autenticada ni prueban la recuperación de todos los servicios. La identidad procede de la lectura del proyecto; no se verificaron en esta revisión los bytes de todos los archivos desplegados.

Pendientes de cierre: smoke móvil de Play/Coach/historial/Training/progreso/pagos en el entorno adecuado; comprobar recuperación de pro/status y coach/history; correlacionar la próxima limpieza de Coach con logs del Play actual; comparar errores e invocaciones/CPU en ventanas equivalentes. Las consultas agregadas de CPU de la preparación anterior requerían Observability Plus; no se habilitaron funciones de pago. Evitar atribuir de antemano todo el 20,6 % histórico a Redis.

## Decisión propuesta

Consolidar el estado durable en el Supabase/Postgres ya utilizado por la aplicación y sustituir por mecanismos explícitos las operaciones temporales y de concurrencia. Retirar Redis es un proyecto independiente de la mejora del polling. El objetivo es reducir dependencias y duplicación de estado; un ahorro de CPU/coste debe medirse, porque trasladar cada comando Redis a una petición SQL puede aumentar carga e invocaciones.

## Dependencias verificadas en código

| Uso | Evidencia | Requisito de sustitución |
| --- | --- | --- |
| PRO y extensión de vigencia | `lib/pro/is-active.ts`, `lib/coach/pro-extend.ts`, `api/verify-pro`, `api/verify-payment` | Estado persistente, extensión atómica desde max(now, expiry), compra aplicada una sola vez. |
| Créditos de Coach y saldo inicial | `api/coach/analyze`, `api/coach/credits`, `lib/coach/redis-keys.ts` | Importar saldos existentes; no volver a regalar saldo inicial; consumo/reserva consistente entre solicitudes simultáneas. |
| Escudos | `api/shields/spend`, `api/shields/me`, welcome-pack y verify-payment | Importar créditos y preservar reglas de gasto, nonce y deduplicación; evitar saldo negativo y doble grant. |
| Partidas y comprobantes de mint | `api/games`, `api/games/[id]`, `api/games/[id]/mint-receipt`, `lib/coach/game-persistence.ts` | Conservar partidas, listas, límites, recibos y expiraciones existentes. No confundir con toda la persistencia de Training. |
| Análisis, historial, resúmenes y jobs | `api/coach/analyze`, `api/coach/history`, `api/coach/job/[id]`, página Coach y helpers | Estado por job, job único pendiente por wallet, idioma, historial y resultados; finalizar trabajos en curso antes del corte. |
| Cachés de estado y gates | `api/founder-status`, `api/season-pass/status`, `api/focus-day` | Fuente de verdad identificada por campo; reemplazar caché cuando elimine trabajo costoso, no incrementar RPC sin medir. |
| Rate limiting, nonces y locks | `lib/server/rate-limit.ts`, `lib/server/demo-signing.ts`, DELETE history, cron purge/backfill | Limites distribuidos y políticas fail-open/fail-closed equivalentes, nonces de un solo uso, leases con expiración y liberación por propietario. |

El repositorio contiene `coach_analyses`, `pro_subscriptions` y un ledger de Peones con restricciones de idempotencia. Eso no demuestra que todas las rutas ya escriban ahí ni que todas las migraciones estén aplicadas en producción. En analyze, la persistencia durable observada es write-through de análisis full para PRO; el estado Redis de otros usuarios no puede darse por respaldado en SQL.

## Secuencia propuesta de entregas

### 1. Inventario y contratos de almacenamiento

Separar categorías de caché regenerable, estado durable y coordinación temporal. Definir interfaces por dominio y los invariantes que deben preservar los adaptadores. Verificar el esquema real mediante lecturas autorizadas y documentar qué campos solo existen en Redis. Preparar un procedimiento de exportación restringida con conteos/checksums agregados; datos personales y credenciales no van al repositorio ni a logs. No ejecutar aún el backfill.

Mantener las URLs y credenciales de Redis mientras exista cualquier lector o escritor. Definir límites y presupuesto de consultas para Postgres antes de trasladar polling/rate limiting.

### 2. Persistencia durable y reconciliación

Crear tablas/RPC mínimas para los dominios que falten, aprovechando el esquema existente cuando sus contratos coincidan. Importar partidas, análisis por idioma, saldos, escudos, expiraciones PRO y registros necesarios contra replay. Preservar las fechas originales y no refrescar retenciones durante la migración. Identificar cada compra por su evento/rail de forma estable, conservando la autorización on-chain y la semántica actual.

La concesión o consumo debe ser una transacción SQL con deduplicación, no varias llamadas REST de leer-modificar-escribir. Un solo backend será la autoridad en cada etapa. Evitar doble escritura financiera independiente: una réplica o proyección temporal debe derivar de una operación idempotente ya confirmada. Conciliar conteos y saldos antes de cambiar lectores. Las migraciones/backfills de producción requieren aprobación concreta.

### 3. Cambiar lectores, jobs y controles temporales

Migrar por dominio, con comparación de resultados y corte reversible. Mantener política de acceso de server endpoints y privilegios mínimos en tablas/RPC: no exponer service_role al cliente ni funciones financieras a anon/authenticated. No mantener una transacción ni una conexión bloqueada mientras se espera al LLM o RPC externo.

Reemplazar jobs, rate limit, nonces y locks con operaciones atómicas y datos temporales de vida acotada. Probar carreras, expiración, propiedad del lease y caída del backend. Mantener los límites por ruta y las condiciones especiales del tráfico móvil con IP compartida. No retirar el limitador sin sustituto ni usar memoria de una instancia como estado distribuido.

### 4. Corte definitivo y eliminación

Dejar de crear datos en Redis, drenar trabajos y completar la sincronización final. Conservar una ventana de reversión: el rollback de código solo es seguro si el backend anterior sigue actualizado o hay un mecanismo explícito de reconciliación. Eliminar llamadas activas, adaptadores, dependencias de Upstash, configuración y finalmente servicio/credenciales tras comprobar ausencia de accesos. La retirada del servicio en producción requiere autorización final y un respaldo seguro verificado.

## Pruebas de aceptación

- Misma transacción verificada repetidamente o desde ambos rails: un solo grant.
- Consumos/concesiones simultáneos: sin saldo negativo, escudos perdidos ni extensiones PRO omitidas.
- Idempotencia de regalos iniciales y nonces de un solo uso.
- Partidas, historial, idiomas y expiraciones conservados antes/después del backfill.
- Análisis ready/failed, timeout, reintentos y reconexión sin doble consumo.
- Controles de compra, rate limit y autorización con la misma política de fallo.
- Play y Learn probados: el código `apps/web` es compartido aunque sus deployments sean distintos.
- Cero llamadas activas a Redis en la operación normal y en tareas programadas durante la ventana acordada; antes de retirar dependencias, revisar también herramientas/admin/scripts fuera de src.
- Comparación de errores, latencia, CPU y consultas SQL: no aceptar una migración que solo traslade la saturación a Postgres.

## Primer siguiente paso

Preparar un PR de inventario/contratos e invariantes, sin cambiar producción. Después, presentar el esquema y el procedimiento concreto de migración de los datos Redis-only para aprobación antes de aplicar cambios o exportar información de jugadores.

Referencia de permisos de funciones: [Supabase Database Functions](https://supabase.com/docs/guides/database/functions), consultada mediante Context7. La implementación elegida debe revocar permisos públicos de las funciones sensibles y otorgar únicamente los necesarios; no ejecutar cambios globales de privilegios sobre funciones ajenas al alcance.

## Primera entrega preparada

La lectura server-side de PRO tiene ahora un contrato `ProExpiryReader` y una función de dominio `readProStatus` independientes de Redis. El adaptador actual conserva las claves existentes y sigue siendo la única implementación de producción. La función pública `isProActive` y su tipo de respuesta conservan la compatibilidad de los callers. No se migra ni se duplica estado, no cambian compras y no se reduce todavía el uso de Redis.

Pruebas nuevas fijan normalización de cuenta, timestamp en milisegundos, igualdad con la hora de expiración, formatos legados, registros inválidos, propagación de fallos y expiración durante una lectura lenta. La regresión focal suma 16 archivos / 216 pruebas aprobadas; TypeScript y diff-check pasan.

La revisión de repositorio también encontró los scripts privilegiados `apps/web/scripts/grant-pro.ts` y `reset-wallet.ts`, y un helper Redis de estadísticas en Landing. Su alcance debe revisarse antes del corte final: no se ejecutaron scripts ni se verificó la actividad de ese helper en el Worker de producción.

El siguiente PR debe diseñar la operación SQL de compra PRO (concesión y deduplicación en una sola transacción), el inventario/migración de expiraciones existentes y las pruebas de carrera, antes de sustituir el adaptador de lectura. La aplicación en producción requiere revisar ese esquema y el backfill concreto.
