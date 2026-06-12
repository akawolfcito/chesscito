# MiniPay Form — Submission Answers

Working document that captures the answers being prepared for the MiniPay store submission form, in the order the form asks them. English only. Sections grow as more questions are answered.

---

## Q: Does the app adapt to the user's preferred stablecoin based on the highest balance?

**YES.**

Chesscito reads the wallet balance of every accepted stablecoin and routes payment through the token with the highest USD-equivalent balance. The shared selector lives in `apps/web/src/lib/contracts/select-payment-token.ts` and is used by all three purchase flows (Shop, PRO subscription, Arena Victory NFT mint). Balances of tokens with different decimals (USDC/USDT 6, cUSD 18) are normalized to USD6 before comparison; ties break deterministically.

Accepted stablecoins on Celo Mainnet:

- **USDC** — `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`
- **USDT** — `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e`
- **cUSD** — `0x765DE816845861e75A25fCA122bb6898B8B1282a`

---

## Q: Simplified language

**YES.**

All user-facing copy lives in a single source of truth (`apps/web/src/lib/content/editorial.ts`) and follows the MiniPay simplified-language guidance:

- "Network fee" is used instead of "gas" (e.g. `CLAIM_COPY.costGasOnly: "Network fee only"`).
- The app does not implement fiat onramp/offramp — MiniPay provides those natively — so the strings "Onramp", "Offramp", "Add Cash", and "Withdraw" are not surfaced.
- "Stablecoin" is the only term used for the payment asset; the strings "crypto token" and ERC-20 ticker names never appear in user-facing labels (e.g. `"Buy with stablecoin"`).
- "Buy" is used exclusively for in-app product purchases (Founder Badge, Retry Shield, PRO subscription, Coach Pack), not for acquiring crypto.

---

## Q: Share description of all the methods accessed by users

Chesscito is a single-player chess education mini-app. The user-facing surface splits into three layers.

### App routes and flows

| Surface | Route | What the user does |
|---|---|---|
| Welcome / onboarding | `/` | First-visit carousel that detects wallet state and routes new users into the rook tutorial. |
| Play Hub | `/hub` | Mission-briefing home: pick an exercise (rook / bishop / knight), open Arena, shop, badges, leaderboard, or profile. |
| Exercises | `/exercises` | Level-based piece-movement training (move, capture, multi-move). Awards stars, unlocks badges, accumulates score. |
| Arena | `/arena` | Free-play full chess against an AI opponent at three difficulties (Easy / Medium / Hard). Tracks moves and elapsed time. |
| Victory mint | `/arena` (post-win) | After winning Arena, the user pays a micro-fee in stablecoin to mint a Victory NFT. |
| Public Victory page | `/victory/[id]` | Shareable card for any minted Victory NFT with an auto-generated OG image. |
| Leaderboard | `/` (Hall of Fame) | Top scores ranked by total points; cached via Supabase. |
| Trophies | `/trophies` | Earned chess-piece badges plus seven derived achievement trophies. |
| Profile | sheet (any screen) | Pending claims queue, claim history, account settings. |
| Shop | sheet (any screen) | Buy Founder Badge ($0.10), Retry Shield ($0.025 → 3 uses), Chesscito PRO ($1.99 / 30 days), Coach Pack credits. |
| Coach | sheet + `/coach/history` | PRO-gated AI review of any played Arena game; history list and delete. |
| Legal / support | `/terms`, `/privacy`, `/support`, `/about`, `/why` | Static informational pages. |
| Public stats | `/stats` | Platform-level metrics — lifetime mints, recent activity windows, difficulty breakdown, Hall of Fame, Top 10 leaderboard. Read-only, no auth. |

### On-chain methods the user signs

All transactions are signed inside the MiniPay wallet sheet. Stablecoin payments accept USDC, USDT, or cUSD, and the app auto-selects the token with the highest USD-equivalent balance.

