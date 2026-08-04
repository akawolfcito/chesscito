# Auditoría read-only — consumo de Vercel (invocations / Active CPU)

**Fecha:** 2026-08-03 · **Alcance:** `apps/web` (deployado dos veces: `chesscito` = PLAY, `lite-chesscito` = LEARN)
**Estado:** solo lectura. Nada implementado. Nada cambiado.
**Ventana observada:** 12 h · 82K invocations · ~19 min Active CPU · 2.4–3.5 % errors · 3–3.7 % timeouts

---

## 0. Lectura de primer orden

Los endpoints listados por Vercel **suman el total**:

```
CHESSCITO  38.0 + 4.1 + 3.5 + 2.9 + 2.6 + 1.8 + 1.2 + 1.0 = 55.1K  ≈ 55K reportado
LITE       16.0 + 1.8 + 1.5 + 1.0 + 1.2 + 1.3 + 0.02      = 22.8K  (+ cola ≈ 27K)
```

Consecuencia importante: **el 100 % del consumo son Route Handlers**. Las páginas
(`/`, `/exercises`, `/arena`, hub) no aparecen → ya se sirven estáticas/prerenderizadas
y el middleware (`src/middleware.ts:76`, matcher que excluye `api|_next|_vercel|dev|lite-debug|*.*`)
no está generando volumen relevante. **No hay nada que arreglar del lado de rendering.**

Todo el problema está en **cuántas requests dispara el cliente** y en **cuántos
round-trips externos hace cada request**.

Reparto real:

| Bloque | Invocations 12 h | % | Active CPU |
|---|---|---|---|
| Telemetría (1 request por evento) | **54K** | **66 %** | ~10 min (53 %) |
| Status reads por wallet (balance, welcome-pack, pro, season-pass, founder, credits, victories, stats) | ~22K | 27 % | ~5 min |
| Resto (games, og, etc.) | ~6K | 7 % | ~4 min |

---

## A. Mapa de llamadas

### A.1 Telemetría (el 66 %)

```
CUALQUIER pantalla
  └─ track(event, props)                    src/lib/telemetry.ts:40
       └─ 1 × fetch POST /api/telemetry      (keepalive, sin batching)  telemetry.ts:59
            └─ Supabase insert analytics_events                 route.ts:124
            └─ Supabase upsert session_first_seen  (si app_opened)      route.ts:136
            └─ Supabase upsert account_first_seen  (si hay wallet)      route.ts:154
```

- **227 call sites** de `track()` en el bundle.
- 1 evento = 1 invocation = **1–3 escrituras Supabase secuenciales** (`await` encadenados).
- El throttle existente (`THROTTLE_MAX = 100` por evento / 5 min, `telemetry.ts:22`) es
  una defensa contra render-loops, **no** un agrupador: 100 eventos distintos = 100 requests.
- `app_opened` sí está bien acotado (`analytics-boot.tsx:15`, guard en sessionStorage).
- Eventos de impresión que se disparan por render y son los que multiplican:
  `hub_view`, `play_hub_view`, `arena_select_view`, `splash_view`, `hub_tour_view`,
  `monetization.pro_chip_view`, `monetization.pro_sheet_view`, `monetization.shop_item_view`
  (por ítem), `tx_progress_view`, `tx_progress_step` (por paso), `coach_history_unanalyzed_view`.

**38K eventos en CHESSCITO / 12 h no son 38K sesiones: son ~25–45 eventos por visita.**

### A.2 Status reads por wallet

```
/hub (LEARN)   learn-hub-client.tsx
  ├─ usePeonesBalance()          → GET /api/peones/balance      → Upstash ×1 + Supabase ×3
  ├─ useProStatus(address)       → GET /api/pro/status          → Upstash ×1
  └─ useLearnFocusDays()         → GET /api/season-pass/status  → Upstash ×3 + Supabase ×3

/hub (PLAY)    play-hub-client.tsx
  ├─ usePeonesBalance()          → GET /api/peones/balance
  └─ use-play-hub-data.ts:34     → GET /api/my-victories

/exercises     exercises-screen.tsx
  ├─ useSeasonPassStatus(address)  :436  → GET /api/season-pass/status
  ├─ useCoachCredits()             :536  → GET /api/coach/credits     → Upstash
  ├─ useWelcomePackClaim()        :1507  → GET /api/welcome-pack/status → Upstash + Supabase
  └─ <PeonesBalanceChip/>                → GET /api/peones/balance

/arena         app/[locale]/arena/page.tsx
  ├─ useProStatus()   :153   → /api/pro/status
  └─ useCoachCredits():168   → /api/coach/credits

account-sheet  → useFounderStatus()  → /api/founder-status
profile-sheet  → useProfileStats()   → /api/profile/stats  (cache: "no-store")
trophies       → trophies-data-provider.tsx:108 → /api/my-victories
```

