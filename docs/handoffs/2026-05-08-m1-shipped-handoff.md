# Session Handoff — 2026-05-08 (M1 SHIPPED)

**Continúa de**: `2026-05-08-next-session-start.md` (entry guide for TDD).
**Sesión**: TDD sobre M1 — `/exercises` migration to canonical
primitives. **Status**: SHIPPED, pushed to `main`, deploy de Vercel
debe correr en automático.

## Lo que cerró esta sesión

8 commits atómicos en `main` (`4b79948..01e8e0e`):

| # | SHA | Commit | LOC |
|---|---|---|---|
| 1 | `4b79948` | `feat(redesign): introduce <ActionPin> primitive with full test matrix` | +555 (24 tests) |
| 2 | `8aeb7b9` | `feat(editorial): add MISSION_RIBBON_COPY.exercises fallback string` | +4 |
| 3 | `83430ac` | `feat(pro-mission): add text override prop + exercises surface to MissionRibbon` | +38 (3 tests) |
| 4 | `7d7a3b2` | `feat(exercises): add HudResourceChip shield row to MissionPanelCandy` | +25 |
| 5 | `31feb7b` | `feat(exercises): add MissionRibbon pieceHint row to MissionPanelCandy` | +12 |
| 6 | `ed3d7fc` | `refactor(exercises): migrate ContextualActionSlot to <ActionPin> (all 6 actions)` | -71 net |
| 7 | `d46e362` | `test(e2e): re-baseline hub-clean for /exercises post-M1 migration` | (binaries) |
| 8 | `01e8e0e` | `docs(spec): M1 v1.3 SHIPPED — full evolution chain (v1.2/v1.4 patches + redteam v2/v3)` | +1179 docs |

**Final state**: vitest 1130/1130 passing. Typecheck sin nuevos errores
(2 pre-existentes en `use-shop-sheet-state.ts` y `private/` carryover,
unrelated). 6 Playwright baselines verdes (1 desktop + 1 minipay
re-bakead, 4 sheet baselines unchanged).

**Visual confirmado** vía screenshot review:
- Shield chip "0" (HudResourceChip persistente) top-right
- "Straight lines" ribbon (MissionRibbon `surface="exercises"` con
  runtime `pieceHint`) entre el chip row y el board
- Slot migrado a `<ActionPin>` para los 6 actions

## Spec evolution (audit trail)

Esta sesión ejercitó la disciplina "PARA, escribe patch, re-corre
red-team" tres veces:

1. **v1.1 → v1.2 patch** (post-SDD discovery): `<PrimaryPlayCta>` es
   sprite-asset-driven, no un primitivo genérico extensible. Pivot a
   nuevo `<ActionPin>` primitive.
2. **red-team v2** (post-v1.2): catch 2 P0s — `<MissionRibbon>` no
   acepta copy como prop (carryover de v1.1, mismo class que
   CandyBanner-no-es-card); `<ActionPin>` debe split `isBusy`/`disabled`.
   Plus 5 P1s. Verdict: NEEDS REVISION.
3. **v1.3 consolidado** (mergea v1.1 + v1.2 + redteam v2). Lock todas
   las open questions.
4. **red-team v3** (drift check): 0 drift, 9/9 prescriptions folded,
   5/5 independent checks pass. READY for /tdd.
5. **v1.4 patch** (mid-TDD discovery on commit 4): v1.3 §"Behavior 1+3"
   asume chip-row + ribbon-row que no existen en `<MissionPanelCandy>`.
   Reframes AC1 + AC4 como ADDs (nuevas filas), no refactors. Lock
   placement (right-aligned, always-rendered, between row-2 y L2-toggle).

Lección: improvising mid-TDD sigue siendo el riesgo principal —
3 patches escritos en lugar de 0. Total cost was bounded by the
discipline (cada patch cerró el gap antes de tocar código broken).

## Estado del repo

- **Branch**: `main`
- **Working tree**: clean
- **Commits ahead of origin**: 0 (acabamos de hacer push)
- **Build**: passing localmente. Vercel auto-deploy en curso del
  último commit pushado.
- **Tests**: 1130/1130 unit + 6/6 Playwright visual baselines verdes.

## Pendientes

