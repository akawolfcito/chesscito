# Session handoff — Hub Redesign Phases 4 + 5 + 6 (primitives complete) (2026-05-09)

**Continúa de**: `2026-05-09-hub-phase-3-handoff.md` (cerró heavy ports — ProSheet + BadgeSheet + ShopSheet montando in-place en `<HubScaffoldV2Client>`)
**Sesión**: Phase 4 commits 1+2 + Phase 5 + Phase 6 — 4 commits feature + 1 commit docs (Phase 7 nota dinámica). Origen `b634744..afb41c3`.
**Status**: Phases 4–6 (splash + mastery + training band primitives) **CLOSED**. Todos los primitives V2 listos para integración. V1 intacto. `?hub=v2` flag mechanics + composition + CSS palette + atmosphere wiring quedan para Phase 7.

## Lo que cerró esta sesión

### Phase 4 — Splash primitive (2 commits)

| Commit | Files | Asserts | Suite |
|---|---|---|---|
| `26fd0e8` | `hub-splash.tsx` (125 LOC), `hub-splash.test.tsx` (175 LOC) | 6: mount gate · hint timing · tap dismiss · reduced-motion · ARIA + keyboard · telemetry | 1306/1306 |
| `6ab35dd` | `editorial.ts` (+11), `hub-splash.tsx` (+45/-21), test (+22) | +1 (editorial integration); 7 total | 1307/1307 |

**Decisiones técnicas**:
- **Sin auto-dismiss timer** (P0-3 fix, WCAG 2.2.1): tap-anywhere o Enter/Space dismiss; hint fade-in JS-driven a `1800ms` (1200ms entrance + 600ms post-entrance).
- **Three-state seenFlag** (`null | true | false`): null en SSR → no flash on returning visit; useEffect hydrata + decide.
- **matchMedia defensive**: `typeof window !== "undefined" && typeof window.matchMedia === "function"` antes de query.
- **SVG placeholder hero** (commit 2): `<svg>` decorativo con `♞` glyph + dashed border + `aria-hidden="true"`. Real `splash-knight-hero.webp` (≤6 KB §3.2) se entrega en Phase 4 commit 3 cuando llegue el asset.
- **Editorial single source of truth**: title "Welcome, friend" + tagline "Small plays. Big mental habits." + dismissHint "Tap anywhere to begin" + ariaLabel + ariaTitleId — todo en `HUB_V2_SPLASH_COPY`. Componente nunca hardcodea strings.
- **react-best-practices review** ejecutado post-implementación: 0 cambios requeridos; nota Phase 7 registrada (dynamic import) en handoff Phase 3 vía commit `b634744`.

### Phase 5 — Mastery dashboard (1 commit)

| Commit | Files | Asserts | Suite |
|---|---|---|---|
| `c2c1d93` | `mastery-tile.tsx` (139 LOC), `mastery-dashboard.tsx` (93 LOC), 2 test specs (319 LOC), editorial (+43) | 4 (tile-states) + 7 (dashboard) = 11 nuevos | 1324/1324 |

**Decisiones técnicas**:
- **`<MasteryTile>` standalone**: NO wrap de `<TreasureTile>` en este commit — `<TreasureTile>` no acepta `data-*` arbitrarios y su contrato `iconStack/valueChip` no encaja con el layout 4-líneas mastery (piece + label + sub + opcional wax-seal). CSS de Phase 7 mapeará `.mastery-tile` a estilos de `.treasure-tile-small`.
- **`PIECE_ART` Record explícito**: convención asset-integrity (literal strings en Record, no template-string). Romper esto rompe `asset-integrity.test.ts` que escanea `*.tsx` por `/art/...` literales. Patrón existente en `lib/game/arena-utils.ts`.
- **Telemetría desde container**, no desde tile primitive: `<MasteryDashboard>` despacha `hub_v2_mastery_tap` o `hub_v2_mastery_locked_tap` según state; tile sólo emite `onTap` callback. Mantiene primitive side-effect-free.
- **Streak header opcional**: assert (6) extra incluido per acuerdo en sesión — `streakDays > 0` rendea `mastery-streak`; `streakDays === 0` ausente del DOM.
- **Dashboard root ARIA** (assert 7 extra, no en §9.3): `<section aria-label={masteryDashboardAriaLabel}>` para que el scaffold V2 lo trate como landmark región. Sin esto, el constant editorial sería dead code.

### Phase 6 — Training Pass band (1 commit)

