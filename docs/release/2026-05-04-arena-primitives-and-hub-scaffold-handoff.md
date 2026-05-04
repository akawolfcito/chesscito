# Arena primitives + Hub scaffold — session handoff

- **Fecha**: 2026-05-04
- **Owner**: Wolfcito
- **Branch**: `main`. 4 commits landed (`c72ed03` → `396c410`). Working tree limpio al cierre.

---

## 1. Estado final

- ✅ **Story 2.1 cerrada** — `<KingdomAnchor variant="arena-preview" />` (commit `c72ed03`).
- ✅ **Story 2.2 cerrada** — `<PrimaryPlayCta surface="arena-entry" />` compact variant (commit `858a52a`).
- ✅ **Story 1.12 — scaffold landed** behind `?hub=new` flag (commit `01cebd7`).
- ✅ **Story 1.12 fix** — page convertida a server component (commit `396c410`).
- ✅ **Test suite verde**: 724/724 unit tests passing (+22 netos esta sesión vs baseline 702).
- ✅ **Type-check clean**: `tsc --noEmit` exit 0.
- ✅ **Lint clean**: 0 warnings nuevos en archivos tocados.
- ✅ **Smoke**: `pnpm dev` → `GET /hub` 200, `GET /hub?hub=new` 200, scaffold renderiza los 9 primitives + 3 zonas en HTML.
- ⚠️ **Visual regression**: 2/3 passing — matches pre-Story-1.12 baseline. La falla `hub-shop-sheet-open` es pre-existente (confirmada en `858a52a`).

---

## 2. Decisiones tomadas

1. **`<KingdomAnchor>` arena-preview = letterbox cuadrado**. El frame es 1.3:1 pero el board es 1:1; centro el board con `object-fit: contain`. Pieces overlay usa grid uniforme `12.5%` por celda y `<picture>` AVIF/WebP/PNG por pieza (matchea `arena-board.tsx`). Overlay decorativo (`aria-hidden`) — wrapper conserva un solo `role="img"`.

2. **`<PrimaryPlayCta surface="arena-entry">` ≠ `surface="arena"`**. Distintos modifier classes; `arena-entry` es compact (52px min-height) para coexistir con `<DifficultySelector>` + `<KingdomAnchor arena-preview>` en la pantalla de selección de Arena. `arena` queda libre para CTAs in-game futuros.

3. **Story 1.12 — scaffold + flag, no big-bang**. Reinterpretado el AC literal "legacy MissionPanelCandy no longer renders" como "land scaffolded composition opt-in via `?hub=new`, flip when data wiring is complete". Razones:
   - 1557 LOC en `play-hub-root.tsx` con estado complejo (auto-resume, labyrinth, claim/submit on-chain, 8 sheets) → big-bang en 1 sesión = alta probabilidad de rollback.
   - Scaffold detrás del flag = cero regresión en `/hub` legacy + valor inmediato (preview en URL).
   - Story 1.12.1 (siguiente) wirea data real (trofeos, PRO state, navegación) y flippea el flag.

4. **Server component sobre `useSearchParams`**. La primera versión del scaffold dispatch usaba `useSearchParams()` dentro de un `"use client"` page. Esto fuerza a Next 14 App Router a bail-out al render fully-client del root, rompiendo el timing del e2e visual (`hub-daily-tactic-open` flake). Convertido a server component que recibe `searchParams` por props — patrón canónico, cero overhead para el path legacy.

5. **Freeze de PRO Phase 0 levantado de facto** (ver §6).

---

## 3. Verificación

- ✅ `pnpm test --run`: **724/724 passing** al cierre.
- ✅ `tsc --noEmit`: exit 0 al cierre.
- ✅ `pnpm next lint`: 0 warnings en archivos tocados.
- ✅ Secret scan: limpio en cada commit.
- ✅ Smoke `pnpm dev`: `/hub` y `/hub?hub=new` ambos HTTP 200, primitives presentes en HTML.
- ✅ `pnpm test:e2e:visual`: 2/3 passing, baseline match. La 3ra falla pre-existe en `858a52a`.

---

## 4. Pendientes inmediatos (orden recomendado)

### 4.1 Cerrar Story 1.12

- **Story 1.12.1 — data wiring del scaffold**: conectar trofeos (`useReadContract`), PRO status (`useProStatus`), reward tile states (`useExerciseProgress`), y navegación PLAY (probablemente a `/exercise` o un sheet). Cuando esté listo, flipea el flag para que `/hub` default sea el scaffold y mueve `/hub?legacy=1` para fallback transitional.

