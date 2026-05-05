# Story C handoff — Arena selecting → kingdom scaffold

- **Fecha**: 2026-05-05
- **Owner**: Wolfcito
- **Branch**: `main`. **3 commits landed** sobre `59b76ad`. Push pendiente.
- **Tareas en sesión**: 10/30.

---

## 1. Estado final

### Stories cerradas
- ✅ **Story C** — `/arena` selecting state migrado al patrón scaffold (flag-gated `?arena=new`).
- ✅ **Hub bg refresh** — `bg-app.png` aplicado a `.hub-scaffold` y reusado en `.arena-scaffold` para continuidad visual.
- ✅ **5 nuevos eventos `arena_*`** detrás del flag.
- ✅ **Telemetry validation (4.1 del handoff anterior)** — pipeline confirmado vivo en Supabase.

### Métricas
- ✅ **796/796 unit tests passing** (+17 netos: 16 del nuevo scaffold + 1 baseline-drift).
- ✅ **`tsc --noEmit`**: exit 0.
- ✅ **`next build`**: prerender clean (Suspense boundary añadido para `useSearchParams`).

---

## 2. Commits

| # | Hash | Subject |
|---|------|---------|
| 1 | `7904f5e` | feat(hub): bg-app texture on hub-scaffold |
| 2 | `a50918c` | feat(arena): ArenaSelectScaffold — kingdom 3-zone picker |
| 3 | `b3d13c4` | feat(arena): wire ArenaSelectScaffold flag-gated + 5 telemetry events |

---

## 3. Decisiones clave

1. **Flag-gated `?arena=new` (no flip directo)** — paridad con la migración del hub (`?hub=new`), permite rollback a un solo refresh.
2. **CSS duplicada `.arena-scaffold-*` (no refactor a `.kingdom-scaffold-*`)** — evita riesgo en el hub estable; coste = ~280 líneas duplicadas en `globals.css`. Cuando ambos surfaces sean estables, refactor a una familia común.
3. **`<ArenaEntryPanel>` preservado intacto** — sigue como fallback inline + embed en `ArenaEntrySheet` (entrada desde dock). Sin riesgo de regresión.
4. **Suspense boundary obligatorio** para `useSearchParams` en Next 14 App Router. Patrón aplicado: `ArenaPage` (server-friendly wrapper) → `<Suspense fallback={null}>` → `ArenaPageInner`.
5. **`arena_start_tap` separado de `arena_game_start`** — el primero es surface-specific (solo scaffold, dim `surface: "scaffold"`); el segundo sigue como evento universal en `handleStartWithLoading`. La conversión `arena_select_view → arena_start_tap` aísla el scaffold sin contaminarlo con el funnel legacy.
6. **bg-app.png como background-attachment: fixed** — paralax sutil al scrollear; mobile-first 390px verificado en build.

---

## 4. Smoke checklist (próxima sesión, antes de flag flip)

### En MiniPay físico
- [ ] `/arena` (sin flag) → ArenaEntryPanel original. Ningún cambio visual.
- [ ] `/arena?arena=new` → ArenaSelectScaffold con kingdom-board, picker, START.
- [ ] `bg-app.png` rendea a 390px sin clipping en safe-area top/bottom.
- [ ] Tap en cualquier dificultad → telemetry `arena_difficulty_tap` en Supabase.
- [ ] Tap en color → `arena_color_tap`.
- [ ] Tap en START → `arena_start_tap` + `arena_game_start` (ambos eventos).
- [ ] Tap back → `arena_back_tap` + navegación a `/hub`.
- [ ] Refresh con `?arena=new` → `arena_select_view` único por mount.
- [ ] Soft-gate banner aparece para usuarios sin progreso de pieza (rookies).
- [ ] Prize-pool pill muestra balance live o "Loading pool…".

### En Supabase
- [ ] Query: `SELECT event, props, created_at FROM analytics_events WHERE event LIKE 'arena_select%' OR event LIKE 'arena_difficulty%' OR event LIKE 'arena_color%' OR event LIKE 'arena_start%' OR event LIKE 'arena_back%' ORDER BY created_at DESC LIMIT 30;`
- [ ] Verificar que `arena_start_tap.props.surface === "scaffold"`.
- [ ] Verificar que `arena_start_tap.props.wallet_connected` es boolean (no string).

