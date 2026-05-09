# Session handoff — Hub Redesign Phase 1 design-lock + red-team (2026-05-09)

**Continúa de**: `2026-05-09-sprint-4-arc-handoff.md` (cerró Sprint 4 + 4E discovery; Phase 1 design-lock pendiente)
**Sesión**: Phase 1 design-lock spec drafted + Phase 2 red-team review + 6 P0 patches landed
**Status**: 2 nuevos specs en `docs/superpowers/specs/`, ambos sin commit aún. Working tree solo con esos 2 archivos untracked. Suite no se corrió (no se tocó código).

## Lo que cerró esta sesión

### Phase 1 — Design-lock spec (Sally, una sesión densa)

13 secciones prescriptivas cubriendo todas las locked decisions del discovery §12 (Z-revised + Splash A + Mastery D + Training C + flag B + ports during + +20% budget). Estructura:

| § | Sección | Highlights |
|---|---|---|
| 0 | Reading order + scope | Pin a discovery §12, gate a Phase 2 antes de tocar código |
| 1 | Layouts box-by-box | 5 zonas dimensionadas a 390 px (splash, HUD top, mastery 2×3, dock, training band) |
| 2 | Copy completo | 4 nuevos editorial objects: `HUB_V2_SPLASH_COPY`, `HUB_V2_MASTERY_COPY`, `HUB_V2_TRAINING_COPY`, `HUB_V2_DOCK_COPY` |
| 3 | Asset manifest | 178 KB exact-fit (148 reuse + 30 nuevos: warm-wood texture + wax-seal SVG + splash hero) |
| 4 | Motion timing | Tokens existentes (snap/enter/ceremony/spring); cero nuevos |
| 5 | Telemetry | 14 eventos `hub_v2_*` + atmosphere shift + splash + legacy redirect |
| 6 | Heavy ports plan | Orden ProSheet → BadgeSheet → ShopSheet con preserve-testids |
| 7 | Flag mechanics | `?hub=v2` server-side, `[data-hub-v2]` body namespace, 4 promote criteria, rollback playbook ≤3 commits |
| 8 | DESIGN_SYSTEM §16.7 amendment | Wording exacto: "PrincipalButton merits ceremony wherever it appears — canvas, dock, modal" |
| 9 | TDD plan | 9 nuevos test specs fail-first (~40-50 cases), suite +7 net |
| 10 | Phase exit checklist | Phases 1/2 marcados; Phase 7 con contrast gate añadido |
| 11 | Open items / risks | 7 ítems para red-team |
| 12 | Scope refinado | 18 commits (vs discovery 28-30) por reuse de scene-rooted primitives |

### Phase 2 — Red-team review (Winston, lente cínico)

3 lentes adversariales paralelos: arquitectura, edge cases, acceptance audit. Total **44 findings deduped a 36** + 1 falso positivo:

| Severidad | Count | Disposición |
|---|---|---|
| **P0** — bloquea Phase 3 | **6** | Patcheados esta misma sesión |
| **P1** — fix durante impl | **13** | Anotados como deliverables en §10 phase exit |
| **P2** — track as risk | **17** | Pendientes de fold al §11 risks register |

P0 destacados:
- **P0-1 (material gap)**: `<TreasureTile size="medium">` no existe (solo `small | large` en DESIGN_SYSTEM §16.1). Sally reescribió §1.3 con `size="small"` y recalculó grid math (320 px content + 70 px buffer).
- **P0-3 (WCAG-blocker)**: splash auto-dismiss a 3.5s viola WCAG 2.2.1 (Timing Adjustable). Sally reescribió §1.1 a tap-only con dismiss-hint que fade-in tras la entrance; localStorage flag sigue previniendo re-show.
- **P0-5 (contract gap)**: cómo ProSheet señala compra exitosa al hub para atmosphere shift estaba undefined. Winston añadió §6.4 con typing `onPurchaseSuccess` + race-condition guidance.

### P0 patches (6/6 landed)

