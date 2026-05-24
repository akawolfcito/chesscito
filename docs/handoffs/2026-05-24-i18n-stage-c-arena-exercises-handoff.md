# Handoff — i18n Stage C: pro / coach / lib / arena / exercises 1A.1

- **Date:** 2026-05-24
- **Branch:** `main`
- **HEAD:** `00da8b77`
- **Previous handoff:** `2026-05-23-i18n-trophies-profile-kingdom-batches-handoff.md`
- **Status:** 7 batches shipped this session (pro, coach + H-4, coach polish, lib sub-1, lib sub-2, arena, exercises 1A.1). `/es` still gated `NEXT_PUBLIC_I18N_ES_READY=1` (OFF in prod).

---

## What shipped this session

### Commit `afb12a87` — `refactor(pro): migrate to next-intl + ES translations` (batch 7)

5 components + 4 tests. `coach-pro-card` + `pro-active-badge` promoted server→client (useTranslations is a client hook). 11 new editorial keys (processingLabel, verifyingLabel, switchNetworkLabel, closeLabel, noAutoBillingLine ICU, coach card ARIA+kicker, chip ARIA ICU). 2 ICU mirrors in en.ts (statusActiveSuffix plural, hubCoachCard.active.title). Full PRO_COPY ES (preserves comingSoonLabel override). Dead imports purged from pro-sheet.

### Commit `f03f4338` — `refactor(coach): migrate to next-intl + ES translations + H-4 API locale` (batch 8)

**H-4 closed.** 9 UI components + page + prompt-template + analyze route + request helper + types. `/api/coach/analyze` accepts optional `locale` body param (default "en", whitelist-guarded). `prompt-template.ts` refactored to accept locale — RESULT_HINTS, history augmentation, intro+rules block all switch to locale-aware ES/EN. **JSON schema keys MUST remain English** (explicit rule in prompt to prevent normalizeCoachResponse parse breaks). Cache key NOT changed — `coach:analysis:${wallet}:${gameId}` stays wallet-scoped + UUID-per-game (idempotency preserved; re-ask in new locale returns cached). Locale stored in `CoachAnalysisRecord` for telemetry. `request-coach-analyze.ts`: optional 4th-param `locale`; body shape preserves bit-identical signature when omitted. `arena/page.tsx` wires `useLocale()` through both call sites (inline fetch + helper).

**Scope discipline deferred:** coach-history.tsx inline strings (resultLabel switcher, relative timestamps, "Latest Review", empty state). Closed in `4ca2c361`.

### Commit `4ca2c361` — `refactor(coach): coach-history inline strings + ES translations` (coach polish)

Follow-up closing the deferral. ~20 new COACH_COPY keys (resultLabels, relativeTime ICU, latestReviewCard, progressStats, emptyState, backLabel, connectWalletForHistory, historyAriaLabel, manageHistory toggle). `resultLabel(result, t)` + `formatRelativeTimestamp(ts, t)` now accept translator as param (keep pure-function shape).

### Commit `6a0c174e` — `refactor(lib): locale-aware display-name + compute-tier + hero-cta helpers` (lib sub-batch 1)

**Visitor sentinel closed.** `resolveDisplayName(args, visitorLabel?)` parameterizes the fallback (defaults to `DISPLAY_NAME_COPY.visitor` for legacy callers). New `isVisitor(args)` boolean replaces fragile `name === "Visitor"` string comparison. `useDisplayName` hook reads `useTranslations("DISPLAY_NAME_COPY")` and exposes `isVisitor`. `computeTier` returns `{ tier, xp }` (drops `.title`; callers do `t(\`tierLabels.${tier}\`)`). `getHeroContextAction` returns `{ variant, destination, color }` (drops `label`/`sub`). ES for TIER_LABELS + HERO_CTA_COPY. `useDisplayName.test.tsx` wraps `renderHook` with `NextIntlClientProvider` + EN/ES coverage.

### Commit `2c16a023` — `refactor(lib): errors + pro-sheet-state inline strings → editorial keys` (lib sub-batch 2)

