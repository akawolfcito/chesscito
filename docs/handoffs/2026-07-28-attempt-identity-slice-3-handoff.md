# Handoff — Slice 3, identidad de intento (spec cerrado + etapa 1 en verde)

**Fecha**: 2026-07-28
**Branch**: `feat/attempt-identity-slice-3` (**3 commits**, sin pushear — el push es del founder)
**Suite**: 6308 passing / 545 archivos, **EXIT=0**. `tsc --noEmit` limpio.
**Spec**: `docs/specs/2026-07-28-attempt-identity-score-attempts.md` — **CLOSED en v7**, D1–D20 congeladas.

## Estado en una línea

**Slice 3 NO está terminado.** El spec v7 está CLOSED y la **etapa 1 de TDD** (los dos módulos
puros) está completa y en verde. **DEBT-1 y DEBT-2 bloquean la etapa siguiente** — no se avanza
a `gradeAttempt`, la migración ni los ensambladores hasta cerrarlas.

---

## Qué se hizo

**Spec de Slice 3, 7 rondas de red team.** El objetivo era desbloquear Slice 2 (ventana weekly
en Leaders), que quedó `NEEDS REVISION` porque `score_saves.created_at` no significa "jugó".
Cada ronda encontró algo que la anterior había asumido:

| Ronda | Lo que cayó |
| --- | --- |
| 1 | El `attemptId` sin dueño → el segundo intento se registraba como replay (sub-conteo silencioso); `count(*)` para el ordinal se rompe con cualquier borrado |
| 2 | El spec se auditó contra la DB y no contra el cliente: `score` es un acumulado por pieza, no el resultado del intento |
| 3 | `stars_earned` lo declaraba el cliente **y Slice 2 iba a rankear sobre él** = R1 del audit reintroducido; centinelas `'unknown'`/`0` en columnas NOT NULL |
| 4 | El reducer se montaba en 1 de 3 transiciones de completion; `computeStars` sólo grada carril 1 + Daily |
| 5 | La tabla de montaje listaba 3 boards que **no tienen** `score` ni `levelId`, y dos filas describían la misma completación (doble conteo) |
| 6 | `if (!reached) return` es **inerte** para 3 de 4 familias (el host pasa `targetPos` literal); `pending` podía borrarse antes de enviarse |
| 7 | La run key del latch no rota para 3 familias; la outbox muere al cerrar la app |

**Etapa 1 implementada con TDD** (SDD → tests rojos → verde → EDD):

- `apps/web/src/lib/scores/attempt-measurement.ts` — unión discriminada `moves | failures |
  coverage`, bounds por kind, ceiling de coverage tomado del catálogo.
- `apps/web/src/lib/scores/attempt-lifecycle.ts` — outbox FIFO, `submission_settled` borra sólo
  su propio id, `submission_failed` conserva el snapshot (el retry reenvía el mismo id → replay
  server-side → nunca un segundo intento).
- 31 tests nuevos, todos escritos antes de la implementación.

---

## Deuda bloqueante — arranca acá la próxima sesión

Documentada en el spec, sección **Blocking implementation debt**. Ninguna toca el schema.

**DEBT-1 · run key del latch.** `resetBoard()` rota `boardKey` (`:1518`), `safePathResetKey`
(`:1527`) y `promotionRunResetKey` (`:1539`) — **no toca `labyrinthKey`**, que gobierna Diagonal
Run, Knight's Tour y N-Queens. Probablemente funciona (esos boards no tienen `resetKey`, su
único reset es el remount), pero eso es un argumento sobre internals de board, que es lo que
D19 vino a dejar de usar. Fix: bumpear `labyrinthKey` en `resetBoard`, **o** que el ensamblador
tenga su propio contador. Test requerido: **por familia**, que la clave rote en el camino que
arranca su próximo intento.

**DEBT-2 · outbox en memoria.** D20 garantiza que un intento sobrevive hasta que el server lo
confirma — sobrevive dentro de la vida de la página. En MiniPay cerrar la app es lo normal, y
este repo ya persistió la sesión de score por exactamente eso (`87e35e35`, verificado en
device). Peor: un snapshot está en la cola sólo mientras el POST falla, o sea cuando la red está
mal, que es cuando se cierra la app. Fix: persistir la outbox con el mismo precedente, drenar en
mount antes de mintear, versionar la clave de storage. **O** angostar D20 por escrito.

---

## Etapas que faltan (orden sugerido)

1. **DEBT-1 + DEBT-2** — cierran las dos garantías de entrega.
2. `gradeAttempt` + inventario de graders (7 buckets, table-driven con ids reales del catálogo).
   ⚠️ `catalog.ts:120-122` dice que promotion-run *"feeds labyrinthStars"* — **manda al grader
   equivocado**; grada `promotionRunStars(failures)`. Corregir el comentario en el mismo commit.
3. Migración `score_attempts` + RPC `save_score_attempt` (llama a `save_basic_score`, nunca lo
   reimplementa; consume dentro de la transacción; privilegios `revoke ... from public`).
4. Los tres ensambladores del host + el latch (`:1700-1705`, `handleLabyrinthMove:3111`,
   `handleCoverageComplete:3207`). **Cero emisiones desde boards.**
5. Separar los dos gates y renombrar la prop `canSaveScore={scorePendingNew}` (`:3476`).
6. `SCORE_SESSION_MAX_SAVES` 25 → 100, **en el mismo commit** que el grading server-side.

---

## Lo que hay que saber antes de tocar esto

- **Carril 2 nunca alimentó `pieceStars`** (`:3149`, `:3168`): sus estrellas van al ledger
  diario. Por eso nunca llegó al server, y por eso toda fila de carril 2 será `duplicate`. Si
  esa regla se revisa, la expectativa se invierte.
- **El Daily queda fuera** (D17). Una wallet puede tener un Focus Day con **cero** filas de
  intento, y filas de intento sin Focus Day. Repetir esa frase en el spec de Slice 2.
- **Knight's Tour es `starless: true`** — exclusión de producto explícita, no hueco de cobertura.
- **`labyrinthStars` y `tourStars` devuelven 0 real.** Un `check between 1 and 3` habría abortado
  el insert **y la transacción entera** en una corrida honesta y floja.

## Preguntas abiertas

Ninguna bloqueante para el spec. Para la implementación: si DEBT-2 se resuelve persistiendo,
decidir si la cola persistida es por-wallet (una wallet no debería drenar intentos de otra).
