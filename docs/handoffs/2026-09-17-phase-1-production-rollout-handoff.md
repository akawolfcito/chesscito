# Handoff — Phase 1 Supabase Disk IO rollout

Fecha: 2026-09-17

## Estado actual

**Phase 1 está desplegada en Producción.** No se hizo rollback, no se ejecutó
un refresh manual de stats y no se ha tomado la ventana AFTER todavía.

HEAD desplegado en ambos branches de Producción:

```text
58b57982793068ff7ee5d903f69ebe6d871e6b71
chore: keep stats refresh at six-hour cadence
```

La cadena relevante es:

```text
27cc0f19 fix: contain first-seen writes and protect stats refresh
58b57982 chore: keep stats refresh at six-hour cadence
```

Los branches remotos `main` y `production` apuntan a `58b57982` tras un push
atómico fast-forward. No hubo force push.

## Producción desplegada

Los aliases de Producción sirven el commit desplegado de Phase 1:

| Dominio | Proyecto | Deployment actual READY |
| --- | --- | --- |
| `play.chesscito.com` | `chesscito` | `dpl_2gW2riJABea6ogS6e9GSLCB5AL8h` |
| `learn.chesscito.com` | `lite-chesscito` | `dpl_FPXqTaKVAMZw56FMZy6aWr7yH7SG` |
| `www.chesscito.com` | `chesscito-landing` | `dpl_GjD41BtcVgoo2DdDnUJJDakygdBv` |

Rollback targets, reconfirmados READY antes del push:

| Dominio | Deployment de rollback |
| --- | --- |
| `play.chesscito.com` | `dpl_HWBjvZYwoVzd4FTkoanDQDnK2H6X` |
| `learn.chesscito.com` | `dpl_819rSQNCujGiPcXNcmrQTAwdv7cT` |
| `www.chesscito.com` | `dpl_9KMMvrA3j2CQwEfMpxu9JSx8ZPpJ` |

Para revertir aliases, si aparece una regresión material:

```bash
vercel rollback dpl_HWBjvZYwoVzd4FTkoanDQDnK2H6X --scope goodwolf --yes
vercel rollback dpl_819rSQNCujGiPcXNcmrQTAwdv7cT --scope goodwolf --yes
vercel rollback dpl_9KMMvrA3j2CQwEfMpxu9JSx8ZPpJ --scope goodwolf --yes
```

No hacer rollback sólo porque el ratio de first-seen sea mayor que cero.

## Qué cambia Phase 1

- `/api/telemetry` conserva en memoria, con límites y sólo tras éxito, las
  identidades `account_first_seen` y `session_first_seen`; Postgres sigue siendo
  la autoridad y los fallos/restarts/evictions sólo provocan retries idempotentes.
- `/stats` público lee el snapshot durable Redis y no debe ejecutar RPCs de
  stats por recarga, locale ni filtros públicos.
- La refresh protegida usa lock Redis distribuido, cooldown y publicación
  atómica del snapshot completo.
- El cron quedó en `17 */6 * * *` (00:17, 06:17, 12:17 y 18:17 UTC): máximo
  aproximado de 4 refreshes/día × 5 RPCs habilitados = 20 RPCs/día.

No se implementó Phase 2: no se eliminaron, renombraron ni redujeron eventos.

## BEFORE limpio — baseline válido

Ventana pre-deploy válida, sin refresh de stats:

| Campo | Valor |
| --- | --- |
| T0 | `2026-09-17T05:21:09.413846+00:00` |
| T1 | `2026-09-17T05:36:36.383062+00:00` |
| Duración | ~926.97 segundos |
| `stats_reset` | sin cambios |
| `dealloc` | `0` |
| Cron overlap | no |

Intervalo más importante:

```text
analytics_events calls:       +43
account_first_seen calls:     +43
session_first_seen calls:     +11
account_first_seen / analytics_events = 100%
```

