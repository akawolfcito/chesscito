# Decisiones de diseño — la consecuencia en el overlay (A5, M8/OQ-1, OQ-3)

**Fecha:** 2026-08-08 · **Diseño:** Samus Shepard (BMAD/GDS) a pedido de Wolfcito
**Insumo de:** `docs/specs/2026-08-08-consequence-in-completion-overlay.md` + su red team
**Estado:** decidido — se aplica al spec antes de `/tdd`

> Las tres eran decisiones de **diseño**, no técnicas. B1/B2/B3/A4 salen del código y ya están
> resueltas en el red team; no pasaron por acá.

---

## Números reales (el red team los tenía mal)

El red team dice "~13 ejercicios por pieza". **Son 9–10.** Verificado contra
`puzzles.generated.ts` el 2026-08-08:

| Pieza | Ejercicios | Gate insignia (80%, `badgeRequiredCount`) | Carril de desafíos (ya proyectado) |
|---|---|---|---|
| rook | 10 | 8 | 4 (`rook-rail-*`) |
| bishop | 9 | 8 | 3 (Pivot) |
| knight | 10 | 8 | 3 (Tour) |
| pawn | 10 | 8 | 3 (Promotion Run) |
| queen | 10 | 8 | 3 (N-Queens) |
| king | 10 | 8 | 3 (Safe Path) |

⚠️ El carril de desafíos es el **proyectado** (`projectSpecialTrainingLane`), no el crudo. El
crudo del rey tiene 1 laberinto y el del caballo 5 — ninguno de los dos es lo que se ve.

Esto importa para A5: **"3 de 13" no existe**. El número malo real sería "3 de 10", y sigue
siendo el número equivocado por la razón de abajo.

---

## A5 — Los peldaños se deciden por CARRIL, no por slice

**Decisión: un solo resolver, una sola unión, cinco peldaños. El carril del nodo que acaba de
completarse elige el peldaño de piso.**

Que 1B y 1C sean slices distintos es un hecho de implementación. Lo que cambia el significado
no es el overlay: es **de qué carril salió el nodo**. Atar los peldaños a los slices deja el
mismo resolver diciendo dos cosas distintas según quién lo llame — que es exactamente el bug
que `projectSpecialTrainingLane` ya tuvo que venir a arreglar en otra capa.

```ts
export type TrainingConsequence =
  | { kind: "mastery" }
  | { kind: "badge_ready" }
  | { kind: "challenge_unlocked"; nodeId: string }
  /** Piso del carril de EJERCICIOS. Cuenta contra el gate, nunca contra el pool. */
  | { kind: "badge_progress"; done: number; required: number }
  /** Piso del carril de DESAFÍOS. Cuenta contra el largo del carril. */
  | { kind: "lane_progress"; done: number; total: number };
```

Con el contrato de transición (B1), el resolver ya sabe **qué nodo** pasó a `complete`. Su
`kind` elige el piso. No hacen falta dos funciones ni un parámetro de "modo".

### Por qué el denominador del ejercicio es el GATE y no el pool

⛔ **"8 de 10" es el número equivocado, aunque sea cierto.** Lo que paga es la insignia, y la
insignia sale a las **8**. Un jugador en 7 que lee "7 de 10" cree que le faltan tres; le falta
**una**. El número correcto es **"7 de 8"** — y ahí el peldaño se lee solo.

Consecuencia buena y deliberada: por encima del gate (8, 9, 10 de 10) **no hay peldaño de
piso** → `null` → el overlay queda como hoy. Es correcto: esos ejercicios ya no mueven nada.
Refuerza B2 en vez de pelearse con él.

⚠️ El pool es **dinámico** (el overlay de Supabase puede agregar ejercicios). Por eso
`required` se lee de `badgeRequiredCount(pool.length)` en cada resolución y **nunca** se pinea
un 8 en un test — vale la invariante de
[[feedback_never_pin_authored_content_in_tests]].

### Las dos escaleras que resultan

| Carril | Escalera efectiva |
|---|---|
| **Ejercicio** (1C) | `mastery` > `badge_ready` > `challenge_unlocked` > `badge_progress` |
| **Desafío** (1B) | `mastery` > `challenge_unlocked` > `lane_progress` |

`badge_ready` **no puede** salir de un desafío: la insignia la mueven sólo los ejercicios
(`path.ts:113-115`, `completedExercises`). No hay que prohibirlo — con transiciones **nunca
dispara**, y un test lo fija.

`challenge_unlocked` **sí** sale de los dos carriles: un ejercicio abre el primer desafío
(gate compuesto `LABYRINTH_UNLOCK_THRESHOLD` + `LABYRINTH_MIN_EXERCISES`) y un desafío abre el
siguiente. Es el peldaño que **cose los dos carriles**, y es el más valioso del set.

