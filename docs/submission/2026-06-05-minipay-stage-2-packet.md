# 2026-06-05 — MiniPay Stage 2 readiness packet

## Purpose

Single-source consolidation of the Stage 2 readiness checklist (post-call,
post-intake-form). It points at the authoritative answers in
`docs/submission/minipay-form-answers.md`, closes the legal-review TODO
that was outstanding since 2026-06-02, and adds three new evidence
artifacts (origin manifest, 360×640 smoke, LabyrinthBadges status note).

When MiniPay forwards the readiness form, **answer from this doc** — every
section maps 1:1 to a field they will ask about.

## State at packet close

- ✅ Intake form (Stage 1) submitted — confirmed by user 2026-06-05.
- ✅ Identity questions to the MiniPay/Celo group — drafted (Pattern A+C decision in `docs/design-patterns/minipay-identity-design.md`); user holds autonomy on send timing.
- ✅ This packet (Stage 2) ready to populate when MiniPay sends the form.
- ⏳ Screenshots ≥3 ≤500KB on real MiniPay Android — **out of scope** for this packet (manual capture).

## 1. Smart contract addresses + sample tx hashes

Authoritative: `docs/submission/minipay-form-answers.md` §"Celoscan links to contracts" + §"Sample transactions".

### 1.1 Production contracts (Celo Mainnet, chainId 42220)

