# Handoff — Slice 3, etapa 4C: la lane de intentos quedó conectada de punta a punta

**Fecha**: 2026-07-28
**Branch**: `feat/attempt-identity-slice-3`
**Commits**: **24** — los 20 con que cerró 4B + los 3 de 4C + este handoff.
**Árbol**: limpio.
**SIN PUSH, SIN MERGE, SIN DEPLOY.** El push es del founder.
**Suite**: **6505 passing / 552 archivos, EXIT=0**. `tsc --noEmit` limpio. Lint limpio.
**Spec**: `docs/specs/2026-07-28-attempt-identity-score-attempts.md` — CLOSED en v7.

> El conteo dice 24 y no 23 a propósito: 23 es el número **antes** de commitear este
> archivo. Verificable con `git rev-list --count main..HEAD`.

## Estado en una línea

**Un intento completado ahora llega al servidor.** Las seis familias emiten, el cliente
manda `attemptId`/`exerciseId`/`measurement`, la cola sobrevive a cerrar la app y un
reintento es un replay. Lo que falta —etapa 4C-3— es **superficie**: nadie muestra el
estado de la cola ni ofrece el reintento manual.

---

## Los tres commits

| Commit | Qué cerró |
| --- | --- |
| `2c7a3d7` | `use-attempt-outbox.ts` — la máquina de entrega, con 15 tests |
| `a20f0f0` | `save-client.ts` lleva la identidad del intento (opcional, omitida si falta) |
| `2ecdbbc` | Los tres ensambladores en `exercises-screen.tsx` + el rename del gate visual |

## El reparto, que es lo que hay que entender antes de tocar esto

```
board reporta una medición → el host ensambla → el hook entrega
```

- **El board** no emite nada. Reporta a su handler, como siempre.
- **La pantalla** decide que un intento TERMINÓ y qué midió. Arma
  `{ completionKey, exerciseId, measurement, timeMs, levelId, score }` y llama
  `attempts.report(...)`. **No** persiste, **no** reintenta, **no** drena.
- **El hook** (`lib/scores/use-attempt-outbox.ts`) hace todo lo demás: identidad,
  hidratación por wallet, mirror en storage, un POST en vuelo, FIFO, retry con el
  MISMO `attemptId`, y el corte terminal/retryable.

`useAttemptOutbox({ wallet, submitAttempt }) → { report, retry, status, pendingCount }`.

**No hay un segundo latch en la pantalla.** El de D19 vive en el hook, keyeado por el
`completionKey` que el host le pasa, porque es el único punto por el que pasan las seis
familias.

## Las tres bocas

| Handler | Familias | Medición |
| --- | --- | --- |
| `handleMove` | `exercise` | `moves` |
| `handleLabyrinthMove` | `labyrinth`, `diagonal-run`, `safe-path`, `promotion-run` | `moves`, o **`failures`** si viene `grading` |
| `handleCoverageComplete` | `knight-tour`, `queens` | `coverage` contra `coverageCeilingFor()` |

- **Carril 2 reporta aunque el score no se mueva.** Sus estrellas van al ledger diario,
  nunca a `pieceStars`, así que el total es el de siempre y el server contesta
  `duplicate`. La fila de intento es el punto.
- **Knight's Tour reporta aunque sea `starless`.** Es una decisión de producto sobre
  ESTRELLAS, no sobre intentos: el server lo archiva `starless` con conteo NULL, que no
  es el mismo hecho que `ungraded` — y sólo si la fila se escribe.

## ⚠️ Tres cosas que no se leen en el diff

1. **`reportAttempt` se reconstruye en cada render y se espeja en un ref.** Los dos
   handlers de carril 2 son `useCallback` **sin `runKeys` en sus deps**. Si cerraran
   sobre las keys, un `resetBoard()` sobre el mismo contenido los dejaría con la key de
   la corrida anterior: el `completionKey` se repetiría y el latch se comería el intento
   siguiente **en silencio**. Misma disciplina que `resolveMilestonesRef`, misma razón.
