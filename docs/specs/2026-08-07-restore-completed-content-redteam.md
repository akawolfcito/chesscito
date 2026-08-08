# Red team — spec `restore-completed-content`

**Fecha:** 2026-08-07 · **Contra:** `docs/specs/2026-08-07-restore-completed-content.md`
**Método:** cada hallazgo verificado contra el código en `main` + la rama
`feat/daily-cta-content-loop`. Nada acá es una sospecha: cada uno cita línea.

**Veredicto: el diagnóstico es correcto, el diseño del fix NO está listo para `/tdd`.**
Tres bloqueantes. Dos de ellos harían que la implementación "correcta" salga **roja** o
**verde por el motivo equivocado**.

---

## 🔴 B1 — AC-1 se contradice con AC-2: el test existente **no puede** un-skipearse tal cual

El spec dice: *"Es el `it.skip` existente — **un-skip, no reescribir**"*.

La aserción es:

```ts
expect(screen.queryByText(ROOK_LAB.title!)).toBeNull();  // "Probe Rails"
```

Pero el settling que el propio spec exige (`completed` asienta como `missing` →
`setExerciseDrawerOpen(true)`) **abre la senda**, y un nodo de Special Training en el drawer
**imprime su título autorado** — es una decisión de producto explícita
(`exercise-drawer.tsx:317-318`, B4.2.3, "Rook Rails, Pivot Challenge").

> **Con el fix correcto aplicado, "Probe Rails" queda en el DOM — dentro del drawer — y
> AC-1 falla.** El único mundo donde ese `queryByText` pasa es aquel donde la senda **no**
> se abre, o sea el mundo que AC-2 prohíbe.

**Qué hacer:** el test **se reescribe** (guardando el fixture, que es lo caro y lo que el
handoff pedía no perder). El observable de "se abrió el laberinto" no puede ser el título:
tiene que ser el **modo laberinto**, que es lo que la pantalla monta —
la línea de misión (`tLab("missionTitle")`, `exercises-screen.tsx:3560`) o el control de
salida. Y AC-2 debe afirmar **en positivo** que el nodo aparece en la senda, no sólo que no
hay `aria-busy`.

⚠️ Corolario: el rojo original que "confirmó la causa" se confirmó con una aserción que
también es sensible al drawer. Sigue siendo el bug correcto — el laberinto se montaba de
verdad — pero el rojo era **más ancho** que el bug.

---

## 🔴 B2 — La precedencia `locked` vs `completed` no está escrita, y el AC-3 ya depende de ella

El spec enumera comportamientos pero **nunca dice en qué orden se resuelven**. Y no es
teórico: el test que el spec nombra como AC-3 **ya restaura un laberinto completado**.

`training-pass-screen-integration.test.tsx:212-216`:

```ts
expect(getLabyrinthBest("knight", "knight-tour-2")).toBe(18);   // ← quedó COMPLETO
view.unmount();
renderWithAppProviders(screenTree());                            // ← sin initialContentId → RESTORE
await screen.findByRole("button", { name: "…Unlock Challenges" });
```

`buildTrainingPath` marca `complete = best !== null` (`path.ts:143`). O sea: en ese restore,
`knight-tour-2` es **completado Y gateado por pass a la vez**. Hoy pasa porque `locked` se
resuelve **antes** de mirar el estado del nodo (`exercises-screen.tsx:3191` corre antes de
`3205`). Si la implementación mete el chequeo de completitud arriba, ese test se pone rojo y
va a parecer una regresión de pass.

> **INVARIANTE que falta en el spec:**
> `pending` > `missing`/`locked` > `completed` > `start`.
> Un laberinto completado **y** gateado responde `locked`, porque el CTA de unlock es
> información que el jugador necesita más que el aviso de "ya lo hiciste".

Esto es, además, el AC que **de verdad** protege la regresión (ver B6).

---

## 🔴 B3 — La acción nueva no puede vivir donde el spec la pone

El spec propone *"una acción nueva en el resolver, hermana de `missing`/`locked`"* y muestra:

```ts
type TrainingContentAction = "pending" | "missing" | "locked" | "completed" | "start";
```

Dos problemas de contrato:

1. **Ese tipo no existe.** El real es `TrainingContentRequestResult`
   (`lib/training/content-access.ts:24`), una unión de **objetos**, no de strings.
2. **El resolver no tiene con qué decidirlo.** `resolveTrainingContentRequest` recibe
   `{ contentId, catalog, trainingPass, source }` — **ningún estado de progreso**. Emitir
   `completed` desde ahí obliga a inyectarle el path, ensanchando un módulo puro y bien
   testeado para responder algo que su llamador ya sabe.

**El lugar correcto ya existe y ya hace exactamente esta forma de branch:**
`exercises-screen.tsx:3205-3214` busca el nodo en `trainingPathRef.current` y, si está
`locked`, asienta como `missing`. El fix es **una condición más en ese branch**, con `source`
—que ya es parámetro— a la vista. Cumple la invariante del spec al pie: es el **resultado**
de `requestTrainingContent`, no un filtro previo.

Si se quiere el nombre `completed` para diagnóstico, se agrega a
`TrainingContentRequestResult` pero **lo produce el componente**, no el resolver puro.

---

## 🟠 A4 — AC-5 describe un flujo que no existe

> *"AC-5 Un ejercicio completado sigue reanudándose."*

`writeLastTrainingContentId` tiene **un solo call site**: `exercises-screen.tsx:3223`, dentro
de la rama que arranca un **laberinto**. El id restaurado **siempre es un laberinto**. Y aun
si hubiera un id de ejercicio ahí, `requestTrainingContent` busca en `labyrinthList` → daría
`missing`.

La reanudación de ejercicios es **otro mecanismo** (`progress.currentId`), que este efecto no
toca. AC-5 no es falso: es **invérificable como está escrito**, y un test que "lo pruebe" va a
estar probando otra cosa.

Reescribir como: *"un id de ejercicio en el slot de restore no cambia de comportamiento"*, o
borrarlo y decir en Out of scope que la reanudación de ejercicios vive fuera de este efecto.

⚠️ Lo mismo aplica al comentario de `restore-content.ts:26-33`, que razona largo sobre
ejercicios que nunca llegan ahí.

---

## 🟠 A5 — `restorableContentId` es código muerto y el spec no lo mata

Cero llamadores, cero tests (`grep` en todo `src`). El spec dice que "ya existe" y que le
"reencuadra la semántica", pero el fix diseñado **nunca lo llama** — la decisión se toma
sobre `node.status` dentro de `requestTrainingContent`.

Dejar exportado un predicado cuya semántica es *literalmente la que causó la regresión* es una
trampa para el próximo lector. **Decidir en el spec: se borra** (y su comentario —que es la
parte valiosa— se muda al branch nuevo), **o** se adopta como el predicado del sitio-resultado
con firma nueva (`shouldOpenRestoredContent(node, source)`). No hay tercera opción sana.

---

## 🟠 A6 — AC-6 (source guard) no tiene qué grepear

> *"AC-6 Source guard: el filtro de completitud no puede aplicarse antes de
> `requestTrainingContent`."*

Si A5 se resuelve borrando el módulo, el guard se queda sin símbolo que vigilar. Y "no se
aplica antes de la llamada" no es una propiedad grepeable: es una propiedad **de flujo**.

El detector real de esa regresión **ya existe y ya la detectó**: es AC-3. Propuesta:
**cambiar AC-6** por el caso que hoy nadie cubre explícitamente y que B2 vuelve crítico:

- **AC-6'** Un laberinto **completado Y gateado por pass**, restaurado, resuelve `locked` y
  renderiza su CTA de unlock. (Hoy sale de rebote del test de pass; conviene tenerlo dicho.)

---

## 🟡 M7 — Falta la cuarta fuente: `automatic`