| Commit | Files | Asserts | Suite |
|---|---|---|---|
| `afb41c3` | `training-pass-band.tsx` (132 LOC), test spec (211 LOC), editorial (+28) | 4 (active rendering · inactive rendering · tap telemetry both states · onActivate transition) | 1328/1328 |

**Decisiones técnicas**:
- **Doble-render path** (active vs inactive) en una sola tap surface — comparten telemetry + `onTap` + `aria-label` resuelto desde editorial.
- **`onActivate` callback ref pattern**: fires sólo en transición `false → true`; NO en mount con `active=true`; NO en re-renders con mismo valor; NO en transición inversa. Implementado con `prevActiveRef` + `onActivateRef` (latest-callback pattern para evitar stale closure).
- **Atmosphere shift NO duplica**: el `hub_atmosphere_shift` telemetry sigue viviendo en `<HubScaffoldV2Client>.handlePurchaseSuccess` (Phase 3 commit 1). El band sólo expone `onActivate` como hook adicional para Phase 7 si necesita un trigger band-driven.
- **Tap telemetry**: `track("hub_v2_training_band_tap", { proActive })` — flag `proActive` permite distinguir tap-de-upsell vs tap-de-PRO en analytics.
- **Sin coupling a `<WoodBanner>` / `<TreasureTile size="large">`**: visual coupling diferido a Phase 7 alongside warm-wood texture asset (`wood-banner-medium-warm.webp` ≤22 KB §3.2) + atmosphere palette tokens.

## Estado del repo

- **Branch**: `main`, sincronizado con `origin/main` en `afb41c3`
- **Working tree**: limpio
- **Suite**: **1328/1328 ✅** (+28 vs baseline Phase 3 1300; +6 splash, +11 mastery, +4 training, +6 asset-integrity por nuevas piezas en mastery-tile, +1 editorial integration)
- **Type-check**: passing (`pnpm type-check` clean)
- **Asset payload**: 148 KB sin cambio (Phases 4–6 son lógica + tests; assets entran en Phase 4 commit 3 + Phase 7)
- **Push status**: todos los commits viven en `origin/main`

## Pendientes próxima sesión

### Phase 4 commit 3 — Asset wiring (cuando llegue `splash-knight-hero.webp`)

- Reemplazar SVG placeholder en `hub-splash.tsx` por `<Image>` de `next/image` apuntando a `/art/scene-rooted/splash-knight-hero.webp`
- Agregar `splash-knight-hero.webp` (≤6 KB §3.2) a `apps/web/public/art/scene-rooted/`
- CSS keyframes en `globals.css`:
  - Entrance pulse: `1200ms ease-spring scale(0.92 → 1.0)` (token `--ease-spring`)
  - Hint fade-in: `500ms ease-in delay 1800ms opacity 0 → 1` (token `--duration-ceremony`) — alternativa a JS timer si se quiere CSS-only path
  - Reduced-motion override: `@media (prefers-reduced-motion: reduce) { ... }` skip ambas animaciones
- Update `DESIGN_SYSTEM.md` §16.3 asset registry: 148 → 154 KB (con splash hero)

### Phase 7 — V2 composition (próxima fase, ~3–4 commits)

Per design-lock §9.5 + §1.4 + §1.5.1 + §7 + §11:

**Commit a — Composition + flag mechanics**:
- `<HubScaffoldV2Client>` integra splash + mastery dashboard + training band + dock (PrincipalButton + Practice/Trophies links + Shield ribbon condicional)
- Flag mechanics `?hub=v2` en `app/hub/page.tsx` (server-side resolution per §7, no client flicker)
- Routing: `?hub=v2` overrides default-off; `?hub=v1` overrides default-on; sin query usa default
- 2 test specs nuevos (per §9.5):
  - `hub-scaffold-v2.test.tsx` (5 asserts): document order splash → HUD → dashboard → dock; `[data-hub-v2]` attribute; `[data-pro-active]` attribute; atmosphere CSS vars via `getComputedStyle`; PLAY tap fires `hub_v2_play_dock_tap` con masteryProgress payload
  - `hub-flag-resolution.test.tsx` (5 asserts): los 4 escenarios de query/default + SSR resolution sin flicker

**Commit b — CSS palette + atmosphere shift + P0-4 contrast gate**:
- `globals.css` agregar `[data-hub-v2]` namespace con cool-stone defaults + warm-wood `[data-pro-active]` overrides
- Tokens nuevos: `--hub-bg`, `--hub-accent`, `--cell-last-move-bg`, palette tokens per §1.5
- Transición `500ms ease-spring` en `background-color` + `color`
- **GATE BLOCKING**: tabla §1.5.1 contrast ratios DEBE estar fully populated y todos passing WCAG AA. Sin esto NO mergea.
- Inline ratio verification con `apps/web/scripts/check-contrast.ts` o relative-luminance math
- Documentar ratios en PR description

