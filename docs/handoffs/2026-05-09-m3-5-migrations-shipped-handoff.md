# Session Handoff — 2026-05-09 (M3.5 implementation + 4 migrations shipped)

**Continúa de**: `2026-05-09-scene-rooted-vocabulary-handoff.md` (spec + red-team READY, no code).
**Sesión**: full M3.5 implementation + DESIGN_SYSTEM §16 + all 4 spec'd migrations shipped to `origin/main`.
**Status**: 12 commits pushed `00b534c..c35cd75`. Suite 1276/1276. Build passing. Production paths now consume the diegetic vocabulary.

## Lo que cerró esta sesión

### Pre-requisitos del spec

- 17 WebP assets en `apps/web/public/art/scene-rooted/` (148 KB total) — cada uno **dentro del budget del spec** tras resize+`cwebp` quality 70-85.
  - Originales sobrepasaban budget hasta 84× (gem-pill-base.png era 675 KB; ahora 2.2 KB en WebP).
  - Resize a dimensiones de display (×2 DPR): piedras → 96–128 px, principalbutton → 560 px, chests → 240/320 px, banners → 480/560/640 px, gem → 200 px.
- CSS vars en `globals.css` siguiendo `--{primitive-kebab}-bg-{variant}` per Asset Versioning Policy.
- Directorio `apps/web/src/components/scene-rooted/` creado.

### 5 primitivos diegéticos implementados con TDD (red → green → commit)

| Primitivo | Tests | LoC | Notas |
|---|---|---|---|
| `<StonePedestal>` | 21 | 415 (tsx+css+tests) | 10 stones × 3 sizes; `aria-label` requerido por TS |
| `<TreasureTile>` | 19 | 476 | 2 sizes; `ribbon` enum lockdown `BEST/NEW/SALE` |
| `<PrincipalButton>` | 17 | 389 | 2 sizes; `aria-label` opcional (cae a children textuales) |
| `<WoodBanner>` | 13 | 319 | Presentational; `asTitle` → `<h2>`; dev-time `console.warn` cuando label scrollWidth >25% over clientWidth |
| `<GemBadge>` + `<GemButton>` | 11 | 329 | Sibling split per red-team P1 |

Todas comparten:
- `<button>` para versiones pressables (NUNCA polimórficas a `<div>`)
- Press feedback `scale(0.96)` + `prefers-reduced-motion` border-color flash fallback
- `is-placeholder` cuando CSS var no resuelve (probe vía `getComputedStyle`)
- `loading` + `disabled` con loading-wins precedence (excepto Gem que no tiene loading per spec)

### DESIGN_SYSTEM.md §16

Sección agregada documentando los 5 primitivos: matrix, asset versioning policy, performance budget verification, behavior contract compartido, migration mapping y future work.

### 4 migraciones shipeadas siguiendo orden por blast radius

| # | Surface | → | Migración | Commit |
|---|---|---|---|---|
| 1 | `daily-tactic-card.tsx` (compact) | → | `<StonePedestal stone={2}>` con coach/check icon + streak badge; non-compact branch eliminado (dead code) | `ea0cad5` |
| 2 | `mini-arena-bridge-slot.tsx` (compact) | → | `<StonePedestal stone={4}>` con trophy icon; non-compact branch eliminado | `3318369` |
| 3 | `action-pin tone="claim" size="full"` | → | composición con `<PrincipalButton size="large">` (action-pin internamente la renderiza) | `417e03b` |
| 4 | `coach-paywall.tsx` (5-pack + 20-pack) | → | dos `<TreasureTile>` (small + large `ribbon="BEST"`); coin-stack iconStack + valueChip | `c35cd75` |

Todas preservan los contratos E2E (testids `daily-tactic-card`, `mini-arena-bridge`) vía `<span>` wrapper que carga `data-testid` + `data-state` del dominio sin polucionar la API del primitivo.

### Knock-on cleanups

