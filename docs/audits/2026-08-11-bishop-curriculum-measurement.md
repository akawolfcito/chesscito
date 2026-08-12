# Medición del alfil — paso 1 del PATRÓN

**Fecha:** 2026-08-11 · Antes de tocar una línea de contenido.
Patrón: `docs/handoffs/2026-08-11-rook-curriculum-and-sweep-close-handoff.md` §3.
Script de medición: scratchpad `measure-bishop.js` (BFS de alfil + permutaciones, espejo
plano de `getBishopMoves` / `computeExerciseBfs` / `computeSweepOptimal`).

## 1. Lo que hay hoy

| # | id | start | target | óptimo | muros | alcance | color | tier |
|--:|---|---|---|--:|--:|--:|---|---|
| 1 | `bishop-1` | a1 | h8 | 1 | 0 | 31 | oscuro | easy |
| 2 | `bishop-2` | a8 | h1 | 1 | 0 | 31 | claro | easy |
| 3 | `bishop-3` | d4 | g7 | 1 | 0 | 31 | oscuro | easy |
| 4 | `bishop-4` | f8 | g1 | 2 | 0 | 31 | oscuro | easy |
| 5 | `bishop-5` | g2 | b3 | 2 | 0 | 31 | claro | easy |
| 6 | `bishop-6` | a1 | h8 | 5 | 1 | 30 | oscuro | medium |
| 7 | `bishop-7` | b8 | g3 | 4 | 15 | 24 | oscuro | medium |
| 8 | `bishop-8` | a1 | g7 | 8 | 10 | 27 | oscuro | medium |
| 9 | `bishop-10` | g2 | b7 | 7 | 16 | 27 | claro | medium |

**Curva de óptimos: 1, 1, 1, 2, 2, 5, 4, 8, 7.**
Cuatro avisos del linter: salto 2→5 (#6), retroceso 5→4 (#7), salto 4→8 (#8), retroceso 8→7 (#9).
Peor que la torre antes de tocarla (tenía tres). **Cero sweeps**: los nueve son de un objetivo.

## 2. Lo que el alfil tiene y la torre no

⛔ **El alfil sólo pisa su propio color.** Todo objetivo de un sweep **debe** ser del color de
la casilla de salida, o la pierna es imposible y `computeSweepOptimal` devuelve `null`. Esta
regla no existía en la torre y es la primera causa de un sweep insoluble.

⚠️ **En tablero vacío el alcance es 31 casillas, TODAS a distancia 1 ó 2** (7–13 a un
movimiento, el resto a dos). Idéntico techo que la torre: un sweep limpio de 3 objetivos
cuesta entre 3 y 6, así que la curva de los escalones 2–4 se construye igual.

⚠️ **El pool es 9, no 10.** `badgeRequiredCount` es `Math.ceil(pool × 0.8)`
(`lib/game/exercises.ts:47`): **9 → 8 y 10 → 8**. Verificado en código: **agregar un décimo
ejercicio NO mueve el gate de la insignia** y no deja `locked` a nadie. Es el único crecimiento
gratis; de 10 a 11 ya sube a 9.

## 3. Inventario para los cuatro escalones

- **Tableros limpios (sin muros): 5** — `bishop-1..5`
- **Tableros con muros: 4** — `bishop-6` (1 muro), `bishop-7` (15), `bishop-8` (10), `bishop-10` (16)

El reparto de la torre (1 entrada · 3 sweep · 3 obstáculos · 3 ambos) pide **6 tableros con
muros** y hay **4**. De ahí las dos opciones de la §4.

## 4. Dos formas de armarlo

**A — Pool 10, espejo exacto de la torre.** 1 entrada + 3 sweep + 3 obstáculos + 3 ambos.
Cuesta: ponerle muros al tablero limpio sobrante (`bishop-2` o `bishop-4`) y **autorar un
tablero denso nuevo** con solver (§4 del patrón). El gate sigue en 8. Deja las dos piezas
comparables 1 a 1 para el experimento.

**B — Pool 9, reparto 1 · 3 · 3 · 2.** Cero tableros nuevos, sólo reorden + conversión a sweep.
Más barato y más rápido; el escalón "ambos" queda con dos peldaños en vez de tres.

En las dos: ⛔ **`bishop-1` no se convierte nunca** — es el control within-subject del alfil,
igual que `rook-1`. Y sólo el primer sweep lleva `starFloor: 1`.

## 5. Pendiente antes de autorar

1. Elegir A o B (decisión del founder).
2. Correr el solver de conjuntos candidatos **respetando el color** antes de escribir un
   objetivo. No elegir a ojo — en la torre elegir por alcance medido dio alternancia, no
   currículo, y hubo que rehacerlo.
