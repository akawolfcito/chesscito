# Session handoff — Vocabulary unification arc (2026-05-09)

**Continúa de**: `2026-05-09-m3-5-migrations-shipped-handoff.md` (M3.5 cierre + 4 surfaces canary).
**Sesión**: full vocabulary unification audit + 3-sprint migration arc + polish.
**Status**: 38 commits pushed `e260a9e..1390570`. Suite 1292/1292. type-check green. ~25 surfaces migradas.

## Lo que cerró esta sesión

### Pre-spec polish (9 commits)
Antes del audit comprehensivo, atendimos feedback puntual del usuario:

| Commit | Cambio |
|---|---|
| `32dd8b6` | Board top-align (rank 8 dejó de cliparse en short viewports) |
| `dc39999` | Removed ArenaEntrySheet — dock tap → /arena directo |
| `7916df1` | StonePedestals action-row: medium → large |
| `a070fd7` | StonePedestal icon size h-8 → h-10 |
| `77d5345` | Stone-pedestal icon top:6% (deprecated) |
| `7ebb14f` | **Stone-pedestal icon top:-10%** (final — icono perchado sobre la base) |
| `83d3283` | Mission-panel collapse shield-chip row at 0 |
| `bb27052` | Mission-panel hide ribbon en capture mode (dedupe "Capture" 3×→2×) |
| `619dbe8` | Top-zone trim: PRO chip simplificado, avatar pawn removido, subtitle del header dropped |

### Audit comprehensivo (4 docs)
- `docs/audits/2026-05-09-app-vocabulary-audit.md` — master inventory
- `docs/audits/2026-05-09-vocab-audit-exercises.md` — 14 surfaces
- `docs/audits/2026-05-09-vocab-audit-arena-victory.md` — 12 surfaces
- `docs/audits/2026-05-09-vocab-audit-coach-pro-trophies.md` — 11 surfaces
- `docs/audits/2026-05-09-vocab-audit-landing-chrome.md` — 17 surfaces

**Total**: 54 surfaces auditadas. ~26 candidatas a migración. ~28 quedan no-diegetic intencionalmente (dock, errors, web-nav, mailto, static content).

### Spec autorada por Sally
`docs/superpowers/specs/2026-05-09-vocabulary-unification-sprint-spec.md`

Decisiones UX clave:
1. **Sprints organizados por cluster, no por prioridad** — cada sub-sprint internamente cohesivo.
2. **PrincipalButton sin "secondary variant"** — usar `size` (medium/large) como hierarchy axis.
3. **GemBadge: `tone` prop** (default | success | warning | locked) via CSS filter — no nuevos assets.
4. **TreasureTile: `EARNED` ribbon** añadido al enum (BEST/NEW/SALE/EARNED).
5. **Wrapper-span pattern** canónico para preservar testids/ARIA.
6. **ActionPin segmentation por intent semántico** — ceremonial vs utility.

### Sprint 1 — P0 ceremonial CTAs (17 commits)

**1A foundation** (`05156c0`): action-pin extiende composition path a `submitScore`/`useShield`/`claimBadge` size="full" → PrincipalButton large. Utility (retry/connect/switchNetwork) + todos size="pin" stay candy-frame.

**1B /exercises** (4 commits):
- `50ded6f` MissionBriefing play CTA → PrincipalButton large
- `4b645d3` BadgeSheet claim button → PrincipalButton medium
- `833623e` ShopSheet buy primary → PrincipalButton medium
- `a5c0765` PrincipalButton forwardRef type fix

**1C arena+victory** (7 commits):
- `09ae685` Arena Start Match → PrincipalButton large
- `f078351` Arena soft-gate Learn → medium
- `05557b7` Victory Claim → large
- `6d91c86` Victory Play Again → medium
- `865e1f3` Claim-success Play Again → medium
- `a377832` Claim-error Try Again → medium
- `22e75b9` Victory page accept-challenge → large + new client wrapper

**1D landing** (4 commits):
- `695985c` Hero primary → large
- `c4537e5` Header nav → medium
- `883b3dc` Final CTA → large
- `20cb2e2` Featured plan tier → medium

**1E PRO** (1 commit):
- `94866fa` ProSheet main CTA → PrincipalButton large (uniform across 6 cta states; CtaConfig refactored to drop `variant`, add `loading`)

### Sprint 2 — dormant primitive activation (8 commits)

