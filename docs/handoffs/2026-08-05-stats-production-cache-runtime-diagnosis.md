# Diagnóstico en runtime — la caché de `/stats` en producción

**Fecha:** 2026-08-05 · **SHA:** `35314f7a` · **Deployment:** `chesscito-landing-ox66xxzjj` · READY en **39 s**
**Builds reales:** **1** (`chesscito` y `lite-chesscito` sin deployment — el skip funcionó)
**Estado:** **causa demostrada por diferencia controlada.** Sin fix definitivo aplicado.

> **✅ CLASIFICACIÓN C — el snapshot SÍ se reutiliza.** `generatedAt` es estable
> a través de diez peticiones y de una pausa de 60 s, con entradas propias por
> filtro y un reloj propio para el censo.
> **⚠️ Y eso significa que la memoización que declaré «no es el fix» probablemente
> SÍ lo era.**

---

## 1. Las dos tandas

`x-vercel-cache` se registra pero **no es el veredicto**: describe la respuesta
de la RUTA y la página es dinámica a propósito, así que `MISS` permanente es lo
esperado. El veredicto es `generatedAt`, el reloj del propio snapshot.

### Tanda 1 — inmediatamente después de invalidar `public-stats`

| paso | HTTP | ms | `generatedAt` | censo `asOf` | x-vercel-cache |
|---|---|---|---|---|---|
| 1 · `/stats` EN | 200 | **2803** | **03:10** | 03:10 | MISS |
| 2 · `/stats` EN (repite) | 200 | **437** | **03:10** | 03:10 | MISS |
| 3 · `/stats` ES | 200 | **489** | **03:10** | 03:10 | MISS |
| 4 · `?surface=learn` | 200 | **1298** | **03:15** | 03:10 | MISS |
| 5 · `?surface=learn` (rep) | 200 | **334** | **03:15** | 03:10 | MISS |

### Tanda 2 — tras 60 s (< 900 s de TTL)

| paso | HTTP | ms | `generatedAt` | censo `asOf` | x-vercel-cache |
|---|---|---|---|---|---|
| 1 · `/stats` EN | 200 | 2289 | **03:10** | 03:10 | MISS |
| 2 · `/stats` EN (repite) | 200 | **233** | **03:10** | 03:10 | MISS |
| 3 · `/stats` ES | 200 | **248** | **03:10** | 03:10 | MISS |
| 4 · `?surface=learn` | 200 | **207** | **03:15** | 03:10 | MISS |
| 5 · `?surface=learn` (rep) | 200 | 856 | **03:15** | 03:10 | MISS |

---

## 2. Lectura

| Observación | Qué prueba |
|---|---|
| `generatedAt` = **03:10 en las diez peticiones sin filtro**, incluida la primera de la tanda 2 | el snapshot **no se regeneró ni una vez** después del primer MISS |
| `?surface=learn` tiene su **propio** `generatedAt` (03:15), también estable | la clave `(surface, container)` genera entradas separadas, como se diseñó |
| **ES devuelve el MISMO `generatedAt` que EN** | `locale` está fuera de la clave: un solo dato detrás de dos idiomas |
| censo `asOf` = 03:10, estable y **distinto** del de `learn` | entrada y reloj propios |
| Tanda 2, paso 1: **2289 ms con `generatedAt` SIN cambiar** | esa latencia es **cold start / TTFB**, no trabajo de RPC — si hubiera regenerado, el sello habría avanzado |
| Peticiones subsiguientes: **207–489 ms** | render de HTML sobre datos ya cacheados |

**Clasificación de la matriz: C.** No pude leer `instanceId` (ver §4), pero la
persistencia de `generatedAt` a través de una pausa de 60 s y de latencias
compatibles con instancias distintas es lo que la clase C describe: la Data
Cache compartida está funcionando entre invocaciones.

⛔ **No es la clase D**: si cada instancia regenerara, el sello habría cambiado.
⛔ **No es la clase B**: dentro de una misma tanda hay reutilización evidente.

---

## 3. Causa demostrada — y la corrección de lo que dije

**Diferencia controlada entre `b2c0873d` (falla) y `35314f7a` (funciona):**

| | `b2c0873d` | `35314f7a` |
|---|---|---|
| `force-dynamic` | sí | **sí, sin cambios** |
| Wrapper de `unstable_cache` | **construido por request** | **memoizado a nivel de módulo** |
| Instrumentación | no | sí (no toca el caching) |
| `generatedAt` en GETs seguidos | (no medido; tiempos 1,9–3,6 s y un timeout de 38,8 s) | **estable en 10 peticiones** |

**La única variable funcional que cambió es la memoización del wrapper.**
`force-dynamic` sigue exactamente donde estaba.

