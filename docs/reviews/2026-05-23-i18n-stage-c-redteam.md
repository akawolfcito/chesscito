# Red-team — i18n Stage C migration plan

- **Date**: 2026-05-23
- **Reviewer**: adversarial pass before kickoff
- **Subject**: Plan to migrate 125 components from `editorial.ts` → `useTranslations()` (Stage C of `docs/superpowers/specs/2026-05-23-i18n-es-en-design.md`), gated by feature flag, surface-by-surface
- **Verdict**: plan is **functionally sound** but **6 gaps** must be closed before kickoff. Severity-tagged below.

---

## Findings

### 🔴 CRITICAL — must fix before kickoff

#### C-1. `/play-hub` rewrite breaks under locale prefix
- **Where**: `apps/web/next.config.js:18` rewrites `/play-hub` → `/exercises`. After Stage 1, every page lives at `/{locale}/...`, but the rewrite source is literal `/play-hub` only.
- **Fingerprint**: `/en/play-hub` (legacy bookmark + dock link) → 404. `/play-hub` → rewrite → `/exercises` → middleware → `/en/exercises` (works for naked).
- **Fix**: change rewrite to `{ source: '/:locale/play-hub', destination: '/:locale/exercises' }` AND keep the legacy `/play-hub` → `/exercises` for naked URLs. Verify in dev with `curl -I /en/play-hub`.
- **Cost**: 5 min.

#### C-2. Feature flag policy — `/es` must redirect to `/en`, not 404
- **Where**: my plan said "gate /es with `NEXT_PUBLIC_I18N_ES_READY`" but didn't specify behavior when flag is OFF.
- **Risk**: 404 punishes users who explicitly typed `chesscito.com/es` (e.g., curious LATAM testers). Better UX: serve EN under /en URL with a banner offering opt-in.
- **Fix**: in `middleware.ts`, when flag is OFF and locale = `es`, 307-redirect to `/en` + log event. When flag is ON, normal next-intl middleware runs. Document in code comment why.
- **Cost**: 15 min.

#### C-3. `LegalPageShell` is shared infra, not surface — pilot ordering wrong
- **Where**: my plan said "C-pilot = legal pages (`/about`, `/support`, `/privacy`, `/terms`)". But all 4 use `<LegalPageShell>` (a component in `components/legal-page-shell.tsx`) which itself imports from editorial.ts (verify with grep).
- **Risk**: migrating the page wrappers without migrating the shell → shell still reads from editorial → pilot doesn't actually validate the pattern.
- **Fix**: pilot must include `LegalPageShell` (and any other shared infra it depends on). Re-check by grepping the import chain before committing.
- **Cost**: included in pilot commit.

---

### 🟠 HIGH — must fix before user-visible ES

#### H-1. WalletProvider remount on locale switch
- **Where**: `apps/web/src/app/[locale]/layout.tsx` wraps `<WalletProvider>` INSIDE the [locale] segment. When user toggles language via Stage 5 in-app switcher, the URL changes from `/en/*` to `/es/*` → entire [locale] subtree remounts → wallet provider re-initializes → user must reconnect.
- **Risk**: terrible UX. A connected wallet vanishing on language change kills trust.
- **Fix options**:
  - (a) Keep root `app/layout.tsx` with `<html><body><WalletProvider>{children}</WalletProvider></body></html>` (minimal, locale-agnostic), and `[locale]/layout.tsx` only wraps `NextIntlClientProvider` + sets `<html lang>` via a client effect. But `<html>` belongs in root layout; can't be split.
  - (b) Use `localePrefix: 'as-needed'` so the default locale has no prefix → switching to ES is a redirect but back to default-locale is in-place. Asymmetric, hurts LATAM-first framing.
  - (c) Accept the remount, document it, and design the toggle as a "Switch language (will reload)" affordance. Many production apps do this.
- **Recommendation**: (c) for v1 + escalate to (a) if testers complain. Document explicitly in the toggle component.
- **Cost**: 0 today (design choice), Stage 5.

