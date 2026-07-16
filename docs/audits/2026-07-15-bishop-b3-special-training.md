# Bishop B3 — Special Training (read-only)

**Fecha:** 2026-07-15 · **Branch:** `fix/exercise-obstacles-a0`
**Entradas:** B0/B1/B2 del alfil.
**Alcance:** solo evaluación. No se editó JSON, generated, tests, Supabase ni código. Sin FEN nuevos.
**Estándar de referencia:** Rook Rails (`2026-07-14-rook-rails-board-audit.md`).
**Método:** diseño espacial humano primero; BFS/métricas como filtro de aceptación.

Notación: file 0–7 = a–h, rank 0–7 = 1–8.

---

## A. HECHOS MEDIDOS POR EL MOTOR

Instrumentado con la misma semántica de `exercise-bfs.ts` (rutas completas enumeradas por DFS
acotado a la distancia BFS; necesidad de obstáculo = se remueve y se recomputa `opt`).

### bishop-lab-3

| Campo | Valor |
|---|---|
| id | bishop-lab-3 |
| FEN | `8/8/8/6N1/8/4N3/8/2B5 w - - 0 1` |
| mover → target | c1 → h6 |
| optimalMoves | 3 |
| # rutas óptimas | 2 |
| primeros movimientos óptimos | b2, a3 (2) |
| rutas completas | `c1→b2→g7→h6` · `c1→a3→f8→h6` |
| obstáculos | g5 (6,4), e3 (4,2) |
| necesidad | quitar g5 → opt 3 · quitar e3 → opt 3 → **cada uno individualmente redundante** |
| grupos de obstáculos | **1 grupo**: g5 y e3 están **ambos sobre el rayo directo c1–h6** (la diagonal que van a bloquear). Uno basta para forzar opt 3; el segundo es decorativo |

### bishop-lab-4

| Campo | Valor |
|---|---|
| id | bishop-lab-4 |
| FEN | `8/8/8/4N3/8/2N5/8/B7 w - - 0 1` |
| mover → target | a1 → h8 |
| optimalMoves | 5 |
| # rutas óptimas | 4 |
| primeros movimientos óptimos | b2 (1 — entrada **forzada**) |
| rutas completas | `a1→b2→c1→g5→f6→h8` · `a1→b2→c1→h6→g7→h8` · `a1→b2→a3→e7→f6→h8` · `a1→b2→a3→f8→g7→h8` |
| obstáculos | e5 (4,4), c3 (2,2) — **ambos sobre la diagonal a1–h8** |
| necesidad | quitar e5 → opt 5 · quitar c3 → opt 5 → **ambos individualmente decorativos** |
| grupos de obstáculos | 1 grupo (muro sobre la diagonal larga) |

**Cross-check crítico:** el ejercicio `bishop-10` (a1→h8, blocker e5, opt 5) tiene el **mismo start,
target, optimalMoves y principio** que bishop-lab-4. **bishop-lab-4 duplica un ejercicio del pool.**

---

## B. LECTURA VISUAL Y PEDAGÓGICA

| | bishop-lab-3 | bishop-lab-4 |
|---|---|---|
| Se comporta como | **bifurcación** (2 desvíos simétricos) sobre una diagonal bloqueada | **laberinto de planificación** (entrada forzada + abanico de 4 rutas) |
| ¿Corredor? | no (hay elección) | no |
| Decisión real | elegir uno de dos desvíos equivalentes (arriba vs abajo) | planificar la ruta completa; todas las ramas cuestan 5 |
| Principio que enseña | rodear una diagonal bloqueada + elegir ruta | rodear la diagonal larga + planificación multi-leg |

### Cobertura de principios propios del alfil (en los dos labs)

| Principio del alfil | ¿Cubierto en labs? | Dónde |
|---|---|---|
| Cambiar de diagonal mediante pivotes | 🟡 implícito (los desvíos son pivotes) | lab-3, lab-4 |
| Escoger entre pivotes | ✅ | lab-3 (fork), lab-4 (abanico) |
| Rodear una diagonal bloqueada | ✅ (sobre-cubierto) | lab-3 y lab-4 enseñan lo mismo |
| Planificar conservando el color | 🟡 estructural, no confrontado | ambos (target mismo color) |
| Comparar rutas diagonales (longitudes distintas) | ❌ | ninguno — todas las rutas empatan en coste |
| Reconocer zonas inaccesibles por color | ❌ | ninguno |

---

## C. REDUNDANCIAS Y VACÍOS

**Redundancias confirmadas:**
1. **Dentro de lab-3:** g5 + e3 son el mismo grupo de obstáculo (un muro sobre el rayo c1–h6).
   Uno basta; el segundo es decorativo. → limpiar en diseño.