- `DailyTacticSlot` perdió su prop `compact` (único consumer siempre la pasaba).
- `exercises-screen.tsx` deja de pasar `compact` a `DailyTacticSlot` y `MiniArenaBridgeSlot`.
- `coach-paywall.tsx` pierde 2 `<button class="candy-frame candy-frame-amber|gold">` blocks; reemplazo limpio.
- `action-pin.tsx` agrega un early-return path para tone='claim' + size='full'; el resto de tones/sizes intactos.

### Tests añadidos durante migraciones

- `daily-tactic-card.test.tsx` reescrito de 13 → 12 (los 13 viejos cubrían dead code; los 12 nuevos cubren el path vivo)
- `mini-arena-bridge-slot.test.tsx` — **5 tests nuevos** (no había ninguno antes)
- `action-pin.test.tsx` — **+5 tests** para composition path
- `coach-paywall.test.tsx` — **8 tests nuevos** (no había ninguno antes)

**Net**: +25 tests durante migraciones + 81 de los 5 primitivos = +106 nuevos. Todos verdes.

### Deviations from spec (documentadas)

1. **`tone="claim" + size="pin"` NO migra** — keeps `candy-frame-gold` round 44×44 pin. Razón: PrincipalButton es 280×80 fijo y rompe la geometría del slot pin. Documentado inline + en commit message.
2. **WoodBanner no tiene migración v1** — spec lo marcó "no v1 migration target", pero el primitivo está implementado y listo para usar.
3. **Gem (Badge + Button) sin migración v1** — mismo caso. Disponibles cuando una surface los necesite.
4. **Manual screenshot baselines diferidos** — acordado en sesión: en single-user dev period (sin funnel real que proteger), el costo de un visual regression es bajo. Salvaguarda real es eyeball + revert trivial. Cuando haya tracción, ejecutar baseline pass.

## Estado del repo

- **Branch**: `main`, en `origin/main`. Working tree limpio antes de este handoff.
- **Suite**: 1276/1276 ✅
- **Build**: passing
- **type-check**: passing
- **E2E contract**: preservado (`floating-actions-vs-dock.spec.ts` líneas 56, 117, 145 todas tienen sus testids vivos en el wrapper `<span>`)
- **Asset payload total scene-rooted**: 148 KB

### Commits pusheados esta sesión (12)

```
35c46cb feat(scene-rooted): add 17 webp assets within performance budget
fc03e1a feat(scene-rooted): add CSS vars for 5-primitive vocabulary
ae47031 feat(scene-rooted): implement <StonePedestal> primitive via TDD
6ee202b feat(scene-rooted): implement <TreasureTile> primitive via TDD
ab5978d feat(scene-rooted): implement <PrincipalButton> primitive via TDD
cecb0c1 feat(scene-rooted): implement <WoodBanner> primitive via TDD
c3c59b6 feat(scene-rooted): implement <GemBadge> + <GemButton> primitives via TDD
30c7785 docs(design-system): add §16 Scene-Rooted UI Vocabulary
ea0cad5 refactor(daily-tactic-card): migrate to <StonePedestal> (M3.5 canary)
3318369 refactor(mini-arena-bridge): migrate to <StonePedestal stone={4}> (M3.5)
417e03b refactor(action-pin): compose <PrincipalButton> for tone='claim' size='full'
c35cd75 refactor(coach-paywall): migrate packs to <TreasureTile> (M3.5 final)
```

## Pendientes (no bloquean ship)

- **Eyeball manual** en `pnpm dev` (viewport 390 px) tras prender el dev server. Las 4 surfaces migradas se ven en:
  - `/exercises` (action-row left = daily piedra2; action-row right = mini-arena piedra4)
  - `/exercises` cuando aparezca el contextual claim CTA (PrincipalButton)
  - `/arena` → coach paywall sheet (dos cofres lado a lado)
