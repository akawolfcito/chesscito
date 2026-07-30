# Spec — Tabla completa de jugadores en `/stats`

**Fecha:** 2026-07-30
**Estado:** DRAFT — pendiente de red team
**Backlog:** `docs/backlog/2026-07-10-backlog-index.md` §Tabla completa de jugadores

---

## 1. El trabajo de esta pantalla

El hero de Leaders dice **17 jugadores** al lado de una lista de 10. El label `TOP 10 OF 17`
(`27b61de`) tapa el hueco de percepción, pero **la lista completa no existe en ninguna
superficie**: hoy no hay dónde ir a contar los 17.

Esta tabla es ese lugar. Su único trabajo es **hacer auditable un número que ya afirmamos**
→ [[feedback_an_unauditable_number_reads_as_a_lie]]. Todo lo demás (ordenar, filtrar,
buscar) es secundario y no va en v1.

## 2. Decisión de scope: la tabla es GLOBAL

**Decisión del founder (2026-07-30): la tabla NO respeta los filtros `surface`/`container`
de la página. Muestra siempre la población completa.**

El motivo es medible. Hoy en prod las dos ventanas de Leaders tienen reglas distintas:

| Endpoint | Scope | Total |
|---|---|---|
| `?window=alltime` | **global** (sin campo `surface`) | **17** |
| `?window=weekly` | **surface-scoped** (`surface: "learn"`) | 4 |

Si la tabla respetara los filtros, con `surface=learn` mostraría menos de 17 mientras
Leaders sigue diciendo 17 — y volveríamos a tener un número que el jugador no puede
reconciliar con lo que ve, que es exactamente el defecto que esta tabla vino a cerrar.
Siendo global, **el conteo cierra por construcción**, sin depender de que nadie entienda
un filtro.

⚠️ **Costo aceptado:** es el único bloque de la página que no reacciona a los filtros.
**Eso hay que decirlo en su encabezado**, no dejar que se descubra.

## 3. Fuente: la relación que el hero ya cuenta

`leaderboard_full_v` — la relación **sin cortar** sobre la que `get_player_rank` rankea y
sobre la que `countRankedPlayers` hace `count: "exact", head: true` para producir el 17
(`lib/supabase/queries.ts:179`).

⛔ **La tabla y el hero leen la MISMA relación, y el total sale de UN solo conteo.** Dos
conteos sobre dos fuentes es cómo se fabrica la próxima discrepancia. `leaderboard_combined_v`
es el corte de 10 y respondería 10 para siempre — no se usa acá.

🟢 **Sin migración, sin schema nuevo.** La vista ya existe y `service_role` ya puede leerla
(verificado por medición en prod el 2026-07-29).

## 4. Contrato (SDD)

```ts
// lib/supabase/queries.ts
/** Uncut ranking, Identity Lite. `rank` comes from the view, not from the
 *  array index — a client-side index would silently renumber a truncated read. */
export async function fetchFullLeaderboardFromDb(
  limit: number,
): Promise<LeaderboardRow[]>;
```

```ts
// PublicStats gana dos campos
/** Full ranking, Identity Lite, GLOBAL (ignores filters by design — §2).
 *  Empty on query failure: the table hides rather than showing a short list
 *  that would read as "these are all the players". */
playersFull: LeaderboardIdentityRow[];
/** The population. Same single count that feeds the Leaders hero. */
playersTotal: number | null;
```

`LeaderboardIdentityRow` **ya existe** (`rank`, `rowId`, `variant`, `totalScore`,
`isVerified`, `hasOnchain`) y ya es Identity Lite.

⛔ **Ninguna wallet sale del servidor.** El mapeo `wallet → rowId + variant` ocurre
server-side y descarta la address, igual que `aggregateTopMinters`. Hay un test que fija
que el payload serializado no contiene `"0x"`; **la tabla hereda esa aserción**.

### 4.1 El techo de filas

`PLAYERS_TABLE_CEILING = 500`. La tabla pagina **en el cliente** sobre el snapshot, como
recomienda el backlog: encaja con `revalidate = 3600` + `unstable_cache` y no agrega una
superficie de paginado server-side que pueda divergir.

⚠️ **Si el conteo supera el techo, la tabla lo declara** — reusa el aviso de
`dataIntegrity` que la página ya tiene, no inventa uno nuevo. Con 17 jugadores esto no
pasa hoy; se escribe ahora porque el día que pase, una tabla que muestra 500 de 900 sin
decirlo es otra vez un número que miente.

⚠️ **El corte de Leaders (`BOARD_CUT = 10`) y este techo son cosas distintas y no deben
compartirse.** Uno es el podio, el otro es un límite de transporte.

### 4.2 Cache: no la metas en la key de los filtros

