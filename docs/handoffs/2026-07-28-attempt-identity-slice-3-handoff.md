# Handoff — Slice 3, identidad de intento (etapas 1 y 2 cerradas)

**Fecha**: 2026-07-28
**Branch**: `feat/attempt-identity-slice-3` — **7 commits, SIN PUSHEAR**. El push es del founder.
Sin merge y sin deploy: la branch queda quieta hasta que el founder decida.
**Suite**: **6357 passing / 547 archivos, EXIT=0**. `tsc --noEmit` limpio. Lint limpio.
**Spec**: `docs/specs/2026-07-28-attempt-identity-score-attempts.md` — **CLOSED en v7**, D1–D20 congeladas.

## Estado en una línea

**Slice 3 NO está terminado.** Etapa 1 (los dos módulos puros) y **etapa 2 (DEBT-1 + DEBT-2)
están CLOSED**. Lo que sigue es `gradeAttempt`; el spec ya no tiene deuda bloqueante.

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

**`gradeAttempt` + el inventario table-driven de los 7 buckets, con ids reales del catálogo.**

**Primer ajuste, obligatorio, antes de escribir el grader:** `catalog.ts:120-122` dice que
promotion-run *"feeds labyrinthStars"* — **manda al grader equivocado**. Grada
`promotionRunStars(failures)`, no `labyrinthStars(moves, optimal)`. Corregir el comentario en el
mismo commit; si el inventario se escribe leyendo ese comentario, nace mal.

Después de eso, en orden:

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

Ninguna. La única que quedaba —si la cola persistida es por-wallet— se resolvió por wallet, con
el argumento en `attempt-outbox-storage.ts`.
