# Auditoría — exactitud de la página pública `/stats`

**Fecha:** 2026-08-04 · **HEAD:** `1867f6f2` (= `origin/main`) · **Desplegado:** `e04d4b537180`
**Estado:** investigación cerrada. **Sin cambios de código, datos, schema, telemetría, monitor, cron, retención, índices ni configuración.** Todo el SQL fue `SELECT`; todo el HTTP fue `GET`.

---

## Veredicto en una línea

> **PostgREST corta cada lectura en 1.000 filas y el código cree que le entrega 10.000.**
>
> `.range(0, 9_999)` **no** eleva el techo: el servidor responde `Content-Range: 0-999/3066`.
> Como cada lectura viene ordenada `created_at desc`, lo que `/stats` publica bajo
> etiquetas de **7 días** y **30 días** son, en realidad, los **últimos 14,9 minutos**
> de tráfico. Y el guardián que debía avisarlo compara contra **10.000**, así que
> **nunca dispara**: la página miente sin decir que puede estar mintiendo.

---

## 1. Estado inicial

| Eje | Valor |
|---|---|
| `git status --short` | ` M SESSION.md` (única modificación; **no** stageada) |
| HEAD | `1867f6f24cfcf3859e7d9d3663eea4b2b2577cf2` |
| `origin/main` | `1867f6f24cfcf3859e7d9d3663eea4b2b2577cf2` — **idénticos** |
| `pnpm ops:health` (production) | 🟢 **GREEN (partial)** · exit 0 · `2026-08-04T18:06:07Z` |
| `pnpm ops:health:preview` | 🟢 **GREEN (partial)** · exit 0 · `2026-08-04T18:06:39Z` |
| p95 poblacional 24 h | **p50 15 · p95 75 · máx 576** sobre **2.408 sesiones** — correcto, a 2,7× del umbral 200 |
| 5XX | **ninguno** en `play` ni en `learn` |
| `/api/telemetry` | 16 req · **0 err** (play) · 14 req · **0 err** (learn) |
| Deployments | `e04d4b537180` · **READY** en ambos proyectos y ambos targets |
| Incidente activo | **ninguno** |

**No se reabrió** el incidente del p95 ni el HTTP 400 de Vercel: no apareció evidencia nueva
sobre ninguno de los dos. La auditoría arrancó de inmediato.

⚠️ Recordatorio heredado, vigente: **Supabase es una sola base** compartida entre production
y preview. Toda cifra de este documento es la suma de los dos entornos.

---

## 2. Arquitectura de `/stats`

```
https://play.chesscito.com/en/stats     (y learn.chesscito.com/en/stats)
  └─ apps/web/src/app/[locale]/stats/page.tsx      · export const revalidate = 3600
     │                                              · robots: index:false, follow:false
     ├─ loadStats(filters)   ─ unstable_cache(["public-stats", surface, container],
     │                          { revalidate: 3600, tags: ["public-stats"] })
     │    └─ getPublicStats(filters)               · lib/stats/public-aggregator.ts
     │         ├─ Promise.allSettled([...14 reads])  → victories · welcome_pack_claims
     │         │                                       analytics_events · coach_analyses
     │         │                                       leaderboard (RPC get_leaderboard)
     │         ├─ fetchOnchainStats()              · lib/stats/onchain.ts (15 reads propias)
     │         ├─ challengeFunnel                  · analytics_events .in(event)
     │         ├─ filteredEvents30d                · analytics_events (event,session_id,
     │         │                                     created_at,country,account_ref)
     │         ├─ cohortRows / trendFirstSeenRows  · session_first_seen
     │         ├─ accessRows                       · analytics_events .in(ALL_ACCESS_ALIASES)
     │         ├─ accountRows                      · account_first_seen (SIN ventana)
     │         └─ derivaciones puras               · lib/stats/funnels.ts
     └─ loadPlayersCensus()  ─ unstable_cache(["stats-players-census"],
                                { revalidate: 3600 })          · lib/stats/players-census.ts
          └─ leaderboard_full_v (.limit(500)) + count exact

  Render: components/stats/stats-page.tsx + stat-card.tsx + players-table.tsx
  Cliente Supabase: lib/supabase/server.ts (service role, server-only)
  Transporte: PostgREST (supabase-js) — NO psql, NO SQL directo
```

**Un solo cliente, un solo transporte, un solo techo.** Todo lo que `/stats` cuenta pasa por
PostgREST, y por lo tanto por su límite de filas.

---

## 3. Inventario de tarjetas y su contrato **real**

Leyenda: **E** = etiqueta visible · **U** = lo que un usuario entiende · **C** = lo que hace el código.

### 3.1 Bloque correcto — cuentas `head: true` (sin techo)

| # | E | U | C · fuente | Ventana | Filtros | Límite | Caché | Fallback | ¿Sano? |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Verified Progress Saves | mints totales | `count(*) exact head` · `victories` | lifetime | ninguno | — | 1 h | `null`→`—` | ✅ |
| 2 | Progress Saves (30d) | mints 30 d | `count(*) exact head .gte(minted_at)` | 30 d móvil | ninguno | — | 1 h | `—` | ✅ |
| 3 | Progress Saves (7d) | mints 7 d | ídem 7 d | 7 d móvil | ninguno | — | 1 h | `—` | ✅ |
| 4 | Welcome Packs Claimed | claims totales | `count(*) exact head` · `welcome_pack_claims` | lifetime | ninguno | — | 1 h | `—` | ✅ |
| 5 | Welcome Packs (7d) | claims 7 d | ídem 7 d | 7 d móvil | ninguno | — | 1 h | `—` | ✅ |
| 6 | Unique active wallets | wallets distintas | `Set` sobre `victories.player` | lifetime | ninguno | **1.000** | 1 h | `—` | ✅ *hoy* (249 filas) |
| 7 | Progress difficulty mix | mezcla de dificultad | tally sobre `victories.difficulty` | lifetime | ninguno | **1.000** | 1 h | oculto | ✅ *hoy* |
| 8 | On-chain Activity (4 filas × 3 columnas) | tx por método | `count(*) exact head` · `victories` / `peones_ledger` / `scores` / `welcome_pack_claims` | lifetime · 30 d · 7 d | `source=pack_purchase` | — | 1 h | `—` | ✅ |
| 9 | Unique on-chain wallets | wallets on-chain | unión de `Set` sobre 3 tablas | lifetime | ninguno | **1.000** | 1 h | `—` | ✅ *hoy* (249+17+35) |
| 10 | Get Peones volume | volumen USDC/USDT/cUSD | suma de `metadata.amountPaid` | lifetime | `source=pack_purchase` | **1.000** | 1 h | `—` | ✅ *hoy* |

> ⚠️ Los ✅ *hoy* de #6, #7, #9 y #10 son **contingentes**: viven porque `victories` tiene 249
> filas y `scores` 35. Cruzan la línea el día que `victories` llegue a 1.000. `peones_ledger`
> ya tiene **4.100** filas y sólo se salva porque el filtro `source=pack_purchase` deja 17.

### 3.2 Bloque roto — toda lectura de `analytics_events`, `account_first_seen` y `session_first_seen`

| # | E | U | C | Ventana declarada | Ventana **real** | Identidad | Límite | Caché | Público | SQL real | Δ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 11 | **Approx. App Sessions (7d)** | sesiones de 7 días | `Set(session_id)` sobre filas crudas | 7 d móvil | **14,9 min** | `session_id` | **1.000** | 1 h | **46** | **3.928** | **−98,8 %** |
| 12 | **Approx. App Sessions (30d)** | sesiones de 30 días | ídem | 30 d móvil | **14,9 min** | `session_id` | **1.000** | 1 h | **46** | **6.447** | **−99,3 %** |
| 13 | **App Opens (30d)** | sesiones que abrieron la app | `Set(session_id)` where `app_opened` | 30 d móvil | **14,9 min** | `session_id` | **1.000** | 1 h | **37** | **3.977** | **−99,1 %** |
| 14 | Activation funnel (5 pasos) | embudo de activación | `Set(session_id)` por paso canónico | 30 d | **14,9 min** | `session_id` | **1.000** | 1 h | 37/41/15/8/7 | — | **no monótono** |
| 15 | Access funnel (5 pasos) | embudo de puerta | `Set` scopeado a `gate_viewed` | 30 d | **14,9 min** | `session_id` | **1.000** | 1 h | 2/1/0/0/0 | — | inservible |
| 16 | Top countries | países por sesiones | `Set(session_id)` por país | 30 d | **14,9 min** | `session_id` | **1.000** | 1 h | NG 20 · NL 8 · BR 6 | NG 1.462 · NL 677 · **KE 281** | orden **incorrecto** |
| 17 | **D1 / D7 / Week 3 retention** | retención | cohortes de `session_first_seen` × actividad | 8/14/28 d | **hoy** | `session_id` | **1.000** | 1 h | **— / — / —** | cohorte D1 **1.562**, D7 **107** | cohorte=0 |
| 18 | **Active (7d)** | cuentas activas | `account_ref` con evento ≤7 d | 7 d | **14,9 min** | `account_ref` | **1.000** | 1 h | **38** | **3.062** | **−98,8 %** |
| 19 | **Dormant** | 8–29 días sin actividad | `account_ref` con evento 8–29 d | 30 d | **14,9 min** | `account_ref` | **1.000** | 1 h | **0** | ≈0 | coincidencia |
| 20 | **Inactive** | sin actividad en 30 d | resto de la partición | 30 d | **14,9 min** | `account_ref` | **1.000** | 1 h | **962** | **0** | **invención** |
| 21 | **"Of N accounts ever seen"** | cuentas históricas | `count` de filas leídas | lifetime | **las 1.000 más nuevas** | `account_ref` | **1.000** | 1 h | **1.000** | **3.077** | **−67,5 %** |
| 22 | **"N arrived today"** | altas de hoy | `first_seen` edad 0 | día UTC | ídem | `account_ref` | **1.000** | 1 h | **1.000** | **1.578** | −36,6 % |
| 23 | **"N this week"** | altas de la semana | `first_seen` edad ≤7 | **7 d móvil**, no semana | ídem | `account_ref` | **1.000** | 1 h | **1.000** | **3.058** | **−67,3 %** |
| 24 | "came back after going quiet" | resurrección | activo ≤7 d sin banda 8–29 | 30 d | **14,9 min** | `account_ref` | **1.000** | 1 h | **0** | no computable | — |
| 25 | Habit depth (5 bandas) | días activos por install | `Set(día)` por `session_id` | 30 d | **14,9 min** | `session_id` | **1.000** | 1 h | mediana **1** de **46** | — | inservible |
| 26 | Activity trend 30 d — sesiones | serie diaria | buckets densos de 30 días | 30 d | **14,9 min** | `session_id` | **1.000** | 1 h | **46** total | 6.447 | 29 días en cero |
| 27 | Activity trend — new installs | altas por día | `first_seen == día` | 30 d | **hoy** | `session_id` | **1.000** | 1 h | **46** | — | 100 % "new" |
| 28 | Activity trend — returning | retornos por día | `sessions − new` | 30 d | **hoy** | `session_id` | **1.000** | 1 h | **0** | — | estructuralmente 0 |
| 29 | Activity trend — progress saves | mints por día | `victories.minted_at` | 30 d | 30 d ✅ | — | **1.000** | 1 h | **172** | 172 | ✅ |
| 30 | Challenge Funnel | embudo de links | `.in(event)` + `props.isLite` | 30 d | 30 d ✅ | — | **1.000** | 1 h | oculto | — | ✅ *hoy* |
| 31 | Players census (tabla) | censo de jugadores | `leaderboard_full_v` `.limit(500)` + count | lifetime | lifetime ✅ | wallet | 500 | 1 h propia | **rows `[]`, total `null`, `unavailable`, asOf de AYER** | 291 filas | ver §11 |
| 32 | **Aviso de integridad** | "algunos datos son cota inferior" | `rows.length >= 10.000` | — | — | — | — | — | **AUSENTE** | debía estar | **guardián muerto** |

