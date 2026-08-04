# Fase 0 — validación post-deploy

**Fecha:** 2026-08-03 · **Ventana observada:** ~11 min post-deploy (muestra chica)
**Veredicto:** Fase 0 sana. **NO empezar Fase 1** — hay un defecto de producción vivo,
anterior a Fase 0, que es más urgente.

---

## 1. Deployments — VERIFICADO

| | chesscito | lite-chesscito |
|---|---|---|
| Deployment ID | `dpl_GPJCGu4wLNZtUEfs21swfaTy6GgD` | `dpl_8HuDa3fxPgsgcqP4nMwbfRSx5TwV` |
| URL | `chesscito-3xxzi0hd1-goodwolf.vercel.app` | `lite-chesscito-e6vbqmzn3-goodwolf.vercel.app` |
| Alias | `play.chesscito.com` | `lite.chesscito.com` |
| Estado | ● Ready | ● Ready |
| Target | production | production |
| Branch (logs) | `production` | `production` |
| Creado | 2026-08-03 19:42:37 −05 | 2026-08-03 19:42:33 −05 |
| Build | 3m | 3m |

**Divergencia: ninguna.** `HEAD` = `origin/main` = `origin/production` =
`b784dd344b05ecee5a3f8df871f74d6749e89b66`, sin commits por delante ni por detrás.

> **Matiz de método:** `vercel inspect` en el CLI 58.4.4 **no expone el SHA**. La
> correspondencia deployment↔commit la deduzco de que la rama de producción
> (`origin/production`) apunta exactamente a `b784dd34` y no tiene commits posteriores
> al build. Es sólido, pero es inferencia, no lectura directa del SHA del deployment.

---

## 2. Smoke tests

Sólo lecturas. Ninguna compra, claim, gasto ni mutación deliberada.

**Wallet inválida** — prueba que el guard nuevo deja pasar (en las tres rutas el guard
corre ANTES de validar la wallet, así que un 400 sólo se alcanza si el guard permitió):

| Ruta | play | lite |
|---|---|---|
| `/api/pro/status?wallet=notawallet` | 400 · 0.46 s | 400 · 0.60 s |
| `/api/peones/balance?wallet=notawallet` | 400 · 0.36 s | 400 · 0.47 s |
| `/api/welcome-pack/status?wallet=notawallet` | 400 · 0.44 s | 400 · 0.42 s |

**6/6 correctos.** Sin 429, sin 403, sin 500. El limiter responde bien por debajo del
presupuesto de 1.5 s.

**Wallet válida** (`0x1111…1111`):

| Ruta | Backend | play | lite |
|---|---|---|---|
| `/api/pro/status` | Redis | **200 · 0.41 s** | **200 · 0.40 s** |
| `/api/welcome-pack/status` | Redis + Supabase | **timeout >30 s** | **timeout >30 s** |
| `/api/peones/balance` | Redis + Supabase | **timeout >30 s** | **timeout >30 s** |

> **Divulgación:** mi primera corrida usó esa wallet contra `/api/peones/balance`, que
> aún ejecuta la semilla del welcome pack. Puede haber creado **una** fila en
> `peones_ledger` para una dirección basura — o ninguna, dado que la request nunca
> completó. Es idempotente por el índice único. Las corridas siguientes las hice con
> wallet inválida justamente para no repetirlo.

---

## 3. Logs `rate_limit_guard`

| Señal | chesscito | lite-chesscito | Clasificación |
|---|---|---|---|
| `rate_limit_guard` (total) | 0 | 0 | sin muestra suficiente |
| `outcome: "limited"` | 0 | 0 | sin muestra suficiente |
| `outcome: "redis_error"` | 0 | 0 | sin muestra suficiente |
| `outcome: "redis_timeout"` | 0 | 0 | sin muestra suficiente |
| `rate_limit_identifier_unsalted` | **0** | **0** | **VERIFICADO** |

Dos lecturas distintas, no las confundas:

- **`unsalted` ausente = verificado.** Ese log se emite en el primer guard que corre sin
  `LOG_SALT`. Hubo decenas de guards ejecutados (todas las respuestas 200/400/500 de
  arriba pasaron por uno) y no apareció → **`LOG_SALT` está presente en ambos proyectos y
  las keys llevan digest salado, no IP cruda.**
- **`limited`/`redis_error`/`redis_timeout` ausentes = sin muestra concluyente.** Son
  buenas noticias (el guard no negó a nadie ni falló), pero 11 min de tráfico bajo no
  prueban que la tasa de 429 haya bajado. El caso `allowed` no se loguea por defecto,
  así que la ausencia total de líneas es el estado esperado en operación normal.

---

## 4. 429 y errores por endpoint

**429: CERO. Antes y después del deploy.** Grep sobre los tres sets de logs:

| Ventana | 429 |
|---|---|
| chesscito post-deploy | 0 |
| lite post-deploy | 0 |
| lite **pre-deploy** (`dpl` de hace 6 h) | 0 |

Códigos observados (lite post-deploy, 105 líneas):

| Ruta | Backend | Códigos |
|---|---|---|
| `/api/pro/status` | Redis | **200 ×12**, 400 ×1 |
| `/api/shields/me` | Redis | **200 ×4**, 0 ×2 |
| `/api/profile/stats` | Supabase | **200 ×6** |
| `/api/telemetry` | Supabase | 204 ×22 *(siempre 204, traga errores)* |
| `/api/welcome-pack/status` | Supabase | **500 ×8**, 400 ×2 |
| `/api/peones/balance` | Supabase | **500 ×2**, 400 ×2, 0 ×2 |
| `/api/peones/earn` | Supabase | **500 ×2** |
| `/api/season-pass/status` | Supabase | **503 ×4** |

