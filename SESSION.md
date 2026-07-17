# Session Handoff — 2026-07-17

> Decí **"continuemos"** y el agente lee este archivo y sigue.

## Completed — spec `builder-kind-aware` COMPLETO (etapas 0–7 en `main`)
El `/dev/labyrinth-builder` es kind-aware y **seguro para los 6 juegos firma**. Detalle:
`docs/handoffs/2026-07-17-builder-kind-aware-handoff.md`.
- **3** un validador (`validateBuilder` delega en `buildCatalog`, AC-5) ·
  **4** Diagonal Run editable (test load-bearing) ·
  **5** `KIND_CAPABILITY` + `promoteTo` + goal opcional (AC-7) ·
  **6** overlay de amenazas (AC-9) + Preview del board real (AC-8) ·
  **7** Safe Path editable + pincel de negro tipado.
- **UX**: layout desktop (tablero fijo + panel derecho con scroll propio).

## Current State
- **Branch**: `main`, árbol limpio, pusheado.
- **Build**: **5452 passing / 464 files**, `tsc` limpio.
- **Remotas**: `origin/main` + `origin/production` (branch protection en ambas).

## Workflow de contenido (para editar ejercicios/juegos del LEARN)
Editar en `/dev/labyrinth-builder` **local** → **Save** (escribe `content/*.json` **Y**
`puzzles.generated.ts`, automático) → `git add -A` los dos → commit → merge → deploy.
`pnpm import-puzzles` solo si editás el JSON a mano. Save es solo-local (fs de Vercel read-only).

## Next Tasks (ninguna urgente — cluster cerrado)
1. **Debounce de queens** en `page.tsx` SI el founder reporta stutter autorando (queens-disperso
   ~73ms/validación). Nunca un segundo validador.
2. **Footer de acciones fijo** en el builder (mockup del founder, diferido).
3. Frentes fuera del cluster: `/api/sign-badge` (gate 10★ client-only), Belt System, duelo por
   enlace → `project_current_state` en memoria + `docs/product/2026-07-13-direction-where-we-are.md`.

## Blockers
- Ninguno.

## Notes
- Deploys los verifica el founder, visualmente.
