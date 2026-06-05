# 2026-06-05 — Hub redesign + popup vocab + coach unification

## TL;DR

Shipped 16 commits across `040ca5ff..72028fb8`. Production + main are at `72028fb8`. Hub got its full visual refresh (TRAIN PIECES gold sequence, TRAINING PATH banner, reward tiles, portal+avatar split, daily/coach/mate icons). Account sheet became a 3-column tile grid. Stats picked up Top Minting Wallets aggregation + Victory contract verification link. Confirm Purchase rebuilt as a panel-mision modal. Coach review surfaces unified — `/arena` post-game now redirects to `/coach/[gameId]`, and that page hydrates the cached analysis from Redis. 39/39 VR baselines pass on the refreshed `hub-clean` snapshot.

## What shipped

### Hub visual refresh

| Commit | Surface |
|---|---|
| `a1275e92` | TRAIN PIECES gold pill + red rotated START HERE ribbon + sequence chevron between TRAIN PIECES and ENTER ARENA |
| `833465d2` | Claimed reward tile check unified with PRO sheet vocab (`linear-gradient(#22c55e → #15803d)` + white bold ✓) |
| `4e13a612` | LEFT rail header → TRAINING PATH (purple top-rounded banner), reward tiles flatten to amber gradient with brown stroke |
| `ecac0352` | CTA polish, sequence chevron, tagline rewrite ("Train your pieces first" bold + "Then enter the arena" regular), locked tile CSS replaces PNG, guide panel adopts gray gradient |
| `e4f2b0f9` | Portal anchor split into background (`portal-chesscito-{normal,pro}`) + avatar overlay (`chesscito-avatar-new-light` for PRO, existing `avatar-chesscito` for default). New `hub.avatar` slot in theme registry |
| `8b82bba7` | Daily / Coach / Mate icons refresh — Daily + Coach overwrite the legacy `/art/new-icons-chesscito/*` triplets so every consumer picks them up automatically; Mate gets a dedicated `/art/hub/mate-icon` so it stops sharing with the legacy PrimaryPlayCta |

### Account sheet redesign

- `d0dff3e5` — Account sheet rows collapse into a 3-column `.account-tiles-grid` with `.account-tile` cards. Same handlers, same status logic, same icons; AccountCoachRow logic inlined since this was the only consumer. Disconnect + About become full-width `.arena-result-secondary-action` buttons.

### Stats polish

- `040ca5ff` — `/stats` swap "Recent Victory Mints" for "Top Minting Wallets" with client-side `aggregateTopMinters` (sort by mints desc, tiebreak last-mint). "Wallets with Victory Mints" → "Unique minter wallets". External verification gains Victory NFT contract link (`0x0eE22F83…`).

### Popup vocabulary migration

Audit pair: `docs/audits/2026-06-04-popup-vocabulary-migration.md` (Phase 0 revised) + `docs/audits/2026-06-04-distant-screens-inventory.md` (original sample-based pass).

- `6e2c9f8b` → `6542ac25` — Phase 0 captures + revision. Ran `e2e/popup-vocabulary-captures.spec.ts` (29 tests, 30 PNGs into `errors/pantallas-lejanas/auto-capture/`). Walked every PNG against the WARM UP reference. Concluded:
  - Register A (panel-mision shell) already covers every arena-end-state variant + every rescue-modal variant.
  - Register B (ContextualHeader + green forest bg full-takeover sheet) covers Daily, Shop, Trophies, Leaderboard, Badges, Account sheet.
  - Register C (Coach Viewer dark theatre) turned out to be a **dev-fixture artifact** — `/dev/coach-viewer` wraps the viewer in `bg-[#1a0f0a]`, but the production `/coach/[gameId]` route uses `arena-bg` (forest + cream wash). No third register exists.
  - Register D (true distant): just `purchase-confirm-sheet.tsx:122` brown game-solid CTA + `result-overlay.tsx:308/321/326` brown CTAs inside CandyGlassShell.

- `1db742f5` — Phase 1 brown CTA retire. Purchase + result overlay surfaces swap `variant="game-solid"` / `"game-primary"` to `.arena-scaffold-soft-gate-primary` / `-secondary` directly. Underline "Dismiss" links become `.arena-result-back-link`.

- `e63d5645` — Confirm Purchase rebuilt as a full panel-mision modal. Per-SKU icon top-left (via new `icon` field on CatalogItem fed by SHOP_TILE_ASSETS), fantasy-title CONFIRM PURCHASE with adorno crown divider, cream price pill with plant1 leaf flanks (new asset `/art/new-assets-chesscito/plant1.{avif,webp,png}`), Status + Network info rows with colored dots, soft-gate primary CTA, lock + shield trust footer.

- `c2500aa3` — Raise modal scrim above the persistent dock. Inline `zIndex: 1000` + inline `backgroundColor: rgba(0,0,0,0.60)` were needed to win over the dock's `position:relative z-[60]` nested stacking context. createPortal mounts to document.body so the scrim escapes the persistent-dock wrapper entirely.