- **Manual screenshot baselines** en `apps/web/e2e/screenshots/scene-rooted/` — diferidos por velocidad acordada; convertirlos en task cuando llegue tracción.
- **`<StonePedestal variant="trophy">`** — futuro spec para "Mint your Moment" (daily-tactic completed orgullo state).
- **Surface audit de chrome no-diegético** — follow-up red-team P1; recomendado pero no urgente.
- **Asset finals** — los WebP actuales son working drafts. Cuando lleguen finals (resolution variants, color tonings), swap = solo cambio de CSS-var, sin refactor.

## Lo que queda por decidir

Nada inmediato a nivel arquitectónico. La M3.5 está completa según el spec.

**Estratégico** — el usuario expresó dirección clara durante la sesión:
- *"corregir y actualizar la UI lo más rápido posible para que la app comience a conocerse en el mundo"*
- Single-user dev period: visual regressions son bajo costo, evitar overengineering en defensa contra riesgos que aún no existen.
- Cuándo levantar baselines: post-tracción o equipo > 1 dev.

## Cómo arrancar la próxima sesión

### Agente recomendado

Claude Code default. M3.5 está cerrada; no hay UX ambigüedad activa que requiera Sally. Si surge una nueva surface por diseñar, abrir `bmad-agent-ux-designer` (Sally) para reframing diegetic. Para implementación de primitivos nuevos o migraciones similares, default basta.

### Checklist pre-sesión

- [ ] `git pull` — confirmar `origin/main` está en `c35cd75` o más adelante.
- [ ] `pnpm install` si hay cambios upstream.
- [ ] (Opcional) `pnpm dev` en background y eyeball las 4 surfaces migradas: daily pill, mini-arena pill, claim CTA (cuando aparece), coach paywall.
- [ ] Decidir foco: nueva feature, polish de M3.5, ó migration de chrome no-diegético detectado.

### Prompt sugerido para arrancar

```
Continúo trabajo en Chesscito. M3.5 cerrada (2026-05-09): 5 primitivos
diegéticos en producción + 4 surfaces migradas (daily-tactic-card,
mini-arena-bridge-slot, action-pin claim+full, coach-paywall).

Suite 1276/1276. Build passing. Asset payload scene-rooted = 148 KB.

Handoff cierre M3.5: docs/handoffs/2026-05-09-m3-5-migrations-shipped-handoff.md

Próximos posibles focos (lista, no prescripción):
  - Surface audit de chrome no-diegético (red-team P1 pendiente)
  - "Mint your Moment" feature (PrincipalButton "Save my Moment" slot ready)
  - Nueva feature de gameplay
  - Polish/UX iteration en surfaces que ya consumen los primitivos

Antes de arrancar:
  - Lee el handoff arriba
  - Prende dev server en 390px viewport y eyeball /exercises + /arena coach
  - Pregúntame foco antes de planear
```

## Notas

- **TDD discipline mantenida**: cada primitivo siguió red phase test → green impl → commit granular. Cada migración añadió tests cuando no existían (mini-arena, coach-paywall) o reescribió tests cuando el surface cambió contrato (daily-tactic).
- **Plan-before-edit cumplido**: confirmaciones explícitas antes de cada cambio importante (resize/cwebp strategy, canary go-ahead, plan-original confirm).
- **Execution-initiative cumplido**: globs/reads/builds/type-checks autoejecutados; user input solo en decisiones estratégicas (estrategia de regresiones, push, plan order).
- **Granular commits**: 12 commits atómicos en lugar de 1 megacommit. Cada uno revertible sin perder trabajo adyacente.
- **Eyeball pendiente** sigue siendo la salvaguarda real per acuerdo de sesión. Mientras no se haga, la confianza viene de unit + integration tests.

---

**TL;DR**: M3.5 cerrada al 100%. 5 primitivos diegéticos + 4 surfaces migradas + DESIGN_SYSTEM.md actualizado + 12 commits pushed. Sin baselines visuales (acordado). Asset payload bajo budget. Build verde. Próxima sesión: foco abierto — recomendado eyeball las 4 surfaces antes de planear nuevo trabajo.
