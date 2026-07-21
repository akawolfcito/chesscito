# Plan — sacar los pins de contenido del camino del builder (2026-07-21)

Diagnóstico origen: `docs/audits/2026-07-21-ci-red-diagnosis.md`
Decisión del founder (2026-07-21): la curva de dificultad es **WARNING**, no error.

---

## El principio rector

> **Ningún test debe pinear un valor que el builder puede cambiar.**
> Los valores autorados se juzgan en `lint.ts` (warning, al guardar).
> Los tests verifican la **regla**, nunca el dato del día.

El builder de juegos lúdicos es una herramienta de autoría en uso activo: vos vas a
agregar, mover y rebalancear boards seguido. Un test que congela
`[1,1,1,2,2,3,4,4,3,4]` no protege la curva — **convierte cada save en un CI rojo**,
y el costo de eso es que se vuelve ruido y dejás de mirarlo. Ahí es donde muere el
guardrail de verdad, no cuando lo reescribís.

`lint.ts` ya tiene la filosofía escrita en su encabezado:

> *"Deterministic checks are ERRORS — they are decidable from the board alone.
> Judgement calls are WARNINGS: a heuristic that breaks the build gets switched off,
> and then it protects nothing."*

Este plan solo termina de aplicarla. La forma de una curva es un **juicio**.

---

## Lo que YA está bien (no se toca)

Antes de reescribir nada: en esos dos archivos de pedagogía, la mayoría de los tests
son invariantes sanos y sobreviven a cualquier edición del builder. Son el modelo a
seguir, y quedan intactos:

| Test | Por qué es robusto |
|---|---|
| `is a curated piece` | Verifica pertenencia, no cantidad |
| `gives all N exercises complete pedagogy` (el `for`) | Recorre lo que haya |
| `teaches one principle per exercise, each exactly once` | Unicidad, no valores |
| `resolves the real title, never 'Exercise N'` | Deriva del propio dato |
| `retires the replaced exercises rather than reusing their ids` | Regla de negocio real |
| `teaches colour conservation… never an unsolvable target` (bishop) | Deriva del board |
| `states the principle in the prompt, never the solution` (rook) | Regex sobre el copy |

**Diagnóstico honesto: el problema es minoritario.** ~7 pins frágiles contra ~10
invariantes sanos en los mismos dos archivos.

---

## Inventario de pins frágiles

| # | Archivo | Línea | Pin | Destino |
|---|---|---|---|---|
| P1 | `rook-pedagogy` | 30 | `toHaveLength(10)` | piso, no igualdad |
| P2 | `rook-pedagogy` | 92-103 | lista exacta de ids | invariante de orden |
| P3 | `rook-pedagogy` | 108, 112 | arrays optimals/obstacles | → `lint.ts` (warning) |
| P4 | `rook-pedagogy` | 126-129 | números de `rook-6`/`rook-7` | **borrar** (ver abajo) |
| P5 | `bishop-pedagogy` | 35, 66 | `toHaveLength(9)` ×2 | piso, no igualdad |
| P6 | `bishop-pedagogy` | 17-27, 70 | `EXPECTED_ORDER` | invariante de orden |
| P7 | `bishop-pedagogy` | 77-78 | arrays optimals/obstacles | → `lint.ts` (warning) |
| P8 | `responsive-asset-profiles` | 37 | ruta `brand.title` pro | invariante de forma |

**Sobre P4** — `"keeps the trimmed exercises' decision intact (A5)"`. Pinea una
decisión de diseño de julio 13 sobre dos boards concretos. Vos ya la **revocaste
conscientemente** con el builder (`rook-6` pasó de 3 a 6 óptimos). Un test que
defiende una decisión que el autor ya cambió no es un guardrail: es un fantasma.
Se borra, y su razonamiento sobrevive en el audit doc y en el comentario del board.

---

## Etapas

Ciclo SDD → TDD → EDD. Un commit atómico por etapa, suite completa antes de cada uno.

### Etapa 1 — `fix(ci)`: los cuatro mecánicos

Sin decisiones de producto. Baja el ruido de 5 fallos a 1.

1. **`use-coach-analysis.test.ts:126`** — anotar el fixture:
   `walletAddress: "0x1111…" as \`0x${string}\``. El tipo y el hook están bien;
   solo el literal se ensanchaba a `string`.
2. **`asset-triplet.test.ts:130`** — timeout explícito. Escribe y revierte archivos
   reales en `public/`: 5000ms alcanza en tu Mac, no en el runner. Se declara el
   costo en vez de fingir que es un test de lógica pura.
3. **`hub-scaffold-client.test.tsx` ×2** — el badge PRO arranca en
   `status="unknown"` (no `"inactive"`). El default nuevo es el correcto —
   **nunca afirmar un estado de suscripción sin verificarlo**. Los tests apuntan a
   `proUnavailableAriaLabel` en el primer paint, **y se agrega uno nuevo** que
   verifica la transición `unknown → inactive` al resolver el transporte. Eso es
   cobertura que hoy no existe.
