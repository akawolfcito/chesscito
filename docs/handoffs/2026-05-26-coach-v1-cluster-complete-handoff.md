# Handoff — Coach V1 Cluster (A1 + A2 + A3 + A4) Complete (2026-05-26)

**Owner:** Wolfcito · **Co-pilot:** Claude
**Branch:** `main` — **18 commits pushed** (range `dd83e48a..2fd9e7e2`).
**Push status:** ✅ `origin/main` sincronizado 2026-05-26.
**Status:** V1 cluster cerrado end-to-end. 7/8 tareas planeadas closed; la 8va (A4) pivotó a foundation + canonical migration.
**Predecessor handoff:** `docs/handoffs/2026-05-26-coach-v1-task2-handoff.md`

---

## TL;DR

V1 del Coach demo redesign + Visual polish foundation está 100% shipped:

1. **Task 5** — Paywall en voz de Luz ("I'm still here / Vi tu partida.").
2. **Task 6** — `/coach/history` AskLuzBanner mostrado cuando free user tiene 0 créditos; ruteo a `/arena?fresh=1`. Reemplaza el `credits={0}` hardcoded por `useCoachCredits()` real.
3. **A2** — Coach packs (x5/x20) ahora son tiles regulares del Shop sheet, con post-buy `verify-purchase` wiring paralelo a SHIELD/PRO.
4. **A3** — PRO Sheet hero con headline locked ("Chesscito que crece con vos") + AccountSheet "Mi Coach" row con status-aware pill (Talking / Free / Sin gratis).
5. **A4** — Pivot estratégico de "PRO recognition" a **theme system**. Registry + 3 hooks + audit doc + KingdomAnchor migrado como canonical example. Foundation lista para recibir packs nuevos (Halloween, Christmas, pro-gold-leaf) sin tocar componentes.

**Métricas**:
- Tests: 2022 → **2042 / 0 failing** (+20 net).
- Type-check: clean.
- VR: 13/13 verde (1 baseline refresh validado en A2 para shop sheet +2 tiles).
- 18 commits pushed a `origin/main`.

---

## Commits (18, en orden cronológico)

| # | SHA | Scope |
|---|---|---|
| 1 | `dd83e48a` | test(coach): cover paywall Luz copy via COACH_COPY |
| 2 | `d3e70b03` | feat(coach): rewrite paywall copy in Luz voice |
| 3 | `65e32819` | feat(coach): add historyAskNext copy keys in Luz voice |
| 4 | `df01e26e` | feat(coach): AskLuzBanner card for /coach/history paywall handoff |
| 5 | `30eff4f2` | feat(coach): mount AskLuzBanner in history page when free user is at 0 calls |
| 6 | `156917e9` | feat(pro): rewrite PRO sheet hero in V1 brand voice |
| 7 | `7e4f0168` | feat(account): add Mi Coach row copy keys (EN + ES) |
| 8 | `6ad70744` | feat(account): AccountCoachRow component + tests |
| 9 | `8fdc1507` | feat(account): mount AccountCoachRow between PRO and Language rows |
| 10 | `5eea57de` | feat(shop): add coachPack5/20 SHOP_ITEM_COPY keys (EN + ES) |
| 11 | `664ea68b` | feat(shop): register coach packs in SHOP_ITEMS + SHOP_TILE_ASSETS |
| 12 | `de5f65a2` | feat(shop): map coach pack itemIds in shop-sheet copyKeyForItem |
| 13 | `fcc3f54f` | feat(shop): credit coach packs via verify-purchase post-buy |
| 14 | `6b1b7cc1` | test(vr): refresh hub-shop-sheet-open baseline for coach pack tiles |
| 15 | `e1aee1f6` | feat(themes): theme registry + candy-forest baseline |
| 16 | `608e3d25` | feat(themes): useActiveTheme + useThemeAsset + useOwnedThemes hooks |
| 17 | `baa0b585` | docs(themes): foundation audit + adoption playbook (A4) |
| 18 | `2fd9e7e2` | refactor(kingdom): adopt useThemeAsset for hub.portal swap |

