# Spec — la consecuencia en el overlay de completado (Paso 1)

**Fecha:** 2026-08-08 · **Estado:** ✅ **READY** — red team aplicado, listo para `/tdd`
**Brief:** `docs/product/2026-08-08-progress-visibility-design-brief.md` (aprobado)
**Red team:** `2026-08-08-consequence-in-completion-overlay-redteam.md` (8 correcciones, todas aplicadas)
**Decisiones de diseño:** `docs/product/2026-08-08-consequence-design-decisions.md` (A5, M8/OQ-1, OQ-3)
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
  /** Piso del carril de EJERCICIOS. `required` es el GATE de la insignia,
   *  jamás el tamaño del pool. */
  | { kind: "badge_progress"; done: number; required: number }
  /** Piso del carril de DESAFÍOS. `total` es el largo del carril PROYECTADO. */
  | { kind: "lane_progress"; done: number; total: number };

/** ⛔ Recibe la TRANSICIÓN, no el estado. Un snapshot del path dice estado, y
 *  tres de los cinco peldaños son transiciones: leerlos de un snapshot los
 *  anunciaría en CADA overlay mientras el estado dure (red team B1).
 *
 *  `null` = no hay nada que anunciar. Es un resultado legítimo y frecuente. */
export function resolveConsequence(
  before: readonly TrainingNode[],
  after: readonly TrainingNode[],
): TrainingConsequence | null;
```

### El `before` ya existe — no hay estado nuevo

La pantalla mantiene `trainingPathRef` fresco y **ya conoce** el problema del path
pre-completación: el comentario de QA G1 en `exercises-screen.tsx:3158-3161` existe justamente
porque el closure de 1500 ms ve el path **anterior**. Ese "anterior" **es** el `before`.

⚠️ Los dos snapshots deben salir del carril **proyectado**
(`projectSpecialTrainingLane`), no del crudo. El carril crudo del rey tiene 1 nivel y el del
caballo 5; ninguno de los dos es lo que el jugador ve.

### La escalera — precedencia, no acumulación

> ⛔ **Se anuncia UNA SOLA, la más alta que aplique.**
> `mastery` > `badge_ready` > `challenge_unlocked` > piso del carril.

| Peldaño | Transición que lo dispara | De dónde sale |
|---|---|---|
| `mastery` | nodo `mastery:<pieza>` pasa a `complete` | la corona **alcanzada** |
| `badge_ready` | nodo `badge:<pieza>` pasa `locked` → `available` | se cruzó el gate de completitud |
| `challenge_unlocked` | un `labyrinth` pasa `locked` → `available` | `nodeId` = ese nodo |
| `badge_progress` | piso, si completó un **ejercicio** | `done` = ejercicios completos; `required` = `unlock.min` del nodo badge |
| `lane_progress` | piso, si completó un **desafío** | `done`/`total` = nodos `labyrinth` del path |

**El piso lo elige el CARRIL del nodo completado, no el slice** (decisión A5). El mismo
resolver sirve a los dos overlays; no hay parámetro de "modo" ni dos funciones.

Consecuencias que se siguen solas, y son deseadas:

- `badge_ready` **nunca** sale de un desafío — la insignia la mueven sólo los ejercicios
  (`path.ts:113-115`). No hay que prohibirlo: con transiciones no dispara nunca.
- `challenge_unlocked` sale de **los dos** carriles (un ejercicio abre el primer desafío vía
  `LABYRINTH_UNLOCK_THRESHOLD` + `LABYRINTH_MIN_EXERCISES`). Es el peldaño que **cose** los
  carriles, y el más valioso del set.
- Por **encima** del gate de la insignia (`done >= required`) el ejercicio no tiene piso →
  `null`. Correcto: esos ejercicios ya no mueven nada.

### `required` sale del path, nunca del catálogo

El nodo badge lleva `unlock: { type: "completion", min: badgeRequiredCount(pool) }`
(`path.ts:175-178`). El resolver lee **ese `min`**. Así el pool dinámico (overlay de Supabase)
se refleja solo, el resolver no importa el catálogo, y ningún test pinea un 8.

⛔ **El denominador del ejercicio es el gate (8), no el pool (10).** Un jugador en 7 que lee
"7 de 10" cree que le faltan tres; le falta **una**.

### `null` es la mitad del diseño — y ahora sí ocurre

Con transiciones, rejugar algo terminado **no cambia nada** → `null` → el overlay queda
**exactamente como hoy**. Un overlay que anuncia progreso cuando no pasó nada miente, y una vez
que miente el jugador deja de leerlo.

## Behavior

1. El overlay muestra la consecuencia como **una línea**, debajo de la narrativa de movidas y
   **antes** de los botones. No compite con el récord personal: si ambos aplican, el récord
   queda donde está y la consecuencia va en su propia línea.
2. **`mastery` y `badge_ready` nunca suenan a callejón.** El estado "terminaste todo" es
   exactamente el del bug que se arregló el 2026-08-07: es el de mayor riesgo de leerse como
   "ya no hay nada". Tiene que leerse como **logro**, y nombrar lo que sigue.
3. **El piso siempre nombra su premio.** "3 de 4" solo no alcanza; "3 de 4 · uno más y la
   corona" sí. Los ejercicios pagan **insignia**, los desafíos pagan **corona**.
4. La consecuencia **no cambia** los botones ni el flujo. `onContinue` / `onRetry` intactos.
5. Se lee del `trainingPath` **ya construido** por la pantalla. El resolver no arma path.

## Slices

- **1A — el resolver puro.** `resolveConsequence` + tests. Sin UI.
- **1B — cableado al overlay de desafío.** `LabyrinthCompleteOverlay` + fixture `/dev` con dos
  variantes + baselines VR.
- **1C — cableado al overlay de ejercicio.** `result-overlay.tsx` (31,8 KB, el grande).
  ⚠️ Los ejercicios son los que mueven el gate de la insignia, así que 1C es donde vive
  `badge_ready` en la práctica. **Slice aparte a propósito**, no se mezcla con 1B.

## Acceptance criteria

### Slice 1A — el resolver

- [ ] **AC-1** Un desafío que al completarse deja el siguiente `locked` → `available` anuncia
      `challenge_unlocked` con el `nodeId` de ese siguiente.
- [ ] **AC-2** Sin transición, `null`. El overlay queda **idéntico al de hoy** — ninguna línea
      nueva, ningún hueco de layout.
- [ ] **AC-3** La escalera respeta precedencia: con `badge_ready` y un piso juntos, se anuncia
      **sólo** `badge_ready`.
- [ ] **AC-4** Terminar el último nivel de un carril **no** produce un mensaje de callejón:
      anuncia el peldaño más alto que aplique y nombra lo que sigue.
- [ ] **AC-5** ⛔ **Guard del snapshot rancio** (reemplaza el AC-5 original, que era
      inimplementable — ver red team B3). Un intento completa **exactamente un** nodo de kind
      `exercise` o `labyrinth`. Si el diff muestra **cero** (rejugar) o **dos o más**
      (`before` no hidratado, o catálogo que cambió entre snapshots), `resolveConsequence`
      devuelve `null` antes que anunciar progreso falso.
      ⚠️ Los nodos `badge`/`mastery` **sí** pueden voltear en el mismo paso — para eso están.
      ⚠️ Si los dos snapshots no tienen el mismo conjunto de ids, `null` también.
      > El AC viejo pedía detectar "todos los nodos `locked`", que es un estado **imposible**
      > (`path.ts:130`: un ejercicio nunca es `locked`) e **indistinguible** de un jugador
      > temprano legítimo. Un `/tdd` sobre él habría escrito un test verde que no cubre nada.
- [ ] **AC-6** ⛔ **El resolver no lee el catálogo.** `required` sale del `unlock.min` del nodo
      badge; `total` sale del conteo de nodos del path. Ningún test pinea 8 ni 10.
- [ ] **AC-7** Rejugar un nivel ya completado → `null` (`before` ≡ `after`).
- [ ] **AC-8** Piso por carril: completar un **ejercicio** bajo el gate da `badge_progress`
      contado contra `required`; **encima** del gate (`done >= required`) da `null`.
      Completar un **desafío** da `lane_progress` contado contra el carril del path.

### Slices 1B / 1C — el cableado

- [ ] **AC-9** Los botones y el flujo de `onContinue` / `onRetry` no cambian. ⛔ **No hay
      acción de reclamar la insignia en el overlay** — OQ-1 cerrada en NO (ver M8 abajo).
- [ ] **AC-10** **Telemetría.** Cuando se renderiza una consecuencia se emite
      `track("consequence_shown", { kind, surface })` (`surface`: `"labyrinth"` | `"exercise"`).
      Con `null` **no se emite nada**. Sin esto el feature es inauditable: con 443 jugadores no
      hay poder estadístico para un A/B, así que la frecuencia por `kind` es la **única** señal.
- [ ] **AC-11** **Layout a 390px.** En el peor caso —récord personal **y** consecuencia, dos
      líneas nuevas— el `PrincipalButton` y el secundario siguen **en vista** a 390×844 sin
      scroll. Baseline VR del peor caso.
- [ ] **AC-12** **Fixture honesto.** `/dev/exercises-popups` gana dos variantes
      (`labyrinth-king-solved` con consecuencia y sin) y sus baselines.
      ⚠️ Hoy el fixture pasa **sólo props del intento** (`fixture.tsx:62-71`): si la
      consecuencia entra como prop nueva y el fixture no la pasa, `vr13-labyrinth-king-solved`
      queda **verde con el producto cambiado**.
- [ ] **AC-13** **Guard del call site** (lo que el AC-5 viejo quería y no podía). Un test de
      integración: la pantalla no resuelve consecuencia con bests no hidratados —
      un `before` vacío no produce línea. El guard vive acá, **no** en el resolver puro.

## Out of scope

- **Paso 2** (progreso fino en la baldosa del hub) y **Paso 3** (promover el mapa).
- Animar el cambio. La consecuencia es **texto** en este paso; el teatro es otra discusión.
- Estrellas del carril y su contribución al metajuego.
- **Reclamar la insignia desde el overlay** — reasignado al Paso 2 (ver M8).

## Decisiones cerradas por el red team

| # | Qué decía | Qué quedó |
|---|---|---|
| **B1** | `resolveConsequence(path)` | `resolveConsequence(before, after)` — transición, no estado |
| **B2** | `null` "frecuente" pero inalcanzable | `null` frecuente **de verdad**: sale gratis con B1 (AC-7) |
| **B3** | AC-5 "todos los nodos locked" | Guard de snapshot rancio (AC-5) + guard de call site (AC-13) |
| **A4** | fixture sin actualizar | AC-12: dos variantes + baselines |
| **A5** | un `lane_progress` para todo | Cinco peldaños; el **carril** elige el piso; el ejercicio cuenta contra el **gate** |
| **M6** | sin telemetría | AC-10: `consequence_shown` con `kind` |
| **M7** | sin AC de layout | AC-11: peor caso a 390×844 + baseline |
| **M8** | OQ-1 vs AC-6 | **AC-6 gana**; OQ-1 cerrada en NO, la acción va al Paso 2 |

### M8 / OQ-1 — por qué NO se reclama desde el overlay

1. **Reclamar es una transacción on-chain.** Una firma de MiniPay dentro del momento de máxima
   atención convierte la celebración en un prompt — y si falla (sin fondos, sin wallet,
   invitado), la celebración **es** el error.
2. **Sería celebrar dos veces lo mismo.** Ya existen el Badge Earned modal y la cola de la
   milestone machine, que el brief pide **reusar**, no duplicar.
3. **El Paso 1 es una sonda barata.** Un CTA transaccional deja de ser barato **y contamina la
   medición**: si la retención se mueve, no sabríamos si fue la visibilidad o el claim.

⚠️ Que no haya botón **no exime** de AC-4: `badge_ready` tiene que nombrar **dónde** está la
insignia, en texto. "Está lista" sin destino es exactamente el callejón que AC-4 prohíbe.

## Números del catálogo (verificados 2026-08-08)

| Pieza | Ejercicios | Gate insignia | Carril de desafíos (proyectado) |
|---|---|---|---|
| rook | 10 | 8 | 4 |
| bishop | 9 | 8 | 3 |
| knight | 10 | 8 | 3 |
| pawn / queen / king | 10 | 8 | 3 c/u |

> El red team decía "~13 ejercicios por pieza". Son **9–10**. El pool es **dinámico** (overlay
> de Supabase), por eso nada de esto se pinea: `required` sale del path (AC-6).

## Open questions

- **OQ-2** El copy exacto de los cinco peldaños. Va a `editorial.ts`; el brief de lenguaje
  prohíbe "on-chain"/NFT/mint (→ "Saved on Celo"). Se resuelve al empezar 1B.
- ~~**OQ-1**~~ Cerrada: **NO** hay acción de claim en el overlay (M8).
- ~~**OQ-3**~~ Cerrada: `lane_progress` cuenta **un** carril, el jugado. Nunca los dos —
  mezclarlos junta cuatro reglas de puntuación en un número que el jugador no puede
  reconciliar, y un número así se lee como mentira.
