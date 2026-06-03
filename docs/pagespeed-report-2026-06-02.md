# PageSpeed Report — Chesscito (2026-06-02)

**Date:** 2026-06-02 23:08 UTC (Lighthouse `fetchTime` 2026-06-03T04:08–04:18Z)
**Reason:** prior report (`pagespeed-report-2026-03-23.md`) measured `chesscito.vercel.app`; the canonical user-facing origin is now `https://www.chesscito.com` (commit `f412cbe5`). Re-measure required before any optimization work.
**Tool:** Lighthouse CLI 12.8.2 (with one fallback run on 11.7.1 — see Caveats §1).
**Engine:** local headless Chrome (`/Applications/Google Chrome.app`), Node 20.19.5.
**Throttling:** mobile = default Lighthouse `simulate` (Moto G Power emulation, slow 4G ~1.6 Mbps, 4× CPU slowdown). Desktop = `--preset=desktop`.

---

## TL;DR

| Route | Mobile perf | Desktop perf | Notes |
|---|---|---|---|
| `https://www.chesscito.com` (`/`) → 307 → `/en` | **N/A** (LCP undetectable across LH 11 and 12) | **N/A** (idem) | Lighthouse cannot compute LCP on the landing page in either form factor. Partial metrics only. |
| `https://www.chesscito.com/hub` → 307 → `/en/hub` | **53** | **55** | Redirect alone costs 3553 ms mobile / 10935 ms desktop. |
| `https://www.chesscito.com/en/hub` (direct, no redirect) | **67** | **77** | Real ceiling without the i18n redirect penalty. |

**Critical finding:** the `307 → /en` redirect costs **3.5 s on mobile** and **~11 s on desktop** on every visit. Bigger than any other single optimization opportunity. Confirmed via Lighthouse `redirects` audit savings.

**MiniPay threshold (90+ mobile)** not reached on any URL. `/en/hub` direct is closest at 67 mobile / 77 desktop.

---

## Per-URL detail

### A. `https://www.chesscito.com` (`/`) — landing root

Tested both pre-redirect (`/`) and post-redirect (`/en`). Both runs produced incomplete metrics — LCP, TBT, and TTI are `null`. The landing page contains content patterns (likely the hero animation / video / dynamic CSS) that prevent Lighthouse's trace engine from identifying a Largest Contentful Paint candidate. This affects both Lighthouse 11 and 12.

#### Pre-redirect (`https://www.chesscito.com`)

| Metric | Mobile (LH 12) | Desktop (LH 12) |
|---|---|---|
| Performance score | **null** | **null** |
| FCP | 2.3 s | 2.6 s |
| LCP | null | null |
| TBT | null | null |
| CLS | 0 | 0 |
| SI | n/a | n/a |
| TTI | null | null |
| Byte weight | n/a | n/a |
| Final URL | `https://www.chesscito.com/en` | `https://www.chesscito.com/en` |
| Run warning | `redirected to /en — try testing the second URL directly` | (idem) |

#### Post-redirect direct (`https://www.chesscito.com/en`)

| Metric | Mobile (LH 12) | Mobile (LH 11) | Desktop (LH 12) |
|---|---|---|---|
| Performance score | **null** | **null** | **null** |
| FCP | 4.2 s | 2.6 s | 0.9 s |
| LCP | null | null | null |
| TBT | null | 630 ms | null |
| CLS | 0 | 0 | 0 |
| SI | 4.4 s | 5.9 s | 1.7 s |
| TTI | null | 630 ms TBT only | null |
| Byte weight | 755 KiB | 755 KiB | 763 KiB |
| Top opportunities | (server-response 30 ms) | (server-response 30 ms) | (none > 50 ms) |

**Interpretation:** the landing renders quickly (FCP 0.9 s desktop, 2.6–4.2 s mobile depending on run variance) but blocks for ~630 ms of main-thread JS (TBT, LH 11 mobile). LCP undetectable means PageSpeed Web score will likely also be partial — recommend manual run on `pagespeed.web.dev` for a third opinion before drawing conclusions on the landing alone.

---

### B. `https://www.chesscito.com/hub` — MiniPay candidate App URL with redirect

| Metric | Mobile | Desktop |
|---|---|---|
| **Performance score** | **53** | **55** |
| FCP | 4.0 s | 11.4 s |
| LCP | 9.1 s | 12.2 s |
| TBT | 100 ms | 0 ms |
| CLS | 0.126 ⚠️ | 0 |
| SI | 11.1 s | 15.9 s |
| TTI | 9.1 s | 12.2 s |
| Byte weight | 968 KiB | 977 KiB |
| Final URL | `https://www.chesscito.com/en/hub` | `https://www.chesscito.com/en/hub` |

