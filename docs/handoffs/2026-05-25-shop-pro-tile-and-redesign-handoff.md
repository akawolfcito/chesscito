# Shop — PRO Tile + Visual Redesign — Handoff (2026-05-25)

Two-part session. Part 1 surfaced **Chesscito PRO** as a real shop tile
(it had been a hero-only card in `/hub`). Part 2 rebuilt the visual
language of every shop tile from scratch with Sally-led UX iteration.
23 commits, **pushed to `origin/main`** (`749292c7..f6688465`).

## State of the tree

- **Branch:** `main`, in sync with `origin/main`.
- **Tests:** 1947 / 1947 passing.
- **TSC:** clean.
- **VR:** 13 / 13 passing. `hub-shop-sheet-open` baseline refreshed 6
  times across the session — the final committed PNG is the canonical
  redesign state.
- **Pre-existing flake (not ours):** `hub-clean` 1/13 reproduces on
  clean `main` HEAD with `git stash`, tracked in deferred-work
  2026-05-23. Confirmed orthogonal to this session.

## What shipped (in commit order)

### Cluster A — Expose PRO in the Shop (4 commits)

| SHA | Subject |
|---|---|
| `e0bd7600` | feat(shop): expose Chesscito PRO tile in the shop sheet |
| `723cba8b` | chore(vr): refresh baseline for new PRO tile |
| `0262cae3` | feat(shop): redesign shop tiles with per-tile art + reorder PRO first |
| `2b0f8e9d` | chore(vr): refresh baseline for redesigned tiles |

PRO is now in `SHOP_ITEMS` (was intentionally excluded per a 2026-04-29
phase-0 decision; we reversed). Both buy paths (`useShopSheetState`
modern + legacy `exercises-screen.tsx`) now await receipt and POST
`/api/verify-pro` for PRO purchases — the route is idempotent, so the
upgrade is safe to retry. The standalone `<ProSheet>` card in `/hub`
remains as the hero discoverability surface. Both routes hit the same
on-chain SKU (`PRO_ITEM_ID = 6n`, $1.99).

Assets shipped to `apps/web/public/art/shop/`:
- 3 tile icons (`pro`, `founder`, `shield`) × triplet → 9 files
- 3 tile backgrounds (`bg-pro` purple, `bg-founder` orange, `bg-shield`
  blue) × triplet → 9 files
- Total: 18 files / ~3 MB raw PNG → ~265 KB on the AVIF wire

### Cluster B — Tile chrome refinements (10 commits)

| SHA | Subject |
|---|---|
| `c80e239f` | style(shop): tile chrome — right-align buttons, yellow CELO twin, full-bleed icon |
| `58ccb2c3` | chore(vr): baseline for tile chrome refinements |
| `dfcb0057` | fix(shop): button bg fills bounding box so flex-end hugs the card edge |
| `9c9ca6ee` | chore(vr): baseline for button alignment |
| `8eef5e25` | fix(shop): compact CELO button with bespoke yellow asset + readable text |
| `3ca5b8f3` | chore(vr): baseline for compact yellow CELO button |
| `0a782e9d` | style(shop): swap CELO twin to canonical candy-tray-pill (compact cream) |
| `bf1d5e51` | chore(vr): baseline for compact candy CELO pill |
| `5be33aa5` | style(shop): unify all buy buttons into HUD candy-pill family |
| `8689a3a0` | style(shop): grid layout with floating left-overhang icon |
| `e756f15e` | chore(vr): baseline for grid floating-icon layout |

Iterative — kept landing finer micro-decisions on buttons + tile
layout. Ended with **all 4 shop buttons** sharing the canonical
`.candy-tray-pill` family from the `/exercises` HUD, with two custom
modifiers: `--green` (USD price routes) + `--yellow` (CELO route).
Icons converted to a 2-column grid (icon left col, identity + footer
right col) so the icon could be vertically centered + floating.

### Cluster C — Sally's UX pass (4 commits + 3 fixes)

| SHA | Subject |
|---|---|
| `b629f428` | fix(shop): forbid wrapping on shop buy pills, tighten CELO label |
| `7d22ed34` | style(shop): drop kicker labels, promote FEATURED to a real ribbon badge |
| `a7198952` | style(shop): refine typography hierarchy — name leads, subtitle supports |
| `5d352b2d` | feat(shop): add "more coming" ghost card to close the catalog with intent |
| `e664af00` | chore(vr): baseline for Sally's UX pass |
| `bcbfa82c` | fix(shop): shift catalog right so floating icons stay fully visible |
| `3a1a0352` | fix(shop): drop pl-6 — cards stay symmetric, icons read fine at natural offset |
| `f6688465` | fix(shop): icon overhang via absolute positioning — escapes card, stays complete |

