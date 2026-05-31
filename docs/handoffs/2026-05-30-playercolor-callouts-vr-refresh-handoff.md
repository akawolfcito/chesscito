# PlayerColor + Phase 2 Callouts + Trophies Page + VR Refresh — Handoff

**Date:** 2026-05-30 · **Branch:** main · **Range:** `6e3494d0..c44a591c` (8 commits)
**Status:** All commits on local `main`, **not yet pushed** — preview deploy gated on push.
Production stays on `f54f6fc`. Promote remains gated on MiniPay smoke + hint-variant baselines + shop fixture race fix.

## What shipped

Eight commits across three sub-clusters + one stale-baseline catchup:

1. **Hilo 1 — Persist `playerColor` in `GameRecord`** (3 commits). Closes deferred-work #6 from the prior handoff.
2. **Hilo 4 — Phase 2 shop oscuridad callouts (in-context)** (3 commits). Shields chip in arena HUD + paid-credits hint + PRO active variant in coach viewer.
3. **Standalone `/trophies` page hero extract** (1 commit). Sheet pattern from `507bcb8b` finally applied to the page route.
4. **VR baseline refresh** (1 commit). 6 stale baselines caught up — 4 from Cluster C visor redesign (2026-05-29), 1 from shop vitrine migration (2026-05-30), 1 from arena end-state copy refresh.

## Hilo 1 — `playerColor` persisted

Closes the implicit assumption that `result === "win"` always means checkmate (visor previously derived `playerColor` from move-list parity in `coach-game-client.tsx:89`, doc-commented `dbaf5b1f`).

- **`6e3494d0`** `feat(coach-types): persist optional playerColor on /api/games POST` — schema (`GameRecord.playerColor?: "w" | "b"`) + route validation rejects non-`w`/`b` with 400 + 4 new tests. `/api/games` route tests 26 → 30.
- **`72d3fa4b`** `feat(arena): include playerColor in persist payload` — POST body in `runPersist` carries `game.playerColor` through; useCallback dep added.
- **`953cb737`** `refactor(coach-viewer): prefer persisted playerColor, fall back to parity for legacy` — `safePlayerColor = gameRecord?.playerColor ?? <parity fallback>`. Parity kept as fallback for records written before this change.

Backward-compat is intentional: legacy records still resolve `playerColor` via parity. Once the wallet's oldest legacy record falls out of the 200-cap window (~6-12 months of play), the fallback can be deleted.

## Hilo 4 — Phase 2 shop oscuridad callouts

Surfaces inventory at the point of action so the user sees ownership/cost AT the moment they're about to use it. Pairs with the AccountSheet inventory rows shipped in `792e9a89`.

### Shields chip — arena HUD (1 commit)

- **`250952cd`** `feat(arena-hud): shields point-of-use chip below header`
  - New `<ArenaShieldsChip>` local in `arena-hud.tsx`, candy-tray-pill family (matches timer + difficulty pill).
  - Renders thin row `flex justify-end px-2` between header and matchup row.
  - Conditional: `count > 0 && !isEndState` — hidden when wallet has none + suppressed during closing flow.
  - Reuses `useShieldsCount()` + HUD_COPY `shieldsFormat/shieldsLabel/shieldsAriaLabel` keys (already provisioned for the hub HUD before this session — semantically identical).
  - 4 new tests; arena-hud 3/3 → 7/7.

### Credits hint paid variant — coach viewer (1 commit)

- **`c5706bc2`** `feat(coach-viewer): credits hint under Ask Coach tile when wallet holds paid balance`
  - New `coachCredits?: number` prop on `GameActionsBar`.
  - When Ask Coach tile is reachable (`!isTooShort && !hasPartialReplayError && !askCoachPending`) AND `coachCredits > 0`, render `role="status"` line "Uses 1 credit · {N} left" between tile row and tertiary link.
  - Suppressed at 0 — paywall stays the primary signal for empty balance.
  - Editorial `COACH_VIEWER_COPY.creditsHint` (EN) + `es.ts` override.
  - 6 new tests; game-actions-bar 14/14 → 20/20.

