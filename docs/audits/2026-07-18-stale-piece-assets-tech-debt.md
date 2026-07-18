# Tech debt — referencias a piezas viejas (`/art/pieces/*`)

**Fecha:** 2026-07-18 · Detectado registrando el theme-builder (HUB).

## El problema
`/art/pieces/w-*` es el set de piezas **viejo** (variante del theme por env
`ASSET_THEME=default`, que en el app actual **nunca se activa** — ver `lib/theme.ts`). El set vivo es
`/art/redesign/pieces/*` (theme `candy`). El founder confirmó: **el app no debería servir piezas
distintas**; estas referencias deberían apuntar a `/art/redesign/pieces/*`.

**Actualización (2026-07-18):** ahora **SÍ se registran** en el theme-builder, pero marcadas
`deprecated` (badge ámbar "⚠ deprecated"). El founder decidió que ponerlas visibles en el catálogo
ayuda a **distinguir qué debería y qué no** usarse, y a actualizarlas rápido si hiciera falta —
mejor que esconderlas en un doc. Slots: `hub.mastery.piece.*` (y `board.legacy-bg` para el board
flat viejo). La corrección de fondo sigue siendo de **código** (repuntar al set vivo), no reemplazar
el arte; el badge es el recordatorio visible.

## Dónde se usa (a corregir)
| Componente | Línea | Referencia actual | Debería ser |
|---|---|---|---|
| `components/hub/mastery-tile.tsx` | 51–56 | `/art/pieces/w-{rook,bishop,knight,pawn,queen,king}.webp` | `/art/redesign/pieces/w-*` |

## Acción pendiente
- Repuntar `mastery-tile.tsx` a `/art/redesign/pieces/w-*` (o a `THEME_CONFIG.piecesBase`), verificar
  visualmente el mastery tile, y luego **eliminar** `/art/pieces/*` del repo si no queda ningún
  consumidor (grep `\"/art/pieces/`).
- Una vez migrado, las piezas quedan cubiertas por los slots existentes `board.piece.white.*` (mismo
  archivo) — no hacen falta slots nuevos.

**Relacionado:** [[project_theme_catalog_decisions]] · [[feedback_grep_audit_misses_composed_paths]].
