# Handoff — incidente Supabase Disk IO / Data API

Fecha: 2026-09-16

## Estado al cerrar la sesión

Supabase fue reiniciado y volvió a aceptar una sesión PostgreSQL marcada
`READ ONLY`. No se hicieron escrituras, cambios de configuración, refresh de
`/stats`, mantenimiento de PostgreSQL ni despliegues desde esta sesión.

La última foto viva fue tranquila:

- 0 queries de usuario activas.
- 0 sesiones `idle in transaction`.
- 0 locks bloqueados o bloqueantes.
- 9 conexiones idle esperando cliente.
- PostgREST con su `LISTEN "pgrst"` idle normal.
- Sólo waits normales de procesos internos (autovacuum/checkpointer/WAL/bgwriter).

Esto confirma recuperación del plano PostgreSQL/Supavisor en ese instante, no
que la causa histórica del incidente esté cerrada.

## Mitigaciones que ya estaban desplegadas

- `NEXT_PUBLIC_TELEMETRY_ENABLED=0` en Vercel Production para:
  - `chesscito` (`play.chesscito.com`)
  - `lite-chesscito` (`learn.chesscito.com`)
- `/stats` público sigue contenido por snapshot Redis; no hacer refresh durante
  la investigación.

El switch vuelve `track()` inerte para bundles nuevos: no encola, no arma el
timer de batch y no hace `POST /api/telemetry`.

## Caveat de telemetría

Los logs posteriores al redeploy todavía mostraron `POST /api/telemetry`, en
especial en Learn. Es compatible con pestañas que conservan JS anterior y
ahora llaman al endpoint del nuevo deployment; no se pudo observar una carga
de navegador nueva porque el navegador de verificación no estaba disponible.

No declarar el switch cerrado por logs hasta que haya una ventana limpia tras
la renovación de clientes o una verificación de red de un bundle fresco.

Además del cliente, existe un writer servidor:

- `apps/web/src/lib/duel/service.ts` → `recordDuelEvent()` inserta eventos de
  duel en `analytics_events` cuando recibe un `sessionId`.

No se hallaron writers alternos para `session_first_seen` ni
`account_first_seen`; ambos se escriben desde `/api/telemetry`.

## Evidencia acumulada de `pg_stat_statements`

Excluyendo `stats_*`, el principal statement normal acumulado fue el insert
PostgREST en `analytics_events`:

| Statement | Calls | Total | Mean | shared blocks read | shared blocks hit |
| --- | ---: | ---: | ---: | ---: | ---: |
| insert `analytics_events` | 73,940 | 1,026,376 ms | 13.88 ms | 4,157 | 15,060,873 |

Otros statements visibles con coste acumulado fueron agregaciones históricas
sobre `analytics_events`, lecturas PostgREST de eventos, una consulta de
`leaderboard_full_v` con temp IO, exportaciones `COPY` históricas y escrituras
de `peones_ledger`. Estos son contadores acumulados: no atribuirlos a carga
activa sin tomar una segunda foto y comparar deltas.

## Durante la degradación

Antes del restart se observaron:

- Cloudflare/Supabase `522 Connection timed out` desde rutas que leen Supabase.
- Timeouts de Vercel de 300 segundos en `/api/peones/balance`,
  `/api/welcome-pack/status` e `/api/inbox`.
- Supavisor rechazando la conexión administrativa read-only con:
  `EAUTHQUERY authentication query failed: connection to database not available`.

Las páginas base de Play y Learn devolvían HTTP 200, pero una única lectura
normal `GET /api/leaderboard` agotó 20 segundos durante la caída.

## Próxima sesión: orden seguro

1. No reactivar telemetría ni refrescar `/stats` todavía.
2. Tomar una segunda foto observacional read-only tras una ventana estable y
   comparar `pg_stat_activity` y deltas de `pg_stat_statements`.
3. Verificar con un navegador real que un bundle fresco de Play y Learn no
   emite `POST /api/telemetry`.
4. Revisar logs de Vercel por ventana: volumen de `/api/telemetry`, 5xx, 522 y
   timeouts de rutas Supabase.
5. Sólo con deltas reales decidir si el siguiente candidato es telemetry,
   polling de duels, reads de balances/estado o una limitación de Nano.

## No tocar sin evidencia nueva

- No `EXPLAIN ANALYZE`, `VACUUM`, `REINDEX`, migraciones ni índices.
- No matar sesiones a ciegas.
- No añadir retries a telemetría ni a clientes Supabase.
- No ejecutar refresh de `/stats`.
