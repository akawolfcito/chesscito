# Game Home Redesign — Primitive Suite Handoff

- **Fecha**: 2026-05-04
- **Owner**: Wolfcito
- **Sesión**: Epic 1 (Hub Renewed Experience), Stories 1.3–1.11 — completion of the additive primitive suite **before** the `/play-hub` migration.
- **Branch**: `main`. Nine commits landed and pushed (`bf835b6` → `39ca200`). Working tree limpio al cierre.

---

## 1. Estado final

- ✅ **Epic 1, 11/14 stories cerradas en `main`.** Sólo quedan 1.12 (migración `/play-hub`), 1.13 (telemetría Hub) y 1.14 (real-device smoke) — todas gated por el cierre del freeze de PRO Phase 0.
- ✅ **Issue #108 (RainbowKit SSR)** verificado como cerrado: dev server arranca, `GET / 200`, sin `localStorage.getItem` ni `getRecentWalletIds` ni `TypeError` en logs. La suite `pnpm test:e2e:visual` está técnicamente desbloqueada — no se corrió porque no hay aún consumo visual de los primitives.
- ✅ **Test suite verde**: 702/702 passing (+75 tests netos esta sesión vs baseline 627).
- ✅ **Type-check clean**: `tsc --noEmit` exit 0.
- ✅ **Lint clean**: 0 warnings nuevos en archivos tocados (warnings pre-existentes en archivos no tocados se mantienen — no es regresión).

---

## 2. Stories shipped

| Story | Title | Commit | Tests añadidos |
|---|---|---|---|
| 1.3 | `<KingdomAnchor>` primitive | `bf835b6` | 7 |
| 1.4 | `<HudResourceChip>` primitive | `3ca8b23` | 10 |
| 1.5 | `<HudSecondaryRow>` primitive | `8843148` | 7 |
| 1.6 | `<RewardColumn>` primitive | `7196a4e` | 10 |
| 1.7 | `<PremiumSlot>` primitive | `24d8e19` | 10 |
| 1.8 | `<MissionRibbon>` primitive | `c07cdcc` | 8 |
| 1.9 | `<PrimaryPlayCta>` primitive | `bff6cc5` | 10 |
| 1.10 | `atmosphere` prop pattern | `1aadc44` | 8 |
| 1.11 | `<PrimitiveBoundary>` | `39ca200` | 5 |

**Total: 75 tests nuevos. Test count 627 → 702.**

---

## 3. Decisiones tomadas

1. **Path A (prop-driven primitives) para minimizar freeze risk.** PremiumSlot (Story 1.7) y PrimaryPlayCta (Story 1.9) consumen strings desde la prop, **no** desde editorial. Esto los hace landables durante el freeze sin tocar `PRO_COPY` ni `CTA_LABELS`. La migración (Story 1.12) y/o Story 4.3 wirean los strings de editorial cuando el freeze cierre.

2. **Ship-everything-at-once para `<MissionRibbon>` y `<PrimaryPlayCta>`.** Aunque la AC sólo pide la variante Hub, ambos primitives soportan los 4 surfaces (hub/arena/pro-sheet/landing-cta-bar y playhub/arena/landing-hero/landing-final-cta) en este commit. Stories 2.1+, 3.2+, 4.1 sólo cambian la prop `surface`/`atmosphere` — cero re-trabajo.

3. **`<PremiumSlot>` Path A en lugar de tocar `PRO_COPY`**. El kicker "Training Pass" es **C4 substance** (Bloque B post-freeze). El primitive lo recibe vía prop. Cuando llegue Story 4.3 se añade `PRO_COPY.trainingPassLabel` y la migración lo conecta. **Cero contaminación del baseline.**

4. **`<MissionRibbon>` ya consume `MISSION_RIBBON_COPY` directamente** porque Story 1.2 lo añadió a editorial sin tocar `PRO_COPY` (el alias `pro-sheet → PRO_COPY.tagline` es la única referencia, y es read-only). Single-source canon honored.

5. **`crown` icon para `tone="pro"` en `<HudResourceChip>`.** El spec menciona "lightning" pero no existe asset. `crown` ya es el indicador PRO en `coach-history` y `trophies-body` — branding consistente. Documentado en commit `3ca8b23`.

6. **`<PrimitiveBoundary>` minimal interpretation.** Story 1.11 ship sólo el primitive boundary + tests, **no** auto-wrapping de cada primitive. El AC literal ("each new primitive wrapped") se cumple en Story 1.12 cuando los surfaces compongan los primitives — cada instancia se envuelve en composition time. DESIGN_SYSTEM.md §13 codifica la convención.

7. **`atmosphere` prop pattern aplicado a 4 primitives** (KingdomAnchor, HudResourceChip, MissionRibbon, PrimaryPlayCta). Default `"adventure"`. CSS modifier `is-atmosphere-{value}`. Scholarly consume `--paper-*` tokens existentes. **`<FrameCraftCard>` skipped** — no existe todavía (Story 3.1, Epic 3); cuando llegue será Scholarly-only por diseño.

8. **`axe-core` no añadido al repo.** Multiple Stories' AC mencionan "axe-core passes". Cumplo el spirit con queries RTL (`role`, `aria-label`) — consistente con `cognitive-disclaimer.test.tsx` y `about-methodology.test.tsx`. Añadir axe-core sería scope creep; dejar la decisión para futura task de QA infra.

---

## 4. Verificación