#### H-2. Existing share URLs in the wild may break
- **Where**: per MEMORY.md, IG/TikTok share URLs use `www.chesscito.com`; OG share routes are at `/share/{daily,badge,endgame,score}/[id]`. After Stage 1 move, those URLs live under `/{locale}/share/...`. Middleware 307-redirects naked to /en. So `chesscito.com/share/badge/abc` → 307 → `/en/share/badge/abc`. Works.
- **Risk**: any baked URL in OG card metadata, signed share manifests, or backend `enforceOrigin` allowlists. Per MEMORY.md, `enforceOrigin` allowlists `NEXT_PUBLIC_APP_URL` / `VERCEL_*_URL` — those are origins, not paths, so unaffected.
- **Fix**: smoke-test one shared URL from each surface (badge, daily, endgame, score) on `chesscito.com` after Stage 1 deploys. If any breaks (e.g., the share page hardcodes `/share/...` in its own copy/QR), patch.
- **Cost**: 20 min smoke testing post-deploy.

#### H-3. VR baselines stale after Stage 1 structural move
- **Where**: per HARD RULE — VR baseline discipline, when touching UI, run `pnpm test:e2e:visual` before push. I deferred this on the Stage 1 commits ("the move is structural, no render change"). True, but Playwright specs may assert on URLs.
- **Fingerprint**: specs that call `await page.goto('/arena')` — middleware redirects to `/en/arena`. Snapshot of `page` content stays same, but `expect(page.url()).toBe(...)` would fail.
- **Fix**: grep `e2e/` for `page.url()` and `toBe.*localhost` patterns. If any assert exact paths without prefix, update or run baselines fresh. Add `deferred-work.md` entry if not done in same PR.
- **Cost**: 30 min.

#### H-4. Coach prompts in EN bleed into /es UI
- **Where**: `/api/coach/*` routes return EN strings (the LLM is prompted in EN). Stage 4 ships ES translations of editorial.ts, but coach responses still come back EN.
- **Risk**: a tester on `/es` finishes a game, requests Coach, sees Spanish UI labels but English game analysis. Mixed-language UX.
- **Fix**: spec Cluster E E3 already addresses this — pass `locale` to coach API + prepend "Respond in Spanish." to system prompt. **Move this from Cluster E to part of Stage 4** so ES launch is internally coherent.
- **Cost**: included in Stage 4 estimate.

---

### 🟡 MEDIUM — should fix during Stage C or before ES launch

#### M-1. Date / number formatting not in scope
- **Where**: spec §6.2 considers `Intl.NumberFormat` but doesn't commit. Components that call `.toLocaleDateString()` use system locale, not app locale. ES user with EN system → dates in English.
- **Fix**: add a `useLocale()` consumer for the few date displays (game timestamps, badge claim dates). Grep for `toLocaleDateString` and `toLocaleString`. Probably <10 sites.
- **Cost**: include in Stage 4.

#### M-2. SEO — sitemap.xml + hreflang absent
- **Where**: no `sitemap.ts` in app/. After Stage 1, Google indexes `/en/*` and `/es/*` separately; without hreflang, duplicate-content risk.
- **Fix**: generate `apps/web/src/app/sitemap.ts` emitting both locales + add `alternates` to per-page metadata. Cluster E.
- **Cost**: 1 hour.

#### M-3. Pluralization helpers stripped from bundle but still used
- **Where**: my `messages/en.ts` `stripFunctions` filter dropped `(n) => \`${n} left\`` style helpers. Components still call `FOOTER_CTA_COPY.shieldsLeft(3)` via direct editorial import. After component migrates to `useTranslations`, that key won't exist in bundle.
- **Risk**: missing translation at runtime → next-intl falls back to key string. UI shows `FOOTER_CTA_COPY.shieldsLeft` literally.
- **Fix**: as each surface migrates, identify helper-style copy used in that surface and convert to ICU MessageFormat in messages/en.ts (e.g., `shieldsLeft: '{count, plural, one {# left} other {# left}}'`). Then component calls `t('shieldsLeft', { count: 3 })`.
- **Cost**: per surface, ~5 min for each helper.

#### M-4. Internal navigation hardcodes paths
- **Where**: `<Link href="/arena">` and `router.push("/hub")` everywhere. With `localePrefix: 'always'`, every internal click triggers middleware redirect → 1 extra HTTP roundtrip per nav.
- **Fix**: Stage 5 swaps to next-intl's `<Link>` + `useRouter` from `next-intl/navigation`. Until then, accept the redirect overhead.
- **Cost**: ~2 hours codemod in Stage 5.

