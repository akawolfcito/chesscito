# Runbook — Post-Deploy Verification of i18n Redirect Removal

**Subject commit:** `51a553e2` — `perf(i18n): serve default locale from root paths`
**Created:** 2026-06-02 (after commit shipped locally, before promote to production)
**Reason:** validate that the `localePrefix: "as-needed"` switch actually eliminated the 307 redirects observed in `docs/pagespeed-report-2026-06-02.md` (3.5 s mobile / ~11 s desktop savings expected). Run ONLY after the commit lands in production.

---

## 0. Pre-flight — confirm commit is in production

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito
git fetch origin --quiet
git log origin/production -1 --oneline
git branch -r --contains 51a553e2
```

**Expected:**
- `git log origin/production -1` shows `51a553e2` or a later commit that includes it.
- `git branch -r --contains 51a553e2` includes `origin/production`.

If either fails, **STOP**. Do not run §1 or §2; results would represent the previous behaviour, not the fix.

Optional sanity ping (no Lighthouse cost, runs in ~1 s):

```bash
/usr/bin/curl -sI -o /dev/null -w "HTTP %{http_code} | redirect: %{redirect_url}\n" https://www.chesscito.com/hub
```

If this prints `HTTP 200 | redirect:` (no redirect target), the commit is live. If it prints `HTTP 307 | redirect: https://www.chesscito.com/en/hub`, the commit has not deployed yet.

---

## 1. Status / redirect verification (cheap, ~10 s)

Run this matrix and compare against the expected column. Every row that doesn't match is a regression.

```bash
BASE="https://www.chesscito.com"
for path in "" "/hub" "/support" "/terms" "/privacy" "/about" "/why" "/exercises" "/arena" "/trophies" "/en" "/en/hub" "/es" "/es/hub"; do
  printf "%-25s → " "${path:-/}"
  /usr/bin/curl -sI -o /dev/null -w "HTTP %{http_code} | redirect: %{redirect_url}\n" "$BASE$path"
done
```

### Expected matrix

| Path | Pre-`51a553e2` (today) | Post-`51a553e2` expected | Status meaning |
|---|---|---|---|
| `/` | 307 → `/en` | **200** | EN locale serves at root |
| `/hub` | 307 → `/en/hub` | **200** | EN canonical |
| `/support` | 307 → `/en/support` | **200** | EN canonical |
| `/terms` | 307 → `/en/terms` | **200** | EN canonical |
| `/privacy` | 307 → `/en/privacy` | **200** | EN canonical |
| `/about` | 307 → `/en/about` | **200** | EN canonical |
| `/why` | 307 → `/en/why` | **200** | EN canonical |
| `/exercises` | 307 → `/en/exercises` | **200** | EN canonical |
| `/arena` | 307 → `/en/arena` | **200** | EN canonical |
| `/trophies` | 307 → `/en/trophies` | **200** | EN canonical |
| `/en` | 200 | **307 → `/`** | next-intl canonicalizes legacy |
| `/en/hub` | 200 | **307 → `/hub`** | back-compat preserved with 1 hop |
| `/es` | 307 → `/en` | **307 → `/`** | ES_READY=false explicit handler now bare-targets |
| `/es/hub` | 307 → `/en/hub` | **307 → `/hub`** | one-hop instead of two |

### Hard failures (block re-measurement, open incident)

- Any P0 row (`/`, `/hub`, `/support`, `/terms`, `/privacy`) returning a 3xx or 4xx after deploy.
- `/en` returning 200 (canonicalization broken; would mean default locale double-served).
- Any row returning 5xx.

### Soft notes (interesting but not blocking)

- `/en/hub` rendering 200 instead of 307 → bookmarks still work; performance slightly worse than expected but acceptable.
- `/es*` returning 200 → would mean `ES_READY=1` flipped accidentally; check Vercel env vars.

### Sitemap sanity

```bash
/usr/bin/curl -s "$BASE/sitemap.xml" | head -60
```

Expect EN URLs at root (`<loc>https://www.chesscito.com/hub</loc>`) and ES URLs under `/es` (`<loc>https://www.chesscito.com/es/hub</loc>`). No `https://www.chesscito.com/en/...` URLs.

---

## 2. Lighthouse re-measurement (slow, ~3-5 min)

Run only after §1 passes. Uses the same tooling as `docs/pagespeed-report-2026-06-02.md` for direct comparability.

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

# Sanity: legacy /en/hub still resolves with one-hop 307
npx --yes lighthouse@12 https://www.chesscito.com/en/hub \
  --quiet --chrome-flags="--headless=new --no-sandbox" \
  --output=json --output-path=lh-enhub-mobile.json \
  --only-categories=performance
