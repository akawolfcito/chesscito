# Bishop B1 — Auditoría pedagógica (read-only)

**Fecha:** 2026-07-15 · **Branch:** `fix/exercise-obstacles-a0`
**Entrada:** `docs/audits/2026-07-15-bishop-b0-inventory.md`
**Alcance:** solo análisis. No se editó código ni contenido. Sin captura, sin FEN nuevos, sin laberintos.
**Baseline de calidad:** `docs/audits/2026-07-13-rook-curriculum-audit.md`.

Notación: file 0–7 = a–h, rank 0–7 = 1–8. Color = `(file+rank)` par → oscura, impar → clara.
a1 = oscura. "Rayos disponibles" = cuántas diagonales legales nacen de la casilla de salida
(esquina = 1, borde = 2, centro = 4). Ese número, no el FEN, define el perfil de decisión.

---

## A. HECHOS OBSERVADOS (por ejercicio)

Verificado contra `puzzles.generated.ts` (BFS `optimalMoves`).

| id | mover→target | color | rayos salida | opt | blockers (amigos N) | ¿pivot? | ¿planifica? |
|----|--------------|-------|--------------|-----|---------------------|---------|-------------|
| bishop-1 | a1→h8 | oscura | 1 (forzado NE) | 1 | — | no | no |
| bishop-2 | h1→a8 | clara | 1 (forzado NW) | 1 | — | no | no |
| bishop-3 | d4→g7 | oscura | 4 (elige) | 1 | — | no | no |
| bishop-4 | a1→g1 | oscura | 1 (forzado) | 2 | — | sí (1 ruta: pivot d4) | leve |
| bishop-5 | c3→g3 | oscura | 4 | 2 | — | sí (2 rutas: e5 ó e1) | sí (elige pivot) |
| bishop-6 | b2→f2 | oscura | 4 | 3 | d4 | sí, pivot único bloqueado | sí |
| bishop-7 | c3→g3 | oscura | 4 | 3 | e5, e1 | sí, **ambos** pivots bloqueados | sí |
| bishop-8 | a1→g7 | oscura | 1 | 4 | d4 (sobre la diagonal) | rodeo | sí (4 legs) |
| bishop-9 | a1→g7 | oscura | 1 | 4 | d4, f6 (sobre la diagonal) | rodeo | sí (4 legs) |
| bishop-10 | a1→h8 | oscura | 1 | 5 | e5 (sobre la diagonal) | rodeo | sí (5 legs) |

**Hechos duros verificados:**

- **Todos los targets conservan color** (obligatorio: un target de color opuesto sería inalcanzable).
  Ningún ejercicio hace que el alumno *confronte* esa regla — se cumple, no se enseña.
- **bishop-7 = bishop-5 + ambos pivots bloqueados.** Los blockers de bishop-7 (`e5`, `e1`) son
  exactamente las dos casillas de pivote de bishop-5. Escalada deliberada. ✔ confirmado.
- **bishop-6 = pivot único bloqueado.** b2→f2 solo pivota por d4 (el pivote "abajo" cae fuera del
  tablero); d4 está bloqueado → detour de 3.
- **bishop-8 / bishop-9 / bishop-10** comparten mover `a1` y el patrón "blocker(s) SOBRE la diagonal
  larga → rodear". bishop-9 añade un 2º blocker (`f6`) que **no cambia** `optimalMoves` (sigue 4).
- **bishop-9 título editorial = "Capture detour"** pero el blocker es amigo **no capturable**
  (tag `friendly-blocker`). El wording contradice la fase "sin captura".
- Ocho de diez ejercicios tienen `title/principle/learningObjective` en `null` en el JSON
  (la torre los tiene poblados).

---

## B. INTERPRETACIÓN PEDAGÓGICA (principio real que enseña el tablero)

| id | título actual | **principio real** | error conceptual que previene |
|----|---------------|--------------------|-------------------------------|
| bishop-1 | Main diagonal | El alfil se mueve en diagonal (rayo largo NE, casilla oscura) | "no sé cómo se mueve el alfil" |
| bishop-2 | Anti diagonal | La **otra** orientación diagonal (NW) + alfil de casilla **clara** | "el alfil solo va en un sentido / solo vive en oscuras" |
| bishop-3 | Short diagonal | Distancia **corta** + **elegir** rayo desde el centro (4 opciones) | "todo movimiento cruza el tablero" / "no hay que elegir dirección" |
| bishop-4 | Two-move path | **El alfil no es una torre**: no llega recto por la fila → pivot forzado | "puedo ir de a1 a g1 en línea recta" |
| bishop-5 | Tricky route | **Elegir** el pivote entre dos rutas válidas (arriba/abajo) | "solo hay una forma de pivotar" |
| bishop-6 | Blocked pivot | El pivote natural está **bloqueado por pieza propia** → rodear | "si mi ruta está tapada, no hay camino" |
| bishop-7 | Twin pivot block | **Ambos** pivotes bloqueados → hallar la tercera ruta | "basta evitar un obstáculo" |
| bishop-8 | Diagonal detour | Blocker **sobre la diagonal larga** → salir y reincorporarse | "mi propia pieza en la diagonal no me frena" |
| bishop-9 | Capture detour | (≈ bishop-8 con 2 blockers; opt idéntico) | — (no añade decisión) |
| bishop-10 | Long diagonal wall | Rodeo más largo (opt 5) sobre la diagonal larga | "el rodeo largo no requiere planificar toda la ruta" |

---

## C. MAPA DE COBERTURA DE PRINCIPIOS

