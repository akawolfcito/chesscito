# PageSpeed Report — Chesscito (2026-06-03, post-deploy)

**Date:** 2026-06-03 (Lighthouse `fetchTime` 2026-06-03T05:24–05:30Z)
**Production commit shipped:** `c99b0a34` (which contains `51a553e2` — `perf(i18n): serve default locale from root paths`).
**Reason:** close the loop on the i18n redirect fix. The prior report (`docs/pagespeed-report-2026-06-02.md`) measured the previous behaviour; this one measures production after promote to validate the predicted savings.
**Tool:** Lighthouse CLI 12.8.2, local headless Chrome, Node 20.19.5.
**Throttling:** mobile = default Lighthouse `simulate` (Moto G Power, slow 4G ~1.6 Mbps, 4× CPU slowdown). Desktop = `--preset=desktop`.

---

## TL;DR

The i18n switch landed and the redirect cost dropped to **0 ms** on every measured route. Mobile `/hub` perf score went **53 → 72** (+19). Desktop `/hub` went **55 → 95** (+40, into the green band). Mobile is not at MiniPay's 90+ threshold yet but is now a fixable distance away rather than a structural problem.

One regression flagged for follow-up: **`/hub` mobile CLS 0.126 → 0.187** (worsened). The previous theory ("CLS was a redirect-induced timing artifact") is partially wrong — the layout shift is real and now better measured without the redirect noise.

---

## Per-URL results

### A. `https://www.chesscito.com` (`/`)

Landing page still produces `null` perf score in Lighthouse 12 (LCP undetectable across all attempts — same trace_engine bug seen in the prior report). What we can measure:

| Metric | Mobile | Desktop |
|---|---|---|
| Performance score | **null** (LH bug) | **null** (LH bug) |
| FCP | 1.5 s | 0.8 s |
| LCP | null | null |
| TBT | null | null |
| CLS | 0 | 0 |
| SI | 5.8 s | 1.1 s |
| TTI | null | null |
| Byte weight | 755 KiB | 763 KiB |
| Redirects cost | **0 ms** ✅ | **0 ms** ✅ |
| Final URL | `https://www.chesscito.com/` | `https://www.chesscito.com/` |

The redirect cost being 0 ms is the headline confirmation: pre-fix this URL routed through `/ → /en` (≈3.5 s mobile / ≈11 s desktop). Post-fix it serves the EN content directly.

The persistent null LCP on the landing is a Lighthouse limitation on this page, not a real UX issue. Recommend a `pagespeed.web.dev` second opinion when PSI API quota resets (CrUX-based, more robust than CLI).

### B. `https://www.chesscito.com/hub`

| Metric | Mobile | Desktop |
|---|---|---|
| **Performance score** | **72** | **95** ⭐ |
| FCP | 1.7 s | 0.8 s |
| LCP | 4.9 s | 1.4 s |
| TBT | 90 ms | 0 ms |
| CLS | 0.187 ⚠️ | 0 |
| SI | 2.8 s | 1.0 s |
| TTI | 6.0 s | 1.4 s |
| Byte weight | 968 KiB | 977 KiB |
| Redirects cost | **0 ms** ✅ | **0 ms** ✅ |
| Final URL | `https://www.chesscito.com/hub` | `https://www.chesscito.com/hub` |

Desktop crosses the "green" line at 95 — for desktop traffic the hub is now production-grade fast. Mobile is at 72, in the yellow band; 18 points short of MiniPay's 90+ ask.

### C. `https://www.chesscito.com/en/hub` (back-compat sanity)

Confirms next-intl canonicalization works for legacy bookmarks. Mobile perf 73, FCP 1.8 s, LCP 6.7 s, TBT 130 ms, CLS 0, SI 3.4 s, redirects_cost **1151 ms** (the 307 → bare). One-hop cost for stale links, matching the audit prediction.

---

## Redirect cost — before / after

| URL | Pre (2026-06-02) | Post (2026-06-03) | Delta |
|---|---|---|---|
| `/hub` mobile | 3553 ms | **0 ms** | **−3553 ms** ✅ |
| `/hub` desktop | 10935 ms | **0 ms** | **−10935 ms** ✅ |
| `/` mobile | (broken measurement) | 0 ms | confirmed clean |
| `/` desktop | (broken measurement) | 0 ms | confirmed clean |
| `/en/hub` mobile (legacy) | n/a | 1151 ms | one-hop cost, by design |

