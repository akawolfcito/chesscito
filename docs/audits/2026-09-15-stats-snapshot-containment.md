# /stats — contención de Disk IO

Fecha: 2026-09-15

## Resultado

`/stats` público ya no ejecuta `getPublicStats`, ninguna RPC `stats_*`, el
agregador histórico ni el censo de jugadores. Lee exclusivamente una única
foto durable `all/all` de Upstash Redis. Si no existe una foto válida o Redis
no está configurado, renderiza el estado degradado; no consulta Supabase.

`apps/web/[locale]/stats` redirige al único dashboard público de landing y no
puede ejecutar su agregador histórico.

El único camino que puede regenerar es `POST /api/internal/stats/refresh`:
requiere `Authorization: Bearer $STATS_REFRESH_SECRET`, usa un lock distribuido
y sólo publica la nueva foto después de construirla completamente.

## Claves y TTL

| Clave | Uso | TTL |
| --- | --- | --- |
| `stats:public:all-all:v1` | snapshot público único | sin TTL; se conserva hasta un refresh completo posterior |
| `stats:public:refresh-lock:v1` | lease distribuido de refresh | 120 segundos |

El lock se adquiere con `SET NX EX` y se libera con un script Lua sólo si sigue
siendo propiedad del proceso que lo adquirió. Su expiración evita un bloqueo
permanente si una función termina anormalmente.

## Flujo

Antes: una visita podía llegar a caches por deployment/instancia/combinación de
filtros y provocar (o esperar) agregaciones pesadas. `apps/web` además tenía
otro agregador directo.

Ahora:

1. Visita pública a `/stats` -> `GET stats:public:all-all:v1`.
2. Snapshot válido -> se sirve, incluso si tiene varias horas de antigüedad.
3. Snapshot ausente/no válido/Redis caído -> estado degradado, cero lecturas a
   Supabase; filtros `surface` y `container` se muestran no disponibles.
4. Cron autenticado -> lock -> ocho RPC `stats_*`, dos llamadas adicionales a
   `stats_install_counts` para el desglose Learn/Play y el censo -> validación
   completa -> reemplazo atómico lógico del snapshot -> liberación del lock.
5. Error parcial o total -> se conserva el snapshot anterior y se registra el
   fallo; no se publica una foto incompleta.

## Cron exacto

Archivo: `.github/workflows/cron-stats-snapshot-refresh.yml`.

```yaml
schedule:
  - cron: '17 */6 * * *'
```

GitHub Actions hace `POST ${STATS_REFRESH_URL}/api/internal/stats/refresh`, con
timeout de 120 segundos y los secrets `STATS_REFRESH_URL` y
`STATS_REFRESH_SECRET`. La concurrencia del workflow y el lock Redis cubren
duplicados tanto en GitHub como entre regiones/instancias.

## Capacidad posterior

El cron programado genera como máximo 4 refreshes/día. Cada refresh hace 10
RPCs `stats_*` (las ocho del snapshot y dos `stats_install_counts` para
Learn/Play): **máximo esperado de 40 llamadas `stats_*`/día por el cron**,
independiente de visitas públicas. Los disparos manuales autenticados son
adicionales y deben reservarse para incidentes.

## Variables requeridas

En Vercel, proyecto `chesscito-landing`, Production:

```text
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
STATS_REFRESH_SECRET=<secreto aleatorio largo>
```

En GitHub Actions secrets:

```text
STATS_REFRESH_URL=https://www.chesscito.com
STATS_REFRESH_SECRET=<el mismo valor de Vercel>
```

No usar prefijos `NEXT_PUBLIC_`. El refresh falla cerrado si falta el secreto;
la página pública se degrada si falta Redis y nunca cae a Supabase.

## Despliegue y primer snapshot

1. Configurar las variables de Vercel y los secrets de GitHub anteriores.
2. Desplegar `chesscito-landing` y `apps/web` con estos cambios.
3. Tras el deploy, disparar manualmente el workflow **Cron — public stats
   snapshot refresh** (`workflow_dispatch`) o enviar un `POST` autenticado al
   endpoint interno.
4. Confirmar HTTP 200 con `refreshed: true`; sólo entonces existe el primer
   snapshot saludable. Antes de eso `/stats` mostrará estado degradado, sin
   generar carga en Supabase.
5. Abrir `/stats` repetidamente, con y sin `?surface=learn&container=minipay`:
   la página debe mostrar filtros no disponibles y los contadores de
   `pg_stat_statements` para `stats_*` no deben aumentar. Disparar un refresh
   autenticado y verificar que sólo entonces aumenta el conjunto esperado.

## Verificación local

- `pnpm -C apps/landing test` — 31 archivos, 305 pruebas aprobadas.
- `pnpm -C apps/landing type-check` — aprobado.
- `pnpm -C apps/web exec tsc --noEmit` — aprobado.
- Pruebas focalizadas de `/stats` en web — 2 archivos, 3 pruebas aprobadas.
- `pnpm -C apps/landing build` no completó porque el entorno no puede resolver
  `fonts.googleapis.com`; es una dependencia de fuentes remotas, no un error
  de la contención. El build de web tiene la misma limitación de red.

Las pruebas cubren snapshot existente/ausente sin builder, reemplazo exitoso,
preservación ante resultado incompleto, concurrencia, expiración de lock,
autorización del endpoint, redirección de `apps/web` y filtros sin rutas de
regeneración.
