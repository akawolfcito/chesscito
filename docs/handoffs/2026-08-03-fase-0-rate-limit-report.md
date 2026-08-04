# Fase 0 — reporte de entrega (D0.1 · D0.2 · D0.3)

**Fecha:** 2026-08-03 · **Estado:** implementado, verificado, **sin commit**.
No avancé a Fase 1. No toqué producción, ni keys, ni el plan de Upstash.

---

## 1. Baseline previo

| Métrica (12 h, ambos proyectos) | Valor |
|---|---|
| Invocations | 82K (55K CHESSCITO + 27K LITE) |
| Active CPU | ~19 min |
| Errors | 2.4 % / 3.5 % |
| Timeouts | 3.7 % / 3.0 % |
| `/api/peones/balance` | 5.9K inv · 17.4 % err · ~50 % timeouts recientes |
| `/api/welcome-pack/status` | 5.0K inv · 16.8 % err |
| `/api/season-pass/status` | 1.0K inv · 18.7 % err |
| Upstash (consola) | 140K/500K cmd/mes · 2–5 cmd/s · latencia ~0 ms · 4.9K keys |

Suite antes de tocar nada: **6827 tests / 577 archivos verdes** (la baseline de
`CLAUDE.md` decía 6515/552 — el repo creció desde entonces).

---

## 2. Root cause abordada

**Corrección importante:** mi hipótesis principal en la auditoría era "Upstash saturado".
**La consola la descarta** (28 % del plan, latencia ~0, sin conexiones agotadas). La
sección C2 del audit quedó reescrita con el error visible en vez de borrado.

Lo que Fase 0 ataca, en orden de importancia real:

1. **CAUSA (D0.3) — un solo bucket `rl:read:ip` de 60/min/IP para 14 rutas.** Con CGNAT
   móvil el presupuesto es por operador, no por jugador: un bootstrap son ~6 requests
   contra ese bucket, y diez jugadores detrás del mismo NAT lo agotan en un minuto. Los
   429 observados son **rate limits genuinos**.
2. **RIESGO LATENTE (D0.1) — todo fallo salía como 429.** `catch { return 429 }` no
   distingue "usuario pasado de cuota" de "Upstash no responde". Hoy no se dispara
   (Upstash sano), pero mientras exista, el próximo incidente vuelve a ser ilegible.
3. **RIESGO LATENTE (D0.2) — sin timeout, con escalera de reintentos.** El cliente
   heredaba `attempts: 5` + backoff `Math.exp(n)*50` = 6 fetches y ~4.3 s de sleep, sin
   abort. Un Upstash lento (no es el caso hoy) mataría la función entera.

**Sigue abierto, y no lo doy por resuelto:** `/api/season-pass/status` (18.7 %) **no usa
el read limiter** — su error es `503 entitlement_unavailable` / `400 invalid_wallet`, y
falta filtrar sus logs por status. Y los timeouts **no son de Redis** (latencia ~0): los
candidatos son las 3 queries secuenciales a Supabase de `balance` y los cold starts →
Fase 2.

---

## 3. Archivos modificados

**Nuevos (4)**

| Archivo | Qué es |
|---|---|
| `apps/web/src/lib/server/redis.ts` | Cliente Upstash compartido con presupuesto por comando y reintentos acotados; `isRedisTimeout`, `createTimeoutSignal` |
| `apps/web/src/lib/server/rate-limit.ts` | Buckets por endpoint, 4 outcomes, política explícita, instrumentación, identificador hasheado |
| `apps/web/src/lib/server/__tests__/redis.test.ts` | 8 tests |
| `apps/web/src/lib/server/__tests__/rate-limit.test.ts` | 25 tests |

**Modificados (41 en total; 4 líneas cada uno salvo indicado)**