### `mastery` = corona ALCANZADA, no "al alcance"

El spec decía "quedó al alcance o alcanzada". Se recorta a **alcanzada**
(`available` → `complete`). "Al alcance" no es una transición que produzca jugar: el nodo
mastery pasa a `available` cuando se **reclama** la insignia, no cuando se juega. Y el caso que
el spec quería cubrir —"te falta el último"— ya lo dice mejor `lane_progress` con
`done === total - 1`. Un peldaño, un significado.

---

## OQ-3 — `lane_progress` cuenta UN carril: el que acabás de jugar

**Nunca los dos.** Tres razones, en orden de peso:

1. **Un número que el jugador no puede reconciliar se lee como mentira.** Puede contar 4
   desafíos. No puede contar "7 de 24" contra nada que vea en pantalla. Ya nos pasó y ya está
   escrito: [[feedback_an_unauditable_number_reads_as_a_lie]].
2. **Juntar los carriles junta cuatro reglas de puntuación distintas** (movidas, cobertura,
   llegada, fallos) en un solo número. El propio brief lo marca como riesgo.
3. **Cada carril ya tiene su premio**: los ejercicios pagan **insignia**, los desafíos pagan
   **corona**. Un número mezclado no nombra ninguno de los dos — y el peldaño de piso existe
   justamente para nombrar el premio.

Corolario: el peldaño de piso **siempre nombra su premio**. "3 de 4" solo no alcanza; "3 de 4 ·
uno más y la corona" sí. El brief ya escribió el patrón. El copy exacto sigue en OQ-2.

---

## M8 / OQ-1 — NO se reclama la insignia desde el overlay. **AC-6 gana.**

**Decisión: OQ-1 se cierra en NO para el Paso 1.** No es una postergación por tiempo; es que
el overlay es el peor lugar posible para esa acción.

1. **Reclamar es una transacción on-chain.** Meter una firma de wallet adentro del momento de
   máxima atención convierte la celebración en un prompt de MiniPay — y si falla (sin fondos,
   sin wallet, invitado), convierte la celebración en un **error**. Se interrumpe un
   sentimiento con una transacción. Eso no se hace.
2. **Sería celebrar dos veces lo mismo.** Ya existen el Badge Earned modal y la cola de la
   milestone machine, y el brief pide **reusar** esa cola, no abrir una segunda puerta de
   claim que compita con ella.
3. **El Paso 1 es una sonda barata.** Si le colgamos un CTA transaccional, deja de ser barata
   **y contamina la medición**: si la retención se mueve, no sabemos si fue la visibilidad o
   el claim. Con 443 jugadores no hay margen para confundir dos variables.

⚠️ Que no haya botón **no exime** de AC-4: `badge_ready` tiene que nombrar dónde está la
insignia, en texto. "Está lista" sin destino es exactamente el callejón que AC-4 prohíbe.

**Dónde sí va la acción: Paso 2.** La baldosa del hub ya modela `claimable`
(`reward-column.tsx:10`) — cero superficie nueva, cero transacción dentro de una celebración.
Ahí el tap se lo gana.

> ⚠️ **Corrección (2026-08-08, al escribir el copy).** Arriba decía que la baldosa "ya es la
> puerta". **No lo es para reclamar.** Tocar una baldosa `claimable` sólo hace
> `router.push('/exercises?piece=…')` (`learn-hub-client.tsx:415-426`); el único botón
> **Claim Badge** vive en el drawer de Exercises (`exercise-drawer.tsx:620-637`).
>
> Consecuencias:
> 1. El copy de `badge_ready` apunta a **Exercises**, no al hub. Apuntar al hub mandaba al
>    jugador de viaje redondo al lugar del que salió.
> 2. **El Paso 2 hereda trabajo que no estaba contado**: si la baldosa va a ofrecer la acción,
>    primero tiene que *tener* la acción. Hoy no la tiene.
> 3. ⛔ **`Continue` tampoco abre el drawer** (`exercises-screen.tsx:3315-3333`): va a próximo
>    ejercicio, próximo desafío, o PieceComplete. El puntero de texto no es redundante.

---

## Qué se lleva el spec

| # | Cambio |
|---|---|
| A5 | Unión de **cinco** peldaños; el piso lo elige el **carril del nodo completado**, no el slice |
| A5 | `badge_progress` cuenta contra `badgeRequiredCount`, **jamás** contra el pool |
| A5 | `mastery` = corona **alcanzada**; se cae "al alcance" |
| A5 | Por encima del gate de la insignia, el ejercicio no tiene piso → `null` |
| OQ-3 | `lane_progress` = **un** carril, el jugado. Y **nombra su premio** |
| M8/OQ-1 | **NO** hay acción de claim en el overlay. AC-6 se mantiene. La acción se reasigna al Paso 2 |
