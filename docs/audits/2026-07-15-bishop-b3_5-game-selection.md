# Bishop B3.5 — Selección del juego lúdico del alfil (read-only)

**Fecha:** 2026-07-15 · **Branch:** `fix/exercise-obstacles-a0`
**Entradas:** B0, B1, B2, B3 del alfil.
**Alcance:** solo comparación y recomendación. No se editó código, contenido, FEN, tests ni Supabase.

> **Nota global.** La meta de esta pasada es llevar **todas** las piezas a un **piso funcional común**:
> cada pieza con un juego lúdico propio, simple y entretenido, de **2 a 4 niveles**. NO convertir el
> alfil en una vertical profunda mientras peón, caballo, dama y rey siguen incompletos. Por eso el peso
> de decisión está en **identidad + implementación pequeña**, no en igualar los 4 niveles de Rook Rails.

---

## 0. Capacidades del motor hoy (restricción dura)

| Capacidad | Estado | Fuente |
|---|---|---|
| Objetivo único `targetPos` | ✅ | `types.ts:36` |
| Obstáculos amigos no capturables | ✅ | `types.ts:80`, B2 |
| **Multi-target / checkpoints secuenciales** | ❌ **no existe** | `Exercise` no tiene lista de metas ordenadas; `captureTargets` es solo del peón |
| BFS runtime + **primer movimiento óptimo** (`firstStep`) | ✅ | `exercise-bfs.ts:37` |
| Progreso id-keyed (index-independiente) | ✅ | B2 |

**Consecuencia:** cualquier mecánica que exija visitar una **secuencia de puntos** (Same Color Trail,
Diagonal Relay) requiere una capacidad nueva de multi-target → cara para esta fase. Cualquier mecánica
de **elegir-antes-de-ejecutar** (Pivot Challenge, Spot the Route) se apoya en `firstStep`/enumeración
BFS ya existentes → barata (solo UI).

---

## 1. Matriz comparativa de opciones

| Criterio | 1. Diagonal Paths / Maze | 2. **Pivot Challenge** | 3. Same Color Trail | 4. Diagonal Relay | 5. Spot the Route |
|---|---|---|---|---|---|
| Principio del alfil | rodear diagonal bloqueada | **pivote: cambiar de diagonal** (define al alfil) | conserva el color | encadenar pivotes | comparar/elegir ruta |
| Interacción principal | mover pieza al target esquivando muros | **elegir la casilla de pivote, luego ejecutar** | conectar casillas del mismo color | tocar 2–3 puntos en orden | elegir ruta A/B, luego ejecutar |
| Diversión esperada | media (≈ ejercicio largo) | **media-alta** (beat "decide y ejecuta") | media | media-alta | media (riesgo de "quiz") |
| Claridad para principiante | media | **alta** ("¿dónde giro?") | media (color no es obvio) | media | alta |
| Reutiliza motor actual | **total** (es el formato labyrinth) | **alta** (board + BFS `firstStep`) | baja | baja | alta (board + rutas BFS) |
| Reutiliza lab-3 / lab-4 | lab-3 sí, lab-4 no | **lab-3 sí** (como posición); las posiciones pivote bishop-4/5/6/7 sirven de plantilla | no directamente | lab-3 parcial | lab-3 sí |
| Nuevas capacidades | ninguna | **capa UI de pre-selección** (sin motor nuevo) | **multi-target/checkpoints** | **multi-target secuencial** | capa UI de elección |
| Riesgo técnico | bajo | **bajo** | alto | alto | bajo-medio |
| Riesgo de "otro ejercicio" | **alto** (B3: parece ejercicio con blockers) | **bajo** (interacción distinta) | medio | bajo | medio (se siente examen) |
| ¿2–4 niveles diferenciados? | sí (pero 2 tableros nuevos) | **sí** (1 pivote → 2 pivotes → pivote bloqueado) | sí, si hay multi-target | sí, si hay multi-target | sí |
| Esfuerzo | **MEDIUM** (2 tableros nuevos) | **LOW–MEDIUM** (solo UI) | **HIGH** | **HIGH** | **MEDIUM** |

---

## 2. Lectura por opción

- **1 · Diagonal Paths / Maze.** Reutiliza todo el motor y lab-3, pero B3 ya mostró el problema: sin
  target de color opuesto ni multi-target, un "laberinto" del alfil colapsa a *un ejercicio largo con
  blockers*. lab-4 duplica bishop-10. Completar 3 niveles pide **2 tableros nuevos** sin ganar identidad.
  Es el que **menos identidad propia** aporta.