- `lib/server/demo-signing.ts` — borra `readIpLimiter` y su `enforceReadRateLimit`; usa el cliente compartido. Los limiters estrictos (`rl:ip`, `rl:addr`) quedan intactos.
- `lib/server/logger.ts` — `hashIp()` con separador de dominio `"ip:"`.
- **14 rutas** con cambio de guard (ver §4).
- **14 módulos** migrados de `Redis.fromEnv()` al cliente acotado (`is-active`, `season-pass/status`, `coach/*`, `games/*`, `focus-day`, `verify-pro`, `welcome-pack/claim`, `shields/spend`, `[locale]/coach/[gameId]/page.tsx`, …). `cron/coach-purge` y `lib/coach/backfill` usan el perfil `"batch"`.
- **11 archivos de test** actualizados a los mocks nuevos.

`git diff --stat`: **41 archivos, +389 / −189**.

---

## 4. Política fail-open / fail-closed por endpoint

**FAIL-OPEN — lecturas de bajo riesgo** (un fallo del limiter sirve la request):

| Endpoint | Por qué es seguro |
|---|---|
| `/api/peones/balance` | Lectura. El único write que queda en el path (semilla del welcome pack) está protegido por el **índice único** en `idempotency_key` — el limiter nunca fue esa garantía. Se elimina en D2.1. |
| `/api/welcome-pack/status` | Lectura pura; `claimed` es monotónico. El **claim** sigue fail-closed. |
| `/api/pro/status` | Sólo LEE la key de PRO. Todo lo que **otorga** PRO sigue fail-closed. |
| `/api/founder-status` | Lectura on-chain detrás de un badge cosmético. |
| `/api/shields/me` | Lee el contador; `/api/shields/spend` sigue fail-closed. |
| `/api/coach/history` | Lectura del historial propio. |
| `/api/games/[id]` | Lee un registro; la autorización se chequea aparte. |

**FAIL-CLOSED — mutación, compra, reward, gasto** (un fallo del limiter rechaza):

`/api/coach/credits` ⚠️ *(GET, pero **siembra 3 créditos** con SETNX → es un reward)*,
`/api/peones/earn`, `/api/peones/spend`, `/api/verify-payment`,
`/api/verify-payment/get-peones-canary`, `/api/payment-intents/get-peones` (POST y PATCH).

Además: cuando `@upstash/ratelimit` decide fallar abierto por su cuenta
(`reason: "timeout"` → resuelve `success: true`), **la anulamos** en las rutas
fail-closed. Un endpoint de pago no hereda esa decisión del SDK.

---

## 5. Timeout compatible con el SDK instalado

Inspeccioné `@upstash/redis@1.37.0` y `@upstash/ratelimit@2.0.8` en
`node_modules/.pnpm/` — no usé APIs de memoria. Dos hallazgos deciden la implementación:

**(a) `signal` acepta una FÁBRICA, y sólo la fábrica falla honestamente.**
`RedisConfigNodejs.signal` es `AbortSignal | (() => AbortSignal)` y el cliente resuelve
`isSignalFunction ? signal() : signal` **una vez por `request()`**, antes del loop de
reintentos. Consecuencias:

- La fábrica da una señal fresca por comando → el presupuesto cubre el comando
  **incluyendo sus reintentos**. Un `AbortSignal` pelado se crearía una sola vez para
  toda la vida del cliente y el primer timeout lo envenenaría para siempre.
- Al abortar: `if (signal.aborted && isSignalFunction) throw` — **relanza**. Con la forma
  no-fábrica en cambio **fabrica un `200` con body `{ result: "Aborted" }`**: un timeout
  indistinguible de un valor real. Por eso va la fábrica, y hay un test que lo fija.

```ts
Redis.fromEnv({
  signal: () => createTimeoutSignal(1_500),          // 1.5 s por comando
  retry: { retries: 1, backoff: (n) => Math.min(100 * 2 ** n, 500) },
})
```

**(b) El default de retry era el amplificador.** `attempts: 5` con el loop
`for (i = 0; i <= attempts; i++)` = **6 fetches**, backoff `Math.exp(n)*50` = 50/136/369/
1004/2730 ms ≈ **4.3 s de sleep**. Bajado a `retries: 1` con backoff capado a 500 ms. No
a `false`: un error de socket transitorio contra un backend sano debe absorberse.

Dos perfiles: `"request"` (1.5 s) y `"batch"` (10 s, para cron/backfill, donde abortar
cuesta una corrida entera).

