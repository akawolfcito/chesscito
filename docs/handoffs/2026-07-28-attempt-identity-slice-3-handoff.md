# Handoff — Slice 3, identidad de intento (etapas 1–4B cerradas, preflights verdes)

**Fecha**: 2026-07-28
**Branch**: `feat/attempt-identity-slice-3` — **19 commits, SIN PUSHEAR**. El push es del founder.
Sin merge y sin deploy: la branch queda quieta hasta que el founder decida.
**Suite**: **6479 passing / 550 archivos, EXIT=0**. `tsc --noEmit` limpio. Lint limpio.
**Spec**: `docs/specs/2026-07-28-attempt-identity-score-attempts.md` — **CLOSED en v7**, D1–D20 congeladas.

## Estado en una línea

**Slice 3 NO está terminado.** Etapas 1, 2, 3, **4A** y **4B están CLOSED**, y **los dos
preflights que bloqueaban 4C están VERDES**. Lo que sigue —sin empezar— son los ensambladores del
host y el montaje de la outbox (**etapa 4C**).

---

## Preflights — AMBOS VERDES (2026-07-28)

El diseño de 4B nunca estuvo en duda. Lo pendiente era probarlo en los dos entornos donde los
mocks y los tests unitarios no pueden hablar por la plataforma. Ya se probó.

### PRE-FLIGHT 1 — `unstable_cache` en un Route Handler real: **FUNCIONA**

Corrido contra un **build de producción + `next start`** (no un preview: desplegar estaba
excluido en la misma instrucción). Es un Route Handler de Next 14 real con incremental cache
real, que es exactamente lo que estaba en duda.

| Caso | Resultado |
| --- | --- |
| Medición válida, invocación **COLD** (primer request tras el boot) | 200 · `graded` · 3★ |
| Medición válida, **WARM** | 200 · `graded` · 3★ |
| Legacy sin medición | 200 · `ungraded` · `starsEarned: null` |
| Ejercicio desconocido | 400 · `unknown_exercise` |
| Replay del mismo `attemptId` | 200 · `replayed: true`, mismo `attemptIndex` |

**Cero** `Invariant: incrementalCache missing`, cero `catalog_unavailable` en los logs. DB después
del smoke: `used_saves = 3`, 3 filas de intento, 3 de `score_saves` — **el replay consumió cero**.

⇒ **No hay que crear una ruta alternativa de obtención del catálogo.** El guard de 503 que
agregué en 4B queda como manejo honesto de una falla real del catálogo (el overlay puede caerse),
**no** como un 503 permanente escondiendo un bug de plataforma. La pregunta abierta del handoff
anterior queda contestada y cerrada.

### PRE-FLIGHT 2 — DB real: **VERDE**, con un agujero de seguridad encontrado

`supabase start` + la migración aplicada (sin `db reset`: los 29 previos ya estaban, no había
nada que perder).

- `score_attempts_smoke.sql` — **12 casos PASSED**, incluido el rollback: un fallo después del
  consume deja `used_saves`, `score_saves` y `score_attempts` **sin cambios**.
- Mismo `attemptId` en wallets distintas → **no es replay**, cada wallet recibe su propio ordinal.
- Concurrencia real (`pgbench -c 8 -j 8`, 8 clientes sobre el MISMO `attemptId`): **1 fila de
  intento, 1 de `score_saves`, `used_saves = 1`**. Siete de ocho fueron replays y no gastaron nada.
- Privilegios vía `has_function_privilege` — **falló primero. Ver abajo.**

### 🔴 El hallazgo: revocar de `PUBLIC` no le sacaba `EXECUTE` a `anon`

El spec dice que Postgres le da `EXECUTE` a `PUBLIC` por default y que por eso revocar de
`anon`/`authenticated` solos no cambia nada. **Es cierto y está incompleto.** Supabase además
corre `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated,
service_role`, así que toda función nueva recibe **también un grant explícito** a esos dos roles,
y revocar de `PUBLIC` no toca un grant explícito.

