# Red Team — daily-cta-content-loop

**Fecha:** 2026-08-07
**Mentalidad:** QA hostil + ingeniero senior que ya vio este repo romperse por estas cosas
**Spec auditado:** `docs/specs/2026-08-07-daily-cta-content-loop.md`

---

## Findings

### P0 — Bloqueantes, hay que arreglarlos en el spec antes de tocar código

#### P0-1 · [dos fuentes de verdad] El spec dice arreglar la doble fuente y crea otra

El spec entero se justifica en *"que la tarjeta deje de fabricar su estado localmente"*.
Y después, en Behavior 3, hace exactamente eso:

> *"Dado pase activo y `focusPassport.todayDone === false`…"*

`focusPassport.todayDone` **no es** la fuente que usa el Content Loop. El loop decide con
`isCompletedToday(today, daily)` sobre `DailyProgress` + `todayUtc()`
(`content-loop.ts:339`). La tarjeta decidiría con el passport.

Son dos lecturas del mismo hecho, hidratadas por caminos distintos. En cuanto discrepen
—y `lastCompletedDate` tiene nueve lectores en este repo, o sea nueve oportunidades de
divergir— la tarjeta va a rendir `ctaStartToday` mientras el loop devuelve `improve-stars`,
o al revés. El resultado es **un botón que dice "Enfoque de hoy" y navega a otra cosa**.

**Por qué bloquea:** es el defecto original con otra ropa. Si `todayDone` no sale del
mismo objeto que alimentó al loop, no cerramos nada.

**Arreglo:** la tarjeta **no** consulta `focusPassport.todayDone` para elegir el slot. El
loop ya expone `daily-pending` como variante; que `daily-pending → ctaStartToday` sea una
fila más del mapa (ya lo es) y que **toda** la decisión post-`join`/`complete` salga de
`toCtaSlotPresentation`. `todayDone` sigue usándose para el pasaporte y las llamas, que es
su trabajo.

---

#### P0-2 · [regresión encubierta] "Sin cambios visibles respecto de hoy" es FALSO

Behavior 3 y AC-2 afirman que el estado `start` no cambia. Behavior 8 dice que se navega a
`action.destination`. Las dos no pueden ser ciertas a la vez:

- **Hoy:** `router.push(startFocusExerciseDestination(contentLoopPrimaryPiece))`
  (`learn-hub-client.tsx:652`).
- **Con el spec:** `action.destination` de `daily-pending` = **`/exercises?slot=daily`**
  (`content-loop.ts:93`).

Son URLs distintas. Y no cualquiera: **`?slot=daily` es el query param que tuvo apagada la
cuota diaria entera** hasta el 2026-08-05. Se arregló, sí — pero el spec está cambiando en
silencio el destino del **camino más transitado del producto** y llamándolo "sin cambios",
que es la peor forma posible de introducir una regresión: nadie la va a buscar ahí.

**Por qué bloquea:** un cambio de ruta no declarado en el flujo principal, sobre un param
con antecedentes, presentado como no-cambio.

**Arreglo:** o (a) `daily-pending` conserva `startFocusExerciseDestination` y se declara la
excepción con su razón, o (b) se declara el cambio de URL como parte del alcance, con su
propio AC y una verificación de que la cuota sigue viva. **Elegir explícitamente.** Lo que
no se puede es dejarlo escrito como si no pasara nada.

---

#### P0-3 · [contradicción interna] AC-5 rompe el estado que el spec declara fuera de alcance

- Non-goals: *"Rediseño del estado `complete`… Merece su propia ronda."*
- AC-5: *"El nodo de estado no lleva ninguna de las clases de botón, ni `filter`, ni
  `opacity` reducida. Hay un source guard que falla si `.challenge-card-cta--info`
  reintroduce `saturate(` o `opacity`."*

`complete` **usa esa misma clase** (`challenge-card.tsx:573`). Si el guard es global, o
`complete` cambia de aspecto —violando el non-goal— o el guard falla en `main` desde el
primer commit.

**Por qué bloquea:** el spec se contradice consigo mismo; quien implemente va a elegir por
su cuenta cuál de las dos frases obedecer.

**Arreglo:** clase nueva para el terminal del loop (p. ej. `.challenge-card-cta--quiet`),
guard acotado a ella, y `.challenge-card-cta--info` intacta sirviendo sólo a `complete`
hasta que le toque su ronda. Cuesta una clase y elimina la contradicción.

---

#### P0-4 · [criterio no testeable] AC-6 no se puede verificar donde el spec sugiere

> *"AC-6 La altura de `.challenge-card-cta-row` es idéntica en `action` y en `status`"*

La suite unitaria corre en **jsdom, que no hace layout**. `getBoundingClientRect()`
devuelve ceros y `getComputedStyle` no resuelve el CSS del `globals.css`. Ese criterio, tal
como está, **pasa en verde sin medir nada** — que es la categoría de test más cara de este
repo: la que da confianza falsa.

