# Soft Onboarding for Web / Non-MiniPay Users

**Status:** Documented, NOT scheduled
**Date:** 2026-05-25
**Source:** Hub welcome-carousel audit (`docs/reviews/ux/2026-05-25-welcome-carousel-audit.md`)
**Origin signal:** Wolfcito feedback — the just-removed `<WelcomeOverlay>` carousel did NOT solve the actual onboarding pain. Real gap is account creation outside MiniPay.

## Problem

Chesscito's primary distribution is MiniPay, where the wallet is auto-injected and account creation is invisible. Users land on `/hub` already authenticated and can save scores, claim badges, mint NFTs immediately.

Outside MiniPay (web on desktop, web on a non-MiniPay phone, other in-app browsers), the user lands with:
- No wallet → no on-chain progress
- A "Connect" CTA that opens RainbowKit's wallet modal — friction unfamiliar to non-crypto-native users
- Local progress works (stars persist in localStorage) but everything *valuable* (Save, Badge, Victory NFT, PRO) is gated behind that wallet step

Result: a meaningful slice of web traffic experiences the app as "an offline trainer" rather than "a chess game with persistent achievements". This is what the carousel was trying to band-aid; it didn't work (players skip past it, learn nothing about the wallet step, abandon at the first connect prompt).

## What we want

A **soft account onboarding** for web/non-MiniPay surfaces that lets a player:
1. Start playing immediately (zero account friction)
2. Sign in with a familiar method (social login: Google / Apple / X) when they hit the first wallet-gated milestone (★★★, victory, badge claim)
3. Get an automatically provisioned embedded wallet under the hood — no seed phrase prompt, no extension install
4. Carry their local progress forward to that wallet (the `chesscito:save:*` / `chesscito:score-pending:*` keys already exist for this — we'd need to flush them through)

## Why not now

- Bigger than a session of work. New SDK dependency, new auth surface, new key-management story.
- Need clear product call on which provider (see Options).
- Phase 2 of the account-chip plan already covers the "prompt to connect at milestones" path via `useConnectPrompt`. That's the necessary precursor; this spec extends it with social-login support **inside** that prompt.

## Solution shapes (provider options)

Each option provides "social login → embedded EVM wallet" on Celo. None mandate browser-extension wallets.

### A. Privy
- React SDK first-class
- Embedded EOA per user, automatically signs on-chain transactions after social login
- Backed by a16z, mature DX
- Pricing: free tier ~1000 MAU
- Pros: most polished React DX, well-documented Celo support
- Cons: vendor lock, KYC features they offer we don't need

### B. Web3Auth (Torus)
- Threshold-signature embedded wallet (no single-server custody)
- Multi-chain by default, Celo supported
- Pros: more decentralized custody model
- Cons: bulkier SDK, more setup boilerplate

### C. Crossmint
- Embedded wallets + NFT/payments tooling
- Strong for our existing mint flow (could replace EIP-712 server signature ceremony)
- Pros: integrated with the value props (badge / Victory NFT mint)
- Cons: heavier integration than Privy, more product surface than we need

### D. Defer (stay with current Connect modal)
- Keep RainbowKit modal as-is
- Add a stronger contextual prompt at milestones (Phase 2 connect-prompt is the start)
- Skip social login entirely
- Pros: zero new infra, zero new dependencies
- Cons: doesn't actually solve the original pain

## Recommended sequencing

If/when we tackle this:

1. **First**: collect telemetry on the current web Connect funnel.
   - How many `welcome_skip` vs `welcome_complete` did we have? (Available before deletion — check Vercel analytics or DB snapshot.)
   - What's the conversion rate from "land on /hub" → "tap Connect" → "complete connection"?
   - What % of `chesscito:save-pending:*` localStorage entries never sync because the user never connected?

2. **Then**: A/B test Option A (Privy) on a flag (`NEXT_PUBLIC_SOCIAL_LOGIN=on`) for a slice of web traffic. Compare conversion vs current Connect modal.

3. **Then**: roll out based on data.

## Non-goals

- This is NOT about replacing MiniPay's wallet injection — MiniPay users continue with their native wallet, unaffected.
- This is NOT about replacing the existing wagmi/RainbowKit setup for web — social login adds a path, doesn't remove one.
- NOT a carousel. The carousel pattern was wrong for the problem; this is a contextual modal at milestones (the `ConnectPromptToast` is the closest current surface).

## Implementation rough scope (when scheduled)

- Add provider SDK (likely Privy) → ~1 week setup + auth flow integration
- Provision embedded wallet on first social-login completion → ~3 days
- Migrate local-progress to wallet on first connect → ~2 days
- Replace the "Connect to save" CTA with the social-login flow on web (keep RainbowKit as fallback) → ~3 days
- Telemetry instrumentation + flag gating → ~2 days
- Total estimate: ~2 weeks focused work, plus testing across web/MiniPay/iOS browsers

## Open questions

- Which provider? (Privy is the leaning recommendation but not decided.)
- Custody model: pure embedded EOA (provider-managed key) vs threshold-shares?
- Do we want recoverability via email/phone? (Locks us into KYC-adjacent territory if yes.)
- What's the exit story — can users export their key once they're crypto-native enough? (Privy supports this; Web3Auth's TSS makes it less clean.)

## What's documented vs not

- Documented HERE: the gap, the problem framing, the provider options.
- NOT documented yet (deferred): product copy for the social-login flow, exact migration path for local-progress → embedded wallet, billing implications, KYC/compliance posture.

## Pointers

- Phase 2 `useConnectPrompt` hook + `ConnectPromptToast` — `apps/web/src/lib/connect-prompt/`, `apps/web/src/components/connect-prompt/`. These already act as the milestone-trigger primitive that a social-login replacement would slot into.
- Account chip + AccountSheet — `apps/web/src/components/exercises/exercises-screen.tsx` (search `AccountSheet`). The chip surface that handles wallet identity is the natural home for the social-login affordance.
- localStorage progress keys — see `MEMORY.md` for the `chesscito:*` key family. These are the source of truth for "local-first progress" that needs to flow into the embedded wallet on first sign-in.

---

**TL;DR**: We removed the welcome carousel because it didn't earn its place. The actual gap it tried to band-aid is social-login / soft account creation for web users — too big a feature to bundle into a session, documented here so it isn't lost.
