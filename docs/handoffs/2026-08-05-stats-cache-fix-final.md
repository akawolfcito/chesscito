# `/stats` — el fix de identidad de caché, cerrado

**Fecha:** 2026-08-05 · **Rama local:** `main` · **Sin push.**
**Incidente:** `docs/handoffs/2026-08-05-stats-production-cache-incident.md`
**Diagnóstico:** `docs/handoffs/2026-08-05-stats-production-cache-runtime-diagnosis.md`

> **El wrapper de `unstable_cache` se construía dentro de una función que corre
> por request.** En Vercel eso mintea una entrada nueva en cada invocación, así
> que `/stats` regeneraba en cada visita. `next start` no podía verlo.

---

## 1. Síntoma

Seis GET consecutivos a `https://www.chesscito.com/stats`, en serie:

```
1.93s · 2.28s · 2.83s · [38.79s, conexión colgada y fallida] · 3.61s · 1.87s
```

Cada visita ejecutaba **11 RPC + ~15 consultas on-chain + el censo** contra la
base de producción. Con filtro repetido, lo mismo.

---

## 2. Evidencia

**Antes** (`b2c0873d`): los tiempos de arriba, más un timeout.

**Después** (`35314f7a`), dos tandas separadas por 60 s:

| | tanda 1 | tanda 2 |
|---|---|---|
| `generatedAt` sin filtros | **03:10** en 1,2,3 | **03:10** en 1,2,3 |
| `generatedAt` con `?surface=learn` | **03:15** en 4,5 | **03:15** en 4,5 |
| censo `asOf` | 03:10 | 03:10 |
| latencias | 2803 · 437 · 489 · 1298 · 334 ms | 2289 · 233 · 248 · 207 · 856 ms |
| 5XX / timeouts | **ninguno** | **ninguno** |

**El sello no se movió en diez peticiones.** Ese es el veredicto: si hubiera
regenerado, `generatedAt` habría avanzado.

⚠️ **`x-vercel-cache` marcó MISS todo el tiempo, y eso es correcto** — describe
la respuesta de la RUTA, y la página es dinámica a propósito. Usarla como gate
del snapshot habría medido la cosa equivocada.

---

## 3. Hipótesis descartadas

| # | Hipótesis | Cómo murió |
|---|---|---|
| 1 | **`force-dynamic` desactiva `unstable_cache`** | **REFUTADA.** Sigue exactamente donde estaba en la build que funciona. Era mi principal sospecha y era inocente |
| 2 | Cold start explica los tiempos | **parcialmente cierta**: la tanda 2 paso 1 tardó 2289 ms **con el sello sin cambiar** — eso sí es cold start / TTFB, no un MISS |
| 3 | Contención por el volumen de consultas | **consecuencia**, no causa |

---

## 4. Causa

```ts
// b2c0873d — el defecto
export function loadStatsSnapshot(filters) {
  return createSnapshotLoader(unstable_cache, filters)();  // ⬅ closure nuevo por request
}
```

Next deriva parte de la identidad de una entrada **del callback que recibe**. Un
closure nuevo en cada render mintea una entrada nueva en cada render, así que la
caché nunca se reutilizaba.

### Por qué no lo vio ningún test

**`next start` es UN proceso de larga vida.** Un closure nuevo sigue cayendo en
el mismo store en memoria, así que el contrafactual local con el código roto
**midió un hit limpio y lo declaró inocente** — lo escribí yo, en
`2026-08-05-stats-cache-fix-review.md`. En Vercel cada invocación parte de un
módulo recién cargado y el defecto aparece.

**Tercera vez en esta línea de trabajo con la misma lección: una medición local
que contradice al device me está describiendo el local.**

---

## 5. Límite de la evidencia

Es una **diferencia controlada de una sola variable**, no un A/B con
instrumentación en las dos ramas: `force-dynamic`, el TTL, el tag y la clave son
idénticos entre `b2c0873d` y `35314f7a`; lo único que cambió es la memoización.

**No pude leer los contadores.** `STATS_REVALIDATE_TOKEN` es *Sensitive* y
`vercel env pull` lo devuelve redactado (11 bytes de 96); recuperarlo exigía
rotarlo **y** redesplegar. Habrían sido confirmatorios, no decisivos: un
`generatedAt` inmóvil en diez peticiones ya excluye la regeneración.

---

## 6. El fix

```ts
const snapshotLoaders = new Map<string, () => Promise<StatsSnapshot>>();

export function loadStatsSnapshot(filters: StatsFilters) {
  const key = snapshotKeyParts(filters).join("::");
  let loader = snapshotLoaders.get(key);
  if (!loader) {
    loader = createSnapshotLoader(unstable_cache, filters);
    snapshotLoaders.set(key, loader);   // ⬅ una vez, no por request
  }
  return loader();
}
```