**Nota de testing:** `AbortSignal.timeout` corre sobre un timer interno de Node que los
fake timers de vitest **no** avanzan. Un test con fake timers habría pasado sin verificar
nada. Por eso el abort se prueba con timers reales sobre `createTimeoutSignal(5)`.

---

## 6. Comandos Redis por request (medido leyendo el bundle instalado)

`Ratelimit.slidingWindow(60, "60s")`, single-region. **Un `limit()` = 1 round-trip HTTP**
(`EVALSHA`; `EVAL` sólo en el fallback NOSCRIPT, o sea tras reinicio de Redis). Dentro del
script Lua, server-side:

| Caso | Round-trips | Ops internas |
|---|---|---|
| allowed | 1 | `GET` current, `GET` previous, `INCRBY` current, `PEXPIRE` **sólo en la primera del window** |
| blocked | 1 | `GET` current, `GET` previous, y **corta antes del INCRBY** → no crea key |
| cacheBlock | **0** | `ephemeralCache` responde en proceso a un identificador ya bloqueado |

Esto coincide con el mix que viste en la consola (GET, INCRBY, EVALSHA, PEXPIRE, EVAL) —
tu observación corrobora la lectura del SDK. **El limiter no es lo que hace caro a Redis.**

**Keys y TTL.** Forma nueva:

```
rl:read:{route}:ip:{sha256(ip + LOG_SALT)[0..16]}:{windowNumber}
```

El script hace `PEXPIRE currentKey, window*2 + 1000` = **121 s** en el primer incremento
de la ventana, así que **toda key `rl:*` expira**; un request bloqueado no crea key.
Guard agregado: un test lee el script del SDK instalado y falla si ese `PEXPIRE`
desaparece en un bump — un cambio así haría crecer el keyspace para siempre, en silencio.

**Hash del identificador (tu pedido).** Antes la IP cruda entraba en la key, así que
Upstash guardaba una lista viva de direcciones. Ahora entra un digest salado: el limiter
sólo necesita igualdad, nunca la dirección. **Salvedad deliberada:** si falta `LOG_SALT`,
`hashIp` devuelve el literal `"unsalted"` y usarlo colapsaría a **todos** los clientes en
un bucket — una versión peor del bug que estamos arreglando. Así que sin salt se cae a la
IP cruda y se emite un `log.error` ruidoso: la corrección **no depende de una env var**,
y la regresión de privacidad se ve en vez de degradar la disponibilidad. Hay test.

---

## 7. Tests agregados (33 nuevos)

Los 10 mínimos que pediste, todos cubiertos:

| Requisito | Dónde |
|---|---|
| Rate limit excedido → 429 | `rate-limit.test.ts` + tests de ruta de balance/welcome-pack/shields |
| Excepción de Upstash **no** se presenta como 429 | `rate-limit.test.ts` — `expect(outcome).not.toBe("limited")` |
| Lectura fail-open funciona con Redis caído | `rate-limit.test.ts` + `balance` sirve 200 con `outcome: redis_error` |
| Mutación protegida **no** se vuelve fail-open | `rate-limit.test.ts` — 7 rutas de mutación, incluida la anulación del fail-open del SDK |
| Cada endpoint usa un bucket independiente | `rate-limit.test.ts` — 14 prefijos únicos, y `not.toContain("rl:read:ip")` |
| Agotar `/api/pro/status` no bloquea `/api/peones/balance` | `rate-limit.test.ts` — limiter stub por prefijo |
| La key no expone la wallet/IP completa | `rate-limit.test.ts` — identificador hasheado + el log no contiene la IP |
| Timeout de Redis termina de forma acotada | `redis.test.ts` — abort real con timers reales, `TimeoutError` |
| No existen retries infinitos | `redis.test.ts` — `retries === 1`, backoff ≤ 500 ms para todo n |
| CGNAT: 14 rutas no comparten un bucket global | `rate-limit.test.ts` — una IP RFC 6598, 14 buckets distintos |

Extra: TTL guard sobre el script del SDK; sin salt no colapsa los buckets; el caso
`allowed` no se loguea por defecto; el fallo de backend **sí** se loguea.

