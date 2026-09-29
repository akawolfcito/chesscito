# Chesscito — decisión sobre planes gratuitos

**Fecha:** 2026-09-13 · **Tipo:** análisis read-only, sin cambios de facturación

## Decisión

Supabase ya opera en Free. No conviene una bajada indiscriminada del resto de servicios a planes gratuitos.

| Servicio | Dictamen | Motivo decisivo |
|---|---|---|
| Supabase | **Ya está en Free; vigilar** | La base medida (267 MB) cabe hoy en 500 MB, pero queda poco margen y Free no incluye backups automáticos ni garantiza continuidad tras una semana inactiva. |
| Upstash Redis | **Candidato condicionado** | Los 22.385 keys caben potencialmente en 256 MB, pero no se observan comandos ni ancho de banda; Redis guarda estado de producto, no una caché descartable. |
| Vercel | **No pasar a Hobby** | Chesscito tiene pagos/monetización. Hobby sólo permite uso personal o no comercial. |
| Railway | **No es alternativa gratuita estable** | Tras el trial queda limitado y el producto está concebido como experimento; no reemplaza una operación permanente sin revisar el servicio concreto. |

Nada se ha cambiado en los proveedores. La recomendación es mantener Vercel en un plan compatible, medir primero Upstash y vigilar Supabase por cuota de egress y recuperación.

## Evidencia propia

### `pnpm ops:health`

- Base compartida production/preview: **267 MB**.
- `analytics_events`: aproximadamente **223 MB** (101 MB de heap + 122 MB de índices), 400.530 filas; es la principal palanca de tamaño.
- Actividad última 24 h: 2.265 eventos / 69 sesiones. Pico histórico observado: 68.740 eventos / 2.612 sesiones en un día.
- Upstash: 22.385 keys. El monitor no puede leer cuota de comandos ni ancho de banda sin credenciales de gestión.
- Vercel: 30.371 invocaciones de Chesscito + lite-Chesscito en el ciclo observado; sus cuotas de CPU/memoria no son observables por la herramienta.
- Dos endpoints tuvieron un 5xx aislado cada uno en la muestra; no es evidencia de presión de cuota, pero se debe vigilar.

### Revisión actualizada: Upstash y Vercel

Snapshot de 2026-09-13 21:11 Bogotá:

- **Upstash:** 22.430 claves, +45 en 6 h 48 min; PING mediano 123 ms y p95 467 ms, donde la primera conexión TLS explica el máximo. El plano de datos está sano. La decisión de plan sigue bloqueada: no están configuradas las credenciales de Management API y por tanto faltan comandos del período, banda y memoria real. El tamaño de claves por sí solo no permite inferir los 256 MB ni los 500.000 comandos mensuales del plan Free.
- **Vercel:** `chesscito` + `lite-chesscito` acumulan 31.393 invocaciones desde el 4 de septiembre; técnicamente es sólo el 3,14% del millón de invocaciones que Hobby publica como incluido. Pero Hobby no es elegible para un producto con compras: la exclusión es contractual, no de capacidad. Tampoco se debe inferir consumo de CPU del contador de invocaciones; la API no permite atribuirlo con estabilidad por proyecto.
- **Errores de aplicación:** la muestra vio un 5xx en `/api/welcome-pack/status` y uno en `/api/inbox`, mientras telemetry no tuvo errores. Son señales a investigar separadamente, no una razón para cambiar de plan.

La cifra roja de 7,3 s del monitor no es latencia de una consulta `now()`: incluye crear un contenedor temporal y ejecutar el snapshot de inventario. Una sonda mínima, read-only, devolvió `SELECT 1` en **68 ms** y `SELECT now()` en **73 ms**. No hay evidencia de latencia anormal de Postgres.

### `pnpm ops:no-token`

- 264 intentos deduplicados (objetivo: 200), 210 wallets.
- 98,9%: lectura correcta con saldo realmente menor al precio.
- 1,1%: todas las fuentes de saldo ausentes.
- 0%: fallos técnicos de lectura o usuarios pagables bloqueados.

Esto valida que el freno observado es de accesibilidad/precio, no de infraestructura ni de Redis/Supabase. No justifica una migración de proveedor.

## Límites vigentes de los proveedores

- Supabase Free: 500 MB de base, CPU compartida/500 MB RAM, 5 GB de egress; pausa proyectos tras una semana sin actividad y no incluye backups automáticos. [Pricing](https://supabase.com/pricing) · [database size](https://supabase.com/docs/guides/platform/database-size)
- Upstash Redis Free: una base, 256 MB, 10 GB/mes y 500.000 comandos/mes. [Pricing](https://upstash.com/pricing/redis)
- Vercel Hobby: 1.000.000 invocaciones, pero su condición contractual es uso personal o no comercial. [Hobby plan](https://vercel.com/docs/plans/hobby) · [Terms, sección 4](https://vercel.com/legal/terms)
- Railway Free reduce a un proyecto y tres servicios tras el trial, con hasta 1 vCPU y 0,5 GB RAM por servicio; crons sólo durante el trial. [Pricing](https://railway.com/pricing)

## Criterios antes de cualquier downgrade

1. **Supabase (ya Free):** en el panel, confirmar egress de los últimos 30 días y que la proyección de base permanezca bajo 400 MB. Mantener una copia externa verificada con `pnpm ops:backup:verified`; Free no aporta backup automático.
2. **Upstash:** revisar en el panel 30 días de comandos, banda y tamaño real. Sólo bajar si los tres quedan bajo 50% del límite Free durante dos ciclos consecutivos. No eliminar ni sustituir Redis: mantiene saldos y estado de producto.
3. **Vercel:** conservar un plan de pago mientras Chesscito ofrezca compras o persiga ingresos. Los límites técnicos de Hobby no sustituyen su restricción de uso.
4. **Railway:** inventariar qué servicio de Chesscito sigue allí. Si no sirve tráfico ni ejecuta una función necesaria, eliminarlo es preferible a migrarlo a Free; si es necesario, comparar su uso real contra el límite posterior al trial antes de tocarlo.
5. **Después de cambiar un plan:** repetir `ops:health`, una compra/control de saldo de prueba no monetaria y `ops:backup:verify`; revisar el panel a las 24 h para detectar pausas o cuotas.

## Siguiente paso recomendado

Abrir primero el panel de **Upstash** y capturar únicamente tres números no sensibles: comandos de 30 días, ancho de banda de 30 días y memoria usada. Es la única decisión de ahorro que sigue a ciegas y no requiere alterar la arquitectura.
