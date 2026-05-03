# PRO Smoke Test — 2026-05-02

> **Purpose**: Validate the PRO end-to-end business flow against the local stabilization-sprint state (HEAD = `dd7821e`). Smoke gates whether the 16 unpushed commits go to `origin`.
> **Method**: 3 automatable pre-checks (run by the agent) + 6 manual browser checks (run by Wolfcito with a wallet).
> **Hard rule**: NO `git push` until this doc reads "go" with all P0 steps green.

---

## 1. Environment

To be filled in BEFORE running the manual steps:

| Field | Value |
|---|---|
| Local HEAD | `dd7821e test(visual): add baseline visual regression suite` |
| Branch | `main` (16 commits ahead of `origin/main`) |
| Dev server URL | `http://localhost:3000` (or other if `next dev` chosen another port) |
| Network | (fill: Celo Sepolia testnet / Celo Mainnet) |
| Wallet address (last 6) | (fill: `…XXXXXX`) |
| Wallet token balance | (fill: USDC/USDT ≥ $2.50 to cover $1.99 PRO + gas; OR mock setup) |
| `NEXT_PUBLIC_ENABLE_COACH` | (fill: `true` / `false` / unset) |
| Browser | (fill: Chrome / Brave / MiniPay shell) |
| Date / Time (UTC) | (fill on run) |
| Tester | Wolfcito |

> Set the env values in `apps/web/.env.local` (or `.env.mainnet` per project memory). Do NOT screenshot or paste env values into this doc.

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

## 5. Verdict

> Fill in after all 9 manual steps complete.

| Outcome | Action |
|---|---|
| **GO** — all 9 steps pass (or only Minor failures with logged follow-ups) | `git push origin main` of all 16 commits. |
| **HOLD-MINOR** — 1+ Minor failures only | Fix locally, repeat smoke for affected steps, push when clean. |
| **HOLD-MAJOR** — any Major failure | Open a fix sprint. Document root cause + plan. NO push. |
| **HALT-CRITICAL** — any Critical failure | Same as HOLD-MAJOR + alert (rotate any compromised secrets if applicable). NO push under any condition. |

**Final verdict**: `___` (filled after run)

**Tester signature**: `___` (Wolfcito)

**Date completed**: `___`

---

## 6. Follow-ups (if smoke passes)

After GO and push, queue the next priorities:

- Phase 2 layout primitives resume (`<ContextualActionRail />` Z4 next per spec).
- Step 2 visual regression expansion (per `docs/reviews/visual-regression-plan-2026-05-02.md` §3 — 7 additional canonical states).
- ProSheet active-state visual baseline (needs wallet fixture in test environment).
- E2E baseline cleanup sprint (26 pre-existing failures per `docs/reviews/e2e-baseline-red-2026-05-02.md`).
- `onProTap` debt clock continues — `pro-tap-debt-due-by: 2026-07-01`.

If smoke fails, follow-ups go on hold.

---

## 7. Notes / open questions during smoke

> Append free-form observations during the run. Anything surprising goes here, not in the verdict.

- ___
- ___
- ___

— Wolfcito (tester) + agent (pre-checks)
