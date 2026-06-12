# Handoff — §8 Analytics + Perf Push (2026-06-12)

## Resume entry point

> **On "continuemos": start the PERF PUSH lever #2 — reduce the JS render-delay.** This is the
> only lever that moves mobile /hub to 90+. Read the "Perf push state" section below first, then
> the `2026-06-03-hub-render-delay-audit.md`. Lever #1 (images) is DONE + deployed. Do lever #2
> as a focused TDD pass WITH an arena smoke — the wagmi/RainbowKit provider tree + arena PLAY
> timer are documented-fragile (see memories `arena-play-timer-fragility`, `hook-ref-stability`).

## What shipped this session (on `main`, now promoted to `production` @ `43dac2bd`)

Production was **124 commits behind** main; this session's promote synced it (FF-only, pre-launch
= no real users). The session's own work:

1. **§8 Analytics — `/stats` On-chain Activity block** (the last MiniPay Stage-2 blocker). Per-method
   tx counts (Victory mints / Get Peones / on-chain score saves / Welcome packs × lifetime/30d/7d),
   unique on-chain wallets, Get Peones volume per USDC/USDT/cUSD — all from existing Supabase mirror
   tables (no indexer, no new schema). Network fees / failed-tx / retention / countries honestly
   disclosed as "Coming next". Spec + red-team: `docs/specs/stats-onchain-metrics-minipay-s8*.md`.
   Code: `apps/web/src/lib/stats/onchain.ts` (pure helpers + `fetchOnchainStats`), wired into
   `public-aggregator.ts`, UI in `components/stats/stats-page.tsx`. **63/63 tests.**
2. **Payment P1 fixes (TDD)**: `verify-payment` re-checks idempotency on ANY insert error (no more
   false 500 after on-chain transfer landed); `usePaymentRail` auto-retries transient verify
   failures with `[1s,3s,8s]` backoff. `fb318630`, `fd6c7860`.
3. **MiniPay message-signing P0 — DISPROVEN.** On-device probe (`/dev/sign-probe`) confirmed MiniPay
   **supports `personal_sign`**; the celopedia "no message signing" rule is stale. Welcome Pack +
   Coach delete keep their signature auth. See memory `minipay-supports-personal-sign`.
4. **Asset optimization** — red-team finding was mostly a **false positive** (triplet complete for
   all `public/art/**`). Real work: 3 raw menu icons → `<picture>` negotiation; 5 oversized /hub
   images downscaled to ~3× display (~86KB avif saved). VR hub-clean + hub-shop-sheet pixel-identical.
5. **Docs**: red-team flow audit + narrative steelman (`docs/reviews/red-team-2026-06-11.md`),
   MiniPay readiness re-review (`docs/submission/2026-06-11-minipay-readiness-review.md`), fresh
   PageSpeed baseline, CLAUDE.md insights additions, README sync.

## Perf push state (THE active work)

Goal: mobile `/hub` PageSpeed **70–80 → 90+**. Diagnosis is done; this is the key finding:

**The mobile score is bound by LCP, and LCP is ~89% RENDER DELAY (~6.7s) — JS/hydration, NOT images.**
- Lever #1 (responsive images) — **DONE + deployed**. Saved bytes (responsive-images opportunity
  185KB → 114KB on the preview; ~86KB avif) but **could not move the score** because LCP isn't
  load-bound (LCP Load Time = 0ms). Worth it for slow-connection users, not for the score.
- **Lever #2 (unused-JS / hydration) — THE lever, HIGH RISK, NOT YET STARTED.** ~610ms unused JS
  (wagmi/RainbowKit on the critical path) + the 6.7s render delay. Dynamic-import the wallet
  provider tree off the /hub initial render + cut hydration cost. Risky: provider tree + arena PLAY
  timer fragility. Needs focused TDD + arena smoke (`/arena?fresh=1` → PLAY → board reaches play).
- Lever #3 (CSS) — render-blocking CSS ~260ms + ~40KB unused Tailwind. Medium risk (VR-sensitive).

**Measurement caveat:** preview URLs (`chesscito-git-main-goodwolf.vercel.app`, etc.) show the
**build version pill** (`template.tsx` → `BuildVersionGate`) which is a post-hydration client element
that ANCHORS the LCP on preview — it's **hidden on production** (`VERCEL_ENV === "production"`). So
preview LCP (7.5s) is pill-contaminated. Measure **production** (`www.chesscito.com`) for the real
number, once this promote propagates. Prod LCP was still 5–7s pre-change → prod has its own
render-delay anchor; lever #2 is still the fix.

## Other open items (lower priority)

- **§8 packet appendix**: append a `/stats` screenshot + present/coming metric split to
  `docs/submission/2026-06-05-minipay-stage-2-packet.md` before returning the MiniPay form.
- **PSI re-measure on prod** with an API key (anonymous quota was exhausted) once the promote is live.
- **Self-built geo + retention** (replaces the "Vercel top-countries" idea): Vercel Web Analytics has
  no free data API (Drains is Pro/paid; CSV is manual) and adds a MiniPay origin to declare. Cheaper
  + better: store the free `x-vercel-ip-country` header into our own `analytics_events` (add a
  `country` column) → aggregate top-countries on `/stats`; retention from existing wallet timestamps.
  Free, no new origin, fits the aggregator philosophy. This upgrades §8's "Coming next" lane.
- **Nickname onboarding brainstorm** (#1 the founder floated): single SIWE-style onboarding signature
  → login + claim nickname + welcome pack. Now viable (signing works in MiniPay). Nickname also
  satisfies the "no raw 0x as primary identifier" MiniPay rule. Use the brainstorming skill first.

## MiniPay Stage-2 readiness snapshot

Returnable after P1 polish. Cleared: message-signing (works), §8 analytics (shipped), assets
(triplet complete). Remaining before submit: PSI re-run + §8 packet appendix. Everything else
passes (zero-click connect, no-CELO scope, AddCash deeplink, support+legal, strict copy, contracts
verified, 360×640).
