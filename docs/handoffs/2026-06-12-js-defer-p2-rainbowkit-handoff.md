# Handoff — P2 RainbowKit removal SHIPPED TO PROD (2026-06-12)

## State

`main` = `production` = `05bb1a5a`, live on www.chesscito.com. Branch
`feat/p2-rainbowkit-removal` merged FF and deleted. Restore points:
tag `pre-p2-rainbowkit-2026-06-12` (P1+P3 only) · tag
`pre-js-cluster-defer-2026-06-12` (pre-everything).

## What shipped (4 commits, `b3d940ef..05bb1a5a`)

RainbowKit REMOVED from the app (not deferred — removal is the only coherent move:
its modal needs `connectorsForWallets` in the wagmi config, which anchors the
package in every route; and the modal only ever listed one wallet).

- `b3d940ef` `useConnectWallet()` in `src/lib/wallet/` — direct injected connect,
  silent no-op without provider, useCallback-stable (hook-ref-stability).
- `13c9453d` `wallet-provider.tsx` → plain wagmi `injected()` connector (same id
  `"injected"` → zero-click path byte-identical). `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
  no longer read (env var can be deleted from Vercel whenever).
- `3c07b804` 10 callsites swapped (`openConnectModal?.()` → `connectWallet()`) + 8 test files.
- `05bb1a5a` dep removed from package.json.
- Also: `minipay-form-answers.md` §dependencies updated (RainbowKit out) — form NOT yet sent.

**UX change (intentional, pre-launch approved):** desktop connect CTA opens the
extension directly (no intermediary modal); no wallet installed → no-op.

## Validation

- Suite **3669/3669** · arena-flow E2E 8/8 · VR 49/49 no-refresh · tsc clean.
- **Founder device smoke PASSED**: MiniPay zero-click + tx, and web+MetaMask connect.

## Results

First Load JS (cluster total, pre → post):
- `/arena` 573 → **352 kB** (−39%) · `/exercises` 584 → **363 kB** (−38%) · `/hub` 439 → **307 kB** (−30%)

Scores on prod:
- **/hub 88 oficial (PSI founder, Moto G/lr)** — best ever (85 pre-cluster). LCP 3.9s, TBT 70ms, CLS 0.
- /arena 84 local-LH (oficial pendiente) — **Render Delay 4264 → 1513 ms** (−65%).
- /arena 77 oficial tras P1; el oficial post-P2 lo corre el founder en pagespeed.web.dev.

## Next levers (from the founder's PSI 88 report, in value order)

1. **P4 CSS split** — now the #1 visible lever: render-blocking CSS 510ms
   (globals.css 46.6KB transfer) + unused CSS 40KB. Plan: per-surface split via
   component CSS imports (`.arena-*`/`.playhub-*` prefixes make it mechanical).
   VR-heavy pass; own session.
2. **Chunk `3620` unused JS 42KB** — identify (bundle-analyzer) before acting.
3. Responsive images portal/avatar (~31KB): PSI keeps flagging; prior triage said
   DPR false-positive — re-check `sizes`/`srcset` once before closing permanently.
4. Legacy polyfills 12KB: known, not profitable (Next 14 core).

## Open questions

- Founder: PSI oficial /arena + /exercises post-P2 cuando tenga un momento.
- ¿Borrar `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` de Vercel env? (ya no se lee)
- SEO 63 = noindex intencional del app shell (decidido, no re-litigar).