| # | Owner | Sección |
|---|---|---|
| P0-1 mastery grid | Sally | §1.3 (TreasureTile small + 320 px math) |
| P0-2 splash asset | Sally | §1.1 (clarify new hero asset, not reused sprite) |
| P0-3 splash WCAG | Sally | §1.1 + §4 (tap-only dismiss + retiming) |
| P0-4 atmosphere contrast | Winston | §1.5.1 (new) + §10 (Phase 7 gate) |
| P0-5 sheet callback | Winston | §6.4 (new) — `onPurchaseSuccess` typed |
| P0-6 searchParams type | Winston | §7.1 (URLSearchParams → SearchParamsLike) |

Spec status header pasó de 🟡 DRAFT → 🟢 P0 PATCHES LANDED. Patch ledger en cabecera del spec.

## Estado del repo

- **Branch**: `main`, en `origin/main` (`3c1defa` — handoff anterior). **Working tree con 2 archivos untracked**:
  - `docs/superpowers/specs/2026-05-09-hub-redesign-phase-1-design-lock.md`
  - `docs/superpowers/specs/2026-05-09-hub-redesign-phase-1-redteam.md`
- **Suite**: NO corrida esta sesión (no se tocó código). Última conocida: 1292/1292 ✅ (handoff anterior).
- **Type-check**: NO corrido esta sesión. Última conocida: passing.
- **Asset payload**: 148 KB sin cambio (Phase 3 lo subirá hasta 178 KB cap).
- **Sin commits nuevos**: la próxima sesión decide si commitear ambos specs como `docs(spec): hub redesign phase 1 design lock + red-team` o como dos commits granulares (recomendado: dos commits, uno por archivo, para granularidad).

## Pendientes próxima sesión

### Inmediato (≤30 min)

1. **Wolfcito sign-off final** sobre los 2 specs — si todo OK, commitear ambos archivos
2. **Decidir orden de commits**: granular (recomendado per HARD RULE):
   - Commit A: `docs(spec): hub redesign phase 1 design lock`
   - Commit B: `docs(spec): hub redesign phase 1 red-team review + P0 patches`
3. (Opcional) Push para que el spec viva en remoto antes de Phase 3 work

### Phase 3 — Heavy ports (próxima sesión densa)

Empezar por **commit 1 de Phase 3 — ProSheet port** per §6 + §6.4 + §9.1 del design-lock spec:

1. **Pre-impl checks** (recomendado, 5 min):
   - `pnpm install` si hay drift
   - `pnpm test --run` para confirmar baseline 1292/1292
   - Re-leer §6.4 callback contract para tener la signature en cabeza
2. **TDD red phase**: escribir `apps/web/src/components/hub/__tests__/pro-sheet-port.test.tsx` per §9.1 (3 asserts: in-place mount, no URL change, atmosphere shift on receipt)
3. **Implementation**: `<HubScaffoldClient>` (V1) o nuevo `<HubScaffoldV2>` recibe ProSheet state + handler. Según §7, V2 es paralelo a V1; los ports van **dentro de V2 ONLY** (V1 sigue con `?legacy=1` durante el flag period)
4. **Verification**: tests green, type-check, suite full

### P1 findings que entran a Phase 3 work tickets

13 P1 documentados en red-team report §3. Los más urgentes para Phase 3:
- **P1-2 / P1-3** receipt race conditions (durante port de ProSheet — implementar `requestAnimationFrame` defer + hub-level wagmi subscription)
- **P1-9** `<PrimitiveBoundary>` wrapping para V2 (debe estar desde commit 1 de Phase 3)
- **P1-10** wallet disconnect behavior en V2 (al diseñar `<HubScaffoldV2>`)

### Riesgos abiertos (carry-forward)

- **P0-4 contrast gate**: la tabla §1.5.1 está vacía (TBDs). Phase 7 NO mergea hasta que esté llena con ratios reales medidos. Owner: quien escriba el atmosphere shift CSS.
- **MiniPay localStorage** (P1-5): splash flag puede resetearse en MiniPay WebView restart. Necesita doble persistencia (localStorage + server-side flag por wallet). Implementar en Phase 4.