The `redirects` audit savings dropped to zero on every canonical URL. Predicted savings realized.

---

## Headline metrics — before / after (`/hub`)

| Metric | Pre (2026-06-02) | Post (2026-06-03) | Delta |
|---|---|---|---|
| Mobile perf score | 53 | **72** | **+19** |
| Desktop perf score | 55 | **95** | **+40** ⭐ |
| Mobile FCP | 4.0 s | 1.7 s | −2.3 s |
| Mobile LCP | 9.1 s | 4.9 s | −4.2 s |
| Mobile TBT | 100 ms | 90 ms | −10 ms (within variance) |
| Mobile CLS | 0.126 ⚠️ | **0.187** ⚠️ | **+0.061 (worse)** ❌ |
| Mobile SI | 11.1 s | 2.8 s | −8.3 s |
| Mobile TTI | 9.1 s | 6.0 s | −3.1 s |
| Desktop FCP | 11.4 s | 0.8 s | −10.6 s |
| Desktop LCP | 12.2 s | 1.4 s | −10.8 s |
| Desktop SI | 15.9 s | 1.0 s | −14.9 s |
| Mobile byte weight | 968 KiB | 968 KiB | unchanged |

Everything except CLS moved in the right direction, most metrics dramatically. The desktop outlier (FCP 11.4 s / LCP 12.2 s pre-fix) was the redirect chain bleeding into desktop timing — now normalized.

---

## CLS regression — investigation TODO

Mobile `/hub` CLS jumped from 0.126 to 0.187 between the two reports.

The previous report hypothesized that the 0.126 was an artifact of the 307 redirect "timing" — the page paints once at the redirect-chain entry, then again after the real hub renders. With the redirect gone, the theory was that CLS would normalize to ~0.038 (the value seen on the direct `/en/hub` measurement in the pre-fix report).

That did not happen. Instead CLS got worse. This means:

1. The CLS is **caused by something on the hub itself**, not by the redirect cycle.
2. The new measurement is cleaner — the layout shift was always there but partially masked by the redirect chain repaint.

Most likely suspects (informed by the hub layout, not verified):

- Dock / HUD post-mount shifting after wallet detect (`useMiniPay()` returns updated state, dock chips re-render, anchors move).
- Hero animation / Lottie layer pushing content down on initial mount.
- Wallet connection pill swapping from "Connect" → "Connected (alias)" → "MiniPay detected" — different widths, can push the row.

This is an open follow-up, not blocking. Should be folded into the next mobile-quality cluster (likely with the 360×640 audit, since the dock anchor is also a mobile-specific concern).

---

## Distance to MiniPay 90+ mobile target

Current: 72 mobile on `/hub`. Gap: 18 perf points.

Remaining opportunities (from the LH report on `/en/hub` mobile, still applicable):

| Saving | Bytes | Audit | Notes |
|---|---|---|---|
| 550 ms | 110 KiB | `unused-javascript` | wagmi / RainbowKit / viem chunks — dynamic-import for non-landing routes |
| 290 ms | — | `render-blocking-resources` | critical CSS / `<head>` blocking |
| 220 ms | 39 KiB | `unused-css-rules` | Tailwind purge sweep for hub bundle |
| 50 ms | 31 KiB | `uses-responsive-images` | already mostly done, residual |
| 50 ms | 12 KiB | `modern-image-formats` | AVIF/WebP sweep already in place, residual |
| 50 ms | 11 KiB | `legacy-javascript` | modern-only bundle for evergreen browsers |

Adding all moderate savings (550 + 290 + 220 = 1060 ms) and assuming each ~100 ms of TBT correlates loosely to ~5 perf points on mobile, the gap is closeable in one disciplined optimization pass — call it half a day of work. Not structural.

---

## INP

