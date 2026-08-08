# Handoff — el Paso 1 cerró: la consecuencia vive en los dos overlays

**Fecha:** 2026-08-08 · **Rama:** `main` (local, **sin push** — lo hace el founder)
**Base:** `c2e64ab8` → **HEAD `b3e7ccf2`** · 8 commits

---

## Qué se cerró

El **Paso 1** del brief de visibilidad de progreso, entero: los tres slices.
El overlay de completado ahora entrega, además del **momento** ("lo lograste, 3 estrellas"),
la **consecuencia**: qué cambió en la pieza por haber hecho esto. Cero taps, cero pantallas
nuevas.

| Slice | Qué | Dónde |
|---|---|---|
| **1A** | El resolver puro, 12 tests | `lib/training/consequence.ts` |
| **1B** | La línea en el overlay de desafío + baseline | `labyrinth-complete-overlay.tsx` |
| **1C** | La línea en el flash de ejercicio + 2 baselines | `PhaseFlash` en `mission-panel-candy.tsx` |

**Verificación final** (todo re-corrido sobre el HEAD):
- Unit: **612 archivos / 7542 tests passing**, `exit 0`, **cero `Unhandled Errors`**.
- VR: **178 passed / 14 skipped / 0 failed** con `--project=minipay --update-snapshots=none`
  (no puede grabar, así que el verde comparó de verdad), `exit 0`.
- `tsc --noEmit` limpio.
- ⚠️ Los tres PNG nuevos **abiertos a mano**. Ver "el bug que casi pasa" abajo.

---

## Las tres decisiones de diseño (Samus Shepard / BMAD-GDS)

Doc: `docs/product/2026-08-08-consequence-design-decisions.md`

1. **A5 — el piso lo elige el CARRIL, no el slice.** Un resolver, cinco peldaños; el `kind`
   del nodo que transicionó elige el piso. **El denominador del ejercicio es el gate (8), no
   el pool (10)**: quien está en 7 y lee "7 de 10" cree que le faltan tres cuando le falta una.
2. **OQ-3 — `lane_progress` cuenta UN carril, el jugado.** Mezclarlos junta cuatro reglas de
   puntuación en un número que el jugador no puede reconciliar contra nada visible.
3. **M8/OQ-1 — NO hay claim en el overlay.** Reclamar es una transacción on-chain; si falla,
   la celebración **es** el error. La acción se reasigna al Paso 2.

---

## Los cuatro hallazgos que valen más que el código

### 1. ⛔ El AC-5 original era inimplementable, y su premisa falsa

Pedía detectar "todos los nodos en `locked`", que es un estado **imposible** (`path.ts:130`:
un ejercicio nunca es `locked`) e **indistinguible** de un jugador temprano legítimo. Un `/tdd`
obediente habría escrito un test verde que no cubre nada.

Reemplazado por el **guard de snapshot rancio**: un intento completa exactamente **un** nodo
jugable; cero (rejugar) o dos o más (`before` sin hidratar, catálogo distinto) → `null`.

### 2. ⛔ La baldosa del hub NO reclama

Tocar una baldosa `claimable` sólo hace `router.push('/exercises?piece=…')`
(`learn-hub-client.tsx:415-426`). El único botón **Claim Badge** vive en el drawer de
Exercises (`exercise-drawer.tsx:620-637`), **en la pantalla donde el jugador ya está**.

El copy decía "claim it from the hub" y mandaba de viaje redondo al lugar del que salió.
➡️ **El Paso 2 hereda trabajo que no estaba contado**: para que la baldosa ofrezca la acción,
primero hay que ponérsela.

### 3. ⛔ El bug que casi pasa: una baseline verde de la pantalla EQUIVOCADA

`page.tsx` de `/dev/exercises-popups` tenía una **segunda allowlist** de variants que no
acompañaba a la unión del fixture, y el render casteaba `as never` — así que TypeScript
callaba. El variant nuevo cayó al default y la primera baseline fotografió
**`PieceCompletePrompt`** en verde, bajo el nombre del test nuevo.

**Se detectó sólo al abrir el PNG.** La allowlist ahora está tipada con la unión del fixture:
olvidarse de una es error de compilación. El fixture nuevo de 1C nace ya con esa forma.

> Regla que deja: **una baseline nueva no se cree hasta abrirla**. El verde de una grabación
> no prueba que fotografió lo que decís que fotografió.

### 4. ⛔ El spec mandaba 1C al archivo equivocado

Decía `result-overlay.tsx` ("31,8 KB, el grande"). Ese archivo maneja resultados de
**transacción** (`badge` / `score` / `shop` / `error`). Completar un ejercicio no abre ningún
overlay: pone `phase === "success"`, y eso lo pinta **`PhaseFlash`**.

Cablearlo donde decía el spec habría puesto la consecuencia en una pantalla que el jugador ve
**después de firmar**, no al resolver.

---

## Lo que queda vivo, en orden de valor

### 1. ⭐ OQ-2 sigue abierta en su punto más delicado — y sólo la cierra un playtest

`badge_ready` dice *"Badge unlocked · claim it in Exercises"* **sin botón**. Ninguna suite
puede validar eso. Es la pregunta del brief, y la prueba es una sola:

> A alguien que acaba de cruzar el gate, **antes de que toque nada**: *"¿qué hacés ahora?"*

Si no sabe adónde ir, el cartel no alcanza → **se reabre M8** y la acción vuelve a discusión.

### 2. El Paso 2 arranca con deuda descubierta

La baldosa del hub necesita **tener** la acción antes de poder ofrecerla (hallazgo #2).
Y ahí también vive el mini-tour del wayfinding.

### 3. El CTA diferido ya existe — falta portarlo

`PhaseFlash` ya arma el tap **550 ms después** del reveal (`awaitTap` + `tapArmed`,
founder 2026-07-17) y retiene 600 ms de `entryBeat`. **El overlay de laberinto no tiene
ninguna de las dos.** No hay que inventar nada: hay que portar el patrón.
Backlog: `docs/backlog/2026-08-08-overlay-juice-and-claim-wayfinding.md`.

---

## Open questions

- **¿El icono?** Quedó **sin icono** a propósito. El vocabulario del overlay ya está tomado
  (estrella = estrellas, trofeo = mejor marca, sprite = movidas) y el único que orientaría
  bien —la estrella, porque es el glifo del abridor real del drawer— es justo el que se
  confunde. El founder quiere **un icono nuevo**; la recomendación es que el wayfinding sea
  **mini-tour, no icono**, y que vaya en el Paso 2.
- **¿Se anuncia demasiado poco?** Con transiciones, `null` es frecuente **a propósito**. Si la
  telemetría (`consequence_shown`, por `kind`) muestra que casi no se emite, la escalera está
  bien pero el contenido no da ocasiones — y eso es un dato del Paso 2, no un bug del 1.
- **¿`lane_progress` con `done === total` es el peldaño correcto?** Hoy se dice con
  `laneComplete`. Si el jugador ya reclamó la insignia, ese caso lo tapa `mastery`; si no, la
  línea lo manda a reclamar. Falta ver si se lee como logro o como tarea.

---

## Estado del árbol

- `main` local, **8 commits sin pushear**. El push lo hace el founder.
- ⚠️ `apps/web/rook-rails-shots/` quedó sin trackear y **no es de esta sesión** (capturas de
  tablero de un trabajo anterior). No se tocó.
- ⛔ **No se verificó ningún deploy** — es tarea del founder por regla vigente.
