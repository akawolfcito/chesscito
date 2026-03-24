# MiniPay Store Submission — Design Spec

**Date:** 2026-03-23
**Status:** Approved
**Author:** Wolfcito (@akawolfcito)

## Overview

Prepare Chesscito for submission to the MiniPay Store. This spec covers all requirements from [MiniPay submission docs](https://docs.minipay.xyz/getting-started/submit-your-miniapp.md): legal pages, support channel, ownership clarity, app identity, security hardening, PWA manifest, and the final submission document.

**Form fields verified against:** MiniPay submission documentation as of 2026-03-23. Before filling the Google Form (Step 4.3), re-verify that the form fields match this spec — the form may have changed since this spec was written.

## Canonical Copy

Two distinct strings used across this spec:

- **Tagline** (user-facing, submission form, manifest, OG tags): `"Learn chess piece movements with gamified on-chain challenges on Celo."`
- **Package description** (technical metadata, package.json): `"MiniPay MiniApp for playful cognitive enrichment through pre-chess challenges"`

Both are intentional. The tagline is the public-facing description; the package description is internal metadata.

## Current State

**Already met:**
- Wallet auto-connection (detects MiniPay, connects automatically via injected provider)
- HTTPS (Vercel/Next.js)
- Mobile-optimized (390px mobile-first)
- Celo Mainnet contracts deployed and verified on Celoscan
- Good performance baseline (image compression, React Query tuning)
- Editorial copy centralized in `editorial.ts`

**Missing (this spec):**
- Terms of Service, Privacy Policy, Support pages
- In-app ownership/publisher clarity
- 512x512 icon
- Network manifest (exact hosts)
- PageSpeed Insights artifact
- Security headers
- PWA manifest
- Submission document with all required form fields

---

## Section 1: Legal, Support & Ownership

### Objective

Cover these fronts explicitly and product-ready within the app:
- Terms of Service
- Privacy Policy
- Support URL visible in-app
- Clear operator/publisher identity
- Real accessibility of these resources from within the MiniApp

### Routes

| Route | File | Purpose |
|-------|------|---------|
| `/terms` | `apps/web/src/app/terms/page.tsx` | Terms of Service |
| `/privacy` | `apps/web/src/app/privacy/page.tsx` | Privacy Policy |
| `/support` | `apps/web/src/app/support/page.tsx` | Support channel + instructions |
| `/about` | `apps/web/src/app/about/page.tsx` | Ownership hub + links to all above |

### Navigation

**Dock stays unchanged:** Badge | Shop | Free Play | Leaderboard | Invite

**Access to About hub:** A `...` (More) icon as a **header action** in the HUD bar (Zone 1, top-right corner, next to the "Lv" badge). Always visible, non-invasive, consistent with mobile "more options" pattern.

**Scope of the `...` icon:**
- Visible on the **play-hub** screen (main game screen where the HUD bar lives)
- NOT added to `/arena`, `/leaderboard`, or other screens — those have their own navigation patterns
- The `/about`, `/terms`, `/privacy`, and `/support` pages are standalone routes accessible via direct URL; they don't need the `...` icon themselves

**Back navigation from legal/about pages:**
- Each page has a `<-` back button in a minimal header
- Back navigates to the previous page in browser history (not hardcoded to a specific route)
- This allows correct behavior whether the user came from play-hub, about, or a direct link

### 1.1 Terms of Service (`/terms`)

Content specific to Chesscito (not generic):

- **Service description:** Chesscito is an educational pre-chess game experience on the Celo blockchain, accessible via MiniPay.
- **Eligibility:** Users must have a compatible wallet (MiniPay or injected provider). Age eligibility per applicable jurisdiction.
- **Wallet responsibility:** Users are solely responsible for the security of their wallet, private keys, and seed phrases. Chesscito never requests or stores these.
- **On-chain transactions:** Certain actions (badge claims, score submissions, shop purchases, NFT mints) interact with smart contracts on Celo. These transactions are irreversible once confirmed.
- **Digital assets:** NFTs, badges, and shop items have no guaranteed value, liquidity, or appreciation. They are game collectibles, not financial instruments.
- **Third-party dependencies:** Some features depend on third-party infrastructure, wallets, and blockchain networks that may be unavailable, delayed, or behave unexpectedly.
- **Service changes:** Chesscito may modify, pause, or discontinue features at any time without prior notice.
- **Limitation of liability:** The service is provided "as is". Chesscito and its operator are not liable for losses arising from blockchain transactions, wallet issues, or service interruptions.
- **Last updated:** Date stamp (e.g., "March 2026")

### 1.2 Privacy Policy (`/privacy`)

Content specific to Chesscito:

- **Data we handle:**
  - Public wallet address (provided by your wallet)
  - On-chain interaction data (scores, badges, purchases — publicly visible on Celo)
  - Local app state (tutorial progress, shield count, preferences)
- **Data we do NOT collect:**
  - Passwords, seed phrases, government ID
  - Personal identifiable information (PII)
  - Analytics/tracking cookies
- **Local storage purpose:** Tutorial state, gameplay preferences, retry shields, and UX settings are stored on your device for UX purposes. On-chain actions and related blockchain data are public by nature and may be transmitted through wallet and network infrastructure required to operate the app.
- **Third-party infrastructure:**
  - Celo RPC providers (for blockchain reads/writes)
  - WalletConnect (wallet connection protocol)
  - No analytics vendors, no ad networks
- **Data purpose:** Solely to operate the game: validate moves, record scores, process purchases, and mint collectibles.
- **Data retention:** On-chain data is permanent by nature of blockchain. Local data can be cleared by the user at any time.
- **Contact:** Link to `/support` for privacy-related questions.
- **Last updated:** Date stamp

### 1.3 Support (`/support`)

- **Primary support:** `${NEXT_PUBLIC_SUPPORT_EMAIL}`
- **Secondary / technical issues:** [GitHub Issues](https://github.com/akawolfcito/chesscito/issues) (`TODO: verify exact repo URL before merge`)
- **How to report:** Describe the issue, include screenshots if possible, mention your device/browser.
- **What you can report:** Loading problems, transaction errors, UI bugs, gameplay questions, feature requests.
- **Response time:** "We aim to respond within 48 hours"

### 1.4 About (`/about`)

- Logo (wolf favicon art) + "Chesscito" title
- **Operated by** Wolfcito
- Handle: @akawolfcito
- Version (from editorial.ts or package.json)
- Links (44px touch targets):
  - Support
  - Privacy Policy
  - Terms of Service
  - Invite / Share (duplicated, not moved from dock)

### 1.5 Copy Management

All content centralized in `editorial.ts`:
- `LEGAL_COPY.terms` — object with sections
- `LEGAL_COPY.privacy` — object with sections
- `SUPPORT_COPY` — channel, instructions, issue types
- `ABOUT_COPY` — publisher, version, app name

Each page renders from these constants. "Last updated" as editable field in each object.

### 1.6 UX Notes

- Page components are **server components** (no `"use client"` at the page level). Interactive elements like the back button may use client components imported into the page.
- Back navigation: `<-` button in header that navigates to previous page in browser history
- Touch targets: all links min 44px
- Dark background consistent with design system
- Legible body text (not fantasy-title) over dark background
- Mobile-first, `max-w-[var(--app-max-width)]` (390px)
- Does not break the main game flow

### 1.7 Acceptance Criteria

1. All 4 routes respond and render correctly
2. Content is specific to Chesscito (not generic boilerplate)
3. `...` icon visible in play-hub HUD bar, navigates to `/about`
4. `/about` links to `/support`, `/privacy`, `/terms`
5. Back button on each page navigates to previous browser history entry
6. "Last updated" visible in Terms and Privacy
7. All copy lives in `editorial.ts`
8. Mobile-first, legible, 390px max-width
9. Does not break the main game flow
10. All URLs open correctly on mobile, no login required, no 404, no broken redirects

### 1.8 Risks

- **Legal validity:** Content is reasonable but does not constitute legal advice. If formal compliance is needed later, review with a lawyer.
- **Language:** Copy in English (consistent with rest of UI). If MiniPay requires localization, add later.
- **Email as primary support:** If MiniPay prefers a more direct channel, pivot is quick.
- **Submission rejection:** Iterate based on reviewer feedback.

---

## Section 2: App Identity, Metadata & Submission Artifacts

### 2.1 Icon 512x512

- Generate `icon-512.png` from existing artwork (`favicon-wolf.png/webp`)
- Location: `apps/web/public/icon-512.png`
- **Keep existing `apps/web/src/app/icon.png` at 192x192** — it serves as the default favicon/app icon at standard resolution
- The 512x512 version is for MiniPay Store submission and the PWA manifest
- Both sizes are referenced in the manifest (Section 3.4) with their correct dimensions

### 2.2 Package.json Metadata

Add to `apps/web/package.json`:
```json
{
  "description": "MiniPay MiniApp for playful cognitive enrichment through pre-chess challenges",
  "author": "Wolfcito (@akawolfcito)"
}
```

No `license` field unless the repo is explicitly under a specific license. Not a MiniPay requirement.

### 2.3 Network Manifest

Document: `docs/network-manifest.md`

**Process:** Audit real code for all exact hosts (not wildcards). Inspect:
- fetch calls, RPC configs, script tags, CDN refs
- WalletConnect exact hosts (e.g., `relay.walletconnect.com`, `verify.walletconnect.com`)
- Whether Vercel Analytics/Insights is active
- Any other external origins

**Document format:**

| Host | Protocol | Purpose | CSP Directive |
|------|----------|---------|---------------|
| `forno.celo.org` | HTTPS | Celo RPC (default provider) | `connect-src` |
| `relay.walletconnect.com` | WSS | WalletConnect relay | `connect-src` |
| ... | ... | ... | ... |

Include audit date and method (manual code inspection) in the document header.

### 2.4 PageSpeed Insights Artifact

- Run PageSpeed Insights on `https://chesscito.vercel.app` with **mobile profile**
- Document: score, measurement date, device profile, confirmation it's production (not preview)
- If score is low, identify quick wins before submission
- Save to `docs/pagespeed-report-YYYY-MM-DD.md`

### 2.5 Acceptance Criteria

1. `icon-512.png` (512x512) exists in `apps/web/public/` and is high quality
2. Existing `icon.png` (192x192) remains unchanged
3. `package.json` has `description` and `author` fields
4. Network manifest based on real audit (not estimated), with Host/Protocol/Purpose/CSP columns
5. PageSpeed measured on production, not preview
6. All verified contract links are correct on Celoscan

---

## Section 3: Security Headers, PWA Manifest & Staged CSP Strategy

### 3.1 Security Headers

Add `async headers()` in `next.config.js`, applied to all routes (`source: '/(.*)'`):

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `X-DNS-Prefetch-Control` | `on` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Frame-Options` | `SAMEORIGIN` |

### 3.2 X-Frame-Options Decision

**Decision: `SAMEORIGIN`** (not `DENY`).

**Reason:** MiniPay is a WebView that loads MiniApps. Although the current pattern appears to be direct navigation (not iframe), we cannot confirm MiniPay never uses framing in any flow (deep links, transitions, previews). `SAMEORIGIN` allows same-origin framing without exposing to external clickjacking.

**Validation point:** During MiniPay WebView testing, manually verify the app loads without issues. If confirmed MiniPay uses no framing at all, harden to `DENY` in a follow-up PR.

**Fallback:** If `SAMEORIGIN` blocks MiniPay, remove `X-Frame-Options` temporarily and document the reason, rather than assuming a different policy immediately.

**Note:** `X-Frame-Options` is deprecated in modern browsers in favor of CSP `frame-ancestors`. When CSP is implemented in Phase 1-2, migrate from `X-Frame-Options: SAMEORIGIN` to `Content-Security-Policy: frame-ancestors 'self'` and remove the legacy header.

### 3.3 CSP Strategy — Phased Approach

**Phase 0 (this PR): No CSP.**

This PR does not send `Content-Security-Policy` nor `Content-Security-Policy-Report-Only`. A CSP without real reporting infrastructure would be security theater.

**Phase 1 (next iteration): Origin inventory + CSP Report-Only**

1. Complete network manifest audit (Section 2.3) — produces real inventory of `connect-src`, `script-src`, `img-src`, etc.
2. Implement `/api/csp-report` endpoint to log violations (or use external service)
3. Deploy `Content-Security-Policy-Report-Only` based on real inventory
4. Monitor violations for ~1 week in production + manual testing in MiniPay WebView
5. Document differences between normal browser and MiniPay WebView
6. Migrate `X-Frame-Options` to CSP `frame-ancestors 'self'`

**Phase 2 (later): CSP enforcement**

Only after:
- Inventory verified in runtime
- Report-Only with no legitimate violations for >= 1 week
- Testing confirmed in MiniPay WebView
- Minimal, precise allowlist based on evidence

### 3.4 PWA Manifest

**File:** `apps/web/src/app/manifest.ts` (App Router convention)

```typescript
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Chesscito',
    short_name: 'Chesscito',
    description: 'Learn chess piece movements with gamified on-chain challenges on Celo.',
    start_url: '/',
    id: '/',
    display: 'standalone',
    background_color: '#0b1220',
    theme_color: '#0b1220',
    icons: [
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon.png', sizes: '192x192', type: 'image/png' },
    ],
  }
}
```

Next.js App Router serves `/manifest.webmanifest` automatically from this file. No changes needed in `layout.tsx`.

### 3.5 Acceptance Criteria

1. Headers present in all responses (verifiable with `curl -I`)
2. `X-Frame-Options: SAMEORIGIN` does not break loading in MiniPay WebView
3. `Strict-Transport-Security` active
4. No CSP enforcement nor Report-Only in this PR
5. `manifest.webmanifest` accessible and valid (verifiable with Lighthouse)
6. Manifest uses colors consistent with existing `viewport.themeColor` (`#0b1220`)
7. App continues working: wallet connect, RPC calls, transactions, assets

