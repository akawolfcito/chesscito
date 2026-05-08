# How to start the NEXT session — TDD on M1

**Context**: hoy cerramos credit-shield-server-side, fixes B1+B2,
Sally's UX audit, M1 spec + red-team v1 + spec patch v1.1. Todo
en `main`, todo pushed, Vercel desplegado.

**Próximo paso**: TDD sobre M1 — `/exercises` migration to canonical
primitives.

## Checklist antes de abrir la próxima sesión

- [ ] Asegúrate de estar en branch `main` y al día (`git pull`).
- [ ] Verifica que el último deploy de Vercel está verde.
- [ ] (Opcional pero recomendado) reset del contexto de Claude
      Code para arrancar limpio — no traer fatiga de la sesión
      previa.

## Cómo arrancar

**Agente recomendado**: Claude Code default. **NO** invoques a
Sally para TDD — su persona es para conversaciones de
arquitectura UX, no para implementación. La fase TDD es
mecánica; el spec + red-team ya hicieron la decisión-pesada.

## Prompt para pegar al inicio de la sesión

```
Continúo el trabajo de Chesscito. Hoy es TDD sobre M1 (/exercises
migration to canonical primitives).

Inputs:
- Spec v1.1: docs/superpowers/specs/2026-05-08-m1-exercises-migration-design.md
- Red-team v1: docs/superpowers/specs/2026-05-08-m1-exercises-migration-redteam.md
- Handoff de cierre: docs/handoffs/2026-05-08-next-session-start.md
- Audit padre (gitignored, local): _bmad-output/planning-artifacts/ux-design-application-audit-2026-05-08.md

El spec está en estado v1.1 READY for /tdd después de aplicar 3
P0 + 2 P1 corrections del red-team. Verdict explícito.

Quiero que invoques /tdd con scope M1 y arranquemos siguiendo el
mismo patrón que usamos hoy con credit-shield-server-side: SDD
phase (extender los primitivos primero — PrimaryPlayCta size="pin"
+ tone="claim" + badge slot, MissionRibbon surface="exercises") +
TDD por commits atómicos según la PR shape del spec (8 commits
estimados).

Caveat importante: el audit padre tiene §0 Corrections sobre que
<CandyBanner> NO es card primitive (es sprite-renderer de botones).
Eso afecta M2/M3 pero NO bloquea M1 — M1 sólo depende de
HudResourceChip + PrimaryPlayCta + MissionRibbon (todos ya
construidos).

Antes de arrancar, presenta el plan TDD por fases (igual que hoy
hicimos con A→G en credit-shield), pídeme confirmación, y
después procede con la primera tarea.
```

## Lo que esperar en esa sesión

**Estimado**: 8-10 commits atómicos, ~350 LOC neto, una sesión
focalizada (no tan larga como la de hoy — el spec ya está
planeado).

**Riesgos que el spec ya identifica**:
- Mission-panel density con la ribbon nueva (open question §2 —
  resolución vía screenshot review en el primer commit).
- DOM snapshot drift en /hub o /arena al extender PrimaryPlayCta
  (AC11b cubre esto explícitamente).
- Visual regression — el spec pide nuevas baselines para
  /exercises pero no toca /hub (AC11a).

## Si algo se rompe

- El spec tiene §"Open questions resolved post-red-team" — leer
  primero.
- Si encuentras una pieza que el spec no cubre: PARA, escribe
  v1.2 patch, vuelve a correr red-team. NO improvisar durante
  TDD — fue exactamente la lección que cerramos hoy con
  CandyBanner-no-es-card.

## Si quieres invocar a Sally durante TDD

Solo si encuentras una decisión visual ambigua que el spec no
resolvió. Comando:

```
/sally — necesito tu juicio sobre [problema visual concreto].
Spec referencia: docs/superpowers/specs/2026-05-08-m1-exercises-migration-design.md
```

No la invoques para preguntas técnicas (typecheck errors, test
mocks, etc.) — para eso, Claude default es mejor.

## Después de M1

El plan ordenado del audit es: **M1 → (revisar M2 spec — la
correction sobre CandyBanner-no-es-card cambió el alcance) → M3
→ M6 (paralelo) → M4 → M5**.

M2 ya no es "extend CandyBanner". Ahora es "design + build the
card primitive — none exists in the codebase today". Necesita
spec nuevo antes de TDD. Esa es la primera tarea de la sesión
DESPUÉS de M1.

---

**TL;DR**: abre Claude Code default, pega el prompt de arriba,
todo listo. Spec v1.1 está READY.