| Contract | Proxy address | Celoscan |
|---|---|---|
| Badges | `0xf92759E5525763554515DD25E7650f72204a6739` | [verified ✅](https://celoscan.io/address/0xf92759E5525763554515DD25E7650f72204a6739#code) |
| Scoreboard | `0x1681aAA176d5f46e45789A8b18C8E990f663959a` | [verified ✅](https://celoscan.io/address/0x1681aAA176d5f46e45789A8b18C8E990f663959a#code) |
| Shop | `0x24846C772af7233ADfD98b9A96273120f3a1f74b` | [verified ✅](https://celoscan.io/address/0x24846C772af7233ADfD98b9A96273120f3a1f74b#code) |
| VictoryNFT | `0x0eE22F830a99e7a67079018670711C0F94Abeeb0` | [verified ✅](https://celoscan.io/address/0x0eE22F830a99e7a67079018670711C0F94Abeeb0#code) |

User confirmed mainnet contracts already verified on Celoscan — no
`hardhat verify` action required this session.

### 1.2 LabyrinthBadges status (note for reviewer)

LabyrinthBadges is **deployed on Celo Sepolia (testnet) since 2026-06-03**
and pending mainnet promotion in a separate scheduled cluster (memory
`labyrinth-v02-phase-d1`). The Sepolia proxy is
`0x8AA4006dfb3D5B7e255Df26B1065CD87A193171b`. The mainnet entry above
intentionally omits this contract until D.2 promote completes; no
production user-facing flow currently signs against it.

### 1.3 Sample transactions (mainnet)

| Method | Sample tx | Celoscan |
|---|---|---|
| `Shop.buyItem` (Founder Badge) | `0x42cd5c62…88cd7b` | [view](https://celoscan.io/tx/0x42cd5c622df686cbd369b84d74c5c46d2b29611ab4cecb80d8c03c362888cd7b) |
| `Shop.buyItem` (Streak Shield) | `0xbb501a34…8f6e62a0` | [view](https://celoscan.io/tx/0xbb501a34693ec49177f901e80ec72cef1d76f6f20cc40180f9136a598f6e62a0) |
| `Scoreboard.submitScoreSigned` | `0x910c41aa…2b90435a` | [view](https://celoscan.io/tx/0x910c41aa415178097a40504675aee37cce916a8dc355eba937a835152b90435a) |
| `VictoryNFT.mintSigned` | `0xb18a9441…a9c5c56d` | [view](https://celoscan.io/tx/0xb18a9441bcfbb7417b18c2813116f3425546637bb341d9e969508d68a9c5c56d) |
| `Badges.claimBadgeSigned` | `0x8be6052c…f0ec67` | [view](https://celoscan.io/tx/0x8be6052c7f833af83fd2d3d5c04d76406ce9f1fcbcdf82ff5007ce35daf0ec67) |

PRO subscription (`buyItem(6, …)`) reuses the Shop method; covered by the
two Shop samples above.

## 2. Origin manifest

Every external host the production app contacts. Derived from `next.config.js`
(no `images.remotePatterns`), `apps/web/src/` runtime fetches, and middleware.

### 2.1 First-party

| Origin | Role |
|---|---|
| `www.chesscito.com` | Canonical Next.js bundle + every `/api/*` route handler |
| `chesscito-<branch>-<hash>.vercel.app` | Vercel preview deploys (engineering only, never user-facing) |
| `chesscito.vercel.app` | Legacy URL (deprecated 2026-05-20, still resolves for back-compat) |

### 2.2 Third-party (runtime)

| Origin | Surface | Side |
|---|---|---|
| `va.vercel-scripts.com` | Vercel Analytics anonymous pageview tracker | Client |
| `forno.celo.org` | Default Celo RPC (read-only chain data, server-side from `apps/web/src/lib/server/sync-blockchain.ts`) | Server |
| `*.upstash.io` | Redis caching + rate-limit buckets (`@upstash/redis` + `@upstash/ratelimit`) | Server |
| `api.openai.com` (or OpenAI-compatible) | Coach LLM analysis (`/api/coach/analyze`); `COACH_LLM_BASE_URL` env switches provider | Server |
| `celoscan.io` / `sepolia.celoscan.io` | Outbound user-facing links only — never invoked programmatically | Client (`window.open`) |
| `github.com/wolfcito/chesscito` | Outbound support-ticket link from `/support` page | Client (anchor) |
| `t.me/chesscito_app` | Outbound Telegram support link | Client (anchor) |

### 2.3 What is NOT loaded

- No Google Fonts CDN (fonts shipped through `next/font` in the bundle).
- No Vercel Blob, no Supabase, no Firebase, no Auth0 — Chesscito does not host external user accounts.
- No WalletConnect / Reown relay — MiniPay zero-click is the only wallet path.
- No third-party JavaScript beyond Vercel Analytics.

## 3. Support channels (form-ready)

Authoritative: `docs/submission/minipay-form-answers.md` §"How do you plan to support the App users".

```text
Telegram:  @chesscito_app
Web:       https://www.chesscito.com/support
Tickets:   https://github.com/wolfcito/chesscito/issues
Email:     (mailto link on the support page; configured via NEXT_PUBLIC_SUPPORT_EMAIL)
SLA:       response within 48 hours
```

The `/support` page is reachable from every page footer; verified visible
in the 360×640 smoke (§5).

## 4. Terms / Privacy / Operator disclaimer

| Field | Value | Status |
|---|---|---|
| Terms URL | `https://www.chesscito.com/terms` | ✅ Live |
| Privacy URL | `https://www.chesscito.com/privacy` | ✅ Live |
| Operator disclaimer | "Independent product built and operated by Wolfcito (@akawolfcito), not operated by, affiliated with, or endorsed by Opera or MiniPay" | ✅ Live in `/about` + Terms §1 |
| Terms legal review TODO | "accessible via MiniPay" wording flagged by 2026-06-02 narrative audit (M3) | ✅ **CLOSED this session** — see §4.1 below |

### 4.1 Terms legal review — closed

The 2026-06-02 narrative audit (`docs/audits/2026-06-02-copy-narrative-audit.md`)
flagged one phrase in `TERMS_COPY.sections[1].body`:

- Before: "Chesscito is an educational pre-chess game experience on the Celo blockchain, **accessible via MiniPay**."
- After: "Chesscito is an educational pre-chess game experience on the Celo blockchain, **designed to be used with MiniPay-compatible wallets**."

Rationale: per the HARD RULE `minipay-listing-safety`, until official
listing approval the app must never claim availability "via MiniPay" or
"on MiniPay" (those phrases imply official distribution). The new phrasing
preserves the technical accuracy (the app is built for MiniPay-compatible
wallets) without implying a relationship that does not yet exist.

The change was applied to both `editorial.ts` (EN) and `messages/es.ts`
(ES mirror "diseñada para usarse con wallets compatibles con MiniPay") in
the same commit. i18n parity rule honored.

## 5. 360 × 640 smoke

Playwright smoke run against `minipay-360` project (Pixel 5 device,
viewport 360×640) on 7 high-traffic surfaces. Assertion: no horizontal
overflow (`document.scrollWidth ≤ clientWidth + 2px tolerance`).

| Surface | Result |
|---|---|
| `/` (landing) | ✅ PASS |
| `/hub` | ✅ PASS |
| `/exercises` | ✅ PASS |
| `/arena` | ✅ PASS |
| `/about` | ✅ PASS |
| `/support` | ✅ PASS |
| `/terms` | ✅ PASS |

7/7 PASS. Spec executed inline (not committed) since the assertion is a
one-time gate, not ongoing regression coverage. To re-run, drop the spec
back in `e2e/` and `pnpm exec playwright test --project=minipay-360`.

## 6. PageSpeed disclosure (existing position)

Mobile PSI for `/hub` lands at **79–83**, in the orange band (below the
official MiniPay recommendation of 90+ but above the red threshold of
49). Position unchanged since `docs/handoffs/2026-06-03-hub-perf-cluster-handoff.md`:

- Zero-click connect + UX surfaces are MiniPay-grade (P0-4 6/6 PASS).
- Remaining perf gap localized to HubDailyTile SSR — deferred to a
  dedicated cluster pending reviewer feedback.
- Submission acknowledges the gap and links the perf roadmap.

No code change this session — strategy is "submit with a note, escalate
on reviewer push-back". Mitigation roadmap lives in the perf handoff.

### 6.1 Update 2026-06-12 — official PSI re-run (perf cluster shipped)

Founder-run PageSpeed Insights (pagespeed.web.dev, Lighthouse 13.3.0,
Moto G Power emulation, Slow 4G) against `https://www.chesscito.com/hub`:

| Category | Score |
|---|---|
| **Performance** | **85** (was 76 at session start; orange→high-orange) |
| Accessibility | 93 |
| Best Practices | 96 (→ expected ~100 after `b28033db` removed the dead analytics 404) |
| SEO | 63 — **intentional**: `/hub` is `noindex` by design (app shell); `/` is the indexable SEO target |

Metrics: FCP 1.2s · LCP 4.4s · TBT 60ms · CLS 0 · SI 2.5s.

Shipped levers (2026-06-12, commits `d8258d55..b28033db`): format
negotiation for raw-PNG sprites, q28–q42 avif re-encodes (bg-new-hub,
bg-ch, splash, portals), stale LCP preload fix, portal preload + high
priority, `fade-in-5` LCP-measurability fix, dead `@vercel/analytics`
mount removed. `/exercises` moved 55→83 in the same push. Remaining
gap to 90+: JS bundle (wagmi/RainbowKit on critical path, ~107KB
unused) — dedicated high-risk cluster, documented in
`docs/handoffs/2026-06-12-perf-image-levers-handoff.md`.

A11y note for the form: the `user-scalable=no` flag is a deliberate
game-gesture decision (pinch-zoom conflicts with drag-to-move; OS-level
zoom remains available) — rationale documented in
`apps/web/src/app/[locale]/layout.tsx` viewport comment.

## 7. Manual action items — CLOSED 2026-06-05

User confirmed all four resolved at packet close:

1. ✅ **Screenshots ≥3 ≤500KB on real MiniPay Android** — captured and held aside for the form submit.
2. ✅ **Short description final approval** EN+ES (drafts from `docs/audits/2026-06-03-minipay-submission-readiness-audit.md` §6.1 signed off).
3. ✅ **`hello@chesscito.com` inbox routing** confirmed (gate of the 48h SLA pledged in §3 is live).
4. ✅ **5 identity questions** delivered to the MiniPay/Celo group (Pattern A+C decision in `docs/design-patterns/minipay-identity-design.md`).

Packet status: **ready to populate when MiniPay forwards the Stage 2 form**. No further packet-side work pending — the only remaining gate is reviewer turnaround time.

## 8. Cross-refs

- `docs/submission/minipay-form-answers.md` — full Stage 1 + Stage 2 form answers (this packet points to it)
- `docs/audits/2026-06-03-minipay-submission-readiness-audit.md` — original readiness audit (Stage 2 §3 checklist)
- `docs/audits/2026-06-02-copy-narrative-audit.md` — narrative audit that flagged the Terms wording (M3, closed here)
- `docs/audits/2026-06-03-minipay-zero-click-runtime-results.md` — zero-click 6/6 PASS Android
- `docs/handoffs/2026-06-03-hub-perf-cluster-handoff.md` — PSI mobile cluster + remaining gap
- HARD RULE memory: `minipay-listing-safety` — wording policy
- HARD RULE memory: `minipay-identity-decision-2026-06-03` — Pattern A+C identity decision
- HARD RULE memory: `i18n-key-parity` — Terms edit honored EN + ES simultaneously

## 9. Diff shipped this session

| File | Change |
|---|---|
| `apps/web/src/lib/content/editorial.ts:1631` | Terms wording fix EN |
| `apps/web/src/lib/content/messages/es.ts:143` | Terms wording fix ES |
| `docs/submission/2026-06-05-minipay-stage-2-packet.md` | This packet |