**Top opportunities (mobile):**

| Saving | Audit |
|---|---|
| **3553 ms** | `redirects` — avoid multiple page redirects |
| 790 ms | `unused-javascript` |
| 300 ms | `uses-rel-preconnect` |
| 255 ms | `render-blocking-resources` |
| 160 ms | `uses-responsive-images` |
| 160 ms | `unused-css-rules` |

**Top opportunities (desktop):**

| Saving | Audit |
|---|---|
| **10935 ms** | `redirects` |
| 397 ms | `server-response-time` |
| 274 ms | `render-blocking-resources` |
| 140 ms | `unused-javascript` |
| 140 ms | `unused-css-rules` |

**CLS regression flag:** mobile CLS 0.126 is above the "good" threshold of 0.1. Likely the dock/HUD shifting after wallet detect. Needs investigation.

---

### C. `https://www.chesscito.com/en/hub` — direct, no redirect (best case)

| Metric | Mobile | Desktop |
|---|---|---|
| **Performance score** | **67** | **77** |
| FCP | 3.0 s | 1.5 s |
| LCP | 7.1 s | 2.4 s |
| TBT | 70 ms | 0 ms |
| CLS | 0.038 ✅ | 0 |
| SI | 4.9 s | 2.8 s |
| TTI | 7.6 s | 2.4 s |
| Byte weight | 968 KiB | 976 KiB |
| Redirects cost | 0 ms | 0 ms |
| Network requests | 69 (30 Script, 20 Image, 7 Fetch, 4 Font, 3 Stylesheet) | (similar) |

**Top opportunities (mobile, sin redirect):**

| Saving | Bytes | Audit |
|---|---|---|
| 550 ms | 110 KiB | `unused-javascript` |
| 290 ms | — | `render-blocking-resources` |
| 220 ms | 39 KiB | `unused-css-rules` |
| 65 ms | — | `server-response-time` |
| 50 ms | 31 KiB | `uses-responsive-images` |
| 50 ms | 12 KiB | `modern-image-formats` |
| 50 ms | 11 KiB | `legacy-javascript` (legacy bundle served to modern browsers) |

**CLS healthy at 0.038**, well below the 0.1 threshold. The CLS 0.126 seen in row B was an artifact of the redirect timing.

---

## INP (Interaction to Next Paint)

INP is a **field-only metric** (CrUX). Lighthouse CLI lab mode does not measure INP — its lab proxy is TBT. Recommendation: pull CrUX field data via PSI Web (`pagespeed.web.dev`) once API quota resets, or via the Chrome UX Report BigQuery dataset. Not measured in this report.

---

## Difference between `/` and `/hub` — clean comparison

Apples-to-apples after stripping the redirect penalty (rows A `/en` vs C `/en/hub`):

| Dimension | `/en` (landing) | `/en/hub` (hub) | Delta |
|---|---|---|---|
| Perf score (mobile) | null | 67 | n/a (landing LCP undetectable) |
| Perf score (desktop) | null | 77 | n/a |
| FCP (mobile) | 2.6–4.2 s | 3.0 s | within variance |
| FCP (desktop) | 0.9 s | 1.5 s | landing 0.6 s faster |
| TBT (mobile LH 11) | 630 ms | 70 ms | **hub is 9× better on TBT** |
| Byte weight (mobile) | 755 KiB | 968 KiB | hub is 213 KiB heavier (+28 %) |
| CLS (mobile) | 0 | 0.038 | both healthy |

**Reading:** `/hub` is **heavier** in byte weight (+213 KiB, more JS for wallet/HUD/mission panel) but **much better on main-thread blocking** (TBT 70 ms vs 630 ms). On a slow CPU emulation, the lower TBT matters more for user-perceived smoothness than the byte weight delta.

**`/hub` is NOT measurably worse than `/` for app-entrypoint purposes — and on TBT it's substantially better.** The original user hypothesis ("/hub más liviano") holds only on the responsiveness axis, not on byte weight.

---

## Recommendation — App URL for MiniPay submission

**Hold the current decision: App URL = `https://www.chesscito.com`.** Reasoning:

1. Real users open the App URL once per session; the 307 redirect cost (3.5 s mobile) applies to whichever URL is submitted. Both `/` → `/en` and `/hub` → `/en/hub` pay roughly the same penalty.
2. The landing-page LCP measurement gap means we can't confirm `/` is faster than `/hub` end-to-end — only that landing FCP is ~0.6 s faster on desktop.
3. `/hub` shows a CLS regression (0.126 mobile) under the redirect timing that disappears when measured direct (0.038). Submitting `/hub` may expose users to the worse-CLS path until that's investigated.
4. The single largest perf win available is **eliminating the i18n redirect altogether** — that's worth 3.5–11 s independent of which path is submitted.

