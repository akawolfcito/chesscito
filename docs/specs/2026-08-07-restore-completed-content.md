# Spec — restore-completed-content

**Fecha:** 2026-08-07 · **Estado:** ✅ **READY** — red team aplicado 2026-08-08
**Bug:** prod, `learn.chesscito.com`, reproducido en dos cuentas
**Reproducción:** `components/exercises/__tests__/restore-completed-content.test.tsx` (`it.skip`)
**Red team:** `docs/specs/2026-08-07-restore-completed-content-redteam.md` (3 bloqueantes + 7 hallazgos, todos incorporados abajo)
**Handoff:** `docs/handoffs/2026-08-07-cta-slot-and-restore-bug-handoff.md`

## Problema

Un jugador termina el último laberinto de la torre (`Rook Run`), 3/3 estrellas. Vuelve al hub,
toca la torre, y **aterriza otra vez en `Rook Run`**. Repetidamente. Se lee como *"mi progreso
no se guarda"*.

⛔ **No es un bug de guardado.** El `localStorage` del jugador tiene los cuatro bests:

```json
{"rook-rail-two-turns":12,"rook-rail-dead-end":6,"rook-rail-two-roads":6,"rook-rail-rook-run":10}
```

`getNextChallenge` devuelve **null** correctamente — no hay laberinto disponible.

La causa es el restore al montar (`exercises-screen.tsx:3240`):

```ts
const contentId = directContentId ?? readLastTrainingContentId(selectedPiece);
```

Reabre el último contenido jugado de la pieza **sin preguntar si ya está terminado**. Con el
camino enterrado, el jugador no tiene forma de ver que en realidad los completó todos.

## Goal

Que el restore deje de re-servir un laberinto ya completado, **sin dejar de asentar el estado
inicial de la pantalla**.

## La trampa que ya se pisó una vez

Filtrar el id **antes** de llamar a `requestTrainingContent` rompe
`training-pass-screen-integration`: la pantalla queda colgada y el nodo bloqueado nunca
renderiza. **Por qué:** `requestTrainingContent` resuelve en cuatro acciones, y en
`missing`/`locked` ejecuta `setExerciseDrawerOpen(true)` (`exercises-screen.tsx:3191-3202`).
Ese es el settling. Saltearse la llamada se saltea el settling.

> ⛔ **INVARIANTE 1: el restore SIEMPRE debe pasar por `requestTrainingContent`.** El filtro va
> en el resultado, nunca antes de la llamada.

## Contracts (SDD)

### Dónde vive la decisión

⛔ **NO se ensancha `resolveTrainingContentRequest`.** Ese resolver puro recibe
`{ contentId, catalog, trainingPass, source }` (`lib/training/content-access.ts:51-61`) —
**ningún estado de progreso**. No puede saber si un nodo está completo, y darle el path para
que lo sepa ensancha un módulo puro para responder algo que su llamador ya tiene.

El branch correcto **ya existe**: `exercises-screen.tsx:3205-3214` busca el nodo en
`trainingPathRef.current` y, si está `locked`, asienta como `missing`. La completitud es **una
condición más en ese mismo branch**, con `source` —que ya es parámetro— a la vista. Eso cumple
la Invariante 1 al pie: es el **resultado** de `requestTrainingContent`.

### El tipo

El tipo real es `TrainingContentRequestResult` (unión de **objetos**, no de strings,
`content-access.ts:24-32`). Se le agrega un miembro, **producido por el componente**:

```ts
/** El contenido existe y está DESBLOQUEADO, pero ya fue completado y la petición
 *  es un restore implícito. Se asienta como `missing`. No es un error. */
| { action: "completed" }
```

### Precedencia — contrato, no detalle

> ⛔ **INVARIANTE 2: `pending` > `missing`/`locked` > `completed` > `start`.**

Un laberinto completado **y** gateado por pass responde **`locked`**, porque el CTA de unlock
es información que el jugador necesita más que el aviso de "ya lo hiciste". No es teórico:
`training-pass-screen-integration.test.tsx:212-216` restaura `knight-tour-2` **después** de
grabarle best 18 — o sea, completado y gateado a la vez. Hoy pasa sólo porque `locked` se
resuelve en `:3191`, antes del chequeo de nodo en `:3205`. **Mover la completitud arriba de
esa línea pone ese test rojo y va a parecer una regresión de pass.**

### `restorableContentId` se BORRA

`lib/training/restore-content.ts` no tiene callers ni tests, y su semántica —devolver `null`
para saltear la llamada— **es exactamente la que causó la regresión**. Se elimina el archivo;
el razonamiento útil de su comentario se muda al branch nuevo.