- `b4560265` — Explain WHY Confirm is disabled. New `disabledHint` resolver returns at most one reason at a time (`connect` → `network` → `balance` → `unavailable`). Copy avoids token-specific names by reusing the `"USD stablecoin"` umbrella established by `VICTORY_RESULT_COPY.errorInsufficientBalance`.

### Coach unification (Phase 2)

- `6f98ffd1` — `/arena` and `/coach/[gameId]` converge.
  - `lib/coach/game-persistence.ts:getGameRecord` accepts `options.locale` and inlines the cached Coach analysis from the dedicated `coach:analysis:<wallet>:<gameId>:<locale>` key (with EN ↔ ES fallback). The `GameRecord.analysis` field was an aspirational `/api/coach/check-analysis` orphan that was never built; this merge finally populates it.
  - `app/[locale]/coach/[gameId]/page.tsx` threads the route locale into the read so cold loads paint the analysis.
  - `app/[locale]/arena/page.tsx` adds an early redirect useEffect: when `coach.phase` resolves to `result` (full) or `fallback` AND the game is persisted with a known wallet, `router.push("/coach/[gameId]?wallet=…")` and the inline CandyGlassShell "REVIEW" blocks become degraded fallbacks for guest play / persistence failures. Telemetry: `arena_coach_redirect`.

### VR baseline refresh

- `72028fb8` — `hub-clean-minipay-darwin.png` refreshed after the Daily icon swap. Other 38 VR tests stayed green. The Account + Stats + Confirm Purchase + Coach Phase 2 changes touched surfaces not covered by VR baselines, so no cascade refresh was needed.

## State at session end

- `origin/main` = `origin/production` = `72028fb8`.
- 39/39 VR tests green on the refreshed baseline.
- Typecheck clean; affected vitest suites green (345 coach lib + components, 99 exercises + lib/shop, 27 game-persistence, 37 stats, 43 exercises overall).

## How to verify in production

1. **Hub** — `chesscito.com/hub` on MiniPay Android. TRAIN PIECES should read gold with START HERE ribbon top-left, chevron `›` between TRAIN PIECES and ENTER ARENA, TRAINING PATH purple banner on the left rail.
2. **Account sheet** — `/exercises` on a connected wallet → Account pill top-right → 3-column tile grid; Disconnect + About render as cream secondary CTAs.
3. **Stats** — `/stats` → "Top Minting Wallets" section aggregates by wallet (no longer repeats the same wallet per event). External verification block shows both Badges + Victory NFT links.
4. **Confirm Purchase** — `/exercises` → Shop → tap 20 Coach Credits. Modal should be panel-mision shell (green forest border + cream interior + red ⊗), per-SKU icon top-left, plant-flanked price pill, status + network info rows, green primary CTA. Scrim covers the dock. Disabled CTA shows the hint underneath.
5. **Coach unification (the user-flagged Phase 2 bug)** —
   - Cold-load a previously analyzed game via `/coach/history` → tap a game → analysis should render in the existing `MATCH REVIEW` layout (previously the section was empty on cold load).
   - From `/arena` → play a short game → resign / lose / win → ASK coach → user should land on `/coach/[gameId]?wallet=…`, NOT the inline `/arena` "REVIEW" screen. Check Vercel logs for `arena_coach_redirect` to confirm the route push fired.

## Open questions / deferred work

1. **Cluster 2 from the inventory** — HUB underline link → `.arena-result-back-link`, footer micro-text of receipt → chip pattern, modal close ⊗ red vocab review. Small polish, ~1h.
2. **Cluster 3 from the inventory** — Public Challenge landing redesign (`/api/og`-driven). Touches share funnel; ~2-4h.
3. **A11y regression** — Radix Sheet emits a "Blocked aria-hidden on an element because its descendant retained focus" warning. Documented during this session; not blocking. Belongs to a dedicated a11y sprint.
4. **Confirm Purchase wallet-mock for Playwright** — the Account sheet capture spec couldn't surface the sheet because the Account trigger only renders with a connected wallet, and the spec doesn't mock RainbowKit. Add a wallet-connect fixture in a future spec hardening pass.
5. **Coach Viewer "dark theatre" register Q** — closed as a misread. The audit doc has been updated; the `bg-[#1a0f0a]` only lives in `/dev/coach-viewer/fixture.tsx`. Production uses `arena-bg`.

## Files in flight (gitignored, OK to leave)

- `apps/web/lh-patch1.json`, `apps/web/lh-prod-mobile.json`, `apps/web/lh-prod-post-p0-{2,3}.json` — Lighthouse reports from earlier sessions.
- `lh-prod-post-p0-3-r{2,3}.json` — same at repo root.
- `errors/pantallas-lejanas/auto-capture/` — 30 PNGs from the popup migration spec. `errors/` is gitignored; spec re-generates them on demand.

## Memory entries to consider adding next session

- `project_popup-vocabulary-migration_2026_06_04` — references the audit pair, captures, and the canonical register vocabulary so future popup work doesn't relitigate the WARM UP question.
- `feedback_assertions-from-fixtures` — the Coach Viewer "dark theatre" lesson: dev fixtures may not reflect production. When a redesign register feels off, capture the **live** route too before assuming the fixture is canonical.
