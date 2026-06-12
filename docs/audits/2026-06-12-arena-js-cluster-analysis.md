# /arena JS Cluster — Defer Analysis (ANALYSIS-ONLY)

**Date:** 2026-06-12 · **Commit analyzed:** `df801fc5` (= `main`, clean tree)
**Mandate:** validate benefit + risk of deferring wagmi/RainbowKit before touching code
(handoff `docs/handoffs/2026-06-13-perf-close-and-js-cluster-next-handoff.md`).
**Method:** `@next/bundle-analyzer@14.2.35` installed temporarily, `ANALYZE=true pnpm build`,
chartData JSON parsed per-package (gzip), cross-referenced with `app-build-manifest.json`
per route. All tooling reverted; working tree clean.

## 1. Measured first-load composition (gzip)

| Route | First-load JS (build) | Measured gzip total |
|---|---|---|
| `/arena` | 573 KB | ~560 KB |
| `/hub` | 439 KB | ~429 KB |
| `/exercises` | 584 KB | not in scope this pass |
| `/` landing | 134 KB | wagmi-free already |

### /arena breakdown (top groups, gzip)

| Stack | KB gz | Packages |
|---|---|---|
| Next runtime + framework | ~123 | fixed floor, not actionable |
| App code | ~106 | page is a 1492-line client monolith |
| **Lottie** | **~109** | lottie-web 74.7 + @lottiefiles/dotlottie-react 33.9 |
| **wagmi/viem core** | **~165** | viem 71.3 + ens-normalize 23.6 + ox 13.3 + noble 17 + @wagmi/core 13.6 + connectors 6.0 + wagmi 4.1 + query-core 9.8 + abitype 6.3 |
| **RainbowKit** | **~64** | rainbowkit 43.9 + qr 7.9 + ua-parser-js 8.5 + react-remove-scroll 3.9 |
| Chess engines | ~29 | js-chess-engine 18.3 + chess.js 11.1 |

`/hub` = same minus Lottie (~429 KB). PSI's "~107KB unused wagmi/RainbowKit" ≈ RainbowKit
stack + ens-normalize + unused viem ENS surface. **Landing `/` does NOT pay wagmi** — its
134 KB confirms the root-layout `WalletProvider` cost lands in shared route chunks, not in
the landing graph (layout chunks for `/` exclude the wagmi group).

### Handoff Q1 — the three named chunks, identified

