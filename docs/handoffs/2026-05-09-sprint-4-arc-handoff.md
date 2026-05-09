# Session handoff — Sprint 4 arc + hub-redesign discovery (2026-05-09)

**Continúa de**: `2026-05-09-vocabulary-unification-arc-handoff.md` (cierre del arc M3.5 + listado P0/P1 candidates)
**Sesión**: Sprint 4 (4A → 4D) shipped + Sprint 4E discovery locked
**Status**: 14 commits pushed `005c577..3a7ae77`. Suite 1292/1292. type-check green. Working tree limpio.

## Lo que cerró esta sesión

### Sprint 4A — Victory-celebration redundancy + AskCoach demote + editorial victory (4 commits)

Resuelve P0 del handoff anterior ("4 botones competing"): victory-celebration baja de 4 botones competing a 2 primarios + 1 fila tertiary. AskCoach mantiene identidad emerald pero ya no compite. Defeat path simétricamente limpio.

| Commit | Cambio |
|---|---|
| `5a3fe46` | editorial — `claimButton` "Save Victory", `claimValueHint` solo precio, `askCoach` "Ask Coach", drop `askCoachSub` |
| `c44a48f` | AskCoachButton compact (game-sm, drop subtitle, `className` prop) |
| `a0bf0e2` | victory-celebration restructure — `Save Victory large` / `Play Again medium` / `[AskCoach + Share] inline 50/50` / drop redundant back-link |
| `3cca857` | arena-end-state defeat — drop redundant back-to-hub button (X close already covers nav) |

### Sprint 4B — Scroll sweep (3 commits)

Cierra P0 "scroll vertical missing en sheets". Encontró riesgo en 4 superficies; resuelto con 3 fixes (uno central beneficia 5+ modales).

| Commit | Cambio |
|---|---|
| `b5d6c6a` | CandyGlassShell — `max-h-[90dvh] overflow-y-auto overscroll-contain` (fix central; beneficia victory-celebration, arena-end-state, mission-briefing, labyrinth-complete-overlay, result-overlay) |
| `da604fc` | pro-sheet — wrapper inner `flex-1 min-h-0 overflow-y-auto`; CTA pinned via `mt-auto` |
| `1161c81` | mission-detail-sheet — `max-h-[90dvh] flex-col` + body `flex-1 overflow-y-auto`, alinea con badge/shop/leaderboard pattern |

#2 editorial pass otras superficies: cerrado en 4A. Búsqueda en repo no encontró otros patrones de column-stacked label+sub remanentes.

### Sprint 4C — Resign exemplar doc + a11y polish (2 commits)

Hallazgo: el "resign modal" del handoff no es un modal — es tap-to-confirm in-place que el master audit ya marcó como **"already excellent; document as exemplar for destructive actions"**. Carry-over erróneo del handoff. Acción: documentar como exemplar + cerrar gap de accesibilidad real.

| Commit | Cambio |
|---|---|
| `ad3c7d8` | arena-action-bar a11y — `aria-label` dinámico ("Resign" → "Tap again to confirm resign") + `aria-pressed`; añade `ARENA_COPY.resignConfirm` |
| `4b98ae3` | DESIGN_SYSTEM.md §17 — Destructive Action Pattern (state machine + rationale + when-not-to-use + a11y checklist) |

### Sprint 4D — AchievementsGrid migration + detail sheet (3 commits)

Cierra P1 deferred del Sprint 3. TreasureTile geometry (120×136) no encajaba en grid 88px previo. Solución: split sections (Earned / Locked) + tile per achievement + descripción debajo + nuevo `<AchievementDetailSheet>` que da destino real al tile-click (rompe el chicken-and-egg que el handoff había marcado).

| Commit | Cambio |
|---|---|
| `c120176` | editorial — `sectionEarned/Locked`, `detailEarnedSubtitle/detailLockedSubtitle`, `goalLabel`, `detailCloseLabel` |
| `2efcfb3` | nuevo `<AchievementDetailSheet>` — bottom sheet con TreasureTile hero + título + descripción + progress bar (locked) con role=progressbar + aria-value |
| `5b8030e` | AchievementsGrid restructure — split sections "Earned (X) / Locked (Y)", grid-cols-2 con TreasureTile small (chest art) + EARNED ribbon cuando earned + tap → detail sheet |

