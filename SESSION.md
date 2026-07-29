# Session Handoff — 2026-07-29

> 📌 Detalle: `docs/handoffs/2026-07-29-celebration-overlay-handoff.md`
> Este archivo es el checklist.

## Completed

- `bd5866e8` — **`ArchedHeadline` reconstruido sobre SVG `<textPath>`**. Las letras
  dejaron de montarse y el arco es un círculo real. La versión anterior rotaba cada
  glifo sobre su propio pie (desplaza el tope ~`alto·sinθ`) y sacaba el ángulo del
  ÍNDICE mientras la x venía del ancho real → se montaba y se leía triangular.
- `f7194278` — **borde del cartel en 5 capas**: sombra dura → extrusión naranja →
  dorado → keyline rojo → crema. El rojo bajó a `0.10em` para que el dorado lidere.
- `142483ee` + `0d76f46f` — **layout del `PhaseFlash`**: caja de lección de 2 líneas
  fija, cero margen negativo, ancho fijado por el wrapper.
- `677de3ad` — avatar de celebración a 13.5rem.
- `7abe55e8` — **`docs/design-patterns/full-screen-surface-taxonomy.md`**
  (overlay vs modal) + el audit anterior derogado con su corrección arriba.

## Current State

- **Branch**: `main` (local; `origin/main` lo pushea el founder)
- **Build**: 6548 passing / 555 files · EXIT=0 · typecheck limpio
- **Uncommitted work**: no

## Next Tasks

1. **Extraer `CelebrationStack`.** Los dos overlays repiten la composición a mano y
   **ya divergieron en esta sesión**: `daily-tactic-sheet.tsx:336` conservó el
   `-mb-6` y el avatar `h-80`, así que hoy el titular del Daily pisa la cabeza del
   lobo. Extraer cierra la divergencia como efecto secundario.
2. Decidir si Mini-Arena / Welcome / Focus Day / Unlock reciben probe `/dev`.
3. Backlog vivo (`docs/backlog/2026-07-10-backlog-index.md`): decoder de custom
   errors · PLAY #8 (confirmación redundante de LUZ) · §4 `/api/sign-badge` firma
   cualquier `levelId` sin verificar estrellas.

## Blockers

- Ninguno.

## Notes

- **El arco tiene techo de ~12 caracteres** a 13vw. `Training Complete!` (18) no
  entra sin achicarlo hasta que deja de leerse como cartel.
- **`.arena-result-title` NO es "el titular de celebración"**: 14 call sites,
  incluidos los **precios** de Peones y los errores de transacción. Nunca migrar
  por clase — call site por call site.
- **Los probes `/dev` viven en preview** (29 de 30 gatean por `VERCEL_ENV`; sólo
  `board-procedural` sigue con `NODE_ENV`). Se abren desde el celular con la URL
  del deploy — la nota vieja que decía lo contrario ya está corregida.
- Método que funcionó: banco HTML + Playwright a 390px con la fuente real, iterar
  ahí, portar al componente después.