---

## 4. Contrato actual, tal como está escrito

`apps/web/src/lib/stats/public-aggregator.ts:250-269`:

```ts
/** Upper bound for PostgREST `range` on distinct-count queries.
 *  Supabase Cloud's default `db-default-rows-limit` (currently 1000)
 *  would silently truncate the row set and undercount distinct
 *  values — explicit range bypasses that. */
const DISTINCT_QUERY_MAX_ROWS = 9_999;

/** Rows a `.range(0, DISTINCT_QUERY_MAX_ROWS)` read can return. A result of
 *  exactly this size means PostgREST stopped at the ceiling and there is more
 *  behind it. */
const ROW_CEILING = DISTINCT_QUERY_MAX_ROWS + 1;   // 10.000

function hitCeiling(rows: unknown): boolean {
  return Array.isArray(rows) && rows.length >= ROW_CEILING;
}
```

**Las dos afirmaciones del comentario son falsas.**

1. «*explicit range bypasses that*» — no lo hace (§9).
2. «*A result of exactly this size means PostgREST stopped at the ceiling*» — el tamaño real
   al que se detiene es **1.000**, así que `hitCeiling` compara contra un número que **jamás
   puede alcanzarse**.

El mismo error, palabra por palabra, está replicado en `lib/stats/onchain.ts:178-180`.

---

## 5. Valores públicos — captura real

`GET https://play.chesscito.com/en/stats` · HTTP 200 · 200.905 bytes ·
`generatedAt = 2026-08-04 18:07 UTC` · `x-vercel-cache: MISS`

```
Verified Progress Saves          249
Approx. App Sessions (7d)         46
Progress Saves (30d)             172
App Opens (30d)                   37

1 · Do they get in?      Login screen shown 2 · Tapped ENTER 1 · Signed in 0
                         Wallet ready 0 · First exercise finished 0
2 · Do they reach value? App opened 37 · Hub viewed 41 · Exercise started 15
                         Exercise completed 8 · Daily Focus done 7
3 · Do they come back?   D1 — · D7 — · Week 3 —
4 · Who are they?        Active (7d) 38 · Dormant 0 · Inactive 962
                         "Of 1,000 accounts ever seen · 1,000 arrived today,
                          1,000 this week · 0 came back after going quiet."
5 · Habit                mediana 1 de 46 active installs

Top countries            NG 20 · NL 8 · BR 6 · ID 4 · SN 2 · CO 1 · IN 1 · KE 1
Activity trend 30 d      sesiones 46 · progress saves 172 · new 46 · returning 0
Activity windows         Progress Saves (7d) 148 · Unique active wallets 109
                         Approx. App Sessions (30d) 46 · Welcome Packs 281
On-chain                 Progress saves 249/172/148 · Get Peones 17/15/6
                         Score saves 98/71/59 · Welcome packs 281/276/272
                         Unique on-chain wallets 156

Aviso de integridad      AUSENTE
Players census           {"rows":[],"total":null,"rowsRead":"unavailable",
                          "asOf":"2026-08-03T23:32:52.392Z"}
```

---

## 6. Valores SQL de referencia

Todos `SELECT`, vía `psql` en contenedor efímero (mismo mecanismo que el monitor: connection
string en el env del contenedor, nunca en `argv`; guard que rechaza cualquier verbo de
escritura). **Ninguna wallet, `account_ref` ni `session_id` se imprimió en crudo.**
Corridas entre **18:15 y 18:28 UTC** del 2026-08-04.

### 6.1 Población

```
 ev_7d | ses_7d | vis_7d | ev_30d  | ses_30d | vis_30d | app_opened_filas | app_opened_ses | accounts | installs
-------+--------+--------+---------+---------+---------+------------------+----------------+----------+---------
 98433 |   3927 |   4531 |  120243 |    6446 |    4894 |             4695 |           3976 |     3063 |     3973
```

### 6.2 Ventanas e identidad

```
 accounts_semana_utc (lun 00:00 UTC)    | 3062        installs_7d_movil          | 3870
 accounts_7d_movil                      | 3065        installs_historicos        | 3977
 accounts_dia_utc                       | 1578        cohorte_d1_real (1-8 d)    | 1562
 accounts_historicas_tabla              | 3067        cohorte_d7_real (7-14 d)   |  107
 accounts_historicas_eventos            | 3067
 accounts_activas_7d_reales             | 3062
 accounts_inactivas_30d_reales          |    0
```

### 6.3 Nulos y vacíos (30 d, 120.297 filas)

```
 session_id null 0 · vacío 0      → 6.450 distintos
 visit_id   null 18.692 (15,5 %) · vacío 0  → 4.898 distintos
 account_ref null 36.410 (30,3 %) · vacío 0 → 3.067 distintos
 surface: play 67.399 · learn 33.883 · full 592 · NULL 18.688
 container: minipay 98.597 · browser 3.277 · NULL 18.688
```

> ⚠️ **`visit_id` distintos (4.898) < `session_id` distintos (6.450).** Como agrupador,
> `visit_id` es **más grueso** que `session_id`, no más fino — lo contrario de lo que su
> nombre sugiere, y de lo que asumió el pendiente 7 del handoff de estabilización. Con
> 15,5 % de filas sin `visit_id`, hoy **no es** un reemplazo utilizable.

### 6.4 Eventos por día (14 d)

```
 dia_utc    | eventos | sesiones | visitas | cuentas | app_opened_filas | app_opened_ses
------------+---------+----------+---------+---------+------------------+----------------
 2026-08-04 |   50609 |     1974 |    2233 |    1578 |             2227 |           1966
 2026-08-03 |   46337 |     1930 |    2184 |    1526 |             2177 |           1921
 2026-08-02 |      64 |        7 |       7 |       3 |                5 |              4
 2026-08-01 |      96 |        3 |       5 |       2 |                5 |              3
 2026-07-31 |      84 |        6 |       8 |       2 |                5 |              3
 2026-07-30 |     163 |       22 |      25 |       4 |               10 |              7
 2026-07-29 |     893 |       51 |      62 |       5 |               57 |             43
 2026-07-28 |     479 |       19 |      33 |       5 |               22 |              8
 2026-07-27 |     878 |      135 |     152 |       6 |               60 |             46
 2026-07-26 |     468 |       22 |      38 |       4 |               31 |             15
 2026-07-25 |     429 |       20 |      36 |       2 |               27 |             13
 2026-07-24 |     767 |       84 |      88 |       0 |               41 |             37
 2026-07-23 |     917 |       48 |      32 |       0 |               32 |             18
 2026-07-22 |     786 |       79 |       0 |       0 |                0 |              0
 2026-07-21 |     249 |       14 |       0 |       0 |                0 |              0
```

### 6.5 Tamaños de las fuentes

```
 analytics_events 148.884 · peones_ledger 4.100 · session_first_seen 3.988
 score_attempts 3.617 · account_first_seen 3.077 · score_saves 1.982
 welcome_pack_claims 282 · victories 249 · scores 35 · coach_analyses 2
 leaderboard_full_v 291 · victories distinct player 109
```

### 6.6 Países reales (30 d, sesiones distintas)

```
 NG 1462 · NL 677 · KE 281 · ZA 244 · ID 223 · BR 188 · UG 123 · CO 103
```

La página publica `NG 20 · NL 8 · BR 6 · ID 4 · SN 2 · CO 1 · IN 1 · KE 1`. **Kenia es el
tercer país real y la página lo pone octavo**, empatado en 1 con India. **El ranking no está
sólo escalado: está reordenado.** Sudáfrica (4.ª, 244 sesiones) no aparece.

---

## 7. Diferencias — resumen

| Tarjeta | Público | Real | Δ |
|---|---|---|---|
| Approx. App Sessions (7d) | 46 | **3.928** | −98,8 % |
| Approx. App Sessions (30d) | 46 | **6.447** | −99,3 % |
| App Opens (30d) | 37 | **3.977** | −99,1 % |
| Accounts ever seen | 1.000 | **3.077** | −67,5 % |
| Arrived today | 1.000 | **1.578** | −36,6 % |
| This week | 1.000 | **3.058** | −67,3 % |
| Active (7d) | 38 | **3.062** | −98,8 % |
| Inactive | **962** | **0** | inventado |
| D1 retention (cohorte) | 0 | **1.562** | oculto |
| D7 retention (cohorte) | 0 | **107** | oculto |
| Top country #3 | KE, 8.º con 1 | KE, 3.º con 281 | reordenado |
| Trend 30 d, sesiones | 46 | 6.447 | 29 días en cero |
| Verified Progress Saves | 249 | 249 | ✅ |
| Progress Saves 30 d / 7 d | 172 / 148 | 172 / 148 | ✅ |
| Welcome Packs | 281 | 282 | ✅ (deriva de minutos) |
| Unique active wallets | 109 | 109 | ✅ |
| Unique on-chain wallets | 156 | — | ✅ (fuentes < 1.000) |

---

## 8. Causa raíz por tarjeta

**Hay una sola causa raíz, con cuatro consecuencias encadenadas.**

### CR — El techo de filas de PostgREST es 1.000 y `.range()` no lo levanta

Toda tarjeta de §3.2 lee filas crudas y deriva su número **en JavaScript** (`new Set(...)`,
`filter`, `Map`). El servidor entrega 1.000 filas; el `Set` se arma sobre esas 1.000.

**Consecuencia 1 — el orden convierte el recorte en una ventana temporal.**
Cada lectura lleva `.order("created_at", { ascending: false })`. El recorte no es una muestra
aleatoria: es **el prefijo más nuevo**. Los 1.000 eventos más recientes abarcan **14,9 minutos**
(§9.3). Por eso 7 d y 30 d dan **el mismo número**: no miden 7 ni 30 días — miden el mismo
cuarto de hora.

**Consecuencia 2 — `account_first_seen` ordenado `first_seen desc` fabrica una cohorte falsa.**
Las 1.000 filas devueltas son las **1.000 cuentas más nuevas**, todas nacidas hoy. De ahí:
`known = 1.000`, `newToday = 1.000`, `new7d = 1.000` — **tres campos con el mismo valor
porque son la misma lista contada tres veces**.

**Consecuencia 3 — dos truncamientos independientes se cruzan y producen un número al revés.**
`computeAccountLifecycle` cruza `accountRows` (1.000 cuentas de hoy) con `filteredEvents30d`
(1.000 eventos de los últimos 15 min). Una cuenta sólo cuenta como activa si aparece en esos
15 minutos. **38 lo hacen; 962 no** → `Inactive 962`. El valor real es **0**: las 3.062
cuentas tuvieron actividad en 7 días. La tarjeta no está desviada — **está invertida**.

**Consecuencia 4 — el guardián compara contra un techo inalcanzable.**
`hitCeiling` exige `rows.length >= 10.000`. La respuesta máxima es 1.000. La condición es
**insatisfacible**, así que `dataIntegrity.truncated` sale siempre `[]` y el aviso nunca se
pinta. Verificado en el HTML: la cadena `row ceiling` está **ausente**.

### Causas secundarias, independientes de la CR

