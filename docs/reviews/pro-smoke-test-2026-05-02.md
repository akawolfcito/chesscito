# PRO Smoke Test — 2026-05-02

> **Purpose**: Validate the PRO end-to-end business flow against the local stabilization-sprint state. Smoke gates whether the unpushed commits go to `origin`.
> **Method**: 3 automatable pre-checks + 9 manual browser checks.
> **Status**: **EXECUTED + CLOSED 2026-05-02 23:30 local.** Verdict: **GO** after a critical bug was found and fixed mid-smoke (verify-pro ABI mismatch). Two distinct PRO purchases validated end-to-end — one with manual server-side verify-pro intervention (compensation), one fully automatic via MiniPay shell on the deployed fix.

---

## 1. Environment (executed)

| Field | Value |
|---|---|
| HEAD at start | `4316548 docs(reviews): PRO smoke test plan + automatable pre-check results` |
| HEAD after fix | `4c8748f fix(verify-pro): mark ItemPurchased.token as indexed (matches contract)` |
| Branch | `main` |
| Network | Celo Mainnet (chainId 42220) |
| Wallet (last 6) | `…fc2dD` (`0xCc4179A22b473Ea2eB2B9b9b210458d0F60Fc2dD`) |
| Payment token | USDm (cUSD-renamed; address `0x765de816...`) |
| `NEXT_PUBLIC_ENABLE_COACH` | unset → defaults to `true` |
| Browser | MiniPay WebView (mobile) + Chrome desktop for diagnostic console |
| Date / Time | 2026-05-02 22:00 → 23:30 UTC |
| Tester | Wolfcito |

---

## 2. Automatable pre-checks (agent — already run)

| # | Check | Result | Owner |
|---|---|---|---|
| 0.1 | Unit suite (`pnpm vitest run` from `apps/web`) | **595/595 ✅** | agent |
| 0.2 | TS check (`pnpm tsc --noEmit`) | **0 errors ✅** | agent |
| 0.3 | Visual regression (`pnpm test:e2e:visual` — 3 baselines on minipay project) | **3/3 ✅** | agent |

All three ran at HEAD `dd7821e`. If any of these flips red between now and a re-run, halt the smoke and investigate.

---

## 3. Manual browser checks (Wolfcito — pending)

For each step: pick a result (`pass` / `fail` / `blocked` / `n/a`), drop a one-line note + an artifact reference (screenshot path, video, or repro link). Don't grade ambiguously — uncertain → fail.

### Step 1 — `/hub` clean

**Pre-conditions**: dev server up. localStorage cleared OR set `chesscito:onboarded=true`, `chesscito:welcome-dismissed=1` to bypass first-visit overlays. No wallet connected (anonymous variant first).

**Action**: navigate to `http://localhost:3000/hub`.

**Expected**:
- Z1 (`<GlobalStatusBar />`) at top showing **"Guest"** label, no PRO indicator.
- Z2 (`<ContextualHeader />`) shows piece title + objective + picker chevron.
- Z3 board renders 8×8 with a rook on a1 (default first-visit exercise).
- Z4 / Z5: contextual action area + dock with 5 items at viewport bottom.
- **NO cognitive disclaimer** above the dock (P1-1 closure).
- Combined Z1 + Z2 content height ≤ 104px (visual judgement OK, exact measurement in e2e).

**Result**: `___`
**Notes**: ___
**Artifact**: ___

---

### Step 2 — Connect wallet, see Z1 connected variant

**Pre-conditions**: Step 1 passed. Wallet ready.

