# Red team — spec `consequence-in-completion-overlay`

**Fecha:** 2026-08-08 · **Contra:** `docs/specs/2026-08-08-consequence-in-completion-overlay.md`
**Método:** cada hallazgo verificado contra el código. Nada acá es sospecha.

**Veredicto: la dirección es correcta, el contrato NO.** Tres bloqueantes. El primero invalida
la firma del resolver; el tercero pide un AC que **no se puede implementar**.

---

## 🔴 B1 — El resolver no puede detectar tres de sus cuatro peldaños

La firma propuesta es:

```ts
resolveConsequence(path: readonly TrainingNode[]): TrainingConsequence | null
```

Un **snapshot** del path dice **estado**, no **transición**. Y tres de los cuatro peldaños son
transiciones:

| Peldaño | Cómo lo detectaría | Por qué falla |
|---|---|---|
| `badge_ready` | nodo badge en `available` | `available` es verdad **desde que se gana hasta que se reclama** (`path.ts:179-183`). Se anunciaría en **cada** overlay de ese período. |
| `challenge_unlocked` | primer labyrinth `available` | `available` es verdad **mientras no lo completes** (`path.ts:156`, `:223-227`). Se repite en cada overlay. |
| `mastery` | nodo mastery | Igual: es un estado persistente, no un instante. |
| `lane_progress` | conteo | ✅ Este sí es legítimamente un estado. |

> **El jugador vería "¡tu insignia está lista!" cinco veces seguidas.** La segunda ya no es
> información; la tercera es ruido; la cuarta le enseña a no leer el overlay — que es
> exactamente el canal que este feature venía a abrir.

**Qué hacer:** el resolver recibe la **transición**, no el estado:

```ts
resolveConsequence(before: readonly TrainingNode[], after: readonly TrainingNode[])
```

Es viable: la pantalla ya mantiene `trainingPathRef` fresco y ya conoce el problema del path
pre-completación (el comentario de QA G1 en `exercises-screen.tsx:3158-3161` existe justamente
porque el closure de 1500 ms ve el path **anterior**). Ese "anterior" es el `before` que hace
falta — ya está ahí, sin estado nuevo.

---

## 🔴 B2 — `null` es inalcanzable, y el spec se apoya en que sea frecuente

El spec dice, en negrita: *"`null` no es un caso borde: es la mitad del diseño"*.

Pero con `lane_progress` como **piso** de la escalera, después de terminar un desafío **siempre**
hay un conteo que anunciar. `null` **nunca ocurre** en el slice 1B. La mitad del diseño que el
spec defiende no existe.

Peor: el `Retry` sobre un desafío ya completado (`labyrinth-complete-overlay.tsx:180-186`)
vuelve a disparar el overlay y volvería a anunciar el mismo "3 de 4" — el caso más claro de
"no pasó nada" del producto entero.

**Se arregla solo con B1:** con transiciones, rejugar algo terminado no cambia nada → `null` →
el overlay queda como hoy. `null` vuelve a ser frecuente **y correcto**.

---

## 🔴 B3 — AC-5 no es implementable, y su premisa es falsa

> *"AC-5 Un path con todos los nodos en `locked` no debe producir consecuencia."*

Tres problemas, en orden de gravedad:

1. **Los nodos de ejercicio NUNCA son `locked`** (`path.ts:130`:
   `status: stars > 0 ? "complete" : "available"`). "Todos los nodos locked" es un estado
   **imposible**. El AC describe algo que no puede ocurrir.
2. **Omitir `labyrinthBests` no deja todo locked.** El nodo 0 queda `available` si se cumple el
   gate (`path.ts:150`: `unlocked = index === 0 ? meetsFirstLabGate : previousComplete`). Lo que
   realmente pasa es que **los completados parecen no completados**.