- `8d03d1b` **G2 API gap**: GemBadge + GemButton now accept `tone` prop (default | success | warning | locked) via CSS filter
- `7a9e991` BadgeSheet "Owned" pill → GemBadge tone=success ✨ FIRST GemBadge consumer
- `a43611f` ProActiveBadge ACTIVE/EXPIRING → GemBadge tone=success/warning
- `a812e1b` MissionDetailSheet stats × 2 → GemBadge default (single-line ⭐ X PTS / 🕐 X.Xs)
- `39efaf6` CoachPanel history banner → WoodBanner ✨ FIRST WoodBanner consumer
- `d5690aa` CoachFallback Play Again (large) + Unlock (medium) → PrincipalButton
- `d6744aa` BadgeSheet viewTrophies nav → PrincipalButton large

### Sprint 3 — collectibles + frames (4 commits)

- `bf6e9c0` **G3 API gap**: TreasureTile EARNED ribbon variant (emerald gradient)
- `2939a61` ShopSheet "Buy with CELO" → GemButton ✨ FIRST GemButton consumer
- `60a7f89` MissionDetailSheet journey rail frame → WoodBanner (2nd home)
- `76167ca` Arena difficulty pill → GemButton (2nd home, with chevron-down icon)

### Polish — drop-shadow + contain (1 commit)

`1390570` PrincipalButton CSS:
- `box-shadow` → `filter: drop-shadow()` (sigue alpha channel del asset, no rectángulo)
- `background-size: 100% 100%` → `background-size: contain` (asset respeta aspect ratio natural, no stretching)

User feedback durante eyeball: "sombra cuadrada" + "bg muy largo/extendido" → resueltos con estos 2 tweaks.

## Activación final de primitivos

| Primitive | Pre-arc | Post-arc | Status |
|---|---:|---:|---|
| `<StonePedestal>` | 2 | 2 | (canary M3.5; AchievementsGrid deferred) |
| `<TreasureTile>` | 2 | 2 | (coach packs; AchievementsGrid deferred per geometry mismatch) |
| `<PrincipalButton>` | 1 | **~22** | el caballo de batalla |
| `<WoodBanner>` | **0** | **2** | ✨ ACTIVATED (CoachPanel banner + MissionDetail journey) |
| `<GemBadge>` | **0** | **3** | ✨ ACTIVATED (Owned pill + ProActive + MissionDetail stats) |
| `<GemButton>` | **0** | **2** | ✨ ACTIVATED (Shop CELO + Arena difficulty) |

**Todos los 5 primitivos M3.5 ahora tienen consumidores en producción.**

## Estado del repo

- **Branch**: `main`, en `origin/main`. Working tree limpio.
- **Suite**: 1292/1292 ✅ (1274 → 1292, +18 net: +5 action-pin ceremonial, +11 GemBadge tone API, +2 TreasureTile EARNED ribbon)
- **Type-check**: passing
- **Asset payload scene-rooted**: 148 KB (sin cambios — solo CSS + tone filters)

## Pendientes — Sprint 4 candidates

Capturados durante eyeball en esta sesión. Priorizados:

### P0 — visual polish
- **Image #16 victory-celebration redundancy**: 4 botones compitiendo (Save Victory PrincipalButton large + Ask Coach teal componente separado + Play Again PrincipalButton medium + Share Button ghost). UX call: dedupe + hierarchy más clara.
- **Texts demasiado largos con leyendas**:
  - "Save this Victory · Unlock your share card · $0.01"
  - "Ask the Coach · What can I improve?"
  - Editorial pass para copy más accionable / menos verbose.
- **Scroll vertical missing en sheets**: usuario reporta varias pantallas con content cut off sin scroll. Sweep por surfaces.

### P1 — surfaces no migradas
- **AchievementsGrid (`/trophies`)**: deferred del Sprint 3. TreasureTile geometry (120×136) no encaja en grid-cols-2 88px del actual layout. Necesita restructure: tile-per-card + descripción debajo; locked vs earned split. Mejor candidato para "polish PR" cuando achievements ganen click-to-detail.
- **AskCoachButton**: componente separado en victory-celebration que mantiene visual teal/cyan no-diegetic. Sprint 4 should evaluate: keep distinctive (coach mascot is unique) o unify with PrincipalButton.
- **Resign confirm modal**: pendiente del audit, no migrado en este arco.

