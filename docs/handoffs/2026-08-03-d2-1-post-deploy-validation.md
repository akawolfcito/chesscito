# D2.1 — validación post-deploy

**Fecha:** 2026-08-03/04 · **Commit:** `986bb383` · **Ventana:** ~3–6 min
**Veredicto: mantener.** Privacidad verificada. La reducción de escrituras **no es
separable del 522** con esta muestra — ver §4.

---

## 1. Deployments — VERIFICADO

| | chesscito | lite-chesscito |
|---|---|---|
| Deployment ID | `dpl_3Bff4CxEqfA3sX7WVdGtSc61bBJc` | `dpl_46vK7ZuXxZDZMA1FrK57tocpurQD` |
| Estado | ● Ready | ● Ready |
| Target | production | production |
| Alias | `play.chesscito.com` | `lite.chesscito.com`, `learn.chesscito.com` |
| Creado | 2026-08-03 21:29:15 −05 | 21:29:15 −05 |
| `deployment` en logs | `dpl_3Bff4Cx…` | `dpl_46vK7Zu…` |

`origin/main` = `origin/production` = `986bb383`, sin divergencia en ninguna dirección.

**Confirmación cruzada del commit:** el campo `deployment` que ahora emite `rpc_failed`
coincide con el ID de cada deployment. Es la primera vez en esta serie que puedo atar
código desplegado ↔ deployment desde la propia telemetría en vez de inferirlo de la rama.

---

## 2. Contrato y navegación — VERIFICADO

| Caso | play | lite |
|---|---|---|
| `?wallet=notawallet` | 400 `{"error":"invalid_wallet"}` | 400 idem |
| sin parámetro | 400 `{"error":"invalid_wallet"}` | 400 idem |
| wallet válida | timeout 30 s (522) | timeout 30 s (522) |

Contrato idéntico al documentado. Navegación: `/` 200, `/arena` 200, `/trophies` 200 en
ambos; `/exercises` 200 en lite y 307 en play (redirect de modo, correcto).

---

## 3. Logs de `/api/peones/balance` — VERIFICADO

Línea real de producción, tal cual:

```json
{ "level":"error", "msg":"rpc_failed",
  "wallet_hash":"0e48094b3b48789c",
  "operation":"peones_balance_with_caps",
  "code":null,
  "error_class":"html_gateway_error",
  "deployment":"dpl_3Bff4CxEqfA3sX7WVdGtSc61bBJc",
  "mode":"play" }
```

| Requisito | Resultado |
|---|---|
| Ninguna wallet cruda | **0 coincidencias de `0x[0-9a-f]{40}`** en TODOS los logs de ambos proyectos |
| Ninguna página HTML de Supabase | `/api/peones/balance` **no aparece** entre las rutas que vuelcan HTML |
| `error_class` acotado | `html_gateway_error`, del vocabulario de cinco |
| Sólo `wallet_hash` | 16 hex; la clave `"wallet":` no aparece **ni una vez** |

**`code: null` es informativo, no un defecto.** Confirma que la falla no viene de
PostgREST (que habría dado un código) sino del gateway. Sin `error_class`, un `code: null`
solo no diría nada — que es exactamente el vacío que D2.1 vino a llenar.

### ⚠️ Otras rutas SIGUEN volcando HTML (fuera del alcance de este commit)

| Ruta | play | lite |
|---|---|---|
| `/api/welcome-pack/status` | 10 | 8 |
| `/api/scores/session/challenge` | — | 6 |

No las toqué. El arreglo es el mismo patrón (`classifyDbError`), y conviene agruparlo con
la limpieza de las 7 wallets crudas ya reportadas (`peones/earn`, `peones/spend`,
`verify-payment`).

---

## 4. Escrituras a `peones_ledger` — **SIN MUESTRA CONCLUYENTE**

Acá tengo que ser preciso, porque el dato favorece a D2.1 y aun así no lo demuestra.

**Lo verificado:** ningún `peones_welcome_pack_seeded` ni `peones_welcome_pack_threw` en
la ventana → no se sembró nada → **cero INSERT intentados**.