---

## Decisiones clave de la sesión

### 1. Paywall cierre cálido (Task 5)
- Discovery §5 sample en español → EN canonical + ES mirror, ambos sin em/en-dashes.
- Mantengo el paywall ofreciendo solo packs (no PRO inline) — copy ajustada para coincidir con la UI real ("Add a pack and we keep talking"). Mención PRO queda para A3 si se integra al sheet.

### 2. Soft empty state en `/coach/history` (Task 6)
- AskLuzBanner mount: `connected && !isPro && credits === 0`. Tap → `/arena?fresh=1`.
- Single-source-of-paywall: el `CoachPaywall` Sheet sigue viviendo solo en arena. History page rutea, no monta paywall local. Evita duplicar wiring de `onBuy` y mantiene un solo lugar donde se vende packs.

### 3. PRO Sheet hero V1 (A3)
- Headline locked en EN/ES: "Chesscito that grows with you" / "Chesscito que crece con vos".
- Subline locked: "The more you play, the more it unlocks" / "Mientras más jugás, más app desbloqueás."
- Aliasing en `MISSION_RIBBON_COPY["pro-sheet"]` se mantiene (cero callsites prod).

### 4. Mi Coach row en AccountSheet (A3)
- Sub-componente `AccountCoachRow` extraído para testabilidad (AccountSheet sigue siendo función privada en `exercises-screen.tsx`).
- Status pill computada per-state: PRO `active`/Conversa, free+credits `celo`/Free, free+0 `inactive`/Sin gratis.

### 5. Coach packs en Shop catalog (A2)
- Items 3n y 4n YA estaban configurados on-chain (el paywall los vende hoy via `arena/page.tsx:handleBuyCredits`). A2 = solo UI work.
- Placeholder assets: reuso `/art/redesign/icons/coach` para icon en ambos packs, `bg-shield` para x5 / `bg-pro` para x20 (diferenciación visual sin generar arte nuevo).
- Post-buy wiring: `useShopSheetState` ahora awaitea receipt + POSTea `/api/coach/verify-purchase` para itemIds 3/4 (paralelo a SHIELD/PRO).
- Telemetría: `shop_buy_tx.source` flippea a `shop_coach_5` / `shop_coach_20` para separar conversiones shop vs paywall.

### 6. Pivot estratégico A4 → theme system
- Wolfcito rechazó el modelo "2 codepaths" (free vs PRO per surface). Vision: una app, N themes (candy-forest hoy, pro-gold-leaf / halloween-2026 / christmas-2026 después).
- Theme = asset pack vendible como Shop SKU. PRO sub auto-otorga `pro-gold-leaf`.
- Foundation shipped: registry + 3 hooks + audit + KingdomAnchor migrado. Cero rework en otras pantallas — adopción es opt-in cuando una pantalla queda final.

---

## Estado del repo

- Tests: 2042/0 failing.
- Type-check: clean.
- VR: 13/13 green.
- Memoria actualizada: `project_theme_system_foundation.md` agregado. `project_pro_recognition_pattern.md` marcada SUPERSEDED para reskin (sigue válida para CTAs/copy gating).
- MEMORY.md actualizada con entries de theme system + nota de superseded.

---

## Open follow-ups

### Theme system (next phases — todos sin urgencia)

1. **localStorage persistence** para `useActiveTheme` — hoy hardcoded a `candy-forest`. Necesita `chesscito:theme:active` key + lectura en el hook.
2. **AccountSheet theme picker** — UI que liste owned themes con preview thumbs + tap-to-activate. Necesita THEME_COPY editorial namespace.
3. **Shop wiring** — itemId → theme id mapping. Después de `setItem` on-chain, agregar verify-purchase grant del theme.
4. **`verify-pro` grant** — al verificar una compra PRO, agregar `pro-gold-leaf` al owned-themes ledger por la duración del sub.
5. **Asset-presence linter** — script que walkea `THEMES` registry + checkea que cada path tenga `.png/.webp/.avif`.
6. **Migración del resto de surfaces** — board, pieces, screen backgrounds, shop tile bgs. Cada uno espera a polish-final per audit §4.2.