`pg_proc.proacl` decía `anon=X/postgres | authenticated=X/postgres` en **las dos** funciones.
**Los dos revokes son necesarios y cada uno solo es inútil.** Corregido en `2d59202`.

⚠️ **El guard de vitest estaba en verde mientras la función estaba expuesta.** Asertaba
`from public`, y eso era literalmente lo que decía el archivo. Ahora exige los tres roles — pero
la lección no es esa: **una pregunta de privilegios solo la contesta la base de datos**, y el
smoke hay que correrlo. Ningún guard de texto la habría cazado nunca.

### Cómo repetir los preflights

```
# DB (desde apps/web)
supabase start
docker exec -i supabase_db_web psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < supabase/tests/score_attempts_smoke.sql
# concurrencia: sembrar la sesión, docker cp del fixture, pgbench -n -c 8 -j 8 -t 1

# HTTP (desde apps/web)
pnpm build
SUPABASE_URL=http://127.0.0.1:55321 SUPABASE_SERVICE_ROLE_KEY=<local> \
  NEXT_PUBLIC_CHESSCITO_MODE=learn pnpm exec next start -p 3009
```

No hay `psql` local: va por `docker exec` al contenedor `supabase_db_web`.

---

## Etapa 4B — CLOSED

| Commit | Qué cerró |
| --- | --- |
| `043b9fc` | La tabla, el RPC, el guard de esquema y los dos archivos de smoke |
| `a300b73` | El endpoint: grading server-side y una sola RPC |
| `3589fdd` | `SCORE_SESSION_MAX_SAVES` 25 → 100 |

### Lo que hay que saber del RPC

**El orden no es estético.** Resolver sesión → lock del wallet → surface → **replay** → consume →
`save_basic_score` → insert. El replay va **antes** del consume: reintentar un POST que falló no
puede costar una segunda unidad de un presupuesto que el jugador ya pagó por ese intento. Y el
consume va **adentro** de la transacción: *"rechazado consume cero"* es una propiedad de la
transacción, no un camino de reembolso — y no debe existir un camino de reembolso.

**No hay parámetro de wallet.** Sale de la fila de sesión, así que "un token escribiendo al
wallet de otro" no es un chequeo que alguien pueda olvidar: es un valor que no existe.

**Lock order.** El lock del wallet precede a todo UPDATE de `score_write_sessions`, y `authorize`
nunca toma el lock del wallet — asertado leyendo su migración. Dos caminos con los mismos dos
locks en orden opuesto se trancan bajo concurrencia, y eso aparece como timeouts bajo carga,
jamás en un test que corre una sentencia a la vez.

**`stars_earned` admite NULL y 0..3**, nunca 1..3. Un check de 1..3 abortaría el insert *y la
transacción entera* en una corrida honesta y floja.

### Lo que un guard de texto NO puede probar

El guard de vitest lee el SQL como texto: no puede probar que la transacción revierte. Eso lo
prueba `supabase/tests/score_attempts_smoke.sql` contra un Postgres vivo — 12 casos, incluido
**fallar después del consume** (la violación de coherencia de grade dispara el rollback) y el
estado de privilegios vía `has_function_privilege`. La concurrencia real va aparte, en
`score_attempts_same_attempt_concurrency.sql`, como fixture de pgbench.

**Ninguno de los dos corre en CI.** Hay que correrlos a mano contra `supabase start`.

### ⚠️ Dos hallazgos que valen más que los tests

1. **`getMergedCatalog()` está envuelto en `unstable_cache`, que tira fuera de un scope de request
   de Next.** Apareció como `Invariant: incrementalCache missing` en los tests del route. Si eso
   pasa en producción, el save path se cae con un stack. La lectura del catálogo ahora está
   guardada y contesta **503**: sin catálogo no hay nota honesta, y adivinar una escribiría una
   fila permanente con un valor que nadie calculó. **Vale verificarlo en preview**: si el route
   handler de Next 14 no provee incremental cache, TODO save con medición contesta 503.
