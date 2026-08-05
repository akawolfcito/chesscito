# Fix de caché de `/stats` — diagnóstico local

**Fecha:** 2026-08-05 · **Rama local:** `fix/stats-cache` (base `b2c0873d`)
**Estado:** **causa raíz NO demostrada.** El entorno local **no reproduce** el fallo.
**Sin commit, sin push, sin deploy.**

> ⛔ **`force-dynamic` NO era la causa** — medido, no supuesto.
> ⛔ **El wrapper por request tampoco** — medido.
> **Las dos hipótesis fallaron. `next start` local reutiliza la caché en las dos
> configuraciones, así que el fallo vive en el runtime de producción y no en
> este código.**

---

## 1. La instrumentación

`x-vercel-cache` describe la respuesta de la RUTA, no `unstable_cache`, y la
página es dinámica a propósito: un `MISS` permanente ahí es lo esperado aunque
el snapshot se reutilice perfectamente. **Los tiempos tampoco sirven**: una
instancia caliente y una caché sana se ven igual desde afuera.

Así que se cuenta. `src/lib/stats/instrument.ts` (temporal, gated en
`STATS_DEBUG=1`) cuenta **renders**, **ejecuciones reales del snapshot**,
**RPC**, **bloques on-chain** y **lecturas de censo**, más un `instanceId`
aleatorio por instancia de módulo — para distinguir «caché rota» de «instancia
distinta con memo frío». Ningún contador toca un secreto, una wallet, un
`account_ref`, un `session_id` ni un valor de resultado.

El `generatedAt` se lee del **HTML servido**: dos requests que comparten ese
sello están leyendo la misma foto.

---

## 2. Los dos experimentos — y los dos fallan en reproducir

### A · CON `force-dynamic`, wrapper memoizado a nivel de módulo

```
GET 1 (EN)              200  2113ms  generatedAt=02:43  snapshotReads=1 rpc=11 onchain=1 census=1
GET 2 (EN, esperado HIT) 200    22ms  generatedAt=02:43  snapshotReads=1 rpc=11 onchain=1 census=1
GET 3 (ES)              200    25ms  generatedAt=02:43  snapshotReads=1 rpc=11 onchain=1 census=1
GET 4 (?locale=en)      200    22ms  generatedAt=02:43  snapshotReads=1 rpc=11 onchain=1 census=1
VEREDICTO: CACHÉ REUTILIZADA ✅
```

### B · CONTRAFACTUAL: wrapper POR REQUEST, exactamente como en `b2c0873d`

```
GET 1 (EN)              200  1902ms  generatedAt=02:44  snapshotReads=1 rpc=11 onchain=1 census=1
GET 2 (EN, esperado HIT) 200    28ms  generatedAt=02:44  snapshotReads=1 rpc=11 onchain=1 census=1
GET 3 (ES)              200    25ms  generatedAt=02:44  snapshotReads=1 rpc=11 onchain=1 census=1
GET 4 (?locale=en)      200    24ms  generatedAt=02:44  snapshotReads=1 rpc=11 onchain=1 census=1
VEREDICTO: CACHÉ REUTILIZADA ✅
```

**En las dos configuraciones, con `force-dynamic` puesto:**

| Medición | GET 1 | GET 2–4 |
|---|---|---|
| RPC | **11** | **0** |
| on-chain | 1 | **0** |
| censo | 1 | **0** |
| `generatedAt` | 02:43 | **el mismo** |
| render | sí | sí (4 renders, 1 sola lectura) |

`instanceId` estable en las cuatro peticiones → **un solo proceso**, así que el
hit no se explica por una instancia caliente distinta.

---

## 3. Conclusión honesta

| Hipótesis | Veredicto |
|---|---|
| 1 · `force-dynamic` rompe `unstable_cache` | ❌ **REFUTADA en local**: la build A lo lleva puesto y reutiliza |
| 2 · wrapper construido por request | ❌ **REFUTADA en local**: la build B lo reproduce y reutiliza igual |
| 3 · cold start / instancia por invocación | **no descartada** — y ahora es la principal |
| 4 · contención por 11 RPC + on-chain + censo | **consecuencia**, no causa |

**`next start` local no reproduce el fallo de producción.** La diferencia que
queda es el runtime: en local hay **un proceso** con la Data Cache en memoria y
en `.next/cache`; en Vercel Fluid cada invocación puede caer en otra instancia y
el store es el de la plataforma. Si ese store no está persistiendo las entradas
de `unstable_cache`, los contadores locales nunca lo van a mostrar.

⚠️ **No voy a nombrar una causa que no medí.** Es exactamente el error que ya
cometí al extrapolar «74× más rápido» de `next start` a producción.

---

## 4. El cambio que sí queda

`loadStatsSnapshot` / `loadPlayersCensus` construyen ahora el wrapper de
`unstable_cache` **una vez, memoizado a nivel de módulo**, en vez de uno nuevo
por request. **No es el fix del incidente** — el contrafactual demuestra que no
cambia nada localmente — pero es correcto por sí mismo: Next deriva parte de la
identidad de la entrada del callback que recibe, y entregarle un closure nuevo
en cada render es gratis de evitar. Son nueve combinaciones como máximo.

**Revisión estructural de `snapshot.ts` — todo verificado:**

| Comprobación | Estado |
|---|---|
| `unstable_cache` a nivel de módulo, no dentro del loader | ✅ (corregido) |
| `keyParts` estables, sin `locale` | ✅ `["public-stats", surface, container]` |
| sin `Date.now()`, `generatedAt`, headers ni objetos no deterministas en la clave | ✅ |
| `surface`/`container` normalizados; `"all"` con una sola representación | ✅ vía `parseStatsFilters` |
| cliente Supabase no capturado como argumento dinámico | ✅ se obtiene dentro de la lectura |
| `generatedAt` generado DENTRO de la ejecución cacheada | ✅ mismo sello en los 4 GET |
| agregador + `getSurfaceBreakdown` + on-chain, todos dentro de la misma función cacheada | ✅ `rpc=11` una sola vez |
| censo sólo dentro de su loader cacheado | ✅ `census=1` una sola vez |

---

## 5. Estado

- `pnpm -C apps/landing exec tsc --noEmit` → **exit 0**
- Suite landing → **216 passed / 23 files**
- Instrumentación (`instrument.ts`, `/api/cache-diag`) **todavía presente** en la
  rama: **hay que borrarla antes de cualquier commit del fix**.
- `git status`: ` M SESSION.md` + los archivos de la rama, **sin commitear**.

---

## 6. NEXT ACTION — necesito una decisión

El diagnóstico local está agotado: **no puedo demostrar la causa sin medir en
producción.** Las opciones, con su costo:

1. **Un deploy instrumentado** (`STATS_DEBUG=1`, probe gateado, borrado
   después). Es **un build** y responde la pregunta de forma definitiva: si el
   segundo GET en producción muestra `snapshotReads=2`, la caché no persiste; si
   muestra `instanceId` distinto cada vez, es cold start por invocación.
2. **Mitigar sin diagnosticar**: bajar el costo por render (cachear el bloque
   on-chain y el censo aparte, reducir las 11 RPC) para que un MISS permanente
   deje de doler. Trata el síntoma.
3. **Dejarlo y desbloquear Fase F**: los números son correctos; el problema es
   costo y latencia, no exactitud.

**Recomiendo la 1.** El incidente ya costó un timeout de 38,8 s en producción y
seguir adivinando sale más caro que un build.

⛔ Fase F sigue bloqueada. Sin redirects, sin cron, sin push.