### Otros pendientes

7. **Push de assets pro-gold-leaf** — cuando Sally/diseño tenga el arte, drop en `/art/themes/pro-gold-leaf/` + agregar `ThemeDefinition` en registry. Adopción inmediata via KingdomAnchor sin tocar componente.
8. **Editorial dead copy cleanup** — `welcomeTitle/Sub/Pack/...` quedó deprecado tras Luz; ok dropearlo en el próximo content audit. Sin urgencia.
9. **Adopt `useCoachCredits` en `arena/page.tsx`** — hoy usa state local + manual fetch; el hook tiene localStorage cache. Solo cuando se justifique por UX (cold start lento en MiniPay).
10. **Per-wallet welcome flag** — `chesscito:coach-welcomed` es per-device; mismo user en otra wallet no recibe greet. Decisión deferred del Task 3.

---

## ¿Estamos listos para recibir/crear assets de un theme nuevo?

**Sí para recibir**:
- Registry está expuesto, drop una entry en `THEMES` con paths + ya queda registrado.
- KingdomAnchor sirve el portal nuevo automáticamente cuando ese theme esté activo (porque ya consume `useThemeAsset("hub.portal", variant)`).
- Resto de superficies aún no migradas → ese theme nuevo solo cambia el portal por ahora. Para una reskin completa de la app, hay que migrar las 7 superficies pendientes (board, pieces, backgrounds, shop tile bgs).

**No para activar todavía**:
- `useActiveTheme` hoy devuelve `candy-forest` hardcoded → no se puede activar otro theme aún. Necesita follow-up 1 (localStorage persistence) + 2 (picker UI).
- Ownership / Shop wiring (follow-ups 3 + 4) son necesarios para que un theme PURCHASED se le otorgue al usuario.

**Conclusión**: foundation lista para drop de art (registry + KingdomAnchor) y para escalar (manifest + hooks). Para una experiencia user-facing de "cambiar tema completo", faltan los 4-5 follow-ups arriba listados — pero todos son aditivos, ninguno bloquea polish de pantallas.

**Camino recomendado**:
1. Mientras vos polís pantallas críticas, no tocás nada de theming.
2. Cuando una pantalla queda final, la migrás (1 commit per surface, ~5 min de trabajo siguiendo §4 del audit).
3. Cuando llegue el primer theme pack art, lo registrás + ya queda activable (con los follow-ups 1+2 listos).
4. Follow-ups 1+2 podemos hacerlos en una sesión corta (~2h) cuando vos quieras desbloquear theme switching.

---

## Próxima sesión — arrancar acá

1. Leer este handoff.
2. `git log -1` debería estar en `2fd9e7e2 refactor(kingdom): adopt useThemeAsset for hub.portal swap`.
3. Decisión de scope:
   - **Polish de pantallas** (lo que tenías en cola — feedback MiniPay reciente).
   - **Foundation completion** (follow-ups 1+2 para desbloquear theme switching).
   - **Asset drop** (cuando llegue arte del primer theme pack).
   - **Cualquier feature nueva** desligada de este cluster.

---

## Test trajectory

```
Session start:    2022 / 0 failing (post-handoff 2026-05-26 task2)
After Task 5:     2023 / 0 failing
After Task 6:     2026 / 0 failing
After A3:         2031 / 0 failing
After A2:         2032 / 0 failing
After A4:         2042 / 0 failing (+20 net new tests across the cluster)
```

Type-check clean en todos los checkpoints. VR refresh único en A2 (shop sheet +2 tiles, baseline validado por visual inspection).