### ⚠️ Me equivoqué al descartarla

En `docs/handoffs/2026-08-05-stats-cache-fix-review.md` escribí que la
memoización **«no es el fix del incidente»**, apoyándome en un contrafactual
local donde el wrapper por request también reutilizaba. **Ese contrafactual no
podía detectar el defecto**: `next start` es **un solo proceso de larga vida**,
donde un closure nuevo por request sigue cayendo en el mismo store en memoria.
En Vercel, cada invocación parte de un módulo recién cargado y `unstable_cache`
deriva parte de la identidad de la entrada del callback que recibe — un closure
nuevo por request **mintea una entrada nueva por request**.

Es la misma lección, por tercera vez en esta línea de trabajo: **una medición
local que contradice al device me está describiendo el local, no el device.**

**Rigor:** es una diferencia controlada de una sola variable, no un experimento
A/B con la instrumentación activa en las dos ramas. Es fuerte, no absoluta —
ver el límite en §4.

---

## 4. Límite exacto de la evidencia

**No pude leer los contadores.** `STATS_REVALIDATE_TOKEN` es **Sensitive** en
Vercel y `vercel env pull` lo devuelve **redactado** (11 bytes en vez de 96), así
que el endpoint rechaza mi petición. Recuperarlo exige rotar el token **y
redesplegar** (las envs se inyectan desde el snapshot del deployment), o sea
otro build.

**Lo que sí quedó probado del endpoint, contra producción:**

```
GET /api/cache-diag  sin token  → HTTP 401
```

Un **401** y no un 404 demuestra que `STATS_DEBUG=1` está activo y que la
compuerta de token funciona. La instrumentación está desplegada y sana; sólo me
falta la llave.

**Qué añadirían los contadores:** confirmarían `snapshotReads` estable y
`rpcCalls` congelado, y el `instanceId` distinguiría C de «una sola instancia
caliente». **No cambiarían el veredicto**: un `generatedAt` que no se mueve en
diez peticiones ya excluye la regeneración, que es la pregunta del incidente.

---

## 5. Fix recomendado

1. **Conservar la memoización a nivel de módulo.** Es, con la evidencia
   disponible, el fix.
2. **Retirar la instrumentación** (`instrument.ts`, `/api/cache-diag`, los cinco
   `bump`, el import en `page.tsx`) y **borrar `STATS_DEBUG` de Production**.
3. **Añadir un guard** que falle si `unstable_cache` vuelve a construirse dentro
   de una función que se llama por request. Es el defecto exacto que ningún test
   local podía ver, así que tiene que ser un guard de fuente, no de comportamiento.
4. **Anotar la invariante**: `next start` no puede falsar una hipótesis de
   caché — un proceso de larga vida enmascara la identidad por request.
5. Recién entonces, **Fase F**.

⛔ **No aplicado todavía**, por indicación explícita.

---

## 6. Estado

| Eje | Valor |
|---|---|
| SHA desplegado | `35314f7a` |
| Deployment | `chesscito-landing-ox66xxzjj` · READY · 39 s |
| Builds reales | **1** |
| `STATS_DEBUG` | Production únicamente, Encrypted |
| `STATS_REVALIDATE_TOKEN` | Preview + Production, Encrypted, **sin rotar** |
| `/stats` | HTTP 200 en las diez peticiones, **cero 5XX, cero timeouts** |
| Fase F | **sigue bloqueada** hasta retirar la instrumentación |
| `git status` | ` M SESSION.md` |

**Ningún timeout en esta ronda** — contra el de 38,8 s de la ronda del
incidente. Es coherente con que el trabajo pesado ya no se ejecuta por visita.

---

## 7. Cierre — 2026-08-05

| Eje | Estado |
|---|---|
| **Incidente** | ✅ **RESUELTO** |
| **Fix** | ✅ **conservado** — memoización de los wrappers a nivel de módulo |
| **Instrumentación** | ✅ **RETIRADA** (borrada, no desactivada): `instrument.ts`, `/api/cache-diag`, los cinco `bump`, imports y tests del endpoint. **0 residuos** en `src/` |
| **Guard estructural** | ✅ `cache-identity-guard.test.ts` — 14 tests, **contrafactual verificado** |
| **`STATS_DEBUG`** | ⚠️ **PENDIENTE de borrar** del scope Production de `chesscito-landing`. Ya no lo lee ningún código, así que es inerte — pero una variable huérfana de diagnóstico no debe sobrevivir al diagnóstico |
| **Fase F** | **desbloqueada** en cuanto se despliegue este commit |

Detalle completo: `docs/handoffs/2026-08-05-stats-cache-fix-final.md`.