---

## 8. Instrumentación

Una línea estructurada por guard no-trivial:

```json
{ "msg": "rate_limit_guard", "endpoint": "peones-balance",
  "outcome": "limited|allowed|redis_error|redis_timeout",
  "duration_ms": 12, "policy": "fail-open", "guard_status": 429,
  "identifier_hash": "a1b2c3d4e5f60718",
  "deployment": "dpl_…", "env": "production", "mode": "learn" }
```

**No se registra:** IP completa, wallet, tokens, cookies, firmas. Sólo digest salado.

**Muestreo:** `limited` / `redis_error` / `redis_timeout` se loguean **siempre** — son la
señal. `allowed` no se loguea por defecto (serían ~82K líneas/12 h, el mismo costo
por-evento que venimos a eliminar). `RATE_LIMIT_LOG_SAMPLE` (0..1) lo abre mientras medís.

---

## 9. Riesgos pendientes

1. **Las ventanas en vuelo se resetean una vez.** Cambian los prefijos y el identificador,
   así que al desplegar todos arrancan con presupuesto limpio. Efecto: un pico de
   permisividad de ≤60 s. Aceptable; no borra keys (las viejas expiran solas en 121 s).
2. **14 buckets × N IPs multiplican el keyspace** respecto de 1 bucket. Con TTL de 121 s
   y 4.9K keys actuales el techo sigue siendo despreciable contra 256 MB, pero conviene
   mirar el contador de keys tras el deploy.
3. **`/api/season-pass/status` sigue sin explicación** (18.7 %). No lo tocó esta fase.
4. **Los timeouts no están arreglados** — no eran de Redis. Fase 2 (D2.1/D2.2).
5. **`LOG_SALT` debe existir en los dos proyectos** o las keys vuelven a llevar IP cruda
   (con `log.error` visible). Verificar sin filtro de entorno: `vercel env ls` oculta
   filas scopeadas a Preview.
6. **Fase 0 no reduce invocations.** Es la fase que permite medir. La reducción llega en
   Fase 1.
7. El `timeout: 2000` del limiter queda por encima del presupuesto de Redis (1.5 s) a
   propósito, para que el abort gane y la falla se clasifique como `redis_timeout`. Si
   alguien baja el del limiter por debajo de 1.5 s, se pierde esa clasificación.

---

## 10. Estimación de impacto

**Invocations: 0 %.** Fase 0 no toca volumen — es observabilidad y contención.

**Errores:** los 429 por bucket compartido deberían caer de forma marcada. Con 14 buckets
la misma IP CGNAT necesita ~14× más tráfico concentrado para toparse. Estimación
conservadora: **17.4 % → 2–5 %** en `/api/peones/balance` y similar en
`/api/welcome-pack/status`. **No estimo `/api/season-pass/status`** — su error es otro y
esta fase no lo toca.

**Timeouts:** no espero mejora medible ahora (no eran de Redis). El presupuesto acotado
es un techo, no una cura.

**Comandos Upstash:** ligeramente **menos**, no más — `ephemeralCache` ahorra un
round-trip por request de un identificador ya bloqueado. El keyspace sube; el conteo de
comandos no.

**CPU:** sin cambio esperado (el guard ya era 1 round-trip).

---

## 11. Estado de git

Rama `main`, **sin commit, sin stage, sin push**.

- 41 archivos modificados (+389/−189), 4 nuevos sin trackear en `apps/web/src/lib/server/`.
- 3 docs sin trackear: el audit, el plan, y este reporte.
- `SESSION.md` aparece modificado **desde antes de esta sesión** — no lo toqué.

**Verificación ejecutada:**

| Comando | Resultado |
|---|---|
| `pnpm exec tsc --noEmit` | limpio, sin salida |
| `pnpm exec vitest run` | **6827 passed / 577 archivos**, `EXIT=0`, 0 `Unhandled Errors` |
| `pnpm build` | `BUILD EXIT=0` |

---

**Detenido acá.** No avanzo a Fase 1 (telemetría) sin tu aprobación.