| Tarjeta | Causa |
|---|---|
| **Activation funnel no monótono** (App opened 37 < Hub viewed 41) | efecto de borde del recorte: en 15 min hay sesiones que emiten `hub_viewed` sin que su `app_opened` (anterior) esté en la ventana. El embudo de activación **no está scopeado a una cohorte**, a diferencia del de acceso |
| **Retention `—`** | `cohortRows` trae las 1.000 `first_seen` más nuevas → todas edad 0 → ninguna cae en las bandas 1–8 / 7–14 / 21–28 → `cohort = 0` → `retentionPct` devuelve `—` |
| **New installs = 100 %, returning = 0** | `trendFirstSeenRows` también truncado a las 1.000 altas más nuevas: todo install visible es "nuevo hoy" por construcción |
| **"this week" ≠ semana** | `bornAge <= 7` es una **ventana móvil de 7 días**, no la semana UTC. El copy dice "this week"; el resto del producto (Leaders Weekly) usa semana UTC desde el lunes. Dos definiciones de "semana" en el mismo producto |
| **Census dark y viejo** | ver §11 |
| **`census.total = null`** | `fetchLeaderboardTotalFromDb()` devuelve `null` en producción, mientras el mismo `HEAD ... Prefer: count=exact` contra `leaderboard_full_v` responde `Content-Range: 0-290/291` desde esta máquina. **No queda explicado por esta auditoría** — necesita su propia traza |

---

## 9. Prueba del truncamiento

### 9.1 Prueba directa contra PostgREST (la decisiva)

`GET` sobre el REST de Supabase con distintos `Range`, service role, sin escribir nada:

```
account_first_seen   Range:0-9999     → HTTP 206 · filas 1000 · Content-Range 0-999/3066
account_first_seen   Range:0-999      → HTTP 206 · filas 1000 · Content-Range 0-999/3066
account_first_seen   Range:0-1500     → HTTP 206 · filas 1000 · Content-Range 0-999/3066
account_first_seen   Range:1000-2999  → HTTP 206 · filas 1000 · Content-Range 1000-1999/3066
analytics_events     Range:0-9999     → HTTP 206 · filas 1000 · Content-Range 0-999/148588
```

**Pedir `0-9999` devuelve `0-999`.** Pedir `0-999` devuelve exactamente lo mismo. El techo es
del **servidor** (`db-max-rows` = 1000 en la configuración de API de Supabase), no del cliente,
y `.range()` no lo negocia. Es exactamente lo que el comentario del código dice que no pasa.

Dos corolarios que la misma prueba entrega gratis:

- **`Content-Range` trae el total verdadero** (`/3066`, `/148588`). Un `count: "exact"` da la
  cifra correcta sin transferir una sola fila.
- **`Range: 1000-2999` funciona** y devuelve la segunda página. **La paginación es posible**;
  simplemente no está implementada.

### 9.2 Prueba por simulación en SQL

Las mismas consultas que emite el agregador, evaluadas a tres tamaños de página:

| Métrica | primeras **1.000** | primeras **10.000** | población | **la página muestra** |
|---|---|---|---|---|
| sessions 7 d | **48** | 348 | **3.928** | **46** |
| sessions 30 d | **48** | 348 | **6.447** | **46** |
| app_opened sessions 30 d | **41** | 339 | **3.977** | **37** |
| accounts known | **1.000** | 3.064 | **3.064** | **1.000** |
| accounts born today UTC | **1.000** | 1.532 | **1.532** | **1.000** |
| accounts born 7 d | **1.000** | 3.058 | **3.058** | **1.000** |

**Los valores publicados caen sobre la columna de 1.000, no sobre la de 10.000.** Las
diferencias de 46 vs 48 y 37 vs 41 son los ~13 minutos que separan la generación del snapshot
(18:07 UTC) de mi medición (18:20 UTC): la ventana se desliza. **Los tres `1.000` coinciden
exactamente**, porque un tope no se desliza.

### 9.3 El span de la ventana real

```
 span_minutos |          mas_viejo           |          mas_nuevo           | sesiones
--------------+------------------------------+------------------------------+----------
         14,9 | 2026-08-04 17:57:37.187335+00| 2026-08-04 18:12:29.270349+00|       47
```

**Los 1.000 eventos más nuevos abarcan 14 minutos y 54 segundos, y contienen 47 sesiones.**
La tarjeta rotulada **"Approx. App Sessions (7d)"** publicaba **46**.

### 9.4 Lo que el `1.000` **no** es

Se descartaron, con evidencia:

- **No es un `LIMIT` del código.** Los `.limit()` del agregador son `10` (hall of fame) y
  `500` (censo); no hay ningún `1000` escrito en `apps/web/src`.
- **No es una cifra sembrada ni un redondeo.** `count(*)` real = 3.077, y `Content-Range`
  independiente = `/3066`.
- **No es coincidencia.** Aparece en **tres** campos a la vez, y los tres son el mismo `count`
  sobre la misma lista.
- **No es caché vieja.** El snapshot medido tiene `generatedAt` de hace 6 minutos y
  `x-vercel-cache: MISS`.

---

## 10. Análisis de paginación

**No hay ningún bucle de paginación en el repositorio.** Cada lectura emite **una** petición
con un `Range` y trata la primera página como el conjunto completo.

| Lectura | Filas reales tras el filtro | Devueltas | Páginas necesarias |
|---|---|---|---|
| `analytics_events` 7 d | 98.433 | 1.000 | **99** |
| `analytics_events` 30 d (`filteredEvents30d`) | 120.243 | 1.000 | **121** |
| `analytics_events` 30 d (sesiones + trend) | 120.243 | 1.000 | **121** |
| `accessRows` (`.in(ALL_ACCESS_ALIASES)`) | — | 1.000 | ≥1 |
| `session_first_seen` 30 d ×2 | 3.870 | 1.000 | **4** |
| `account_first_seen` (sin ventana) | 3.077 | 1.000 | **4** |
| `victories` ×3 | 249 | 249 | 1 ✅ |
| `peones_ledger` (pack_purchase) | 17 | 17 | 1 ✅ |
| `scores` | 35 | 35 | 1 ✅ |

> **Paginar `analytics_events` no es la solución.** 121 peticiones × 5 combinaciones de filtro
> × cada revalidación horaria, para transferir 120.000 filas y tirar 119.000 después de armar
> un `Set`, es exactamente el patrón que causó el incidente de invocaciones del 3 de agosto.
> **Los `Set` de identidad tienen que calcularse en PostgreSQL.** Paginar es correcto sólo para
> las tablas de cohorte (4 páginas cada una), y aun ahí un `count` exacto es mejor.

---

## 11. Análisis de caché

**La caché no causa ninguna de las discrepancias de §7** — el snapshot medido era fresco
(`generatedAt 18:07 UTC`, medido a las 18:13). Pero tiene dos defectos propios, medidos.

### 11.1 `revalidate: 3600` es un piso, no un techo

`unstable_cache` sirve **stale-while-revalidate**: pasado el TTL, la **primera** petición
recibe la copia vieja y dispara la revalidación en segundo plano; la copia nueva llega a la
**siguiente**. Medido en LEARN:

```
1.ª petición → generatedAt 2026-08-04 12:51 UTC   (5 h 22 min de antigüedad)
2.ª petición → generatedAt 2026-08-04 18:13 UTC   (fresca)
3.ª petición → generatedAt 2026-08-04 18:13 UTC
```

La página afirma **"Updated hourly"**. En una ruta de poco tráfico —que es exactamente lo que
`/stats` es— la antigüedad la fija **la última visita**, no el reloj. Un revisor de MiniPay
que abra la página primero ve la foto de hace cinco horas.

### 11.2 Una lectura fallida se cachea y **sobrevive al deploy**

Primera captura de PLAY:

```json
"census": {"rows": [], "total": null, "rowsRead": "unavailable",
           "asOf": "2026-08-03T23:32:52.392Z"}
```

**18 h 34 min de antigüedad, con `revalidate: 3600`**, y `asOf` **anterior al deployment
actual** (`e04d4b537180`, 16 min de vida): la Data Cache de Next **no se purga al desplegar**.
El bloque del censo estuvo **invisible** todo ese tiempo (`PlayersTable` se oculta con
`rowsRead: "unavailable"`), y la única señal era un campo que la UI no pinta. En capturas
posteriores el censo se recuperó (`rowsRead: "ok"`, 291 filas), confirmando que era una foto
vieja de un fallo transitorio y no un fallo permanente.

El comentario de `players-census.ts:147-152` **ya predijo este comportamiento** y lo aceptó
para no provocar una tormenta de reintentos. La decisión es defendible; lo que falta es que
**el lector pueda verlo**: `asOf` existe pero no se renderiza cuando `rowsRead` es
`unavailable`, que es justo cuando importaría.

### 11.3 Lo que sí está bien

- **Un tag por página** (`tags: ["public-stats"]`), distinto del tag `"content"` del catálogo:
  el precedente de `unstable_cache` con tag `"content"` **no aplica** acá.
- **Sin caché de CDN**: `x-vercel-cache: MISS`, `cache-control: private, no-cache, no-store`.
  La ruta es dinámica por leer `searchParams`. No hay foto de CDN que perseguir.
- **Una entrada por combinación de filtros**, verificado: `?surface=learn` tiene su propio
  `generatedAt` (18:13) distinto del de la vista sin filtro (18:07).
- **El censo cachea aparte** con su propio `asOf`, que es lo correcto — y hace visible el
  desfasaje en vez de esconderlo bajo el `generatedAt` de la página.

---

## 12. Problemas de naming

Independientes del truncamiento: **seguirían mal aunque los números fueran exactos.**

| Etiqueta actual | Qué sugiere | Qué es | Problema |
|---|---|---|---|
| **Approx. App Sessions (7d)** | personas / visitas | `session_id` distintos, que **no rotan entre visitas** (217 sesiones abarcan hasta 8 visitas — auditoría del p95 §5.2) | "sesión" sugiere una sentada; mide un lapso de días |
| **App Opens (30d)** | número de aperturas | **sesiones distintas** que emitieron `app_opened` | plural de "open" contando sesiones. Las filas reales son 4.695; las sesiones, 3.977 |
| **accounts ever seen** | personas | `account_ref` = pseudónimo con clave, derivado de la wallet | aceptable, pero conviven con "installs" sin que la página explique la diferencia |
| **N this week** | semana calendario | **ventana móvil de 7 días** | el producto ya usa semana UTC desde el lunes en Leaders Weekly. **Dos "semanas" distintas** |
| **Inactive** | se fue | "sin evento en 30 d", tope de la ventana leída | alguien ausente hace un año y alguien ausente hace 31 días son la misma casilla — el propio código lo documenta |
| **installs** (habit, retention, trend) | instalaciones | `session_id` | ni "install" ni "session": es un identificador de navegador que persiste entre visitas |
| **Approx.** | estimación acotada | prefijo en 2 de 3 tarjetas de sesiones | el prefijo no dice **cuánto** de aproximado; hoy el error es de dos órdenes de magnitud |
| **Some reads hit the 10.000-row ceiling** | techo real | el techo real es **1.000** | el aviso, además de no dispararse, publicaría el número equivocado |
| **Updated hourly** | ≤1 h de antigüedad | piso de 1 h, sin techo (§11.1) | medido: 5 h 22 min |
| **Week 3 retention** | día 21 | ventana días 15–21 | ✅ **correcto y bien nombrado** — el código explica por qué |

---

## 13. Contrato corregido — propuesto

Para cada métrica: **nombre público · fórmula · ventana · zona horaria · identidad ·
nulos · deduplicación · frescura · exacta/aproximada.**

### 13.1 Vocabulario, primero

Ninguna tarjeta debería usar dos de estos términos como sinónimos:

| Término | Definición | Columna | Cardinalidad 30 d |
|---|---|---|---|
| **Evento** | una fila de `analytics_events` | `id` | 120.243 |
| **Apertura** | fila con `event = 'app_opened'` | — | 4.695 |
| **Visita** | `visit_id` distinto | `visit_id` | 4.894 · **15,5 % nulo** |
| **Sesión (install)** | `session_id` distinto — **persiste entre visitas** | `session_id` | 6.446 · 0 % nulo |
| **Cuenta** | `account_ref` distinto — pseudónimo con clave | `account_ref` | 3.067 · **30,3 % nulo** |
| **Jugador activo** | cuenta con ≥1 evento en la ventana | `account_ref` | 3.062 (7 d) |
| **Jugador inactivo** | cuenta **sin** eventos en la ventana | `account_ref` | 0 (30 d) |