| Principio requerido | ¿Cubierto? | Dónde |
|---------------------|-----------|-------|
| Movimiento diagonal | ✅ | bishop-1 |
| Ambas orientaciones (NE + NW) | ✅ | bishop-1 (NE) + bishop-2 (NW) |
| Distancia corta y larga | ✅ | larga: 1,2 · corta: 3 |
| El alfil no va en fila/columna | 🟡 parcial | bishop-4 (mezclado con pivot; sin ejercicio *limpio* dedicado, la torre sí lo tiene) |
| Pieza propia bloquea el camino | ✅ (sobre-cubierto) | bishop-6,7,8,9,10 |
| Pivot a casilla fuera de la diagonal | ✅ | bishop-4 (forzado) + bishop-5 (elección) |
| Planificar la ruta completa | ✅ | bishop-7,8,10 |
| **El alfil siempre conserva el color** | ❌ **NO enseñado** | ninguno lo confronta (se cumple implícitamente) |
| Sin captura en esta fase | ✅ (con defecto verbal) | todos los blockers son amigos; bishop-9 lo contradice en el título |

---

## D. REDUNDANCIAS CONFIRMADAS

1. **{bishop-8, bishop-9, bishop-10} — clúster "a1 + blocker en diagonal larga → rodear".**
   - **bishop-9 es casi idéntico a bishop-8**: mismo mover/target/opt (a1→g7, opt 4); el 2º blocker
     no cambia la decisión. **Redundancia fuerte → REMOVE bishop-9.**
   - bishop-8 (opt 4) vs bishop-10 (opt 5): mismo principio, rampa de longitud. Redundancia **leve**;
     aceptable como intro→capstone (la torre tolera pares "caso limpio → avanzado").

2. **{bishop-6, bishop-7} — "pivote bloqueado → detour opt 3".** Mismo principio; 7 escala a 6
   (uno vs ambos pivotes bloqueados). Redundancia **leve**; aceptable como rampa (6 intro, 7 avanzado).

3. **{bishop-4, bishop-5} — "pivot a target en la misma fila".** *No redundantes*: 4 = pivote
   **forzado** (1 ruta, esquina), 5 = **elección** de pivote (2 rutas, centro). Perfiles de decisión
   distintos → KEEP ambos.

4. **{bishop-1, bishop-2, bishop-3} — "un rayo, opt 1".** *No redundantes*: 1 = intro NE largo oscuro,
   2 = orientación NW + alfil claro, 3 = corto + elección de rayo. Tres trabajos distintos → KEEP.

**Única redundancia dura: bishop-9.** Las demás son rampas defendibles.

---

## E. VACÍOS PEDAGÓGICOS CONFIRMADOS

- **G1 — "el alfil siempre conserva el color" (NO enseñado).** Ningún tablero hace que el alumno
  choque con la casilla de color opuesto inalcanzable. Es la propiedad *definitoria* del alfil.
  Decisión de diseño (para B3/producto): ¿ejercicio dedicado, momento conceptual, o señal de UI?
  Riesgo: un target de color opuesto sería literalmente insoluble → probablemente NO es un ejercicio
  clásico sino un *concept card* o un target resaltado como "gris/inalcanzable".
- **G2 — "el alfil no es una torre", sin ejercicio limpio.** Hoy vive dentro de bishop-4 mezclado con
  el pivote. La torre tiene `rook-no-diagonal-1` dedicado. Cobertura *adecuada pero implícita*;
  un ejercicio limpio opcional lo haría explícito (no bloqueante).

---

## F. RECOMENDACIONES (propuesta de currículo)

Nada aplicado. Sujeto a aprobación antes de B2/B4.

### Veredicto por ejercicio

| id | veredicto | acción |
|----|-----------|--------|
| bishop-1 | **KEEP** | autorar `principle/learningObjective` (hoy null) |
| bishop-2 | **KEEP** | idem; nombrar orientación + color claro |
| bishop-3 | **KEEP + RETAG** | tag `short-diagonal`/`ray-choice`; quitar `straight-line` |
| bishop-4 | **KEEP + RENAME** | "The bishop is not a rook" (principio no-straight + pivot forzado) |
| bishop-5 | **KEEP + RENAME** | "Choose the pivot" (dos rutas) |
| bishop-6 | **KEEP** | intro pivote-bloqueado; autorar principio |
| bishop-7 | **KEEP + RETAG** | escalada de 5; principio `blocked-pivot-advanced` |
| bishop-8 | **KEEP + RENAME** | intro blocked-long-diagonal |
| bishop-9 | **REMOVE** | duplicado de 8 + título "capture" fuera de alcance |
| bishop-10 | **KEEP + RENAME** | capstone route-planning (opt 5) |

### Orden recomendado (por maestría) — **9 ejercicios**

1. bishop-1 — Diagonal movement (NE, largo)
2. bishop-2 — The other diagonal (NW, alfil claro)
3. bishop-3 — Short diagonal / pick a direction
4. bishop-4 — The bishop is not a rook (pivote forzado)
5. bishop-5 — Choose the pivot (dos rutas)
6. bishop-6 — Your own piece blocks the pivot
7. bishop-7 — Both pivots blocked
8. bishop-8 — Blocker on the long diagonal
9. bishop-10 — The long way around (capstone)

### Número total recomendado

**9 ejercicios** (remover solo bishop-9). No se conserva ninguno "para llegar a 10".

**Decisión abierta para B3 (G1 color):** si se agrega un 10º que enseñe "mismo color / casilla
opuesta inalcanzable", debe resolverse el problema del target insoluble (concept card o casilla
marcada como inalcanzable, no un target normal). No se diseña FEN en B1.

**Fin de B1. Sin cambios aplicados.**