Este es el baseline contra el que se debe comparar AFTER. Los valores de
`pg_stat_statements` son acumulados: usar siempre dos capturas y restar
counters; no comparar lifetime means directamente.

## Cron: configuración y situación operativa

Se configuraron, sin imprimir valores, los secrets repository-level de GitHub:

- `STATS_REFRESH_URL` = origin de Producción `https://www.chesscito.com`
  (el workflow añade el path).
- `STATS_REFRESH_SECRET` fue copiado in-memory/stdin desde
  `chesscito-landing` Production `STATS_REFRESH_SECRET`.

`CRON_URL` y `CRON_SECRET` se dejaron intactos.

El workflow hace `POST` a:

```text
${STATS_REFRESH_URL%/}/api/internal/stats/refresh
Authorization: Bearer ${STATS_REFRESH_SECRET}
```

El refresh nominal de 06:17 UTC no había aparecido aún en GitHub Actions a
las 06:34 UTC; GitHub puede retrasar `schedule`. **No iniciar AFTER hasta
confirmar que ese run retrasado termina y que los contadores `stats_*` se
estabilizan.** No despachar ni llamar manualmente al endpoint.

## Smoke realizado

- Landing carga.
- Play y Learn cargan en viewport móvil, pero la sesión de smoke estaba sin
  acceso autorizado y mostró el gate normal de signin. No crear wallet/cuenta
  ni hacer pagos para completar el smoke.
- `/stats`, `?locale=es` y `?surface=learn&container=minipay` devolvieron 200
  y renderizaron la snapshot. Los tres bloques omitidos se mostraron como
  temporalmente no disponibles, según diseño.
- Un probe read-only de contadores confirmó que tres lecturas públicas de
  `/stats` no incrementaron `stats_*`: `1391 → 1391` entre
  `06:32:12` y `06:33:48 UTC`; `stats_reset` y `dealloc` siguieron estables.
- Hubo fallback RSC al navegar rápidamente entre variantes de `/stats`, pero
  las tres respuestas fueron 200. No se observó hidratación ni error de recurso.
- La verificación de `POST /api/telemetry` no concluyó: sesiones headless se
  cerraron antes del idle flush. Verificarla con una sesión normal autorizada.

Pendiente con cuenta autorizada real, sin mainnet payment innecesario:

1. empezar/completar un ejercicio;
2. empezar Arena y hacer primer movimiento;
3. comprobar Peones, save/persistencia y telemetría normal.

## Próxima sesión: orden seguro

1. Consultar GitHub Actions para el run cron pendiente de 06:17 UTC; esperar
   estado terminal. No despacharlo manualmente.
2. Tomar una foto read-only de `io-capture.sql` tras la estabilización; será
   AFTER T0.
3. Esperar ~15 minutos sin deploy, refresh manual, maintenance ni carga
   sintética; tomar AFTER T1.
4. Ejecutar `io-compare.sql` con BEFORE T0/T1 y AFTER T0/T1.
5. Revisar sobre todo `account_first_seen_calls / analytics_events_calls`.
   Debe caer de 100%, pero no a cero necesariamente (cold starts, instancias,
   cuentas nuevas y evictions idempotentes son válidos).
6. Marcar una ventana como cron-overlapped si el refresh cae dentro; no
   compararla contra la ventana BEFORE limpia.
7. Completar el smoke autenticado antes de declarar cierre de rollout.

Archivos de medición a usar:

- `docs/audits/2026-09-16-phase-1-io-capture.sql`
- `docs/audits/2026-09-16-phase-1-io-compare.sql`

## No tocar sin una decisión explícita

- No implementar Phase 2 de reducción de telemetría.
- No cambiar fórmulas de stats, RPC selection, `work_mem`, compute Supabase ni
  cadencia de seis horas.
- No resetear `pg_stat_statements`, ejecutar maintenance, refresh manual ni
  modificar secretos/variables.
- No hacer push/deploy adicional hasta tener evidencia AFTER o una corrección
  revisada.
