# Board Flat Grid — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace la homografía de perspectiva en el tablero por un CSS Grid plano que encaje con `chesscito-board.png` (imagen ortográfica/plana).

**Architecture:** Eliminar toda la lógica de `computeHomography`/`interpolateQuad` en `board.tsx`. Las casillas pasan de `position: absolute` con coordenadas calculadas a ser items de un CSS Grid 8×8. El hit-grid ya tiene `inset` correcto para alinearse con el borde del PNG.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, clases custom en `globals.css`.

---

### Task 1: Actualizar `.playhub-board-hitgrid` y `.playhub-board-cell` en globals.css

**Files:**
- Modify: `apps/web/src/app/globals.css` (líneas 253–267)

**Step 1: Editar `.playhub-board-hitgrid` — agregar display grid**

Reemplazar el bloque existente:
```css
.playhub-board-hitgrid {
  position: absolute;
  inset: 4.9% 4.4% 3.6% 4.6%;
}
```
Por:
```css
.playhub-board-hitgrid {
  position: absolute;
  inset: 4.9% 4.4% 3.6% 4.6%;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
}
```

**Step 2: Editar `.playhub-board-cell` — quitar `position: absolute`**

Reemplazar el bloque existente:
```css
.playhub-board-cell {
  position: absolute;
  border: 0;
  background: transparent;
  padding: 0;
  margin: 0;
  color: #d9f7ff;
  cursor: pointer;
  transition: transform 120ms ease, background-color 120ms ease;
}
```
Por:
```css
.playhub-board-cell {
  position: relative;
  border: 0;
  background: transparent;
  padding: 0;
  margin: 0;
  color: #d9f7ff;
  cursor: pointer;
  transition: transform 120ms ease, background-color 120ms ease;
}
```

**Step 3: Verificar en browser mobile (390px)**

- Las casillas deben llenar el tablero en una grilla uniforme 8×8
- El borde del tablero del PNG debe coincidir con los bordes del grid

---

### Task 2: Simplificar `board.tsx` — eliminar homografía

**Files:**
- Modify: `apps/web/src/components/board.tsx`

**Step 1: Eliminar tipos y constantes de homografía**

Borrar las siguientes líneas (ya no se necesitan):
```typescript
type Point = { x: number; y: number };

const BOARD_TOP_LEFT: Point = { x: 8, y: 6 };
const BOARD_TOP_RIGHT: Point = { x: 92, y: 6 };
const BOARD_BOTTOM_LEFT: Point = { x: 2, y: 98 };
const BOARD_BOTTOM_RIGHT: Point = { x: 98, y: 98 };

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

type Homography = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  g: number;
  h: number;
};

function computeHomography(
  p00: Point,
  p10: Point,
  p01: Point,
  p11: Point
): Homography { ... }

const BOARD_H = computeHomography(...);
const BOARD_V_GAMMA = 1.38;

function interpolateQuad(u: number, v: number): Point { ... }
```

**Step 2: Simplificar el render de casillas**

El bloque de render actual es un IIFE complejo que calcula homografía por casilla:
```tsx
{squares.map((square) => (
  (() => {
    const row = 7 - square.rank;
    const col = square.file;
    // ... 20+ líneas de homografía, clipPath, minX, maxX...
    return (
      <button
        style={{ left, top, width, height, clipPath }}
        ...
      >
```

Reemplazarlo por:
```tsx
{squares.map((square) => (
  <button
    key={square.label}
    type="button"
    role="gridcell"
    aria-label={`Square ${square.label}`}
    onClick={() => handleSquarePress(square.label)}
    className={[
      "playhub-board-cell",
      square.isHighlighted ? "is-highlighted" : "",
      square.isSelected ? "is-selected" : "",
    ].join(" ")}
  >
    <span className="playhub-board-label">{square.label}</span>
    {square.isHighlighted ? <span className="playhub-board-dot" /> : null}
    {square.isTarget && !square.piece ? <span className="playhub-board-target">◎</span> : null}
    {square.piece ? <span className="playhub-board-piece">♖</span> : null}
  </button>
))}
```

Nota: `buildBoardSquares` ya devuelve las casillas en orden visual (rank 7→0, file 0→7), por lo que el CSS Grid las colocará correctamente de izquierda a derecha, de arriba a abajo.

**Step 3: Verificar que el render funciona**

- Abrir en `localhost:3000` en viewport 390px
- Seleccionar la Torre: deben iluminarse casillas en la misma fila y columna
- Las casillas iluminadas deben estar visualmente alineadas con los cuadros del PNG
- Verificar que el click en una casilla iluminada mueve la Torre

**Step 4: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/components/board.tsx
git commit -m "refactor(board): replace homography with flat CSS grid to match chesscito-board.png

Wolfcito 🐾 @akawolfcito"
```

---

### Task 3: Ajuste fino del inset si hay desalineamiento visual

**Files:**
- Modify: `apps/web/src/app/globals.css`

**Step 1: Medir el desplazamiento visual**

Si las casillas no encajan exactamente con el PNG, ajustar el `inset` de `.playhub-board-hitgrid`. El PNG tiene aspect-ratio 1011/934. El frame del tablero dentro del PNG ocupa aproximadamente:
- Top: ~4.9% de la altura total
- Bottom: ~3.6% desde abajo
- Left: ~4.6% del ancho total
- Right: ~4.4% desde la derecha

Ajustar estos valores de a 0.5% hasta lograr alineación perfecta visual.

**Step 2: Commit si hubo ajuste**

```bash
git add apps/web/src/app/globals.css
git commit -m "style(board): fine-tune hitgrid inset for pixel-perfect alignment

Wolfcito 🐾 @akawolfcito"
```
