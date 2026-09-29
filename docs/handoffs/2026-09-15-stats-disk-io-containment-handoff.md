# Handoff — contención de Disk IO de `/stats`

Fecha: 2026-09-15

## Estado local

- Commit local en `main`: `eab35e12 fix(stats): contain public disk io with redis snapshot`.
- No se hizo push.
- El commit no incluye documentos ni los otros archivos untracked del workspace.
- Pruebas verificadas antes del commit:
  - `pnpm -C apps/landing test`: 309 aprobadas.
  - `pnpm -C apps/landing type-check`: aprobado.
  - `pnpm -C apps/web exec tsc --noEmit`: aprobado.
  - Tests focalizados de `/stats` en web: 3 aprobadas.
  - `git diff --cached --check`: aprobado antes del commit.

## Qué cambió

- `/stats` público en landing sólo lee el snapshot Redis
  `stats:public:all-all:v1`.
- No existe ruta pública que invoque `getPublicStats`, `stats_*`,
  `getSurfaceBreakdown` o `readPlayersCensus`; el único camino es el endpoint
  interno autenticado.
- `apps/web/[locale]/stats` redirige a landing usando `params.locale`:
  `/en/stats` -> `https://www.chesscito.com/stats`;
  `/es/stats` -> `https://www.chesscito.com/stats?locale=es`.
- Si Redis no está disponible, el snapshot falta o es inválido, se muestra el
  estado explícito `snapshot_unavailable`, sin métricas ni timestamp falso.
- Los filtros públicos están deshabilitados temporalmente.

## Redis

| Key | Función | TTL |
| --- | --- | --- |
| `stats:public:all-all:v1` | Snapshot durable all/all | Sin TTL |
| `stats:public:refresh-lock:v1` | Exclusión mutua de refresh | 120 s |
| `stats:public:refresh-cooldown:v1` | Límite entre refreshes exitosos | 21,600 s (6 h) |

El lock usa `SET NX EX` y liberación Lua condicionada por token. El cooldown
es independiente: sólo se escribe después de persistir un snapshot completo.
Un refresh durante cooldown responde HTTP 429 con
`{ "refreshed": false, "reason": "refresh_cooldown" }` y
`Retry-After: 21600`.

## Endpoint y cron

- Endpoint: `POST /api/internal/stats/refresh`.
- Auth: `Authorization: Bearer $STATS_REFRESH_SECRET`.
- Rechaza secreto ausente, vacío, whitespace o incorrecto antes de Redis o
  Supabase; la comparación se hace en tiempo constante.
- Cron GitHub Actions: `.github/workflows/cron-stats-snapshot-refresh.yml`.
- Schedule: `17 */6 * * *` (cada seis horas).
- Máximo programado: 4 refreshes/día; cada uno realiza 10 llamadas
  `stats_*` (8 generales y 2 de `stats_install_counts` para Learn/Play).

## Configuración requerida antes de deploy

En Vercel, proyecto `chesscito-landing`, Production:

```text
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
STATS_REFRESH_SECRET=<valor aleatorio largo>
```

En GitHub Actions secrets:

```text
STATS_REFRESH_URL=https://www.chesscito.com
STATS_REFRESH_SECRET=<mismo valor de Vercel>
```

No usar valores `NEXT_PUBLIC_`. No registrar ni pegar secretos en terminal,
logs o documentos.

## Orden de deploy / bootstrap

1. Push de `main` por el responsable.
2. Verificar que landing y web desplieguen el commit.
3. Confirmar las variables Production y secrets de GitHub Actions.
4. Ejecutar manualmente el workflow **Cron — public stats snapshot refresh**.
5. Confirmar HTTP 200 y `refreshed: true`.
6. Abrir `/stats`: debe mostrar números y timestamp del snapshot.
7. Abrir `/stats?surface=learn&container=minipay`: debe seguir all/all y
   mostrar filtros no disponibles.
8. Abrir `/en/stats` y `/es/stats`; confirmar redirect e idioma esperado.
9. Tomar baseline de `pg_stat_statements`, abrir `/stats` repetidamente y
   comprobar que no aumentan los calls de `stats_*`.
10. Ejecutar un refresh controlado y comprobar que sólo entonces aumenta el
    conjunto esperado de llamadas SQL.

## Riesgos operativos pendientes

- El primer snapshot debe generarse manualmente; sin él la página se degrada
  intencionalmente y no consulta Supabase.
- GitHub Actions puede retrasar un schedule; un refresh manual reciente puede
  causar 429 del cron hasta expirar el cooldown.
- Falta alertado automático para cron fallido, snapshot con más de 6–12 horas,
  Redis lento/caído y endpoint 503/429.
- Un rollback a una versión anterior puede restaurar el agregador público
  pesado. No usar rollback de Vercel como primera reacción ante snapshot
  ausente; primero verificar Redis, secrets y endpoint interno.
