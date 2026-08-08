# Handoff — el fix del restore cerró, y el Sprint 2 cambió de dirección

**Fecha:** 2026-08-08 · **Rama:** `main` local, **ahead 19 de `origin/main`** (sin pushear)
**Handoff previo:** `2026-08-07-cta-slot-and-restore-bug-handoff.md`

> La sesión tuvo **dos mitades**: cerrar el bug del restore (código, verificado en device) y
> **revertir la dirección del Sprint 2** tras consultar al Game Designer de BMAD/GDS. La
> segunda mitad no dejó código — dejó un brief aprobado, un spec y su red team.

---

## Estado

| | |
|---|---|
| Suite web | **7517 passing / 611 files, EXIT=0** |
| VR | **minipay 63/63** con `--update-snapshots=none`, árbol limpio |
| `tsc --noEmit` | limpio |
| Árbol | limpio |
| Device | ✅ verificado por el founder |

⚠️ El baseline pasó de **610 → 611 archivos**: `restore-completed-content.test.tsx` estaba
entero en `it.skip`, así que no contaba como *passed*. Ahora corre. **611 es el número nuevo.**

---

## Lo que cerró

**Bug de prod del restore.** Terminar el último laberinto de una pieza y volver a tocarla
reabría el mismo laberinto, indefinidamente. Se leía como "mi progreso no se guarda". No era
guardado: el restore reabría el último contenido jugado sin preguntar si estaba terminado.

Tres commits: `2b81415` (red team + spec READY), `69ab885` (el fix), `5ccd1e6` (checklist QA).

### La regla que quedó — tres casos

Al entrar a una pieza, todo depende de **a qué apunta `training-content:<pieza>`**:

| El puntero apunta a… | Aterriza en |
|---|---|
| nada | tablero de ejercicios (entrada normal, el fix no participa) |
| un desafío **sin terminar** | ese desafío, para retomarlo |
| un desafío **terminado** | **el PATH** ← lo que arregla el fix |

Verificado en device en los tres casos, incluido el borde "terminado pero pésimo" (best 99):
también manda al PATH, porque la regla es `best !== null`, **no** 3★.

### Dónde vive

`exercises-screen.tsx`, en el branch que ya resolvía `locked` sobre `trainingPathRef`. **El
filtro va en el RESULTADO de `requestTrainingContent`, nunca antes de la llamada** — ese efecto
también asienta la hidratación inicial, y saltearse la llamada deja un laberinto gateado por
pass sin renderizar su nodo bloqueado. Esa regresión ya ocurrió una vez y está mutación-probada.

`TrainingContentSettlement` quedó **separado** de `TrainingContentRequestResult`: meter
`completed` en la unión del resolver puro obligaba a cada llamador a estrechar contra una
acción que ese resolver nunca devuelve. Lo dijo `tsc`, no yo.

`lib/training/restore-content.ts` **borrado** — cero callers, y su semántica (devolver `null`
para saltear la llamada) era exactamente la que causó la regresión.

---

## ⛔ Dos cosas que el red team creyó cubiertas y NO lo están

Ambas confirmadas **por mutación**, no por lectura:

1. **La precedencia `locked > completed` no tiene consecuencia observable hoy.** En un restore
   las dos acciones asientan idénticamente (las dos corren `settleToPath`), y el CTA de unlock
   **no pasa por `requestTrainingContent`**: el drawer deriva el candado de `labyrinthAccess` y
   rutea el checkout por su cuenta (`exercise-drawer.tsx:399-405`). Izar el chequeo por encima
   de `locked` deja **todos** los tests verdes. Quedó documentada en el tipo y en la posición
   del branch, **sin** un test verde que finja cubrirla.
2. **El `openCheckout: true` a nivel request es inalcanzable desde un nodo gateado**, por lo
   mismo. Si alguna vez se quiere que el request rutee comercio, hay que cambiar el drawer.

⚠️ El primer observable que elegí para el test (`0 / N moves`) hacía **pasar el test de
entrada**: en modo laberinto la banda cambia ese chip por el título
(`mission-panel-candy.tsx:496-498`). El observable bueno es el testid `mission-optimal-moves`.

---

## Pendiente del founder

1. ▶️ **Push de `main`** — 16 commits locales.
2. ▶️ Mirar el banner de acción del CTA en device (390px, dos líneas) — sigue medido, no visto.
3. Al cerrar el sprint: **re-medir los pases activos** (13 al 2026-08-07).

---

## ▶️ Siguiente: hacer visible el progreso — ⛔ NO desenterrar el Path

⛔ **REVERTIDO el mismo día.** La dirección "desenterrar el Path" (handoff del 2026-08-07) quedó
**degradada a Paso 3, condicional**. Brief aprobado:
`docs/product/2026-08-08-progress-visibility-design-brief.md`.

**Por qué:** el objetivo nunca fue el mapa, era que **el progreso se vea**. El mapa era un
vehículo. Chesscito tiene 78 niveles y sesiones de ~2 min: no tiene un problema de columna
vertebral (que es para lo que sirven los mapas de Candy Crush / Mario World), tiene un
**problema de aviso**. El progreso va donde el jugador ya está.