2. **Carril 2 no tenía reloj.** El `timeMs` de la pantalla es el del EJERCICIO y devuelve
   1000 cuando `phase !== "success"`, así que leerlo para un laberinto persistiría un
   segundo falso en una fila permanente. Se mide la corrida aparte (`attemptClockRef`,
   rotado por el mismo run id que define el intento) y va **clampeado**: `invalid_time`
   es un 400, o sea terminal, o sea **intento descartado**.
3. **El techo de coverage sale del CATÁLOGO, no del board.** Hoy coinciden. Errarle por
   uno no daría una nota mal: el server rederiva el suyo y **rechaza**, así que todo
   intento de coverage sería 400 y se tiraría.

## Decisión de diseño que conviene revisar

**Un fallo retryable APARCA la cola; no reintenta solo.** No hay timers: la cola se
vuelve a drenar con la próxima completación o con un `retry()` explícito. Un loop
automático sobre red muerta drena batería y vuelve a pedir firma.

**Consecuencia hoy: `retry()` no lo llama nadie.** `status` y `pendingCount` tampoco se
muestran. Un intento fallido espera a la próxima completación. Es correcto (at-least-once
no exige at-once) pero es exactamente lo que falta cablear en 4C-3.

## Rename

`canSaveScore={scorePendingNew}` → **`canOfferScoreSave`**, sin alias viejo, con un guard
de texto en `mission-detail-sheet.test.tsx`. Es un gate **visual** y es `false` en toda
completación de carril 2; compartir nombre con la precondición de wallet (`canSaveScore`,
que sigue existiendo en la pantalla y **no** se tocó) es cómo un gate termina usándose de
trigger y la tabla queda siendo un log de mejoras en vez de uno de intentos.

## Cobertura — qué se probó y qué no

**15 tests del hook** (`lib/scores/__tests__/use-attempt-outbox.test.tsx`): hidratar antes
de drenar y antes de mintear, completación durante la hidratación, un POST en vuelo,
cambio de wallet A→B, retry conserva el `attemptId`, terminal no tranca la cola, 5xx
conserva la cabeza, settle borra sólo lo suyo, el orden read-antes-de-write sobre la key.

**7 tests de pantalla** (`components/exercises/__tests__/attempt-assemblers.test.tsx`),
con los **boards mockeados** —que es exactamente el seam a stubear si la regla es "el
board reporta"—: los tres ensambladores emiten una vez con la medición correcta, tres
callbacks del mismo board dan **un** intento, y una nueva corrida del mismo laberinto da
**dos** intentos con ids distintos.

**Mutaciones verificadas** (no por lectura):

- Congelar las `runKeys` en el ensamblador → **1 caso en rojo** (el replay del laberinto).
- Gatear el reporte de carril 2 con `scorePendingNew` → **3 casos en rojo**.
- (De 4C-1) sacar la guarda del mirror → 1; sacar el latch → 1; clasificar `invalid`
  como retryable → 2.

**Lo que NO se probó a nivel pantalla**, y hay que decirlo:

- `queens`, `safe-path` y `diagonal-run` no tienen su propio caso: comparten los dos
  handlers que sí están probados, pero **su derivación de familia no está asertada**.
- El reload que conserva la outbox está probado en el hook, no en la pantalla.
- Nada de esto corrió contra la DB real ni contra un build de producción. Los dos
  preflights de 4B siguen siendo la única evidencia de plataforma.

## Próxima sesión — etapa 4C-3

1. **Superficie de la cola**: usar `status` y `pendingCount`, y darle un camino al
   `retry()` (hoy un fallo retryable espera a la próxima completación).
2. **Los tres casos de familia que faltan** (`queens`, `safe-path`, `diagonal-run`).
3. **Verificar en un build real** que el POST de un intento de carril 2 llega y se
   archiva `duplicate` con su fila de intento — la parte que ningún mock puede contestar.
4. Revisar el **presupuesto**: cada intento consume una unidad de sesión. 4B lo subió
   25 → 100 pensando en esto, pero nadie midió todavía cuántos intentos hace una sesión
   real de carril 2.

## Preguntas abiertas

**Una.** ¿El fallo retryable debe seguir esperando a la próxima completación, o 4C-3 le
da un reintento visible al jugador? Está implementado como decisión explícita, no como
omisión — pero es la única parte de la lane que un jugador podría notar y hoy no ve.