Sally's audit identified 5 issues and shipped fixes in granular
commits: `Pay with CELO` 2-line wrap (→ `white-space: nowrap` + tighter
font on the yellow modifier), kicker label noise (dropped both i18n
keys + JSX), FEATURED ribbon visibility (promoted to absolute-positioned
gold sticker overhanging top-right + richer halo on featured tile),
typography balance (name +0.07rem, subtitle weight 500 / opacity 0.78
so it supports instead of competes), and the empty space below the
catalog (ghost dashed "More treasures coming" card reusing existing
`moreSoonTitle` + `moreSoonHint` copy).

The icon overhang took 3 attempts to land: shifting the catalog right
(`pl-6`) worked but broke bilateral symmetry; dropping `pl-6` made
icons read flush against the card; the final fix moved the icon to
**`position: absolute, left: -18px`** out of the grid flow entirely.
Tile now uses single-column grid with `padding-left: 108px` reserving
icon footprint. Icon escapes the card visibly without fighting the
ancestor `overflow-x: clip` on `.mission-shell` / `.sheet-bg-shop`.

## Decisions made

- **PRO in the shop sheet** — overrides the original "PRO renders as
  its own stand-alone card in /hub" docblock decision from
  `shop-catalog.ts`. The standalone `<ProSheet>` continues to exist for
  hero-style discoverability; the shop tile is an additional route to
  the same SKU.
- **Section headers dropped** — the per-tile bg textures and bespoke
  art provide enough visual separation that `SUPPORT` / `TRAINING`
  headers cost vertical real-estate without earning attention. Flat
  list in `SHOP_ITEMS` order.
- **Kicker labels dropped** — `TRAINING ITEM` / `SUPPORT CHESSCITO`
  was redundant meta-noise. The bg color + bespoke art + product name
  already disambiguate. i18n keys removed from `editorial.ts` +
  `messages/es.ts`.
- **`.candy-tray-pill` family for all shop buttons** — replaced
  `PrincipalButton` (wood-carved green plank) which clashed with the
  per-tile bg textures. Two modifiers (`--green`, `--yellow`) tint
  the buttons; all 4 buttons share the same HUD chip silhouette.
- **Icon positioning via absolute** — grid + negative margin couldn't
  produce visible overhang without either clipping (vs ancestor
  `overflow-x: clip`) or asymmetric paddings. Absolute positioning
  out of the grid flow is the robust solution. Tile reserves
  `padding-left: 108px` so identity + footer stay clear.

## Files touched (key)

- `apps/web/src/components/exercises/shop-sheet.tsx` — full rewrite of
  the tile card structure
- `apps/web/src/components/exercises/exercises-screen.tsx` — wired the
  PRO buy → verify-pro branch (legacy path)
- `apps/web/src/lib/shop/use-shop-sheet-state.ts` — same wire for the
  modern hook
- `apps/web/src/lib/contracts/shop-catalog.ts` — `SHOP_ITEMS` order,
  `SHOP_TILE_ASSETS` map
- `apps/web/src/lib/content/editorial.ts` — added `pro` copy, removed
  `kicker` + `sections` keys
- `apps/web/src/lib/content/messages/es.ts` — ES translations
- `apps/web/src/app/globals.css` — `.shop-item-tile-*` namespace
  rebuilt
- `apps/web/public/art/shop/` — 18 new asset files (icons + bgs ×
  triplet)
- `apps/web/e2e/visual-regression.spec.ts-snapshots/hub-shop-sheet-open-minipay-darwin.png` — baseline refreshed
- Tests: `shop-catalog.test.ts`, `use-shop-sheet-state.test.tsx`
  updated for new order + PRO assertion + verify-pro fetch test

## Open work / follow-ups

- **`SHOP_DEPLOY_BLOCK_CELO` env var** — was flagged in earlier handoff
  (2026-05-20 post-domain-migration) as "not yet set in production".
  Still applicable, orthogonal to this session.
- **Streak Shield subtitle wrap** — at 390px the subtitle "Retry
  without losing your streak." just barely fits on a single line. If
  the i18n copy ever grows (Spanish translation is longer), it'll
  wrap to two lines. Acceptable for v1 but worth noting.
- **`hub-clean` VR flake** — pre-existing, tracked in deferred-work
  2026-05-23. Reproduces on clean main. Independent of this work.
- **Subtitle/name color contrast on amber bg** — Founder's orange bg
  + cream text is borderline on WCAG. Sally chose not to bump
  contrast more (would feel "shout-y") but worth measuring if a
  contrast audit ever runs.

## Memory updates

- New `project_shop_redesign.md` — full state of the shop sheet
  architecture post-redesign
- New `feedback_overflow_clip_escape_pattern.md` — the "absolute-
  position to escape ancestor overflow:clip" pattern
- Existing `feedback_ui_ux_proposals.md` (saved earlier in session) —
  user feedback on my tendency to propose UI/UX alternatives that
  miss the mark
- `MEMORY.md` index updated with new entries

## Test trajectory

- 1947 → 1947 unit (stable across the full session)
- VR: hub-shop-sheet-open baseline refreshed at each significant
  visual change (6 refreshes total). Final state stable across 3
  consecutive successful runs.