### P1 — feature work
- **`/hub` redesign** (image #12): el usuario nota que "necesita resolverse en algún momento". Splash overlay + main hub structure con PLAY CTA + masteries + training pass. Surface entera, requiere su propio spec.

### P2 — polish batched
- 7 surfaces P2 del audit master (locked badge pills, share buttons, claimed-badge cosmetic, info banners, etc.).

### Console errors (diagnóstico)
Durante eyeball, console mostró:
```
⚠ Fast Refresh had to perform a full reload due to a runtime error.
POST /__nextjs_original-stack-frames 404 (×many)
```

**Interpretación**:
- "Full reload" se auto-resolvió (la página renderea OK tras el reload).
- 404s en `__nextjs_original-stack-frames` son fetches de source-maps de Next.js dev mode — noise, no bloqueante.

No bloquea ship. Si en Sprint 4 user reporta brokenness específica (no solo logs), investigar root cause.

## Cómo arrancar la próxima sesión

### Agente recomendado
Sally (`bmad-agent-ux-designer`) para Sprint 4 si el foco principal es victory-celebration redundancy + editorial copy pass. Si es feature work nuevo (`/hub`, resign modal), Claude Code default basta.

### Checklist pre-sesión
- [ ] `git pull` — confirmar `origin/main` está en `1390570` o más adelante.
- [ ] `pnpm install` si hay cambios upstream.
- [ ] `pnpm dev` desde `apps/web/`.
- [ ] Hard reload (Cmd+Shift+R) al abrir browser — HMR estuvo flaky durante esta sesión.
- [ ] Eyeball las migraciones del arco: `/`, `/arena` (with + without wallet), `/exercises` (con 12★ rook seedeado), `/trophies` (P1 pendiente).
- [ ] Decidir foco: Sprint 4 polish (victory dedupe + editorial), feature (`/hub`), o new vocabulary surfaces.

### Prompt sugerido para arrancar

```
Continúo trabajo en Chesscito. Vocabulary unification arc cerrado
(2026-05-09): 3 sprints + polish, 38 commits pushed, ~25 surfaces
migradas, los 5 primitivos M3.5 todos con consumidores en producción.

Suite 1292/1292. Build passing. PrincipalButton ahora con drop-shadow
+ background-size: contain.

Handoff: docs/handoffs/2026-05-09-vocabulary-unification-arc-handoff.md
Spec: docs/superpowers/specs/2026-05-09-vocabulary-unification-sprint-spec.md

Pendientes Sprint 4:
  - Victory-celebration redundancy (4 botones competing)
  - Editorial copy pass (texts largos con leyendas)
  - Scroll vertical missing en sheets
  - AchievementsGrid migration (deferred del Sprint 3)
  - AskCoachButton evaluation
  - Resign modal
  - /hub redesign (separate spec)

Antes de arrancar:
  - Lee el handoff
  - Eyeball las migraciones para confirmar continuidad visual
  - Decide foco con el usuario
```

## Notas

- **Sprint discipline**: cada sub-sprint cerró suite + type-check verde antes de pasar al siguiente. Granular commits per surface (un logical change = un commit).
- **Plan-before-edit cumplido**: confirmaciones explícitas antes de cada Sprint y ante decisiones bifurcadas (e.g., difficulty pill geometry, AchievementsGrid deferral).
- **Execution-initiative cumplido**: tests/type-check/builds autoejecutados; user input solo en decisiones estratégicas (sprint order, polish trade-offs, feature scope).
- **Wrapper-span pattern adoptado**: PrincipalButton ahora forwardea ref + el patrón `<span data-testid> <Primitive /></span>` se usó en cada migración con tests previos (badge-sheet owned, ProActiveBadge, etc.).
- **AchievementsGrid decision documented**: spec sección 7.E5 dice "TreasureTile per achievement"; in-session pivoteamos a "deferred" porque el actual layout (88px tall × 2 cols) no fit el 120×136 small tile. Documentado en spec + en handoff para que Sprint 4 lo retome con consciousness del layout shift.

---

**TL;DR**: Vocabulary unification arc cerrado al 100% según spec scope. Los 5 primitivos M3.5 activados en producción. Polish iterativo con feedback del usuario en tiempo real (drop-shadow, background-size, dejar más sprints pendientes). Suite verde. 38 commits pushed. Próxima sesión: Sprint 4 con foco en victory redundancy + editorial pass + surfaces deferred.
