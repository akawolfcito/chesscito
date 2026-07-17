# Session Handoff — 2026-07-17

> Decí **"continuemos"** y el agente lee este archivo y sigue.

## Completed
- **Builder kind-aware, etapas 2a + 2b** (spec `docs/specs/2026-07-17-builder-kind-aware.md`).
  `main` = `0c06d155`, pusheado. Suite **5410 passing / 459 files**, `tsc` limpio.
  - **2a** (`e8d6c99`) — rename type-only `ContentKind` → `ContentBucket`, 7 archivos. El
    campo `kind` de los bodies de red NO se tocó; solo la anotación de tipo.
    ⚠️ commiteado directo sobre `main` (rompí el patrón `--no-ff`; reversible).
  - **2b** (`fb5ac36` + `e69b3a9`, merge `0c06d155` `--no-ff`) — el kind sobrevive el
    round-trip. Eran **DOS pérdidas independientes**, no una:
    1. `readBaselineRecords` pisaba el kind real con el bucket (`{...r, kind}`).
    2. `BUILDER_FIELDS` listaba `"kind"` → `extraFields` lo excluía → Save lo omitía.
    Arreglar solo una NO alcanzaba. `BucketedRecord` separa los ejes; `root` inyectable
    para round-trip sobre los 15 records reales sin tocar el working tree; `extraFields`
    extraído de `page.tsx` a `state.ts` (invariante testeable). Ambos fixes verificados
    load-bearing. Cubre AC-2, AC-3, AC-6, AC-10.

## Current State
- **Branch**: `main` (rama `feat/builder-kind-aware-stage-2b` ya borrada, mergeada)
- **Build**: passing — 5410/459, `tsc` limpio (`pnpm -C apps/web`)
- **Uncommitted work**: no — árbol limpio, `main` == `origin/main`
- **Remotas**: `origin/main` + `origin/production` (branch protection activa en ambas)

## Next Tasks
1. **Etapa 3 — UN validador** (el P0 más jugoso). Hoy hay DOS: `validateBuilder` gatea el
   Save pero `buildCatalog` decide de verdad, y **ya divergen** (diagonal-run: uno warning,
   `catalog.ts:212` error). Hacer que `validateBuilder` DELEGUE en `buildCatalog` + test de
   equivalencia por kind (AC-5). ⚠️ **MEDIR el costo en vivo**: ~260ms/catálogo completo,
   corre en CADA cambio de estado → posible debounce (los solvers de queens/tour NO medidos).
   Lint del alfil + `promoteTo` salen gratis. Empezar en sesión fresca (la medición es donde
   esta línea de sesiones ya se equivocó 2× → [[feedback_a_probe_that_ignores_the_ui_measures_nothing]]).
2. **Etapa 4** — Diagonal Run editable (casi gratis, ya era capaz).
3. **Etapa 5** — Queens/Tour/Promotion Run: `KIND_CAPABILITY` + goal opcional + `promoteTo`
   (AC-7, el flujo que hoy destruye queens end-to-end).

## Blockers
- Ninguno para arrancar la etapa 3.

## Notes
- ⛔ **2b está verde PERO el builder sigue destruyendo safe-path.** `page.tsx:317` hace
  `enemies: rec.piece === "pawn" ? derived.enemies : []` al cargar → un load→save de safe-path
  **borra su amenaza entera** (el caballo que ES el juego). El kind ahora sobrevive; las
  amenazas NO. **El builder aún NO es seguro para juegos firma.** `isThreatKind` YA existe
  (`fen-puzzle.ts:130`), el spec lo ubica en etapa 5/6. → [[project_builder_only_knows_two_kinds]]
- Mi test de AC-2 mide el camino de la LIB (read→write), NO el de la UI
  (read→derive→buildFenBlock→write). Por eso pasa a pesar de la pérdida de enemies de arriba.
- **Frontera de nombres**: los dev surfaces hablan `bucket`; el contrato de `admin` (input
  con token) conserva `kind` en el wire. El mapeo vive en UN solo seam, comentado, en
  `publish/route.ts` y `promote/route.ts`. No "arreglar" el admin: está fuera de alcance.
- Comentario stale a corregir cuando se toque enemies: `state.ts:27` dice "etapa 2 of the
  spec" para la política pawn-only de enemies — ya no es la 2.
- Deuda ajena NO tocada (a propósito): `promote/route.ts:8` usa `revalidateTag(tag)` de 1
  arg, deprecado en Next 16 (repo es Next 14, no aplica aún). Los hooks de Vercel la insisten.
- Deploys los verifica el founder, visualmente → [[feedback_deploy_verification_is_the_founders]].
