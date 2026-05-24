# Handoff — i18n Stage C: trophies + profile/kingdom batches

- **Date:** 2026-05-23
- **Branch:** `main`
- **HEAD:** `09fb2edb`
- **Previous handoff:** `2026-05-23-i18n-victory-batch-handoff.md`
- **Status:** 5th + 6th Stage C batches shipped. `/es` still gated behind `NEXT_PUBLIC_I18N_ES_READY=1` (default OFF in prod).

---

## What shipped this session

### Commit `67408692` — `refactor(trophies): migrate to next-intl + ES translations`

Batch: **trophies/*** (6 files).

**Surfaces migrated (all client):**

- `app/[locale]/trophies/page.tsx`
- `components/trophies/trophies-body.tsx` (3 namespaces: TROPHY/ACHIEVEMENTS/ROADMAP)
- `components/trophies/trophy-card.tsx` (2 namespaces: TROPHY + partial VICTORY_CLAIM)
- `components/trophies/trophy-list.tsx` (+`"use client"`)
- `components/trophies/achievements-grid.tsx` (uses `t.raw("items")` for dynamic id lookup)
- `components/trophies/achievement-detail-sheet.tsx` (uses `t.raw("items")`)

**Bundles:**
- `editorial.ts`: `TROPHY_VITRINE_COPY` +6 keys, `ACHIEVEMENTS_COPY` +3 keys.
- `messages/en.ts`: 3 ICU mirrors (`ACHIEVEMENTS_COPY.sectionDescription`, `ACHIEVEMENTS_COPY.progressLabel`, `VICTORY_CLAIM_COPY.challengeText`).
- `messages/es.ts`: full ES for TROPHY_VITRINE_COPY (24 keys), ACHIEVEMENTS_COPY (incl items 7×2), ROADMAP_COPY (incl items 3×2), partial VICTORY_CLAIM_COPY (only `challengeText` override).

**Key pivot during implementation:**

`TreasureTile` ribbon (`"EARNED"`) had styling coupled to CSS `data-ribbon="EARNED"` selector (emerald gradient). Reverted ribbon migration — stays literal `"EARNED"` in both locales (visual signal, not translatable copy). Removed the `earnedRibbon` editorial key to keep bundle clean.

**Diff:** `+193 / -61` across 9 files.

---

### Commit `09fb2edb` — `refactor(profile,kingdom): migrate to next-intl + ES translations`

Batch: **profile + kingdom** (8 files, split from original `profile + kingdom + pro` suggestion to keep diff focused — PRO is its own batch next).

**Surfaces migrated:**

- `components/profile/display-name-dialog.tsx` (client)
- `components/profile/general-stats.tsx` (client; 6 inline stat labels migrated via new `PROFILE_COPY.statLabels` sub-object)
- `components/profile/pending-claims.tsx` (client; `CLAIM_COPY.kinds.*` already ICU strings — direct `t()` use, no `.replace()`)
- `components/profile/profile-banner.tsx` (client; constructs `ariaLabel` ICU + passes to TierBadge primitive)
- `components/profile/profile-sheet.tsx` (client)
- `components/profile/tier-badge.tsx` (server primitive; accepts new optional `ariaLabel` prop — stays decoupled like PrimaryPlayCta pattern)
- `components/kingdom/kingdom-anchor.tsx` (+`"use client"`)
- `components/kingdom/reward-column.tsx` (+`"use client"`; dynamic key lookup via `t(\`${tile.id}.label\`)` and ICU `t(\`${tile.id}.ariaLabel\`, { state })`)

**Bundles:**
- `editorial.ts`: `PROFILE_COPY` +5 keys (`sheetDescription`, `closeLabel`, `editNameAria`, `tierAriaFormat` ICU, `statLabels` sub-object with 6 stat labels).
- `messages/en.ts`: 7 ICU select mirrors for `REWARD_COPY.{rook,bishop,queen,knight,king,pawn,victory}.ariaLabel` (state-aware: `{state, select, claimable {...} progress {...} other {...}}`).
- `messages/es.ts`: full ES for 6 namespaces — PROFILE_COPY (incl statLabels), DISPLAY_NAME_COPY, CLAIM_COPY (incl `kinds.*`), HOME_ANCHOR_COPY, REWARD_COPY (7 pieces × 4 keys + 7 ICU selects), inserted before ROADMAP_COPY. PIECE_LABELS already had ES.

**Critical decision — Visitor sentinel:**

`profile-sheet.tsx` has `name === "Visitor"` comparison. `useDisplayName` returns `DISPLAY_NAME_COPY.visitor` from editorial.ts directly (not the bundle), so the literal `"Visitor"` stays EN until `lib/profile/display-name.ts` migrates in the `lib/*` helpers batch. **Initial attempt translated this comparison via `tName("visitor")` which would break in ES — reverted to literal.** Will be migrated together when lib/* batch runs.

**Test migrations (9 files):**

- 9 test files now use `renderWithIntl as render` alias from `@/test-utils/render-with-intl` (vs raw `@testing-library/react`).
- Files: profile/__tests__/{display-name-dialog, general-stats, pending-claims, profile-banner, profile-sheet}.test.tsx + kingdom/__tests__/{kingdom-anchor, reward-column}.test.tsx + hub/__tests__/{hub-scaffold, hub-scaffold-client}.test.tsx.

**Diff:** `+228 / -63` across 20 files.

---

## Health check at handoff

- **TypeScript:** clean (`npx tsc --noEmit`)
- **Lint:** clean (`pnpm lint`)
- **Build:** production-ready. All `/[locale]/*` routes generated for `en` + `es`.
- **Unit tests:** **1874/1874 passing** — parity with baseline, zero net test churn (only import line changes via `renderWithIntl` alias).
- **VR:** **11/13 passing** — exact parity. Same 2 deferred reds (`hub-clean`, `hub-shop-sheet-open`) from `1783f8d8`.
- **Smoke (flag ON, port 3346):**
  - `/en/trophies` → HTTP 200; `TROPHIES / My Victories / Hall of Fame / Achievements / History / Coming later`
  - `/es/trophies` → HTTP 200; `TROFEOS / Mis victorias / Salón de la fama / Logros / Historial / Próximamente`
  - `/en/hub` → HTTP 200; `Rook/Bishop/Queen/Knight/King/Pawn mastery / Save your victory / TRAIN PIECES`
  - `/es/hub` → HTTP 200; `Maestría de Torre/Alfil/Reina/Caballo/Rey/Peón / Guarda tu victoria / Reino de Chesscito`
- **Vercel deploys:** both commits Ready in production at handoff time. `chesscito.com` serves `/en/*` (current default).

---

## Stage C scoreboard (as of `09fb2edb`)

| # | Batch | Commit | Files | Status |
|---|---|---|---|---|
| 1 | Legal pilot | `a29c85ee` | 7 | ✅ shipped |
| 2 | Shared-ui + redesign primitives | `c9133c57` | ~5 | ✅ shipped |
| 3 | share/* | `9d7908f7` | 6 | ✅ shipped |
| 4 | victory/* | `295a48fc` | 7 | ✅ shipped |
| 5 | trophies/* | `67408692` | 9 | ✅ shipped this session |
| 6 | profile + kingdom | `09fb2edb` | 20 | ✅ shipped this session |
| 7 | **pro/*** | — | ~5 | ⏭ next |
| 8 | coach/* | — | ~12 | pending (needs API locale param H-4) |
| 9 | arena/* | — | ~12 | pending |
| 10 | exercises/* | — | ~20 | pending |
| 11 | hub/* | — | ~10 | pending (last — composes everything) |
| 12 | lib/* helpers | — | ~6 | pending (includes `display-name.ts` for Visitor sentinel) |
| 13 | app pages | — | ~12 | pending |
| 14 | og-cards/* | — | ~5 | deferred to after arena+victory |

---

## Pre-approved plan — next batch: pro/* (5 files)

Plan was drafted + user-approved end-of-session but execution deferred. Resume tomorrow.

### Files
1. `components/pro/coach-pro-card.tsx` — server → add `"use client"`
2. `components/pro/pro-active-badge.tsx` — server → add `"use client"`
3. `components/pro/pro-active-cta.tsx` — already client
4. `components/pro/pro-chip.tsx` — already client
5. `components/pro/pro-sheet.tsx` — already client

### Namespace
**`PRO_COPY` full** (~50 keys, 2 helper functions, sub-objects, arrays). Already partial ES override (only `comingSoonLabel`) — extend to full namespace.

### Inline strings detected (10)

| Archivo | Línea | String | Nuevo key |
|---|---|---|---|
| `pro-sheet.tsx` | 71 | `"Processing…"` | `processingLabel` |
| `pro-sheet.tsx` | 74 | `"Verifying…"` | `verifyingLabel` |
| `pro-sheet.tsx` | 86 | `"Switch Network"` | `switchNetworkLabel` |
| `pro-sheet.tsx` | 227 | `aria-label="Close PRO"` | `closeLabel` |
| `pro-sheet.tsx` | 364 | `"({duration} · no auto-billing)"` | `noAutoBillingLine` (ICU `{duration}`) |
| `coach-pro-card.tsx` | 25 | `aria-label="Coach PRO training"` | `coachCardAriaLabel` |
| `coach-pro-card.tsx` | 29 | `"Training Pass"` / `"Personal Coach"` | `coachKickerActive` + `coachKickerInactive` |
| `coach-pro-card.tsx` | 36 | `aria-label="Coach PRO includes"` | `coachChipsAriaLabel` |
| `pro-chip.tsx` | 76 | `` `${label} active` `` | `chipActiveAriaLabel` (ICU `{label} active`) |
| `pro-chip.tsx` | 89 | `` `Get ${label}` `` | `chipGetAriaLabel` (ICU `Get {label}`) |
| `pro-chip.tsx` | 66 | `<span className="opacity-0">PRO</span>` | **Leave literal** (layout placeholder, visually hidden) |

### Bundle edits

- **editorial.ts:** +10 nuevas keys en PRO_COPY (las 10 arriba).
- **messages/en.ts:** 2 ICU mirrors:
  - `PRO_COPY.statusActiveSuffix = "{daysLeft, plural, =1 {Expires tomorrow} other {# days left}}"`
  - `PRO_COPY.hubCoachCard.active.title = "PRO Active · {remainingDays}d"`
- **messages/es.ts:** PRO_COPY full namespace ES (preservando partial override existente). **Skip:** `receipt.extended` (no usado en batch).

### Restricciones

- **Wallet/router hooks:** `useAccount`, `useRouter`, `usePathname` intactos.
- **Telemetry tracks:** todos intactos (`pro_card_viewed`, `pro_cta_clicked`, `pro_active_cta_tap`, `pro_extend_tap`, `pro_training_card_cta_tap`).
- **Routing:** `router.push("/arena")`, `router.push("/coach/history")` intactos.
- **ProStatus type, use-pro-status hook, MISSION_RIBBON_COPY["pro-sheet"] alias:** intactos.
- **UI assets:** `/art/chesscito-pro/*` intactos.

### Riesgos

1. **`pro-chip.tsx` `formatDaysLeft` module-scope** — function needs `t`. Refactor: inline cálculo dentro del componente.
2. **`coach-pro-card` + `pro-active-badge` server→client** — Padres: pro-sheet (client) + hub (client) — safe.
3. **4 test files** (pro-active-badge, pro-active-cta, pro-chip, pro-sheet) requieren `renderWithIntl as render`.
4. **`d` vs "días"**: chip activo (28px tall) mantiene `d` por concisión — user confirmed end-of-session.

### Verificación

`tsc → lint → build → test (1874/1874) → smoke /en/hub + /es/hub abrir ProSheet → VR (11/13) → ONE commit → push`.

---

## Deferred this session

Nothing new. Same items as prior handoff:

- OG card endpoints (`/api/og/victory/[id]` + 4 others) stay EN-only v1.
- VR baselines red on `hub-clean` + `hub-shop-sheet-open`.
- Coach API still EN.
- PWA manifest stays EN.
- `lib/profile/display-name.ts` Visitor sentinel — migrate in `lib/*` batch.
- `formatDate("en-US")` in trophy-card.tsx — Stage 4 (M-1).
- `DIFFICULTY_LABELS` data-table lookup — Stage 4 cleanup.

---

## Files touched this session

```
# trophies batch (commit 67408692)
apps/web/src/app/[locale]/trophies/page.tsx
apps/web/src/components/trophies/achievement-detail-sheet.tsx
apps/web/src/components/trophies/achievements-grid.tsx
apps/web/src/components/trophies/trophies-body.tsx
apps/web/src/components/trophies/trophy-card.tsx
apps/web/src/components/trophies/trophy-list.tsx
apps/web/src/lib/content/editorial.ts          # +9 keys
apps/web/src/lib/content/messages/en.ts        # +3 ICU mirrors
apps/web/src/lib/content/messages/es.ts        # +4 namespaces

# profile+kingdom batch (commit 09fb2edb)
apps/web/src/components/hub/__tests__/hub-scaffold-client.test.tsx
apps/web/src/components/hub/__tests__/hub-scaffold.test.tsx
apps/web/src/components/kingdom/__tests__/kingdom-anchor.test.tsx
apps/web/src/components/kingdom/__tests__/reward-column.test.tsx
apps/web/src/components/kingdom/kingdom-anchor.tsx
apps/web/src/components/kingdom/reward-column.tsx
apps/web/src/components/profile/__tests__/display-name-dialog.test.tsx
apps/web/src/components/profile/__tests__/general-stats.test.tsx
apps/web/src/components/profile/__tests__/pending-claims.test.tsx
apps/web/src/components/profile/__tests__/profile-banner.test.tsx
apps/web/src/components/profile/__tests__/profile-sheet.test.tsx
apps/web/src/components/profile/display-name-dialog.tsx
apps/web/src/components/profile/general-stats.tsx
apps/web/src/components/profile/pending-claims.tsx
apps/web/src/components/profile/profile-banner.tsx
apps/web/src/components/profile/profile-sheet.tsx
apps/web/src/components/profile/tier-badge.tsx
apps/web/src/lib/content/editorial.ts          # +12 lines (5 keys + statLabels)
apps/web/src/lib/content/messages/en.ts        # +14 lines (7 ICU mirrors)
apps/web/src/lib/content/messages/es.ts        # +104 lines (6 namespaces)
```

---

## New behavior memories saved this session

- `feedback_flag_user_reprocess.md` — flag when user is about to trigger redundant work (re-verify passing build, re-read loaded docs, duplicate handoff). Format: 1-line flag + alternative.
- `feedback_no_reask_documented.md` — when plan/spec/handoff/memory already settles a decision, proceed on it. Re-asking signals I didn't read the artifact. Only ask on genuine gaps with line/section citation.

Both added to `MEMORY.md` as HARD RULES.

---

## Quick reload checklist for next session

1. `git pull origin main` (expect HEAD `09fb2edb` or later)
2. Read `MEMORY.md` → i18n section
3. Read this handoff (sections: "Stage C scoreboard" + "Pre-approved plan — next batch: pro/*")
4. **Verify Vercel deploy of `09fb2edb` passed** before kicking off next batch
5. Recommended next batch: `pro/*` (~5 files, plan already pre-approved; just confirm and execute)

---

## Risks / known issues at handoff

- **Vercel deploy verification pending for `09fb2edb`** — first action next session
- **VR 2/13 red** — pre-existing, not from this session
- **OG cards EN-only on /es** — accepted v1
- **Coach API still EN** — until Stage 4
- **PWA manifest stays EN** — accepted v1
- **`lib/profile/display-name.ts` Visitor sentinel** — coupled with `name === "Visitor"` comparison in profile-sheet; migrate together in `lib/*` batch