### 3.6 Risks

| Risk | Mitigation |
|------|-----------|
| `SAMEORIGIN` blocks MiniPay | Manual test in MiniPay WebView pre-merge. Fallback: remove `X-Frame-Options` temporarily and document reason |
| `HSTS` causes issues in local dev | Only applies on HTTPS; localhost HTTP unaffected |
| `Permissions-Policy` blocks unexpected feature | Only disables camera/mic/geo which Chesscito doesn't use. Adjust if future feature needs them |
| Manifest interferes with MiniPay | MiniPay doesn't consume manifest; only affects "Add to Home Screen" in normal browser |

### 3.7 MiniPay WebView Testing Notes

- **Preview (safety testing):** Deploy to Vercel preview branch and open in MiniPay testnet. Verify: app loads, wallet auto-connects, transactions work, assets render.
- **Production (final submission validation):** After merge and deploy, re-verify the same checks on the production URL before filling the submission form.
- **If something fails:** First suspect is `X-Frame-Options`. Remove and re-test.
- **Document:** Test results in PR description.

---

## Section 4: Submission Document

### 4.1 Document: `docs/minipay-submission.md`

**Required Submission Fields:**

| Field | Value |
|-------|-------|
| App name | Chesscito |
| Tagline | Learn chess piece movements with gamified on-chain challenges on Celo. |
| Publisher | Wolfcito |
| Public handle | @akawolfcito |
| Support URL | `https://chesscito.vercel.app/support` |
| Terms of Service | `https://chesscito.vercel.app/terms` |
| Privacy Policy | `https://chesscito.vercel.app/privacy` |
| Category | education |
| App URL (linkUrl) | `https://chesscito.vercel.app` |
| Icon | `apps/web/public/icon-512.png` — 512x512 PNG ready for upload |

