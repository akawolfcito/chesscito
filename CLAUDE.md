# Chesscito — CLAUDE.md

## Proyecto
Juego pre-ajedrecístico educativo en la red Celo, distribuido via MiniPay.
Enseña movimientos de piezas de ajedrez con mecánicas gamificadas on-chain.

## Stack
- **Monorepo**: Turborepo + pnpm
- **App principal**: `apps/web` — Next.js 14 App Router + TypeScript
- **Estilos**: Tailwind CSS + clases custom en `globals.css`
- **Blockchain**: Celo / MiniPay

## Distribución: Mobile-First via MiniPay
- Ancho máximo de app: `390px` (`--app-max-width`)
- **Desktop no es prioridad** — si algo no se ve bien en desktop, NO tocarlo
- Todo se diseña y prueba en viewport móvil

## Arquitectura de tablero
- Imagen del tablero: `apps/web/public/art/chesscito-board.png`
  - Vista **plana/ortográfica** desde arriba (8x8 cuadros uniformes)
  - Aspect ratio: 1/1 (1024×1024)
- Componente: `apps/web/src/components/board.tsx`
- Hit-grid: `.playhub-board-hitgrid` con `inset: 4.9% 4.4% 3.6% 4.6%`
- Pieza actual: Torre (♖) — lógica en `apps/web/src/lib/game/board.ts`

## Clases CSS del tablero (`globals.css`)
- `.playhub-board-canvas` — contenedor con la imagen de fondo
- `.playhub-board-hitgrid` — capa de interacción sobre la imagen
- `.playhub-board-cell` — casilla individual (botón)
- `.playhub-board-cell.is-highlighted` — casilla con movimiento válido
- `.playhub-board-cell.is-selected` — casilla seleccionada
- `.playhub-board-label` — etiqueta de coordenada (a1–h8)
- `.playhub-board-dot` — punto indicador de movimiento válido
- `.playhub-board-piece` — pieza en el tablero

## Arte / Assets
- `bg-game.png/webp` — fondo general de la pantalla de juego
- `chesscito-board.png` — tablero plano teal/verde 8x8
- `bg-playhub-forest-mobile.png` — fondo del play-hub móvil
- `panel-frame-rune.png`, `shop-slot-frame.png` — marcos UI

## Seguridad — Reglas Duras
- **NUNCA** commitear ni mostrar en pantalla: `.env`, private keys, API keys, seeds, credenciales, datos personales, ni nada dentro de `private/`
- **NUNCA** imprimir, loguear ni mostrar en output de terminal: tokens, service role keys, connection strings, passwords, ni cualquier secreto — ni siquiera parcialmente
- **NUNCA** stagear archivos sensibles — siempre revisar `git diff --staged` antes de commitear
- **NUNCA** usar `NEXT_PUBLIC_` para claves de servicio (Supabase service role, signer keys, etc.) — solo server-side
- Usar `.env.template` como referencia pública; los valores reales van solo en `.env` (gitignored)
- Si accidentalmente se expone un secreto: alertar al usuario para rotar inmediatamente, no solo eliminarlo del historial
- Supabase: `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son server-only — jamás exponerlos al cliente

## Convenciones
- Commits: Conventional Commits (`feat:`, `fix:`, `style:`, `refactor:`)
- Firma de commit: `Wolfcito 🐾 @akawolfcito`
- Tests: Vitest + RTL (unit) + Playwright (E2E + VR); 1727 passing baseline (2026-05-21)
- Idioma de UI: English (ver `lib/content/editorial.ts`)

## Cluster Closure Protocol

Cuando un cluster / feature / spec termine y haga merge a `main`, ejecutar este checklist antes de pasar al siguiente:

1. **GitHub housekeeping**
   - Cerrar issues asociados al cluster
   - Cerrar milestone si todos sus issues están `closed`
   - Reasignar issues que sobreviven al milestone correcto
2. **README sync** — si la sección "What's live" cambió:
   - Actualizar tabla de contracts (mainnet addresses)
   - Actualizar tagline + bullets de features
   - Actualizar Tech Stack si hay layer nuevo
3. **MEMORY.md sync** — actualizar índice con estado final del cluster
4. **Branch hygiene** — borrar branches mergeadas en origin (verificar `git log origin/main..origin/<branch>` antes)
5. **Handoff doc** — escribir `docs/handoffs/YYYY-MM-DD-<topic>-handoff.md` con estado, próximos pasos y open questions

Sin este protocolo, la documentación deriva del estado real y el repo acumula ruido visible (branches stale, issues abiertos, README desactualizado).