2. **El guard de esquema medía posiciones de texto sobre prosa.** La primera versión falló porque
   el comentario del paso 1 menciona `consume_score_write_session` mientras explica por qué ese
   paso NO lo llama. Las aserciones de orden corren sobre el código sin comentarios.

**Mutaciones verificadas**: sacar el advisory lock rompe 3 casos; revocar de `anon` en vez de
`PUBLIC` rompe 1; hacer que el route respete `body.starsEarned` rompe el caso de D12.

### Cambio de comportamiento visible

El status HTTP de una RPC fallida se partió en dos: **503** si el store es inalcanzable (error sin
`code`, o clases `08`/`53`/`57`), **500** si la llamada llegó y se rompió. Antes el consume corría
primero y toda falla de DB salía 503. El cliente no lo nota — `save-client.ts` discrimina por el
campo `status` del JSON, no por el código HTTP.

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

**Etapa 4C — los ensambladores del host. DESBLOQUEADA y SIN EMPEZAR.**

El servidor ya acepta intentos y está probado en los dos entornos; hoy nadie se los manda. Todo
lo de abajo vive en `exercises-screen.tsx` (~3700 líneas) y **es una sesión propia**.

1. Montar `attemptLifecycleReducer` en `exercises-screen`.
2. **Hidratar la outbox por wallet ANTES de drenar** — y antes de mintear, o un intento
   rehidratado se mintea de nuevo y se convierte en dos.
3. Persistir la cola en cada cambio (`persistOutbox`).
4. Drenar FIFO, un POST en vuelo a la vez.
5. Conectar los tres ensambladores (`:1700-1705`, `handleLabyrinthMove:3111`,
   `handleCoverageComplete:3207`). **Cero emisiones desde boards.**
6. El latch con `runKeyFor` + `completionKeyFor`, **nunca `labyrinthKey` a mano**.
7. Separar el trigger de escritura del gate visual: renombrar `canSaveScore={scorePendingNew}`
   (`:3476`) a `canOfferScoreSave`.
8. **Distinguir fallo retryable de terminal.** Un 400 es terminal: si la cabeza de la FIFO
   vuelve a la cola en un 400, bloquea todo lo que hay detrás para siempre. Un 5xx/red sí
   conserva la cabeza.
9. El cliente pasa a mandar `attemptId`, `exerciseId` y `measurement`. Hasta que lo haga, cada
   save escribe una fila `ungraded` con `attempt_id_source = 'server'` — correcto, y es lo que
   hace seguro el orden de deploy.

**Acceptance críticos** (los que fallarían en un cableado ingenuo):

- reload con intento pendiente → se rehidrata y usa **el mismo** `attemptId`;
- wallet A **no** drena la cola de wallet B;
- una completación **durante** la hidratación no se pierde ni se duplica;
- error de red conserva la cabeza; **400 terminal no bloquea la FIFO eternamente**;
- carril 1, labyrinth/promotion y coverage producen **exactamente una** fila cada uno;
- un retry produce **replay**, no una segunda fila (ya probado del lado servidor).

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

**Ninguna.** La única que quedaba —si `unstable_cache` funciona dentro de un Route Handler de
Next 14— se contestó corriéndolo: **funciona**, cold y warm. No hace falta una ruta alternativa
de obtención del catálogo.

La de etapa 4A —si se ensancha `MergedCatalog` o si el grader arma su propio catálogo— la
resolvió el founder: se ensancha, un solo catálogo.

Lo que sigue no es una duda de diseño, es trabajo: la etapa 4C entera.

La que quedaba de etapa 2 —si la cola persistida es por-wallet— se resolvió por wallet, con
el argumento en `attempt-outbox-storage.ts`.