> **Regla dura:** "activo" e "inactivo" **sólo** pueden expresarse sobre `account_ref`, y
> **sólo** contra el denominador de `account_first_seen`. Sobre `session_id` no significan
> nada, porque un install no se puede dar de baja.

### 13.2 Contratos por tarjeta

| # | Nombre público recomendado | Fórmula | Ventana | TZ | Identidad | Nulos | Dedup | Frescura | Exactitud |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Installs activos (7 d)** | `count(distinct session_id)` | 7 d móvil | UTC | `session_id` | excluir `null`/`''` | ninguna | ≤1 h, con sello | **exacta** |
| 2 | **Installs activos (30 d)** | ídem | 30 d móvil | UTC | `session_id` | ídem | ninguna | ≤1 h | **exacta** |
| 3 | **Installs que abrieron la app (30 d)** | `count(distinct session_id) where event='app_opened'` | 30 d móvil | UTC | `session_id` | ídem | ninguna | ≤1 h | **exacta** |
| 4 | **Aperturas (30 d)** *(nueva, opcional)* | `count(*) where event='app_opened'` | 30 d móvil | UTC | fila | — | **⚠️ 8,6 % duplicados exactos** | ≤1 h | **aprox.** — declararlo |
| 5 | **Embudo de activación** | `count(distinct session_id)` por paso, **scopeado a la cohorte de `app_opened`** | 30 d móvil | UTC | `session_id` | excluir null | ninguna | ≤1 h | exacta y **monótona por construcción** |
| 6 | **Embudo de acceso** | ya scopeado a `web_access_gate_viewed` ✅ | 30 d móvil | UTC | `session_id` | excluir null | ninguna | ≤1 h | exacta |
| 7 | **Países por installs (30 d)** | `count(distinct session_id)` por `country`, top 8 | 30 d móvil | UTC | `session_id` | `country` null excluido ✅ | ninguna | ≤1 h | exacta |
| 8 | **Retención D1 / D7 / Semana 3** | cohortes de `session_first_seen` × días activos | 8 / 14 / 28 d | **UTC, día calendario** | `session_id` | excluir null | ninguna | ≤1 h | exacta |
| 9 | **Cuentas conocidas** | `count(*)` de `account_first_seen` | lifetime | — | `account_ref` | excluir null/`''` | ninguna | ≤1 h | **exacta** |
| 10 | **Cuentas nuevas hoy** | `first_seen >= date_trunc('day', now() at time zone 'UTC')` | día UTC | **UTC** | `account_ref` | ídem | ninguna | ≤1 h | exacta |
| 11 | **Cuentas nuevas — últimos 7 días** | `first_seen >= now() - '7 days'` | **7 d móvil**, dicho así | UTC | `account_ref` | ídem | ninguna | ≤1 h | exacta |
| 11b | *(alternativa)* **Cuentas nuevas esta semana** | `first_seen >= date_trunc('week', ...)` | **semana UTC desde el lunes** | UTC | `account_ref` | ídem | ninguna | ≤1 h | exacta |
| 12 | **Cuentas activas (7 d)** | cuentas con ≥1 evento en 7 d | 7 d móvil | UTC | `account_ref` | ídem | ninguna | ≤1 h | exacta |
| 13 | **Cuentas dormidas (8–29 d)** | último evento en la banda | 30 d | UTC | `account_ref` | ídem | ninguna | ≤1 h | exacta |
| 14 | **Cuentas sin actividad en 30 d** | resto de la partición | 30 d | UTC | `account_ref` | ídem | ninguna | ≤1 h | exacta, **con el tope declarado** |
| 15 | **Profundidad de hábito** | `count(distinct día UTC)` por `session_id` | 30 d móvil | UTC | `session_id` | excluir null | ninguna | ≤1 h | exacta |
| 16 | **Tendencia 30 d** | buckets densos por día UTC | 30 d | UTC | `session_id` / `minted_at` | excluir null | ninguna | ≤1 h | exacta |
| 17 | **Progress saves / Welcome packs / On-chain** | ya son `count exact head` ✅ | lifetime / 30 d / 7 d | UTC | wallet | — | `onConflict tx_hash` | ≤1 h | exacta |
| 18 | **Censo de jugadores** | `leaderboard_full_v` + `count exact` | lifetime | — | wallet | — | ninguna ✅ | **su propio `asOf`, siempre visible** | exacta |

**Regla transversal:** toda tarjeta cuya lectura pueda no ser exacta **imprime su ventana y su
población al lado**, igual que el p95 del monitor imprime su *n*. Un número sin su denominador
no se puede auditar — y un número que el jugador no puede reconciliar con lo que ve **se lee
como mentira**, que ya es una lección pagada de este proyecto.

---

## 14. Solución mínima — dejar de mentir hoy

**Objetivo:** que ninguna tarjeta publique un número falso. **No** que todas las tarjetas
funcionen. Sin migración, sin RPC, sin tocar la config de Supabase.

1. **`POSTGREST_MAX_ROWS = 1000`** reemplaza a `DISTINCT_QUERY_MAX_ROWS = 9_999` en
   `public-aggregator.ts` **y** en `onchain.ts`, con el comentario corregido y el
   `Content-Range` de §9.1 citado como evidencia.
2. **`hitCeiling` compara contra 1.000.** A partir de ahí el aviso de integridad **sí**
   dispara, y la copy dice "1.000 filas".
3. **Las tres cuentas planas pasan a `count: "exact", head: true`** — sin transferir filas:
   `known` (`account_first_seen`), `newToday` (`.gte(first_seen, día UTC)`), `new7d`
   (`.gte(first_seen, 7 d)`). Tres cuentas exactas, tres peticiones baratas.
4. **Toda métrica que hoy se deriva de un `Set` sobre filas truncadas pasa a `null`** — que la
   página ya sabe pintar como `—`: sesiones 7 d / 30 d, App Opens, activación, acceso, países,
   retención, hábito, active/dormant/inactive, new vs returning. **Un em-dash honesto vale más
   que un 46 falso**, y `null` es el contrato que el agregador ya declara para "no disponible".
5. **`revalidate` 3600 → 900** y la copy "Updated hourly" → **"Snapshot del <timestamp>"**,
   sin promesa de cadencia. Los sellos ya existen.
6. **Renderizar `census.asOf` también cuando `rowsRead === "unavailable"`**, con la leyenda
   "censo no disponible desde <asOf>". Una foto vieja de 18 h deja de ser invisible.

**Efecto:** la página queda con ~10 tarjetas exactas y ~15 em-dashes. Es fea y es **verdadera**.
Cumple el §8 del listing de MiniPay (la ruta sigue pública, sin wallet, con las métricas
on-chain intactas, que son las que MiniPay exige).

**Costo:** ~180 líneas en 3 archivos. Sin migración. Reversible con un revert.

---

## 15. Solución robusta — contar en PostgreSQL

**Principio:** un `count(distinct …)` es trabajo de la base. El error de categoría es el mismo
que causó el falso RED del p95: **derivar un estadístico poblacional de una muestra sesgada
por construcción**. Ahí la muestra era un top-20; acá es un prefijo temporal.

1. **Una migración con funciones `SECURITY DEFINER`**, una por bloque, cada una tomando
   `p_surface` y `p_container`:

   | Función | Devuelve |
   |---|---|
   | `stats_install_counts(p_surface, p_container)` | sesiones 7 d / 30 d, aperturas, sesiones con `app_opened` |
   | `stats_activation_funnel(...)` | un renglón por paso canónico, **scopeado a la cohorte** |
   | `stats_access_funnel(...)` | ya scopeado, movido a SQL |
   | `stats_top_countries(...)` | top 8 por sesiones distintas |
   | `stats_retention(...)` | `returned` / `cohort` para D1, D7 y semana 3 |
   | `stats_account_lifecycle(...)` | `known`, `new_today`, `new_7d`, `active_7d`, `dormant`, `inactive`, `resurrected_7d` |
   | `stats_habit_depth(...)` | bandas acumuladas, cohorte, mediana |
   | `stats_activity_trend(...)` | 30 renglones densos: día, sesiones, new, returning |

   ⛔ **`REVOKE EXECUTE FROM PUBLIC` no alcanza en Supabase.** Hay que revocar de `public`,
   `anon` **y** `authenticated`, y validar con `proacl` / `has_function_privilege` **contra la
   base real** — un regex sobre la migración pasa en verde con la función expuesta.
   La página lee con **service role** desde el servidor; nada de esto necesita ser público.

2. **El agregador pasa de ~10 lecturas de filas a ~8 RPC.** Se borran `computeActivation`,
   `computeTopCountries`, `computeRetention`, `computeAccountLifecycle`, `computeHabitDepth` y
   `computeActivityTrend` como derivadores de filas crudas; sus tests migran a tests de la
   **forma** del contrato. `computeAccessFunnel` conserva su regla de scoping, ahora en SQL.

3. **El transporte deja de ser el cuello.** Hoy: hasta 5.000 filas por render y un `Set` en
   Node. Después: 8 respuestas de decenas de bytes. Menos invocaciones, menos presión sobre una
   instancia Micro, y el `p95` de la página deja de depender del volumen de telemetría.

4. **Cada tarjeta imprime su ventana, su identidad y su población.** El contrato de §13 se
   renderiza, no sólo se documenta.

5. **Un guardián de fuente**, del tipo que ya salvó al Daily: un test que **falla** si aparece
   un `.range(` o un `new Set(` sobre `analytics_events`, `account_first_seen` o
   `session_first_seen` en `lib/stats/**`. Es la única defensa contra que esto vuelva:
   la copia de la constante entre `public-aggregator.ts` y `onchain.ts` demuestra que el patrón
   se replica solo, y **la prosa del comentario se replicó con él, error incluido**.

### Lo que se evaluó y se **descarta**

| Opción | Por qué no |
|---|---|
| **Subir `db-max-rows` en Supabase** | mueve el techo sin quitarlo, hace la página frágil al crecimiento, y afecta a **toda** la API — no sólo a `/stats` |
| **Paginar `analytics_events`** | 121 peticiones × 5 combinaciones × cada revalidación, para tirar el 99 % de lo transferido. Es el patrón del incidente del 3 de agosto |
| **Ampliar `.range()` a 100.000** | el servidor lo ignora igual (§9.1) |
| **Cachear más agresivo** | la caché no es la causa; endurecerla congelaría el error por más tiempo |
| **Gatear `/stats`** | ⛔ **rompe el listing de MiniPay (§8)**. La página **debe** seguir pública y sin wallet |

---

## 16. Archivos que requerirían cambios

| Archivo | Mínima | Robusta |
|---|---|---|
| `apps/web/src/lib/stats/public-aggregator.ts` | ✅ constante, `hitCeiling`, `count exact`, nulls | ✅ reescritura del bloque de observabilidad |
| `apps/web/src/lib/stats/onchain.ts` | ✅ constante + comentario | ✅ ídem |
| `apps/web/src/lib/stats/funnels.ts` | — | ✅ derivadores → validadores de forma |
| `apps/web/src/components/stats/stats-page.tsx` | ✅ copy del aviso, "Updated hourly", etiquetas §12 | ✅ ventana/identidad/población por tarjeta |
| `apps/web/src/components/stats/players-table.tsx` | ✅ `asOf` visible en `unavailable` | ✅ ídem |
| `apps/web/src/lib/stats/players-census.ts` | — | ✅ (si el `total` null resulta ser del `count`) |
| `apps/web/src/app/[locale]/stats/page.tsx` | ✅ `revalidate` | ✅ ídem |
| `apps/web/src/lib/supabase/queries.ts` | — | ✅ helpers de RPC |
| `supabase/migrations/<nueva>.sql` | — | ✅ 8 funciones + `REVOKE` triple |

