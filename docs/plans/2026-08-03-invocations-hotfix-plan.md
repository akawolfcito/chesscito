# Plan de hotfix — invocations / Active CPU

Complemento de `docs/audits/2026-08-03-vercel-invocations-audit.md` (secciones **D** y **F**).
**Nada de esto está implementado.** Requiere tu OK antes de tocar código.

Regla transversal: **todo commit se despliega a los DOS proyectos** (`chesscito` = PLAY,
`lite-chesscito` = LEARN). Cada uno lleva su kill switch por env var, apagable sin redeploy
de código.

---

## D. Commits atómicos, en orden de impacto

### Fase 0 — Observabilidad y contención (antes de optimizar nada)

**D0.1 · `fix(peones): distinguir rate-limit real de fallo de Upstash`**
`api/peones/balance/route.ts:50-56` y `api/welcome-pack/status/route.ts:41-45`.
Hoy cualquier excepción del guard sale como `429 rate_limited`. Separar:
`RateLimitExceeded` → 429; cualquier otra → log con `reason` + **fail-open** (la lectura
de balance no es un endpoint de escritura; que Upstash esté caído no debe ocultarle el
saldo al jugador). Sin este commit no podemos afirmar cuál de las dos causas es.
→ *No reduce invocations. Es el que nos deja medir.*

**D0.2 · `fix(server): timeout explícito en el cliente de Upstash`**
`Redis.fromEnv({ signal / retry })` en `demo-signing.ts:20`, `is-active.ts:4`,
`season-pass/status/route.ts:46`. Un comando colgado hoy consume la función entera →
es la fuente directa del 3.7 % de timeouts y del ~50 % en `balance`.

**D0.3 · `chore(rl): bucket propio por endpoint en el limiter de lectura`**
`demo-signing.ts:34` — `rl:read:ip` es un único bucket 60/min/IP compartido por 14 rutas.
Prefijo por ruta (`rl:read:{route}:ip`). Elimina el efecto CGNAT sin subir el límite
global ni relajar la defensa de abuso.

---

### Fase 1 — Telemetría (el 66 % de las invocations)

**D1.1 · `feat(telemetry): cola en cliente con flush por tamaño/tiempo`**
`src/lib/telemetry.ts`. `track()` deja de hacer `fetch` y encola. Flush cuando:
20 eventos, 5 s de inactividad, o `visibilitychange → hidden` (`navigator.sendBeacon`,
que es lo que hoy resuelve `keepalive`). El throttle de 100/5 min se conserva tal cual.
**API pública de `track()` sin cambios** → los 227 call sites no se tocan.

**D1.2 · `feat(api): /api/telemetry acepta lote`**
Contrato retrocompatible: `{ session_id, event, ... }` (uno) **o** `{ events: [...] }`.
Retrocompatible a propósito: durante el rollout conviven clientes viejos cacheados.
Server-side: un `insert([...])` en vez de N; los upserts de `session_first_seen` /
`account_first_seen` se calculan **una vez por lote**, no por evento.

**D1.3 · `perf(api): telemetry responde 204 antes de escribir`**
Usar `waitUntil()` para las escrituras Supabase. Hoy la función se queda viva esperando
3 round-trips que nadie lee. Baja el Active CPU facturado por invocación.

**D1.4 · `chore(telemetry): kill switch NEXT_PUBLIC_TELEMETRY_BATCH_ENABLED`**
Default ON. Apagarlo revierte a 1-request-por-evento sin redeploy.

> Impacto esperado: 54K → ~3K invocations, ~10 min → ~1.5 min CPU.

---

### Fase 2 — Peones balance

**D2.1 · `fix(peones): sacar el welcome pack del camino de lectura`**
`api/peones/balance/route.ts:88`. Hoy hay un INSERT que falla con `23505` en **cada** GET
de todo usuario recurrente. Cambio: sembrar solo cuando la lectura demuestre que hace
falta — leer primero el `rpc`, y sembrar únicamente si el wallet no tiene ninguna fila.
Alternativa más barata: latch en Redis `welcome_pack:seeded:{wallet}` con `SET NX`.
**La regla de negocio no cambia**: sigue siendo 1 Peón, una sola vez, idempotente por el
índice único (que sigue siendo la garantía real).

**D2.2 · `perf(peones): balance en un solo round-trip`**
`rpc(peones_balance_with_caps)` + SELECT `peones_balances` → `Promise.all`, o mejor:
que la función SQL devuelva `last_event_at` (migración aditiva, sin cambio de contrato HTTP).

**D2.3 · `feat(peones): provider único de balance con TTL de 30 s`**
Hoy 4 componentes montan `usePeonesBalance` por su cuenta
(`peones-balance-chip`, `chesito-card`, `learn-hub-client:147`, `play-hub-client:57`).
Un `PeonesBalanceProvider` con dedupe por wallet + TTL 30 s. **El bus
`chesscito:peones-changed` sigue invalidando de inmediato** → un gasto confirmado mueve
el chip al instante, exactamente como hoy (esa es la invariante que el TTL no puede romper).

---

### Fase 3 — Bootstrap de estado por wallet

**D3.1 · `fix(shop): respetar la caché de 24 h del welcome pack`**
`use-welcome-pack-claim.ts:125-161`. La caché ya existe y el fetch se hace igual.
`claimed: true` es monotónico → cortar la request. Solo refetch si la caché dice
`claimed: false` o venció.

**D3.2 · `fix(founder): respetar la caché de founder-status`**
Mismo patrón, `use-founder-status.ts:78`.

**D3.3 · `perf(api): season-pass/status paraleliza sus 6 lecturas`**
`Promise.all` sobre `isProActive` / `readCachedExpiry` / `readSeasonPassRow` /
`readGateOverride`; `ensureFocusLedgerInitialized` + `countFocusDays` quedan en serie
(dependen del resultado). Cero cambio de contrato, cero cambio de semántica de acceso.