Still field-only. Not measured here. Recommend pulling CrUX data via `pagespeed.web.dev` when the CrUX dataset has enough volume (today Chesscito likely doesn't qualify; check again post-MiniPay listing).

---

## Caveats

1. **Single-run variance** ±5–10 perf points on mobile. `/hub` mobile 72 could realistically be 65–80 across re-runs. Treat as directional.
2. **LH 12 trace bug on landing** persists — landing scores `null` consistently. Not a regression, a Lighthouse limitation on this specific page. `pagespeed.web.dev` second opinion still recommended.
3. **Field data (CrUX)** not included. All numbers are lab/synthetic.
4. **Production traffic pattern** may differ — these measurements are cold-cache, no warmed Vercel edge cache.

---

## Exact commands executed

```bash
mkdir -p /tmp/psi-after && cd /tmp/psi-after

# Mobile
npx --yes lighthouse@12 https://www.chesscito.com \
  --quiet --chrome-flags="--headless=new --no-sandbox" \
  --output=json --output-path=lh-root-mobile.json \
  --only-categories=performance

npx --yes lighthouse@12 https://www.chesscito.com/hub \
  --quiet --chrome-flags="--headless=new --no-sandbox" \
  --output=json --output-path=lh-hub-mobile.json \
  --only-categories=performance

# Desktop
npx --yes lighthouse@12 https://www.chesscito.com \
  --quiet --chrome-flags="--headless=new --no-sandbox" --preset=desktop \
  --output=json --output-path=lh-root-desktop.json \
  --only-categories=performance

npx --yes lighthouse@12 https://www.chesscito.com/hub \
  --quiet --chrome-flags="--headless=new --no-sandbox" --preset=desktop \
  --output=json --output-path=lh-hub-desktop.json \
  --only-categories=performance

# Back-compat sanity (legacy /en/hub)
npx --yes lighthouse@12 https://www.chesscito.com/en/hub \
  --quiet --chrome-flags="--headless=new --no-sandbox" \
  --output=json --output-path=lh-enhub-mobile.json \
  --only-categories=performance
```

Raw JSON in `/tmp/psi-after/` on the measurement host — not committed, regenerable from URL + command.

---

## Recommended next commit

Two viable directions. Both close the MiniPay listing checklist further:

### Option A — close the perf gap to 90+ mobile (≈half-day)

Adjacent commits, each measurable:

1. `perf(bundle): dynamic-import wagmi/RainbowKit for non-landing routes` — targets the 550 ms unused-JS opportunity. Expected: mobile 72 → ~80.
2. `perf(css): purge unused Tailwind from hub bundle` — targets 220 ms unused-CSS. Expected: mobile +3-5.
3. `perf(head): preconnect to forno.celo.org + walletconnect + supabase` — targets render-blocking. Expected: mobile +3-5.

End state: mobile `/hub` projected 85–90. Within MiniPay's submission ask.

### Option B — pivot to the next listing-checklist P0 (360×640 audit + fixture)

The audit was already started this session (Apéndice 2 of the integration audit). Concrete next steps:

1. Add Playwright fixture at `360 × 640` to `playwright.config.ts` minipay project (currently 390 × 844 only).
2. Run the suite at 360 viewport → identify visual breaks.
3. Patch the breaks (likely `hub-v2` `@media (max-width: 370px)` rule extension, padding adjustments on the `min-width: 260px` chips).

Independent of perf. Closes the second MiniPay listing P0.

### My recommendation: Option B first, then Option A

Reasoning:
- 360×640 is a hard listing requirement — without it, even a 95-mobile perf score doesn't unlock submission.
- Perf 72 mobile is in the yellow band, not the red. It's reviewable, not blocking, while we work on layout.
- Option A's bundle work pairs well with the 360×640 work because both surface mobile-quality regressions in the same fixtures.
- The CLS regression at 0.187 is mobile-specific and may surface in the 360 audit anyway.

If you want the perf-first sequence (Option A), the alternative is fine too — both end at the same destination.

---

## Sign-off

| Item | Status |
|---|---|
| Production tip | `c99b0a34` |
| `51a553e2` present in `origin/production` | YES |
| `/hub` mobile redirect cost: 3553 ms → 0 ms | ✅ |
| `/hub` desktop redirect cost: 10935 ms → 0 ms | ✅ |
| Mobile `/hub` perf score: 53 → 72 | ✅ (gap to 90+: 18 points) |
| Desktop `/hub` perf score: 55 → 95 | ✅ |
| Mobile `/hub` CLS: 0.126 → 0.187 | ⚠️ regression, follow-up logged |
| MiniPay submission perf ask (90+ mobile) | ❌ not yet — 18 points short |
| Next action | Option B (360×640) recommended; Option A (perf push) viable alternative |