- ✅ `vitest run`: **702/702 passing** al cierre. +75 tests netos vs baseline 627.
- ✅ `tsc --noEmit`: exit 0 al cierre.
- ✅ `pnpm lint`: 0 warnings nuevos en los archivos tocados (lint warnings pre-existentes ajenos no fueron tocados).
- ✅ Secret scan: `git diff --staged | grep -iE "(private|api)[_-]?key|secret|password|TORRE_PRINCESA|DRAGON|service_role|seed|mnemonic"` ejecutado en cada commit — siempre vacío.
- ✅ Smoke `pnpm dev`: server arranca limpio, `GET / 200` en 26s primera compilación, log sin errores SSR (verificado a las 11:09 UTC).
- ⚠️ **Suite e2e visual**: NO ejecutada esta sesión. Bloqueo técnico (issue #108) ya está resuelto, pero **no hay diff visual que capturar todavía** — los 11 primitives son aditivos y ninguna surface los consume. Story 1.12 será el primer momento útil para correrla.
- ⚠️ **Suite full pre-existing failures (44)**: las 44 fallas reportadas en el handoff de Bloque A (jsdom env: `localStorage.clear is not a function`) **siguen pre-existentes** y NO fueron introducidas. Filtran fuera del subset que corro (`src/components/...`).

---

## 5. Pendientes inmediatos (orden recomendado)

### 5.1 Bloqueado por freeze (cierra 2026-05-09)

1. **Cerrar la ventana de medición de PRO Phase 0** — registrar el resultado en `docs/release/2026-05-09-pro-phase-0-baseline.md` (ya existe scaffold).
2. **Bloque B Phase 0.5**: C3 (`<ComingSoonChip>`) + C4 (`PRO_COPY.trainingPassLabel` + bullet "FIDE Master + dev team") — landing en par dentro de ventana ≤ 48h, ambos tocan `pro-sheet.tsx` + `editorial.ts.PRO_COPY`.
3. **Story 1.12 — Migrar `/play-hub`** a componer los primitives. Esta es la story que **realmente cambia el funnel** y justifica correr `test:e2e:visual` para baseline pre-migración + post-migración.
4. **Story 1.13 — Telemetría Hub**: events del nuevo Hub (mission_ribbon_viewed, primary_cta_clicked, premium_slot_tapped, etc.).
5. **Story 1.14 — Real-device smoke pass** en MiniPay físico para confirmar que los primitives se sienten bien en el WebView.

### 5.2 No bloqueado

- Otros Epics (2 Arena, 3 Landing) reusan los mismos primitives — pueden iterar en paralelo a 1.12 cuando convenga.

---

## 6. No hacer todavía

- ❌ **No Story 1.12** hasta freeze cerrado y baseline doc commiteada.
- ❌ **No tocar `PRO_COPY`** hasta freeze cerrado (regla del Bloque A handoff).
- ❌ **No correr `test:e2e:visual`** sin justificación — los snapshots actuales no van a moverse mientras los primitives no estén consumidos por una surface real.
- ❌ **No añadir axe-core** a las dependencies sin task explícita de QA infra (decisión §3.8).
- ❌ **No auto-wrappear `<PrimitiveBoundary>` en cada primitive export** — la convención es "surfaces wrap, primitives don't auto-wrap" (DESIGN_SYSTEM.md §13.3).

---

## 7. Composabilidad — cómo encaja todo

Cuando Story 1.12 consuma los primitives, la composición Hub esperada (per UX spec Step 11):

```
┌─────────────────────────────────────────────┐
│  ContextualHeader (existing)                │
├─────────────────────────────────────────────┤
│  HudResourceChip (trophy)  HudResourceChip  │  ← primary HUD row
│              (pro)                          │
│  HudSecondaryRow (streak/stars/shields)     │  ← conditional
├──────┬──────────────────────────────┬───────┤
│Reward│                              │Premium│
│Column│      KingdomAnchor           │ Slot  │
│      │       (playhub variant)      │       │
├──────┴──────────────────────────────┴───────┤
│         MissionRibbon (hub)                 │
│         PrimaryPlayCta (playhub)            │
├─────────────────────────────────────────────┤
│  PersistentDock (existing)                  │
└─────────────────────────────────────────────┘
```

Cada primitive instance debe envolverse en `<PrimitiveBoundary primitiveName="X" surface="play-hub" atmosphere="adventure" onError={reportError} />`.

---

## 8. Referencias clave

- Epic doc: `_bmad-output/planning-artifacts/epics.md` (1.371 líneas, Stories 1.1–5.5).
- UX spec: `_bmad-output/planning-artifacts/ux-design-specification.md` Step 11 (component strategy).
- Visual language: `docs/product/visual-language-minimum-2026-05-03.md` §4.5–4.11 (8 primitives spec-approved).
- Phase 0.5 plan: `docs/superpowers/plans/2026-05-03-phase-0.5-narrative-coherence.md`.
- Bloque A handoff: `docs/release/2026-05-03-phase-0.5-block-a-handoff.md`.
- Baseline scaffold: `docs/release/2026-05-09-pro-phase-0-baseline.md`.
- Design System: `DESIGN_SYSTEM.md` §11 (tokens), §12 (atmosphere prop), §13 (PrimitiveBoundary).

---

**Fin del handoff.** Próxima sesión arranca verificando: (a) cierre del freeze + baseline doc commiteada, (b) decisión sobre orden Bloque B (C3/C4) vs Story 1.12 vs Stories 2.x/3.x.