**Inmediato (próxima sesión)**: M2 — diseñar y construir `<CandyCard>`
primitive. Este es el primer ítem post-M1 según la corrección §0 del
audit padre.

**Caveat importante** (carryover de la sesión 2026-05-08 anterior):

> M2 ya no es "extend CandyBanner". Ahora es "design + build the card
> primitive — none exists in the codebase today". Necesita spec nuevo
> antes de TDD. Esa es la primera tarea de la sesión DESPUÉS de M1.

`<CandyBanner>` es un sprite-asset renderer (acepta `name="btn-back"`
etc., renderiza `<picture>` con AVIF/WebP/PNG fallbacks). NO es un
primitivo de card. La cita del audit ("CandyBanner is the evolution of
FrameCraftCard") era incorrecta — descubierto en red-team v1.

Por lo tanto M2 es greenfield: hay que diseñar `<CandyCard>` desde
cero. El primitivo NO existe en el codebase hoy.

**Roadmap ordenado** (post-M1):

1. **M2**: build `<CandyCard>` primitive (spec nuevo + red-team + TDD)
2. **M3**: coach surface migration (espera M2 si depende de la card)
3. **M6**: Rowdies coverage audit (paralelo, no bloquea)
4. **M4**: editorial micro-copy sweep + `<HelpChip>` introduction
5. **M5**: legal pages migration

## Cómo arrancar la próxima sesión

**Agente recomendado**: Claude Code default. Para M2 hay decisiones
visuales/canon (¿qué slots tiene una card? ¿atmosphere variants?
¿candy-frame integration?) — Sally es óptima como consultora durante
la fase de spec, pero NO la invoques para TDD.

### Checklist antes de abrir la sesión

- [ ] Branch `main` al día (`git pull`)
- [ ] Vercel deploy del último push verde
- [ ] (Opcional) reset del contexto de Claude Code para arrancar limpio

### Prompt para pegar al inicio

```
Continúo el trabajo de Chesscito. M1 SHIPPED 2026-05-08
(commits 4b79948..01e8e0e). Próximo paso: M2 — diseñar y
construir el primitivo <CandyCard>.

Contexto del audit padre (gitignored, local):
_bmad-output/planning-artifacts/ux-design-application-audit-2026-05-08.md
§0 Corrections — <CandyBanner> es sprite-asset renderer, NO un
primitivo de card. M2 es greenfield (no "extend CandyBanner").

Plan que sugiero replicar (mismo patrón que M1):
1. Spec v1.0 — escribe SDD del API de <CandyCard> (slots, atmosphere,
   candy-frame integration), behavior, ACs, test plan.
2. Red-team v1 (lanza Plan agent en hostile-QA) — verifica claims
   contra primitivos existentes en components/redesign/, busca
   contract gaps + hidden assumptions.
3. Patch a v1.1+ según P0/P1.
4. Red-team v2 (drift check) si hubo cambios estructurales.
5. /tdd con commits granulares per AC.

Antes de arrancar, lee:
- M1 v1.3 SHIPPED: docs/superpowers/specs/2026-05-08-m1-exercises-migration-design-v1.3.md
- Audit chain: docs/superpowers/specs/2026-05-08-m1-exercises-migration-redteam-v3.md
- Handoff de hoy: docs/handoffs/2026-05-08-m1-shipped-handoff.md
- Primitivos existentes: apps/web/src/components/redesign/

Presenta plan SDD por fases, pídeme confirmación, y procede.
```

## Notas

- **MEMORY.md está al límite**: 244 líneas (límite 200). Considerar
  consolidar entradas viejas (especially achievements + visual redesign
  histories) en una próxima sesión.
- La feedback memory `feedback_plan_before_edit.md` se cumplió esta
  sesión: cada commit tuvo plan+confirmación previa.
- La feedback memory `feedback_execution_initiative.md` también: corrí
  vitest, typecheck, playwright, dev server background sin pedir cada
  vez (eran idempotent + safe).
- Si en la próxima sesión cambia la lista pendiente o aparece bloqueo
  externo, actualiza este handoff o crea uno nuevo en
  `docs/handoffs/`.

---

**TL;DR**: M1 SHIPPED, push hecho, M2 es greenfield (CandyCard nuevo,
no extender CandyBanner). Pega el prompt de arriba para arrancar la
próxima sesión.