### Credits hint PRO active variant (1 commit)

- **`39148f2a`** `feat(coach-viewer): PRO active variant on Ask Coach hint`
  - New `proActive?: boolean` prop on `GameActionsBar`.
  - When PRO active AND Ask Coach reachable: emerald "Unlimited · PRO active" line, `data-variant="pro"`, uppercase letter-spacing. Takes precedence over the paid-credits hint (PRO subscribers never count credits, even if they have leftover paid balance from before subscribing).
  - Visor wires `proActive={useIsProActive()}`.
  - Editorial `COACH_VIEWER_COPY.creditsHintPro` (EN) + `es.ts` override.
  - 4 new tests; game-actions-bar 20/20 → 24/24.

## Trophies standalone page (1 commit)

- **`3c57354e`** `fix(trophies-page): extract hero band outside scroll so anchor overhangs`
  - Mirrors the sheet pattern from `507bcb8b` (2026-05-30 prior cluster). The page's `overflow-y-auto` scroll div was promoting `overflow-x` to auto and clipping the trofeo-épico anchor's `left: -1.25rem` overhang.
  - Hero now renders as `shrink-0 mt-4 px-4` sibling outside the scroll, with `<TrophiesBody hideHero />`. Persistent overview header that doesn't scroll off with detail sections.
  - Closes deferred-work #8 from the prior handoff.

## VR baseline refresh (1 commit)

- **`c44a591c`** `test(vr): refresh 6 stale visual baselines (Cluster C visor + shop vitrine + arena end-state)`
  - **4 × `vr10-coach-viewer-*`** (`loss`, `partial-replay`, `win-minted`, `win-unminted`) — baselines pre-dated the Cluster C visor redesign (handoff 2026-05-29, commits `28ffbfc8..1bf3acfd`). New baselines lock the canonical Cluster C layout. **Hint variants NOT covered** — fixtures don't pass `coachCredits`/`proActive`, so the credits hint stays hidden in these baselines. Hint-variant baselines deferred to a fixture follow-up.
  - **1 × `vr9-arena-end-state-win-error`** — copy refresh on the TX-failed popup. No layout change; baseline simply caught up.
  - **1 × `hub-shop-sheet-open`** — shop vitrine migration (`22489f89`). **FLAKY at refresh time**: shop catalog prices race between "Pay with $X" and "Coming soon" depending on fixture data resolution. Snapshot captures closer-to-truth state but test may still red until the fixture mocks the catalog response or settles before screenshot.

## State at handoff

- **Tests:** typecheck clean. Vitest sweep across touched modules: 443/443 passing (`coach`/`arena`/`coach-viewer`/`arena-hud`/`game-actions-bar`/`use-mint-victory`/etc).
- **Full vitest run** (`pnpm test` = `vitest run`): **2185/2185 passing, 0 fail**. The prior handoff's claim of "39 pre-existing env failures" did not reproduce.
- **VR final state:** 23 pass + 1 flaky (`hub-shop-sheet-open`, race documented above). The 5 other refreshed baselines are stable.
- **Preview deploy:** **NOT triggered** — 8 commits sit on local `main`, need push.
- **Production:** unchanged from `f54f6fc`.

## Disk / swap state at handoff (critical)

The full VR run + refresh compounded:

| Metric | Session start | Session end | Δ |
|---|---:|---:|---:|
| disk_free | 16Gi | **1.5Gi** | −14.5Gi |
| swap_used | 645M | **5.71G** | +5.06G |

**Reboot is mandatory before any further VR.** Both thresholds (`<30GB free + swap >2GB`) violated. Any further `pnpm install` / `vitest run` risks OOM or disk-full.