## Behavior

1. **Sólo `source === "restore"` filtra.** `direct`, `explicit_tap` y `automatic` abren lo que
   nombran, **siempre** — rejugar un laberinto terminado a propósito es legítimo. Son las
   cuatro fuentes de `TrainingContentRequestSource` (`content-access.ts:18-22`); ninguna queda
   sin legislar.
2. `source === "restore"` + nodo **laberinto** con `status === "complete"` → `completed`.
3. `completed` asienta **exactamente como `missing`**: `setLabyrinthMode(false)`,
   `setSelectedLabyrinthId(null)`, `setExerciseDrawerOpen(true)`. Reusa el camino que ya
   funciona.
4. **"Completo" = `best !== null`, no el óptimo.** `path.ts:143` marca completo con cualquier
   best, y un best se graba en **cualquier llegada al target** (`:3336-3349`), óptima o no. Un
   laberinto terminado a 1★ tampoco se re-sirve. ⛔ No implementar un chequeo de óptimo.
5. `pending` no cambia: la hidratación de entitlement manda sobre todo lo demás.
6. **El puntero rancio NO se limpia.** `trainingContentSelection:<pieza>` sigue apuntando al
   laberinto completado. Decisión de producto: mantener "dónde estabas" puede servirle al
   Path, y limpiarlo convertiría el fix en una mutación extra sin necesidad. No se crea
   `clearLastTrainingContentId`.
7. **`completed` NO auto-avanza** al próximo contenido. Decisión de producto congelada: si el
   objetivo del Sprint 2 es hacer visible el Path y devolver agencia, restaurar algo terminado
   debe llevar al **mapa**, no teletransportar al jugador.

## Acceptance criteria

- [ ] **AC-1** Un laberinto completado marcado como último contenido **no se monta** al
      montar la pantalla.
      ⚠️ El observable es el **modo laberinto** (la línea de misión / el control de salida),
      **NO el título**: un nodo de Special Training imprime su título autorado en el drawer
      (`exercise-drawer.tsx:317-318`, B4.2.3), así que con el fix correcto "Probe Rails"
      **sí** está en el DOM. El `it.skip` existente **se reescribe conservando su fixture**;
      su aserción actual (`queryByText(title) === null`) fallaría con el fix bien hecho.
- [ ] **AC-2** Tras ese restore, la senda queda **abierta y visible** — afirmarlo **en
      positivo** (el nodo aparece en el drawer), no sólo la ausencia de `aria-busy`.
- [ ] **AC-3** `training-pass-screen-integration` sigue verde, sin tocarlo.
- [ ] **AC-4** `explicit_tap` sobre un laberinto completado **sí** lo abre. Ídem `direct` y
      `automatic`.
- [ ] **AC-5** Un id de **ejercicio** en el slot de restore no cambia de comportamiento.
      ⚠️ Hoy es inalcanzable por construcción: `writeLastTrainingContentId` tiene **un solo
      call site** (`:3223`, rama que arranca un laberinto), y `requestTrainingContent` busca
      en `labyrinthList` → un id de ejercicio da `missing`. La reanudación de ejercicios vive
      en otro mecanismo (`progress.currentId`) que este efecto no toca.
- [ ] **AC-6** Un laberinto **completado Y gateado por pass**, restaurado, resuelve `locked` y
      renderiza su CTA de unlock. (Es la Invariante 2 hecha test. Reemplaza al source guard
      del draft, que no tenía símbolo que vigilar una vez borrado `restore-content.ts`.)

## Out of scope

- Desenterrar el Path (Sprint 2). ⛔ Pero este fix va **antes**: con el mapa a la vista, el
  bug pasa de "me repite un nivel" a "mi mapa me miente".
- Estrellas del carril y su contribución al metajuego.
- Reanudación de ejercicios (`progress.currentId`).

## Open questions

- **OQ-1** ~~¿`completed` debería avanzar?~~ **CERRADA**: no auto-avanza (Behavior 7).
- **OQ-2** ¿Cuántos jugadores están hoy en este estado? ⚠️ **Los bests no salen del device** —
  son localStorage, no hay tabla. La única vía es `score_attempts` vía `reportAttempt`
  (`:3117-3132`, manda `exerciseId = contentId`): wallets con los cuatro `rook-rail-*`.
  **Requiere verificar antes que el laberinto efectivamente reporte intento.** ⛔ No bloquea:
  se trata como **P1 con cara de P0** — dos cuentas confirmadas y el peor síntoma posible.