**Tests afectados (existentes):**
`lib/stats/__tests__/public-aggregator.test.ts` · `funnels.test.ts` · `onchain.test.ts` ·
`onchain-fetch.test.ts` · `players-census.test.ts` · `players-census-cache.test.ts` ·
`players-census-delegation.test.ts` · `components/stats/__tests__/stats-page.test.tsx`
(fija `rowCeiling: 10000` en dos lugares) · `players-census-placement.test.tsx`
(fija `rowCeiling: 10_000`) · `stat-card.test.tsx` · `players-table.test.tsx` ·
`app/[locale]/stats/__tests__/stats-route-composition.test.tsx`

---

## 17. Diff estimado

| Alcance | Producción | Tests | Migración | Total |
|---|---|---|---|---|
| **Mínima** | ~180 líneas (3 archivos) | ~140 | 0 | **~320** |
| **Robusta** | ~250 añadidas / ~380 borradas (9 archivos) | ~450 | ~260 líneas SQL | **~1.340** |

La solución robusta **borra más de lo que agrega** en el agregador: seis derivadores en JS
desaparecen.

---

## 18. Tests propuestos

**Rojos hoy, verdes después.**

1. **`range` nunca supera el techo real** — un fixture que devuelve 1.000 filas hace que
   `dataIntegrity.truncated` incluya la lectura. *(Hoy: no dispara. Es el guardián muerto.)*
2. **Un `Set` sobre 1.000 filas nunca se publica como conteo de ventana** — con 1.000 filas de
   los últimos 15 minutos, `activeSessions7d` debe ser `null`, no `48`.
3. **Guardián de fuente** — falla si aparece `.range(` o `new Set(` sobre las tres tablas de
   telemetría en `lib/stats/**`. Incluye el **texto del comentario**: si vuelve a decir
   "explicit range bypasses", falla. *(La duplicación literal entre `public-aggregator.ts` y
   `onchain.ts` ya ocurrió; sólo un source guard la agarra.)*
4. **El embudo de activación es monótono** — ningún paso puede superar al anterior.
   *(Hoy: `App opened 37 < Hub viewed 41`. Falla.)*
5. **La partición del ciclo de vida cierra contra el denominador REAL** —
   `active + dormant + inactive == known`, y `known` viene de un `count exact`, no de
   `rows.length`. *(Hoy cierra sobre un `known` falso: 38+0+962=1.000.)*
6. **`inactive` no puede superar a `known − active` medido en la base**, con un fixture donde
   la tabla de cuentas y el escaneo de eventos tienen cardinalidades distintas.
7. **"this week" usa la misma semana que Leaders Weekly** — semana UTC desde el lunes, o la
   etiqueta dice "últimos 7 días". Un test sobre el copy y otro sobre la fórmula.
8. **La cohorte de retención no puede ser 0 cuando existen installs en la banda** — fixture con
   `first_seen` a 3 días.
9. **`census.asOf` se renderiza cuando `rowsRead === "unavailable"`.**
10. **La copy del aviso de integridad imprime el techo real** — falla si dice 10.000.
11. **Contrato de RPC** (robusta) — cada función devuelve las columnas del §13 y la firma
    incluye `p_surface` / `p_container`.
12. **Privilegios** (robusta) — `has_function_privilege('anon', …, 'EXECUTE')` es `false` para
    las ocho, **verificado contra la base real**, no contra el texto de la migración.

⚠️ **VR:** ningún caso visual debe leer estos números (el catálogo y el tráfico cambian por
diseño). Si se fotografía `/stats`, va contra un probe `/dev` con fixture o con `mask`.

---

## 19. Riesgos

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| 1 | **La página queda con 15 em-dashes tras la mínima** | media | es el punto: MiniPay §8 exige métricas **on-chain** (§3.1), y ésas quedan intactas y exactas |
| 2 | **Números públicos saltan de 46 a 3.928 y de 1.000 a 3.077** | media | es una **corrección**, no crecimiento. Anotarlo en el changelog de la página; sin la nota, el salto se lee como inflado |
| 3 | **Los 8,6 % de duplicados exactos** (auditoría del p95 §5.1) inflan cualquier conteo de FILAS | media | los contratos del §13 cuentan **entidades distintas**, no filas; sólo la tarjeta 4 (aperturas) los hereda, y por eso se declara aproximada |
| 4 | **`session_id` no rota entre visitas** | media | por eso el §13 lo llama **install** y nunca "sesión". No se arregla acá |
| 5 | **`visit_id` es nulo en 15,5 % y más grueso que `session_id`** | alta si se usa | **no usarlo** como agrupador hasta entender por qué. Contradice el pendiente 7 del handoff previo |
| 6 | **`account_ref` es nulo en 30,3 %** | media | todo lo derivado de cuentas cubre el 70 % de los eventos. Declararlo en la tarjeta |
| 7 | **`SECURITY DEFINER` mal revocada expone datos** | **alta** | triple `REVOKE` + validación con `proacl` contra la base real (§15.1) |
| 8 | **Migración sobre una instancia Micro** | baja | son funciones, no DDL de tablas ni índices |
| 9 | **La base es compartida production/preview** | media | los números seguirán siendo la suma. Rotularlo en la página, como hace el monitor |
| 10 | **La Data Cache sobrevive al deploy** | media | un despliegue no purga el error; hay que invalidar el tag `"public-stats"` explícitamente |
| 11 | **Regresión silenciosa** — es el segundo "número con aspecto de verdad" del mes | **alta** | el test 3 (source guard) es la única defensa real; sin él, esto vuelve |
| 12 | **`census.total = null` sigue sin explicarse** | media | **no cerrar `/stats` sin trazarlo**; el `HEAD count` funciona desde esta máquina y falla en producción |

---

## 20. Criterios de aceptación

**Bloqueantes.**

- [ ] Ninguna tarjeta publica un número derivado de una lectura truncada. O es exacto, o es `—`.
- [ ] `dataIntegrity.rowCeiling` es **1.000** y `hitCeiling` dispara con un fixture de 1.000 filas.
- [ ] `accounts known / newToday / new7d` vienen de `count: "exact"` y **no coinciden entre sí**
      salvo que la base diga que coinciden.
- [ ] `active + dormant + inactive == known` contra un `known` medido en la base.
- [ ] El embudo de activación es **monótono**.
- [ ] Cada tarjeta de ventana imprime **su ventana y su población**.
- [ ] "this week" y Leaders Weekly usan **la misma** definición de semana, o la etiqueta cambia.
- [ ] `census.asOf` visible también cuando el censo está caído.
- [ ] `/stats` sigue **pública, sin wallet, con `noindex`, fuera del sitemap** — MiniPay §8 intacto.
- [ ] El bloque On-chain (§3.1) no cambia de valor: es el entregable del listing.
- [ ] Suite completa verde, con el conteo en el mensaje de commit — y **mirando la cola del log**,
      no sólo los contadores (vitest sale non-zero por `Unhandled Errors` con 100 % verde).
- [ ] Los 12 tests del §18 existen y fallan **antes** del arreglo.

**Verificación posterior, contra SQL, misma ventana:**

- [ ] Installs activos 7 d ≈ `count(distinct session_id)` 7 d (±deriva de minutos).
- [ ] Cuentas conocidas == `count(*)` de `account_first_seen`.
- [ ] Cuentas inactivas 30 d == el valor SQL. **Hoy son 0 y la página dice 962.**
- [ ] Top países en el **mismo orden** que el SQL. Hoy KE está 8.º y debería estar 3.º.
- [ ] Cohortes de retención distintas de cero cuando el SQL dice 1.562 y 107.

---

## 21. Consolidación confirmada en `chesscito-landing`

**Decisión de producto, ya tomada — esta sección la instrumenta, no la discute.**
`https://www.chesscito.com/stats` pasa a ser la **única** página pública y canonical de
estadísticas. Learn y Play dejan de alojar implementaciones completas y conservan
compatibilidad por redirect. El desglose Learn/Play vive **dentro** de la página única.

> ⚠️ **Mover la UI al landing NO corrige el truncamiento.** El defecto de §9 es del
> **transporte** (PostgREST corta en 1.000 filas), no del alojamiento. Una copia del agregador
> actual corriendo en `chesscito-landing` publicaría **exactamente los mismos 46 y 1.000**.
> Las RPC y el cálculo server-side de §15 **siguen siendo obligatorios** — la consolidación
> decide *dónde* se escriben una sola vez, no *si* hacen falta.

### 21.1 Evidencia del estado actual

**El link registrado en el intake de MiniPay ya es el del landing.** `docs/audits/2026-06-03-minipay-intake-form-packet.md:24`:

```
| 11 | On-chain performance analytics link (optional) | https://www.chesscito.com/stats |
```

y §58 del mismo documento: *«**Link a registrar:** `https://www.chesscito.com/stats`»*.
La decisión de producto **alinea la implementación con el link que ya se declaró**, no cambia
lo declarado.

`apps/landing/src/app/stats/page.tsx` — 128 líneas, **sin una sola lectura de datos**: un
título, un párrafo y dos tarjetas con `<a href="{LEARN_URL}/stats">` y `<a href="{PLAY_URL}/stats">`.

```
robots: { index: false, follow: false }   // ya correcto
```

Verificado en producción: el HTML del landing en `/stats` no produce **ninguna** invocación de
función (§21.4) — es una página estática que sólo bifurca hacia las dos implementaciones reales.

### 21.2 Inventario técnico de `apps/landing`

| Eje | Estado |
|---|---|
| **Framework** | Next.js **14.2.35**, App Router · React **18.3.1** · TypeScript **5.9.3** |
| **i18n** | `next-intl` **4.12.0**, `localePrefix: "as-needed"`, locales **`["en", "es"]`**, `defaultLocale: "en"`, `localeDetection: true` |
| **Estructura de rutas** | `/[locale]` (onboarding) · `/classic` · **`/stats`** · `/api/enter` · `robots.ts` · `sitemap.ts` |
| **Middleware** | `createMiddleware(routing)` con matcher `"/((?!api\|_next\|_vercel\|classic\|stats\|.*\\..*).*)"` — **`/stats` está EXCLUIDO del ruteo por locale a propósito** |
| **Server Components** | ✅ nativo (App Router). `/stats` hoy es un Server Component sin `"use client"` |
| **Route Handlers** | ✅ ya existe uno: `src/app/api/enter/route.ts`, con su test |
| **Supabase** | ❌ **CERO.** `@supabase/supabase-js` **no está** en `package.json`; ningún `SUPABASE_*` aparece en `apps/landing/src`. Dependencias completas: `next`, `next-intl`, `react`, `react-dom`, `sharp` |
| **Service role server-only** | ✅ **posible y limpio**: no hay bundle cliente que pueda filtrarlo, y el patrón de `apps/web/src/lib/supabase/server.ts` es portable tal cual |
| **Env vars presentes** | `NEXT_PUBLIC_APP_URL` · `NEXT_PUBLIC_BUILD_SHA` · `NEXT_PUBLIC_FULL_URL` · `NEXT_PUBLIC_LEARN_URL` · `NEXT_PUBLIC_LEGAL_URL` · `NEXT_PUBLIC_PLAY_URL` · `NEXT_PUBLIC_PRIVY*` · `NEXT_PUBLIC_SUPPORT_EMAIL` · `VERCEL_GIT_COMMIT_SHA` |
| **Env vars a agregar** | **`SUPABASE_URL`** y **`SUPABASE_SERVICE_ROLE_KEY`**, en el proyecto `chesscito-landing`, **production y preview**. ⛔ **Jamás con prefijo `NEXT_PUBLIC_`** |
| **Caché / revalidation** | ✅ todo el arsenal de App Router: `export const revalidate`, `unstable_cache`, `revalidateTag`. Hoy no se usa ninguno |
| **robots** | `src/app/robots.ts`: `allow: "/"` global + sitemap. **`/stats` se protege por su `metadata.robots`, no por `robots.txt`** |
| **sitemap** | `src/app/sitemap.ts`: **una sola entrada**, la home. `/stats` ya está fuera |
| **canonical** | ❌ **no hay ninguno declarado** en el landing — ni `metadataBase` ni `alternates.canonical` |
| **Dominio / proyecto Vercel** | proyecto **`chesscito-landing`** · prod `chesscito-landing-goodwolf.vercel.app` · dominio **`www.chesscito.com`** · Node 24.x. ⚠️ **Fuera del monitor `ops:health`** (§3bis del runbook) |
| **Tests** | Vitest 4.1.4 + RTL + jsdom. Existe `src/app/stats/__tests__/stats-page-metadata.test.ts`. Hay 13 suites en el landing |
| **Paquetes compartidos con `apps/web`** | ❌ **ninguno.** `pnpm-workspace.yaml` declara sólo `apps/*` y **no existe un directorio `packages/`**. Los dos apps no comparten ni un tipo |
| **Reutilizable del selector actual** | `LEARN_URL` / `PLAY_URL` de `src/lib/app-urls.ts` (con `normalizeAppOrigin`) · tokens `--landing-*` y `--paper-*` · clase `fantasy-title` · el `<main>` shell y el patrón de tarjeta |
| **A portar desde `apps/web`** | clases `mission-shell`, `stats-page-scrim`, `paper-tray` y `paper-divider` — usadas por `stats-page.tsx` y `stat-card.tsx`, **hay que verificar cuáles ya existen** en el CSS del landing antes de copiar |

