# Plan — Registrar el tablero en el theme-builder (Fase B)

**Fecha:** 2026-07-18 · **Branch:** `feat/theme-builder`
**Meta del catálogo:** el founder ve cada slot de arte con sus dimensiones para saber qué generar,
y puede reemplazar/optimizar la imagen desde `/dev/theme-builder`.

## Hallazgo que define el plan

El tablero NO es una migración limpia estilo `hub.portal`. Tiene **dos estilos de cableado** y una
**capa de theming preexistente**:

1. **Piezas** (`board.tsx` → `PIECE_IMG`): const de componente `${THEME_CONFIG.piecesBase}/w-<pieza>.png`.
   `THEME_CONFIG` viene de `lib/theme.ts` — un theme **build-time por env** (`NEXT_PUBLIC_ASSET_THEME`,
   default `"candy"` → piezas reales en `/art/redesign/pieces`). Usado en **6 archivos**, incluido
   **render server-side** (`lib/og/board-render.tsx`) donde los hooks de React NO corren.
2. **Fondo del tablero + casillas**: viven en **CSS** (`globals.css`) como `image-set()` /
   `background-image` (`--playhub-board-bg`, `casilla-clara`, `casilla-oscura`). El CSS estático no
   puede llamar a `useThemeAsset`.

→ Registrar el tablero "de verdad" implica reconciliar `lib/theme.ts` (env, server-side) con el
registry nuevo (`useActiveTheme`) e inyectar variables CSS desde el theme activo. Eso es un refactor,
no un swap. Por eso se parte en B1 (barato) y B2 (caro).

---

## Fase B1 — Visibilidad en el catálogo (BARATO, ~30–45 min) ✅ recomendado ahora

Agregar los slots del tablero al registry **apuntando a los paths que HOY se renderizan**, sin tocar
ningún consumidor. El tablero sigue renderizando igual; los slots simplemente **aparecen** en el
catálogo con dims + Replace/optimize/undo.

**Slots nuevos en `ThemeAssetKey` + `THEMES["candy-forest"].assets`:**

| Slot key | basename (path real hoy) | usedIn |
|---|---|---|
| `board.background` | `/art/chesscito-board` | Arena + Exercises board |
| `board.tile.light` | `/art/board/casilla-clara` | Board squares (claras) |
| `board.tile.dark` | `/art/board/casilla-oscura` | Board squares (oscuras) |
| `board.piece.rook` | `/art/redesign/pieces/w-rook` | Piezas jugables |
| `board.piece.bishop` | `/art/redesign/pieces/w-bishop` | " |
| `board.piece.knight` | `/art/redesign/pieces/w-knight` | " |
| `board.piece.pawn` | `/art/redesign/pieces/w-pawn` | " |
| `board.piece.queen` | `/art/redesign/pieces/w-queen` | " |
| `board.piece.king` | `/art/redesign/pieces/w-king` | " |

**Pasos:**
1. `theme-registry.ts`: ampliar el union `ThemeAssetKey` con los 9 keys.
2. `theme-registry.ts`: agregar las 9 entradas a `candy-forest` (solo `default`; sin `pro` por ahora).
3. `__tests__/theme-registry.test.ts`: sumar los 9 a `REQUIRED_ASSET_KEYS` (el test itera y exige que
   todo theme cubra todo key).
4. Verificar en `/dev/theme-builder`: 2 → 11 slots, todos con dims reales vía sharp.

**Resultado:** el catálogo cubre las superficies de juego. Reemplazar una pieza/fondo desde la UI
**sí** cambia el tablero (los consumidores leen esos mismos archivos) — que es exactamente el objetivo.

**⚠️ Límites conscientes de B1 (NO son bugs):**
- El catálogo **espeja archivos**, no modela el switch `ASSET_THEME` ni las clases de tint
  (`pieceTintClass`). Si algún día se activa `NEXT_PUBLIC_ASSET_THEME=default`, las piezas reales
  pasan a `/art/pieces/*` y el registry (que apunta a `/art/redesign/pieces/*`) quedaría desalineado.
  Mitigación: los basenames se fijan al valor que `THEME_CONFIG` resuelve HOY (`candy`).
- No hay variante `pro` para el tablero todavía (cae a `default`, badge "reuses default").

---

## Fase B2 — Migración real de consumidores (DIFERIDO, caro)

Rewire para que el tablero **lea del registry / theme activo** en vez de sus paths hardcoded. Solo
tiene sentido junto con la activación user-facing (Fase C de la foundation). Drivers de costo:

- **Piezas server-side**: `lib/og/board-render.tsx` usa `THEME_CONFIG` sin React → hace falta un
  resolver no-hook además del hook, o mover todo a un resolver puro compartido.
- **Fondo + casillas en CSS**: `image-set()` no puede llamar hook → inyectar `--playhub-board-bg` (y
  las casillas) como variables CSS desde el theme activo, o mover a estilos inline en el componente.
- **Reconciliar dos sistemas**: `ASSET_THEME` (env, build-time) vs `useActiveTheme` (registry,
  runtime). Deben fusionarse o puentearse, o hay dos fuentes de verdad para las mismas piezas.

**Recomendación:** hacer B1 ahora (entrega valor de catálogo, riesgo cero al render), diferir B2 hasta
que se encare la activación del picker (Fase C).

---

## Decisión pendiente para vos

- ¿B1 completo (9 slots: fondo + casillas + 6 piezas), o solo un subconjunto (p. ej. solo las 6
  piezas primero)?
- ¿Confirmás que las piezas reales hoy son `/art/redesign/pieces/*` (theme `candy`)? Si tu build usa
  `NEXT_PUBLIC_ASSET_THEME=default`, cambia el basename a `/art/pieces/*`.