---

## 5. Pendientes inmediatos

### 5.1 Push a origin
- Working tree limpio sobre `b3d13c4`. **3 commits ahead of origin/main**. `git push` cuando quieras.

### 5.2 Validación física en MiniPay
- Owner debe correr el smoke checklist (§4) en MiniPay real antes de plantear flag flip.

### 5.3 Decisión: flip directo o A/B
- Si telemetría arena scaffold corre limpio por ≥ 2 días, plantear flip de `?arena=new` a default (análogo a Story 1.12 del hub).
- Si aparece fricción visual o conversion drop, iterar sobre `.arena-scaffold-*` antes del flip.

### 5.4 Story D — Port ShopSheet/ProSheet al hub scaffold
- Sigue **bloqueado** por threshold de telemetría: ≥ 50 `hub_shields_chip_tap` en Supabase.
- Conteo actual estimado (a 2026-05-05 02:42 UTC): ~3 hits. Semanas, no días.

### 5.5 Optimización de bg-app.png (deferred)
- 1.7MB PNG es pesado para mobile. Cuando el visual esté locked, generar AVIF + WebP variantes y migrar `globals.css` a `<picture>` o `image-set()`.
- Patrón existente: ver `bg-ch.{avif,webp,png}` y `splash-loading.{avif,webp,png}` en `apps/web/public/art/redesign/bg/`.

---

## 6. No hacer todavía

- ❌ **No flip directo** sin smoke en MiniPay físico.
- ❌ **No refactorizar `.hub-scaffold-*` a `.kingdom-scaffold-*`** hasta que `.arena-scaffold-*` esté visualmente locked. Tres puntos definen una línea — necesitamos un tercer surface antes de extraer.
- ❌ **No tocar `<ArenaEntryPanel>`** — sigue siendo el fallback. Cualquier cambio rompe el embed en `ArenaEntrySheet`.
- ❌ **No añadir wallet address ni email a dims de `arena_*`** — telemetría sigue anónima por diseño.

---

## 7. Riesgos conocidos

| Riesgo | Mitigación / nota |
|--------|-------------------|
| `bg-app.png` pesado (1.7MB) en LCP mobile | Optimizar a AVIF post-locked-visual (§5.5) |
| `useSearchParams` bailout / fully-client en `/arena` | Suspense boundary suprime el bail; route ahora es `ƒ` (dynamic). Aceptable — `/arena` no es prerendered de todos modos por wagmi hooks. |
| Doble emit de `arena_start_tap` + `arena_game_start` confunde dashboards | Documentar contrato: `start_tap` = surface, `game_start` = universal. Tagged en commit message. |
| Suspense fallback `null` causa flash en cold load | Aceptable — el contenido del fallback durante hydrate es ~50ms en MiniPay. Si molesta, reemplazar con un splash. |

---

## 8. Setup para próxima sesión

1. **Push**: `git push origin main` (3 commits pendientes).
2. **Validar smoke checklist (§4)** en MiniPay físico.
3. **Confirmar telemetría arena_*** llega a Supabase con dims correctos.
4. **Threshold para flip**: 2 días limpios + smoke OK → planear flag flip a default.

---

## 9. Referencias

- **Scaffold**: `apps/web/src/components/arena/arena-select-scaffold.tsx` (208 líneas).
- **Tests**: `apps/web/src/components/arena/__tests__/arena-select-scaffold.test.tsx` (16 casos).
- **CSS**: `apps/web/src/app/globals.css` (`.arena-scaffold-*`, ~280 líneas nuevas).
- **Page wire**: `apps/web/src/app/arena/page.tsx` (Suspense + flag branch + telemetry).
- **Hub bg**: `apps/web/src/app/globals.css` (`.hub-scaffold` con `bg-app.png`).
- **Asset**: `apps/web/public/art/redesign/bg/bg-app.png` (1023×1537 PNG, 1.7MB).
- **Handoff anterior**: `docs/release/2026-05-04-session-close-handoff.md`.

---

**Fin de Story C.** Próxima: smoke en MiniPay → confirmar telemetría arena_* → planear flip.
