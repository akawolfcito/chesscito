# Spec — Tabla completa de jugadores en `/stats`

**Fecha:** 2026-07-30
**Estado:** ✅ **v2 — red team aplicado (F1–F7), listo para implementar.**
**Red team:** `2026-07-30-stats-full-players-table-redteam.md` (veredicto original: NEEDS
REVISION; las siete correcciones están incorporadas y marcadas en su lugar)
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
/** The population. Same counting function that feeds the Leaders hero (§6).
 *  `null` = the count read failed. It does NOT mean the table is empty. */
playersTotal: number | null;
```

⛔ **Las filas y el conteo son DOS lecturas independientes y fallan por separado** (F3 del
red team). Las cuatro combinaciones son alcanzables y ninguna colapsa en otra:

| filas | conteo | Qué se hace |
|---|---|---|
| hay | hay | caso normal |
| hay | `null` | **renderizar la tabla SIN el total.** Nunca esconderla: se perdería justo el dato que el usuario vino a buscar por no poder imprimir un número al lado. ⛔ Y el total **no cae a `rows.length`** — es el defecto que ya hay un source guard prohibiendo en Leaders. |
| vacío | `0` | board realmente vacío → mensaje explícito |
| vacío | `null` | la sección se oculta entera |

`LeaderboardIdentityRow` **ya existe** (`rank`, `rowId`, `variant`, `totalScore`,
`isVerified`, `hasOnchain`) y ya es Identity Lite.

⛔ **Ninguna wallet sale del servidor.** El mapeo `wallet → rowId + variant` ocurre
server-side y descarta la address, igual que `aggregateTopMinters`. Hay un test que fija
que el payload serializado no contiene `"0x"`; **la tabla hereda esa aserción**.

### 4.1 El techo de filas

`PLAYERS_TABLE_CEILING = 500`. La tabla pagina **en el cliente** sobre el snapshot, como
recomienda el backlog: encaja con `revalidate = 3600` + `unstable_cache` y no agrega una
superficie de paginado server-side que pueda divergir.

⚠️ **Si el conteo supera el techo, la tabla lo declara EN SU PROPIO ENCABEZADO** (F6 del red
team). El aviso global de `dataIntegrity` vive arriba de todo (`stats-page.tsx:759`) porque
describe lecturas de toda la página; la tabla está al fondo, y quien llega hasta ella ya no
tiene ese aviso en pantalla. **La declaración va donde se hace la afirmación.** El aviso
global sigue haciendo lo suyo, sin cambios.

Con 17 jugadores esto no pasa hoy; se escribe ahora porque el día que pase, una tabla que
muestra 500 de 900 sin decirlo es otra vez un número que miente.

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

### 4.3 Orden y desempate — cerrado como DEUDA TÉCNICA, no como semántica

`leaderboard_full_v` ordena:

```sql
RANK() OVER (ORDER BY SUM(sub.best_score) DESC, sub.player ASC)
```

El desempate es **la dirección de la wallet, ascendente** (F4 del red team). En el podio de
10 no se nota; en un censo, dos jugadores con el mismo score quedan uno encima del otro y
**la razón del orden no está en la pantalla** — es el campo que Identity Lite promete no
exponer.

**Investigado antes de decidir (2026-07-30).** ¿Existe un timestamp que represente cuándo se
alcanzó el total all-time actual, para alinear con weekly (*"quién llegó primero"*)?

- `score_saves.created_at` — `not null default now()` ✅
- `scores.created_at` — `default now()`, **nullable**, y es cuándo se registró la fila en
  Supabase, **no** el block time de la tx.
- **El timestamp semántico NO existe**: habría que derivarlo (por `(player, level_id)`, el
  `created_at` de la fila que sostiene el `MAX(score)`; por jugador, el máximo de esos), y eso
  es **una columna nueva en la vista → migración**.

**Decisión: se mantiene el orden actual, documentado como desempate técnico, y el cambio
semántico se difiere a su propio cluster.** Motivos, en orden:

1. Reordenar empates **cambia el `rank` de jugadores vivos en prod**, y §7.1 pone Leaders
   explícitamente fuera de este cluster.
2. El `NULL` de `scores.created_at` necesita una decisión de `COALESCE` que hoy nadie tomó.
3. *"Cuándo completaste tu total actual"* **no es** la misma regla que el *"quién llegó
   primero"* de weekly. Alinearlas de verdad es una decisión de producto, no un `ORDER BY`.

⚠️ **Lo que SÍ se garantiza en este cluster:** el orden es **estable y determinista** — la
clave de orden incluye `player`, así que es total y no depende de plan de query ni de
paginado. Dos cargas de la misma página dan el mismo orden.

📌 **Lo que queda abierto**, para cuando aparezca el primer empate visible: la tabla no puede
explicar por qué un jugador está sobre otro con el mismo score. Hoy no hay empates; el día
que los haya, es una pregunta legítima sin respuesta en pantalla.

## 5. UI — estados y transiciones

### 5.0 La tabla se AGREGA, no reemplaza nada

**Decisión del founder (2026-07-30):** el bloque *Community Leaderboard* (top-10,
`stats-page.tsx:1188`) **se queda intacto**. La tabla nueva va **inmediatamente después**.

Corrige una propuesta mía anterior que lo reemplazaba. Lo que ya funciona no se toca: el
pedido era hacer auditable un número, no rediseñar la página.

⚠️ **Entonces hay dos listas en la misma pantalla, y tienen que leerse distinto o compiten.**
Los encabezados hacen ese trabajo:

- *Community Leaderboard* → sigue como está. Es el **podio**.
- Tabla nueva → *"Every ranked player"* + la línea de que **no la afectan los filtros de
  arriba**. Es el **censo**.

Podio y censo responden preguntas distintas: quién va ganando, y cuántos hay. Si los dos
encabezados dijeran lo mismo, la segunda lista parecería un duplicado roto.

### 5.1 Paginado — `PAGE_SIZE = 10`

**Decisión del founder (2026-07-30): 10 filas por página, paginador desde el registro 11.**
Con los 17 jugadores de hoy la tabla arranca **con paginador visible y 2 páginas**, que es
el comportamiento que se espera ver de entrada.

El propósito declarado es que la página no se vuelva infinita: con techo de 10 filas, el
bloque mide lo mismo con 17 jugadores que con 900.

⚠️ **`PAGE_SIZE = 10` coincide en valor con `BOARD_CUT = 10` y NO tiene ninguna relación con
él.** Uno es el podio de Leaders (espejo de un `LIMIT 10` en SQL), el otro es cuántas filas
entran en una página de esta tabla. **Constantes separadas, en archivos separados.** Que hoy
valgan lo mismo es coincidencia, y compartirlas ataría el podio al paginado para siempre.

| Estado | Qué se ve |
|---|---|
| **Normal** | Encabezado + total + **sello de tiempo pegado al total** (§5.2) + tabla paginada. El encabezado **declara que es global**: *"Every ranked player — not affected by the filters above."* |
| **≤ 10 jugadores** | Una sola página; los controles **no se renderizan**. |
| **> 10 jugadores** | Prev / Next + indicador `Page N of M`. Sin salto de scroll al cambiar de página. **Es el estado real de hoy** (17 → 2 páginas). |
| **Última página corta** | 17 = 10 + 7 → `Page 2 of 2` con 7 filas. **Sin filas vacías de relleno**: a 390 px se leen como jugadores fantasma. |
| **Vacío (0 jugadores)** | Mensaje explícito. **No es un error** y no debe parecerlo. |
| **Filas OK, conteo falló** | Tabla completa **sin** el total (§4). ⛔ Nunca ocultarla, nunca caer a `rows.length`. |
| **Sin filas y sin conteo** | La sección **se oculta entera**. Una tabla vacía sobre un board poblado afirmaría que no hay jugadores. |
| **Truncado por el techo** | Aviso **en el encabezado de la tabla** (§4.1): lo mostrado es un límite de transporte, no la población. |
| **Total ≠ filas mostradas** | Sólo puede pasar truncado, o con el conteo caído. Fuera de eso `playersFull.length === playersTotal`, y hay un test que lo fija. |

### 5.2 ⛔ El sello de tiempo va PEGADO al total

El hero de Leaders se sirve **en vivo** por request; esta tabla sale del snapshot horario.
Durante hasta una hora después de que entre un jugador nuevo, **Leaders dice 18 y esta tabla
dice 17** (F1 del red team). El jugador cuenta, no le da, y concluye que uno de los dos miente
— en la pantalla que existía para que ese número cerrara.

La página ya trae *"Updated hourly · As of …"*, pero está arriba de todo
(`stats-page.tsx:747`) y la tabla vive ocho secciones más abajo: cuando llegás, ese sello no
está en pantalla. **La declaración va en la misma superficie donde se hace la afirmación**
→ [[feedback_an_unauditable_number_reads_as_a_lie]].

**Edge cases**
- Cambiar `surface`/`container` **no cambia la tabla**. Es correcto y por eso el encabezado
  lo dice. Sin esa línea se lee como un bug de render.
- Un jugador con score 0 aparece si la vista lo rankea. La vista decide, no la tabla.
- Empates de score: el orden lo da `rank` de la vista, **nunca** el índice del array — un
  índice de cliente renumeraría en silencio una lectura truncada o paginada.
- ⚠️ **Las filas se keyean por `rowId`, jamás por nickname.** El espacio de nicknames es
  6 piezas × 6 estilos × 10000 = **360.000**, así que al techo de 500 hay ~29% de
  probabilidad de dos filas con el mismo nombre visible (F5 del red team). Keyear por nombre
  haría que React colapse filas. ⛔ **Y nada deduplica por nombre**: `aggregateTopMinters`
  deduplica por `rowId`, y copiar ese patrón acá **borraría jugadores**.
- ⛔ **No escribir un test que fije unicidad de nicknames visibles** — sería fijar algo falso.
- La página es `noindex` desde `5595722`, así que la tabla no entra en resultados de
  búsqueda. No hay que hacer nada extra.

**Copy (MiniPay §3):** nada de *wallet* como identificador visible, ni direcciones `0x…`.
Se muestra el nickname generado + avatar, igual que el resto de la página
→ [[project_custom_name_never_leaves_the_device]].

## 6. Invariante que este spec existe para proteger

Versión anterior (**descartada**): *"el total de la tabla y el del hero son el mismo número"*.
Es falsa en producción — uno es en vivo y el otro es de hace hasta una hora (§5.2).

> **El total de la tabla y el del hero de Leaders salen de la MISMA función de conteo sobre
> la MISMA relación. Cualquier diferencia entre ellos es antigüedad del snapshot, nunca
> método.**

**Se garantiza por construcción, no por comparación:** un solo `countRankedPlayers`
compartido. El test afirma **el acoplamiento** — que el aggregator de `/stats` llama a la
misma función que alimenta el hero — no que dos números coincidan.

⚠️ El test comparativo que proponía la versión anterior **cruzaba la frontera de §7.1**
(tocaba `/api/leaderboard`) y además **pasaba en verde mientras los dos números divergían en
prod**: con la vista mockeada, los dos leen el mock y coinciden. El cache no está en el test.

## 7. Plan de trabajo (TDD, commits atómicos)

| # | Etapa | Test primero |
|---|---|---|
| 1 | `fetchFullLeaderboardFromDb` | Lee `leaderboard_full_v`, respeta el techo, **no** lee `leaderboard_combined_v`. |
| 2 | Identity Lite en el aggregator | Ninguna wallet en la salida (`"0x"` ausente); `rank` viene de la vista; **filas y conteo fallan por separado** (las 4 combinaciones de §4). |
| 3 | Cache propia sin filtros | Con el seam de §4.2: dos filtros distintos, **una** sola lectura de la tabla. |
| 4 | 🆕 `players-table.tsx` **cliente** | El paginado necesita estado y `stats-page.tsx` **no tiene `"use client"`** (F2). Componente chico y dedicado; **no** convertir las 1537 líneas del dashboard. |
| 5 | Render + adyacencia | Los estados de §5.1, el sello de tiempo pegado al total (§5.2), el techo en el encabezado (§4.1), key por `rowId` (§5.2). |
| 6 | Inserción en la página | La tabla queda **después** del top-10, y **el top-10 renderiza exactamente igual que antes** (test de no-regresión sobre ese bloque). |
| 7 | Invariante §6 | El aggregator llama a **la misma función de conteo** que el hero. |

### 7.1 ⛔ Frontera de cambio: sólo `/stats`

Este cluster **no toca** Leaders, `leaderboard-sheet.tsx`, `BOARD_CUT`,
`/api/leaderboard`, ni la ventana weekly. Nada de lo que hoy corre en prod cambia de
comportamiento.

Los archivos que se tocan son:

- `lib/supabase/queries.ts` — **sólo agrega** `fetchFullLeaderboardFromDb`; las funciones
  existentes no se editan.
- `lib/stats/public-aggregator.ts` — dos campos nuevos en `PublicStats`.
- `components/stats/players-table.tsx` — **archivo nuevo, `"use client"`** (F2 del red team).
- `components/stats/stats-page.tsx` — un bloque nuevo, después del top-10.

Cualquier diff fuera de esa lista es señal de que el cluster se desbordó.

**Verificación final** (una sola corrida): suite de `web`, `pnpm exec tsc --noEmit`,
`content:audit`.

## 8. Riesgos y preguntas abiertas

1. ✅ **RESUELTO** — la tabla se agrega, no reemplaza (§5.0, founder 2026-07-30).
2. ⚠️ **`fetchLeaderboardFromDb` usa RPC con fallback a la vista** porque el schema cache de
   PostgREST puede estar viejo (`queries.ts:112`). La función nueva **debería seguir el mismo
   patrón** o va a fallar en el mismo escenario en que la vieja fue endurecida. No hay RPC
   `get_full_leaderboard` hoy — o se agrega, o se acepta lectura directa a la vista y se
   documenta la diferencia.
3. 🟢 Sin migración, sin contratos, sin cambios de acceso. Reversible con un revert.
4. ✅ **RESUELTO** — `PAGE_SIZE = 10`, paginador desde 11 (§5.1, founder 2026-07-30).
5. ✅ **RESUELTO** — última página corta: `Page 2 of 2` sin relleno (§5.1).
6. ✅ **CERRADO como deuda técnica** — el desempate por wallet se conserva y se documenta;
   el cambio semántico se difiere (§4.3, founder 2026-07-30).
7. 🅿️ **DIFERIDO a su propio cluster: alinear el desempate de all-time con weekly.** Necesita
   una columna derivada en `leaderboard_full_v` (migración), una decisión de `COALESCE` para
   el `scores.created_at` nullable, y aceptar que cambia el `rank` de jugadores vivos en prod.
   **Retomarlo cuando aparezca el primer empate visible**, que hoy no existe.
