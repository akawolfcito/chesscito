## Session Plan — 2026-03-27: Systems & Content Expansion

### Phase
Systems & Content Expansion — adding depth, progression, and data infrastructure.
Re-Architecture + UI Pro Phase 1 are formally closed.

### Current State
- ✅ **Completed**: PR-2 Supabase bootstrap (schema, client, types, migration)
- 🚧 **In Progress**: PR-1 (6-piece types) next up
- ⚠️ **Blockers**: PR-4 (score re-submission) requires contract verification

### Next Steps (Prioritized)
1. **PR-1: 6-piece foundation** — S — extend PieceId, editorial, images
2. **PR-3: Pawn exercises** — M — 5 exercises with forward-only validation
3. **PR-4: Score re-submission** — M — remove markCompleted, add Improve Score
4. **PR-5: Unlock gating** — S — sequential piece unlock via badges
5. **PR-6: Queen exercises** — S — 5 exercises reusing Rook+Bishop
6. **PR-7: Practice move logging** — M — write to Supabase on completion
7. **PR-8: Hall performance** — M — incremental scan + Supabase materialization
8. **PR-9: King exercises** — M — single-step + castling demo
9. **PR-10: Coach for Practice** — L — LLM analysis of logged moves
10. **PR-11: Global progress** — S — stars counter + unlock celebration

### Key Decisions
- Supabase = derived data only, on-chain remains source of truth
- Server-side only (no NEXT_PUBLIC_ vars)
- Graceful degradation if Supabase unavailable
- 5 tables: practice_runs, practice_move_logs, coach_summaries, player_progress_snapshots, hall_victory_index

---

## Session Plan — 2026-03-26: Practice Hub Re-Architecture

### Summary
Re-architecture of the main play-hub screen based on approved v2 UX proposal.
Full spec: `docs/superpowers/plans/2026-03-26-practice-hub-rearchitecture.md`

### Current State
- ✅ **Completed**: UX diagnosis, v1 proposal, v2 "approved with adjustments", implementation spec written
- 🚧 **In Progress**: Ready to begin PR1
- ⚠️ **Blockers**: None
- 🔧 **Tech Debt**: 9 hardcoded `#0a1424` values, 48 raw `<button>` elements (out of scope)

### Next Steps (Prioritized)

#### Priority 1: Critical (P0)
1. **PR1: Dock semantics + active routing** — S
   - Files: `editorial.ts`, `persistent-dock.tsx`
   - Acceptance: Dock reads "Practice", links to `/`, active state wired
2. **PR2: Eliminate utility band + redistribute** — M
   - Files: `mission-panel.tsx`, `page.tsx`, `exercise-drawer.tsx`
   - Acceptance: No utility band, Lv beside rail, stars in stats bar, HelpCircle icon

#### Priority 2: High (P1)
3. **PR3: Piece selector state simplification** — S
   - Files: `globals.css`
   - Acceptance: No border/border-radius on `.piece-hero`, subtler glow
4. **PR4: Opacity + spacing tuning** — S
   - Files: `globals.css`, `mission-panel.tsx`
   - Acceptance: Dock 0.55, inactive tabs 0.45, board mt-1, label h-auto

#### Priority 3: Validation
5. **PR5: MiniPay QA** — S
   - 7 states screenshotted, before/after comparison
   - Decides whether dock slot reorder is needed in future pass

### Key Decisions (Locked)
- Screen = Practice Hub (not Home/Arena)
- Dock center = "Practice" (new `DOCK_LABELS` constant, NOT `ARENA_COPY.title` mutation)
- Zero new assets — CSS/layout only
- Dock slots: no reorder in this pass

---

## Session Plan — 2026-03-18: Victory Screen Refactor (Claim → Share)

### Spec Summary
Refactor the victory modal from the current 3-phase mint-oriented flow (`idle → minting → minted`)
to a 4-state claim-oriented flow (`ready → claiming → success → error`) + `shareStatus` track.

**Core mental model**: `I won → I claim my victory onchain → my share card is unlocked`

### Current Architecture (what exists)
```
ArenaEndState (orchestrator)
├─ VictoryCelebration  (idle + win)     → trophy, stats, Play Again, Mint Victory, Share, Back
├─ VictoryMinting      (minting)        → sparkles loading, "Minting your victory..."
└─ VictoryReceipt      (minted)         → wolf icon, "Victory #N Minted!", Share, Play Again, Back
```
- State: `MintPhase = "idle" | "minting" | "minted"` (3 states, no error state)
- Mint logic: monolithic `handleMintVictory()` in `arena/page.tsx` (~90 lines)
- Copy: `VICTORY_MINT_COPY` + `VICTORY_CELEBRATION_COPY` in `editorial.ts`
- Share: `ShareButton` component (navigator.share → clipboard fallback), shown in all states

