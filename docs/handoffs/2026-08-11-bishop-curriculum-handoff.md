# Handoff — el currículo del alfil (segunda pieza del patrón)

**Fecha:** 2026-08-11 · **Rama:** `main` LOCAL, **sin pushear** · **5 commits** de esta sesión
**Estado:** ✅ verificado de punta a punta · ⏳ **falta el smoke manual del founder**

Antecedente y patrón: `docs/handoffs/2026-08-11-rook-curriculum-and-sweep-close-handoff.md` §3
Medición y diseño: `docs/audits/2026-08-11-bishop-curriculum-measurement.md`

---

## 1. Verificación al cierre

| | |
|---|---|
| Vitest | **638 archivos / 7823 tests · EXIT=0** (129 s, máquina libre, 0 `Unhandled Errors`) |
| `pnpm exec tsc --noEmit` | limpio |
| `pnpm build` | **EXIT=0** |
| E2E smoke del alfil | **10/10 · 55,5 s** (`--project=minipay`) |
| VR | **67/67 · exit 0** (`--project=minipay --update-snapshots=none`, baselines 81 antes y después) |
| Smoke manual | ⏳ **pendiente** |

El conteo de archivos (638) coincide con la medición del cierre anterior, así que la corrida
vale. Los tests suben de 7819 a 7823: el ejercicio nuevo aporta sus casos parametrizados y el
alfil gana una aserción de color.

⚠️ **Bajé tu `pnpm dev` del 3002** (lo autorizaste) para que la suite y el VR no mintieran.
Levantalo cuando quieras.

---

## 2. Qué quedó vivo

**El currículo del alfil en cuatro escalones**, 10 tableros (era 9):

| # | id | escalón | ★ | óptimo | muros |
|---:|---|---|---:|---:|---:|
| 1 | `bishop-1` | entrada | 1 | 1 | 0 |
| 2 | `bishop-2` | sweep | 3 | 3 | 0 |
| 3 | `bishop-5` | sweep | 3 | 4 | 0 |
| 4 | `bishop-4` | sweep | 3 | 4 | 0 |
| 5 | `bishop-7` | obstáculos | 1 | 4 | 15 |
| 6 | `bishop-6` | obstáculos | 1 | 5 | 1 |
| 7 | `bishop-10` | obstáculos | 1 | 7 | 16 |
| 8 | `bishop-8` | ambos | 2 | 8 | 10 |
| 9 | `bishop-3` | ambos | 2 | 9 | 5 |
| 10 | `bishop-fence-1` | ambos | 3 | 10 | 3 |

Curva **1, 3, 4, 4, 4, 5, 7, 8, 9, 10**: monótona, sin saltos > 2, **cero avisos** (venía con
cuatro, la peor de las seis piezas).

⛔ **`bishop-1` no se convierte nunca** — control within-subject del alfil, igual que `rook-1`.
⛔ **Sólo `bishop-2` lleva `starFloor: 1`** — es el segundo tablero que toca alguien nuevo.

**Dos tableros salieron de un solver**, no del ojo (BFS de alfil + permutaciones + poda de
muros decorativos): `bishop-3` reconstruido con 5 muros y `bishop-fence-1` nuevo. Todo muro que
quedó es load-bearing.

**`bishop-fence-1`, el final:** tres caballos en una columna parten el tablero, y sólo queda
**una** casilla para cruzar — demostrable, no estimado: en esa columna las únicas casillas del
color del alfil son cuatro y tres están ocupadas.

---

## 3. Lo que el alfil tiene y la torre no

⛔ **El alfil sólo pisa su color.** Un objetivo del color contrario no es un nivel difícil: es
**imposible**, `computeSweepOptimal` devuelve `null` y la corrida perfecta no existe. Ahora hay
una aserción que lo cubre para **todas** las estrellas, no sólo para `targetPos`
(`bishop-rules.test.ts`).

⚠️ **`target` de `bishop-8` pasó de `g7` a `b2`.** `exercise-bfs.test.ts` exige que la pierna a
`targets[0]` sea **estrictamente** más barata que el óptimo del sweep, o el nivel colapsó a un
tablero de un objetivo. Con `g7` primero las dos medían 8. La regla práctica para autorar:
**`targets[0]` es una estrella BARATA**; la cara va después.

⚠️ **De 9 a 10 tableros el gate de la insignia NO se movió**: `ceil(9×0,8)` y `ceil(10×0,8)` son
8. Era el único crecimiento gratis. **De 10 a 11 sube a 9** y quien la tenga ganada sin reclamar
la ve `locked`. El techo de estrellas del ranking pasa de **177 a 180**.

---

## 4. Tres cosas que el patrón no traía y ahora sí

1. **El audit de muros decorativos no puede opinar sobre un sweep.** `decisionProfile` rutea
   hasta `targetPos`, que en un sweep es sólo `targets[0]`. Preguntado por `bishop-8` (primera
   estrella a 1 movimiento, segunda a 8) contestó con seguridad *"óptimo 1, 9 de 10 muros
   decorativos"* sobre muros que cuadruplican la ruta. Exento, con el mismo criterio que el
   archivo ya aplicaba a los kinds con solver propio.
2. **Seis tests pineaban contenido autorado** y ninguno falló por una regresión: pool del alfil
   (9), total de ejercicios (59), denominador de estrellas (177), la lista literal de ids en
   orden de maestría, y `starFloor` atado a un único id. Todos pasan a **contar del catálogo** o
   a afirmar su política.
3. **El smoke E2E del alfil llevaba meses muerto.** Decía que `bishop-2` mandaba a `a8` cuando
   el contenido decía `h1` desde hacía semanas. Reescrito: el catálogo ES el fixture.

---

## 5. Lo que sigue

1. **Smoke manual del alfil.** En la torre, los tests no encontraron **ninguno** de los cinco
   defectos de producto; los encontró jugar. Mirar sobre todo los cuatro sweeps y los dos
   tableros nuevos.
2. **Pushear `main`.** Son 5 commits de esta sesión sobre los 26 de la anterior. Es del founder.
3. **Repetir el patrón** en la tercera pieza. Quedan caballo, peón, dama y rey — y los cuatro
   tienen avisos de curva hoy (el rey, tres saltos y un retroceso).
4. **Leer el experimento** cuando haya muestra: ahora hay dos piezas con sweeps y dos controles
   sin convertir (`rook-1`, `bishop-1`).

**Abiertas, sin urgencia:**

- ⚠️ **`e2e/rook-ten-exercises-smoke.spec.ts` está igual de podrido** que estaba el del alfil:
  pinea targets que el contenido ya cambió (dice `rook-2` → `a8`, hoy es `e8`). El del alfil
  quedó como plantilla para arreglarlo derivando del catálogo. No lo toqué: no era esta pieza.
- ⚠️ **`EXERCISE_DESCRIPTIONS` (EN y ES) quedó desactualizado** para `bishop-2` y `bishop-3`, y
  no tiene fila para `bishop-fence-1`. **No se ve**: para una pieza curada gana el título
  compilado en `puzzles.generated.ts` y los catálogos i18n ni se consultan (lo dice
  `exercise-descriptions.test.ts`). Los dos ids nuevos de la torre tampoco están. Es una trampa
  para el próximo que lea ese mapa, no un bug del jugador.
- ⚠️ **La rotación diaria decide qué ejercicios se ven con un hash que incluye la FECHA UTC.**
  Cualquier test que siembre "los anteriores resueltos" pasa o falla según el día. El smoke del
  alfil lo esquiva sembrando **todos los otros** en 3★, que deja el tablero bajo prueba primero
  en cualquier fecha.
