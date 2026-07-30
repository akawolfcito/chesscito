# Handoff — Leaders Weekly (Slice 2)

**Fecha:** 2026-07-29
**Estado:** implementación completa en `main` **local**
**Árbol:** limpio · **main local:** ahead 8 · **push:** pendiente · **deploy:** pendiente
**Feature flag:** `NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED` permanece **OFF**

## Resultado

El spec de 2026-07-27 estaba ⛔ BLOCKED porque `score_saves.created_at` significa
"mejoró", no "jugó". `score_attempts` (vivo en prod desde 2026-07-29) lo desbloqueó.
Se reescribió, se le hicieron **dos rondas de red-team**, y se partió en tres.

### Specs

| Archivo | Rol |
|---|---|
| `docs/specs/2026-07-29-leaders-weekly-window-v2.md` | Padre: D1–D5, semana UTC, asimetría off-chain, rollout, matriz de trazabilidad |
| `docs/specs/2026-07-29-leaders-weekly-db.md` | 2A — 23 ACs |
| `docs/specs/2026-07-29-leaders-weekly-api.md` | 2B — 16 ACs |
| `docs/specs/2026-07-29-leaders-weekly-ui.md` | 2C — 18 ACs |
| `docs/specs/2026-07-29-leaders-weekly-window-v2-redteam.md` | 3 rondas (r1, r2, integridad del split) |

Las 54 ACs de r2.1 se movieron una a un solo hijo; 3 se agregaron en el split; 1 se
reformuló. La matriz del padre lleva un subtotal visible porque su primera versión no
cerraba la aritmética.

### 2A — DB (`20260801000000_leaderboard_weekly.sql`)

Índice `score_attempts_surface_created_idx`; `weekly_ranking` como **única** relación de
ranking; `get_weekly_leaderboard` (corte top 10); `get_weekly_player_rank` (sobre el
conjunto **sin cortar**); `leaderboard_weekly_full_v` (`security_invoker = true`);
grants/revokes; scripts DEPLOY / VERIFY / ROLLBACK.

### 2B — API

Ventana UTC half-open (módulo puro, reloj inyectado); `requireDeploymentSurface`
fail-closed; lowercase del wallet antes de la query; **mapper exclusivo** para weekly;
route con `?window=`; fallback RPC → view filtrado por surface; shapes legacy congelados.

### 2C — UI

Kill switch; tabs Weekly / All-time; estado independiente por tab; preferencia
post-hydration; estados empty / CTA / error / rank 11+; rollover semanal; lifecycle del
optimistic row.

## Verificación final

| | |
|---|---|
| Suite completa | **6677 passing / 563 files** (sin `FAIL`, sin `Unhandled Errors`) |
| TypeScript | limpio |
| `content:audit` | exit 0 (warn-only) |
| Árbol Git | limpio |

**DB** — DB-1…DB-22 contra Postgres real, una transacción con `rollback`. DB-23: 200/200
transacciones, 8 clientes, 0 fallidas. Guard Vitest 21/21. ROLLBACK probado: deja los cinco
objetos en `f` y `score_attempts` intacta.

**API** — 16 ACs. Weekly **omite** `hasOnchain` (ausente, no `false`). Wallet checksummed se
normaliza antes de consultar. El surface se resuelve sólo dentro de la rama weekly. El
fallback conserva el filtro por surface.

**UI** — 18 ACs en 42 tests. Con el flag OFF los 17 tests preexistentes pasan **sin
modificarse**. Weekly no pinta sellos on-chain. El retry queda acotado al tab que falló. El
hero ya no afirma el estado semanal cuando el fetch falló.

## Lo que los tests atraparon y la revisión no

1. **`toApiRow` habría emitido `hasOnchain: false`** en cada fila semanal — un campo
   *presente* afirmando exactamente lo que la asimetría prohíbe, y `false` pasa cualquier
   assert de falsy. El AC exige el operador `in`.
2. **Resolver el surface arriba del handler** habría hecho 500 los tres shapes legacy con el
   mode ausente. Hay un test que los llama con la variable borrada y espera 200.