3. ⛔ **Y ese estado es indistinguible de un jugador temprano legítimo.** Un jugador que
   desbloqueó su primer desafío y no lo terminó tiene **exactamente** el mismo path. El
   resolver puro **no puede** detectar la diferencia — no hay información en el path que la
   contenga.

**Qué hacer:** el guard **no puede vivir en el resolver**. Tiene que vivir en el call site: que
la pantalla pase bests reales, verificado por un test de integración o un source guard. El AC se
reescribe apuntando ahí. ⚠️ Como está, un `/tdd` va a escribir un test que pasa en verde
comprobando una condición imposible — cobertura de cero con cara de cobertura.

---

## 🟠 A4 — El VR va a quedar VERDE con el overlay cambiado

Hay una baseline que fotografía justamente este overlay: `vr13-labyrinth-king-solved`
(`visual-regression.spec.ts:985`, vía `/dev/exercises-popups?variant=labyrinth-king-solved`).

Pero el fixture pasa **sólo props del intento** (`fixture.tsx:62-71`: `moves`, `optimalMoves`,
`stars`, `previousBest`, `isNewBest`, callbacks). Si la consecuencia entra como prop nueva, el
fixture **no la pasa** → la foto no cambia → **VR verde con el producto cambiado**.

Es el modo de falla ya documentado: *un fixture fotografía menos de lo que se envía*.

**Qué hacer:** actualizar el fixture con **dos variantes** —con consecuencia y sin— y agregar la
baseline. Costo real que el spec no menciona.

---

## 🟠 A5 — `lane_progress` no significa lo mismo en los dos slices

- **Slice 1B (desafío):** "3 de 4" funciona — son 3-4 niveles por pieza.
- **Slice 1C (ejercicio):** la pieza tiene ~13 ejercicios y el gate de la insignia es **80% de
  completitud**, no estrellas. "3 de 13" no le dice nada a nadie, y no es el número que gobierna
  la insignia.

Un mismo `lane_progress` para los dos overlays **o miente o confunde**. Los dos slices necesitan
peldaños propios; no es el mismo resolver aplicado dos veces. **Decidirlo antes de 1A**, porque
define la firma.

---

## 🟡 M6 — Sin telemetría, este feature es inauditable

No hay poder estadístico para un A/B (443 jugadores) — el propio brief lo dice. Entonces **la
única señal** de si esto funciona es saber qué consecuencia se anunció y con qué frecuencia.

El overlay ya trackea (`labyrinth-complete-overlay.tsx:63-77`). Agregar el `kind` anunciado es
casi gratis y es la diferencia entre iterar con dato y con opinión. **Falta un AC.**

## 🟡 M7 — Espacio a 390px

El overlay ya apila: título + 3 stat pills + narrativa de movidas + línea de récord/perfect +
2 botones + avatar. El spec permite que récord **y** consecuencia aparezcan juntos (§1) → en el
peor caso son **dos líneas nuevas**. Con `PrincipalButton` + secundario abajo, el riesgo es que
el CTA salga de vista. Pide un AC de layout y su baseline.

## 🟡 M8 — OQ-1 se contradice con AC-6

OQ-1 pregunta si el overlay debería ofrecer **reclamar la insignia**; AC-6 congela los botones.
El spec plantea la pregunta y a la vez la prohíbe. Elegir una.

---

## Qué cambiar antes de `/tdd`

1. Firma del resolver: **transición, no estado** (`before`/`after`). (B1)
2. Reafirmar `null` como resultado frecuente — sale gratis con B1. (B2)
3. Reescribir **AC-5**: el guard va al call site, no al resolver puro. (B3)
4. Fixture de `/dev` con dos variantes + baseline nueva. (A4)
5. Decidir peldaños **por slice** antes de fijar la firma. (A5)
6. AC de telemetría del `kind` anunciado. (M6)
7. AC de layout a 390px con el peor caso (récord + consecuencia). (M7)
8. Resolver OQ-1 contra AC-6. (M8)
