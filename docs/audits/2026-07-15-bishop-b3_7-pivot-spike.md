# Bishop B3.7 — One-level Pivot Challenge spike (implementado, sin commit)

**Fecha:** 2026-07-15 · **Branch:** `fix/exercise-obstacles-a0`
**Base:** bishop-4 · start a1 · target g1 · pivote d4 · optimalMoves 2.
**Estado:** implementado como probe `/dev`, **sin commit**. No toca ExercisesScreen, contenido, ni labs.

---

## 1. Qué se construyó (scope real)

| Pieza | Archivo | Rol |
|---|---|---|
| Helper puro | `src/lib/game/pivot-challenge.ts` | `isConnectingPivot(start,target,candidate,blockers)` — deriva el pivote en runtime vía `getBishopMoves` |
| Unit test | `src/lib/game/__tests__/pivot-challenge.test.ts` | 8 casos (acepta d4, rechaza no-conector/no-alcanzable/colineal, respeta blockers en ambas piernas, acepta 2 pivotes) |
| Componente spike | `src/components/dev/pivot-challenge-spike.tsx` | grid 8×8 self-contained, 1 tap → validar → animar a1→d4→g1 → completar; copy EN/ES; ledger |
| Probe page | `src/app/dev/pivot-spike/page.tsx` | `/dev/pivot-spike`, `notFound()` en producción (patrón dev existente) |
| E2E | `e2e/pivot-spike.spec.ts` | 3 casos |

Reutilizado sin cambios: `getBishopMoves`, `recordLabyrinthBest` (ledger), `haptic*`, `FILES/RANKS`.
**No** se reutilizó la interacción de `<Board>`: su tap-mueve-por-el-rayo es justo lo que había que evitar.

## 2. Resultados de validación (comandos corridos)

- **Unit:** `vitest run pivot-challenge.test.ts` → **8/8 passed**.
- **E2E:** `playwright test e2e/pivot-spike.spec.ts --project=minipay` → **3/3 passed** (tap incorrecto no completa · tap d4 completa · ruta observada `a1,d4,g1` · nivel renderiza 1 sola vez).
- **TypeScript:** `tsc --noEmit` → sin errores de pivot.
- **`git diff --check`** → exit 0.

---

## 3. Validación de producto (obligatoria)

**¿Se distingue perceptiblemente de un ejercicio normal?**
**Sí, por la interacción** — es un único tap de decisión ("¿cuál es la casilla conector?") con auto-ejecución
de la ruta como recompensa; no hay seleccionar-pieza, no hay seguir el rayo, no hay HUD de movimientos.
**Matiz honesto:** la *posición* es idéntica a la del ejercicio bishop-4, así que la diferenciación vive
100% en la interacción, no en el tablero. En una posición ya familiar, el margen es real pero fino.

**¿Qué produce la sensación lúdica?**
El beat "comprometo una casilla → veo la ruta ejecutarse sola" (animación a1→d4→g1). El framing de "encontrar
la conexión" convierte una tarea de movimiento en una **decisión espacial única**.

**¿El loop de 1 tap es demasiado trivial?**
En **este** nivel, **sí, es fronterizo-trivial**: bishop-4 tiene **un solo** conector (d4) y es el punto
medio geométrico, adivinable. La tensión de decisión **no** vive en L1; vive en L2 (dos pivotes: elegir) y
L3 (pivote bloqueado: descartar el obvio). El spike prueba que la mecánica es distinta y barata, pero su
**valor como juego depende de las variantes**.

**Esfuerzo real final:** **LOW.** Helper + 1 componente + 1 probe + tests. Cero cambios de motor/pantalla.

**¿Kill criterion activado?** **Ninguno.** No requirió multi-target, ni motor nuevo, ni refactor general,
ni framework, ni superó MEDIUM, y **sí** se distingue de un ejercicio (interacción distinta).

---

## 4. VEREDICTO: **GRADUATE TO 3 LEVELS**

La mecánica es distinta, barata y con identidad ("la casilla-conector"). El único reparo —trivialidad— es
**propio de L1 aislado**, no de la mecánica: L2 (bishop-5, dos pivotes) y L3 (una posición opt-2 nueva con
un pivote bloqueado) aportan la tensión de decisión que justifica el juego.

**Condiciones para la graduación (no ejecutadas aún, requieren autorización de B4):**
1. Promover de Opción D (UI-only) a **Opción C**: un `kind:"pivot"` mínimo en el contenido de Special
   Training + entrada real de navegación (hoy el spike vive solo en `/dev`).
2. L3 necesita **una** posición `opt=2` nueva (pivote obvio bloqueado, alternativo libre) — diseño + BFS.
3. Copy EN/ES a i18n de producción (hoy es local del probe).
4. Retirar bishop-lab-3 / bishop-lab-4 según B3 (decisión de IDs/progreso en implementación).
5. Mantener L1 como **intro suave** declarada; no venderlo como el reto.

**Sin commit. B4 no autorizado.** Fin de B3.7.