3. **El fallback sin `.eq("surface")`** fusiona Learn y Play mientras todo lo demás sigue
   verde. Hay un test cuyo único trabajo es ese `eq`.
4. **El hero afirmaba el estado semanal con el fetch fallado.**
5. **`tsc`** agarró que el retry llamaba una función eliminada — ningún test lo ejercitaba.

Dos P0 de la ronda 2 fueron **introducidos por los arreglos de la ronda 1** (el mapper, y una
regla de limpieza que comparaba el score de un ejercicio contra un total por jugador).
Re-revisar después de revisar es lo que los encontró.

## Fix independiente durante el cierre

`main` estaba **rojo** en `attempt-assemblers.test.tsx > the promotion lane grades FAILURES`
(5/5 en aislamiento y en la suite completa), sin relación con Slice 2.

**Causa:** `Found multiple elements with the role "button" and name /queen/i` — el carril de
Special Training ahora renderiza un nodo de Queens, así que la query global matcheaba dos
botones.

**Descartado antes de tocar nada:** no era timing (con 15 s de espera el botón nunca
resolvió), no era fecha (reproduce igual bajo `TZ=Pacific/Honolulu` y `TZ=UTC` — la
coincidencia con medianoche UTC era casualidad), y el picker sí monta (sonda con
`pr-picker-option-queen` presente).

**Corrección:** acotar la query a `data-testid="pr-picker"` conservando la búsqueda por role.
Rama propia (`fix/promotion-picker-diagnosis`), commit `b577e9db`, mergeado a `main` antes de
2C.

## Estado de rollout

La UI semanal está oculta: `NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED` no existe en ningún entorno.
El endpoint **sí** responde `GET /api/leaderboard?window=weekly` a propósito, para sondear los
datos en producción antes de encender la UI.

## ✅ Migración APLICADA en producción (2026-07-29)

`20260801000000_leaderboard_weekly.sql` aplicada, y el VERIFY corrido contra prod:
**19/19 PASS.** Resultado registrado:

| Grupo | Resultado |
|---|---|
| Objetos (índice, 3 funciones con firma, vista) | 5/5 existen |
| `anon` / `authenticated` EXECUTE sobre las 3 funciones | 6/6 **sin** EXECUTE |
| `service_role` EXECUTE sobre las 3 | 3/3 con EXECUTE |
| `anon` / `authenticated` SELECT sobre la vista | 2/2 **sin** SELECT |
| `service_role` SELECT sobre la vista | con SELECT |
| `security_invoker=true` | true |
| Ventana computada | `2026-07-27 Mon`, `db TimeZone=UTC` |

> Las seis filas de "sin EXECUTE" son la parte que importa: en Slice 3 la migración decía
> `revoke` y `has_function_privilege('anon', …)` devolvía TRUE igual. Acá está medido contra
> la base, no inferido del texto del script.

**El VERIFY costó dos arreglos, ambos encontrados al EJECUTARLO:** usaba `to_regproc` (que
toma un nombre, no una firma) y reportaba las tres funciones como ausentes estando presentes;
y estaba escrito con `\echo` + seis result sets, o sea sólo servía desde psql — pegado en el
SQL Editor de Supabase revienta en la primera línea, y aun sin eso Studio muestra **sólo el
último** result set. Ahora es una sola consulta con columna PASS/FAIL.

## ⚠️ El board semanal es SÓLO-LEARN (verificado en device, 2026-07-29)

`arena/page.tsx:1197` es `isPlayMode() ? <PlayLeadersSheet/> : <LeaderboardSheet/>`. En Play el
slot "leaderboard" del dock lo ocupa el **Hall of Fame** (victorias minteadas,
`/api/hall-of-fame`), así que **`LeaderboardSheet` no se monta nunca en Play**.

- `NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED` **sólo tiene efecto en Learn**. En Play es no-op —
  inofensivo, pero no hace nada.
- El carril `surface = 'play'` del SQL y del endpoint funciona y está probado, pero **hoy no
  tiene consumidor**. D2 sigue siendo correcto; darle board a Play es decisión de producto
  pendiente, no deuda técnica.
- La open question del spec padre sobre "Arena mostrará un board sólo-Play" quedó **cerrada
  por inexistente**.

