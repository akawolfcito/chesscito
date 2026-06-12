# MiniPay Stage 2 — Readiness Review (2026-06-11)

Re-audit of Chesscito (commit `33361d2c`+) against the **official MiniPay Stage 2 checklist** (Opera MiniPay "Build for MiniPay: Developer Requirements", via celopedia `minipay-requirements.md`, updated 2026-05-13). The 2026-06-05 packet is partly **stale** — the checklist now includes §8 Analytics, which the packet never addressed.

**Verdict (updated 2026-06-12): NOT yet ready to return the Stage 2 readiness form.** The §8 analytics gap is the main remaining blocker; perf is below target. The earlier "message-signing breaks in MiniPay" blocker was **disproven on-device** — see the RESOLVED note below.

---

## RESOLVED — message-signing is NOT a blocker (verified on-device 2026-06-12)

The 2026-06-11 draft flagged user-side `signMessage` as a P0 because the celopedia Stage-2 checklist (2026-05-13) lists "no message signing." That rule is **stale**: the live MiniPay/Celo docs no longer state it, and an on-device probe (`/dev/sign-probe`, run inside MiniPay 2026-06-12) returned a **successful signature** — MiniPay supports `personal_sign`.

**Implication:** the two flows below work in MiniPay; no fix required.
- `apps/web/src/lib/shop/use-welcome-pack-claim.ts:175` — Welcome Pack claim (`signMessageAsync`).
- `apps/web/src/components/coach/coach-history-delete-panel.tsx:61` — Coach history deletion (`signMessageAsync`).

Their server-side ownership verification (EIP-191 `verifyMessage` / `recoverMessageAddress`) is actually *stronger* auth than the address-only model used elsewhere — keep it. This also unlocks a SIWE-style single onboarding signature (login + nickname claim + welcome pack) as a product direction.

---

## P0 — Blocking (must address before forwarding the form)

### 1. §8 Analytics — `/stats` exists but is missing most required metrics
The checklist (§8) is a **hard requirement**: a public `/stats` page (no wallet) surfacing DAU, MAU, D1/D7/D30 retention, top countries, and on-chain metrics (tx/day·week·month·lifetime per contract method, unique on-chain users, volume per stablecoin, network fees paid, protocol fees/revenue, failed-tx rate).

`/stats` exists (`apps/web/src/app/[locale]/stats/page.tsx`, public, hourly revalidate) and shows: Victory mints (7d/30d/lifetime), approx app sessions (7d/30d), unique minter wallets, welcome packs, leaderboard, difficulty split. **Present:** DAU/MAU (as sessions), partial lifetime tx (victories only). **Missing:** retention cohorts, top countries, per-method tx breakdown (Shop/Badges/Scoreboard), stablecoin volume (USDT/USDC/USDm), network fees, protocol revenue, failed-tx rate. The page already self-discloses these as "Coming next."

**Fix direction:** either (a) extend `/stats` to cover the missing groups (the on-chain ones are indexable from the 4 mainnet contracts), or (b) at minimum, present them transparently in the form with a credible roadmap. MiniPay uses these for promotion/featuring decisions, so partial is acceptable *only if disclosed*; silent omission reads as "not measured."

---

## P1 — Should-fix before listing

### 3. Mobile PageSpeed 72 vs 90+ target (and stale)
Last Lighthouse run `docs/pagespeed-report-2026-06-03.md`: `/hub` mobile **72** (desktop 95), mobile **CLS 0.187** (poor, regressed from 0.126). Target is 90+. Report is 8 days old. Roadmap exists (dynamic-import wagmi/RainbowKit, critical CSS, Tailwind purge, responsive images). **Action:** land the perf work, then re-run against the production URL right before submitting.

### 4. Asset optimization gaps
Triplet rule (.png+.webp+.avif) holds for 19/23 large images, but:
- `chesscito-board.png` (268 KB) — **the game board, mission-critical UI** — has NO webp/avif variant and is referenced directly (`components/board.tsx`, `board-thumbnail.tsx`).
- `avatar-fun.png` (68 KB) — no variants. `shop-magic-chesscito.png` (2.0 MB) — webp but no avif.
- Several user-facing surfaces reference `.png` directly (landing `pre-chess-exercise.png`, board `board-ch.png`), bypassing format negotiation.

**Action:** generate webp/avif for the board + avatar via `scripts/optimize-art-assets.sh`; switch hot direct-PNG refs to the optimized variant or `<picture>`/`next/image`.

### 5. 2026-06-05 packet is stale
It pre-dates `/stats` and never covers §8 analytics or the strict copy table as currently worded. **Action:** append a §8 section (live `/stats` URL + screenshot + explicit present/missing metric list) before returning the form.

---

## P2 — Trivial
- `apps/web/src/app/dev/arena-end-state/fixture.tsx:64` — "Insufficient gas…" string. **Dev-only fixture, not production**, but rename to "Insufficient funds…" to keep the banned-term grep clean.

---

## Confirmed PASS (no action)

| Requirement | Evidence |
|---|---|
| Zero-click connect (no Connect btn in MiniPay) | `lib/minipay.ts:28-36`, `components/wallet-provider.tsx:55-71`, `connect-button.tsx:10-22` |
| Token scope — never displays/requires CELO | `lib/contracts/tokens.ts:5-9` (ACCEPTED = USDC/USDT/cUSD); CELO CTAs gated to non-MiniPay only; PRO/shop filter CELO out |
| Low-balance → Deposit deeplink | `components/minipay/add-cash-cta.tsx` → `https://minipay.opera.com/add_cash`, gated `isMiniPay`, used in coach/victory/shop error surfaces |
| In-app support link | `/support` route: email + Telegram + GitHub; linked from About + footer |
| Terms + Privacy in-app | `/terms`, `/privacy` routes, linked from About + landing footer |
| Strict copy (gas/onramp/offramp/crypto) | "Network fee only", "Deposit in MiniPay", "USD stablecoin", "digital collectible" — clean across EN+ES; only the dev fixture violates |
| Raw address not primary identifier | Profile leads with display name; truncated `0x…` is secondary hint only |
| Contracts verified + sample tx hashes | Per 2026-06-05 packet §1 (Badges/Scoreboard/Shop/VictoryNFT on Celoscan) |
| 360×640 smoke | Packet §5, 7/7 routes PASS |

---

## Summary

- **Message-signing: RESOLVED (not a blocker).** On-device probe in MiniPay (2026-06-12) confirmed `personal_sign` works; the celopedia "no message signing" rule is stale. Welcome Pack + Coach delete keep their signature auth.
- **1 P0 blocker:** `/stats` is missing most §8 analytics metrics (retention, countries, per-method tx, stablecoin volume, fees, failed-tx) — extend it or disclose the gap with a roadmap in the form.
- **3 P1:** mobile PageSpeed 72 vs 90+ (re-run after perf work), board/avatar PNGs lack webp/avif, 2026-06-05 packet doesn't cover §8.
- **Everything else passes:** zero-click connect, no-CELO token scope, AddCash deeplink, support + legal links, strict copy, contract verification, 360×640. With signing cleared, **§8 analytics is the single thing standing between this and returning the form.**
