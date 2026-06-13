# P4 — globals.css split analysis (2026-06-12)

**Verified against:** `main` @ `e9b23b6e`. Sub-agent prefix mapping cross-checked by hand
(import topology, tj/welcome/dock claims) — corrections noted inline.

## Baseline (official PSI, post-P2, founder-run 2026-06-12)

| Route | Perf | Notes |
|---|---|---|
| /hub | 87 | prior best 88 (run variance); A11y 93 |
| /arena | 86 | was 77 post-P1 → **+9 from P2** |
| /exercises | 81 | first official; **A11y 83** (others 93-94) → backlog item |

CSS levers per the PSI 88 report: render-blocking CSS **510ms** (globals.css **46.6KB
transfer**), unused CSS **40KB** on /hub.

## Current state

- `src/app/globals.css`: **12,097 lines / 341KB raw** → 46.6KB compressed transfer.
- Imported in exactly 2 places: `[locale]/layout.tsx:6` and `dev/layout.tsx:10`.
- **Zero CSS modules** in the app; this is the only stylesheet.
- Structure: `@layer base` (vars + typography, ~L53), `@layer base` (2 `@apply` rules,
  ~L461), `@layer components` (everything else, L553→EOF).
- Tailwind content globs only scan `*.{ts,tsx}` → splitting CSS does **not** affect purge.
- Route layouts that already exist: `[locale]/arena/`, `[locale]/hub/`, `[locale]/why/`.
  Missing for: exercises, coach, victory, trophies, share.

## Prefix → surface mapping

Token occurrences in globals.css, with routes that consume them:

| Bucket | Prefixes | Verdict |
|---|---|---|
| **Global system** | `candy-*` (144), `mission-*`, `board-*`, `gem-*`, `badge-*`, `stone-*`, z-index ladder, asset-treatment system, modal-exit animation | stays in shared file |
| **Shared 3+ routes** | `arena-*` (201 — leaks into coach/victory/exercises via popups + ArenaBoard), `hub-*` (156 — HUD chips on arena/exercises), `coach-*` (123 — coach section in arena popups), `playhub-*`, `victory-*`, `reward-*`, `leaderboard-*` | split needs care; see strategy |
| **2 routes** | `shop-*`, `account-*`, `treasure-*`, `kingdom-*` (hub+arena), `trophy-*` | per-surface w/ shared import |
| **Exclusive** | `tj-*` (coach/history + /dev gallery), `welcome-*` (exercises), `landing-*` (/) | clean extraction |
| **Dead** | `.dock-treat-{base,active,pressed}` — 0 tsx consumers (dock uses `dock-item` etc., which are NOT defined in globals.css → Tailwind utilities) | delete in split |

Key finding vs. naive expectation: the biggest families (`arena-`, `hub-`, `coach-`)
are **not route-exclusive** — popups, HUD chips and the coach section cross surfaces.
A pure per-route split would either duplicate rules or break cross-surface UI.

## Mechanism decision

**Chosen: Option A — per-surface plain-CSS files imported by route layouts.**

- App Router supports global (non-module) CSS imports in any nested layout; CSS loads
  only for routes under that layout. Mechanical, no tooling change, VR-verifiable.
- Files would mirror today's `@layer` structure so intra-layer cascade is preserved.

**Rejected: `experimental.optimizeCss` (critters).** Inlines critical CSS but ships the
same total payload, doesn't address the 40KB unused, adds an experimental dependency on
a 12k-line cascade. Wrong tool for this lever.

**Rejected: CSS Modules migration.** Correct long-term but a multi-week rewrite of every
className; not this cluster.

## Proposed file structure

```
src/styles/
  base.css        — @layer base ×2 (vars, typography, @apply) + z-index ladder
  system.css      — candy, mission, board, gem, badge, stone, asset-treatment,
                    modal-exit, reduced-motion        → imported in [locale]/layout
  arena.css       — arena-, playhub-, victory-, treasure-, kingdom-(arena part)
  hub.css         — hub-(hub part), reward-, kingdom-
  exercises.css   — shop-, account-, welcome-, leaderboard-
  coach.css       — coach-, tj-
  landing.css     — landing-
  trophies.css    — trophy-
```

- `[locale]/layout.tsx` imports `base.css + system.css` (always-loaded core).
- Route layouts import their surface file(s). Cross-surface families (e.g. arena popups
  on /coach) resolved by **importing arena.css in both layouts** — Next dedupes a CSS
  chunk imported by multiple layouts; no duplication on a route that loads both.