## ✅ Verificado en device (2026-07-29, Learn)

Con el flag encendido, en el dock → Leaders:

- **Los dos tabs son boards distintos**: ALL TIME 10000 pts / 10 players · THIS WEEK 4400 pts
  / 3 players. Los 3 coinciden con `ranked_wallets = 3` del SQL — los dos caminos dan lo mismo.
- **La asimetría off-chain se ve**: en ALL TIME las filas 1–4 llevan el sello; en THIS WEEK
  **ninguna**. Es `hasOnchain` ausente, no `false` — lo que protegía el P0 del mapper.
- **Rank 11+ en el footer**: en all-time el propio row sale **13** mientras la lista corta en 10.
- El propio row resaltado en lista **y** espejado en el footer es intencional (preexistente).

## 🐛 Preexistente, destapado al mirar: el hero cuenta el CORTE, no la población

El hero dice "10 players" mientras el footer dice rank 13. `heroChampionStatsFormat` recibe
`count: rows.length` (`leaderboard-sheet.tsx:217`), y `rows` es el top-10. Viene de antes de
este slice y ahora lo hereda el tab semanal, donde hoy dice "3 players" y **acierta sólo porque
hay tres**. Con 15 jugadores semanales diría 10.

No se tocó a propósito: fuera del alcance de 2C, que ya estaba cerrado y verificado. Anotado en
`docs/backlog/2026-07-10-backlog-index.md`. El arreglo pide un `total` en la respuesta — el
`player` rank ya viaja sobre el conjunto sin cortar, así que la pieza que falta es sólo esa.

## Pendiente (del founder)

1. **Push** — `git push origin main`, y `git push origin production` para desplegar.
2. **Plan de prueba: sólo Learn.** `/exercises` → dock → Leaders. Qué mirar:
   - cambiar de tab y volver (la segunda vez no debe refetchear);
   - el propio row con wallet **checksummed** — el caso que ningún fixture agarra;
   - el **rollover**: el lunes que viene la ventana resetea y el board semanal queda vacío con
     el CTA. Es el único estado que todavía nadie vio renderizado.
   > Play no tiene board semanal que probar (ver arriba). Su carril sólo se puede sondear por
   > endpoint: `GET /api/leaderboard?window=weekly` sobre el deployment de Play → `surface: "play"`.

## No hacer todavía

- No activar `NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED`.
- No mezclar scores on-chain en Weekly.
- No backfillear desde `score_saves`.
- No cambiar All-time.
- **No desplegar si `NEXT_PUBLIC_ATTEMPT_LANE_ENABLED` no está activo** — el board saldría
  vacío y parecería que nadie jugó. Es una regla de orden entre dos flags; el read path no
  puede detectarlo.
- No confiar en el fallback de surface: Weekly falla cerrado a propósito.

## Rollback

**Migración con problemas, antes de encender la UI:** correr el ROLLBACK del slice, mantener
el flag apagado. No hay datos de usuario que revertir — el feature es read-only y no escribe
ninguna fila.

**Endpoint bien, UI mal después de encender:** apagar
`NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED`, redeploy de Learn **y** Play (`NEXT_PUBLIC_*` son
build-time), conservar DB y endpoint para diagnóstico.

## Open questions

- **¿El tab semanal necesita cuenta regresiva de reset?** `weekStart`/`weekEnd` ya viajan en
  la respuesta, así que es barato — pero es decisión de producto, y la card de Focus Days ya
  enseñó que tres números en una fila a 390 px es riesgo de layout.
- **`/arena?sheet=leaderboard` va a mostrar un board semanal sólo-Play.** Se sigue de D2 y se
  cree correcto, pero Arena nunca tuvo un board que excluyera el juego de Learn. Merece una
  mirada antes de encender el flag.
- **¿All-time debería scopearse por surface también?** Hoy los dos tabs difieren en dos
  dimensiones a la vez (tiempo *y* población). Deliberado por ahora.
- **La primera semana va a ser delgada por construcción.** `score_attempts` escribe desde el
  2026-07-29; no hay backfill posible. Conviene encender el flag después de una semana UTC
  completa de datos reales.
