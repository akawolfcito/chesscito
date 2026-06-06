# Red-team — Wallet-mock Playwright fixture plan

**Date:** 2026-06-05
**Status:** REVIEW (plan not yet implemented)
**Scope:** Plan presented in the "continuemos" session to mock RainbowKit/wagmi for auth-gated sheets in Playwright.

## Original plan (1-liner)

`apps/web/e2e/fixtures/wallet-mock.ts` injects `window.ethereum` stub via `addInitScript`, RainbowKit auto-connects, extends `sheet-aria-hidden-probe` to cover Account/PRO/Profile/CoachPaywall/PurchaseConfirm. Estimate: 2-4h, 1 commit.

## Findings

### F1 — RainbowKit does NOT auto-connect to injected `window.ethereum`

The plan assumes injecting `window.ethereum` is enough. False: RainbowKit's `ConnectButton` requires an explicit user click on a connector tile (or programmatic `connect()` call). Mere presence of `window.ethereum` only enables the *option* — it doesn't fire `useAccount().address`.

**Implication:** the fixture must also (a) drive the RainbowKit modal in each test (slow, brittle, modal markup changes), or (b) seed `wagmi.store` localStorage entries BEFORE the page boots so wagmi auto-reconnects on hydration.

### F2 — wagmi `mock` connector exists but requires prod-code change

`@wagmi/connectors` ships a `mock` connector designed exactly for this. The canonical pattern adds it to `createConfig({ connectors: [...] })`. BUT that means modifying the prod wagmi config to conditionally include the mock connector under a test env var.

**Implication:** "no prod-code touch" is a soft constraint that breaks here. Either accept a tiny conditional knob in `apps/web/src/lib/wallet/wagmi-config.ts` (gated on `process.env.NEXT_PUBLIC_E2E_MOCK_WALLET === "1"`), or use F3.

### F3 — localStorage seed sidesteps both F1 and F2

wagmi v2 persists `wagmi.store` (recent connector ID + address) and `wagmi.recentConnectorId`. Seeding these via `addInitScript` BEFORE page load triggers auto-reconnect on hydration, no connector handshake, no modal click. This is the proven Playwright-with-wagmi pattern in the wild.

**Risk:** key names + serialization format drift between wagmi versions. Snapshot the current `wagmi.store` from a real session and replicate.

### F4 — Scope creep across 5 sheets

The handoff bullet says "Account, PRO, Profile, CoachPaywall, PurchaseConfirm". Wallet mock alone unblocks the first 3 (gated on `address`). CoachPaywall is gated on credits balance + PRO status. PurchaseConfirm is gated on an in-flight purchase intent. Each has its own state machine.

**Implication:** the first commit cannot land all 5. Scope to {Account, PRO, Profile} and defer Paywall/PurchaseConfirm as separate sub-clusters.

### F5 — A11y probe STRICT_ASSERT flip is independent of this work

Per the last handoff: "Playwright headless Chromium can't reproduce the aria-hidden warning." That's confirmed empirical reality across the 6 anonymous sheets. Even with wallet-mock landing 3 more sheets, the probe is still effectively a no-op assertion in headless mode. Flipping `STRICT_ASSERT = true` after this work makes the probe always-green, NOT a regression guard.

**Implication:** the value proposition stated in the plan ("extend a11y probe") is HOLLOW. Real value is unblocking VR coverage and Playwright integration tests of authed flows — NOT a11y assertion.

### F6 — Cheaper alternative exists (pattern already proven in this repo)

The 2026-06-05 OG/VR session shipped `VictoryLandingCard` — a presentational shell extracted from `/victory/[id]` and mounted in `/dev/victory-landing` for VR. The same pattern works here: extract Account/PRO/Profile sheet bodies into presentational shells with hardcoded prop variants, mount them in `/dev/auth-sheets-fixture`, lock VR baselines. Zero wallet mock required.

**Trade-off:** the fixture covers presentational drift, NOT integration (router push, sheet open/close handlers, real prop wiring). For VR coverage that's fine; for a11y probe that misses the cascade-on-portal-open trigger that the production code hits.

### F7 — Estimation reality

Original 2-4h assumes F1/F2/F3 land in one pass. Realistic:
- F3 (localStorage seed): 2h discover + 1h verify
- F4 (per-sheet routing/preconditions): 30min × 3 sheets = 1.5h
- F5 (no value-add for a11y): drops the original justification
- Real total: 4-6h with F6 as escape hatch at 2-3h

### F8 — Foundation pre-existing?

Not checked. Should grep for `wagmi.store`, `mockConnector`, `wallet-mock`, `e2e-mock` before any new work — the project may already have partial scaffolding.

## Recommendation

**Drop the original plan.** Two paths forward:

**Path A — presentational shell (F6 pattern):**
- Pros: zero wallet machinery, reuses proven pattern, unblocks VR coverage
- Cons: doesn't unblock a11y probe extension (F5 says that goal was hollow anyway)
- Cost: 2-3h, 1 commit
- Scope: Account + PRO sheets (highest-traffic), defer Profile

**Path B — localStorage seed (F3 pattern):**
- Pros: enables real integration tests of authed flows (Paywall, PurchaseConfirm in future)
- Cons: wagmi version coupling, brittle, hits F5 (probe still hollow)
- Cost: 4-6h, 1-2 commits
- Scope: fixture only, defer probe extension to a STRICT_ASSERT-meaningful future where headless Chromium reports the warning

## Decision needed

Which path? Or is the right call to deprioritize the whole thing and pick something with clearer ROI (e.g., the legitimate VR baseline backlog from the previous handoffs)?
