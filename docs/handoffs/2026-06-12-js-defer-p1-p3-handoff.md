# Handoff — JS defer cluster P1+P3 shipped (2026-06-12)

## State

`main` = `b5108008`, pushed. Restore point: tag **`pre-js-cluster-defer-2026-06-12`**
(= `186b23f9`, on GitHub — checkout/redeploy that tag to roll back the whole cluster).

Analysis doc (evidence + full lever plan): `docs/audits/2026-06-12-arena-js-cluster-analysis.md`.

## Shipped (founder GO = recommended low-risk scope only)

| Commit | Change | Effect |
|---|---|---|
| `af063d6f` | P1 — `lottie-animation.tsx` lazy-loads both renderers (lottie-web + dotlottie) via `import()` on first mount; placeholder div carries className (CLS guard); module cache avoids re-flash | −109KB gz from every consumer route |
| `1c9d6331` | P3 — `hub-arena-tile.tsx` defers `MiniArenaSheet` via `next/dynamic` + mount-on-first-tap (stays mounted after, exit animations intact) | chess.js + js-chess-engine out of /hub first load |
| `b5108008` | dead `connect-button.tsx` deleted (zero importers) | hygiene |

## Measured First Load JS (build table, before → after)

- `/arena` 573 → **461 kB** (−112)
- `/exercises` 584 → **471 kB** (−113, bonus: exercises also consumed LottieAnimation)
- `/hub` 439 → **408 kB** (−31)

## Validation (all green, no baseline refresh needed)

- Unit suite **3665/3665** (baseline 3660 + 5 new: 3 lottie lazy-contract, 2 sheet-defer contract)
- `arena-flow` E2E **8/8** (desktop + iphone-safari)
- VR **49/49** — no Lottie frame lives in any baseline; nothing refreshed
- `tsc --noEmit` clean

## NOT done (explicitly deferred by founder scope cut)

- **P2 RainbowKit defer (~64-88KB)** — own session; requires `injected()` connector swap +
  `useConnectGate` wrapper across 10 callsites + **mandatory MiniPay zero-click smoke on
  device**. Plan in audit doc §3/§6.
- **P4 globals.css split (~40KB CSS)** — separate VR-heavy pass.
- PSI re-run: only meaningful after promote to `production` (main deploy is not the
  measured surface). /arena 72 baseline stands until then.

## Open questions

1. ¿Promote a prod ahora para medir PSI real del cluster, o esperar a P2 y promover junto?
2. P2: ¿agenda sesión propia con device smoke? (gate obligatorio, no negociable)

## Notes for next session

- `LottieAnimation` consumers need NO changes — lazy logic is internal to the wrapper.
- The placeholder div renders `aria-hidden`; if a future surface needs the animation at
  first paint (none today), that surface must NOT rely on the renderer being synchronous.
- Memories honored: `arena-play-timer-fragility` (arena/page.tsx untouched),
  `arena-fresh-param` (untouched), `vr-baseline-discipline` (VR run pre-push, zero refresh).

## PSI post-promote (2026-06-12, production = `12ec5c6c`, deploy `175dz7nmu`)

- **/arena 72 → 77 oficial (PSI founder)** — lever Lottie confirmada. SEO /arena 100.
- **/hub 76-78 oficial vs 85 previo → NO es regresión.** A/B Lighthouse mismo-día,
  misma red, deployment URLs: pre-cluster `i57stizco` = 82/75, cluster `175dz7nmu` = 81/74.
  El código viejo tampoco da 85 hoy: el delta es entorno/día (LCP ~5s vive en zona de
  jitter donde ±0.5s mueve varios puntos). Sin rollback. Palanca real para /hub 85+ = P2.