**Consecuencia estructural:** hoy **no hay dónde poner código compartido**. Crear
`packages/stats-core` obliga a tocar `pnpm-workspace.yaml` y la config de Turborepo — es un
cambio de topología del monorepo, no un refactor de `/stats`. Ver §21.5.

### 21.3 Dependencias, enlaces y compatibilidad

| Referencia | Archivo | Qué hacer |
|---|---|---|
| `href="/stats"` (footer del landing) | `apps/landing/src/components/landing/landing-page.tsx:830` | **preservar** — ya apunta al destino canonical |
| `href={`${LEARN_URL}/stats`}` | `apps/landing/src/app/stats/page.tsx:71` | **eliminar** — se reemplaza por la página real |
| `href={`${PLAY_URL}/stats`}` | `apps/landing/src/app/stats/page.tsx:113` | **eliminar** |
| Ruta completa de Play/Learn | `apps/web/src/app/[locale]/stats/page.tsx` | **convertir en redirect** |
| `https://www.chesscito.com/stats` | `docs/audits/2026-06-03-minipay-intake-form-packet.md:24,58,67` · `docs/audits/2026-06-03-stats-mvp-architecture-audit.md:207` | **preservar** — es el link del listing y **ya es correcto** |
| Exclusión del sitemap de web | `apps/web/src/app/sitemap.ts:35` + `src/app/__tests__/sitemap.test.ts` | **mantener**; el test seguirá verde con la ruta convertida en redirect |
| Metadata `noindex` | `apps/web/src/app/[locale]/stats/__tests__/stats-route-metadata.test.ts` | **migrar** el test al landing |
| E2E screenshot de grants | `apps/web/e2e/grant-shots.spec.ts:258-260` (`page.goto("/stats")`) | **repuntar** al landing, o el shot fotografía un redirect |
| Filtros end-to-end | `docs/releases/2026-07-23-observability-lote-1-release.md:72` | los query params **tienen consumidor documentado**: `learn/play/minipay/combinado` + fallback de valor inválido a `All` |
| `/api/profile/stats` | `apps/web/src/app/api/profile/stats/route.ts` + `hooks/use-profile-stats.ts` | ⛔ **NO TOCAR.** Es el perfil del jugador, privado y por wallet. Comparte el substring `stats` y **nada más** |
| Enlaces a `/stats` dentro de la UI de `apps/web` | — | **no existe ninguno**. Ni header, ni footer, ni nav. La página sólo se alcanza por URL directa |

**Locales que existen realmente:**

| App | Locales | Prefijo | ¿`/stats` con locale? |
|---|---|---|---|
| `apps/web` (Learn y Play) | `en`, `es` | **siempre** (`/[locale]/stats`) | **sí** — `/en/stats`, `/es/stats` |
| `apps/landing` | `en`, `es` | `as-needed` (`/` = en, `/es` = es) | **no** — `/stats` está fuera del matcher |

**URLs sin locale:** `play.chesscito.com/stats` y `learn.chesscito.com/stats` **existen como
entrada** — el middleware de `apps/web` las resuelve al locale detectado. Los redirects deben
cubrir **las tres formas**: `/stats`, `/en/stats`, `/es/stats`.

**Query params con consumidor real:** `surface` ∈ `{all, learn, play}` y `container` ∈
`{all, minipay, browser}`, parseados por `apps/web/src/lib/stats/filters.ts`, con el fallback a
`all` fijado por test y verificado en el release de observabilidad. **Deben sobrevivir al
redirect.**

### 21.4 Carga real medida

**Fuente:** Vercel Observability, `POST /v2/observability/query`, métrica
`vercel.function_invocation.count`, granularidad **60 min** (⚠️ `{hours:24}` sobreestima 87 % —
runbook §12bis), `groupBy: ["project_name", "route"]`, **`limit: 500`**.

> ⚠️ **La respuesta por defecto trae sólo las 10 filas más altas.** Sin `limit` explícito
> `/[locale]/stats` **no aparece**, y ausencia se leería como cero. Con `limit: 500` la ventana
> de 7 d devuelve 106 filas y la de 30 d, 149.

| Ruta | Proyecto | **7 d** | **30 d** |
|---|---|---|---|
| `/[locale]/stats` | `lite-chesscito` (LEARN) | **78** | **144** |
| `/[locale]/stats` | `chesscito` (PLAY) | **17** | **37** |
| `/en/stats` (build previo) | ambos | 0 | 6 |
| `/es/stats` (build previo) | ambos | 0 | 2 |
| **TOTAL `/stats` público** | | **95** | **189** |
| `/stats` | `chesscito-landing` | **ninguna fila** — estática, **0 invocaciones** |
| `/api/profile/stats` | `lite-chesscito` | 2.482 | 2.915 |
| `/api/profile/stats` | `chesscito` | — | 7 |

**Contexto:** el ciclo entero in-scope son **32.418** invocaciones y `/api/telemetry` sólo se
lleva **75.178** en 7 días. `/stats` público es **95 invocaciones en 7 días: el 0,13 %** de lo
que consume la telemetría.

**Lecturas Supabase por regeneración** — contadas sobre el código, no estimadas:

| Bloque | Lecturas |
|---|---|
| `Promise.allSettled` del agregador | 14 |
| `fetchOnchainStats` | 15 |
| `challengeFunnel` | 1 |
| `filteredEvents30d` · `cohortRows` · `accessRows` · `trendFirstSeenRows` · `accountRows` | 5 |
| Censo (filas + count) | 2 |
| **TOTAL** | **37 peticiones PostgREST por regeneración, por proyecto, por combinación de filtros** |

**Frecuencia real de revalidación:** **no es horaria y no es medible con precisión.** Con
`stale-while-revalidate`, una regeneración ocurre en la **primera visita posterior al TTL**,
así que la cota superior es el número de visitas y la inferior es cero. Medido directamente
(§11.1): LEARN sirvió una foto de **5 h 22 min** con `revalidate: 3600`.

**¿Cada proyecto mantiene su propia caché?** **Sí, medido:** a la misma hora,
`play.chesscito.com` servía `generatedAt 18:07 UTC` y `learn.chesscito.com` `12:51 UTC`.
**Dos cachés, dos fotos, dos verdades.**

#### Ahorro real esperable — y lo que **no** se puede afirmar

| Afirmación | ¿Medible? | Valor |
|---|---|---|
| **Una implementación en vez de dos** | ✅ sí | ~1.100 líneas de producción + ~2.400 de test dejan de existir por duplicado |
| **Una caché en vez de dos** | ✅ sí | hoy divergen **5 h 22 min**, medido. Consolidar elimina la divergencia por construcción |
| **Regeneraciones a la mitad** | ✅ estructural | de 2 proyectos × 37 lecturas a 1 × 37 |
| **Ahorro de invocaciones en Vercel** | ⚠️ **medible y despreciable** | 189 invocaciones en 30 d. **No es un argumento**: decir "ahorramos invocaciones" sería vender 0,13 % como si fuera algo |
| **Ahorro de carga en Supabase** | ❌ **NO es ahorro neto** | el landing **hoy no toca Supabase**. Consolidar **mueve** carga a un proyecto que no la tenía. Lo que baja es la duplicación, no el total |
| **Ahorro de Active CPU** | ❌ **no observable** | la atribución por proyecto de la API no es determinista (runbook §12bis) |

> **El argumento de la consolidación es de corrección, no de costo.** El ahorro real es
> **una sola fuente de verdad**: hoy dos páginas responden distinto a la misma pregunta, y con
> las RPC de §15 escribir el sistema una vez cuesta la mitad que escribirlo dos.

### 21.5 Arquitectura destino

