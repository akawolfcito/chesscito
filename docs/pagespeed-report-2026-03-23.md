# PageSpeed Report — Chesscito

**Date:** 2026-03-23
**URL audited:** https://chesscito.vercel.app
**Strategy:** Mobile (emulated Moto G Power with throttled 4G)
**Tool:** Lighthouse 12.8.2 (headless Chrome)
**Environment:** Production (Vercel)

## Scores

| Category | Score |
|----------|-------|
| **Performance** | 54 |
| **Accessibility** | 89 |
| **Best Practices** | 96 |
| **SEO** | 100 |

## Core Web Vitals & Metrics

| Metric | Value |
|--------|-------|
| First Contentful Paint (FCP) | 1.1 s |
| Largest Contentful Paint (LCP) | 8.9 s |
| Total Blocking Time (TBT) | 740 ms |
| Cumulative Layout Shift (CLS) | 0 |
| Speed Index | 4.8 s |
| Time to Interactive (TTI) | 9.1 s |

## Top Opportunities

| Opportunity | Estimated Savings |
|-------------|-------------------|
| Reduce unused JavaScript | ~1,000 ms |
| Preconnect to required origins | ~300 ms |
| Avoid serving legacy JavaScript to modern browsers | ~170 ms |
| Eliminate render-blocking resources | ~74 ms |

## Diagnostics

- **Reduce unused JavaScript:** ~197 KiB could be deferred or removed
- **Eliminate render-blocking resources:** Blocking CSS/JS delays first paint

## Assessment

- **SEO (100) and Best Practices (96):** Excellent — no action needed.
- **Accessibility (89):** Good. Minor improvements possible but not blocking for submission.
- **Performance (54):** Below ideal. Main bottlenecks are LCP (8.9s) and TBT (740ms), driven by unused JavaScript and large bundle size. This is common for wagmi/RainbowKit/viem apps due to heavy wallet dependencies.

## Recommended Quick Wins (post-submission)

1. **Preconnect to RPC/wallet origins** — add `<link rel="preconnect">` for `forno.celo.org` and WalletConnect hosts
2. **Dynamic imports** — lazy-load wallet/arena code that isn't needed on initial render
3. **Bundle analysis** — run `@next/bundle-analyzer` to identify largest chunks
4. **Image optimization** — ensure background images use `next/image` or are pre-optimized

## Note for MiniPay Submission

MiniPay requests a PageSpeed score. While 54 on Performance is below the typical "green" threshold (90+), the app loads fast on real MiniPay WebView (which doesn't have Lighthouse's aggressive throttling). CLS=0 and FCP=1.1s are strong. The performance bottleneck is JS bundle size from wallet dependencies, which is standard for Web3 MiniApps.