**Por qué bloquea:** el AC que protege el CLS recién cerrado es precisamente el que no
mide. Si se implementa así, la protección es decorativa.

**Arreglo:** partirlo en dos criterios que sí se pueden verificar:
- **source guard**: la regla CSS del terminal declara `min-height` con el mismo token/valor
  que el botón (se lee el archivo, no el layout);
- **VR**: el baseline del hub en estado terminal fotografía la caja reservada.

---

### P1 — Hay que resolverlo, no bloquea el arranque

#### P1-1 · [contrato] El cambio de firma de `onFocusTap` rompe call sites no enumerados

`() => void` → `(destination: string) => void`. El scaffold pasa hoy
`onFocusTap={primaryFocus.onPress}`, y `onPress` es `() => void`
(`hub-lite-scaffold.tsx:58`). TypeScript acepta pasar una función que ignora argumentos, así
que **esto compila y no hace nada**: el destino llega y se descarta en silencio.

**Riesgo:** el bug más caro de este spec pasa `tsc` limpio. Enumerar los call sites
(scaffold, `learn-hub-client`, probes de `/dev`, tests) y que el AC-10 asserte que el
destino **recibido** es el que se navega, no sólo que se llamó.

#### P1-2 · [inconsistencia] Dos "todavía no sé" con tratamientos opuestos

- `contentLoop === null` / `!isHydrated` → **status** (AC-9), porque no se decidió aún.
- `view-progress` → **botón** (mapa), pero esa variante dispara justamente cuando
  *"empty path / catalog not yet loaded"* (`content-loop.ts:387`).

Son el mismo hecho —no hay datos— con presentaciones contrarias. Un jugador con el catálogo
sin cargar recibe un botón confiado; el mismo jugador un tick antes recibe una leyenda.

**Riesgo:** parpadeo status → botón en el primer render útil, sobre el mismo anchor que
acaba de salir de un fix de CLS.

#### P1-3 · [telemetría] El nombre del evento pasa a mentir

`hub_start_focus_tap` va a emitirse cuando el jugador toque **"Reclama tu regalo"** o
**"Ver tu progreso"**. Ni uno ni otro es "start focus". Este repo ya tiene una nota entera
sobre nombres de funnel que no significan lo que dicen; esto agrega un caso más y encima
contamina una métrica existente con eventos de otra naturaleza.

**Riesgo:** cualquier análisis histórico de `hub_start_focus_tap` se vuelve incomparable
antes/después, sin aviso.

#### P1-4 · [copy] Una nota para tres variantes que dicen cosas distintas

`noteDailyReturns` = *"Tu Diaria vuelve mañana"* se usa para las tres sin destino. Pero:

- En `come-back-tomorrow`, el jugador terminó todo. La nota responde su pregunta.
- En `daily-limit-reached` / `daily-max-reached`, el jugador **chocó con la cuota de
  sesión**, no con la Diaria — la Diaria ya la hizo. La nota le nombra la actividad
  equivocada y no le explica la pared que acaba de encontrar.

**Riesgo:** el jugador que agotó su cuota lee que su Diaria vuelve mañana, cuando lo que
quería saber es por qué no puede seguir entrenando. Un número correcto que no se puede
reconciliar se lee como mentira.

---

### P2 — Aclarar

#### P2-1 · [test frágil] AC-1 asserta sobre un detalle de implementación

*"…y `toCtaSlotPresentation` no se invoca."* Espiar una función pura para probar una rama
ata el test a la estructura, no al comportamiento. Lo observable es que se rinde el banner
de $0.99. Aserta eso.

#### P2-2 · [copy] El modo gramatical del ES baila

`Sigue entrenando` / `Mejora tu marca` / `Reclama tu regalo` son imperativos.
`Probar laberinto` es infinitivo. `Nueva pieza` / `Ver tu progreso` son sintagmas.
Tres registros en siete labels que se ven **uno a la vez pero en la misma caja**. Elegir uno.
(Mi voto: imperativo en todos — es el que ya usa `Enfoque de hoy`… que tampoco es imperativo.
Con más razón: decidirlo.)

#### P2-3 · [alcance] OQ-2 no debería seguir abierta al terminar

Cuántos pases activos hay define si esto le habla a 3 personas o a 300. El spec dice que no
bloquea la implementación — correcto — pero sí debería bloquear el **cierre**: sin ese
número no se puede decir si el sprint movió algo.

---

## Categorías auditadas

**Contract gaps** — `CtaSlotPresentation` está bien discriminado y sin `any`. Falta el tipo
de error: no hay caso para "el loop devolvió una variante que el mapa no conoce". AC-8 pide
totalidad exhaustiva, lo cual la vuelve imposible por construcción — bien.

**Ambigüedad de comportamiento** — P0-1 y P0-2. Behavior 5 y 6 son deterministas y buenos.

**Supuestos ocultos** — el spec asume que `primaryFocus.contentLoop` llega hidratado al
scaffold; hoy llega, pero nadie lo consume, así que **nunca fue ejercitado**. Primer uso
real de un cable que existe hace semanas: tratarlo como código nuevo, no como existente.