- `dev/layout.tsx` imports all files (gallery/fixtures need everything).

Expected per-route transfer (rough, proportional to raw size): /hub loses arena+coach+
exercises CSS ≈ **-40-50% CSS transfer**; render-blocking ms scales with it.

## Risks

1. **Cascade order across chunks (THE risk).** Within `@layer components`, equal-
   specificity conflicts resolve by source order. Splitting changes concatenation order
   in prod (chunk order follows layout import graph, and dev≠prod ordering is a known
   App Router caveat). Mitigation: (a) keep each family's overrides in ONE file;
   (b) grep for cross-family same-selector overrides before cutting (e.g. legacy
   `.arena-difficulty-pill` overridden by hud-pill family); (c) full VR run is the gate.
2. **VR blast radius: total.** All 49 baselines exercise this cascade. Plan = full
   `pnpm test:e2e:visual` + manual 390px pass + founder device smoke before promote.
3. **Missing layouts** for exercises/coach/victory/trophies/share must be created
   (pass-through `children` + CSS import) — verify no metadata/exports conflicts.
4. **`im`/partial-prefix collisions**: extraction must be by rule-block section, not
   blind grep (e.g. `.hub-` vs `.playhub-` share substring). Section comments
   (`═══` markers) are the cut guide, prefix grep is the verifier.

## Phase 2 plan (pending go)

1. Pre-cut audit: map cross-family override pairs (same selector defined in 2 future
   files); tag each globals.css section (`═══` headers) to a destination file.
2. Cut in commits per destination file (system → arena → hub → exercises → coach →
   landing/trophies), `pnpm build` green after each.
3. Create missing route layouts; wire imports; delete dead `.dock-treat-*`.
4. Full suite + full VR + bundle output comparison (`next build` CSS sizes per route).
5. In-flight: temp `@next/bundle-analyzer` (recipe: `docs/audits/2026-06-12-arena-js-cluster-analysis.md`
   §Method) to identify chunk `3620` (42KB unused JS). Identify only; act in a later slice.
6. Deploy preview → PSI API spot-check → founder official PSI → promote.

## Results (implemented same session, branch `feat/p4-css-split`)

Split shipped as `perf(css)` commit `d535d212` — plan executed with one deviation:
extraction was classifier-driven (transitive import graph), not section-comment-driven.

- 445 blocks (~103KB raw) moved out of globals.css plain region into
  `src/styles/{arena,hub,coach,exercises}.css`, loaded via route layouts
  (coach + exercises layouts created).
- Built output (gzip): core globals **35.8KB** + arena 3.4 / hub 4.4 / coach 3.3 /
  exercises 2.5. Per-route CSS transfer 46.6 → ~38-40KB gz (**−14-18%**), each route
  sheds the other three surfaces.
- Verified: line-level integrity (every source line owned once), **zero cross-file
  duplicate selectors**, suite 3669/3669, arena-flow E2E 8/8, **VR 49/49 no-refresh**,
  tsc clean.
- NOTHING deleted: `.dock-treat-*` deletion was planned but skipped — sibling
  `.badge-treat-*` family resolves via template-built classNames (`badge-treat-${state}`
  pattern), so "no grep hit" ≠ dead. Dead-CSS pass deferred with dynamic-class-aware
  tooling.
- CSS contract tests (gem, stone-pedestal) updated to read the surface files.

**Phase 2b (layer region 553–4172) — REJECTED with numbers:** classifier over the
@layer components region finds only ~22.5KB raw extractable (arena 9.1 + hub 9.1 +
exercises 2.9 + landing 1.2 + coach 0.3) ≈ ~1KB gz per route, against a real risk:
rules would move from the Tailwind components position (before utilities) to after
utilities, flipping equal-specificity conflicts with utility classes. Not profitable.

**Chunk `3620` identified (analyzer, temp tooling reverted):** wagmi/viem core —
viem 33.0 + wagmi 22.8 + @noble/curves 9.8 + abitype 5.9 + ox 3.0 + @wagmi/core 0.8
= **75.3KB gz / 208KB parsed**, loaded by every wallet route (hub/arena/exercises/
coach/[gameId]). PSI's "42KB unused" = code paths not executed until wallet
interaction. Not removable; only future lever is lazy-loading the wagmi provider
until first wallet intent — architectural, own spec, NOT scheduled.

## Open questions

- /exercises A11y 83: out of P4 scope, file as issue?
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in Vercel: founder said leave for now (2026-06-12).
