# Handoff — Slice 3, identidad de intento (etapas 1, 2, 3 y 4A cerradas)

**Fecha**: 2026-07-28
**Branch**: `feat/attempt-identity-slice-3` — **13 commits, SIN PUSHEAR**. El push es del founder.
Sin merge y sin deploy: la branch queda quieta hasta que el founder decida.
**Suite**: **6418 passing / 549 archivos, EXIT=0**. `tsc --noEmit` limpio. Lint limpio.
**Spec**: `docs/specs/2026-07-28-attempt-identity-score-attempts.md` — **CLOSED en v7**, D1–D20 congeladas.

## Estado en una línea

**Slice 3 NO está terminado.** Etapa 1 (los dos módulos puros), **etapa 2 (DEBT-1 + DEBT-2)**,
**etapa 3 (`gradeAttempt` + inventario)** y **etapa 4A (el catálogo servido)** están CLOSED. Lo
que sigue es la migración + el RPC.

---

## Etapa 4A — CLOSED

| Commit | Qué cerró |
| --- | --- |
| `c79e6fe` | Los siete pools obligatorios, el passthrough, y unicidad global de id |
| `c5063cb` | El provider de `/exercises` montaba cinco pools de siete |

**Decisión del founder**: ensanchar `MergedCatalog`. **No** construir un catálogo paralelo
dentro de `gradeAttempt`.

Los siete pools de `BaselineCatalog` ahora son **obligatorios**. Cinco eran opcionales "para que
los fixtures parciales siguieran valiendo", y el costo de esa comodidad fue invisible: un campo
opcional que nadie setea se ve igual que uno que no hace falta. Obligatorio significa que
`MergedCatalog` satisface `GradingCatalog` **por asignación, sin cast** — agregar un bucket allá
y olvidarlo acá es un error de tipos, no un `unknown_exercise` en la wire seis semanas después.

**Unicidad global de id.** Un id es la clave del catálogo entre **todos** los pools, no por pool:
`gradeAttempt` busca escaneando y grada con el primer hit, así que un id duplicado lo gradaría el
bucket que gane el escaneo —un conteo de movimientos entregado a un grader de cobertura, en
silencio—. `buildCatalog` ya lo garantiza dentro de una build; el overlay es el único camino que
puede romperlo, porque sus filas se construyen de a una y nunca ven los otros pools. Ahora
`mergeOverlay` descarta una fila cuyo id pertenece a otro pool, y mantiene el índice de dueños
**mientras** aplica, así que dos filas de overlay tampoco chocan entre sí.
`duplicateExerciseIds(pools)` queda exportado; el catálogo enviado da `[]`.

### ⚠️ El test que estaba verde y no probaba nada

La primera versión del test de `gradeAttempt` contra el catálogo servido mockeaba
`getSupabaseServer` en `null`. Eso toma el **atajo baseline-only**, que devuelve el objeto
baseline verbatim y **nunca llama a `mergeOverlay`** — o sea, probaba la rama que no es la de
producción. Quedó **verde con `safePath` vaciado del merge**. Se descubrió por mutación, no por
lectura. Ahora el mock devuelve un overlay de **cero filas**, así que el merge real corre y los
ids siguen siendo los enviados (`source === "baseline+overlay"`, `overlayCount === 0`).

**Mutaciones verificadas**: vaciar `safePath` en el merge rompe 4 casos; desactivar el guard de
colisión rompe 2.

### Consumidores revisados

- 🔧 `page.tsx` — montaba cinco pools; `queens`, `safePath` y `promotionRun` caían al baseline en
  cada selector. **Corregido**: hoy no se veía porque el overlay no maneja esos kinds; el día que
  los maneje, la pantalla mezclaría catálogo staged con baseline sin decirlo.
- ✅ `catalog-context.tsx` — ya declaraba los siete (opcionales, con fallback al baseline). Sin
  cambios: ahí el opcional **sí** es el contrato, porque un consumidor sin provider debe caer al
  baseline.
- ✅ `page.test.tsx` — su fixture es un mock suelto, no tipado contra `MergedCatalog`. Sin cambios.
- ✅ `scripts/verify-catalog-source.ts` — lee `source`/`overlayCount`, no los pools.

---

## Etapa 3 — CLOSED

| Commit | Qué cerró |
| --- | --- |
| `5675cf4` | `gradeAttempt`, la tabla de los 7 buckets, y el comentario de `catalog.ts` |
| `4c20314` | Un `as` en el gate de kind que no estrechaba nada |

`apps/web/src/lib/scores/attempt-grading.ts`. Los siete buckets se declaran en **una tabla**
—pool, la única clase de medición que aceptan, y el grader canónico que llaman—. **No hay
ninguna fórmula escrita en el módulo**: cada estrella sale del módulo que la posee. Copiar un
grader ahí habría sido una segunda fuente de verdad para el scoreboard.