**Ningún dato de estos se comparte entre pantallas.** Cada hook es un `useEffect` +
`fetch` propio (salvo `useProStatus`, que sí usa React Query). El QueryClient
(`wallet-provider.tsx:27`) tiene `staleTime: 30_000` y `refetchOnWindowFocus: false`
— **bien configurado**, pero solo cubre `useProStatus`; los otros seis hooks lo ignoran.

Resultado: navegar hub → exercises → hub dispara **3 bootstraps completos**.

### A.3 Dependencia externa compartida

**Todos** los endpoints con error alto tocan Upstash:

| Endpoint | Upstash | Supabase |
|---|---|---|
| `/api/peones/balance` | `readIpLimiter.limit()` (sliding window = varios comandos) | INSERT welcome-pack + `rpc(peones_balance_with_caps)` + SELECT `peones_balances` = **3** |
| `/api/welcome-pack/status` | `readIpLimiter.limit()` | 1 |
| `/api/season-pass/status` | `redis.get` pro + `redis.get` seasonPass + `redis.get` gate = **3** | `readSeasonPassRow` + `ensureFocusLedgerInitialized` + `countFocusDays` = **3** |
| `/api/pro/status` | `readIpLimiter` + `isProActive` = 2 | 0 |
| `/api/coach/credits` | `readIpLimiter` + credits | — |

---

## B. Tabla por endpoint

| Endpoint | Call sites | Trigger | Retries | Polling | Externas | Cacheable | Riesgo funcional | Solución |
|---|---|---|---|---|---|---|---|---|
| `/api/telemetry` | 227 `track()` | cada evento UI | no | no | 1–3 Supabase secuenciales | no (write) | **bajo** — es fire-and-forget, nadie lee la respuesta | **Batch en cliente** (cola + flush por tiempo/tamaño + `sendBeacon` en `visibilitychange`) y **bulk insert** server-side |
| `/api/peones/balance` | `peones-balance-chip`, `chesito-card`, `learn-hub-client:147`, `play-hub-client:57` | mount + wallet change + bus `chesscito:peones-changed` | no | no | 1 Upstash + **3 Supabase** | sí, 15–30 s por wallet | **medio** — es la economía visible | Provider único por wallet + TTL 30 s en cliente; sacar el INSERT del welcome-pack del camino de lectura |
| `/api/welcome-pack/status` | `use-welcome-pack-claim.ts:138` | mount de `/exercises` | no | no | 1 Upstash + 1 Supabase | **sí, 24 h — la caché YA existe y no se respeta** | bajo (`claimed` es monotónico) | Cortocircuitar el fetch cuando la caché dice `claimed: true` |
| `/api/season-pass/status` | `use-season-pass-status:149`, `use-learn-focus-days:97` | mount `/exercises` + mount hub LEARN | no | no | **3 Upstash + 3 Supabase secuenciales** | sí, 60 s | **alto** — decide acceso | Un solo provider; paralelizar `Promise.all` las lecturas independientes |
| `/api/pro/status` | `use-pro-status:79`, `use-coach-analysis:170`, arena | mount + wallet change | `retry: false` ✅ | no | 2 Upstash | sí, 60 s | alto (monetización) | Plegar en bootstrap; conservar `refetch()` post-compra |
| `/api/my-victories` | `use-play-hub-data:34`, `trophies-data-provider:108` | mount hub PLAY + mount trofeos | no | no | Supabase | sí, 60 s | bajo | Compartir provider entre hub y trofeos |
| `/api/founder-status` | `use-founder-status:78` | mount de account-sheet | no | no | Upstash + chain | **sí, permanente** (ya tiene caché localStorage) | bajo | Respetar la caché sin refetch |
| `/api/coach/credits` | `use-coach-credits:89`, `use-coach-analysis:195`, arena, coach/history | mount ×4 | no | no | Upstash | sí, 30 s | medio | Plegar en bootstrap |
| `/api/profile/stats` | `use-profile-stats:30` (`cache:"no-store"`) | apertura de profile-sheet | no | no | Supabase | sí, 60 s | bajo | Quitar `no-store`, `s-maxage=60` |
| `/api/og/exercise` · `/api/og/endgame` | meta tags de share | crawler | — | no | `ImageResponse` + `sharp` + fuentes | **sí, inmutable** (`s-maxage=3600` hoy) | ninguno | `s-maxage=31536000, immutable` + evitar el re-encode de `sharp` |
| `/api/coach/job/[id]` | `coach-loading.tsx:81` | **`setInterval` real** | — | **sí** | — | no | medio | Es el ÚNICO polling del código; acotado al análisis del coach. Bajar cadencia / backoff |