El snapshot cachea por `(surface, container)`. La tabla es **global**, así que meterla ahí
la duplica idéntica en cada combinación de filtros.

**Va en su propia entrada de cache**, sin filtros en la key. Una agregación para toda la
página, no una por combinación.

⚠️ El test de reuso necesita el seam de `lib/content/merged-catalog.ts:350`:
`unstable_cache` lanza `incrementalCache missing` fuera de un request de Next
(`app/api/scores/save/__tests__/route.test.ts:17`), así que en vitest **no hay cache** y un
test escrito de frente pasa en verde contra un memoizador que nunca memoiza.

## 5. UI — estados y transiciones

La tabla **reemplaza** el bloque *Community Leaderboard* (top-10) que hoy vive en
`stats-page.tsx:1188`. Dos rankings en la misma página compiten y ninguno se lee como la
fuente. El podio ya vive en Leaders.

| Estado | Qué se ve |
|---|---|
| **Normal** | Encabezado + total + tabla paginada. El encabezado **declara que es global**: *"Every ranked player — not affected by the filters above."* |
| **Una sola página** | Los controles de paginado **no se renderizan**. Con 17 jugadores este es el estado real de hoy. |
| **Varias páginas** | Prev / Next + indicador `Page N of M`. Sin salto de scroll al cambiar de página. |
| **Vacío (0 jugadores)** | Mensaje explícito. **No es un error** y no debe parecerlo. |
| **Query falló** (`playersFull: []` con `playersTotal: null`) | La sección **se oculta entera**. Una tabla vacía sobre un board poblado afirmaría que no hay jugadores. |
| **Truncado por el techo** | Aviso de `dataIntegrity`: lo mostrado es un límite de transporte, no la población. |
| **Total ≠ filas mostradas** | Sólo puede pasar truncado. En cualquier otro caso `playersFull.length === playersTotal`, y hay un test que lo fija. |

**Edge cases**
- Cambiar `surface`/`container` **no cambia la tabla**. Es correcto y por eso el encabezado
  lo dice. Sin esa línea se lee como un bug de render.
- Un jugador con score 0 aparece si la vista lo rankea. La vista decide, no la tabla.
- Empates de score: el orden lo da `rank` de la vista, no el índice del array.
- La página es `noindex` desde `5595722`, así que la tabla no entra en resultados de
  búsqueda. No hay que hacer nada extra.

**Copy (MiniPay §3):** nada de *wallet* como identificador visible, ni direcciones `0x…`.
Se muestra el nickname generado + avatar, igual que el resto de la página
→ [[project_custom_name_never_leaves_the_device]].

## 6. Invariante que este spec existe para proteger

> **El total que muestra la tabla y el total que muestra el hero de Leaders son el mismo
> número, porque son el mismo conteo sobre la misma relación.**

Test explícito: mockear la vista con N filas y verificar que `playersTotal`, la longitud de
`playersFull` y el `total` del endpoint de Leaders coinciden.

## 7. Plan de trabajo (TDD, commits atómicos)

| # | Etapa | Test primero |
|---|---|---|
| 1 | `fetchFullLeaderboardFromDb` | Lee `leaderboard_full_v`, respeta el techo, **no** lee `leaderboard_combined_v`. |
| 2 | Identity Lite en el aggregator | Ninguna wallet en la salida (`"0x"` ausente); `rank` viene de la vista. |
| 3 | Cache propia sin filtros | Con el seam de §4.2: dos filtros distintos, **una** sola lectura de la tabla. |
| 4 | Render + paginado | Los 7 estados de §5, incluido "una sola página sin controles". |
| 5 | Reemplazo del top-10 | El bloque viejo desaparece; nada más de la página se mueve. |
| 6 | Invariante §6 | El conteo de la tabla y el del hero coinciden. |

**Verificación final** (una sola corrida): suite de `web`, `pnpm exec tsc --noEmit`,
`content:audit`.

## 8. Riesgos y preguntas abiertas

1. ⚠️ **Reemplazar el top-10 es una decisión de producto que tomé yo.** Si preferís que
   convivan, es cambiar la etapa 5 — pero entonces hay que explicar en pantalla por qué hay
   dos listas.
2. ⚠️ **`fetchLeaderboardFromDb` usa RPC con fallback a la vista** porque el schema cache de
   PostgREST puede estar viejo (`queries.ts:112`). La función nueva **debería seguir el mismo
   patrón** o va a fallar en el mismo escenario en que la vieja fue endurecida. No hay RPC
   `get_full_leaderboard` hoy — o se agrega, o se acepta lectura directa a la vista y se
   documenta la diferencia.
3. 🟢 Sin migración, sin contratos, sin cambios de acceso. Reversible con un revert.
4. **¿Cuántas filas por página?** Asumo **25**. A 390 px son ~2 scrolls.
