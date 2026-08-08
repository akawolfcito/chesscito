# Spec — la consecuencia en el overlay de completado (Paso 1)

**Fecha:** 2026-08-08 · **Estado:** draft — ⚠️ **pide red team antes de `/tdd`**
**Brief:** `docs/product/2026-08-08-progress-visibility-design-brief.md` (aprobado)
**Diseño:** Samus Shepard (BMAD/GDS) con Wolfcito

## Problema

**434 de 443 jugadores jugaron un solo día.** El overlay de completado —el momento de máxima
atención del juego entero— dice todo sobre **el intento** y nada sobre **la pieza**.

Hoy `LabyrinthCompleteOverlay` entrega: título, estrellas, movidas, mejor marca, récord
personal, y Continue/Retry. Cero información sobre dónde quedó el jugador en su recorrido.

## Goal

Que el overlay entregue, además del **momento**, la **consecuencia**: qué cambió en la pieza
por haber hecho esto. **Cero taps, cero pantallas nuevas.**

## Contracts (SDD)

Un resolver **puro**, nuevo, en `lib/training/consequence.ts`:

```ts
/** Lo que el overlay anuncia ADEMÁS del resultado del intento. Una sola por
 *  overlay: es un momento, no una lista, y 390px no dan para más. */
export type TrainingConsequence =
  | { kind: "mastery" }
  | { kind: "badge_ready" }
  | { kind: "challenge_unlocked"; nodeId: string }
  | { kind: "lane_progress"; done: number; total: number };

/** `null` = no hay nada que anunciar. Es un resultado legítimo y frecuente. */
export function resolveConsequence(
  path: readonly TrainingNode[],
): TrainingConsequence | null;
```

### La escalera — precedencia, no acumulación

> ⛔ **Se anuncia UNA SOLA, la más alta que aplique.**
> `mastery` > `badge_ready` > `challenge_unlocked` > `lane_progress`.

| Peldaño | Cuándo | De dónde sale |
|---|---|---|
| `mastery` | La corona quedó al alcance o alcanzada | nodo `mastery:<pieza>` |
| `badge_ready` | Se cruzó el gate de completitud y la insignia es reclamable | nodo `badge:<pieza>` en `available` |
| `challenge_unlocked` | Terminar esto abrió el siguiente desafío | primer `labyrinth` en `available` |
| `lane_progress` | Ninguna de las anteriores | conteo de `labyrinth` completos / total |

⛔ **`null` no es un caso borde: es la mitad del diseño.** Si no hay consecuencia, el overlay
queda **exactamente como hoy**. Un overlay que anuncia progreso cuando no pasó nada miente, y
una vez que miente el jugador deja de leerlo.

## Behavior

1. El overlay muestra la consecuencia como **una línea**, debajo de la narrativa de movidas y
   **antes** de los botones. No compite con el récord personal: si ambos aplican, el récord
   queda donde está y la consecuencia va en su propia línea.
2. **`mastery` y `badge_ready` nunca suenan a callejón.** El estado "terminaste todo" es
   exactamente el del bug que se arregló el 2026-08-07: es el de mayor riesgo de leerse como
   "ya no hay nada". Tiene que leerse como **logro**, y nombrar lo que sigue.
3. La consecuencia **no cambia** los botones ni el flujo. `onContinue` / `onRetry` intactos.
4. Se lee del `trainingPath` **ya construido** por la pantalla. El resolver no arma path.

## Slices

- **1A — el resolver puro.** `resolveConsequence` + tests. Sin UI.
- **1B — cableado al overlay de desafío.** `LabyrinthCompleteOverlay`.
- **1C — cableado al overlay de ejercicio.** `result-overlay.tsx` (31,8 KB, el grande).
  ⚠️ Los ejercicios son los que mueven el gate de la insignia, así que 1C es donde vive
  `badge_ready` en la práctica. **Slice aparte a propósito**, no se mezcla con 1B.

## Acceptance criteria

- [ ] **AC-1** Terminar un desafío que abre el siguiente anuncia `challenge_unlocked`.
- [ ] **AC-2** Sin consecuencia, el overlay queda **idéntico al de hoy** — ninguna línea nueva.
- [ ] **AC-3** La escalera respeta precedencia: con `badge_ready` y `lane_progress` juntos,
      se anuncia **sólo** `badge_ready`.
- [ ] **AC-4** Terminar el último desafío de la pieza **no** produce un mensaje de callejón:
      anuncia el peldaño más alto que aplique y nombra lo que sigue.
- [ ] **AC-5** ⛔ **Guard del path mentiroso.** `buildTrainingPath` deja **todos** los nodos en
      `locked` **sin error** si se omite `labyrinthBests`. Un path así **no debe** producir
      consecuencia: `resolveConsequence` devuelve `null` antes que anunciar progreso falso.
      Es la única forma de que este feature mienta, y es silenciosa.
- [ ] **AC-6** Los botones y el flujo de `onContinue` / `onRetry` no cambian.

## Out of scope

- **Paso 2** (progreso fino en la baldosa del hub) y **Paso 3** (promover el mapa).
- Animar el cambio. La consecuencia es **texto** en este paso; el teatro es otra discusión.
- Estrellas del carril y su contribución al metajuego.

## Open questions

- **OQ-1** ¿`mastery` y `badge_ready` deberían ofrecer una **acción** (reclamar la insignia)
  desde el overlay? Sería un tap ganado, no gastado — pero toca los botones, que el AC-6
  congela. **Decisión de producto.**
- **OQ-2** El copy exacto de los cuatro peldaños. Va a `editorial.ts`; el brief de lenguaje
  prohíbe "on-chain"/NFT/mint.
- **OQ-3** ¿`lane_progress` cuenta desafíos, ejercicios, o los dos? Contar los dos junta cuatro
  reglas de puntuación distintas en un solo número.