chesscito post-deploy (40 líneas): `/api/pro/status` 200 ×7,
`/api/welcome-pack/status` **500 ×3**, `/api/peones/balance` 0 ×1.

---

## 5. Upstash — NO OBSERVABLE

No tengo credenciales ni MCP de Upstash, y no las voy a pedir para esto. Keyspace,
comandos consumidos y el delta contra los ~4.9K keys previos **sólo los podés leer vos en
la consola**. Qué mirar:

- keyspace: debería subir (14 buckets en vez de 1) pero acotado — TTL de 121 s;
- comandos: **no** deberían subir; el guard sigue siendo 1 round-trip y el
  `ephemeralCache` ahorra el round-trip de un identificador ya bloqueado;
- si el keyspace crece sin techo, avisá — sería el TTL no aplicándose.

**Señal indirecta verificada:** las rutas Redis-only responden 200 en ~0.4 s en ambos
proyectos. Upstash está sano y el cliente acotado funciona.

---

## 6. Anomalía — Supabase caído, y **es anterior a Fase 0**

Todo lo que toca Supabase falla o cuelga; todo lo que sólo toca Redis responde en 0.4 s.
`/api/leaderboard` también hace timeout (25 s); `/api/hall-of-fame` responde 200.

**Fase 0 no lo introdujo.** El deployment **anterior** (6 h, pre-Fase 0) muestra el mismo
patrón: `/api/peones/balance` 500 ×6, `/api/welcome-pack/status` 500 ×6,
`/api/season-pass/status` 503 ×4, y las rutas Redis en 200. **Verificado.**

**Contraejemplo que no oculto:** `/api/profile/stats` es Supabase y devuelve 200 ×6, en
las dos ventanas. Así que no es "Supabase entero caído" — apunta a algo por tabla o por
ruta (`peones_ledger`, `welcome_pack_claims`, la del Season Pass), no a un outage global.
No lo diagnostico acá; esta tarea era validar Fase 0.

### Corrección: mi hipótesis del error rate estuvo mal DOS veces

1. ~~"Upstash saturado"~~ → refutada por tu consola.
2. ~~"429 reales por bucket compartido + CGNAT"~~ → **refutada por estos logs: no hay
   429, ni antes ni después.**

Lo que sostiene la evidencia: **los 15–19 % siempre fueron 500/503 de Supabase.** Encaja
con el baseline mucho mejor que cualquiera de mis dos hipótesis — los tres endpoints con
error alto (balance 17.4 %, welcome-pack 16.8 %, season-pass 18.7 %) son exactamente los
tres Supabase-pesados, y `/api/pro/status`, que es Redis puro, es el que **no** reportaba
errores. Los timeouts (~50 % en balance) son la misma causa.

El bucket compartido era real y valía arreglarlo. **No era la causa.**

---

## 7. Comparación preliminar contra baseline

| Métrica | Baseline | Post-deploy | Clasificación |
|---|---|---|---|
| balance — errors | 17.4 % | 500s persisten (Supabase) | **sin mejora, y no era arreglable por Fase 0** |
| welcome-pack — errors | 16.8 % | 500s persisten (Supabase) | ídem |
| pro/status — errors | 0 % | 0 % (200 ×19 entre ambos) | **VERIFICADO sin regresión** |
| 429 en los tres endpoints | asumido alto | **0**, y **0 también pre-deploy** | **VERIFICADO — la premisa era falsa** |
| redis_error | sin baseline | 0 | sin muestra suficiente |
| redis_timeout | sin baseline | 0 | sin muestra suficiente |
| keys de Upstash (~4.9K) | 4.9K | — | **no observable** |

---

## 8. Veredicto: **no aprobar Fase 1 todavía — investigar Supabase primero**

**Fase 0 no necesita rollback.** Está sana y verificada en lo que le corresponde: ambos
deployments Ready en el commit correcto, 6/6 smoke tests del guard OK, cero 429, cero
fallos de backend en el guard, `LOG_SALT` confirmado funcionando, y cero errores nuevos
respecto del deployment anterior.

Pero el orden de prioridades cambió. Hay un **defecto de producción vivo** que rompe
Peones, welcome pack y Season Pass — con 500/503 que los jugadores están viendo ahora
mismo, y que ya estaba antes de este deploy. Optimizar invocations mientras la escritura
del ledger falla es arreglar el costo de un flujo roto.

Recomiendo, en este orden:

1. **Investigar Supabase** — por qué `peones_ledger` / `welcome_pack_claims` / la tabla
   del Season Pass fallan mientras `score_saves` (profile/stats) responde. Candidatos:
   migración no aplicada, permisos/RLS, o límites del proyecto. Es una sesión aparte.
2. **Rehacer la validación de Fase 0 con tráfico real** una vez que Supabase esté sano —
   recién ahí `limited` / `redis_error` / `redis_timeout` significan algo.
3. **Después, Fase 1** (batching de telemetría). Sigue siendo el 66 % de las invocations
   y su valor no depende de lo anterior — pero tampoco es lo que más duele hoy.