**Commit c — Visual finish + dynamic import**:
- `<MasteryTile>` golden glow filter + dim filter + wax-seal SVG real (per §3.2 `wax-seal-pro.svg` ≤2 KB)
- `<TrainingPassBand>` warm-wood texture asset wiring + WoodBanner/TreasureTile composition
- **Aplicar nota Phase 7 dynamic import** (registrada en handoff Phase 3): `<HubV2Splash>` via `next/dynamic({ ssr: false })` para sacarlo del critical-path bundle
- Update `DESIGN_SYSTEM.md` §16.7 amendment per §8 design-lock
- E2E visual snapshots (`pnpm test:e2e:visual`) — postergados desde Phase 3 cuando V2 ya alcanzable vía `?hub=v2`

**Commit d — Telemetría parity sentinel + heads-up**:
- `hub_v2_legacy_redirect` event cuando flag está OFF pero `?hub=v2` se pidió (per §5)
- `hub_v2_play_dock_tap` payload con `masteryProgress = totalStars / 18`
- Smoke test MiniPay localStorage (P1-5): verificar que `chesscito:hub-v2:splash:seen` persiste cross-WebView restart

### P1 findings que entran a Phase 7

| P1 | Status | Where |
|---|---|---|
| **P1-5** | Phase 7 commit d | MiniPay localStorage doble persistencia (smoke + posible server-side flag por wallet) |
| **P1-10** | Phase 7 commit a | Wallet disconnect behavior: qué pasa con sheets abiertos cuando user disconnect mid-flow |
| **P1-12** | (entregado en Phase 5) | Coming-soon Q/K tile label readable mientras sprite dim ✅ — `mastery-tile.tsx` rendea `mastery-tile-sub` SIEMPRE full-contrast, dim aplica sólo a piece sprite vía CSS Phase 7 |

### Riesgos abiertos (carry-forward)

- **P0-4 contrast gate** (Phase 7 commit b BLOCKING): tabla §1.5.1 sigue con TBDs. Phase 7 NO mergea hasta filled con ratios reales WCAG AA passing. Owner: implementer del CSS atmosphere-shift.
- **Asset budget exact-fit** (P2-10): 148 + 30 = 178 KB cap exacto. Phase 4 commit 3 agrega 6 KB (splash hero) → 154 KB. Phase 7 agrega 22 KB warm-wood + 2 KB wax-seal → 178 KB total. Cero headroom. Si algún asset llega más grande del cap, ImageMagick re-comprimir o reducir dimensiones (per §11 risk 6).
- **Visual snapshots deferidos**: `pnpm test:e2e:visual` aún sin correr (V2 sigue no alcanzable). Correr en Phase 7 commit a/c cuando `?hub=v2` cablee V2.
- **Splash dynamic-import nota**: documentada en `2026-05-09-hub-phase-3-handoff.md` §"Notas Phase 7" — aplicar en Phase 7 commit c.
- **Asset entrega `splash-knight-hero.webp`**: design pendiente. Bloquea Phase 4 commit 3 pero NO bloquea Phase 7 (placeholder SVG sigue válido para integración).

## Cómo arrancar próxima sesión

### Checklist pre-sesión

- [ ] `git pull` — confirmar `origin/main` está en `afb41c3` o más adelante
- [ ] Lee este handoff
- [ ] Re-lee `docs/superpowers/specs/2026-05-09-hub-redesign-phase-1-design-lock.md` §1.4 (dock) + §1.5.1 (contrast gate) + §7 (flag mechanics) + §9.5 (TDD plan Phase 7) + §11 (risks)
- [ ] Re-lee `docs/handoffs/2026-05-09-hub-phase-3-handoff.md` §"Notas Phase 7" (dynamic import)
- [ ] Confirmar baseline suite **1328/1328** + type-check ✅
- [ ] Decidir si Phase 4 commit 3 (asset) viene antes o después de Phase 7 (depende de si llegó `splash-knight-hero.webp`)
- [ ] Decidir agente: **Wolfcito directo** (TDD-first) o **Amelia** (`bmad-agent-dev`) para story execution

### Prompt sugerido para arrancar Phase 7 commit a (composition + flag)