#### M-5. PWA manifest stays EN
- **Where**: `app/manifest.ts` is locale-agnostic. ES user installs PWA → home-screen icon labeled "chesscito" (EN). Acceptable v1.
- **Fix**: defer to v2 (multiple manifests via `?locale=es` query won't work; PWA manifest is per-origin).

---

### 🟢 LOW — nice-to-have

#### L-1. Wagmi / WalletConnect / RainbowKit modals stay EN
- Out of scope. WalletConnect has its own i18n config; not pursued v1.

#### L-2. Contract revert messages stay EN
- Spec acknowledges. Acceptable.

#### L-3. Analytics events tagged with locale
- Spec Cluster E E4. Useful for measuring ES vs EN cohort behavior. Don't block on this.

---

## Plan coverage matrix

| Aspect | In spec | In session plan | Status |
|---|---|---|---|
| Detection via Accept-Language | yes | yes | ✓ (Stage 1 done) |
| Cookie stickiness | yes | yes | ✓ |
| `<html lang>` dynamic | yes | yes | ✓ (Stage 1 done) |
| Message bundle infra | yes | yes | ✓ (Stage 2 done) |
| Test wrapper for `useTranslations` | yes | yes (C-infra) | pending |
| Feature flag for /es | NO | yes | NEW, must add (C-2) |
| `/play-hub` rewrite update | NO | NO | NEW, must add (C-1) |
| `LegalPageShell` in pilot | NO | partial | NEW, must include (C-3) |
| WalletProvider stability | NO | NO | doc'd (H-1) |
| Share URL smoke after Stage 1 | NO | NO | post-deploy task (H-2) |
| VR baseline refresh | implicit | NO | gate before next push (H-3) |
| Coach prompts ES | Cluster E | yes (re-prioritize to Stage 4) | re-ordered (H-4) |
| Date/number i18n | partial | partial | Stage 4 (M-1) |
| Sitemap + hreflang | NO | NO | Stage 5 (M-2) |
| Pluralization → ICU | implicit | implicit | per surface (M-3) |
| Internal nav via next-intl Link | Cluster E | NO | Stage 5 (M-4) |
| PWA manifest | NO | NO | v2 (M-5) |

---

## Updated session plan (today)

After red-team, today's session expands from 3 → **4 commits**:

1. **`fix(i18n): update /play-hub rewrite for locale prefix`** — closes C-1.
2. **`feat(i18n): gate /es behind NEXT_PUBLIC_I18N_ES_READY flag`** — closes C-2. /es → /en until flag is on. Includes flag doc.
3. **`feat(test): renderWithIntl helper + provider wrapper`** — C-infra. Validates all existing tests still pass.
4. **`refactor(legal): migrate /about, /support, /privacy, /terms + LegalPageShell to useTranslations`** — C-pilot. Includes `LegalPageShell` per C-3. Includes ES translations for these 4 surfaces so `/es/about` literally renders Spanish when flag is ON.

After commit 4, set `NEXT_PUBLIC_I18N_ES_READY=1` locally → visit `/es/about` → see Spanish. Demo-able.

---

## Done definition for "advance without problems"

Per session, the contract is:

- [ ] No new TypeScript errors.
- [ ] All 1871 unit tests still pass (with `renderWithIntl` wrapper added where needed).
- [ ] VR baselines unchanged OR refreshed in same commit with rationale.
- [ ] Dev server boots; `/en/*` 200; `/es/*` 307 → `/en/*` (until flag) or 200 (with flag).
- [ ] No console error on hydration.
- [ ] Each commit is independently revertable.

If any of the above fails on a surface, that surface gets reverted, not patched in place.

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Spanglish on /es | high (without flag) | high | Feature flag (C-2) |
| Wallet drops on locale switch | medium | high | Document UX, plan re-architecture later (H-1) |
| Stale VR baselines | medium | medium | Run before push (H-3) |
| Hidden helper-style copy missed by codemod | medium | low | Per-surface review |
| Component migration breaks tests | low | medium | renderWithIntl wrapper |
| Production share links break | low | high | Post-deploy smoke (H-2) |
| Coach feedback English on /es | high (until E3) | medium | Re-prioritize to Stage 4 (H-4) |

---

## Verdict

**The plan is sound but incomplete.** With the 3 CRITICAL gaps closed (C-1, C-2, C-3) and 4 HIGH items doc'd as deferred work or moved into Stage 4 (H-1, H-2, H-3, H-4), the plan is ready to execute.

**Recommendation**: proceed with the updated 4-commit session plan above. Do NOT skip the feature flag (C-2) — it's the difference between a controlled rollout and exposing Spanglish to production users.