El spec legisla `direct`, `explicit_tap` y `restore`. `TrainingContentRequestSource` tiene
**cuatro** (`content-access.ts:18-22`); `automatic` la usan `handleLabyrinthContinue`
(`:3296`) y el replay post-hidratación (`:3257`). Hoy `resolvePostLabContinue` sólo elige
nodos `available`, así que no debería toparse con un completado — pero eso es una garantía de
**otro** módulo, no del contrato que este spec escribe.

Una línea: **sólo `restore` filtra; `direct`, `explicit_tap` y `automatic` abren.**

---

## 🟡 M8 — "cerrado al óptimo" no es la regla; la regla es "cualquier llegada"

El spec y el fixture hablan de *"al óptimo, 3/3 estrellas"* y el test graba
`ROOK_LAB.optimalMoves`. La regla real es `complete = best !== null` (`path.ts:143`), y un
best se graba en **cualquier llegada al target**, óptima o no (`:3336-3349`).

Está bien así — pero escrito como está, invita a implementar un chequeo de óptimo. **Decirlo
explícito**: un laberinto terminado a 1★ tampoco se re-sirve. Y el fixture debería usar un
valor **peor que el óptimo** para que el test no pase por la razón equivocada.

---

## 🟡 M9 — El puntero rancio nunca se limpia

Tras el fix, `trainingContentSelection:<pieza>` sigue apuntando al laberinto completado **para
siempre**: no existe `clearLastTrainingContentId`. Consecuencia: cada montaje de esa pieza
resuelve `completed` y **fuerza el drawer abierto**.

Eso es justo lo que AC-2 pide, así que no es un bug — pero es una decisión, y el spec no la
toma. **Recomendación: no limpiar.** Limpiar convierte un restore en una escritura y pierde el
"dónde estabas" si mañana el Path lo quiere. Escribirlo como decisión, no dejarlo al azar del
implementador.

---

## 🟡 M10 — OQ-2 se declara "medible" y no dice cómo (los bests no salen del device)

*"wallets con los cuatro `rook-rail-*` en su mapa"* — ese mapa es **localStorage**. No hay
tabla con bests de laberinto.

Lo que sí sale del device es `reportAttempt` (`:3117-3132`), que manda `exerciseId =
contentId`. Si los laberintos reportan intento, la consulta es sobre `score_attempts` con
`exercise_id LIKE 'rook-rail-%'`, contando wallets con las cuatro. **Verificar primero que el
laberinto efectivamente reporte** — si no, OQ-2 es inmedible y el fix se prioriza sin dato.

---

## Recomendaciones sobre las Open Questions

- **OQ-1 (¿`completed` debería avanzar al próximo ejercicio?)** — **No.** Abrir la senda es lo
  correcto *y* lo que hace legible el Sprint 2: el jugador tiene que **ver el mapa** para
  entender que terminó, no ser teletransportado a otra cosa. Avanzar automático reintroduce,
  en versión amable, el mismo problema: la pantalla decide por él y el progreso sigue
  invisible.
- **OQ-2** — bloquear la priorización en un dato que quizá no exista es peor que asumir. Es
  **P1 con cara de P0**: dos cuentas confirmadas, síntoma "no me guarda el progreso" (el peor
  de los síntomas posibles), y el Sprint 2 lo amplifica. Arreglarlo ya, medirlo después si el
  dato aparece.

---

## Qué cambiar antes de `/tdd`

1. Reescribir **AC-1** con un observable de modo-laberinto, no el título. (B1)
2. Agregar la **invariante de precedencia** `pending > locked/missing > completed > start`. (B2)
3. Mover la acción nueva al **componente**; corregir el nombre del tipo. (B3)
4. Reescribir o borrar **AC-5**. (A4)
5. Decidir el destino de `restorableContentId`. (A5)
6. Reemplazar **AC-6** por el caso completado-y-gateado. (A6)
7. Una línea sobre `automatic`; una línea sobre "cualquier llegada, no el óptimo". (M7, M8)
8. Decidir explícitamente que el puntero **no** se limpia. (M9)