**Activaciones**:
- **EARNED ribbon** — antes 0 consumers (added Sprint 3 commit `bf6e9c0`), ahora vivo en achievements grid + detail sheet
- **TreasureTile** — antes 2 homes (coach packs), ahora 3 homes (+ achievements ×N)

### Sprint 4E — Hub redesign discovery spec + decisions locked (2 commits)

Discovery phase del último P1 pendiente. Spec captura brief textual ("splash + masteries + training pass + PLAY"), encuesta `<HubScaffold>` actual + audit 2026-05-07, expone 10 open questions. Conversación decision-by-decision → 8 decisiones lockeadas.

| Commit | Cambio |
|---|---|
| `beff986` | `docs/superpowers/specs/2026-05-09-hub-redesign-design.md` — discovery spec (3 axes, 3 directions sketches, 9 phases) |
| `3a7ae77` | spec §12 — locked decisions table (Z-revised / Splash A / Mastery D / Training C / flag B / heavy ports during / +20% budget) |

**Lock summary**:
- **Direction**: **Z-revised** — mastery-first dashboard; PLAY al dock con ceremony preservado (StonePedestal/PrincipalButton large)
- **Splash**: A onboarding-only (first-ever-visit cinematic)
- **Mastery**: D full dashboard (6 tiles dominantes, locked Q/K visibles con "coming soon")
- **Training Pass**: C atmosphere shift (warm-wood vs cool-stone tokens; slot pasa a wax-seal cuando PRO active)
- **Migration**: B `?hub=v2` flag (precedente Story 1.12)
- **Heavy ports**: B durante (Phase 3 del spec) — son dependencias de Z
- **Asset budget**: +20% (178 KB cap) — forces reuse de piece art via tone/filter
- **DESIGN_SYSTEM §16** **necesita actualización** en Phase 1: "PLAY merits ceremony wherever it appears — canvas, dock, or modal"

**Total scope estimado**: ~28-30 commits multi-session.

## Estado del repo

- **Branch**: `main`, en `origin/main` (`3a7ae77`). Working tree limpio.
- **Suite**: 1292/1292 ✅ (sin cambio neto vs handoff anterior — Sprint 4 fue todo refactor + restructure, no nuevas test specs)
- **Type-check**: passing
- **Asset payload**: 148 KB sin cambio (Sprint 4 no añadió assets nuevos; Phase 1 hub redesign los añadirá hasta 178 KB cap)

## Pendientes Sprint 4E — Phase 1 Design Lock

**Próximo deliverable**: spec prescriptivo basado en las decisiones lockeadas.

Sections que necesita:
1. **Layouts box-by-box** — splash overlay (timing 1.2s), HUD top compact, mastery dashboard 6-tile grid, dock PLAY ceremony, training pass band activo/inactivo
2. **Copy completo** — splash strings, mastery tile labels per piece (rook/bishop/knight/pawn/queen/king × 3 estados = locked/in-progress/mastered), training pass active/inactive variants, atmosphere transition copy
3. **Asset manifest** — splash Lottie spec (frames, duration, dimensions), mastery shield assets si aplica (decisión: reutilizar piece art con tone filter, NO nuevos sprites por budget), warm-wood texture variant, wax-seal SVG
4. **Motion timing** — splash entrance/exit, atmosphere shift transition, mastery tile state changes, dock PLAY ceremony
5. **Telemetry events** — `hub_v2_view`, `hub_v2_mastery_tap`, `hub_v2_pro_chip_tap`, `hub_v2_play_dock_tap`, `splash_dismiss`, etc.
6. **Heavy ports plan** — porting order: ProSheet (most central) → BadgeSheet → ShopSheet; preserva testids
7. **Flag mechanics** — `?hub=v2` query param parser, `[data-hub-v2]` body namespace para palette scoping, default-off until promote
8. **DESIGN_SYSTEM §16 update** draft (texto exacto del nuevo wording)
9. **TDD plan** — fail-first tests por fase

Después de Phase 1 spec: red-team review (Phase 2) antes de tocar código.

## Cómo arrancar la próxima sesión

