# Chesscito — AGENTS.md

## Proyecto
Juego pre-ajedrecístico educativo en la red Celo, distribuido via MiniPay.
Público objetivo: personas de 18 años o más.
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
- Main es la fuente única de código vigente. Si se conserva production, debe apuntar al mismo commit. Los deployments son manuales; publicar Git no autoriza un deployment.
- Antes de desplegar cualquier feature, consultar la [guía canónica de topología de deployment](docs/ops/deployment-topology.md).
- Commits: Conventional Commits (`feat:`, `fix:`, `style:`, `refactor:`)
- Firma de commit: `Wolfcito 🐾 @akawolfcito`
- Existen pruebas automatizadas. Ejecutar las comprobaciones adecuadas a los cambios; usar entornos locales sin credenciales para las pruebas.
- Idioma de UI: English (ver `lib/content/editorial.ts`)
- Los informes detallados de seguridad/privacidad, hallazgos pendientes, evidencia y procedimientos sensibles se guardan fuera del repositorio, en un directorio local de acceso restringido (por ejemplo, `../chesscito-confidential/`). No publicar ese material en commits, PRs, issues, logs ni artefactos de deployment.
- En el repositorio solo se permite un resumen Markdown revisado y sanitizado: estado general y checklist sin rutas vulnerables, instrucciones de explotación, evidencia privada ni detalles de fallas aún no publicadas de forma coordinada.
- Antes de compartir correcciones de seguridad, revisar también mensajes e historial de commits, tests y scripts. Borrar un archivo o añadirlo a `.gitignore` no elimina su historial. No reescribir historia compartida ni cambiar la visibilidad del repositorio sin aprobación explícita.
- Los demás análisis extensos pueden guardarse como Markdown en el repositorio tras revisar su contenido para publicación.