4. **P8** — `"does not change registry paths"` deja de pinear
   `/art/title-chesscito` y pasa a verificar la **forma**: que el slot resuelva a
   una ruta no vacía, que la variante `pro` difiera de `default`, y que la
   clasificación de slot no cambie. El theme-builder repunta rutas por diseño
   (`b6a6e507`); la ruta literal nunca fue el invariante.

### Etapa 2 — `feat(lint)`: la curva vive en el linter

**SDD primero.** Tipo antes que lógica:

```ts
// lib/content/lint.ts
export type SequenceLintInput = {
  piece: PieceId;
  exercises: readonly { id: string; optimalMoves: number; obstacles?: unknown[] }[];
};
export function lintPieceSequence(input: SequenceLintInput): LintResult;
```

Devuelve el mismo `LintResult { errors, warnings }` que `lintPuzzle` — se acopla al
canal que `catalog.ts` ya tiene (`errors.push(...)` / `warnings.push(...)`,
líneas 327-328). **Emite solo warnings.**

Dos reglas, ambas warning:

- **Bajada** — `optimalMoves` decrece entre consecutivos. Hoy: rook `5→4` (paso 7),
  bishop `5→4` y `8→7`.
- **Salto** — sube más de 2 de un paso al siguiente. Hoy: rook `2→5` (paso 6),
  bishop `2→5` y `4→8`.

El mensaje nombra pieza, paso, ids y números — el mensaje **es** la superficie de
debugging, igual que el resto de `lint.ts`.

**Punto de enganche:** `catalog.ts`, después del loop por puzzle, una vez por pieza.
La ubicación exacta se confirma leyendo el cierre del loop (`lintPuzzle` se llama en
`:324`, dentro del `forEach` por input).

**TDD:** los tests de `lintPieceSequence` usan **fixtures propios** — secuencias
inventadas, no `EXERCISES`. Así prueban la regla sin volver a atarse al catálogo.
Casos: curva plana OK · curva monótona OK · bajada → 1 warning · salto → 1 warning ·
`errors` siempre vacío.

### Etapa 3 — `refactor(tests)`: pins → invariantes

- **P3, P7** — los dos `"ramps difficulty without a spike"` dejan de comparar arrays.
  Pasan a afirmar que **la regla existe y se aplica**: `lintPieceSequence` corre
  sobre el catálogo real y **nunca produce `errors`** (la curva jamás rompe el
  build). Los warnings del día **no se afirman** — son el juicio tuyo, no del CI.
- **P1, P5** — `toHaveLength(N)` → piso: `toBeGreaterThanOrEqual(N)`. Agregar boards
  deja de romper; vaciar el pool sigue rompiendo.
- **P2, P6** — la lista de ids deja de ser literal. El invariante real que esos
  tests querían es **"cada principio se introduce antes de escalarse"**, y eso ya lo
  cubre `teaches each principle exactly once` + el orden del array. Se reduce a:
  ningún id retirado reaparece, y el primer ejercicio de la pieza es de
  `optimalMoves === 1`.
- **P4** — borrar, con el porqué en el commit.

### Etapa 4 — verificación

- `pnpm exec tsc --noEmit` limpio.
- Suite completa verde. **Reporto el conteo real** — el baseline en memoria
  (5003/420) está viejo: hoy son 490 archivos.
- **Prueba de fuego del plan:** editar a mano un `optimalMoves` en
  `puzzles.generated.ts`, correr la suite, confirmar que **sigue verde** y que el
  lint emite el warning. Si eso no pasa, el plan falló y no cerramos.
- Revertir esa edición.

---

## Lo que este plan NO hace

- **No rediseña ningún board.** Los boards que hiciste quedan como están.
- **No pone verde el CI escondiendo señal.** La curva sigue vigilada; cambia el
  canal (warning al guardar) y el momento (autoría, no merge).
- **No toca los 10 invariantes sanos.**

## Riesgo asumido, explícito

Con la curva en warning, **una curva rota puede llegar a producción sin bloqueo**.
Es la decisión tomada, y es defendible: un juego con un salto de dificultad es
jugable, y vos ves el aviso al guardar. Pero queda dicho — si algún día un
principiante choca un muro en el ejercicio 6, la causa está acá, no en un bug.

## Pregunta abierta

Los warnings del lint, ¿los ves hoy al guardar en el builder? Si `catalog.ts` los
acumula pero la UI del builder no los muestra, la Etapa 2 escribe avisos a un canal
ciego. **Lo verifico al empezar la Etapa 2** y, si está ciego, se agrega
mostrarlos como sub-etapa 2b.