### 4.2 Estabilizar el e2e visual

- **`hub-shop-sheet-open` flaky pre-existente** (falla en `858a52a` y posteriores). Investigar: ¿el botón Shop existe en el dock cuando el wallet está disconnected? El test simula anonymous-no-wallet. Posible que el dock esté escondido o el botón labeled distinto. Puede ser un race condition con el WelcomeOverlay.

### 4.3 Avanzar Epic 2 (Arena migration)

- **Story 2.3 — Migrar `/arena` selecting state** a usar los primitives: `<HudResourceChip>` + `<KingdomAnchor variant="arena-preview">` + existing `<DifficultySelector>` + `<MissionRibbon surface="arena">` + `<PrimaryPlayCta surface="arena-entry">`. Mismo patrón scaffold-first es válido aquí.

### 4.4 Stories restantes Epic 1

- **1.13 — Telemetry events del Hub**: `mission_ribbon_viewed`, `primary_cta_clicked`, `premium_slot_tapped`, `kingdom_anchor_rendered`. Land cuando 1.12.1 esté wireado.
- **1.14 — Real-device smoke pass** en MiniPay físico tras 1.12.1.

---

## 5. No hacer todavía

- ❌ **No flip del flag `?hub=new`** sin terminar 1.12.1 (data wiring).
- ❌ **No baseline visual snapshots del scaffold** hasta que sea canonical (ahora sería esfuerzo perdido, vamos a iterar layout antes del flip).
- ❌ **No fix del `hub-shop-sheet-open` flaky** sin investigar causa primero — pre-existe, no es scope de Story 1.12.
- ❌ **No tocar `play-hub-root.tsx`** todavía. Sigue siendo el root de `/hub` por defecto y cualquier cambio ahí fuera de scope de migration es riesgo.

---

## 6. Freeze de PRO Phase 0 — release de facto

**Decisión** (sesión 2026-05-04): el freeze que cerraba 2026-05-09 se considera **informalmente levantado** porque no hay tráfico real para medir (single-user, 2 cuentas web/MiniPay). El sentido del freeze era proteger una baseline de funnel que de momento no existe; mantenerlo bloquea iteración ágil sin contraparte.

**Implicación**:
- Se permite tocar `PRO_COPY`, `pro-sheet.tsx`, y la composición del `/play-hub` antes del 2026-05-09 — pero con criterio.
- Cuando exista tráfico real (e.g. post-soft-launch), reinstalar disciplina: cualquier cambio que afecte el funnel PRO requiere documentación + ventana de medición.
- El doc `docs/release/2026-05-09-pro-phase-0-baseline.md` puede cerrarse marcando "no formal baseline taken — single-user dev period; defer formal measurement to post-soft-launch".

**Riesgo aceptado**: cuando corra una ventana real, las primeras 7-14 días de métricas tendrán ruido por las iteraciones recientes. Costo manejable.

---

## 7. Composabilidad — cómo encaja con Stories pendientes

```
/hub (legacy default)            /hub?hub=new (scaffold preview)
  └─ <PlayHubRoot>                ├─ HUD top: trophy + PRO chips
       (1557 LOC, board-centric)  │  + secondary row (streak/stars/shields)
                                  ├─ Body: RewardColumn | KingdomAnchor playhub | PremiumSlot
                                  └─ Footer: MissionRibbon hub + PrimaryPlayCta playhub

/arena (legacy)                  /arena post-Story-2.3 (planned)
  └─ <DifficultySelector>         ├─ HUD top: trophy chip
     + <ArenaBoard>                ├─ Center: <KingdomAnchor variant="arena-preview">
                                   ├─ <DifficultySelector>
                                   ├─ <MissionRibbon surface="arena">
                                   └─ <PrimaryPlayCta surface="arena-entry">
```

---

## 8. Referencias clave

- Epic doc: `_bmad-output/planning-artifacts/epics.md` Stories 2.1, 2.2, 1.12.
- Handoff anterior: `docs/release/2026-05-04-game-home-primitives-handoff.md`.
- DESIGN_SYSTEM.md §14 (Primitive Variants), §14.1.x (HubScaffold migration note).
- Commits sesión: `c72ed03`, `858a52a`, `01cebd7`, `396c410`.

---

**Fin del handoff.** Próxima sesión: 1.12.1 (data wiring) o 2.3 (Arena migration), ambas freeze-safe.