- **2 · Pivot Challenge.** El pivote es *la* habilidad que distingue al alfil. El motor ya calcula el
  primer movimiento óptimo (`firstStep`), así que "elegir el pivote correcto" = validar la casilla de
  giro contra el BFS — **cero motor nuevo, solo una capa de UI de pre-selección**. Las posiciones de los
  ejercicios de pivote (bishop-4/5/6/7) sirven directamente como plantillas de nivel, reencuadradas como
  juego (no como ejercicio). Identidad alta, implementación chica, reutiliza activos.
- **3 · Same Color Trail.** Es la única que ataca el vacío G1 (color), pero **exige multi-target/
  checkpoints inexistentes** → abre vertical. Demasiado cara para un piso funcional. Guardar como idea futura.
- **4 · Diagonal Relay.** Depende de multi-target secuencial (mismo bloqueo que la 3). HIGH effort. Fuera.
- **5 · Spot the Route.** Barata y reutiliza rutas BFS, pero "elegir A/B" se siente **examen**, no juego;
  identidad más débil que ejecutar el pivote uno mismo. Es un subconjunto pobre de Pivot Challenge.

---

## 3. RECOMENDACIÓN

### 🟢 Juego principal: **Pivot Challenge** — veredicto **HYBRID WITH EXISTING ASSETS**

Un juego **distinto** al laberinto, construido **sobre los activos actuales** (board + `getBishopMoves`
+ `computeExerciseBfs.firstStep` + render de obstáculos), sin capacidades de motor nuevas.

### Por qué gana (en el orden de criterios pedido)

1. **Identidad del alfil** — el pivote es su rasgo definitorio; ninguna otra pieza pivotea así. La 1 y la
   5 no tienen identidad propia; la 3 y la 4 sí, pero son caras.
2. **Claridad pedagógica** — "¿en qué casilla giro?" es una pregunta única, sin jerga, para principiantes.
3. **Entretenimiento** — el beat "decido el giro → lo ejecuto" es más lúdico que repetir mover-al-target.
4. **Implementación pequeña** — solo UI de pre-selección; **no** toca el motor ni añade multi-target
   (lo que descarta 3 y 4 en esta fase).
5. **Reutilización** — usa el board, el BFS y las posiciones pivote existentes; puede reusar lab-3.
6. **Cierra la pieza sin profundizar** — 3 niveles bastan; no abre vertical.

### Niveles propuestos (3 — no se fuerza un 4º)

| Nivel | Nombre provisional | Principio | Decisión | Base reutilizable |
|---|---|---|---|---|
| L1 | **The turn** | un pivote, sin obstáculos: elegir la casilla de giro | 1 pivote correcto | geometría tipo bishop-4 |
| L2 | **Two ways to turn** | dos pivotes válidos: elegir cualquiera / el que sirve | 2 pivotes | geometría tipo bishop-5 |
| L3 | **The blocked turn** | el pivote obvio está bloqueado: elegir el otro | pivote bajo restricción | geometría tipo bishop-6 / bishop-7 (y/o lab-3) |

Opcional L4 (*Two turns* — planificar dos pivotes) solo si se quiere; **3 niveles cierran la pieza**.

### Activos existentes que se reutilizan

- `components/board.tsx` (render + hit-grid) y `getValidTargets`/`getBishopMoves`.
- `exercise-bfs.ts` (`firstStep` valida el pivote elegido; enumeración de rutas para 2-pivotes).
- Render de obstáculos amigos (L3) — ya cubierto por `exercise-obstacles.test.tsx`.
- **bishop-lab-3** como posición candidata (L3). Progreso id-keyed sin cambios de esquema.

---

## 4. Qué queda de B3 (vigente vs descartado)

**Vigente:**
- La instrumentación BFS y el método necesario/decorativo.
- Hechos: **lab-4 duplica bishop-10** (→ se retira igual), **lab-3 es un activo reutilizable**.
- Restricción de color: **nunca** un target de color opuesto (insoluble).

**Descartado (superado por B3.5):**
- La **progresión de 3 niveles como LABERINTO** (L1 Around the wall / L2 Fork / L3 Plan the long way).
- La recomendación de **crear 2 tableros de laberinto nuevos**. Ya no se construye un maze.

---

## 5. Límites y próximos pasos

- **No** se diseñan FEN aquí. **No** se implementa. **No** se autoriza B4.
- Same Color Trail (vacío G1) queda como **idea futura** cuando exista multi-target — no en esta fase.
- Si producto prefiere igualar el formato de la torre por consistencia de portfolio, el veredicto pasa a
  **NEEDS PRODUCT DECISION**; con los criterios dados, la evidencia favorece **HYBRID / Pivot Challenge**.

**Fin de B3.5. Sin implementar. B4 no autorizado.**