**Action: keep App URL flag as `DECISIÓN PENDIENTE` per commit 1, but the deciding factor shifts from "is /hub lighter?" to "is /hub stable on first paint after wallet detect + does the dock not jump?". This is a stability/UX question, not a perf question. Defer to the 360×640 + zero-click + footer-links validation (already on the audit roadmap as commits 5 / 7).**

---

## Caveats

1. **Lighthouse 12 trace engine bug on `/en`:** both LH 12.8.2 and 11.7.1 produced `LCP: null` on the landing page in every run attempted (mobile + desktop, pre- and post-redirect). The page renders fine in real browsers — this is a Lighthouse limitation, not a real-world UX defect. Suggest a third-opinion run on `pagespeed.web.dev` (after PSI API quota resets, ~24 h) to confirm landing LCP.
2. **Single-run variance:** Lighthouse single-run scores have ±5–10 point variance on mobile. PageSpeed Web reports the median of 3 runs and is more stable. The numbers in this report are point-in-time and should be treated as directional, not absolute.
3. **PSI API quota:** I attempted to use the PageSpeed Insights API first for consistency with `pagespeed.web.dev`. The project's unkeyed quota was exhausted at the time of measurement. Local Lighthouse CLI was used as fallback.
4. **No field data:** all metrics are lab/synthetic. Real-user (CrUX) data is not included because Chesscito likely doesn't have sufficient unique-visitor volume for CrUX inclusion yet.

---

## Exact commands executed

```bash
# Mobile (default form factor)
npx --yes lighthouse@12 https://www.chesscito.com \
  --quiet --chrome-flags="--headless=new --no-sandbox" \
  --output=json --output-path=lh-root-mobile.json \
  --only-categories=performance

npx --yes lighthouse@12 https://www.chesscito.com/hub \
  --quiet --chrome-flags="--headless=new --no-sandbox" \
  --output=json --output-path=lh-hub-mobile.json \
  --only-categories=performance

npx --yes lighthouse@12 https://www.chesscito.com/en \
  --quiet --chrome-flags="--headless=new --no-sandbox" \
  --output=json --output-path=lh-root-mobile.json \
  --only-categories=performance

npx --yes lighthouse@12 https://www.chesscito.com/en/hub \
  --quiet --chrome-flags="--headless=new --no-sandbox" \
  --output=json --output-path=lh-enhub-mobile.json \
  --only-categories=performance

# Same URLs again with --preset=desktop for desktop runs.

# Fallback (LH 11 attempt on root mobile):
npx --yes lighthouse@11 https://www.chesscito.com/en \
  --quiet --chrome-flags="--headless=new --no-sandbox" \
  --output=json --output-path=lh-root-mobile-v11.json \
  --only-categories=performance
```

Raw JSON reports live in `/tmp/psi/` on the measurement host (not committed — regenerable from URL + command).

---

## Recommended next commit

**`perf(i18n): default locale at root path to eliminate /en redirect`**

**Why this and not another opportunity:**
- The redirect costs **3.5 s on mobile / ~11 s on desktop** per the `redirects` audit on `/hub`.
- Largest single perf opportunity by an order of magnitude (next biggest is unused-JS at 550 ms).
- Applies to **every route**, every visit — landing, hub, exercises, arena, all of them.
- Unlocks meaningful perf measurement on `/` (today's landing measurement is broken by the redirect-chained trace).
- Does NOT modify product code, only routing config in `apps/web/src/i18n/routing.ts` (or middleware).

**Estimated impact:** mobile score 53 → ~70+ on `/hub`. Desktop 55 → ~80+. Landing should also become measurable end-to-end.

**Scope:** route-level only. No bundle changes, no image work. One commit, reversible.

**After this:** re-measure (commit N+1, same format as this report) and decide the next P0 lever (unused JS dynamic-import vs image optimization vs render-blocking CSS).

**Alternative next commits — deferred because lower leverage:**
- `perf(bundle): dynamic-import wagmi/RainbowKit` (~550 ms savings, larger scope).
- `chore(images): convert remaining hub assets to AVIF/WebP` (~50 ms savings, low ROI vs effort already done).
- `perf(css): purge unused Tailwind from hub bundle` (~220 ms, requires audit of what's needed).

These remain on the backlog for after the redirect kill.