### Target Architecture (what we're building)
```
ArenaEndState (orchestrator, same file)
├─ VictoryCelebration  (WIN_READY)      → trophy, stats, Play Again, Claim Victory, helper text, Back
├─ VictoryClaiming     (CLAIMING)       → same card layout, claiming animation, progress text
├─ VictoryClaimSuccess (CLAIM_SUCCESS)  → "Victory Recorded", share card area unlocked, social row
└─ VictoryClaimError   (CLAIM_ERROR)    → error message, Try Again, Back
```
- State: `ClaimPhase = "WIN_READY" | "CLAIMING" | "CLAIM_SUCCESS" | "CLAIM_ERROR"`
- Rename: "Mint" → "Claim" everywhere in UX (contract call stays the same)
- Share: ONLY unlocked after successful claim (not before)
- Social row: Share Card (primary), Share to X, Share to WhatsApp, Copy Link, Download Card
- Victory Card: placeholder system for future social OG card

### Implementation Plan — 7 Steps

#### Step 1: Types & Copy (SDD) — S
**Files**: `editorial.ts`, `arena-end-state.tsx`
**Changes**:
- Replace `MintPhase` type with `ClaimPhase = "WIN_READY" | "CLAIMING" | "CLAIM_SUCCESS" | "CLAIM_ERROR"`
- Replace `VICTORY_MINT_COPY` with `VICTORY_CLAIM_COPY`:
  ```
  claimButton: "Claim Victory"
  claimHelper: "Record this win onchain to unlock your share card"
  claiming: "Claiming Victory..."
  claimProgress1: "Recording your result onchain"
  claimProgress2: "Preparing your victory card"
  claimSuccessTitle: "Victory Recorded"
  claimSuccessSubtitle: "Your onchain result is live. Your share card is ready."
  claimErrorTitle: "Couldn't record victory"
  claimErrorSubtitle: "Something went wrong while saving your result onchain."
  tryAgain: "Try Again"
  shareCard: "Share Card"
  shareToX: "Share to X"
  shareToWhatsApp: "Share to WhatsApp"
  copyLink: "Copy Link"
  downloadCard: "Download Card"
  ```
- Update `VICTORY_CELEBRATION_COPY`: remove `shareVictory`, `mintingMessage`, `mintedTitle/Subtitle`
- Add placeholder data type:
  ```ts
  type VictoryClaimData = {
    tokenId: bigint | null;
    claimTxHash: string | null;
    // Future placeholders:
    // shareCardUrl: string | null;
    // shareLinkUrl: string | null;
    // ogImageUrl: string | null;
  }
  ```
**Acceptance**: Types compile, copy constants defined, no UI changes yet

#### Step 2: ArenaEndState orchestrator refactor — S
**Files**: `arena-end-state.tsx`
**Changes**:
- Replace `MintPhase` with `ClaimPhase` in Props type
- Add `claimTxHash?: string | null` to Props
- Route to 4 components based on `claimPhase`:
  - `WIN_READY` → `VictoryCelebration` (renamed props: `onClaimVictory` instead of `onMintVictory`)
  - `CLAIMING` → `VictoryClaiming` (new component, replaces `VictoryMinting`)
  - `CLAIM_SUCCESS` → `VictoryClaimSuccess` (new component, replaces `VictoryReceipt`)
  - `CLAIM_ERROR` → `VictoryClaimError` (new component)
- Loss modal stays unchanged
**Acceptance**: Orchestrator routes correctly, old components still render temporarily

#### Step 3: VictoryCelebration (WIN_READY) — M
**Files**: `victory-celebration.tsx`
**Changes**:
- Remove `ShareButton` — no share before claim
- Rename `onMintVictory` → `onClaimVictory`, `mintPrice` → `claimPrice`, `mintError` removed
- Button hierarchy:
  1. **Play Again** (primary, cyan gradient — unchanged)
  2. **Claim Victory — $X.XX** (secondary, important but below primary)
     - Style: filled muted teal/emerald, NOT amber (amber = minted state)
     - Must NOT look disabled — communicates value
  3. **Helper text**: "Record this win onchain to unlock your share card"
  4. **Back to Hub** (tertiary, text button, centered, horizontal, clean)
- Keep: trophy Lottie, title "Victory", performance line, 3 stat cards
**Acceptance**: No share button visible, claim button prominent, helper text clear