**Supporting Artifacts:**

- Network manifest: `docs/network-manifest.md`
- PageSpeed report: `docs/pagespeed-report-YYYY-MM-DD.md` (mobile profile, production URL)
- Verified contracts on Celoscan (Badges, Scoreboard, Shop, VictoryNFT)
- Sample transactions: one tx link per user-facing contract method (claimBadge, submitScore, buyItem, mintVictory)

### 4.2 Acceptance Criteria

1. Document complete with all required submission fields, no blanks
2. All URLs point to real, functional pages in production
3. Icon 512x512 exists and is high quality
4. Network manifest based on real audit
5. PageSpeed measured on production, not preview
6. Contract links verifiable on Celoscan
7. All URLs open correctly on mobile, no login required, no 404, no broken redirects

### 4.3 Submission Flow

1. Implement Sections 1-3 -> deploy to production
2. Run PageSpeed on production
3. **Verify Google Form fields match this spec** — the form may have changed since this spec was written
4. Complete `docs/minipay-submission.md` with final data
5. Fill Google Form with values from the document
6. Attach icon 512x512
7. Submit

---

## Out of Scope

- CSP enforcement (Phase 1-2, separate spec)
- Localization / multi-language support
- Custom domain (staying on `chesscito.vercel.app` for now)
- Moving Invite out of dock
- Desktop optimization
