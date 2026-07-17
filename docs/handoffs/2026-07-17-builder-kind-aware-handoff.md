# Handoff — builder-kind-aware COMPLETO (2026-07-17)

Spec: `docs/specs/2026-07-17-builder-kind-aware.md`. Las 9 sub-etapas (0, 1, 2a, 2b, 3, 4, 5, 6, 7)
están en `main`. El `/dev/labyrinth-builder` dejó de destruir juegos firma en silencio.
(Este doc reemplaza el handoff de etapas 0/1; ese detalle vive en git.)

## Estado
- **`main`** — árbol limpio, pusheado. **Suite 5452 passing / 464 files, `tsc` limpio.**
- El builder es **kind-aware y seguro para los 6 juegos firma**: se cargan, editan y guardan sin
  perder su kind ni sus enemigos tipados. Safe Path es `editable:true` con pincel de negro tipado.

## Qué cerró esta línea de sesiones (etapas 3–7 + UX)
- **3 — UN validador**: `validateBuilder` delega en `buildCatalog` (`validate.ts`), test de
  equivalencia AC-5 (`validate-equivalence.test.ts`). Medido el costo en vivo: real <5ms,
  queens-disperso ~73ms.
- **4 — Diagonal Run editable**: no requirió código (2b+3 ya lo habilitaron); fijado con
  `diagonal-run-editable.test.ts` (mide pivot 1/2/2 vs free-bishop 2/3/3, load-bearing).
- **5 — `KIND_CAPABILITY`** (`authoring.ts`) + gate editable + selector `promoteTo` + goal opcional.
  AC-7: `save-preserves-kind.test.ts` (camino real de guardado, no el atajo de la lib).
- **6 — Lienzo**: overlay de amenazas al pintar (AC-9, `watchedSquares` == `attackedSquares`) +
  Preview (`components/dev/builder-preview.tsx`) que monta el board real del kind. `validateBuilder`
  expone `result.preview`. SIN cambios a los boards.
- **7 — Safe Path**: `editable:true`, loader conserva enemigos tipados (`isThreatKind`), pincel
  tipado con sprite negro `b-{piece}.png`.
- **UX**: layout desktop — tablero fijo + panel derecho con scroll propio y más ancho.

## Workflow de contenido (VERIFICADO en código)
Editar en `/dev/labyrinth-builder` **local** → **Save** (escribe `content/*.json` **Y**
`puzzles.generated.ts` vía `writeBaselineRecord`) → `git add -A` los dos → commit → merge → deploy.
- `pnpm import-puzzles` SOLO para editar el JSON a mano.
- Save es **solo-local** (fs de Vercel read-only); `/dev/*` 404ean en prod.
- Jugadores leen el módulo compilado, NO `content/*.json`. El overlay de Supabase ("promote to
  publish") **no lo leen jugadores todavía** (Phase 2b/2c).

## Next / open
- **Debounce de queens** si el founder reporta stutter autorando (queens-disperso ~73ms). Va en
  `page.tsx`, NUNCA un segundo validador.
- **Footer de acciones fijo** en el builder (Save/publish siempre visibles abajo) — mockup del
  founder, diferido; el scroll independiente ya resolvió el 80%.
- Frentes fuera de este cluster: `/api/sign-badge` (gate 10★ client-only), Belt System, duelo por
  enlace → ver `project_current_state` en memoria y `docs/product/2026-07-13-direction-where-we-are.md`.

## Verificación
- Automática: suite + `tsc` verdes. AC-7/8/9 con tests de lógica/integración (no Playwright).
- **Visual (founder):** el layout y "el tap juega en Preview / pincel tipado" los confirma a ojo.