#### Step 4: VictoryClaiming (CLAIMING) — S
**Files**: `victory-claiming.tsx` (new, replaces `victory-minting.tsx`)
**Changes**:
- Same card layout as WIN_READY (not a totally different modal)
- Keep trophy + stats visible (don't reset the layout)
- Replace CTA area with:
  - **Claiming Victory...** (disabled button with spinner/pulse)
  - Progress text lines:
    - "Recording your result onchain"
    - "Preparing your victory card"
  - Play Again hidden or disabled
  - Back to Hub optionally visible (only if cancel doesn't break flow)
- Delete `victory-minting.tsx` after
**Acceptance**: Smooth transition from WIN_READY, no layout jump, progress feedback visible

#### Step 5: VictoryClaimSuccess (CLAIM_SUCCESS) — M
**Files**: `victory-claim-success.tsx` (new, replaces `victory-receipt.tsx`)
**Changes**:
- Title: "Victory Recorded"
- Subtitle: "Your onchain result is live. Your share card is ready."
- Trophy/stats stay visible (reward state, not reset)
- Share area (unlocked reward block):
  1. **Share Card** (primary, amber gradient — this is THE reward)
  2. Social actions row:
     - Share to X
     - Share to WhatsApp
     - Copy Link
     - Download Card
  3. **Play Again** (secondary, cyan)
  4. **Back to Hub** (tertiary text)
- `ShareButton` component: extend with platform-specific share targets (X, WhatsApp, generic)
- Placeholder: victory card URL derivation from `tokenId` + `claimTxHash`
- Delete `victory-receipt.tsx` after
**Acceptance**: Share unlocked only here, social row visible, feels like reward state

#### Step 6: VictoryClaimError (CLAIM_ERROR) — S
**Files**: `victory-claim-error.tsx` (new)
**Changes**:
- Title: "Couldn't record victory"
- Subtitle: "Something went wrong while saving your result onchain."
- CTAs:
  1. **Try Again** (primary, cyan)
  2. **Back to Hub** (secondary)
  3. Play Again (optional tertiary)
- Keep trophy + stats visible (context retention)
**Acceptance**: Error state reachable, Try Again works, Back to Hub works

#### Step 7: arena/page.tsx state migration — M
**Files**: `arena/page.tsx`
**Changes**:
- Replace `mintPhase` state with `claimPhase: ClaimPhase` (init: `"WIN_READY"`)
- Add `claimTxHash` state
- Rename `handleMintVictory` → `handleClaimVictory`:
  - On start: `setClaimPhase("CLAIMING")`
  - On success: `setClaimPhase("CLAIM_SUCCESS")`, save `claimTxHash` from receipt
  - On error: `setClaimPhase("CLAIM_ERROR")` (NOT back to WIN_READY)
  - On user reject: back to `WIN_READY` (cancel, not error)
- `handlePlayAgain`: reset to `WIN_READY`
- Wire `onRetry` from CLAIM_ERROR → re-call `handleClaimVictory`
- Pass new props to `ArenaEndState`
**Acceptance**: Full flow works: WIN_READY → CLAIMING → CLAIM_SUCCESS, error recovery works

### Files Modified (summary)
| File | Action |
|---|---|
| `lib/content/editorial.ts` | Replace copy constants |
| `components/arena/arena-end-state.tsx` | New type + routing |
| `components/arena/victory-celebration.tsx` | Remove share, rename mint→claim |
| `components/arena/victory-minting.tsx` | **DELETE** |
| `components/arena/victory-claiming.tsx` | **NEW** |
| `components/arena/victory-receipt.tsx` | **DELETE** |
| `components/arena/victory-claim-success.tsx` | **NEW** |
| `components/arena/victory-claim-error.tsx` | **NEW** |
| `app/arena/page.tsx` | State migration mint→claim |

### Out of Scope (future)
- Victory Card image generation (backend/canvas)
- OG meta tags for share links
- Social platform API integrations
- Download Card as image export
- `shareCardUrl`, `shareLinkUrl`, `ogImageUrl` resolution
- These all get **placeholders** now, implementation later

### Risks
- **Low**: Contract call is the same (`mintSigned`), only UX naming changes
- **Low**: No new dependencies needed
- **Medium**: Social share row needs careful mobile layout testing at 390px
- **None**: Loss modal is untouched

### Key Decisions
- **"Claim Victory" over "Record Victory"**: game-native, more valuable feeling
- **Amber = success/reward state only**: WIN_READY uses teal/emerald for claim button
- **Share blocked pre-claim**: intentional friction → makes claim feel valuable
- **CLAIM_ERROR as explicit state**: no silent fallback to WIN_READY on errors
- **Same card layout across states**: no violent layout shifts, just bottom section changes

---

## Session Plan — 2026-03-17

### Current State
- ✅ **Completed**: Victory NFT full pipeline (contract + API + frontend + deploy mainnet), engine migration (Stockfish→js-chess-engine), 8 audit fixes, PR #52 merged
- 🚧 **In Progress**: Nothing uncommitted — clean working tree
- ⚠️ **Blockers**: None
- 🔧 **Tech Debt**: Rate limiter in-memory (needs Redis), game stats self-reported (needs session proof for v2)

### Project Context
- **Type**: Web + Smart Contracts (monorepo)
- **Stack**: Next.js 14, TypeScript, Tailwind, Hardhat, Solidity, wagmi/viem, chess.js, js-chess-engine
- **Testing**: 114 tests passing (30 contract + 42 web + game tests)
- **Deploy**: Celo Mainnet + Sepolia, MiniPay distribution

### Next Steps (Prioritized)

#### Priority 1: Critical
1. **QA Victory NFT mint flow on mainnet** — S
   - **Why**: Contract is deployed but never manually tested end-to-end in browser
   - **Acceptance**: Win arena game → mint button appears → approve ERC-20 → mint tx succeeds → NFT visible
   - **Notes**: Requires wallet with CELO + stablecoin on mainnet; set `NEXT_PUBLIC_VICTORY_NFT_ADDRESS` in `.env`

#### Priority 2: High
2. **Add `NEXT_PUBLIC_VICTORY_NFT_ADDRESS` to `.env.mainnet`** — S
   - **Why**: Mainnet env isn't configured for Victory NFT yet
   - **Acceptance**: `0x0eE22F830a99e7a67079018670711C0F94Abeeb0` present in `.env.mainnet`

3. **Migrate rate limiter to Upstash Redis** — M
   - **Why**: In-memory rate limiter resets on serverless cold starts, defeating its purpose
   - **Acceptance**: `/api/sign-victory` rate limits persist across deploys
   - **Notes**: Consider Upstash SDK (serverless-friendly, free tier)

#### Priority 3: Medium
4. **#23 Achievements + VIP roadmap** — L
   - **Description**: Achievement system with VIP passes for CELO events
   - **Dependencies**: Victory NFT QA should be done first
   - **Notes**: P2 issue, open since 2026-03-04

5. **Game session proof (v2 security)** — L
   - **Description**: Server-side game session verification to prevent self-reported stats
   - **Why**: Required before prize pool distribution can be trusted
   - **Notes**: Could use commit-reveal or signed game state

#### Priority 4: Low
6. **Timer mode** — M
   - **Description**: Timed chess games in arena
7. **Play-as-black** — M
   - **Description**: Option to play black pieces in arena
8. **Move animations** — S
   - **Description**: Animate piece movement on the board
9. **Game persistence** — M
   - **Description**: Save/resume incomplete games
10. **Owner key → multisig** — S
    - **Description**: Upgrade contract owner to Safe multisig before high-value ops

### Key Decisions
- **Engine**: js-chess-engine (30KB JS) over Stockfish WASM (2.5MB) — MiniPay compatibility wins
- **Victory NFT pricing**: Micro-fees ($0.005–$0.02) make self-reported stats acceptable for v1
- **Fee split**: 80/20 treasury/prize hardcoded in contract — simple, transparent

### Notes for Next Session
- `SESSION.md` (untracked) has full handoff notes from 2026-03-17
- `deployments/celo.json` exists locally only (gitignored) with all mainnet addresses
- 114 tests passing — run `pnpm test` in apps/web and `npx hardhat test` in apps/contracts

---

## Session — 2026-03-13

### Completed This Session
- ✅ #19 Passport gating — closed (works on web; chain limitation in MiniPay accepted)
- ✅ Share Card — confirmed already implemented
- ✅ Demo Video — Remotion promo video implemented (apps/video, 7 commits, 20.5s MP4)
  - 4 scenes: Splash, Pieces Showcase, Board+Badge, CTA Outro
  - TransitionSeries with fade transitions
  - Output: `apps/video/out/chesscito-promo.mp4` (7.7 MB, 1080x1920)

### Open Issues
- #23 Achievements + VIP roadmap (P2) — not started

---

## Session Plan — 2026-03-10 (session 2)

### Completed
- ✅ #7 Cinematica Torre — first-visit rook tutorial with lane highlights + frosted banner (4 commits)
- ✅ #8 Captura con Torres — capture exercises for rook 4-5 with warm target indicator (4 commits)
- ✅ #20 Shop v1: Retry Shield — consumable (3 uses/purchase), PhaseFlash shield button (6 commits)
- ✅ Closed issues #7, #8, #20
- ✅ #19 Passport gating — design approved, design doc committed

---

## Session Plan — 2026-03-10 (session 1)

### Completed
- ✅ UX overhaul: 3-zone floating HUD layout (pushed)
- ✅ BadgeSheet collection component with batched reads (pushed)
- ✅ BadgeAlreadyClaimed error handling
- ✅ On-chain verification: rook badge confirmed claimed for MiniPay wallet

---

## Session — 2026-03-09

### Completed
- ✅ GitHub housekeeping: closed #22, #21, #14, #13, #10, #9, #4, #3
- ✅ Visual polish fixes (stars bar, time format, sheet overlay, leaderboard i18n)
