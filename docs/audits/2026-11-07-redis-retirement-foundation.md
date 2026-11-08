# Redis: inventario y primera frontera de almacenamiento

Fecha: 2026-11-07, America/Bogota. Base: `ca760f5af2efd7c4746199d56581f7be4d5611a2`. Rama: `codex/redis-retirement-foundation`.

## Resultado

Primera entrega de preparación para retirar Redis: extraer las reglas de lectura PRO a un contrato independiente del proveedor, con un adaptador Redis que conserva la ruta de producción. No se creó un adaptador SQL ficticio ni se seleccionó otro backend mediante variables. No se ejecutaron exports de datos, backfills, scripts administrativos, migraciones ni cambios remotos.

No se afirma una reducción de comandos Redis o CPU en esta entrega. `isProActive` sigue leyendo una vez la misma clave; todos sus callers siguen usando el mismo entry point. El objetivo es permitir sustituir el backend real en un cambio posterior verificable.

## Contrato implementado

- `apps/web/src/lib/pro/expiry-reader.ts`: `ProExpiryReader.getExpiresAt`, expiry como milisegundos o string decimal legado; falta de registro = null; error de backend se propaga. `readProStatus` normaliza cuenta, conserva expiry vencido en la respuesta y considera expirado el instante exacto de vencimiento.
- `apps/web/src/lib/pro/redis-expiry-reader.ts`: adaptador que conserva `REDIS_KEYS.pro` y `getRedis()` con su perfil/timeouts actuales.
- `apps/web/src/lib/pro/is-active.ts`: fachada compatible, incluido el export `ProStatus`. El reloj se consulta después de la lectura para no conceder vigencia vencida durante I/O.

Un futuro adaptador Postgres deberá convertir su timestamp al mismo contrato. La inexistencia de registro y la indisponibilidad del servicio no son intercambiables. Esta interfaz solo cubre lectura: no promete resolver la atomicidad de las compras.

## Inventario por responsabilidad

| Categoría | Lectores/escritores encontrados | Datos o garantía a preservar |
| --- | --- | --- |
| PRO | `lib/pro`, `coach/pro-extend`, verify-pro, verify-payment, grant-pro | Vigencia existente; extensiones de compras distintas; registro contra replay por compra. |
| Créditos, resumen y seed | coach/analyze, coach/credits, redis-keys | Saldo, inicialización única, resumen y consumo/reserva de análisis. |
| Partidas y mint | games, games/[id], games/[id]/mint-receipt, coach/game-persistence, página coach/[gameId] | Listas ordenadas, límites, recibos y retención de registros. |
| Análisis e historial | coach/analyze, coach/history, coach/cache-fallback, coach/backfill | Idiomas, clave antigua EN, listas y resultados Redis-only; write-through SQL actual no cubre todos los usuarios. |
| Jobs | coach/analyze y coach/job/[id] | Pending por cuenta, referencias por partida, estado terminal y expiración. |
| Escudos y welcome pack | shields/me, shields/spend, welcome-pack/claim, verify-payment | Créditos existentes, gasto atómico, grants y nonce de un solo uso. |
| Estado/cache y gates | founder-status, season-pass/status, focus-day | Identificar fuente de verdad y TTL por campo antes de quitar cada cache. |
| Protección distribuida | server/rate-limit, server/demo-signing | Cuotas por ruta, IP/cuenta, fail-open/fail-closed y comportamiento con IP móvil compartida. |
| Locks/nonces | cron/coach-purge, coach/backfill, DELETE coach/history, shields/spend | Exclusión, vencimiento y replay; liberar solo el lease propio. |
| Operación administrativa | scripts/grant-pro.ts, scripts/reset-wallet.ts | Concesión y eliminación administrativa deben migrar junto con el dominio. No se ejecutaron. |
| Landing | apps/landing/src/lib/stats/redis.ts | Helper presente en main; confirmar consumidores y código del Worker publicado antes de declarar retirada global. |

La búsqueda incluyó código JS/TS de apps/scripts/tools, excluyendo dependencias, builds, tests, private y outputs generados. Buscar imports directos no cubre todas las dependencias transitivas: antes de retirar paquetes y variables hay que recorrer los callers de los wrappers y revisar la rama real de Landing.

## Garantía financiera que debe cubrir el siguiente cambio

`verify-pro` y la rama PRO de `verify-payment` consultan primero el marcador de compra, extienden la vigencia con Lua y marcan después la transacción como procesada. La extensión aislada es atómica; el conjunto de deduplicación + concesión no está unido en esa misma operación. Dos solicitudes simultáneas pueden observar el mismo marcador ausente antes de que alguna lo escriba. La deduplicación de la escritura SQL posterior de un rail tampoco demuestra que una extensión Redis ya ejecutada no se repita.

Es un riesgo inferido de la secuencia del código, no una explotación ni una duplicación observada en producción. No se hicieron llamadas de compra para reproducirlo. La migración debe exigir una operación SQL única que aplique la compra y registre su identidad en la misma transacción, y pruebas concurrentes del mismo evento por ambos entry points. No trasladar el patrón de llamadas separadas a SQL.

La identidad canónica de compra debe definirse por rail/chain/evento y mantener las validaciones actuales de receipt, buyer, SKU, token y destino. Verificar normalización y compatibilidad de claves antiguas antes del backfill. No deducir que todas las concesiones legacy están reconstruibles desde `pro_subscriptions`: se debe reconciliar con el estado Redis que hoy sirve a los usuarios.

## Validación

- 11 casos nuevos del contrato de lectura PRO: futuro, string numérico, faltante, vencido, igualdad con now, inválido, NaN, Infinity, normalización, fallo del backend y expiración durante una lectura pendiente.
- Suites existentes de PRO, extensión, pro/status, verify-pro, verify-payment, coach/analyze y coach/credits: **16 archivos / 216 pruebas en total**, incluidos los casos nuevos, aprobados.
- `pnpm --filter web exec tsc --noEmit --incremental false`: aprobado.
- `git diff --check`: aprobado.
- Sin build completo ni smoke autenticado de producción en esta entrega de preparación. CI del nuevo PR corre aparte; las pruebas anteriores del release no sustituyen sus checks.

## Orden de trabajo después de revisar esta entrega

1. Definir esquema y transacción de concesión PRO, con RLS/permisos y pruebas de duplicados/carreras, y verificar schema actual mediante lecturas autorizadas.
2. Preparar backfill idempotente, restringido y conciliación agregada de expiraciones/deduplicación, sin datos personales en logs o repositorio. Presentarlo para aprobación antes de ejecutarlo.
3. Cambiar escritores y lectores coordinadamente, con una autoridad por dominio, verificación de paridad y una reversión que conserve las nuevas compras.
4. Repetir por créditos/escudos, partidas/análisis/jobs y controles temporales. Ajustar rate limiting y herramientas antes de quitar Redis.
5. Retirar servicio/credenciales solo tras probar cero accesos activos, datos conciliados y ventana de reversión cerrada.

Plan general: `docs/ops/redis-retirement-plan.md`. La retirada de Redis no autoriza por sí sola borrar datos o publicar migraciones.