2. **lab-4 ≈ ejercicio bishop-10:** mismo tablero de decisión (a1→h8, diagonal larga bloqueada,
   opt 5). Special Training **no debe repetir** un ejercicio del pool (falla el estándar Rook Rails).

**¿Escalada o redundancia entre los dos labs?**
Forman una **escalada débil** en longitud/rutas (3→5 moves, 2→4 rutas) pero enseñan **el mismo núcleo**
("diagonal bloqueada → elegir una ruta simétrica"). No introducen un principio nuevo del alfil entre
sí. Falta un peldaño que agregue una decisión **distinta**.

**Vacíos:**
- **Comparación de rutas de distinta longitud** (elegir la más corta, no una de varias iguales).
- **Lectura espacial del color** (zonas del color opuesto como "terreno" inaccesible) — solo como
  briefing/lectura, **nunca** como target insoluble (restricción del contrato).
- **Nivel de entrada limpio** (un solo desvío, sin fork) que introduzca el concepto antes del fork.

---

## D. CLASIFICACIÓN DE LOS TABLEROS ACTUALES

| lab | veredicto | razón |
|---|---|---|
| bishop-lab-3 | **KEEP WITH ADJUSTMENT** | buena bifurcación; quitar el 2º blocker redundante (dejar un muro limpio de 1 pieza) |
| bishop-lab-4 | **REPLACE** | duplica el ejercicio bishop-10; obstáculos decorativos; no aporta decisión nueva como Special Training |

(Los IDs históricos `-3`/`-4` **no se renumeran en B3** — se decide en implementación tras evaluar progreso.)

---

## E. PROPUESTA DE PROGRESIÓN DE SPECIAL TRAINING (RECOMENDACIÓN)

**3 niveles** cubren la progresión mejor que 4 (no se fuerza un cuarto). Sólo se define
nombre/principio/dificultad/decisión/tablero — **sin diseñar FEN** (eso es B4/diseño posterior).

| Nivel | Nombre provisional | Principio | Dificultad | Tipo de decisión | Tablero |
|---|---|---|---|---|---|
| L1 | **Around the wall** | rodear una diagonal bloqueada (desvío esencialmente único) | fácil | reconocer el bloqueo y tomar el desvío | **NUEVO** (intro limpia de 1 solo desvío; ningún lab actual es un intro sin fork) |
| L2 | **Fork on the diagonal** | bifurcación: dos desvíos simétricos, elegir uno | media | elegir entre rutas equivalentes | **bishop-lab-3** (KEEP WITH ADJUSTMENT: muro de 1 pieza) |
| L3 | **Plan the long way** | planificar la ruta completa alrededor de la diagonal larga | alta | planificación multi-leg (entrada forzada + abanico) | **NUEVO** (REPLACE lab-4; geometría distinta a bishop-10, p.ej. target fuera de la diagonal principal para exigir pivote+planificación, no la a1→h8 del ejercicio) |

**Opcional L4 — "Compare the routes"** (solo si se quiere sumar una decisión nueva): dos rutas
candidatas de **distinta** longitud; hallar la más corta (comparación de rutas, el vacío no cubierto).
Tablero NUEVO. Si no se incluye, **3 niveles bastan**.

**Color (G1) como sabor, no como objetivo:** puede aparecer en el briefing de L3 o como lectura visual
(zonas del color opuesto sombreadas/inaccesibles) con un target del **mismo** color (soluble). Nunca
como misión de color opuesto (insoluble bajo el contrato). No requiere su propio nivel.

---

## F. TABLEROS NUEVOS REALMENTE NECESARIOS

- **Progresión de 3 niveles: 2 tableros nuevos** (L1 intro + L3 capstone). L2 reusa lab-3 ajustado; lab-4 se retira.
- **Si se añade L4 (route comparison): 3 tableros nuevos.**

Recomendación: **3 niveles / 2 tableros nuevos.** Suficiente para igualar el estándar Rook Rails sin
duplicar el pool de ejercicios.

---

## G. VEREDICTO

### 🟢 READY TO DESIGN

La auditoría está completa y la dirección es clara: **ajustar lab-3, retirar lab-4, diseñar 2 tableros
nuevos** para una progresión de 3 niveles (L1 intro-detour → L2 fork → L3 planning). No es KEEP EXISTING
(lab-4 duplica bishop-10; lab-3 tiene blocker redundante) ni NEEDS REVISION (no hay bloqueador de diseño).

Restricciones para el diseño (B4/posterior): L3 debe diferir del tablero de bishop-10; ningún target de
color opuesto; obstáculos deben ser necesarios (cada uno cambia `optimalMoves`); validar por BFS antes de aceptar.

**Fin de B3. Sin implementar ni diseñar tableros nuevos.**