**D3.4 · `feat(api): GET /api/bootstrap?wallet= — un fetch por visita`**
Agrega en una respuesta: `pro`, `seasonPass`, `coachCredits`, `welcomePack`, `founder`.
Los endpoints individuales **se conservan** (los usan `refetch()` post-compra y post-claim,
que deben seguir siendo puntuales e inmediatos). Header `Cache-Control: private, max-age=30`.
→ *Este es el commit con más riesgo funcional del plan; va último y detrás de tests.*

**D3.5 · `perf(api): quitar cache:"no-store" de profile/stats`**
`use-profile-stats.ts:30` + `s-maxage=60` en la respuesta.

---

### Fase 4 — Cola

**D4.1 · `perf(og): cache inmutable`**
`s-maxage=31536000, immutable` en `api/og/exercise` y `api/og/endgame`. La imagen es
función pura de los query params. 3 s de CPU por render pasan a cobrarse una vez por URL.

**D4.2 · `perf(og): evitar el re-encode de sharp`** — si el post-procesado no es
imprescindible para el card, sacarlo; es la mitad de esos 3 s.

**D4.3 · `perf(coach): backoff en el polling del job`**
`coach-loading.tsx:81`. Único polling real del código. Intervalo creciente en vez de fijo.

---

## F. Pruebas que deben acompañar cada fase

Todas Vitest + RTL salvo donde se indique. Ninguna pinea contenido autorado.

| # | Afirmación a demostrar | Test | Fase |
|---|---|---|---|
| F1 | **La telemetría se agrupa** | `track()` × 20 con timers falsos ⇒ **1** `fetch` a `/api/telemetry` con `events.length === 20` | D1.1 |
| F2 | Ningún evento se pierde al cerrar | `visibilitychange → hidden` con la cola no vacía ⇒ `sendBeacon` llamado una vez con la cola completa | D1.1 |
| F3 | El contrato viejo sigue vivo | POST con `{session_id, event}` (sin `events`) ⇒ 204 + 1 fila insertada | D1.2 |
| F4 | **No existe polling accidental** | Source guard: fallar si aparece `setInterval` con un `fetch("/api/` dentro, o `refetchInterval` en cualquier `useQuery`, fuera de la allowlist `coach-loading.tsx` | D1 en adelante |
| F5 | **Un montaje = un bootstrap** | Montar hub → desmontar → montar exercises → volver al hub con timers falsos < TTL ⇒ **1** `fetch` a `/api/peones/balance` | D2.3 |
| F6 | El bus sigue mandando sobre el TTL | dentro del TTL, `dispatch("chesscito:peones-changed")` ⇒ refetch inmediato (**la invariante que protege el gasto de Peones**) | D2.3 |
| F7 | **Un 4XX no se reintenta** | mock 400/403/429 ⇒ exactamente 1 `fetch`, estado `error`, sin segundo intento (los seis hooks) | D0.3 / D3 |
| F8 | **El balance no se consulta repetidamente** | dos componentes que usan `usePeonesBalance` montados a la vez ⇒ **1** request | D2.3 |
| F9 | El balance dejó de escribir en cada lectura | mock de Supabase: segunda llamada a `GET /api/peones/balance` del mismo wallet ⇒ **0** `insert` sobre `peones_ledger` | D2.1 |
| F10 | El welcome pack sigue siendo idempotente y sigue llegando | wallet nuevo ⇒ exactamente 1 fila sembrada; wallet ya sembrado ⇒ 0 filas, balance correcto | D2.1 |
| F11 | La caché de 24 h corta la request | caché con `claimed:true` fresca ⇒ **0** fetch a `/api/welcome-pack/status` | D3.1 |
| F12 | **Las landing son estáticas** | Guard de build: `.next` no marca como dinámicas las rutas de landing/hub — assert sobre el build manifest, no sobre el runtime | D0 (regresión) |
| F13 | **OG devuelve cache headers** | GET a `/api/og/exercise` y `/api/og/endgame` ⇒ `cache-control` contiene `immutable` y `s-maxage=31536000` | D4.1 |
| F14 | Upstash caído ≠ 429 | mock del limiter que **lanza** (no que rechaza) ⇒ NO responde 429; responde el balance | D0.1 |
| F15 | Los buckets no se contaminan | agotar el bucket de `/api/pro/status` ⇒ `/api/peones/balance` sigue respondiendo 200 | D0.3 |

**No rompemos:** MiniPay (no se toca `enforceOrigin` ni el bypass sin `Origin`), wallet,
compras (los endpoints puntuales y sus `refetch()` post-tx quedan intactos), progreso,
Peones (el cap, el welcome pack y la idempotencia se mantienen y quedan cubiertos por
F9/F10), PRO y Season Pass (la resolución de entitlements no cambia; solo se paraleliza).

---

## Preguntas abiertas

1. **¿Upstash está saturado?** Es la confirmación que falta para C2 y decide si D0.1–D0.2
   bastan o si además hay que mover el rate-limiting fuera de Redis. Se contesta mirando
   el gráfico de uso de la consola de Upstash y filtrando los logs de Vercel por status
   en `/api/peones/balance` — no lo hice, es lectura de consola, no de código.
2. **¿`/api/bootstrap` (D3.4) entra en este hotfix o en un segundo tramo?** Es el commit
   de mayor riesgo funcional y el resto del plan ya alcanza el −80 %. Mi recomendación:
   **fases 0–2 + D3.1/D3.2/D3.3 ahora**, D3.4 después de medir.
3. ¿El `sharp` de las OG hace algo que el card necesita, o quedó de una iteración previa?