| Chunk | KB gz | Content |
|---|---|---|
| `6427-*` | 75.5 | viem core 57.3 + ox 12.2 + noble/curves + abitype |
| `3446-*` | 67.0 | ens-normalize 23.6 + ua-parser 8.5 + qr 7.9 + @wagmi/core 7.7 + rainbowkit 7.0 + connectors 6.0 |
| `1fa7ebf3-*` | 37.0 | @rainbow-me/rainbowkit core, 100% |
| `2d1400c4-*` | 74.7 | lottie-web 100% (arena-only, NOT in handoff's list) |
| `c12663c9-*` | 34.0 | dotlottie-react 100% (arena-only) |

## 2. Handoff Q2 — who consumes wagmi/RainbowKit at first render

- **Provider:** `WalletProvider` wraps ALL routes in `[locale]/layout.tsx:138`.
- **Zero-click MiniPay** lives in `WalletProviderInner` (`wallet-provider.tsx:51-75`) and uses
  **only wagmi** (`useConnect` + connector id `"injected"`). It does NOT touch RainbowKit.
  → RainbowKit defer CANNOT break zero-click. wagmi core defer WOULD.
- **First render hub:** `hub-scaffold-client.tsx:163-224` — `useAccount`, `useChainId`,
  `useReadContracts`, `useConnectModal` (optional-chained, race-safe per its own comment).
- **First render arena:** `page.tsx:10,146` — `useAccount`, `useChainId`, `useConnectModal`
  (modal opened only at line 1404, a CTA tap).
- **`useConnectModal` callsites (10):** arena/page, hub-scaffold-client, exercises-screen,
  badge-sheet, trophies-body, use-pro-sheet-state, use-shop-sheet-state,
  use-welcome-pack-claim, dev/sign-probe, dev/rail-smoke.
- `components/connect-button.tsx` (RainbowKit ConnectButton wrapper) has **zero importers** — dead file.

## 3. Handoff Q3 — can RainbowKit defer without touching wagmi? YES, in two steps

**Why the existing `dynamic(RainbowKitProvider, ssr:false)` defers nothing:**
`wallet-provider.tsx:3-5` statically imports `connectorsForWallets`, `injectedWallet`, and
`rainbowkit/styles.css`. Plus 10 files statically import `useConnectModal`. Both keep
`1fa7ebf3` + the rainbowkit slice of `3446` in the synchronous graph of every route.

- **Step 3a (provider side, 1 file):** replace `connectorsForWallets([injectedWallet])` with
  wagmi's own `injected()` connector (`@wagmi/connectors`, already in the bundle). Both
  produce connector id `"injected"` → zero-click selector unchanged (**verify on-device**).
  Drops the WalletConnect projectId requirement and the eager `styles.css`.
- **Step 3b (consumer side, 10 callsites):** mint `useConnectGate()` in `src/lib/wallet/` that
  (a) in MiniPay env → no-op (auto-connect owns it), (b) elsewhere → lazy-mounts a RainbowKit
  island (provider + styles + modal) on first call. Mechanical sed-able swap; the hub
  callsite is already optional-chained, the other 9 must be audited for the same pattern.
- **Expected:** ~64 KB gz off every route, +ens-normalize (23.6) if viem's ENS surface is only
  reached via RainbowKit (analyzer can confirm post-change).
- **Alternative (bigger, later):** drop RainbowKit entirely — wallet list is just
  "Browser wallet"; a custom connect sheet would remove the dep. Not for this cluster.

## 4. Handoff Q4 — arena select as server/static shell: NOT RECOMMENDED now

`arena-select-scaffold.tsx` itself is wagmi-free (245 lines, verified), but extracting it to a
server shell requires splitting the 1492-line `arena/page.tsx` monolith — colliding head-on
with `arena-play-timer-fragility` (400ms timer) and the 9 `?fresh=1` callsites, for a saving
that is mostly hydration scheduling, not bytes. Defer to a future arena-decomposition cluster.

## 5. NEW finding — Lottie is the cheapest big lever (arena-only, ~109 KB gz)

`components/ui/lottie-animation.tsx` statically imports BOTH renderers (lottie-react →
lottie-web 74.7 KB, dotlottie-react 33.9 KB). `arena-hud.tsx:8` imports it statically →
both land in /arena first load. The animation itself (sandy-loading) renders only in
conditional states, never at first paint.

**Fix shape:** make `lottie-animation.tsx` lazy-load its two renderers internally
(`next/dynamic`, fallback = sized empty div). **One file, all 9 consumers benefit, zero
wagmi/timer/zero-click exposure.** Risk is VR-only: baselines that capture a Lottie frame
(coach-loading, victory-*) may need same-PR refresh per `vr-baseline-discipline`.

## 6. Proposed cluster (pending founder GO)

| # | Lever | KB gz off /arena | Risk | Touch |
|---|---|---|---|---|
| P1 | Lottie lazy renderers | ~109 | LOW (VR refresh only) | 1 file |
| P2a | injected() connector swap | (enables P2b) | MED — must smoke zero-click | 1 file |
| P2b | useConnectGate + lazy RainbowKit island | ~64 (+24 ens if dragged) | MED — 10 callsites | 11 files |
| P3 | MiniArenaSheet dynamic on /hub | ~29 off /hub | LOW | 1 file (`hub-arena-tile.tsx:8`) |
| P4 | globals.css split per surface | ~40 KB CSS | MED — VR net | bundled per handoff triage |
| — | delete dead `connect-button.tsx` | hygiene | none | 1 file |

Ceiling honesty: Render Delay 4.3 s is download+parse+exec+hydrate. P1+P2 remove ~30-35% of
non-framework JS on /arena; expect 72 → high-70s, **measure on device**, don't promise 85.

## 7. Validation plan (per lever, in order)

1. Unit suite full run (baseline 3660) — before each commit.
2. `arena-flow` E2E (2/2 green today) — after P1 and each P2 step.
3. **MiniPay zero-click smoke on device** — MANDATORY gate for P2a/P2b: open /hub in MiniPay,
   confirm auto-connect + balances with NO tap; then desktop Chrome connect-CTA → modal lazy-mounts.
4. VR `pnpm test:e2e:visual` — P1 and P4 are the diff-prone ones; refresh in same PR with rationale.
5. PSI re-run on prod /arena + /hub after promote; compare Render Delay, not just score.
6. Memories honored: `arena-play-timer-fragility` (no new effects in arena/page.tsx),
   `hook-ref-stability` (useConnectGate returns memoized fns), `arena-fresh-param` (untouched).

## 8. Open questions for founder

1. GO/NO-GO per lever? Recommended scope if trimmed: **P1 + P3 + dead-file only** (low-risk
   ~109 KB arena / ~29 KB hub) and leave RainbowKit (P2) for its own session with device smoke.
2. P2b changes desktop connect UX timing (modal mounts on first tap, ~1 network beat).
   Pre-launch mode says acceptable — confirm.
3. P4 (CSS split) same cluster or separate VR-heavy pass?