| Decisión | Valor |
|---|---|
| **Ruta canonical** | **`https://www.chesscito.com/stats`** — sin locale en la URL, tal como hoy y tal como está registrado en el intake de MiniPay |
| **Comportamiento de locale** | `/stats` **sigue fuera** del matcher del middleware. El idioma se resuelve por `Accept-Language` (o por `?locale=`) y se renderiza server-side. ⛔ **No** agregar `/es/stats` ni `/en/stats`: crearía dos URLs indexables para el mismo contenido, y el link del listing tiene que ser **una** |
| **`?locale=en\|es`** | aceptado y opcional; gana sobre `Accept-Language`. **No** entra en la clave de caché de datos — es sólo formato de presentación (mismo patrón que `nicknameTokens`, que hoy se construye fuera del agregador cacheado) |
| **`?surface=all\|learn\|play`** | **preservado**, con el mismo parser y el mismo fallback a `all` |
| **`?container=all\|minipay\|browser`** | **preservado**, ídem |
| **Forma de la página** | **overview + filtros por `surface`**, no tabs y no dos secciones duplicadas. Las tarjetas globales (progress saves, welcome packs, on-chain) no dependen del filtro; los bloques de observabilidad ya lo honran hoy. **Añadir una fila "Learn / Play / Total" en las tarjetas de installs** para que el desglose se lea sin cambiar de URL |
| **Dónde vive el agregador** | **dentro de `apps/landing`**, en `src/lib/stats/**`. ⛔ **NO crear `packages/stats-core` en esta etapa**: no existe un directorio `packages/`, y agregarlo obliga a tocar `pnpm-workspace.yaml` + Turborepo. Un consumidor no justifica un paquete |
| **Dónde viven los tipos** | junto al agregador, en `apps/landing/src/lib/stats/types.ts`. `apps/web` deja de necesitarlos: sus archivos se borran |
| **Dónde viven las RPC** | **en la migración de Supabase** (`supabase/migrations/**`), que es donde ya vive todo el SQL. Son la **única** fuente de verdad de las agregaciones y **no dependen de qué app las llame** |
| **Acceso a Supabase** | **server-only, service role.** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` sin prefijo `NEXT_PUBLIC_`, leídas sólo desde Server Components. El landing no tiene hoy ningún cliente Supabase en el bundle: hay que **mantenerlo así** |
| **Cache tag** | **uno solo: `"public-stats"`**, con una clave por `(surface, container)`. ⛔ **Nunca** el tag `"content"` — ese es del catálogo de puzzles y ya causó un falso verde |
| **`revalidate`** | **900 s** (15 min), no 3600. Con SWR el TTL es un piso; bajarlo acota el peor caso |
| **Invalidación** | `revalidateTag("public-stats")` desde un Route Handler protegido por token, para poder refrescar a mano tras un deploy. ⚠️ **La Data Cache de Next NO se purga al desplegar** — medido: un censo caído sobrevivió 18 h 34 min y un deploy entero (§11.2) |
| **Sello `asOf`** | **visible siempre, y por bloque.** El `generatedAt` de la página y el `asOf` del censo **no son el mismo reloj** y deben renderizarse por separado — incluso, y sobre todo, cuando el bloque está caído |
| **Fallback si Supabase falla** | el que ya existe y es correcto: **`null` por campo → em-dash**, nunca `0`. La página **no 500ea**. El aviso de integridad, con el techo corregido a 1.000 |
| **robots** | **`index: false, follow: false`** — ya es el valor actual del landing. Alcanzable ≠ indexable |
| **canonical** | declarar `metadataBase` + `alternates.canonical = "https://www.chesscito.com/stats"`. Hoy **no hay ninguno** en el landing, y con dos orígenes redirigiendo hacia acá conviene que exista |
| **sitemap** | **`/stats` queda fuera**, como hoy en ambos apps |
| **Rollback** | ver §21.7 |

### 21.6 Redirects

**Dónde:** `async redirects()` en `apps/web/next.config.js`. ⛔ **No en el middleware** — el de
`apps/web` es de `next-intl` y meter reglas de dominio ahí acopla ruteo de idioma con
migración de URLs.

| Origen | Destino | Código |
|---|---|---|
| `learn.chesscito.com/stats` | `https://www.chesscito.com/stats?surface=learn` | **307** |
| `learn.chesscito.com/en/stats` | `https://www.chesscito.com/stats?surface=learn&locale=en` | **307** |
| `learn.chesscito.com/es/stats` | `https://www.chesscito.com/stats?surface=learn&locale=es` | **307** |
| `play.chesscito.com/stats` | `https://www.chesscito.com/stats?surface=play` | **307** |
| `play.chesscito.com/en/stats` | `https://www.chesscito.com/stats?surface=play&locale=en` | **307** |
| `play.chesscito.com/es/stats` | `https://www.chesscito.com/stats?surface=play&locale=es` | **307** |

**Reglas de comportamiento:**

1. **Los query params entrantes se preservan enteros.** Un `?container=minipay` sobrevive.
2. **`surface` sólo se inyecta si no viene ya.** Un `?surface=all` explícito **gana** sobre el
   `surface=learn` implícito del dominio: si alguien pidió el total, se le da el total.
3. **Empiezan como 307 (temporal).** Un 308 lo cachea el navegador de forma casi irreversible y
   **congelaría un error** si la página destino resulta estar mal.
4. **Promoción a 308** sólo cuando se cumpla, todo junto: la página del landing lleva ≥7 días
   sirviendo cifras verificadas contra SQL, el link del listing responde 200, y el
   `/api/profile/stats` sigue intacto. Es un cambio de una línea por regla.
5. **Sin loops, por construcción:** `www.chesscito.com` es otro proyecto de Vercel y **no
   redirige de vuelta**. El único loop posible sería que el landing reenviara a los apps —
   precisamente lo que se está eliminando.
6. **Ningún redirect se activa antes de que el destino esté completo.** El orden de despliegue
   es: landing con la página real y verificada → **después** los redirects. Al revés se apunta
   tráfico del listing de MiniPay a una página a medias.
7. **El E2E `grant-shots.spec.ts` se repunta antes**, o fotografía un 307.

### 21.7 Rollback

| Etapa | Cómo se revierte | Costo |
|---|---|---|
| **Hotfix mínimo en Play/Learn** | `git revert` de un commit | segundos |
| **Envs de Supabase en el landing** | borrar las dos variables; la página cae a `EMPTY_PUBLIC_STATS` → todo em-dash, **sin 500** | inmediato |
| **Migración de RPC** | las funciones quedan **sin usar**; no se dropean. Nada las llama si el agregador vuelve atrás | nulo |
| **Página del landing** | revert del commit; `/stats` vuelve al selector de dos botones, que sigue en el historial | minutos |
| **Redirects** | **revert de `next.config.js`**. Como son **307**, los navegadores no los cachearon: el rollback es efectivo de inmediato. Con 308 no lo sería — ésta es la razón del punto 3 de §21.6 |
| **Caché envenenada** | `revalidateTag("public-stats")`. ⚠️ un deploy **no** alcanza (§11.2) |
| **Punto de no retorno** | **borrar `apps/web/src/lib/stats/**` y `components/stats/**`.** Hacerlo **sólo** después de que los redirects lleven ≥7 días estables. Hasta entonces, el código viejo queda muerto pero presente |

### 21.8 Secuencia — evaluación de las cuatro opciones

| | Veces que se implementa | ¿Números falsos públicos durante la migración? | MiniPay | Rollback | Riesgo de deploy | Tiempo total | Código duplicado | Una sola caché |
|---|---|---|---|---|---|---|---|---|
| **A** · hotfix en Play/Learn → migrar | **2** (mínima + robusta en web, luego mover) | no | ok | fácil | medio | **el más largo** | alto | tarde |
| **B** · robusta en Play/Learn → migrar | **2 completas** | **sí, durante días** | ok | medio | alto | largo | **el más alto** | tarde |
| **C** · robusta directo en el landing | **1** | **SÍ — todo el desarrollo** | ⚠️ el link del listing lleva a botones que van a páginas mentirosas | fácil | bajo | medio | nulo | sí |
| **D** · hotfix mínimo ya + robusta directo en el landing | **1** | **no** | ✅ | fácil | bajo | medio | nulo | sí |

**Recomendada: D.**

La clave es que **la solución mínima (§14) no es una implementación**: no construye tarjetas,
las **apaga**. Cambia una constante, sustituye tres derivaciones por `count: "exact"` y pone en
`null` todo lo que hoy miente. Es **desechable por diseño** — cuando la robusta llega al
landing, el código de `apps/web` se borra entero, mínima incluida. Por eso D **no implementa
nada dos veces**, que es la trampa de A y de B.

Y resuelve lo que C no puede: durante los días que tarde la robusta, `/stats` en Play y Learn
**deja de publicar 46 sesiones y 1.000 cuentas hoy mismo**, con ~320 líneas y un `git revert`
de distancia. El link del listing de MiniPay sigue funcionando en todo momento.

**Orden de ejecución:**