### Agente recomendado
**Sally** (`bmad-agent-ux-designer`) o **Sally + Winston** (`bmad-agent-architect`) en tándem para Phase 1. Sally lidera layouts + copy + motion; Winston valida flag mechanics + heavy-ports plan + TDD plan. Sally tiene precedente con specs prescriptivas en este repo (M3.5, vocabulary unification).

### Checklist pre-sesión
- [ ] `git pull` — confirmar `origin/main` está en `3a7ae77` o más adelante
- [ ] `pnpm install` si hay cambios upstream
- [ ] Lee este handoff
- [ ] Lee `docs/superpowers/specs/2026-05-09-hub-redesign-design.md` (especialmente §12 locked decisions)
- [ ] Lee `docs/audits/2026-05-07-hub-audit.md` (audit de la versión actual de hub-scaffold)
- [ ] Eyeball `/hub` en mobile viewport para refrescar mental model del baseline V1
- [ ] Decidir si Phase 1 spec se escribe en una sesión densa o se divide (e.g., layouts/copy primero; assets/motion/telemetry después)

### Prompt sugerido para arrancar

```
Continúo trabajo en Chesscito. Sprint 4 cerrado (4A-4D shipped + 4E
discovery locked). 14 commits pushed esta sesión 2026-05-09.

Suite 1292/1292. Build passing.

Handoff: docs/handoffs/2026-05-09-sprint-4-arc-handoff.md
Discovery spec: docs/superpowers/specs/2026-05-09-hub-redesign-design.md

8 decisiones lockeadas para hub redesign:
  - Z-revised (mastery dashboard, PLAY al dock con ceremony)
  - Splash A (onboarding-only)
  - Mastery D (full dashboard)
  - Training C (atmosphere shift)
  - Migration B (?hub=v2 flag)
  - Heavy ports B (durante, Phase 3)
  - Asset budget +20% (178 KB)

Antes de arrancar:
  - Lee handoff + discovery spec §12 (locked decisions)
  - Lee audit 2026-05-07-hub-audit.md
  - Decide foco: Phase 1 design-lock spec completa, o dividida en
    sub-sesiones (layouts/copy primero, después assets/motion/telemetry)
```

## Notas / lessons

- **Handoff carry-over correctness**: el resign "modal" entry del handoff anterior era stale carry-over — el master audit ya lo marcaba como out-of-scope ("already excellent"). Reflejo: leer el master audit antes de aceptar carry-overs P1 como migration targets. Resolved cleanly: B+C combo (doc as exemplar + a11y polish on the real gap).
- **Editorial pass cierre temprano**: #2 del handoff (editorial pass otras superficies) se cerró en 4A automáticamente — no quedaron otros patrones de column-stacked label+sub. Búsqueda exhaustiva en `flex flex-col items-(start|center) leading` returned no other matches. Lesson: editorial passes guiados por patrón (no por lista enumerada) pueden cerrarse de un golpe en sub-sprints más amplios.
- **AchievementsGrid migration unblocked via detail sheet**: el handoff había deferred 4D porque "TreasureTile only makes sense once tiles have a destination". Resolved by building the destination (AchievementDetailSheet) en el mismo arc — converted a chicken-and-egg defer into a 3-commit migration.
- **Discovery-phase specs are the right shape for ambiguous briefs**: Sprint 4E discovery spec capturó brief + open questions + 3 directions sketches WITHOUT locking design. La conversación decision-by-decision en chat completó las 8 decisiones en ~30 min sin re-rounds. Bueno para futuras feature work specs.
- **CWD discipline en Bash tool**: el cwd no persiste entre invocaciones — siempre encadenar `cd <abs path> && cmd` cuando importa el cwd. Tropecé con type-check que parecía broken pero solo corría desde repo root. Confirmed working pattern: `cd .../apps/web && pnpm exec tsc --noEmit`.
- **Sprint 4E is meta**: es un spec sobre cómo escribir el spec. La fricción está justificada porque el redesign mueve PLAY del canvas al dock — eso es un cambio de mental model que merece deliberación explícita, no jump-to-implementation.

---

**TL;DR**: Sprint 4 (A+B+C+D) shipped al 100% — 12 commits cerrando 6 de 7 candidates del handoff anterior. Sprint 4E discovery + decisions locked para hub redesign — 2 commits. Total 14 commits pushed. Próxima sesión: Phase 1 design-lock spec (Sally lead). Suite green. 14 commits ahead pushed.