`errors.classifyTxError` 2 inline strings moved to `RESULT_OVERLAY_COPY.error.badgeAlreadyClaimed` + `signingUnavailable` (still ships EN-on-output until full locale threading — see sub-batch 2). `use-pro-sheet-state.ts` adopts `useTranslations("PRO_COPY")`, 3 inline strings consolidated (insufficientBalance, txTimeout, existing PRO_COPY.errors.*). Test file wraps `renderHook` with intl provider via new `renderProSheetHook()` helper.

**Scope discipline deferred:** SHOP_ITEMS const refactor (bundled with exercises since exercises-screen consumes it) + classifyTxError full locale param threading.

### Commit `f2d47e36` — `refactor(arena): migrate to next-intl + ES translations` (batch 10)

14 components + arena/page.tsx + 4 tests. 3 large namespaces translated (ARENA_COPY ~95 keys, VICTORY_CLAIM_COPY ~60, VICTORY_CELEBRATION_COPY ~17). ~25 inline string keys consolidated (confirmQuit/Resign ARIA, timerAriaLabel ICU, color picker, prize pool, soft gate region, matchEnded, scaffoldPageAriaFormat ICU). **Pivot:** `getLoseText(status, t)` accepts translator; `PersistOverlay` accepts optional `labels` prop with EN literal defaults (keeps VR fixtures + storybook renderable without intl provider). `arena-entry-panel` + `arena-select-scaffold` demote pre-computed const arrays with copy to in-render lookups so labels read from `t()` per render. `coach-preview-card` uses `t.raw("lockedBenefits")`. `arena-end-state.tsx` `PersistOverlay` decoupled from editorial.

### Commit `00da8b77` — `refactor(exercises): structural migration — 8 components` (sub-batch 1A.1)

Incremental progress on exercises. 8 / 18 smallest components migrated:
- contextual-action-slot (hasLoading() guard for actions with `loading: null`)
- piece-picker-trigger (`triggerAriaFormat` ICU)
- piece-picker-sheet (per-option label via tPiece)
- saved-chip (label/aria ICU with {stars}+{total})
- trophies-sheet (`closeSheetLabel`)
- mission-header-candy (shared `closeLabelFormat` ICU in MISSION_DETAIL_COPY)
- mission-briefing (moveObjective ICU; try/catch around piece lookup)
- mission-detail-sheet (shares MISSION_BRIEFING_COPY surface)

Bundle: PIECE_RAIL_COPY +triggerAriaFormat/closeLabel; TROPHY_VITRINE_COPY +closeSheetLabel; MISSION_DETAIL_COPY +closeLabelFormat (ICU); MISSION_BRIEFING_COPY +closeLabel. 5 ICU mirrors in en.ts. Daily-tactic-sheet test patched (consumes MissionHeaderCandy transitively). 4 exercises tests patched: contextual-action-slot, saved-chip, trophies-sheet, plus daily-tactic-sheet.

---

## Health check at handoff

- **TypeScript:** clean (`npx tsc --noEmit` from `apps/web/`)
- **Lint:** clean (`pnpm lint`)
- **Build:** production-ready
- **Unit tests:** **1884/1884 passing** (parity since lib sub-2)
- **VR:** **11/13 passing** — same 2 deferred reds (`hub-clean`, `hub-shop-sheet-open`) from `1783f8d8`
- **Smoke (flag ON, port 3346):**
  - `/en/exercises` → HTTP 200
  - `/es/exercises` → HTTP 200
- **Production:** `chesscito.com` continues to serve `/en/*` (flag OFF). No Spanglish exposure.

---

## Stage C scoreboard (as of `00da8b77`)