Nueve wrappers como máximo (3 superficies × 3 contenedores). El censo usa el
mismo patrón con un slot único. **Conservado sin tocar:** clave normalizada,
`locale` fuera de la clave, `generatedAt` dentro del callback cacheado, fetch de
Supabase con `cache: "no-store"`, TTL 900, tag `"public-stats"`.

Junto al código queda el comentario que un futuro editor va a leer antes de
deshacerlo:

> *Do not construct this unstable_cache wrapper per request. next start uses a
> long-lived process and can mask this defect; the Vercel runtime did not.*

---

## 7. El guard

`src/lib/stats/__tests__/cache-identity-guard.test.ts` — **14 tests**, guard de
**fuente** porque ningún test de comportamiento puede ver este defecto.

### 🔬 Dos reglas equivocadas antes de dar con la correcta

1. **«no llamar `unstable_cache(`»** — el defecto **nunca escribió una llamada**:
   pasaba `unstable_cache` a una factory que la llamaba. Un guard de call-site
   habría mirado el incidente sin inmutarse.
2. **«no nombrar `unstable_cache`»** — demasiado estricta: el código **correcto**
   lo nombra, dentro de su init perezoso. Fallaba sobre el fix.

**La regla que sí es cierta del fix y falsa del defecto:** *si una función que
corre por request toca la maquinaria del wrapper, ese toque tiene que estar
detrás de un memo check, y lo construido tiene que persistirse.*

Verifica además: registro a nivel de módulo, clave acotada a **exactamente 9**
combinaciones, `locale` ausente, `"all"` con una sola representación, la página
sigue `force-dynamic`, `page.tsx` no construye wrappers, y el comentario del
postmortem sigue junto al código.

### Contrafactual — ejecutado, no supuesto

```
con el fix        → 14 passed
con el defecto    → 2 failed (memo check + registro por clave)
```

---

## 8. Limpieza

**Borrada, no desactivada:** `instrument.ts`, `/api/cache-diag` y sus tests, los
cinco `bump`, `noteGeneratedAt`, `instanceId`, los contadores y todos los
imports.

```
residuos de STATS_DEBUG / cache-diag / instanceId / snapshotReads /
rpcCalls / onchainReads / censusReads / bump* en apps/landing/src  →  0
rutas API construidas  →  enter/, revalidate-stats/   (cache-diag ausente)
```

Las variables locales del test de Fase E se renombraron a `snapshotRunCount` /
`censusRunCount` para que la búsqueda quede inequívoca.

⚠️ **`STATS_DEBUG` sigue en el scope Production de `chesscito-landing`.** Ya no
lo lee ningún código, así que es inerte — pero **hay que borrarla**: una variable
huérfana de diagnóstico no debe sobrevivir al diagnóstico.

---

## 9. Validación

| Verificación | Resultado |
|---|---|
| Guard de caché dirigido | **14 passed** |
| Suite landing **después del build** | **230 passed / 24 files · 0 skipped** |
| `pnpm -C apps/landing exec tsc --noEmit` | **exit 0** |
| `pnpm -C apps/landing build` | **verde** · `ƒ /stats` · `ƒ /api/revalidate-stats` · **sin `/api/cache-diag`** |
| Suite completa `apps/web` | **7.283 passed / 592 files** |
| `verify-stats-rpcs.ts` | **1.084 / 1.084** |
| `git diff --check` | exit 0 |
| Scan de secretos | **0 hits** |
| `.next/static` | **0** hits de service role, `supabase.co`, `NEXT_PUBLIC_SUPABASE`, `STATS_DEBUG` o `cache-diag` |
| `cache: "no-store"` | intacto |
| TTL / tag | **900** · **`public-stats`** |
| `locale` en la clave | **ausente** |

---

## 10. Riesgos que quedan

| # | Riesgo | Nota |
|---|---|---|
| 1 | **El cold start seguirá dando TTFB alto** | 2,2–2,8 s en la primera petición de una instancia fría, **con el sello sin cambiar** — no es un MISS. En una ruta de bajo tráfico va a pasar seguido. No se resuelve con caché de datos |
| 2 | **El TTL de 900 s es un PISO, no un techo** | con SWR la primera petición pasada la ventana recibe la foto vieja y sólo dispara el refresco. Ya se midieron 5 h 22 min bajo `revalidate: 3600`. El sello en pantalla es lo que evita que engañe |
| 3 | **`census.total` sigue sin explicación** | intacto desde la auditoría. **No declarar `/stats` cerrada sin trazarlo** |
| 4 | `STATS_DEBUG` huérfana en Production | §8 |
| 5 | La causa es una diferencia controlada, no un A/B instrumentado | §5 |

---

## 11. NEXT ACTION

> 1. Push correctivo (un solo deployment).
> 2. Borrar `STATS_DEBUG` del scope Production.
> 3. **Fase F** — validación contra SQL.
>
> ⛔ Sin redirects, sin cron, sin Fase G.
