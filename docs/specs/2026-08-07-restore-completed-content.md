# Spec — restore-completed-content

**Fecha:** 2026-08-07 · **Estado:** draft — ⚠️ **pide red team antes de `/tdd`**
**Bug:** prod, `learn.chesscito.com`, reproducido en dos cuentas
**Reproducción:** `components/exercises/__tests__/restore-completed-content.test.tsx` (`it.skip`)
**Handoff:** `docs/handoffs/2026-08-07-cta-slot-and-restore-bug-handoff.md`

## Problema

Un jugador termina el último laberinto de la torre (`Rook Run`) al óptimo, 3/3 estrellas.
Vuelve al hub, toca la torre, y **aterriza otra vez en `Rook Run`**. Repetidamente. Se lee
como *"mi progreso no se guarda"*.

⛔ **No es un bug de guardado.** El `localStorage` del jugador tiene los cuatro bests:

```json
{"rook-rail-two-turns":12,"rook-rail-dead-end":6,"rook-rail-two-roads":6,"rook-rail-rook-run":10}
```

`getNextChallenge` devuelve **null** correctamente — no hay laberinto disponible.

La causa es el restore al montar (`exercises-screen.tsx:3240`):

```ts
const contentId = directContentId ?? readLastTrainingContentId(selectedPiece);
```

Reabre el último contenido jugado de la pieza **sin preguntar si ya está terminado**. Para un
ejercicio es correcto — reanudar a mitad de intento. Para un laberinto cerrado al óptimo es
indistinguible de no haber avanzado, y con el camino enterrado el jugador no tiene forma de
ver que en realidad los completó todos.

## Goal

Que el restore deje de re-servir un laberinto ya completado, **sin dejar de asentar el estado
inicial de la pantalla**.

## La trampa que ya se pisó una vez

Filtrar el id **antes** de llamar a `requestTrainingContent` rompe
`training-pass-screen-integration`: la pantalla queda en `aria-busy` y el nodo bloqueado nunca
renderiza.

**Por qué**, ahora medido: `requestTrainingContent` resuelve en cuatro acciones, y en
`missing`/`locked` ejecuta **`setExerciseDrawerOpen(true)`** (`exercises-screen.tsx:3191-3202`).
Ese es el settling. Saltearse la llamada se saltea el settling.

> ⛔ **INVARIANTE: el restore SIEMPRE debe pasar por `requestTrainingContent`.** El filtro va
> en el resultado, nunca antes de la llamada.

## Contracts (SDD)

`lib/training/restore-content.ts` ya existe con el predicado puro:

```ts
export function restorableContentId(
  contentId: string | null,
  path: readonly TrainingNode[],
): string | null;
```

⚠️ Su semántica actual —devolver `null` para saltear— **es la que causó la regresión**. El
spec la reencuadra: no decide *si llamar*, decide *qué hacer con el resultado*.

Propuesta: una acción nueva en el resolver, hermana de `missing`/`locked`:

```ts
/** El contenido existe y está DESBLOQUEADO, pero ya fue completado y la
 *  petición es un restore implícito — no un tap explícito ni un deep link.
 *  Se asienta como `missing`: limpia el modo laberinto y abre la senda,
 *  sin tratarlo como error. */
type TrainingContentAction = "pending" | "missing" | "locked" | "completed" | "start";
```

## Behavior

1. `source === "direct"` o `"explicit_tap"` → abre lo que nombra, **siempre**. Rejugar un
   laberinto terminado a propósito es legítimo.
2. `source === "restore"` y el nodo es un **laberinto con `status === "complete"`** →
   resuelve `completed`.
3. `completed` asienta **exactamente como `missing`**: `setLabyrinthMode(false)`,
   `setSelectedLabyrinthId(null)`, `setExerciseDrawerOpen(true)`. Reusa el camino que ya
   funciona en vez de inventar uno.
4. Un **ejercicio** completado sigue reanudándose. Es como el jugador vuelve a un puzzle
   resuelto a mejorar sus estrellas, y es lo que la variante `improve-stars` del loop asume.
5. `pending` no cambia: la hidratación de entitlement manda sobre todo lo demás.

## Acceptance criteria

- [ ] **AC-1** Un laberinto completado marcado como último contenido **no se reabre** al
      montar. (Es el `it.skip` existente — **un-skip, no reescribir**.)
- [ ] **AC-2** Tras ese restore, la senda queda **abierta y visible**, y la pantalla **no**
      queda en `aria-busy`.
- [ ] **AC-3** `training-pass-screen-integration` sigue verde: un laberinto gateado por pass
      renderiza su nodo bloqueado con su CTA de unlock.
- [ ] **AC-4** Un tap explícito sobre un laberinto completado **sí** lo abre.
- [ ] **AC-5** Un ejercicio completado sigue reanudándose.
- [ ] **AC-6** Source guard: el filtro de completitud **no** puede aplicarse antes de
      `requestTrainingContent`. Es la regresión que ya ocurrió una vez.

## Out of scope

- Desenterrar el Path (Sprint 2). ⛔ Pero este fix va **antes**: con el mapa a la vista, el
  bug pasa de "me repite un nivel" a "mi mapa me miente".
- Estrellas del carril y su contribución al metajuego.

## Open questions

- **OQ-1** ¿`completed` debería además **avanzar** a la siguiente acción real (el próximo
  ejercicio) en vez de sólo abrir la senda? Abrir la senda es lo mínimo correcto y lo más
  barato; avanzar es más fluido pero decide por el jugador. **Decisión de producto.**
- **OQ-2** ¿Cuántos jugadores están hoy en este estado? Medible: wallets con los cuatro
  `rook-rail-*` en su mapa. Define si es P0 o P1.
