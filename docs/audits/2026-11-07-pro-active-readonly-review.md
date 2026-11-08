# Revisión de vigencias PRO antes de retirar Redis

Fecha de la última lectura: 2026-11-07 23:26:17 -05 (America/Bogota); UTC: 2026-11-08T04:26:17.876000+00:00.
Alcance: `caos19/chesscito-play`, proyecto `prj_DHUy3urmBKEPluBmO8KJII1MpWNx`, dominio verificado `play.chesscito.com`. Deployment de producción observado: `dpl_BhxLdaEwyRqLRFbaARJ7HwKF9SV9`.

## Conclusión

**La condición de cero vigencias activas no se cumple.** Se encontraron **2 registros PRO activos** en el Redis configurado para Production. Son claves de cuentas válidas en formato canónico, con expiración futura; el lector de PRO actual las considera activas. Hay además 1 registro vencido. La migración debe conservar las 2 vigencias antes de cambiar el backend.

Las 2 vigencias no demuestran por sí solas 2 compras: podrían derivar de compras, renovaciones o concesiones administrativas. Esta revisión no identificó personas, no reconstruyó el origen por transacción y no escaneó eventos on-chain.

## Conteos verificados

| Fuente / medida | Resultado |
| --- | ---: |
| Redis: registros de vigencia PRO | 3 |
| Redis: vigencias activas canónicas | 2 |
| Redis: registros vencidos | 1 |
| Redis: valores inválidos | 0 |
| Redis: claves de vigencia no canónicas | 0 |
| Redis: claves desaparecidas durante las lecturas | 0 |
| Redis: vigencias activas sin TTL de clave | 0 |
| Redis: vigencias activas a menos de 5 minutos de vencer | 0 |
| Redis: marcadores de compras procesadas | 2 |
| Redis: otras claves dentro del namespace PRO | 0 |
| Supabase: filas en pro_subscriptions | 9 |
| Supabase: filas con expires_at futuro | 0 |
| Supabase: filas de consumo de pago con product=chesscito_pro | 9 |

Los conteos de Supabase son de filas, no de usuarios distintos. La ausencia de filas con expiración futura en esa tabla no basta para declarar que no hay acceso PRO: el backend actual consulta Redis. El esquema existente documenta que el rail Shop puede conceder PRO solo en Redis y que pro_subscriptions registra el otro rail; esta diferencia de cobertura es compatible con los conteos, pero no permite atribuir el origen de las dos vigencias sin otra revisión.

## Método y privacidad

- Se verificaron identidad del proyecto/equipo y dominio antes de consultar los servicios configurados en Production.
- Se usaron exclusivamente cuatro variables necesarias de ese proyecto, en memoria y sin escribir sus valores a disco ni imprimirlos. No se abrieron archivos locales de entorno ni private/.
- Se completaron dos ejecuciones del sondeo; cada ejecución realizó dos SCAN completos del namespace `coach:pro:*`. Los cuatro recorridos coincidieron: 3 vigencias, 2 activas, 1 vencida y 2 marcadores de compras procesadas.
- Se filtraron en memoria las claves de vigencia con direcciones canónicas y los marcadores de transacción; no se imprimieron claves, wallets, hashes de compra, payloads ni fechas de expiración individuales.
- Se leyeron valores con MGET, hora del servicio con TIME y TTL con PTTL, sin EVAL ni comandos de escritura. Cada ejecución utilizó 10 comandos Redis de lectura: 2 SCAN, 2 TIME, 2 MGET y 4 PTTL. Total de ambas ejecuciones: 20 comandos de lectura.
- Supabase se consultó mediante HEAD con conteo exacto, seleccionando solo id y sin obtener cuerpos de filas. Las tres consultas de cada ejecución fueron exitosas.
- No se modificaron registros, vigencias, TTL, marcadores, suscripciones, configuración remota ni producción. No se hicieron compras, grants, revocaciones o exports de datos personales.

## Evidencia del código

- `apps/web/src/lib/contracts/shop-catalog.ts`: el pase base dura 30 días. La fecha de la última compra por sí sola no determina si sigue activo.
- `apps/web/src/lib/coach/pro-extend.ts`: extensión de vigencia desde max(now, expiry actual), por lo que renovaciones pueden acumular tiempo.
- `apps/web/src/lib/pro/is-active.ts` y el lector de expiración: una fecha finita mayor que el reloj actual implica PRO activo; la clave se consulta con cuenta normalizada.
- `apps/web/scripts/grant-pro.ts`: existe una vía administrativa de concesión; no se ejecutó.
- `apps/web/src/app/api/verify-pro/route.ts`: el marcador de compra vive en Redis con TTL de 90 días. La extensión y el registro de compra están en operaciones separadas.
- `apps/web/src/app/api/verify-payment/route.ts`: comparte la vigencia/marcadores Redis y registra el rail treasury en SQL. Ese registro SQL posterior no convierte toda la concesión Redis en una única operación atómica.

## Decisión para la migración

1. Descartar el supuesto de una migración PRO sin vigencias a preservar. Preparar un backfill mínimo e idempotente de las 2 vigencias activas, con sus vencimientos originales, y volver a medir antes del corte.
2. Conservar la protección contra repetir compras: hay 2 marcadores Redis y 9 registros SQL de consumo PRO. Sus conteos no permiten establecer correspondencia uno a uno ni demostrar que cubren todo el historial Shop.
3. Definir la operación SQL de concesión + deduplicación en una sola transacción y mantener las validaciones de receipt, buyer, SKU, token y destino de pago.
4. Diseñar cómo se resolverán los recibos legacy y los trabajos/solicitudes de compra en vuelo. No introducir silenciosamente un corte temporal que rechace compras legítimas antiguas; tampoco aceptar que una compra histórica pueda volver a concederse por perder su marcador.
5. Probar vigencias preservadas, renovaciones, reintentos y carreras del mismo pago antes de cambiar juntos lectores y escritores. La ejecución del backfill o cualquier revocación queda fuera de esta revisión.

## Límites

SCAN no es un snapshot transaccional; compras, concesiones o expiraciones pueden cambiar el resultado tras el sondeo. Los cuatro recorridos coincidieron y ninguna vigencia estaba a menos de 5 minutos de vencer, pero eso no sustituye una comprobación justo antes del corte. Se usaron los servicios de la configuración Production actual; no se inspeccionaron los secretos archivados dentro del deployment. Los metadatos de las cuatro variables necesarias no registran actualizaciones posteriores a la creación de ese deployment. Esto respalda la correspondencia temporal, sin certificar byte por byte el entorno de ejecución.

No se consultaron los proyectos de Learn o Landing ni sus credenciales específicas. Si comparten estos servicios, el namespace no acredita a qué superficie pertenecen las cuentas: el lector de Play sí utiliza este estado.