**Action**: open the wallet connect surface (RainbowKit modal — likely from a dock entry that requires wallet OR via the wallet's own injection in MiniPay). Connect.

**Expected**:
- Z1 flips from `data-variant="anonymous"` to `data-variant="connected"`.
- Identity pill shows **truncated wallet address** (canonical `0xABCD…1234` shape via `formatWalletShort`).
- PRO indicator appears in Z1 right cluster — variant depends on PRO status:
  - PRO **inactive** (no prior purchase): muted "PRO" pill (`text-white/40 ring-1 ring-inset ring-white/15`), no gold ring on avatar.
  - PRO **active** (prior purchase still valid): gold ring on avatar + "PRO • Nd" pill.
- No double-PRO render (no legacy `<ProChip>` lingering).

**Result**: `___`
**Notes**: ___
**Artifact**: ___

---

### Step 3 — Open ProSheet, see active-state CTA (or buy flow)

**Pre-conditions**: Step 2 passed, wallet connected.

**Action**: tap the PRO indicator in Z1 (either active or inactive variant — both fire `onProTap`).

**Expected**:
- `<ProSheet>` mounts as a Type-C bottom sheet.
- Header: "Chesscito PRO" + tagline.
- Price label `$1.99 / month`.
- **Active perks** list visible.
- **"Coming later"** roadmap list visible (60% opacity).

**If PRO is currently active** (post-purchase state):
- Green banner `pro-active-banner` with "PRO Active — N days left".
- New `pro-active-cta` block (commit #1 of stabilization sprint):
  - Button labeled **"Play Arena"**.
  - Helper copy below:
    - If `ENABLE_COACH !== "false"`: "After your match, PRO unlocks Coach analysis so you can review your decisions."
    - If `ENABLE_COACH === "false"`: "Coach analysis is included with PRO and will appear after your Arena match."
- Renew CTA at bottom: "Extend training".

**If PRO is currently inactive** (first purchase about to happen):
- No active banner, no `pro-active-cta` block.
- Single CTA at bottom: "Start training" (`PRO_COPY.ctaBuy`).

**Result**: `___`
**Notes**: ___
**Artifact**: ___ (capture both inactive and active states if testing the full purchase loop)

---

### Step 4 — Buy PRO (purchase + verify)

**Pre-conditions**: Step 3 with PRO **inactive**. Wallet has ≥ $1.99 in stablecoin (USDC/USDT/cUSD, depending on `tokens.ts` accepted list) + gas.

> **Money warning**: this step costs **real money** on mainnet ($1.99 + gas). If on Sepolia testnet, only testnet funds. If unsure of network, halt and verify env first.

**Action**:
1. Tap "Start training" CTA.
2. Approve token allowance (if first time).
3. Sign + submit the purchase transaction.
4. Wait for verification (`/api/verify-pro`).

**Expected**:
- Transaction broadcasts; explorer link works (testnet: `sepolia.celoscan.io`, mainnet: `celoscan.io`).
- After confirmation, `useProStatus(address)` flips `active: true` with a future `expiresAt` (~30 days from now).
- ProSheet re-renders with the active-state UI (active banner + Play Arena CTA).
- Telemetry: `pro_cta_clicked` with `source: "sheet_buy"` fired (visible in network tab if telemetry endpoint is hit, or in `track()` mock if instrumented).

**Result**: `___`
**Notes**: ___ (transaction hash; explorer link)
**Artifact**: ___

---

### Step 5 — Tap "Play Arena" CTA from ProSheet active state

**Pre-conditions**: Step 4 passed (PRO active) OR Step 2 with already-active PRO.

**Action**: tap the "Play Arena" button inside the `pro-active-cta` block.

**Expected**:
- Browser navigates to `/arena`.
- ProSheet closes (or unmounts with the route change).
- Arena page renders (entry panel / soft-gate or active match — depends on prior state).
- No errors in console; no double-render.

**Result**: `___`
**Notes**: ___
**Artifact**: ___ (URL bar screenshot + arena page screenshot)

---

### Step 6 — Coach discoverability post-Arena match

**Pre-conditions**: Step 5 passed; user is on `/arena`. `ENABLE_COACH !== "false"` (otherwise this step is `n/a`).

**Action**:
1. Pick a difficulty (Easy is the recommended pre-selection per project memory).
2. Play a full match against the AI to a terminal state (mate / stalemate / resign).
3. Look for the Coach surface post-game.

**Expected**:
- After the match ends, the Arena page's `coachPhase` flips from `idle` to either `welcome` (first time) or `loading` (subsequent Coach analysis with credits).
- Coach surface (`<CoachWelcome />` / `<CoachLoading />` / `<CoachPanel />` / `<CoachPaywall />`) renders.
- The user has a clear path: "Analyze game" or "Get more credits" or similar.
- If `coachPhase === "paywall"` and user has PRO active, paywall should NOT block (PRO bypasses Coach credit consumption per `PRO_COPY.perksActive[0]`).

**Result**: `___`
**Notes**: ___ (which coach phase mounted; whether PRO bypassed paywall)
**Artifact**: ___

---

### Step 7 — Daily Tactic legality

**Pre-conditions**: any. Independent of PRO state.

**Action**:
1. Navigate to `/hub` (close any open sheets).
2. Tap the Daily Tactic slot (left of board area).
3. Inspect the starting position.

**Expected**:
- DailyTacticSheet mounts. Header shows puzzle name (one of mt-001..mt-007) + "White to move, mate in one."
- Starting position is **legal**: opponent's king NOT pre-checked. Visually verify the black king is NOT under attack from any white piece on the board at start. (Specifically: mt-002 should have black king on g8 not h8; mt-005 should have white queen on a2 not a1; mt-007 should have white queen on g3 not f3; mt-004 should be the new K+Q vs K position with Qc8→Qc1.)
- Tapping the white piece → solution → checkmate. Tapping a wrong move → reset + hint.

**Result**: `___`
**Notes**: ___ (which puzzle showed; was the start position legal?)
**Artifact**: ___ (screenshot of starting position)

---

### Step 8 — Mini Arena no-freeze

**Pre-conditions**: a wallet with **12+ stars on rook** (per project memory, gates the Mini Arena bridge unlock). If no fixture wallet exists, this step may be `n/a` for fresh wallets — note it.

**Action**:
1. From `/hub` with the gated wallet, tap the Mini Arena bridge button (right side of board area).
2. MiniArenaSheet opens with K+R vs K setup.
3. Make first legal move with the white rook (e.g. `a1 → a4`).
4. Wait up to 1 second for the AI to respond.

**Expected**:
- Status flashes "thinking…" briefly.
- AI responds with a legal black king move within ~250ms.
- Move counter increments to 1/16.
- Player can make a second move.
- Game continues until mate / stalemate / par-exceeded.
- **Critically**: the board never freezes with the player unable to move (the P0-2 regression).

**Result**: `___`
**Notes**: ___ (AI response time; how many moves played before resolution)
**Artifact**: ___ (video if possible — freezes are easier to spot in video)

---

### Step 9 — Visual regression suite (re-confirm)

Re-run the agent's pre-check after manual steps to confirm none of the manual flows left lingering visual artifacts:

```bash
cd apps/web && pnpm test:e2e:visual
```

**Expected**: 3/3 pass. If a baseline now diffs because of a session leftover (e.g., localStorage stuck after wallet connect), debug separately — do NOT re-baseline without rationale.

**Result**: `___`
**Notes**: ___

---

## 4. Severity classification

When marking a step `fail`, classify:

| Severity | Definition | Smoke verdict |
|---|---|---|
| **Critical** | PRO purchase doesn't complete; on-chain state corrupt; payment fails silently; user loses money without product. | **NO push.** Fix sprint required. |
| **Major** | PRO purchase completes but post-purchase UX is dead (no CTA route works, ProSheet mounts wrong state, Coach unreachable). | **NO push.** Fix locally + repeat smoke. |
| **Minor** | Visual blemish, copy typo, race condition that resolves on retry. | **Push allowed**, file a follow-up. |
| **Blocked** | Cannot test (wallet env missing, contract not deployed on chosen network). | **NO push** until tested. Don't ship untested. |

---

## 5. Verdict — GO (with mid-smoke critical fix)

### Step-by-step results

| # | Step | Result | Notes |
|---|---|---|---|
| 1 | `/hub` clean | **pass** | Z1 anonymous "Guest", dock 5 items, no disclaimer (commit #3 visible). |
| 2 | Connect wallet → Z1 connected | **pass** | Wallet truncated `0xCc41…c2dD` in Z1 left cluster. PRO indicator initially MUTED (incorrect — see Step 3 root cause). |
| 3 | Open ProSheet, see active CTA | **fail → fixed** | Sheet opened in INACTIVE state despite a confirmed on-chain PRO purchase tx earlier the same day. Diagnosed mid-smoke as **CRITICAL**: verify-pro server-side ABI mismatch (see §6). |
| 4 | Buy PRO + verify on-chain | **n/a (already purchased)** + **re-purchased post-fix** | Original tx `0x60150fcffb86...` confirmed on celoscan: $1.99 USDm to Shop contract `0x24846C77...`, ItemPurchased event with itemId 6. Server-side verify-pro silently rejected. After fix, manual verify-pro fetch succeeded → Redis written → PRO active. Then a SECOND fresh purchase from MiniPay (post-deploy) flowed automatically to PRO active without manual intervention. |
| 5 | Tap "Play Arena" CTA | **pass** | After fix + Redis active, ProSheet rendered the new active-state block with the "Play Arena" button. Tap navigated to `/arena`. |
| 6 | Coach discoverability post-match | **pass with note** | Coach surface mounts on `/arena` post-game per spec. **Open follow-up**: signposting during the match for "Coach will appear after this game" is missing — user discovers it accidentally (covered in §7 follow-ups). |
| 7 | Daily Tactic legality | **pass** | Today's puzzle (mt-006 "Smothered mate") starts with a legal position. The 4 repaired puzzles (mt-002, mt-005, mt-007, mt-004) hash-mod into the rotation correctly. |
| 8 | Mini Arena no-freeze | **pass** | K+R vs K completed in 9 moves, "Dentro del objetivo (16)". AI responded after each player move; no freeze. Confirms commit #4 fix is live in real runtime. |
| 9 | Visual regression re-run | **pass** | 3/3 baselines green pre and post the verify-pro fix (UI surface unchanged by API-only fix). |

### Critical bug discovered + fixed mid-smoke

`/api/verify-pro` rejected legitimate on-chain PRO purchases with `400 "No PRO purchase found in transaction"` — see §6 root cause. Fixed in commit `4c8748f`, pushed to `origin/main`, Vercel redeployed, validated end-to-end with a fresh MiniPay purchase.

### Final verdict

**GO.**

- All 14 sprint commits are now safely on `main` (5 sprint + 1 hot fix + docs).
- Verify-pro fix `4c8748f` confirms working in production via two independent purchases (compensation via manual fetch + fresh purchase via MiniPay shell).
- Visual regression suite green pre and post.
- Unit suite 595/595 + tsc clean.

**Tester**: Wolfcito.
**Completed**: 2026-05-02 23:30 UTC.

---

## 6. Critical bug root cause + lesson

`/api/verify-pro` ItemPurchased event ABI declared `token` as non-indexed:

```ts
{ name: "token", type: "address", indexed: false },  // ← WRONG
```

But the on-chain `ShopUpgradeable.sol` emits `address indexed token` as the 3rd indexed param (lives in `topics[3]`, not data). The keccak256 of the function signature ignores `indexed`, so the log filter passed (topics[0] match), but viem's data-tail decode threw:

```
Data size of 128 bytes is too small for non-indexed event parameters.
Params: (uint256 quantity, uint256 unitPriceUsd6, uint256 totalAmount, address token, address treasury)
```

The exception was caught silently by the per-log `try/catch { continue }` in the decode loop. `foundProPurchase` stayed false. Server returned 400. Redis was never written. UI stayed in inactive state.

**Symptom for the user**: paid $1.99 on-chain (transferred to treasury), saw "PRO Active" UI confirmation in MiniPay momentarily, but on next reload the chip showed inactive and ProSheet asked to buy again. From the user's perspective: lost money, no product.

### Lessons for the future

1. **Server-side ABI for decoding ON-CHAIN events MUST be derived from the contract source, not authored by hand.** The mismatch between source and verifier ABI was structural — same arity, same types, same signature hash, only the `indexed` flag differed. Hand-authored ABIs are a recurring footgun.
2. **Silent catches around event decode hide critical bugs.** The original `try { ... decode ... } catch { continue; }` swallowed a real error class. Replace with explicit error logging at minimum (deferred — see follow-up: observability instrumentation on route handlers).
3. **No visual feedback on failed mint paths.** Per Wolfcito's observation: the user got `kind: "verify-failed"` from `executeProPurchase` but the UI did not render that branch visibly enough to drive a retry. Follow-up: surface verify-failed as a clear retry CTA with "we already have your tx — retry will not double-charge."
4. **Free-tier Vercel logs hide runtime errors.** Diagnosis required a temporary 400-response payload patch ("diagnostic mode") that was reverted in the same fix commit. Sentry or equivalent would have surfaced this in seconds.

These four points are folded into the follow-ups in §7.

---

## 7. Follow-ups (queued for next sprint)

User-observed during smoke + post-fix review:

1. **PRO inactive chip visibility** — the spec §8 P1-2 muted treatment (`text-white/40 ring-1 ring-inset ring-white/15 bg-transparent`) reads as invisible against the candy-green background in real mobile rendering. Needs a redesign that's visible without becoming a CTA. Probable: defined border + light fill, no gradient.
2. **Coach signposting / discoverability** — the new active-state CTA helper text says "After your match, PRO unlocks Coach analysis" but the `/arena` flow gives zero in-match indication that Coach will surface post-game. Add affordances during the match (HUD-level hint, post-game banner with explicit CTA).
3. **Free → PRO content tier** — completing 15/15 stars on a piece in `/hub` shows only "REINTENTAR". No additional content path. Needs tier separation: free ladder gets pieces 1-N, PRO unlocks deeper labyrinths / additional pieces / mastery challenges. Ties business model to active perks list which today only mentions "AI Coach with no daily limit + contribution to free tier" (anemic).
4. **Business model clarity** — `PRO_COPY.perksActive` is too thin; `perksRoadmap` lists 4 future items but none is active. Decide the v1 PRO value bundle (Coach + ? + ?) and reflect in copy.
5. **Server observability** — verify-pro silent-catch hid the ABI bug for an unknown number of MiniPay users. Add structured logging + Sentry-equivalent on the route handlers — at minimum on the catch branches.
6. **`executeProPurchase` verify-failed UX** — when verify-pro returns non-200, the client surfaces it as `kind: "verify-failed"` but the UI doesn't render a retry CTA visibly enough. User loses trust.
7. **ABI automation** — generate verifier ABIs from the contract source (e.g., a build step that emits `lib/contracts/*-event-abi.ts` from Hardhat artifacts). Stops hand-authored mismatches like the one fixed today.
8. **Debug script + screenshots cleanup** — `apps/web/scripts/check-pro.ts` was a one-off diagnostic; remove. `errors/` folder of mobile screenshots should be gitignored if kept locally.

Phase 2 layout primitives (Z4 `<ContextualActionRail />`, per-screen Z1 migration, ProChip delete) remain HALTED pending these follow-ups.

---

## 8. Notes / open questions surfaced during smoke

- USDm = cUSD renamed by Mento on the same `0x765de816...` contract. Initially I diagnosed this as a token-whitelist miss; verifying the celoscan address proved the whitelist was correct, the bug was elsewhere.
- MiniPay shell does not expose DevTools; debugging required Chrome desktop on the same deployed URL to use Network tab + console.
- Vercel free tier does not expose runtime function logs; diagnosed via temporary 400-payload patch that was reverted in the fix commit.
- `pnpm tsx` not installed locally; `npx -y tsx` also failed in user's shell (PATH issue). Fall-back was DevTools console fetch — turned out to be the better path anyway since it hits the deployed endpoint directly.
- Visual capture suite only generates PNGs without comparison; still useful for manual review of mobile-shell-only states the regression suite can't reach.

— Wolfcito (tester) + agent (pre-checks + diagnosis)