**Lo que eso NO prueba:** con Supabase en 522, la **sonda también falla** → devuelve
`"unknown"` → la ruta salta el seed por la rama degradada. O sea, hoy habría cero INSERTs
*aunque el gate no existiera*, porque nada llega a la base. Las dos explicaciones —"el
gate funciona" y "todo está caído"— producen la misma señal.

Lo que sí queda demostrado del gate:

- por test, contra un ledger falso que implementa el `23505`: wallet recurrente **0
  INSERT**, wallet nueva **1**, y `[1,0,0,0,0]` sobre cinco lecturas seguidas;
- en producción, que la rama degradada **no** dispara escrituras contra una base que acaba
  de fallar una lectura — que era el otro objetivo de la sonda de tres valores.

**`POST /rest/v1/peones_ledger`: NO OBSERVABLE** desde mis herramientas. Eso vive en el
panel de Supabase. La comprobación definitiva es tuya, y recién tiene sentido **cuando el
522 se resuelva**: ahí, una wallet recurrente no debe generar ningún `POST` a esa tabla.

**Sin retries — VERIFICADO.** 4 requests distintos, 4 `rpc_failed`, **exactamente uno por
request**. (Cada línea aparece dos veces en el CLI: mismo `requestId` *y* mismo `id`, o
sea duplicado del API de logs, no un reintento. Lo verifiqué antes de afirmarlo.)

---

## 5. Errores

Deduplicado por `(requestId, source)`:

| | play PRE | play POST | lite PRE | lite POST |
|---|---|---|---|---|
| `/api/welcome-pack/status` 500 | 5 | 5 | 2 | 4 |
| `/api/peones/balance` 500 | 1 | **0** | 1 | 4 |
| `/api/season-pass/status` 503 | 0 | 0 | 2 | 3 |
| `/api/scores/session/challenge` 503 | 0 | 0 | 1 | 3 |
| **Total 5XX** | 6 | 5 | 6 | 14 |

**El salto en lite (6 → 14) no es una regresión de D2.1** y no lo voy a presentar como
mejora en play tampoco: las dos ventanas tienen distinta duración (2.9 min en play vs
5.6 min en lite) y distinto tráfico, y los mismos endpoints fallan por la misma causa —
`error_class: html_gateway_error` en todos. Es el 522 con más tráfico en la ventana de
lite, no algo nuevo.

**Errores nuevos: ninguno.** Ningún tipo de fallo aparece post-D2.1 que no estuviera
antes. Cero `supabase_unavailable` (el cliente se construye bien). Cero 5XX en rutas que
D2.1 no tocó y que antes estuvieran sanas.

---

## 6. Clasificación

| Dato | Estado |
|---|---|
| Deployments Ready con `986bb383` | **verificado** |
| `origin/main` = `origin/production` | **verificado** |
| Navegación intacta | **verificado** |
| Contrato de balance idéntico | **verificado** |
| Ninguna wallet cruda en logs | **verificado** (0 coincidencias) |
| Ningún HTML desde `balance` | **verificado** |
| `error_class` acotado | **verificado** |
| Sin retries | **verificado** |
| Errores nuevos | **verificado: ninguno** |
| Wallet recurrente → 0 INSERT | **sin muestra concluyente** (indistinguible del 522) |
| Wallet nueva → máx. 1 INSERT | **sin muestra suficiente** (no hubo wallets nuevas) |
| `POST /rest/v1/peones_ledger` | **no observable** (panel de Supabase) |
| 522 | **verificado, sigue activo** |

---

## 7. Qué queda

1. **El 522 sigue siendo el problema de fondo.** D2.1 y Fase 1 bajaron la presión; ninguno
   arregla la conexión gateway→origen ni el Disk IO budget.
2. **Re-verificar §4 cuando Supabase vuelva** — es el único momento en que "0 INSERT para
   wallet recurrente" es medible de verdad.
3. **Commit de higiene pendiente:** `classifyDbError` en `welcome-pack/status` y
   `scores/session/challenge`, más las 7 wallets crudas en `peones/earn`, `peones/spend`
   y `verify-payment`.