| Familia | Pool | Medición | Grader | Rango | ¿0? |
| --- | --- | --- | --- | --- | --- |
| `exercise` | `exercises` | `moves` | `computeStars` | 1–3 | no |
| `labyrinth` | `labyrinths` | `moves` | `labyrinthStars` | 0–3 | **sí** |
| `diagonal-run` | `diagonalRun` | `moves` | `labyrinthStars` | 0–3 | **sí** |
| `safe-path` | `safePath` | `moves` | `labyrinthStars` | 0–3 | **sí** |
| `promotion-run` | `promotionRun` | **`failures`** | `promotionRunStars` | 1–3 | no |
| `queens` | `queens` | `coverage` | `tourStars` | 0–3 | **sí** |
| `knight-tour` | `knightTour` | `coverage` | — | **starless** | `null` |

Los rangos **no están declarados, están medidos**: el test barre el dominio entero de un nivel
real por bucket (1…ceiling, 0…99, 0…ceiling) y compara el mínimo y el máximo. Los pisos de 0 y
de 1 se miden en vez de creerse.

### `coverageCeilingFor` = `optimalMoves + 1`, y no es un ajuste

Los dos boards **cuentan la pieza inicial** en lo que reportan: `KnightTourBoard` siembra
`visited` con START y reporta `reachableSquares(...).length` (`:71,:139`); `QueensBoard` siembra
`queens` con START y reporta `maxQueens(...)` (`:95,:114,:164`). El catálogo guarda ese tamaño
**menos uno** (`catalog.ts:239` y `:257`), porque ahí `optimalMoves` contesta "cuánto le queda al
jugador".

Errarle por uno grada **toda corrida perfecta al 90%**, que `tourStars` llama 2 estrellas, para
siempre y sin decirlo. El test lo verifica contra `reachableSquares` y `maxQueens` —la aritmética
de los boards— sobre **todos** los niveles enviados, y **no** contra el campo del que se deriva:
comparar con `optimalMoves + 1` solo repetiría la implementación.

### `catalog.ts` corregido

Decía que promotion-run *"feeds `labyrinthStars`"*. Mandaba al grader equivocado: toda corrida
ganadora desde la fila r mide exactamente `7 - r`, así que esa función regalaría tres estrellas a
todo el mundo. Corregido en el mismo commit que el grader, porque el inventario se escribe
leyendo ese comentario.

### EDD / red team de la etapa

**Verificado por mutación** (no por lectura):

- Bajar el ceiling de cobertura en uno → **3 casos en rojo**. ⚠️ Los tests de barrido **no** lo
  cazan: calculan el ceiling con la misma función, así que son circulares para ese número. Ese
  agujero es exactamente lo que el test derivado de los boards existe para tapar.
- Cablear `exercise` a `labyrinthStars` → **2 casos en rojo**.

**Hallazgos que quedan abiertos:**

1. ✅ **RESUELTO en 4A** — `getMergedCatalog()` no satisfacía `GradingCatalog`: le faltaban
   `safePath` y `promotionRun`. Ensanchado por decisión del founder (ver etapa 4A).
2. ✅ **RESUELTO en 4A** — id duplicado entre pools: `mergeOverlay` descarta la fila y
   `duplicateExerciseIds` deja la invariante asertable.
3. **`asStarCount` y el `default` de `starsFor` tiran.** Son inalcanzables por construcción y el
   barrido del dominio lo demuestra, pero son las dos únicas ramas sin cobertura. Tirar es
   deliberado: un grader que se sale de 0..3 rompió su propio contrato, y lo honesto es un
   request fallido, no una nota plausible escrita en una fila permanente.
4. **Peso de import.** `attempt-grading` importa `labyrinthStars` desde `@/lib/game/exercises`,
   que arrastra `puzzles.generated` entero. Es server-side por diseño; si alguna vez lo importa
   un componente cliente, se lleva el catálogo al bundle.

---

## Etapa 2 — CLOSED

| Commit | Qué cerró |
| --- | --- |
| `6e09c9f` | **DEBT-1** — la run key del latch |
| `dfa0e34` | **DEBT-2** — la outbox persistida |
| `0fb79cf` | El criterio "estructural" de D20 que se probaba por conducta, + spec al día |

**`6e09c9f` · DEBT-1.** Los cuatro contadores de remount dejaron de ser cuatro `useState`
sueltos en `exercises-screen.tsx` y son un reducer en `apps/web/src/lib/scores/attempt-run-key.ts`:

- `board_reset` rota **los cuatro** — ahí estaba el agujero, `resetBoard()` bumpeaba tres y se
  olvidaba `labyrinthKey`, la run key de Diagonal Run, Knight's Tour y N-Queens.
- `content_started` rota `labyrinth`.
- `runKeyFor(family, keys)` devuelve la parte rotativa de la key que React ya usa, espejando el
  ternario de boards **una sola vez**.

El test es una tabla que **obliga a cubrir `ATTEMPT_FAMILIES` entera**: agregar una familia sin
declarar su camino de próximo intento rompe la suite.