1. **Paso 1** — la consecuencia en el **overlay de completado** ("3 de 4 · uno más abre la
   insignia"). Cero taps, cero pantallas nuevas, en el momento de máxima atención.
2. **Paso 2** — progreso fino en la **baldosa del hub** (hoy sólo cuatro estados). Cubre al que
   vuelve a los tres días.
3. **Paso 3** — promover el mapa, **sólo si 1 y 2 no alcanzan**.

El fix del restore sigue siendo prerrequisito: sin él, cualquier anuncio de progreso convivía
con una pantalla que reabría lo ya terminado.

### Lo que el Sprint 2 va a encontrar (medido, del handoff previo)

- `exercise-drawer.tsx` ya es un componente propio de **650 líneas**. El monstruo es
  `exercises-screen.tsx` con **4.469**, pero ese es problema de *armado de datos*, no de UI.
- ⛔ `buildTrainingPath` deja todos los nodos de desafío en `locked` **sin error** si se omite
  `labyrinthBests`. Con el Path como hogar de la progresión, **el mapa mentiría sobre qué está
  desbloqueado**. Pide guard.
- Seis iconos firma = seis slots de tema = **tres baselines pineados + `tsc`** cada uno.

---

## 🎲 La segunda mitad — cómo cambió la dirección

Se consultó al **Game Designer de BMAD/GDS** (Samus Shepard) por una decisión de producto:
¿el PATH debe ser siempre la puerta de entrada a la pieza? Recomendó **sí, siempre**.

**El founder la falsificó con una frase**, y tenía razón:

> *"Si pudiera mostrar el progreso sin el tap del mapa, para mí sería el éxito."*

El objetivo nunca fue el mapa: era **que el progreso se vea**. El mapa era el vehículo. De ahí
salió el brief aprobado (`docs/product/2026-08-08-progress-visibility-design-brief.md`) y los
tres pasos, con el mapa degradado a Paso 3 condicional.

⚠️ **Aprendizaje que conviene no perder:** los mapas de Candy Crush / Mario World existen porque
esos juegos tienen **cientos de niveles** y necesitan una columna vertebral. Chesscito tiene 78
niveles y sesiones de ~2 min: **no tiene un problema de columna vertebral, tiene un problema de
aviso.** Copiar la función, nunca la forma.

### Estado del Paso 1

| Artefacto | Estado |
|---|---|
| Brief | ✅ aprobado (`e146c45`) |
| Spec | ✅ escrito (`708f096`) — ⛔ **NO listo para `/tdd`** |
| Red team | ✅ hecho (`e7977f0`) — **3 bloqueantes + 5 hallazgos** |
| Correcciones | ⏳ **pendientes — es el arranque de la próxima sesión** |

⛔ **El bloqueante que manda (B1):** la firma `resolveConsequence(path)` no sirve. Un snapshot
dice **estado**, no **transición**, y tres de los cuatro peldaños son transiciones — el jugador
vería *"¡tu insignia está lista!"* en cada overlay hasta reclamarla. Tiene que recibir
`before`/`after`. **El `before` ya existe** en la pantalla (el path pre-completación que
documenta el comentario de QA G1, `exercises-screen.tsx:3158-3161`); no hace falta estado nuevo.

---

## ▶️ Cómo arrancar la próxima sesión

**Prompt sugerido:**

> Retomamos el Paso 1 del brief de visibilidad de progreso. Está todo en
> `docs/specs/2026-08-08-consequence-in-completion-overlay.md` y su red team
> `-redteam.md`, con 3 bloqueantes y 8 correcciones pedidas.
>
> Antes de tocar el spec: **dos de las correcciones son decisiones de diseño, no técnicas**
> (A5: qué peldaños corresponden a cada slice, porque `lane_progress` no significa lo mismo en
> desafíos que en ejercicios; y M8: OQ-1 pide reclamar la insignia desde el overlay mientras
> AC-6 congela los botones). **Consultalas con el Game Designer de BMAD/GDS** antes de escribir
> nada. También OQ-3 (qué cuenta `lane_progress`).
>
> Después: aplicá las 8 correcciones, marcá el spec READY y arrancá `/tdd` por el slice 1A (el
> resolver puro, sin UI).

**Agente BMAD a usar:** `gds-agent-game-designer` (Samus Shepard) — es diseño de progresión y
legibilidad, su terreno. ⚠️ **No** para las correcciones técnicas (B1, B2, B3, A4): esas salen
del red team y del código, y ya están resueltas en el doc.

> 📌 **Práctica adoptada el 2026-08-08:** toda feature/fix con decisión de diseño detrás se
> contrasta primero con el agente BMAD/GDS especializado, y se vuelve con una **recomendación
> fuerte**, no con un menú. Decidir a dedo ya costó tiempo. Ruteo: progresión → Game Designer ·
> flujo/fricción → UX (Sally) · alcance → PM (John) · estructura técnica → Game Architect.

---

## Open questions

- **⭐ NUEVA — ¿el PATH debería ser SIEMPRE la puerta de entrada?** Salió del QA en device: al
  founder le gustó que el PATH "no lo dejara equivocarse". Hoy el caso 2 (retomar algo a
  medias) **se saltea el PATH** a propósito. Si el Path es el hogar de la progresión, quizá
  deba verse siempre y el "retomar" ser un nodo destacado dentro de él. **Decide una parte del
  Sprint 2 — resolver antes de diseñar la pantalla.**
- **OQ-2 del spec (sin cerrar):** cuántos jugadores están hoy en el estado del bug. Los bests
  **no salen del device**; la única vía sería `score_attempts` vía `reportAttempt`, y falta
  verificar que los laberintos efectivamente reporten intento.
- **Estrellas del carril**: sigue sin decidirse. Destraba el Sprint 4. Knight's Tour **no
  puntúa**, así que el hueco empieza dentro del carril.
- **`Special Training` visible en seis lugares** — adoptar otro nombre obliga a renombrarlos.
- **El spotlight del mini-tour** puede iluminar la banda de aviso. Preexistente.