```
Continúo trabajo en Chesscito. Phases 4-6 cerradas 2026-05-09 con
4 commits feature: splash primitive (26fd0e8 + 6ab35dd), mastery
dashboard (c2c1d93), training pass band (afb41c3). Suite 1328/1328.

Handoff: docs/handoffs/2026-05-09-hub-phases-4-6-handoff.md

Antes de arrancar:
  - Confirmo working tree limpio
  - Re-leo §1.4 (dock) + §7 (flag mechanics) + §9.5 (TDD Phase 7)
  - Confirmo baseline suite 1328/1328

Arrancamos Phase 7 commit a — V2 composition + flag mechanics:
  - TDD red phase: hub-scaffold-v2.test.tsx (5 asserts §9.5)
    + hub-flag-resolution.test.tsx (5 asserts §9.5)
  - Implementation: <HubScaffoldV2Client> integra splash + mastery
    + training + dock (PrincipalButton + Practice/Trophies links
    + Shield ribbon condicional)
  - app/hub/page.tsx: ?hub=v2 flag mechanics server-side resolution
    (sin client flicker)
  - Aplicar nota Phase 7: <HubV2Splash> via next/dynamic({ ssr: false })
```

### Prompt sugerido para Phase 4 commit 3 (asset, si llegó)

```
Continúo Chesscito. Phase 4 commit 3 — wirear splash-knight-hero.webp.
Asset entregado en /art/scene-rooted/. Reemplazar SVG placeholder en
hub-splash.tsx por <Image> next/image. Agregar CSS keyframes (entrance
pulse 1200ms ease-spring + hint fade-in 600ms post-entrance) +
reduced-motion override en globals.css. Update DESIGN_SYSTEM.md §16.3
asset registry: 148 → 154 KB.
```

## Notas / lessons

- **TDD red→green→suite→commit sigue rindiendo**: 4 commits feature en una sesión, cero retrabajo. Cada commit pasa suite full + type-check antes de commitear. El asset-integrity hit en Phase 5 (template-string en `<img src>`) se cazó dentro del ciclo, no en CI — fix fue 1 minuto (Record explícito), no media hora de debug post-merge.
- **Editorial single source of truth se sostuvo**: cada commit migró strings nuevas a `editorial.ts` antes de tocar JSX. Tests verifican que el componente lee del constant (assert 7 splash, assert 5 mastery aria-label, assert 1+2 training band). Si algún día reorganizan editorial, los tests pegan inmediatamente — no hay strings inline rotos.
- **Primitives sin coupling visual prematuro**: `<MasteryTile>` no wrappea `<TreasureTile>`; `<TrainingPassBand>` no wrappea `<WoodBanner>`/`<TreasureTile size="large">`. Los `data-*` + class hooks son suficientes para el contrato de lógica + telemetría + ARIA. CSS visual entra en Phase 7 cuando el palette + atmosphere palette + warm-wood texture llegan juntos. Esta separación evita cambios destructivos a primitives canónicos durante experimentación.
- **`onActivate` callback con ref pattern**: `prevActiveRef` para detectar transición + `onActivateRef` para latest-callback. El test cubre 4 sub-casos (mount-active, transition-on, no-op-on-rerender, transition-off). Patrón reutilizable si Phase 7 necesita más callbacks reactivos a prop transitions.
- **react-best-practices skill ejecutado post-implementación**: 0 cambios requeridos en hub-splash.tsx, pero registró nota Phase 7 valiosa (`next/dynamic({ ssr: false })`). Vale la pena correr el skill después de cada primitive nuevo — costo bajo (~5 min revisión), beneficio alto (caza patterns subóptimos antes de que se vuelvan código legacy).
- **Spec assert 4 Phase 6 reinterpretado**: §9.4 dice "atmosphere shift fires when active false → true" pero el atmosphere shift telemetry ya vive en scaffold (Phase 3). Reinterpreté como "band expone `onActivate` callback hook"; documentado en commit message + handoff. Si Phase 7 necesita el band como trigger adicional, el callback ya está; si no, `onActivate` queda opcional sin daño.

---

**TL;DR**: Phases 4 (splash) + 5 (mastery dashboard) + 6 (training band) cerradas en una sesión, 4 commits feature granulares (`26fd0e8 → 6ab35dd → c2c1d93 → afb41c3`) + 1 commit docs (`b634744` Phase 7 nota dinámica). Suite **1328/1328 ✅** (+28 vs baseline 1300). Type-check limpio. Working tree limpio. Push completo. Próxima sesión: Phase 7 V2 composition (~3–4 commits — composition + flag, CSS palette + P0-4 contrast gate BLOCKING, visual finish + dynamic import, telemetría parity sentinel) o Phase 4 commit 3 (asset wiring) si llegó `splash-knight-hero.webp`.