**`dfa0e34` · DEBT-2.** La cola se espeja en `localStorage` bajo
`chesscito:attempt-outbox:v1:<wallet>` (`apps/web/src/lib/scores/attempt-outbox-storage.ts`), y
el reducer suma el evento `hydrated`, que **no mintea** (esos ids ya existen; re-mintear
convertiría un intento en dos) y deduplica por id contra la cola **y contra el in-flight**.

Namespaced **por wallet**: el intento se acredita a quien esté conectado cuando drena, así que
una cola compartida en un teléfono que cambia de cuenta le archiva a la wallet B lo que jugó la
wallet A. Sin wallet no se escribe nada — el save path exige una, así que ese intento no podría
enviarse nunca y solo gastaría el cap.

**`0fb79cf`.** El criterio de aceptación de D20 decía "asserted structurally on the
`AttemptEvent` union" y el test probaba otra cosa: que un evento desconocido es inerte HOY. Ahora
hay exhaustividad en tipos — si el union crece, el archivo de test no compila. **Verificado
rompiéndolo**: agregué `board_reset` al union, `tsc` tiró TS2322 en la línea del chequeo, revertí.

---

## ⚠️ DEBT-2 está implementado pero NO montado

El módulo está completo y testeado. **Nada de esto existe todavía**:

- ❌ **No hay lectura en mount.** Nadie llama a `readPersistedOutbox` al abrir la app.
- ❌ **No hay mirror en cada cambio.** Nadie llama a `persistOutbox` cuando la cola se mueve.
- ❌ **No hay drain conectado al host.** `selectNextSubmission` no alimenta ningún POST.

La razón no es que se haya olvidado: **el reducer del lifecycle no está montado en ningún lado
todavía**. Ese cableado —el `useEffect` que lee en mount antes de mintear y espeja en cada
cambio— **pertenece a la etapa 4**, junto con los tres ensambladores, porque es ahí donde el
reducer entra en el árbol por primera vez. Está dicho igual en el spec y en el mensaje del commit.

Hasta que eso pase, la garantía de D20 sigue valiendo lo que vive la página.

## ⚠️ Cambio visible, intencional

`resetBoard()` ahora **remonta Diagonal Run, Knight's Tour y N-Queens**, porque rota
`labyrinthKey`. Es deliberado: esos tres boards no tienen reset suave (no reciben `resetKey`), su
único reset ES el remount, y ninguna de las tres completa por ese camino —`handleLabyrinthMove`
no llama a `resetBoard`—. Si aparece algo raro ahí, viene de acá.

Safe Path y Promotion Run **siguen igual**: su `resetKey` sigue siendo prop, sin remount. Meter su
contador en la key de React habría convertido un reset suave en un remount, que es un cambio de
comportamiento que nadie pidió.

---

## Próxima sesión

**Etapa 4B — migración `score_attempts` + RPC `save_score_attempt`.** El bloqueante de 4A está
cerrado: el RPC puede leer `getMergedCatalog()` y pasárselo a `gradeAttempt` sin cast.

En orden:

1. Migración `score_attempts` + RPC `save_score_attempt` (llama a `save_basic_score`, nunca lo
   reimplementa; consume dentro de la transacción; `revoke ... from public`).
2. Los tres ensambladores del host + el latch (`:1700-1705`, `handleLabyrinthMove:3111`,
   `handleCoverageComplete:3207`) **+ el cableado de DEBT-2**. Cero emisiones desde boards.
3. Separar los dos gates y renombrar la prop `canSaveScore={scorePendingNew}` (`:3476`).
4. `SCORE_SESSION_MAX_SAVES` 25 → 100, **en el mismo commit** que el grading server-side.

## Lo que hay que saber antes de tocar esto

- **Carril 2 nunca alimentó `pieceStars`** (`:3149`, `:3168`): sus estrellas van al ledger
  diario. Por eso nunca llegó al server, y por eso toda fila de carril 2 será `duplicate`. Si
  esa regla se revisa, la expectativa se invierte.
- **El Daily queda fuera** (D17). Una wallet puede tener un Focus Day con **cero** filas de
  intento, y filas de intento sin Focus Day. Repetir esa frase en el spec de Slice 2.
- **Knight's Tour es `starless: true`** — exclusión de producto explícita, no hueco de cobertura.
- **`labyrinthStars` y `tourStars` devuelven 0 real.** Un `check between 1 and 3` habría abortado
  el insert **y la transacción entera** en una corrida honesta y floja.
- **La run key ya no se lee de contadores sueltos.** El latch de etapa 4 debe usar
  `runKeyFor(family, runKeys)` + `completionKeyFor(contentId, runKey)`, no `labyrinthKey` a mano.

## Preguntas abiertas

**Ninguna bloqueante.** La de etapa 4A —si se ensancha `MergedCatalog` o si el grader arma su
propio catálogo— la resolvió el founder: se ensancha, un solo catálogo.

La que quedaba de etapa 2 —si la cola persistida es por-wallet— se resolvió por wallet, con
el argumento en `attempt-outbox-storage.ts`.
