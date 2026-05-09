# Session Handoff — 2026-05-08 (M2 SHIPPED)

**Continúa de**: `2026-05-08-m1-shipped-handoff.md` (M1 closed earlier same day).
**Sesión**: greenfield design + build of `<CandyCard>` primitive (M2).
**Status**: SHIPPED to local `main`, **NOT yet pushed**. 6 commits ahead of `origin/main`.

## Lo que cerró esta sesión

6 commits atómicos en `main` (`316d371..9097f99`):

| # | SHA | Commit | Δ |
|---|---|---|---|
| 0 | `316d371` | `refactor(redesign): rename <PlayerCard> to <PlayerAvatar>` | +7/-7 (file rename + 1 importer) |
| 1 | `7204c94` | `feat(redesign): introduce <CandyCard> primitive with atmosphere prop + a11y wiring` | +252 (primitive + 19 tests + TODO marker) |
| 2 | `f35400b` | `style(redesign): add --candy-card-* tokens + atmosphere CSS to globals.css` | +116/-3 (tokens + rules + neutralizer + T19) |
| 3 | `1a19879` | `test(redesign): add CandyCard variant matrix (3 sizes × 3 atmospheres)` | +32 (9 describe.each tests) |
| 4 | `3407d57` | `docs(design): document <CandyCard> primitive in DESIGN_SYSTEM.md + Naming policy` | +76 (§15 + ui/card.tsx docstring) |
| 5 | `9097f99` | `docs(spec): M2 v1.2 SHIPPED — full evolution chain (v1.0 + v1.1 + v1.1.1 patches)` | +1911 docs (6 spec files) |

**Final state**:
- Vitest **1159/1159 passing** (1130 baseline + 29 new tests, exact target).
- Typecheck clean (no new errors beyond 2 M1 carryovers).
- Visual baselines 3/3 unchanged (no production surface consumes CandyCard yet — expected).
- Working tree clean.

## Spec evolution chain (audit trail)

Esta sesión repitió la disciplina M1 "PARA, escribe patch, re-corre red-team":

1. **Sally validation session** (UX agent in BMad mode) — locked atmosphere, slot map, frame default, size variants, JourneyRail boundary.
2. **v1.0 DRAFT** — initial SDD (16 tests, 8 open questions, 10 ACs).
3. **Red-team v1** (Plan agent in hostile-QA mode) — caught 3 P0s + 5 P1s. Critical findings:
   - Atmosphere mismatch: 5 stated migration targets all use `.candy-frame-amber/gold`, not `sheet-bg-hub` — Q1's "YAGNI defer" was wrong.
   - `frame="rune"` was structurally broken: composing `.candy-frame` onto `inset:0` overlay div paints yellow rectangle over body.
   - `<PlayerCard>` naming collision in same `redesign/` folder + shadcn `ui/card.tsx` slot vocab overlap.
4. **v1.1 patch** — 8 deltas folding all P0/P1 + Naming Policy section.
5. **Red-team v2 drift check** — caught 2 NEW P0s + 2 P1s introduced by v1.1:
   - `.candy-frame:active` press animation fires on `<section>` (any element with class `candy-frame`); presentational card would visually press-down.
   - Conditional `useId()` violates Rules of Hooks — would crash on title toggle.
6. **v1.1.1 micro-patch** — surgical 8-delta fix for both P0s + 2 P1s + 2 P2s + 2 ICs.
7. **v1.2 consolidated** — single source of truth for /tdd. 12 ACs, 29 tests, 6-commit plan.
8. **/tdd** — 6 atomic commits as planned.

**Total**: 5 P0s + 7 P1s caught BEFORE any production code. Cost bounded by discipline.

## Estado del repo

- **Branch**: `main`
- **Working tree**: clean
- **Commits ahead of origin**: **6** (push pending — needs explicit confirmation)
- **Build**: passing localmente. Vercel auto-deploy NO disparado todavía (no push).
- **Tests**: 1159/1159 unit + 3/3 visual baselines verdes.

## Lo que queda por decidir

**Inmediato**: ¿push a `origin/main`? Esto:
- Dispara Vercel auto-deploy de la última SHA.
- Hace visible la nueva primitiva en el árbol público (no consumida todavía por surfaces de producción).
- No es destructivo, pero sí visible-a-otros — por eso esta sesión lo dejó pendiente de confirmación.

**Próxima sesión (M3)** — primer surface migration que estrena `<CandyCard>`. Candidatos por orden de menor riesgo / mayor visibilidad:

| Candidato | Atmosphere actual | Atmosphere objetivo | Riesgo |
|---|---|---|---|
| `welcome-overlay.tsx` | `candy-frame-amber` | `<CandyCard atmosphere="amber">` | bajo (mostrado solo en first-visit) |
| `mini-arena-bridge-slot.tsx` | `candy-frame-amber` | `<CandyCard atmosphere="amber">` | bajo (afecta arena entry, ya tiene baselines) |
| `coach-welcome.tsx` | `candy-frame-gold` | `<CandyCard atmosphere="gold">` | medio (gated por `NEXT_PUBLIC_ENABLE_COACH`) |
| `daily-tactic-card.tsx` | `candy-frame-amber` | `<CandyCard atmosphere="amber">` | medio (en rotación diaria) |
| `coach-paywall.tsx` | mixed amber/gold | composición por card | alto (Pro upsell, revenue critical) |

Sugerencia: empezar por `welcome-overlay.tsx` o `mini-arena-bridge-slot.tsx` para validar el flow, escalar gradualmente.

**Carryovers no resueltos** (intencionalmente):
- CSS classes `.player-card-*` siguen igual aunque el React export es ahora `<PlayerAvatar>` (Δ3 v1.1 punt; ticket follow-up cuando alguien lo necesite).
- `<CandyGlassShell>` aún inlina el painting (TODO comment al M3 DRY refactor en `candy-glass-shell.tsx:34`).
- M3 (coach surface migration), M4 (editorial sweep + `<HelpChip>`), M5 (legal pages), M6 (Rowdies coverage) — no tocados; siguen pendientes per audit padre.

## MEMORY.md

`MEMORY.md` está al límite (244 líneas, límite 200). M2 NO lo expandió — la única referencia futura útil es el path del v1.2 spec, que ya queda en commit history. Si en la próxima sesión se decide consolidar memoria, candidatos: achievements + visual redesign histories.

## Cómo arrancar la próxima sesión

**Agente recomendado**: Claude Code default. Para M3 NO hace falta Sally — el design del primitive ya está locked; M3 es migración de un surface al primitive. Sí podría ser útil para validación visual de la primera migración (`welcome-overlay`) si quieres asegurar atmosphere amber se ve correcta on-device.

### Checklist antes de abrir la sesión

- [ ] `git pull` (si M2 fue pushed) — sino, decidir push primero.
- [ ] Vercel deploy del último push verde (si aplica).
- [ ] Reset opcional del contexto Claude Code para arrancar limpio.

### Prompt para pegar al inicio (próxima sesión)

```
Continúo el trabajo de Chesscito. M2 SHIPPED 2026-05-08
(commits 316d371..9097f99). <CandyCard> primitivo está disponible
en apps/web/src/components/redesign/candy-card.tsx.

Próximo paso: M3 — primera migración de surface al primitivo.
Sugerencia: welcome-overlay.tsx (atmosphere=amber, riesgo bajo).

Plan que sugiero replicar (mismo patrón M1/M2):
1. Spec v1.0 — escribe el SDD del migration (qué cambia en
   welcome-overlay.tsx, qué tests añadir, qué baseline re-bakear).
2. Red-team v1 — verifica claims contra el surface actual.
3. Patch a v1.1+ según P0/P1.
4. /tdd con commits granulares.

Antes de arrancar, lee:
- M2 v1.2 SHIPPED: docs/superpowers/specs/2026-05-08-m2-candy-card-design-v1.2.md
- DESIGN_SYSTEM.md §15 (CandyCard primitive contract)
- Handoff de hoy: docs/handoffs/2026-05-08-m2-shipped-handoff.md

Presenta plan SDD por fases, pídeme confirmación, y procede.
```

## Notas

- Esta sesión vio **2 vueltas de red-team** (M1 vio 3). Ambas atraparon P0s reales antes de TDD — la disciplina paga sola.
- Una observación recurrente: cada vez que el primer plan da por sentado *"composing existing CSS class X"*, el red-team encuentra una colisión. Si en M3 alguien propone "compose `.candy-frame` directly", revisar primero la regla `:active` y los z-stacks como hicimos aquí.
- `feedback_plan_before_edit.md` se cumplió: cada commit tuvo plan + confirmación previa.
- `feedback_execution_initiative.md` también: corrí vitest, typecheck, playwright sin pedir cada vez.

---

**TL;DR**: M2 SHIPPED localmente (6 commits, 1159 vitest passing). PUSH PENDIENTE — confirmar antes de empujar a origin. Próxima sesión = M3 (first migration of an existing surface a `<CandyCard>`; welcome-overlay candidato bajo riesgo).