```

### Metric extraction

```bash
cd /tmp/psi-after
for f in lh-root-mobile lh-hub-mobile lh-root-desktop lh-hub-desktop; do
  echo "=== $f ==="
  jq -r '
    "perf_score: " + ((.categories.performance.score // null) | if . == null then "null" else (.*100 | tostring) end),
    "FCP: " + (.audits["first-contentful-paint"].displayValue // "null"),
    "LCP: " + (.audits["largest-contentful-paint"].displayValue // "null"),
    "TBT: " + (.audits["total-blocking-time"].displayValue // "null"),
    "CLS: " + (.audits["cumulative-layout-shift"].displayValue // "null"),
    "SI: " + (.audits["speed-index"].displayValue // "null"),
    "TTI: " + (.audits["interactive"].displayValue // "null"),
    "redirects_cost: " + ((.audits.redirects.details.overallSavingsMs // 0) | tostring) + "ms",
    "byte_weight: " + (.audits["total-byte-weight"].displayValue // "null"),
    "final_url: " + .finalUrl
  ' "$f.json"
  echo ""
done
```

### Expected deltas vs `docs/pagespeed-report-2026-06-02.md`

| Metric | Pre (2026-06-02) | Post expected | Tolerance |
|---|---|---|---|
| `/hub` mobile perf | 53 | **65–75** | ±10 single-run variance |
| `/hub` desktop perf | 55 | **75–85** | ±10 single-run variance |
| `/hub` mobile LCP | 9.1 s | **6.5–7.5 s** | bigger drop = better |
| `/hub` desktop FCP | 11.4 s | **1.5–2.5 s** | the desktop FCP outlier should normalize |
| `/hub` mobile `redirects` audit savings | 3553 ms | **0 ms** | hard expectation |
| `/hub` desktop `redirects` audit savings | 10935 ms | **0 ms** | hard expectation |
| `/hub` mobile CLS | 0.126 ⚠️ | **<0.05** | redirect-induced CLS should vanish |
| `/` mobile perf | null (LCP undetectable) | possibly **measurable** | landing without redirect chain may finally yield a perf score; if still null, document the standing LH trace bug |

### Caveats reminder

- Lighthouse single-run variance is ±5–10 perf points. Re-run if a number looks off.
- If `/` still produces `null` LCP, that's the trace_engine bug from §1.1 of the prior report, not a regression. Try `pagespeed.web.dev` for a second opinion once PSI API quota resets (~24 h).
- INP remains field-only; not measured here.

---

## 3. Closing — write the post-deploy report

If §1 and §2 pass:

1. Write `docs/pagespeed-report-2026-06-<deploy-date>.md` mirroring the structure of `docs/pagespeed-report-2026-06-02.md`:
   - Header (date, commit shipped, comparison anchor).
   - Per-URL detail tables.
   - Delta table vs prior report.
   - Caveats.
   - Exact commands executed (copy from §2 above).
2. Commit it with: `chore(perf): post-deploy PageSpeed re-measurement vs commit 51a553e2`.
3. Update the App URL flag in `docs/minipay-submission.md`:
   - If `/hub` perf is now within 5 points of `/`, the `⚠️ DECISIÓN PENDIENTE` flag closes in favor of keeping `https://www.chesscito.com` (per current user decision).
   - If `/hub` perf is materially better, re-open the discussion of moving the submission App URL to `/hub`.

---

## 4. Sign-off block (paste into the post-deploy report)

```
Runbook executed: 2026-06-??
Production tip:   <git short hash from origin/production>
Commit verified:  51a553e2 present in origin/production: YES / NO

§1 status matrix:  ALL PASS / DEVIATIONS LISTED BELOW
§2 perf delta:     ON TARGET / BELOW TARGET / N/A (single-run variance)
Decision:          LANDING APP URL CONFIRMED / RE-OPEN /hub DECISION
Next action:       __________
```

---

## 5. Rollback decision

If §1 shows hard failures (any P0 path returning 3xx/4xx) AND the cause is the i18n switch (not unrelated infra):

```bash
git revert 51a553e2
git push origin main
# Promote to production via standard release flow (docs/release/release-process.md).
```

The revert restores `localePrefix: "always"`, BASE_URL apex, and the sitemap/layout `alternates` to the prior shape. Zero data risk, zero schema risk. Bookmarks created against bare paths in the interim continue to work (middleware will redirect them to `/en/<path>`).

---

## Appendix A — repo state at runbook authoring time

> Errata note: the original wording of this appendix described the local state
> as "diverged from origin/main" and proposed "reconcile (rebase or merge)".
> That framing was wrong. A subsequent read-only integration audit
> (`docs/reviews/2026-06-03-integration-audit-labyrinth-vs-minipay.md`)
> confirmed local `main` is linear on top of `origin/main`: 3 ahead, 0 behind.
> Labyrinth Phase D.1 sits underneath the MiniPay readiness commits and is
> preserved intact. This appendix is the corrected version.

State at runbook authoring time:

- Local `main`: `51a553e2` (the subject commit) → `acc90b41` → `f412cbe5` stacked
  on top of `81a8f2df` (origin/main tip).
- `origin/main`: `81a8f2df` — Labyrinth Phase D.1 cluster (5 commits over the
  earlier `77eba35a`). **Fully contained in the local `main` history.**
- `origin/production`: `5bcdd5ac` (M1 + v0.6 narrative cluster).

Path to ship `51a553e2`:

1. **Fast-forward push** is sufficient: `git push origin main` advances
   `origin/main` from `81a8f2df` to `51a553e2`. No rebase, no merge, no force
   push. Labyrinth Phase D.1 commits remain in place underneath the MiniPay
   readiness commits.
2. The advanced `main` must be promoted to `production` via the standard
   release flow (`docs/release/release-process.md`). Production promote is a
   separate decision and is NOT triggered by the main-branch push above.

Until step 2, the production URL stays on `5bcdd5ac` and §1/§2 of this
runbook will return the pre-commit numbers, not the fix.

---

## Appendix B — references

- Subject commit: `51a553e2`
- Prior report: `docs/pagespeed-report-2026-06-02.md`
- Audit driving the change: `docs/reviews/2026-06-02-i18n-redirect-audit.md`
- Release flow: `docs/release/release-process.md`