## Cómo arrancar la próxima sesión

### Checklist pre-sesión

- [ ] `git pull` — confirmar `origin/main` está en `3c1defa` o más adelante
- [ ] Lee este handoff
- [ ] Lee/re-lee `docs/superpowers/specs/2026-05-09-hub-redesign-phase-1-design-lock.md` (especialmente §6 ports + §6.4 callback contract + §9.1 TDD plan)
- [ ] (Opcional) Lee `docs/superpowers/specs/2026-05-09-hub-redesign-phase-1-redteam.md` para tener los P1 en mente
- [ ] Decidir si commitear los 2 specs primero (recomendado) o arrancar Phase 3 con working tree dirty
- [ ] Decidir agente para Phase 3: **Wolfcito directo** (TDD-first) o **Amelia** (`bmad-agent-dev`) para story execution

### Prompt sugerido para arrancar

```
Continúo trabajo en Chesscito. Phase 1 design lock + red-team cerrados
2026-05-09 (sin commits aún). 6 P0 patches landed.

2 specs nuevos en docs/superpowers/specs/:
  - 2026-05-09-hub-redesign-phase-1-design-lock.md
  - 2026-05-09-hub-redesign-phase-1-redteam.md

Handoff: docs/handoffs/2026-05-09-hub-phase-1-handoff.md

Antes de arrancar:
  - Confirmo working tree (¿commitear specs primero?)
  - Re-leo §6 + §6.4 + §9.1 del design-lock spec
  - Confirmo baseline suite 1292/1292

Arrancamos Phase 3 commit 1 — ProSheet port:
  - TDD red phase: pro-sheet-port.test.tsx (3 asserts per §9.1)
  - Implementation: <HubScaffoldV2> + onPurchaseSuccess callback
  - <PrimitiveBoundary> wrapping desde primer commit (P1-9)
```

## Notas / lessons

- **Persona handoff Sally → Winston → Sally es valiosa**: Sally lidera narrative + UX layouts; Winston aporta lente arquitectónico (race conditions, type contracts, server/client boundary). El red-team de Winston encontró 6 P0 que Sally NO habría priorizado igual desde su lente. Recomiendo el patrón para futuros specs grandes.
- **Discovery → design-lock → red-team es un workflow de 3 saltos, no 2**. La memoria/handoff anterior trataba red-team como un pase opcional; en realidad encontró 6 P0 reales (incluyendo una material gap que habría compile-fallado en Phase 3 commit 1). Trátalo como gate, no opcional.
- **Locked decisions del discovery §12 sobreviven el red-team**: las 8 decisiones lockeadas se mantuvieron 8/8 — el red-team afectó implementation details, no scope. Buena señal de que el discovery hizo bien el trabajo de framing.
- **Asset budget exact-fit es señal de alarma sutil**: 148 + 30 = 178 KB cap exacto. Cualquier overflow durante Phase 3 (ej: warm-wood texture llega a 24 KB en lugar de 22 KB) rompe el cap. Mejor reservar ~5 KB de headroom; track como P2 ya documentado en red-team P2-10.
- **§6.4 callback contract evita race conditions de Phase 3**: documentar el contract en design-lock (no en impl) significa que los tests fail-first del Phase 3 pueden referenciar la signature antes de que exista código. SDD → TDD funcionando como debe.
- **CWD discipline**: como en sesión anterior, todos los reads/edits con paths absolutos. Sin tropezones.

---

**TL;DR**: Phase 1 design-lock spec + Phase 2 red-team review entregados como dos archivos en `docs/superpowers/specs/`. 6 P0 findings detectados y patcheados (3 Sally + 3 Winston). 13 P1 documentados como deliverables de Phase 3-7; 17 P2 tracked as risks. Working tree con 2 archivos untracked, sin commits aún. Próxima sesión: sign-off final + commits + arrancar Phase 3 commit 1 (ProSheet port) per §9.1 TDD plan.