1. **Hotfix mínimo** en `apps/web` (§14). Merge, push, listo. La página queda fea y verdadera.
2. **Migración de RPC** (§15.1) con el triple `REVOKE` validado con `proacl` **contra la base real**.
3. **Envs** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` en `chesscito-landing`, production y preview.
4. **Página real en el landing**, consumiendo las RPC. Verificación contra SQL, misma ventana.
5. **Repuntar** `grant-shots.spec.ts` y migrar el test de metadata.
6. **Redirects 307** en `apps/web/next.config.js`.
7. **≥7 días** de observación. Recién ahí: promoción a 308 y borrado de `apps/web/src/lib/stats/**`.
8. **Añadir `chesscito-landing` al monitor `ops:health`** — hoy está fuera, y pasa a alojar la
   única página de estadísticas del producto.

### 21.9 Diff estimado de la consolidación

| Etapa | Producción | Tests | Migración | Config | Total |
|---|---|---|---|---|---|
| 1 · Hotfix mínimo (`apps/web`) | ~180 | ~140 | 0 | 0 | **~320** |
| 2 · RPC | 0 | ~120 | ~260 SQL | 0 | **~380** |
| 3 · Envs | 0 | 0 | 0 | 2 vars × 2 entornos | — |
| 4 · Página en el landing | ~700 nuevas | ~450 | 0 | ~30 | **~1.180** |
| 5 · E2E + metadata | ~10 | ~60 | 0 | 0 | **~70** |
| 6 · Redirects | 0 | ~80 | 0 | ~40 | **~120** |
| 7 · Borrado en `apps/web` | **−1.100** | **−2.400** | 0 | 0 | **−3.500** |
| **NETO** | **~−210** | **~−1.550** | **~260** | **~70** | **≈ −1.430 líneas** |

**La consolidación borra ~1.430 líneas netas.** El grueso del borrado (etapa 7) llega al final
y sólo tras los 7 días de observación.

### 21.10 Riesgos propios de la consolidación

*(Los riesgos 1–12 de §19 siguen vigentes; éstos se suman.)*

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| 13 | **Creer que mover la UI arregla los números** | **alta** | está escrito al inicio de §21 y en el criterio de aceptación: sin las RPC, el landing publica los mismos 46 y 1.000 |
| 14 | **`SUPABASE_SERVICE_ROLE_KEY` en un proyecto que nunca tuvo secretos** | **alta** | server-only, sin `NEXT_PUBLIC_`, y un test que falle si aparece en el bundle cliente. El landing **no tiene** cliente Supabase hoy: hay que mantener esa propiedad |
| 15 | **Redirect activado antes de que el destino esté listo** | **alta** | punto 6 de §21.6 — orden de despliegue fijo. El link del listing apunta al destino |
| 16 | **308 prematuro** | **alta** | empezar en 307; la promoción es un cambio de una línea con criterios explícitos |
| 17 | **`/api/profile/stats` tocado por error** | media | comparte el substring `stats` y **nada más**. Es privado y por wallet. Un test de humo lo cubre |
| 18 | **El landing no está en `ops:health`** | media | etapa 8 de §21.8. Alojar la página del listing sin monitoreo es un punto ciego |
| 19 | **La página crece de 128 líneas sin datos a una con 8 RPC** | media | el landing pasa de estática a dinámica: hay que mirar su TTFB y su presupuesto de invocaciones, que hoy es ~0 para esta ruta |
| 20 | **`grant-shots.spec.ts` fotografía un redirect** | baja | repuntar en la etapa 5, antes de la 6 |
| 21 | **Locale: tentación de crear `/es/stats` en el landing** | media | dos URLs indexables para el mismo contenido, y el listing sólo puede declarar una. `?locale=` cubre el caso |
| 22 | **Perder el fallback de `surface` inválido** | baja | está fijado por test y verificado en el release de observabilidad — migrarlo, no reescribirlo |
| 23 | **Crear `packages/stats-core` "por prolijidad"** | media | un consumidor no justifica un paquete, y obliga a tocar workspace + Turborepo. Diferir hasta que haya un segundo consumidor real |

### 21.11 Decisión propuesta

> **Secuencia D.** Hotfix mínimo hoy en Play/Learn para dejar de publicar números falsos; la
> solución robusta se escribe **una sola vez y directamente en `chesscito-landing`**; los
> redirects 307 llegan **después** de que el destino esté verificado contra SQL, y la promoción
> a 308 más el borrado de `apps/web/src/lib/stats/**` esperan siete días de observación.
>
> El agregador vive en `apps/landing/src/lib/stats/**` — **sin paquete compartido** — y las
> agregaciones viven en RPC de PostgreSQL, que es la única capa que no depende de qué app
> pregunte. Una ruta canonical, una caché, un `asOf`, un tag.

---

## 22. Consultas y sondas utilizadas

Todas **read-only**. SQL vía `psql` en contenedor efímero (connection string en el env del
contenedor, **nunca** en `argv`), con guard que rechaza
`insert|update|delete|drop|alter|truncate|create|grant|revoke|vacuum|reindex|refresh|copy|pg_stat_reset`
y exige que el statement empiece con `WITH`/`SELECT`/`EXPLAIN`.
HTTP: sólo `GET` y `HEAD`. **Ninguna wallet, `account_ref` ni `session_id` se imprimió en crudo.**

<details>
<summary><b>1 · Población</b></summary>

```sql
select
  (select count(*) from public.analytics_events where created_at >= now() - interval '7 days')  as ev_7d,
  (select count(distinct session_id) from public.analytics_events where created_at >= now() - interval '7 days')  as ses_7d,
  (select count(distinct visit_id)  from public.analytics_events where created_at >= now() - interval '7 days')  as vis_7d,
  (select count(*) from public.analytics_events where created_at >= now() - interval '30 days') as ev_30d,
  (select count(distinct session_id) from public.analytics_events where created_at >= now() - interval '30 days') as ses_30d,
  (select count(distinct visit_id)  from public.analytics_events where created_at >= now() - interval '30 days') as vis_30d,
  (select count(*) from public.analytics_events where event = 'app_opened' and created_at >= now() - interval '30 days') as app_opened_rows_30d,
  (select count(distinct session_id) from public.analytics_events where event = 'app_opened' and created_at >= now() - interval '30 days') as app_opened_ses_30d,
  (select count(*) from public.account_first_seen) as accounts_lifetime,
  (select count(*) from public.session_first_seen) as installs_lifetime;
```
</details>

<details>
<summary><b>2 · La consulta que prueba el truncamiento — 1.000 / 10.000 / población</b></summary>

```sql
with
s7 as (select session_id, created_at from public.analytics_events
       where created_at >= now() - interval '7 days' order by created_at desc),
s30 as (select session_id, created_at from public.analytics_events
        where created_at >= now() - interval '30 days' order by created_at desc),
ev as (select event, session_id, created_at, country, account_ref
       from public.analytics_events
       where created_at >= now() - interval '30 days' order by created_at desc),
acc as (select account_ref, first_seen from public.account_first_seen
        order by first_seen desc)
select 'sessions_7d' as metrica,
  (select count(distinct session_id) from (select * from s7 limit 1000) t)  as primeras_1000,
  (select count(distinct session_id) from (select * from s7 limit 10000) t) as primeras_10000,
  (select count(distinct session_id) from s7)                               as poblacion
union all select 'sessions_30d',
  (select count(distinct session_id) from (select * from s30 limit 1000) t),
  (select count(distinct session_id) from (select * from s30 limit 10000) t),
  (select count(distinct session_id) from s30)
union all select 'app_opened_sessions_30d',
  (select count(distinct session_id) from (select * from ev limit 1000) t where event = 'app_opened'),
  (select count(distinct session_id) from (select * from ev limit 10000) t where event = 'app_opened'),
  (select count(distinct session_id) from ev where event = 'app_opened')
union all select 'accounts_known',
  (select count(*) from (select * from acc limit 1000) t),
  (select count(*) from (select * from acc limit 10000) t),
  (select count(*) from acc)
union all select 'accounts_born_today_utc',
  (select count(*) from (select * from acc limit 1000) t where first_seen >= date_trunc('day', now() at time zone 'UTC')),
  (select count(*) from (select * from acc limit 10000) t where first_seen >= date_trunc('day', now() at time zone 'UTC')),
  (select count(*) from acc where first_seen >= date_trunc('day', now() at time zone 'UTC'))
union all select 'accounts_born_7d',
  (select count(*) from (select * from acc limit 1000) t where first_seen >= now() - interval '7 days'),
  (select count(*) from (select * from acc limit 10000) t where first_seen >= now() - interval '7 days'),
  (select count(*) from acc where first_seen >= now() - interval '7 days')
union all select 'accounts_active_7d_real', null, null,
  (select count(*) from public.account_first_seen a
     where exists (select 1 from public.analytics_events e
                   where e.account_ref = a.account_ref
                     and e.created_at >= now() - interval '7 days'))
union all select 'accounts_inactive_30d_real', null, null,
  (select count(*) from public.account_first_seen a
     where not exists (select 1 from public.analytics_events e
                       where e.account_ref = a.account_ref
                         and e.created_at >= now() - interval '30 days'));
```
</details>

<details>
<summary><b>3 · Nulos, vacíos y cardinalidad de identidad</b></summary>

```sql
select count(*) as filas_30d,
  count(*) filter (where session_id is null)  as sid_null,
  count(*) filter (where session_id = '')     as sid_vacio,
  count(*) filter (where visit_id is null)    as vid_null,
  count(*) filter (where visit_id = '')       as vid_vacio,
  count(*) filter (where account_ref is null) as acc_null,
  count(*) filter (where account_ref = '')    as acc_vacio,
  count(distinct session_id) as sid_distintos,
  count(distinct visit_id)   as vid_distintos,
  count(distinct account_ref) as acc_distintos,
  count(distinct surface) as surfaces, count(distinct container) as containers,
  count(distinct country) as paises
from public.analytics_events where created_at >= now() - interval '30 days';
```
</details>

<details>
<summary><b>4 · Ventanas: semana UTC vs 7 d móvil vs día UTC, y cohortes reales</b></summary>

```sql
select 'accounts_semana_utc (lun 00:00 UTC)' as ventana,
  (select count(distinct account_ref) from public.analytics_events
     where account_ref is not null
       and created_at >= date_trunc('week', now() at time zone 'UTC')) as cuentas
union all select 'accounts_7d_movil',
  (select count(distinct account_ref) from public.analytics_events
     where account_ref is not null and created_at >= now() - interval '7 days')
union all select 'accounts_dia_utc',
  (select count(distinct account_ref) from public.analytics_events
     where account_ref is not null
       and created_at >= date_trunc('day', now() at time zone 'UTC'))
union all select 'accounts_historicas_tabla',   (select count(*) from public.account_first_seen)
union all select 'accounts_historicas_eventos',
  (select count(distinct account_ref) from public.analytics_events where account_ref is not null)
union all select 'installs_7d_movil',
  (select count(*) from public.session_first_seen where first_seen >= now() - interval '7 days')
union all select 'installs_historicos', (select count(*) from public.session_first_seen)
union all select 'cohorte_d1_real (first_seen 1-8 dias)',
  (select count(*) from public.session_first_seen
     where first_seen >= now() - interval '8 days' and first_seen < now() - interval '1 day')
union all select 'cohorte_d7_real (first_seen 7-14 dias)',
  (select count(*) from public.session_first_seen
     where first_seen >= now() - interval '14 days' and first_seen < now() - interval '7 days');
```
</details>

<details>
<summary><b>5 · El span real de las 1.000 filas más nuevas</b></summary>

```sql
with top1000 as (
  select created_at, session_id from public.analytics_events
  order by created_at desc limit 1000
)
select round(extract(epoch from (max(created_at) - min(created_at)))/60.0, 1) as span_minutos,
       min(created_at) as mas_viejo, max(created_at) as mas_nuevo,
       count(distinct session_id) as sesiones_en_la_ventana
from top1000;
```
</details>

<details>
<summary><b>6 · Eventos por día</b></summary>

```sql
select date(created_at) as dia_utc, count(*) as eventos,
  count(distinct session_id) as sesiones, count(distinct visit_id) as visitas,
  count(distinct account_ref) as cuentas,
  count(*) filter (where event = 'app_opened') as app_opened_filas,
  count(distinct session_id) filter (where event = 'app_opened') as app_opened_sesiones
from public.analytics_events where created_at >= now() - interval '14 days'
group by 1 order by 1 desc;
```
</details>

<details>
<summary><b>7 · Fuentes, superficies, contenedores y países reales</b></summary>

```sql
select 'leaderboard_full_v' as fuente, count(*)::text as valor from public.leaderboard_full_v
union all select 'victories', count(*)::text from public.victories
union all select 'victories_distinct_player', count(distinct player)::text from public.victories
union all select 'welcome_pack_claims', count(*)::text from public.welcome_pack_claims
union all select 'surface='||coalesce(surface,'(null)'), count(*)::text
  from public.analytics_events where created_at >= now() - interval '30 days' group by surface
union all select 'container='||coalesce(container,'(null)'), count(*)::text
  from public.analytics_events where created_at >= now() - interval '30 days' group by container
union all select 'sesiones_por_surface='||coalesce(surface,'(null)'), count(distinct session_id)::text
  from public.analytics_events where created_at >= now() - interval '30 days' group by surface
union all select 'top_paises_30d_reales',
  string_agg(p.country||':'||p.n, ' · ' order by p.n desc)
  from (select country, count(distinct session_id) n from public.analytics_events
        where created_at >= now() - interval '30 days' and country is not null
        group by 1 order by 2 desc limit 8) p;
```
</details>

<details>
<summary><b>8 · Tamaño de cada fuente de /stats</b></summary>

```sql
select relname as tabla, n_live_tup as filas_aprox
from pg_stat_user_tables
where schemaname = 'public'
  and relname in ('victories','scores','score_saves','score_attempts','welcome_pack_claims',
                  'pack_purchases','peones_ledger','account_first_seen','session_first_seen',
                  'analytics_events','coach_analyses')
order by n_live_tup desc;
```
</details>

<details>
<summary><b>9 · Sonda HTTP del techo de PostgREST (GET, read-only)</b></summary>

```
GET {SUPABASE_URL}/rest/v1/{tabla}?select=…&order=…
Headers: apikey · Authorization · Range: <rango> · Prefer: count=exact
Se imprime SÓLO: status, cantidad de filas y Content-Range. Nunca la clave, nunca una fila.

account_first_seen  Range:0-9999    → 206 · 1000 filas · Content-Range 0-999/3066
account_first_seen  Range:0-999     → 206 · 1000 filas · Content-Range 0-999/3066
account_first_seen  Range:0-1500    → 206 · 1000 filas · Content-Range 0-999/3066
account_first_seen  Range:1000-2999 → 206 · 1000 filas · Content-Range 1000-1999/3066
analytics_events    Range:0-9999    → 206 · 1000 filas · Content-Range 0-999/148588
leaderboard_full_v  HEAD count=exact→ 200 ·   n/a      · Content-Range 0-290/291
```
</details>

<details>
<summary><b>10 · Sonda de caché y frescura (GET)</b></summary>

```
curl -sL https://play.chesscito.com/en/stats                 → generatedAt 18:07 UTC · MISS
curl -sL https://play.chesscito.com/en/stats?surface=learn   → generatedAt 18:13 UTC · MISS
curl -sL https://learn.chesscito.com/en/stats  (1.ª)         → generatedAt 12:51 UTC  ← 5h22
curl -sL https://learn.chesscito.com/en/stats  (2.ª y 3.ª)   → generatedAt 18:13 UTC
cabeceras: cache-control: private, no-cache, no-store · x-vercel-cache: MISS · age: 0
```
</details>

---

## 23. Referencias

| Documento | Para qué |
|---|---|
| `docs/handoffs/2026-08-04-public-stats-audit-handoff.md` | encargo de esta auditoría, hipótesis iniciales |
| `docs/handoffs/2026-08-04-launch-stabilization-handoff.md` | estado estable heredado, pendientes |
| `docs/audits/2026-08-04-telemetry-session-p95-audit.md` | duplicados 8,6 %, `session_id` multi-visita, y el mismo error de categoría en otra forma |
| `docs/audits/2026-08-04-vercel-usage-http-400-audit.md` | precedente: una respuesta cuyo cuerpo el colector descartaba |
| `docs/runbooks/launch-health-monitor.md` | §7ter — cómo se corrigió el p95 contando en la base |

---

## 24. Estado al cierre

**Detenido antes de implementar, como pedía el encargo.**

```
git status --short
 M SESSION.md
```

Un solo archivo modificado, el mismo con el que arrancó la sesión, sin stagear.
Ningún commit, ningún push, ningún deploy, ninguna escritura, ningún cambio de configuración.
`/stats` sigue pública y sin wallet.