**Compatibilidad hacia atrás** — `tomorrowNote` se elimina (AC-13). Es copy, no dato
persistido: sin migración. ✅ Ningún estado guardado cambia de forma.

**Seguridad y datos** — sin superficie nueva. No hay input de usuario, ni red, ni PII. El
slot no es un control de acceso y el spec lo dice. ✅

**Cobertura de tests** — AC-6 no es testeable (P0-4). AC-1 testea lo que no debe (P2-1).
El resto mapea a asserts reales.

**Preparación operativa** — sin logging nuevo, sin flag. **No hay plan de rollback
declarado.** Para un cambio de una tarjeta es defendible (revert del commit), pero conviene
decirlo en vez de omitirlo. El VR es la red de seguridad y AC-14 lo contempla bien al exigir
revisión visual del diff en vez de re-baselinear a ciegas.

---

## Resolución (2026-08-07, spec v2)

| # | Estado | Cómo se cerró |
|---|---|---|
| **P0-1** | ✅ | `CtaState` pasa a `join \| complete \| loop`. La tarjeta **no** lee `focusPassport.todayDone` para elegir el slot; el ex-`start` es la variante `daily-pending` del loop. |
| **P0-2** | ✅ | **Decisión del founder:** `daily-pending` conserva `startFocusExerciseDestination`. Excepción declarada con `LEGACY_DESTINATION_VARIANTS` + AC-11 + entrada propia en *Out of scope*. El loop manda la **variante**, no ese destino. |
| **P0-3** | ✅ | Clase nueva `.challenge-card-cta--quiet` para el terminal del loop. `.challenge-card-cta--info` intacta sirviendo a `complete`. El guard apunta a la nueva. |
| **P0-4** | ✅ | AC-6 partido en **AC-6a** (source guard sobre el `min-height` declarado) y **AC-6b** (VR). Escrito que jsdom no mide altura. |
| **P1-1** | ✅ | `onFocusTap: (destination: string) => void`. AC-10 exige asserar el destino **recibido** y enumera los call sites (scaffold, hub client, probes `/dev`, tests). |
| **P1-2** | ✅ | Behavior 10: `action` requiere `isHydrated === true`. "No sé todavía" lo decide **la hidratación**, nunca la variante. El parpadeo status→action queda declarado como aceptado, con la caja reservada. |
| **P1-3** | ✅ | **Decisión del founder:** `hub_start_focus_tap` queda **exclusivo** de `daily-pending`. Evento nuevo `hub_content_loop_cta_tap` con `{ variant, destination }` para las otras seis. AC-12 falla si una variante ajena emite el histórico. |
| **P1-4** | ✅ | Dos notas: `noteDailyReturns` (terminó todo) y `noteTrainingResumes` (chocó con la cuota). AC-7 mapea cuál va con cuál. |
| **P2-1** | ✅ | AC-1 asserta el banner observable, no que la función pura no se invocó. |
| **P2-2** | ✅ | Imperativo en ES para todas las claves nuevas. `Prueba el laberinto` (19) marcado como techo a verificar en device, con fallback aprobado. |
| **P2-3** | ✅ | OQ-2 reetiquetada: **bloquea el cierre del sprint**, no la implementación. |

Además, sin que el red team lo pidiera: se agregó sección **Rollback** (revert, sin flag ni
migración) y se dejó escrito que `primaryFocus.contentLoop` **nunca fue ejercitado** — se
implementa como código nuevo, no como reuso.

---

## Verdict v2 (2026-08-07) — ✅ READY para `/tdd`

Los cuatro P0 y los cuatro P1 están cerrados en el spec. El alcance no creció: sigue siendo
**un slot, dos líneas, cero altura nueva**. Las dos decisiones que necesitaban al founder
—destino de `daily-pending` y el nombre del evento— están tomadas y escritas.

Queda **OQ-2** abierta a propósito (contar pases activos), que bloquea el cierre y no el
arranque.

---

## Verdict v1 (histórico)

### 🔴 NEEDS REVISION

Cuatro P0. Ninguno es de diseño —la forma que trajo Sally se sostiene— y ninguno pide
rediseñar nada: los cuatro son **precisión del spec**. Se arreglan en el documento, en una
pasada, sin volver a discutir alcance:

1. **P0-1** — sacar `focusPassport.todayDone` de la decisión del slot; que todo salga del loop.
2. **P0-2** — decidir explícitamente si `daily-pending` cambia de URL, y declararlo.
3. **P0-3** — clase propia para el terminal; no tocar la que sirve a `complete`.
4. **P0-4** — partir AC-6 en source guard + VR; jsdom no mide altura.

Con eso reescrito, esto va a `/tdd`. El alcance sigue siendo chico y correcto: **un slot,
dos líneas, cero altura nueva.** Lo que el red team encontró no lo agranda — lo hace
implementable sin sorpresas.