- `ERC20.approve(spender, amount)` — grants the Shop / VictoryNFT contract permission to spend the exact purchase amount.
- `Shop.buyItem(itemId, paymentToken)` — purchases Founder Badge (id 1), Retry Shield (id 2), PRO subscription (id 6), or Coach Pack credits.
- `VictoryNFT.mintSigned(...)` — mints a Victory NFT after winning Arena, using a server-issued EIP-712 signature. Revenue split: 80% treasury / 20% prize pool.
- `Badges.claimBadgeSigned(...)` — claims a soulbound chess-piece badge unlocked by completing all exercises of a piece.
- `Scoreboard.submitScoreSigned(...)` — persists an exercise score on-chain after the player saves it.

### Read-only server endpoints

Next.js route handlers running on Vercel. None move user funds; all blockchain writes go through the user's wallet.

- Leaderboards and stats: `GET /api/leaderboard`, `/api/hall-of-fame`, `/api/profile/stats`, `/api/my-victories`, `/api/shields/me`.
- Entitlements: `GET /api/pro/status`, `/api/founder-status`.
- Coach: `GET /api/coach/history`, `/api/coach/credits`, `/api/coach/job/[id]`.
- Signatures (EIP-712): `POST /api/sign-badge`, `/api/sign-score`, `/api/sign-victory`.
- Verification and cache writes: `POST /api/coach/analyze`, `/api/coach/verify-purchase`, `/api/credit-shield`, `/api/verify-pro`, `/api/cache-score`, `/api/cache-victory`.
- Telemetry and game records: `POST /api/telemetry`, `/api/games`.

No method requires the user to provide a private key, mnemonic, or off-platform credential. The app never custodies funds.

### Form-ready paste

Chesscito is a single-player chess education mini-app on Celo. Users access the following methods.

Frontend routes: / (welcome), /hub (Play Hub), /exercises, /arena, /victory/[id], /trophies, /coach/history, /terms, /privacy, /support, /about, /why.

In-app sheets: Shop (buy items), PRO subscription, Profile (pending claims), Coach (PRO AI review).

On-chain methods signed by the user on Celo Mainnet:

- ERC20.approve(spender, amount) — authorize the Shop or VictoryNFT contract to spend USDC, USDT, or cUSD.
- Shop.buyItem(itemId, paymentToken) — buy Founder Badge ($0.10), Retry Shield ($0.025 → 3 uses), PRO subscription ($1.99 / 30 days), or Coach Pack credits.
- VictoryNFT.mintSigned(...) — mint a Victory NFT after winning Arena. 80% treasury / 20% prize pool.
- Badges.claimBadgeSigned(...) — claim a soulbound chess-piece badge.
- Scoreboard.submitScoreSigned(...) — persist an exercise score on-chain.

Read-only APIs called from the client: /api/leaderboard ; /api/hall-of-fame ; /api/profile/stats ; /api/my-victories ; /api/shields/me ; /api/pro/status ; /api/founder-status ; /api/coach/history ; /api/coach/credits ; /api/coach/job/[id] ; /api/sign-badge ; /api/sign-score ; /api/sign-victory ; /api/coach/analyze ; /api/coach/verify-purchase ; /api/credit-shield ; /api/verify-pro ; /api/cache-score ; /api/cache-victory ; /api/telemetry ; /api/games.

No method requires a private key or mnemonic; all transactions are signed inside the MiniPay wallet sheet. The app never custodies funds.

---

## Q: Celoscan links to contracts / addresses used in App

Chesscito's own smart contracts deployed on **Celo Mainnet (chainId 42220)** — these are the addresses that receive user-signed transactions:

| Contract | Purpose | Proxy address (Celoscan) |
|---|---|---|
| **Badges** | Soulbound chess-piece badges (`claimBadgeSigned`) | [`0xf92759E5525763554515DD25E7650f72204a6739`](https://celoscan.io/address/0xf92759E5525763554515DD25E7650f72204a6739) |
| **Scoreboard** | Exercise score persistence (`submitScoreSigned`) | [`0x1681aAA176d5f46e45789A8b18C8E990f663959a`](https://celoscan.io/address/0x1681aAA176d5f46e45789A8b18C8E990f663959a) |
| **Shop** | Item purchases: Founder Badge, Retry Shield, PRO subscription, Coach Pack (`buyItem`) | [`0x24846C772af7233ADfD98b9A96273120f3a1f74b`](https://celoscan.io/address/0x24846C772af7233ADfD98b9A96273120f3a1f74b) |
| **VictoryNFT** | Mint Victory NFT after Arena win (`mintSigned`) | [`0x0eE22F830a99e7a67079018670711C0F94Abeeb0`](https://celoscan.io/address/0x0eE22F830a99e7a67079018670711C0F94Abeeb0) |

All four contracts are deployed behind a `TransparentUpgradeableProxy` and verified on Celoscan. Sample user transactions are listed in `docs/minipay-submission.md`.

---

## Q: Provide Etherscan/Celoscan links to sample transactions for each interaction

Each row below points to a real user-signed transaction on **Celo Mainnet** against the four contracts deployed by Chesscito. Approvals on external ERC-20 tokens (USDC / USDT / cUSD) are out of scope for this question.

| Contract | Method | Sample tx (Celoscan) |
|---|---|---|
| **Shop** | `buyItem(1, …)` — Founder Badge ($0.10) | [`0x42cd5c62…88cd7b`](https://celoscan.io/tx/0x42cd5c622df686cbd369b84d74c5c46d2b29611ab4cecb80d8c03c362888cd7b) |
| **Shop** | `buyItem(2, …)` — Streak Shield ($0.025, 3 uses) | [`0xbb501a34…8f6e62a0`](https://celoscan.io/tx/0xbb501a34693ec49177f901e80ec72cef1d76f6f20cc40180f9136a598f6e62a0) |
| **Scoreboard** | `submitScoreSigned(…)` — save exercise score | [`0x910c41aa…2b90435a`](https://celoscan.io/tx/0x910c41aa415178097a40504675aee37cce916a8dc355eba937a835152b90435a) |
| **VictoryNFT** | `mintSigned(…)` — mint Victory NFT after Arena win | [`0xb18a9441…a9c5c56d`](https://celoscan.io/tx/0xb18a9441bcfbb7417b18c2813116f3425546637bb341d9e969508d68a9c5c56d) |
| **Badges** | `claimBadgeSigned(…)` — claim soulbound piece badge | [`0x8be60527…0ec67`](https://celoscan.io/tx/0x8be6052c7f833af83fd2d3d5c04d76406ce9f1fcbcdf82ff5007ce35daf0ec67) |

The PRO subscription (`buyItem(6, …)`) uses the exact same Shop method as Founder Badge and Streak Shield, with `itemId = 6`; the two `buyItem` samples above cover the method evidence.

### Form-ready paste

Shop.buyItem (Founder Badge) - https://celoscan.io/tx/0x42cd5c622df686cbd369b84d74c5c46d2b29611ab4cecb80d8c03c362888cd7b ;
Shop.buyItem (Streak Shield) - https://celoscan.io/tx/0xbb501a34693ec49177f901e80ec72cef1d76f6f20cc40180f9136a598f6e62a0 ;
Scoreboard.submitScoreSigned - https://celoscan.io/tx/0x910c41aa415178097a40504675aee37cce916a8dc355eba937a835152b90435a ;
VictoryNFT.mintSigned - https://celoscan.io/tx/0xb18a9441bcfbb7417b18c2813116f3425546637bb341d9e969508d68a9c5c56d ;
Badges.claimBadgeSigned - https://celoscan.io/tx/0x8be6052c7f833af83fd2d3d5c04d76406ce9f1fcbcdf82ff5007ce35daf0ec67 ;

---

## Q: Provide your app's domains and subdomains which will contain your JavaScript code

### Primary domain (custom — Chesscito-owned)

**`www.chesscito.com`** is the canonical, user-facing domain (the apex `chesscito.com` 307-redirects to `www`). It is a custom domain registered to the publisher, not a Netlify or Vercel subdomain. DNS A / AAAA records point to Vercel's edge network, but the origin shown in the address bar and used as the production entrypoint is always the custom `www` subdomain.

This domain hosts the full Next.js App Router bundle and every `/api/*` route handler that the client calls.

### Auxiliary domains (engineering / infra only)

These are not the canonical entrypoint and never surface to end users:

- `chesscito-<branch>-<hash>.vercel.app` — Vercel preview deploys generated automatically per branch / PR. Used for staging and review only.
- `chesscito.vercel.app` — legacy URL deprecated on 2026-05-20 when the migration to the custom apex completed. Still resolves for backward compatibility but is not the canonical user-facing origin.

### Third-party origins that serve JavaScript inside the app

Only one external script is loaded at runtime:

- **`va.vercel-scripts.com`** — Vercel Analytics script (anonymous pageview tracking), loaded via `@vercel/analytics/next` v2.0.1.

All other dependencies (wagmi, viem, ethers, Supabase JS, OpenAI SDK, chess.js, etc.) are bundled with the app and served from `chesscito.com`. RPC calls to `forno.celo.org` and Supabase REST endpoints are JSON data fetches, not JavaScript sources.

### Form-ready paste

```
Primary domain (user-facing, custom):  www.chesscito.com
Preview deploys (Vercel infra only):    chesscito-<branch>-<hash>.vercel.app
Legacy domain (deprecated 2026-05-20):  chesscito.vercel.app
Third-party JS origin:                  va.vercel-scripts.com  (Vercel Analytics)
```

---

## Q: How do you plan to support the App users for any queries, concerns or issues?

Chesscito offers three independent support channels covering all three options listed in the MiniPay form.

### Channels in place

| Channel type | Surface | Where |
|---|---|---|
| **Telegram (community + DM)** | Public group + direct messages | `@chesscito_app` (Telegram) |
| **Web Based support** | In-app support page reachable from every footer | `https://www.chesscito.com/support` |
| **Ticket Based Support** | Public GitHub issue tracker + email | `https://github.com/wolfcito/chesscito/issues` and `mailto:` link on the support page |

The web support page lists issue categories (loading problems, transaction errors, UI bugs, gameplay questions, feature requests) and documents the SLA: response within 48 hours.

### Form selection

- ☑ **WhatsApp/Telegram Support** — Telegram `@chesscito_app`
- ☑ **Web Based support** — `www.chesscito.com/support`
- ☑ **Ticket Based Support** — GitHub Issues + email

### Form-ready paste

```text
Telegram:  @chesscito_app
Web:       https://www.chesscito.com/support
Tickets:   https://github.com/wolfcito/chesscito/issues
Email:     (mailto link on the support page; configured via NEXT_PUBLIC_SUPPORT_EMAIL)
SLA:       response within 48 hours
```

---

## Q: Link to Terms of Service — Do you have Terms of Service link available on your website?

**YES.**

Chesscito publishes a full Terms of Service page reachable both directly via URL and through in-app navigation (landing footer and `/about` page).

| Field | Value |
|---|---|
| Public URL | `https://www.chesscito.com/terms` |
| Source | `apps/web/src/app/terms/page.tsx` |
| Content source of truth | `LEGAL_COPY.terms` in `apps/web/src/lib/content/editorial.ts` |
| Last updated | March 15, 2026 |
| Linked from | Landing page footer, `/about` page |

### Form-ready paste

```text
https://www.chesscito.com/terms
```

---

## Q: Link to Privacy Policy — Do you have Privacy Policy link available on your website?

**YES.**

Chesscito publishes a full Privacy Policy page reachable both directly via URL and through in-app navigation (landing footer and `/about` page).

| Field | Value |
|---|---|
| Public URL | `https://www.chesscito.com/privacy` |
| Source | `apps/web/src/app/privacy/page.tsx` |
| Content source of truth | `LEGAL_COPY.privacy` in `apps/web/src/lib/content/editorial.ts` |
| Last updated | March 15, 2026 |
| Linked from | Landing page footer, `/about` page |

### Form-ready paste

```text
https://www.chesscito.com/privacy
```

---

## Q: Operator Information — make it clear the app is operated by you and explicitly state it is not operated by Opera or MiniPay

Chesscito is an **independent product built and operated by Wolfcito (`@akawolfcito`)**. It is **not operated by, affiliated with, or endorsed by Opera or MiniPay**. References to MiniPay throughout the service identify it solely as a wallet and distribution channel.

### Where the disclaimer is surfaced in-product

| Surface | Location |
|---|---|
| `/about` identity block | Paragraph rendered below the version line (`ABOUT_COPY.operatorDisclaimer` in `editorial.ts`) |
| `/terms` — Section 1 | "Independent Operator" — first section of the Terms of Service (`LEGAL_COPY.terms.sections[0]`) |

### Form-ready paste

```text
Chesscito is an independent product built and operated by Wolfcito (@akawolfcito).
It is NOT operated by, affiliated with, or endorsed by Opera or MiniPay.
MiniPay is referenced solely as a wallet and distribution channel.

Operator surface:   https://www.chesscito.com/about
Legal disclaimer:   https://www.chesscito.com/terms  (Section 1 — "Independent Operator")
```

---

## Q: Brief Description of App — purpose and key features

Three length variants are provided. Pick the one that fits the form field's character / word budget at submission time.

### Short (one sentence, ~140 chars)

```text
Chesscito is a mobile pre-chess education mini-app on Celo, distributed via MiniPay.
Learn how each chess piece moves through gamified, on-chain challenges.
```

### Medium (one paragraph, ~80 words)

```text
Chesscito is an educational pre-chess game built for the Celo MiniPay wallet. Players
learn how each chess piece moves (rook, bishop, knight, and beyond) through bite-sized
puzzles that reward stars, soulbound badges, and verifiable on-chain scores. A free-play
Arena mode lets users practice full games against an AI opponent at three difficulty
levels and mint a Victory NFT when they win. Curriculum designed by FIDE Master
César Litvinov Alarcón.
```

### Long (three paragraphs, ~180 words — recommended for the form)

```text
Chesscito is a mobile-first pre-chess education mini-app on the Celo blockchain,
distributed through the MiniPay wallet. Its mission is to make the foundational skill
of "how each chess piece moves" accessible to anyone with a smartphone, using
gamified, verifiable on-chain progress as the motivation layer.

Key features:
- Piece-by-piece training — interactive level-based exercises for rook, bishop, knight
  (and more), with three challenge modes: move, capture, and multi-move puzzles.
- Arena free play — full chess matches against an AI opponent at Easy, Medium, and
  Hard difficulty (powered by js-chess-engine, ~30 KB pure JS, MiniPay-compatible).
- On-chain collectibles — soulbound chess-piece badges, exercise scores, Founder
  Badge, Streak Shield, and Victory NFTs (minted after Arena wins).
- Chesscito Coach (PRO, $1.99/30d) — AI review of completed Arena games with
  move-by-move feedback.
- Stablecoin micro-pricing — items cost $0.005–$1.99 in USDC, USDT, or cUSD; the
  app auto-selects the user's highest-balance stablecoin.
- Pedagogy — curriculum designed by FIDE Master César Litvinov Alarcón
  (100+ students, alumni in national/international tournaments).
```

---

## Q: Public platform metrics

**Status: MVP available, full analytics roadmap pending.**

A public stats page is live at **https://www.chesscito.com/stats** (linked from the landing footer; no auth, no wallet). Every number on the page reads from the same Supabase tables that record real activity (`victories`, `welcome_pack_claims`, `analytics_events`, `coach_analyses`, `leaderboard_v`). No data is mocked or fabricated; missing metrics are declared explicitly rather than approximated.

### Current surface

- **Chesscito Platform Stats** header with explicit framing that the page is platform-level activity, not a single player profile.
- **What this shows** — three-bullet orientation block.
- **Primary metrics**: Victory NFTs minted (lifetime), Approx. App Sessions (7d), Victory Mints (30d).
- **Activity windows**: Victory Mints (7d), Wallets with Victory Mints, Approx. App Sessions (30d), Welcome Packs Claimed (lifetime), Welcome Packs (7d).
- **Victories by difficulty** — Easy / Medium / Hard breakdown with a horizontal mix bar.
- **Platform signals** — three narrated insights derived from the live snapshot at render time.
- **Activity trend, last 30 days** — two 30-bar SVG sparklines (sessions + mints) over the same axis.
- **Recent Victory Mints** — 10 most recent on-chain mints, wallets truncated.
- **Community Leaderboard** — Top 10 by accumulated game score (sourced from `scores`, not `victories`; microcopy disambiguates).
- **Tracked today / Coming next** — bifurcated scope card so a reviewer sees both coverage and gaps at a glance.
- **Methodology footnote** — term-level definitions for the metric labels.

### Honest coverage against MiniPay §8 Analytics requirements

| MiniPay §8 requirement | /stats today | Notes |
|---|---|---|
| DAU / MAU | 🟡 Proxy via `analytics_events.session_id` (7d + 30d) | Anonymous session IDs, not wallet-tied; cross-device users sub-count. Labeled "Approx." on the page. |
| Retention D1 / D7 / D30 | ❌ Not surfaced | Requires wallet-tied event stream — listed under "Coming next". |
| Top countries | ❌ Not surfaced | No geo telemetry instrumented. Roadmap. |
| Transactions per day / week / month | 🟡 Partial (Victory mints only) | Other on-chain interactions (shop purchases, badge claims, PRO renewals, Welcome Pack signatures) are not aggregated yet. |
| Unique on-chain users | 🟡 Partial (mint-only) | Card "Wallets with Victory Mints" tracks distinct `victories.player`; broader on-chain user set is not aggregated. |
| Volume per stablecoin | ❌ Not surfaced | Listed under "Coming next". |
| Network fees paid | ❌ Not surfaced | Listed under "Coming next". |
| Protocol revenue (FeeCollected) | ❌ Not surfaced | Listed under "Coming next". |
| Failed-tx rate | ❌ Not surfaced | Listed under "Coming next". |

### Roadmap

The full §8 analytics gap is acknowledged and scoped as a separate engineering cluster (not bundled with listing submission). Closing the gap requires:

1. Wallet-tied event stream persistence (real DAU/MAU + retention cohorts).
2. On-chain indexer or event listener (transaction breakdown, stablecoin volume, fees, protocol revenue).
3. Tx-state ledger (failed-tx rate).
4. Geo telemetry instrumentation (top countries).

Estimated 2-4 weeks of dedicated work. Tracked publicly in `docs/product/stats-mvp.md` (§7 Future evolutions) and on the `/stats` page itself ("Coming next" column).

### Why we ship the MVP now

Two reasons. First, the page provides real transparency today rather than withholding everything until a complete solution exists. Second, the honest "Coming next" enumeration on the page itself sets reviewer expectations correctly — there is no surprise gap once the page is opened.

Architecture, refresh cadence (1 hour `revalidate`), privacy posture (aggregates only, truncated wallets), and per-metric sources are documented in `docs/product/stats-mvp.md` in the project repository.

