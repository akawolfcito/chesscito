# PlayHub Visual Art Inventory (Estado Actual)

Fecha: 2026-03-08
Alcance: inventario visual de la escena `play-hub` y recursos relacionados para priorizar mejoras de arte/iconografía (sin cambios de implementación).

> ⚠️ **Foto de marzo 2026, no el estado actual.** Los tres botones
> `{torre,alfil,caballo}-selected` que aparecen abajo como "Activo" ya no
> existen en disco: los dos últimos se habían ido antes, y `torre-selected` se
> borró el 2026-07-30 tras confirmar que ningún componente lo referencia.
> El inventario vivo de assets es el registro de temas
> (`apps/web/src/lib/themes/theme-registry.ts`), que sí tiene enforcement.

## 1) Artes que componen la escena actual de `play-hub`

| Asset | Formatos | Dimensiones base | Dónde se usa | Estado |
|---|---|---:|---|---|
| `bg-chesscitov2` | `.avif/.webp/.png` | `1024x1536` | Fondo principal (`--playhub-game-bg`) en `body` | Activo |
| `bg-splash-chesscito` | `.avif/.webp/.png` | `1024x1536` | Overlay de entrada (`--intro-bg-mobile`) en `playhub-intro-overlay` | Activo |
| `chesscito-board.png` | `.png` | `1011x934` | Base del tablero jugable (`--playhub-board-bg`) | Activo |
| `torre-selected.webp` | `.webp` | `1536x1024` | Botón de selección de pieza `rook` | Activo |
| `alfil-selected.webp` | `.webp` | `1536x1024` | Botón de selección de pieza `bishop` | Activo |
| `caballo-selected.webp` | `.webp` | `1536x1024` | Botón de selección de pieza `knight` | Activo |
| `panel-frame-rune` | `.avif/.webp/.png` | `1024x1024` | Marco visual en cards/sheets (`rune-frame`) | Activo |
| `shop-slot-frame` | `.avif/.webp/.png` | `1024x1024` | Marco de slots de tienda (`shop-slot-frame`) | Activo |

Notas rápidas:
- Referencias de variables en [apps/web/src/app/globals.css](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/app/globals.css:37).
- Selección de piezas en [apps/web/src/components/play-hub/mission-panel.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/play-hub/mission-panel.tsx:21).
- Tablero proyectado en [apps/web/src/components/board.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/board.tsx:148).

## 2) Iconografía actual en escena (no assets de arte dedicados)

| Elemento visual | Implementación actual | Archivo |
|---|---|---|
| Pieza en tablero | Carácter Unicode `♖` | `board.tsx` |
| Marcador de objetivo | Carácter Unicode `◎` | `board.tsx` |
| Barra de acciones | Emoji/texto: `↺`, `🏅`, `📊`, `⏳` | `onchain-actions-panel.tsx` |

Referencia: [apps/web/src/components/play-hub/onchain-actions-panel.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/play-hub/onchain-actions-panel.tsx:99)

## 3) Artes disponibles en `public/art` no activos en la escena principal actual

| Asset | Formatos | Dimensiones base | Observación |
|---|---|---:|---|
| `bg-chesscito-play` | `.avif/.webp/.png` | `1024x1536` | Disponible pero no activo como fondo principal hoy |
| `bg-game` | `.avif/.webp/.png` | `1024x1536` | Versión previa de fondo |
| `bg-splash` | `.avif/.webp/.png` | `1024x1536` | Splash anterior |
| `bg-intro.png` | `.png` | `1024x1536` | Intro legado |
| `reward-glow` | `.avif/.webp/.png` | `1024x1024` | Variable definida, sin uso directo detectado en `play-hub` actual |

## 4) Faltantes visuales recomendados (para elevar calidad sin tocar lógica)

Prioridad Alta:
1. `piece-rook-active` (sprite/ilustración de torre para reemplazar `♖`).
2. `target-marker` (asset de objetivo para reemplazar `◎`).
3. Set de iconos de acciones (`reset`, `badge`, `score`, `loading`) para reemplazar emojis.

Prioridad Media:
1. Estados visuales por pieza bloqueada/deshabilitada (`bishop`, `knight`) con versiones `enabled/disabled`.
2. Texturas/overlays de highlight por casilla en perspectiva (en lugar de color plano por CSS).
3. Borde/brillo específico para casilla seleccionada y casilla objetivo, como arte dedicado.

Prioridad Baja:
1. Variantes de fondo por estado de fase (`ready/success/failure`) para feedback emocional.
2. Pack de badges/ranks para leaderboard y status strip.

## 5) Índice rápido de assets en `apps/web/public/art`

- `alfil-selected.webp`
- `bg-chesscito-play.avif`
- `bg-chesscito-play.png`
- `bg-chesscito-play.webp`
- `bg-chesscitov2.avif`
- `bg-chesscitov2.png`
- `bg-chesscitov2.webp`
- `bg-game.avif`
- `bg-game.png`
- `bg-game.webp`
- `bg-intro.png`
- `bg-splash-chesscito.avif`
- `bg-splash-chesscito.png`
- `bg-splash-chesscito.webp`
- `bg-splash.avif`
- `bg-splash.png`
- `bg-splash.webp`
- `caballo-selected.webp`
- `chesscito-board.png`
- `panel-frame-rune.avif`
- `panel-frame-rune.png`
- `panel-frame-rune.webp`
- `reward-glow.avif`
- `reward-glow.png`
- `reward-glow.webp`
- `shop-slot-frame.avif`
- `shop-slot-frame.png`
- `shop-slot-frame.webp`
- `torre-selected.webp`

