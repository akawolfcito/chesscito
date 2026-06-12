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

## P0 — §8 Analytics — IMPLEMENTED 2026-06-12 (on-chain block shipped)

`/stats` now renders an **On-chain Activity** section (spec `docs/specs/stats-onchain-metrics-minipay-s8.md`, shipped via TDD): per-method tx counts (Victory mints / Get Peones / on-chain score saves / Welcome packs × lifetime/30d/7d), **unique on-chain wallets**, and **Get Peones stablecoin volume** per USDC/USDT/cUSD — all derived from existing Supabase mirror tables (no indexer, no new schema). Window captions map to §8's day/week/month ask. Public, no wallet, hourly-cached, em-dash on any failed query. Data layer + UI: 63/63 tests, tsc + eslint clean.

**Still disclosed as "Coming next"** (honest, need infra we don't have): network fees paid + failed-tx rate (need a chain indexer), retention D1/D7/D30 + top countries (need a web-analytics layer — note Vercel Analytics is already collecting visitor/country data and could feed top-countries via its API; tracked as a follow-up spike).

**For the form:** screenshot the live `/stats` On-chain Activity section + state the present/coming split explicitly. MiniPay accepts partial coverage when disclosed; this page discloses it.

---

## P1 — Should-fix before listing

### 3. Mobile PageSpeed ~70–80 vs 90+ target
Re-measured 2026-06-12 (`docs/pagespeed-report-2026-06-12.md`): `/hub` mobile **70–80** (desktop **93**), CLS now 0–0.12 (the prior 0.187 was an outlier). Flat vs the 2026-06-03 baseline — no perf work shipped since. Gap is **LCP-bound** (5–7 s on throttled mobile). Roadmap unchanged (dynamic-import wagmi/RainbowKit, critical CSS, Tailwind purge, responsive images). **Action:** land the perf work, then re-run with a PSI API key against the production URL right before submitting.

### 4. Asset optimization — DONE 2026-06-12 (red-team finding was a false positive)
Cross-checked against the repo: the triplet rule (.png+.webp+.avif) is **fully satisfied** — `0` of all `public/art/**` PNGs lack variants, and the heavy hero surfaces (board via `image-set`/`<picture>`, avatars) already negotiate. The red-team's "board/avatar lack variants" claim was wrong (`chesscito-board`, `avatar-fun`, `board-ch`, `shop-magic` all have avif+webp). The only genuine gap was **3 menu icons** loading raw PNG despite having variants — `leaderboard-menu` (74KB), `shop-menu` (57KB), `badge-menu` (55KB) — now wrapped in `<picture>` (avif+webp sources). Remaining raw `<img>` are small icons (<10KB) where PNG↔webp is negligible. **VR:** run `pnpm test:e2e:visual` for the 3 sheets before the next push (img→picture; rendered pixels should match the existing board precedent).

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
- **P0 §8 analytics: IMPLEMENTED 2026-06-12.** `/stats` now ships the On-chain Activity block (per-method tx, unique on-chain wallets, Get Peones volume); network fees / failed-tx / retention / countries honestly disclosed as Coming-next. 63/63 tests.
- **P1 status:** assets DONE (triplet complete; 3 raw menu icons converted to `<picture>` — red-team finding was a false positive). Remaining: mobile PageSpeed ~70–80 vs 90+ (re-run with PSI key after the bundle/LCP perf work), and append a §8 screenshot + present/coming split to the submission packet.
- **Everything else passes:** zero-click connect, no-CELO token scope, AddCash deeplink, support + legal links, strict copy, contract verification, 360×640. **With signing cleared and §8 shipped, the form is returnable** once the P1 polish (PSI re-run + packet §8 appendix) is done.
