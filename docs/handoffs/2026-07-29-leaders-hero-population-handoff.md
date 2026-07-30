# Handoff — Leaders: el hero contaba el corte, no la población

**Fecha:** 2026-07-29 (noche 4) · **Branch:** `main` local, ahead 4, **sin pushear**
**Árbol:** limpio · **Suite:** 6702 passing / 564 files, `EXIT=0` · `tsc` limpio
**Migraciones nuevas:** ninguna — deliberado

## El defecto

`heroChampionStatsFormat` recibía `count: rows.length` (`leaderboard-sheet.tsx`), y `rows` es
el **top-10**. El número **no podía pasar de 10 por construcción**: en device el hero decía
"10 players" mientras el footer del mismo jugador decía **rank 13**. En el tab semanal decía
"3 players" y **acertaba sólo porque había tres jugadores**.

No era un detalle de formato: era una afirmación falsa en pantalla, y tocaba **all-time y
weekly a la vez** porque los dos comparten el hero.

## El arreglo

`total` — la población rankeada — contado sobre las relaciones **sin cortar**, las mismas de
las que sale el rank del footer, así que hero y footer ya no pueden contradecirse.

| Capa | Qué cambió |
|---|---|
| `lib/supabase/queries.ts` | `fetchLeaderboardTotalFromDb` (`leaderboard_full_v`) y `fetchWeeklyLeaderboardTotalFromDb` (`leaderboard_weekly_full_v`, filtrada por surface), con `count: "exact", head: true` |
| `lib/server/leaderboard.ts` | `fetchLeaderboardTotal` / `fetchWeeklyLeaderboardTotal` + `total?: number` en `LeaderboardResponse` |
| `app/api/leaderboard/route.ts` | `total` en las dos formas windowed, dentro del mismo `Promise.all` que las filas |
| `components/exercises/leaderboard-sheet.tsx` | el hero lee `total`; `total` por tab en `TabState` |
| `content/editorial.ts` + `messages/es.ts` | `heroChampionScoreFormat` — la misma línea sin el conteo |

**Sin migración, a propósito.** Las dos vistas ya tienen una fila por jugador rankeado, así
que el conteo no necesita SQL nuevo y el fix **no espera un apply en prod**. `head: true` hace
que PostgREST devuelva el número en un header y **no transfiera filas**, así que no se degrada
cuando la población crezca.

## Invariantes que quedaron fijadas

- **`null` significa DESCONOCIDO, y no es cero.** Conteo fallido ⇒ el campo se **omite** y el
  hero borra la cifra. Nunca `rows.length` (es el defecto) ni `0` (afirmaría un board vacío
  sobre uno poblado). `total ?? undefined` borra la clave; un `0` real sobrevive porque `??`
  sólo atrapa `null`.
- **`total` va sólo en las formas windowed.** Las dos legacy siguen congeladas byte por byte y
  **no disparan el conteo** — dos tests verifican la forma **y** que la función no se llamó.
- **Con el flag ON el tab all-time pide `?window=alltime`.** La forma legacy no puede llevar
  `total`, así que el tab necesitaba el envelope. Con el flag **OFF** sigue en la URL legacy y
  el hero muestra sólo los puntos: que no te digan la población no habilita adivinarla.
- **`typeof total === "number"`, no un chequeo truthy** — un `0` o un `1` reales se pintan.
- **No es `total` + la fila optimista**: esa fila es el propio jugador, ya contado siempre que
  estuviera rankeado antes.

## Source guard (no es un test de comportamiento)

`count: rows.length` está **prohibido en el source** del sheet. La versión mala **renderiza
bien**, se lee como correcta, y sólo miente cuando la población pasa el corte — que ningún
fixture está obligado a reproducir. Un "fallback sensato" futuro caería exactamente en el
mismo defecto, así que la forma está baneada, no sólo cubierta.

## ⚠️ El único seam conocido

El conteo semanal **no toma ventana**: `leaderboard_weekly_full_v` calcula siempre la semana
UTC actual (ver el header de la migración de Slice 2A), que es la misma que el endpoint le
pide a los RPCs. Un request que cruce **el lunes 00:00 UTC entre las dos queries** obtiene el
conteo de la semana nueva sobre las filas de la vieja. Se autocorrige en el refetch siguiente.

**Si algún día hay board de semanas pasadas, esto deja de alcanzar** y el conteo tiene que
tomar la ventana (ahí sí, RPC nuevo + migración).

## ✅ Verificado en producción (2026-07-29, endpoint)

`GET /api/leaderboard?window=alltime` sobre el deployment de Learn devolvió **10 filas y
`total: 17`** — exactamente la forma del bug: un board cortado en 10 sobre una población de 17.

Eso cierra por medición las dos incógnitas que este handoff listaba como no verificadas:

- **`service_role` SÍ puede leer `leaderboard_full_v`.** No había grant explícito (la migración
  del 2026-06-11 nunca otorgó nada sobre esa vista) y el fallback que la lee puede no haber
  corrido nunca en prod, así que era una suposición. Ya no.
- **PostgREST devuelve `count` sobre una vista con `head: true`.**

⚠️ **El primer vistazo en device mostró "10 players" con el endpoint ya sirviendo 17**: era el
bundle viejo cacheado en el webview, no un fallo del arreglo. El mismo deployment sirve el
route handler y el JS, así que un server nuevo con un cliente viejo se ve así. En MiniPay hay
que **cerrar la app del todo**; un refresh no alcanza.

## Verificación

| | |
|---|---|
| Suite completa | **6702 passing / 564 files**, `EXIT=0`, 0 `Unhandled Errors` / 0 `FAIL` |
| TypeScript | limpio |
| `content:audit` | exit 0, la clave nueva **no** aparece en los 160 findings preexistentes |
| Tests nuevos | 25 (9 data layer · 6 route · 10 UI, uno de ellos source guard) |

Los 17 tests flag-OFF preexistentes del sheet y los 4 del contrato legacy del route pasan
**sin modificarse**.

## Pendiente (del founder)

1. **Push** — `git push origin main`, y `production` si va con el deploy del weekly slice.
2. **Mirada en device**: el hero de ALL TIME debería decir la población real (13, no 10) y
   coincidir con el rank del footer. En THIS WEEK, seguir diciendo 3 — pero ahora por el
   conteo, no por coincidencia.
3. Sigue abierto de antes: `origin/production` está **atrás** del weekly slice · Theme Builder
   (frente grande) · arte huérfano del landing.

## Open questions

- **¿La línea sin conteo se ve bien a 390 px?** Con el flag OFF el hero pasa a decir sólo
  "1000 pts". Nadie lo vio renderizado — es una línea más corta, así que el riesgo es bajo,
  pero es el único estado nuevo de layout.
- **¿All-time debería scopearse por surface?** Sigue abierta de Slice 2, y ahora también
  aplica al conteo: `leaderboard_full_v` cuenta a todo el mundo, learn y play juntos.
