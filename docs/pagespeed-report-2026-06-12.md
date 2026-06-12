# PageSpeed Report — Chesscito (2026-06-12)

**Date:** 2026-06-12. **Target:** production `https://www.chesscito.com/hub` (canonical; apex 307s to www).
**Tool:** Lighthouse CLI 12.8.2 via `npx`, local headless Chrome. Mobile = default `simulate` (Moto G Power, slow 4G, 4× CPU). Desktop = `--preset=desktop`.
**Reason:** the 2026-06-03 report was stale (9 days) for the MiniPay Stage-2 submission. No perf work has shipped since, so this is a re-baseline, not a validation.

> **Method caveat:** Lighthouse 12.8.2 hits a `@paulirish/trace_engine` crash (`computeInsightsForNavigation`) on ~⅔ of mobile runs, yielding a null score. Numbers below are the **valid** runs only (2 of 6 mobile attempts produced a score). The PageSpeed Insights public API was quota-exhausted (shared anonymous project) — use a PSI API key for the official submission number.

---

## Results — `/hub`

| Metric | Mobile (valid runs) | Desktop |
|---|---|---|
| **Performance score** | **70–80** (samples: 70, 80) | **93** |
| FCP | 1.5 s | 0.7 s |
| LCP | 5.3–7.2 s | 1.7 s |
| TBT | 90 ms | 0 ms |
| CLS | 0–0.12 | 0 |
| Speed Index | 2.3–3.6 s | 1.1 s |

## vs 2026-06-03 baseline

| | 2026-06-03 | 2026-06-12 | Delta |
|---|---|---|---|
| Mobile score | 72 | 70–80 | ~flat (within run-to-run variance) |
| Desktop score | 95 | 93 | ~flat |
| Mobile CLS | 0.187 | 0–0.12 | improved / the 0.187 looks like an outlier |
| Mobile LCP | 4.9 s | 5.3–7.2 s | high variance; LCP is the dominant mobile cost |

## Read

- **No regression, no improvement** — expected, nothing perf-related shipped since 2026-06-03.
- **Mobile is still below MiniPay's 90+ bar** (~70–80). The gap is **LCP-bound** (5–7 s on throttled mobile); TBT/CLS are fine.
- The earlier CLS 0.187 reading was likely an outlier — current runs show 0–0.12.

## To reach 90+ mobile (unchanged roadmap from 2026-06-03)

1. Dynamic-import wagmi/RainbowKit off the critical path on non-landing routes (~550 ms, ~110 KiB unused JS).
2. Inline critical CSS / defer render-blocking CSS (~290 ms).
3. Tailwind purge audit (~220 ms, ~39 KiB).
4. Responsive images + ensure hot surfaces serve webp/avif (ties into the asset-optimization P1).

**For the MiniPay form:** re-run with a PSI API key against the production URL right before submitting; cite that number. This local re-baseline is for our own tracking.