| # | Batch | Commit | Status |
|---|---|---|---|
| 1 | Legal pilot | `a29c85ee` | ✅ shipped |
| 2 | Shared-ui + redesign primitives | `c9133c57` | ✅ shipped |
| 3 | share/* | `9d7908f7` | ✅ shipped |
| 4 | victory/* | `295a48fc` | ✅ shipped |
| 5 | trophies/* | `67408692` | ✅ shipped |
| 6 | profile + kingdom | `09fb2edb` | ✅ shipped |
| 7 | pro/* | `afb12a87` | ✅ shipped this session |
| 8 | coach/* + H-4 | `f03f4338` | ✅ shipped this session |
| 8.5 | coach polish | `4ca2c361` | ✅ shipped this session |
| 9 | lib sub-1 (display-name+tier+hero) | `6a0c174e` | ✅ shipped this session |
| 9 | lib sub-2 (errors+pro-sheet-state) | `2c16a023` | ✅ shipped this session |
| 10 | arena/* | `f2d47e36` | ✅ shipped this session |
| 11.1 | exercises 1A.1 (8 small components) | `00da8b77` | ✅ shipped this session |
| **11.2** | **exercises 1A.2** | — | ⏭ next |
| **11.3** | **exercises 1B (ES translation pass)** | — | queued |
| **12** | **errors.classifyTxError(t) + RESULT_OVERLAY_COPY ES** | — | queued |
| 13 | hub/* (LAST) | — | queued |
| 14 | og-cards/* | — | deferred to v2 |

---

## Pre-approved plan — sub-batch 11.2 (exercises 1A.2)

**Scope:** 10 components + page + SHOP_ITEMS const refactor + 4 tests.

### Components
1. `exercise-drawer.tsx` (211 LOC)
2. `persistent-dock.tsx` (234 LOC)
3. `labyrinth-complete-overlay.tsx` (177 LOC)
4. `purchase-confirm-sheet.tsx` (150 LOC)
5. `badge-sheet.tsx` (328 LOC)
6. `leaderboard-sheet.tsx` (274 LOC)
7. `shop-sheet.tsx` (317 LOC, consumes SHOP_ITEMS)
8. `mission-panel-candy.tsx` (556 LOC, only 6 editorial refs — small migration despite size)
9. `result-overlay.tsx` (673 LOC, 36 editorial refs — heavy)
10. `exercises-screen.tsx` (2050 LOC, 31 editorial refs — heaviest; consumes SHOP_ITEMS)

### Page
- `apps/web/src/app/[locale]/exercises/page.tsx` (65 LOC)

### SHOP_ITEMS refactor (bundled because exercises-screen + shop-sheet consume it)
- **Current:** `lib/contracts/shop-catalog.ts` exports `SHOP_ITEMS` const with `{ itemId, label, subtitle }` — `label`/`subtitle` read SHOP_ITEM_COPY at import time (locale-frozen).
- **Refactor:** Drop `label`/`subtitle` from the entries → keep only `itemId`. Callers (`use-shop-sheet-state.ts`, `exercises-screen.tsx`) resolve copy via `t(\`shopItem.${itemId}.label\`)` or similar local lookup.
- **Tests:** `shop-catalog.test.ts` assertions update to no longer check label/subtitle fields.

### Tests
- 4 to patch with `renderWithIntl` alias: badge-sheet, leaderboard-sheet, persistent-dock, shop-sheet.

### Verification
`tsc → lint → build → test (expect 1884+) → smoke /en/exercises + /es/exercises (incl. shop dock + persistent dock interactions) → VR (11/13) → ONE commit → push`.

---

## Pre-approved plan — sub-batch 11.3 (exercises ES translation pass)

**Scope:** pure copy work. Translate ~24 namespaces consumed by exercises components in `messages/es.ts`:

- FOOTER_CTA_COPY
- SHOP_SHEET_COPY
- SAVED_CHIP_COPY
- PURCHASE_CONFIRM_COPY
- RESULT_OVERLAY_COPY
- BADGE_SHEET_COPY
- MISSION_DETAIL_COPY (partial — closeLabelFormat in 1A.1)
- LEADERBOARD_SHEET_COPY
- PIECE_RAIL_COPY (partial — triggerAriaFormat/closeLabel in 1A.1)
- MISSION_BRIEFING_COPY (partial — closeLabel + moveObjective in 1A.1)
- LABYRINTH_COPY
- EXERCISE_DRAWER_COPY
- BADGE_EARNED_COPY
- PIECE_COMPLETE_COPY
- TUTORIAL_COPY
- CAPTURE_COPY
- SHIELD_COPY
- DAILY_SOLVE_COPY
- STATUS_STRIP_COPY
- PHASE_FLASH_COPY
- SHOP_ITEM_COPY
- BADGE_TITLES
- GLOSSARY
- CTA_LABELS

ICU mirrors in en.ts for any function helpers still pending mirroring.

**Verification:** `tsc → lint → build → test → smoke ES /exercises grep visible markers → VR (11/13) → ONE commit → push`.

---

## Pre-approved plan — sub-batch 12 (errors.classifyTxError + RESULT_OVERLAY_COPY ES)

**Scope:**
1. `lib/errors.ts`: refactor `classifyTxError(error, t)` to accept translator (already reads RESULT_OVERLAY_COPY.error.* via direct import; switch to t() calls).
2. Thread `t` to 5 callers:
   - `app/[locale]/arena/page.tsx` lines 800, 1009 (already in locale folder; use existing `useTranslations`)
   - `components/exercises/exercises-screen.tsx` lines 1144, 1147, 1247, 1250, 1512, 1518 (4 unique sites)
   - `lib/shop/use-shop-sheet-state.ts` line 494 (hook already in client surface)
3. ES translation of `RESULT_OVERLAY_COPY.error.*` in `messages/es.ts` (currently EN-only).

**Verification:** `tsc → lint → build → test → ONE commit → push`.

---

## Architectural decisions / pivots logged this session

1. **Cache key for `/api/coach/analyze` stays (wallet, gameId), not (wallet, gameId, locale).** Wallet-scoped + UUID-per-game means cross-user bleed is impossible. Same-user re-ask in new locale returns cached EN response — preserves idempotency / no double credit charge. Documented in route handler + CoachAnalysisRecord type.

2. **JSON schema keys must stay English in Coach prompt.** Explicit rule prevents LLM from translating property names (which would break `normalizeCoachResponse`). Spanish prompt rule: "JSON property names MUST remain in English. Solo los VALORES de tipo string deben estar en español (es-MX)."

3. **Pure helpers stay pure — translator passed as param.** Pattern: `resolveDisplayName(args, visitorLabel?)`, `computeTier(stats)` (returns key only, caller resolves via `t`), `getHeroContextAction(state)` (returns variant key), `resultLabel(result, t)`, `formatRelativeTimestamp(ts, t)`, `getLoseText(status, t)`, `classifyTxError(error, t)` (queued). Avoids hook-in-helper anti-pattern.

4. **`PersistOverlay` accepts optional `labels` prop with EN defaults.** Keeps VR fixtures + storybook renderable without intl provider while production callers (arena-end-state) pass locale-resolved copy.

5. **Sub-component own translator pattern.** Components like LatestReviewCard / OlderReviewRow / ProgressCard / EmptyState / UnanalyzedReviewRow inside coach-history each call their own `useTranslations("COACH_COPY")` so they remain self-contained client primitives.

6. **`isVisitor` boolean closes the Visitor sentinel.** Replace `name === "Visitor"` (which breaks under ES → "Visitante") with a locale-agnostic boolean derived from `!args.address` in `useDisplayName` hook.

7. **Const arrays demote to in-render lookups.** `COLOR_OPTIONS`/`COLOR_CARD` etc in arena-entry-panel + arena-select-scaffold were module-scope const arrays baking in editorial labels at import time. Migration demotes them to in-render computations so labels read from `t()` per render.

---

## Memories written this session

- `MEMORY.md` updated through each batch (current state: 10 batches + exercises 1A.1).
- No new behavior memories needed — every pivot was logged in handoffs/commit messages.

---

## Risks / known issues at handoff

- **Exercises 1B + sub-batch 12 outstanding** — ES users still see partial EN copy on `/es/exercises` and on error overlays (timeouts/insufficient funds/etc) across arena + exercises + shop. Gate flag OFF in prod protects users; local dev sees mixed.
- **VR 2/13 red** — pre-existing, not regressed by this session.
- **Vercel deploy verification pending for `00da8b77`** — first action next session.

---

## Quick reload checklist for next session

1. `git pull origin main` (expect HEAD `00da8b77` or later)
2. Read `MEMORY.md` → i18n section
3. Read `SESSION.md` + this handoff (sections: "Pre-approved plan — sub-batch 11.2")
4. **Verify Vercel deploy of `00da8b77` is green** before kicking off sub-batch 11.2
5. Execute sub-batch 11.2 (exercises 1A.2 — 10 components + page + SHOP_ITEMS refactor)
6. Then 11.3 (ES translation pass), then 12 (errors.classifyTxError), then hub/* (last)