**Polling encontrado:** exactamente uno (`coach-loading.tsx:81`). No hay `refetchInterval`
en ningún `useQuery`. No hay `router.refresh()` en bucle. No hay retries automáticos en
4XX (`useProStatus` tiene `retry: false`; el resto no reintenta). **El volumen NO viene
de polling — viene de remounts y de telemetría por evento.**

---

## C. Root causes ordenadas por impacto

### C1 — Telemetría sin batching: 1 request HTTP por evento (66 % de las invocations)
`src/lib/telemetry.ts:59`. Cada `track()` abre su propio POST. El servidor encadena
hasta 3 escrituras Supabase con `await` secuencial (`api/telemetry/route.ts:124,136,154`).
**54K invocations + ~10 min de CPU por datos que nadie lee en tiempo real.**

### C2 — CORREGIDA (2026-08-03, consola de Upstash): los 429 son REALES — bucket compartido + CGNAT

> **La versión original de esta sección decía "Upstash es el punto único de falla". Es FALSO.**
> El founder revisó la consola: 140K/500K comandos mensuales (28 %), pico diario 140K,
> 2–5 cmd/s, service latency ~0 ms, 1 MB/256 MB, 4.9K keys, sin conexiones agotadas.
> **No hay saturación.** Dejo el error escrito en vez de borrarlo porque cambia qué
> significa la Fase 0: el enmascaramiento se arregla igual, pero como **defensa**, no
> como causa.

La causa real de los 15–19 % es que **esos 429 son rate limits genuinos**:

- `readIpLimiter` era **un solo bucket de 60/min/IP compartido por 14 rutas**
  (`demo-signing.ts:34`), keyed por `x-forwarded-for` (`demo-signing.ts:196`).
- MiniPay corre sobre datos móviles con **CGNAT**: muchos jugadores comparten una IP de
  salida. El presupuesto termina siendo **por operador, no por jugador**.
- Un bootstrap son ~6 requests contra ese bucket y `/exercises` suma otras 4. Diez
  jugadores detrás del mismo NAT agotan los 60/min sin que ninguno haga nada anormal.
- El volumen global (~20K req/12 h sobre el bucket ≈ 28/min) **no** explica un 17 % por
  sí solo — sólo lo explica concentrado en pocas IPs. Que es justo lo que hace el CGNAT.

**Sigue siendo cierto, reclasificado de causa a riesgo latente:** el código no distingue
un rate limit de un fallo de Upstash. El bug de diagnóstico está en
`api/peones/balance/route.ts:50-56`:

```ts
try {
  enforceOrigin(req);
  await enforceReadRateLimit(getRequestIp(req));
} catch (e) {
  return NextResponse.json({ error: "rate_limited" }, { status: 429 });
}
```

Ese `catch` no distingue **"el usuario excedió 60/min"** de **"Upstash devolvió error o
no respondió"**. Igual en `welcome-pack/status/route.ts:41-45`. Con 4.2K comandos de
Upstash en 12 h solo desde `balance` (más pro, credits, season-pass ×3, shields…), la
saturación del plan de Upstash produce exactamente el patrón observado:

- errores que **suben juntos** en endpoints sin nada más en común,
- **timeouts al ~50 %**: el cliente `Redis.fromEnv()` no configura timeout ni
  `AbortSignal`, así que un comando colgado agota la función entera.

El mecanismo, verificado contra los SDKs instalados: `@upstash/ratelimit@2.0.8` corre la
lectura contra su propio `timeout` de 5 s y **resuelve** `{ success: true, reason:
"timeout" }` al vencer; pero `@upstash/redis@1.37.0` reintenta 6 veces con backoff
`Math.exp(n)*50` y termina **rechazando** a ~4.3 s, justo antes de esa carrera. El reject
llegaba al `catch` y salía como 429. Con Upstash sano ese camino no se dispara — por eso
no explica el incidente, y por eso conviene cerrarlo antes de que sí pase.

**Costo real del guard** (leído del bundle instalado, coincide con el mix de comandos de
la consola — GET/INCRBY/EVALSHA/PEXPIRE/EVAL): `slidingWindow(60,"60s")` single-region
hace **1 round-trip por request** (`EVALSHA`; `EVAL` sólo en el fallback NOSCRIPT).
Dentro del script: `allowed` → GET+GET+INCRBY (+PEXPIRE sólo en la primera del window);
`blocked` → GET+GET y corta antes del INCRBY, **sin crear key**; con `ephemeralCache`
un reincidente cuesta **0 round-trips**. El limiter no es lo que hace caro a Redis.

**TTL**: el script hace `PEXPIRE currentKey, window*2 + 1000` (121 s) en el primer
incremento de cada ventana, así que toda key `rl:*` expira. Hay un guard de source en
`rate-limit.test.ts` que lee el script instalado y falla si ese PEXPIRE desaparece.

**Lo que esta corrección deja ABIERTO** — no darlo por resuelto:

- **`/api/season-pass/status` (18.7 %) no usa el read limiter.** Su error es otro:
  `503 entitlement_unavailable` cuando `isProActive` tira, o `400 invalid_wallet`.
  Sin explicar hasta filtrar sus logs por status.
- **Los timeouts (3.7 % global, ~50 % en balance) no son de Redis** — con latencia ~0 ms
  no puede serlo. Candidatos: las **3 queries secuenciales a Supabase** de `balance`
  (incluido el INSERT que choca con el índice único, C3) y los cold starts. Fase 2.

### C3 — `/api/peones/balance` escribe en cada lectura
`route.ts:88` → `ensurePeonesWelcomePack()` hace un **INSERT en `peones_ledger` en cada
GET**, que para todo usuario recurrente falla con `23505` y se descarta
(`welcome-pack-server.ts:118`). Es 1 de cada 3 llamadas a Supabase del endpoint
(12K/3.8K ≈ 3.2 confirma: INSERT + rpc + SELECT) y un conflicto de índice único por
lectura. **Endpoint documentado como "READ-ONLY" que escribe siempre.**

### C4 — Sin caché compartida de estado por wallet: cada montaje = bootstrap completo
Seis hooks independientes con `useEffect` + `fetch`, sin React Query, sin provider, sin
`Cache-Control`. hub → exercises → hub = 3 bootstraps. `use-profile-stats.ts:30` pide
explícitamente `cache: "no-store"`.

### C5 — Cachés de cliente que existen pero no cortan la request
`use-welcome-pack-claim.ts:125-161`: lee la caché de 24 h, la pinta… y **hace el fetch
igual**. Mismo patrón en `use-founder-status`. El dato es monotónico (`claimed` nunca
vuelve a `false`) → la request es evitable al 100 % después del primer claim.

### C6 — `/api/season-pass/status`: 6 round-trips externos en serie
`isProActive` → `readCachedExpiry` → `readSeasonPassRow` → `readGateOverride` →
`ensureFocusLedgerInitialized` → `countFocusDays`. Ninguno paralelizado. Además emite un
`log.info` por respuesta con pase activo (`route.ts:160`).

### C7 — OG: 3 s de Active CPU por imagen, cacheada solo 1 h
22 invocations = 60 s de Active CPU (5 % del presupuesto de LITE con el 0.08 % del
tráfico). `ImageResponse` + `sharp` + carga de fuente Cinzel. La imagen es **función pura
de los query params** → puede ser `immutable`.

### C8 — Duplicación LEARN/PLAY
`chesscito` y `lite-chesscito` son el mismo `apps/web` desplegado dos veces. El switch
del landing manda al usuario de un proyecto al otro y **cada proyecto rehace su propio
bootstrap completo** (balance, pro, welcome-pack se repiten en ambos: 4.1K+1.8K,
3.5K+1.5K, 2.9K+1.3K). No es un bug, pero duplica el costo de cada corrección: **todo fix
tiene que shipear a los dos proyectos**.

### C9 — Un polling real (menor)
`coach-loading.tsx:81`, `setInterval` sobre `/api/coach/job/[id]`. Acotado al análisis del
coach y con timeout (`:97`). No explica el volumen, pero conviene backoff.

---

## E. Estimación conservadora

| Frente | Antes (12 h) | Después | Δ |
|---|---|---|---|
| `/api/telemetry` | 54.0K | 3.0K | −94 % |
| `/api/peones/balance` | 5.9K | 1.2K | −80 % |
| `/api/welcome-pack/status` | 5.0K | 0.6K | −88 % |
| `/api/pro/status` + `season-pass` + `credits` + `founder` + `stats` + `victories` (bootstrap plegado) | 12.5K | 3.0K | −76 % |
| Resto | 4.6K | 4.0K | −13 % |
| **Total invocations** | **82K** | **≈ 11.8K** | **−85 %** |

Con margen: **−80 % garantizado, −85 % esperado.**

**Active CPU** (~19 min → ~4.5 min, **−76 %**):

- telemetría 10 min → 1.5 min (un insert bulk por lote en vez de 1–3 por evento);
- balance 1.7 min → 0.4 min (se elimina el INSERT por lectura + menos invocations);
- season-pass 0.7 min → 0.25 min (paralelizar las 6 lecturas);
- OG 1 min → ~5 s (`immutable` + sin re-encode);
- el resto baja proporcional a las invocations.

**Llamadas externas:** Supabase de `balance` 12K → ~2.4K (−80 %). Upstash total ≈ 25K → ~5K,
que es lo que apaga C2 de raíz.

**Sin tocar reglas de negocio:** el cap diario, el welcome pack, los precios, el gate de
Focus Days, los shields y la resolución de entitlements quedan idénticos. Lo único que
cambia es *cuándo se pregunta* y *cuántos round-trips cuesta responder*.