Telemetry snapshots saved to `_bmad-output/disk-telemetry/` (gitignored):
- `T_pre` / `T_post` — bracketed the `hub-clean` single-test smoke.
- `VR_pre` / `VR_post` — bracketed the full VR suite.

Datapoint added to `project_disk_telemetry` memory: **full VR suite = ~14.5Gi disk + ~5G swap delta** when starting from already-pressured state. Much more hostile than the "15GB drop" referenced in prior memory entries (those were from a clean-state baseline).

## Outstanding work — deferred ledger

1. **Push 8 commits to origin** — preview deploy gated. User-confirmation required (shared-state action).

2. **Hint-variant VR baselines** — credits hint paid + PRO variants + shields chip. Need fixture mods:
   - `/dev/coach-viewer/` fixture: add 2 variants with `coachCredits=5` (paid) and `proActive=true` (PRO).
   - `/dev/arena-fixture/` (if exists) or new fixture: seed `localStorage["chesscito:shields"]` so `useShieldsCount()` returns `> 0`.
   - Capture 3 new baselines (1 paid + 1 PRO + 1 shields).

3. **Shop sheet fixture race** — `hub-shop-sheet-open` flake. Either mock catalog response in the fixture or add `await page.waitForFunction(...)` until all prices resolve. Until fixed, this baseline will red intermittently.

4. **Phase 2 ítem 4 — Founder perks UI** — Gated on product decision: what does Founder unlock beyond visual recognition? Without that, surfacing a Founder badge anywhere risks committing to a UX promise we'd break.

5. **Persisted PRO days-remaining** — Surface "Active · {N} days left" in AccountSheet PRO row. Requires either touching `/api/pro/status` payload or computing client-side from `expiresAt`.

6. **Shared trophies data provider** — `TrophiesBody` + `TrophiesHeroBand` each fire `/api/my-victories` independently. Cached endpoint, so cheap, but a context provider would dedupe cleanly if profiling shows it.

7. **`SHOP_TILE_ASSETS[].bg` cleanup** — Remove unused field + 24 PNGs in `/art/shop/bg-*` (`avif/webp/png` × 8 references) now that the vitrine treatment took over.

8. **i18n hygiene `og-cards/*` batch** — Tracked separately in `_bmad-output/implementation-artifacts/deferred-work.md` (entry 2026-05-23). Not in this session's scope.

9. **Production promote** — Gated on: (a) MiniPay smoke pass against this cluster's surfaces + (b) hint-variant baselines + (c) shop fixture race fix.

## Open questions for next session

- The 39 vitest env failures referenced in the prior handoff did not reproduce against `pnpm test` (2185/2185 passing this session). Either the deferred-work ledger was stale or the failure mode depends on a transient condition (Node version? Watch mode?). If they don't reappear in the next session, drop the ledger entry.
- Hint-variant baselines: should the fixture spawn 1 variant per hint (shields + paid + PRO) or combine into a single composite "all callouts visible" baseline? Composite saves disk + capture time; per-variant is more isolated for regression triage.
- The `hub-shop-sheet-open` race — is the catalog already mocked anywhere we can reuse, or do we add a settle step? Worth a 10-min investigation before committing to either approach.

## Pointers for next session

- Memory updates this session: `project_disk_telemetry` (new datapoints from VR_pre/VR_post), `project_vr_baseline_drift` (new — pattern for triaging stale baselines vs regressions).
- Prior handoff: `docs/handoffs/2026-05-30-coach-bugs-shop-vitrine-account-inventory-handoff.md`.
- Disk telemetry snapshots: `_bmad-output/disk-telemetry/{T_pre,T_post,VR_pre,VR_post}_*.txt`.
- Cluster Closure Protocol §1: README "What's live" hasn't changed (no new contracts deployed); no sync needed. §4: branch hygiene — local `main` is 8 ahead, no feature branches to clean.

---

Wolfcito 🐾 @akawolfcito
