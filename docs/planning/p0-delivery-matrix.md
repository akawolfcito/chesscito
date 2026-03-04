# P0 Delivery Matrix

## PR Sequence
1. `pr/m0-app-skeleton-routes`
2. `pr/m0-minipay-gate-readme`
3. `pr/m0-submission-placeholders`
4. `pr/m1-board-renderer`
5. `pr/m1-rook-rules-engine`
6. `pr/m1-rook-tutorial`
7. `pr/m1-rook-challenge`
8. `pr/m2-scoreboard-contract`
9. `pr/m2-badges-contract`
10. `pr/m2-submit-score-web`
11. `pr/m2-claim-badge-web`
12. `pr/m3-leaderboard-v1`
13. `pr/m3-share-card`
14. `pr/m3-demo-video-script`
15. `pr/m3-deck`
16. `pr/m3-karma-gap-finalize`

## P0 Issues

### #1 Define App Skeleton + Routes
- Files to touch:
  - `apps/web/src/app/layout.tsx`
  - `apps/web/src/app/page.tsx`
  - `apps/web/src/app/levels/page.tsx`
  - `apps/web/src/app/play/[piece]/page.tsx`
  - `apps/web/src/app/result/page.tsx`
  - `apps/web/src/app/leaderboard/page.tsx`
  - `apps/web/src/app/globals.css`
  - `apps/web/tailwind.config.js`
- Risks:
  - Route scaffolding can leak placeholder UX into gameplay PRs.
  - Mobile layout can break if desktop-first spacing remains.
- MiniPay validation:
  - Open each route inside MiniPay on a real device.
  - Confirm no viewport overflow at roughly `390x844`.

### #2 MiniPay Compatibility Gate
- Files to touch:
  - `apps/web/src/components/wallet-provider.tsx`
  - `apps/web/src/components/connect-button.tsx`
  - `apps/web/src/components/navbar.tsx`
  - `apps/web/src/lib/minipay.ts` (new)
  - `README.md`
- Risks:
  - Accessing `window` during SSR can crash the app.
  - Wallet prompts can become redundant inside MiniPay.
- MiniPay validation:
  - Load the app via MiniPay Developer Mode on a phone.
  - Confirm the app does not show a redundant connect button.
  - Confirm a normal browser still shows wallet connect when needed.

### #3 Create Karma GAP project placeholder + repo public
- Files to touch:
  - `README.md`
  - `docs/submission/deck-outline.md`
  - `docs/submission/demo-video-script.md`
  - `docs/submission/karma-gap-checklist.md` (new)
- Risks:
  - Submission links can drift if there is no single source of truth.
- MiniPay validation:
  - None required beyond ensuring the live demo placeholder points to the MiniPay deployment target.

### #5 Board Renderer + Coordinate System
- Files to touch:
  - `apps/web/src/components/board.tsx` (new)
  - `apps/web/src/components/board-square.tsx` (new)
  - `apps/web/src/lib/game/board.ts` (new)
  - `apps/web/src/lib/game/types.ts` (new)
  - `apps/web/src/app/play/[piece]/page.tsx`
- Risks:
  - Tap targets may be too small on device.
  - Coordinate transforms can invert ranks/files on mobile rendering.
- MiniPay validation:
  - Test repeated taps and move highlights on a phone.
  - Confirm the board remains fully visible without zoom.

### #6 Rules Engine: Torre Moves
- Files to touch:
  - `apps/web/src/lib/game/rules/rook.ts` (new)
  - `apps/web/src/lib/game/board.ts`
  - `apps/web/src/lib/game/__tests__/rook.test.ts` (new)
  - `apps/web/package.json` if a test runner is added
- Risks:
  - Rule logic can become coupled to UI state.
  - Blocking rules can be incorrectly skipped when obstacles are introduced.
- MiniPay validation:
  - Not MiniPay-specific; validate by playing the Tower level inside MiniPay after merge.

### #7 Level: Cinematica Torre (tutorial)
- Files to touch:
  - `apps/web/src/app/play/[piece]/page.tsx`
  - `apps/web/src/components/tutorial-panel.tsx` (new)
  - `apps/web/src/lib/levels/rook-tutorial.ts` (new)
- Risks:
  - Tutorial copy can become too long for the mobile viewport.
  - Hint overlays can block taps on the board.
- MiniPay validation:
  - Confirm hints and CTA are readable inside MiniPay.
  - Confirm transition into challenge mode is smooth on device.

### #8 Challenge: Captura con Torres
- Files to touch:
  - `apps/web/src/app/play/[piece]/page.tsx`
  - `apps/web/src/lib/levels/rook-challenge.ts` (new)
  - `apps/web/src/lib/game/session.ts` (new)
  - `apps/web/src/app/result/page.tsx`
- Risks:
  - Result payload can be lost across route transitions.
  - Retry logic can leave stale board state behind.
- MiniPay validation:
  - Complete and fail the challenge on device.
  - Confirm retry resets state without reload.

### #9 Contract: Scoreboard (event-based)
- Files to touch:
  - `apps/contracts/contracts/Scoreboard.sol` (new)
  - `apps/contracts/test/Scoreboard.ts` (new)
  - `apps/contracts/ignition/modules/Scoreboard.ts` (new)
  - `apps/contracts/hardhat.config.ts`
  - `apps/contracts/.env.example`
- Risks:
  - Anti-spam logic can over-constrain legitimate submissions.
  - Event schema changes will break leaderboard parsing later.
- MiniPay validation:
  - Deploy to Sepolia first and submit from MiniPay on a real phone.
  - Confirm emitted event fields match the UI parsing assumptions.

### #10 Contract: Badges ERC-1155
- Files to touch:
  - `apps/contracts/contracts/Badges.sol` (new)
  - `apps/contracts/test/Badges.ts` (new)
  - `apps/contracts/ignition/modules/Badges.ts` (new)
  - `apps/contracts/.env.example`
- Risks:
  - Badge claim rules can drift from score eligibility logic.
  - URI design can block metadata publishing later.
- MiniPay validation:
  - Claim from MiniPay on a phone after testnet deploy.
  - Confirm second claim attempt is rejected cleanly.

### #11 Integrate submitScore tx (MiniPay)
- Files to touch:
  - `apps/web/src/app/result/page.tsx`
  - `apps/web/src/components/submit-score-button.tsx` (new)
  - `apps/web/src/lib/contracts/scoreboard.ts` (new)
  - `apps/web/src/lib/minipay.ts`
  - `apps/web/src/components/wallet-provider.tsx`
- Risks:
  - Accidentally sending EIP-1559 fields will degrade MiniPay compatibility.
  - Unsupported `feeCurrency` values can cause confusing failures.
- MiniPay validation:
  - Use a real MiniPay device on Sepolia, then on Mainnet.
  - Confirm pending, success, and error states.
  - Confirm transaction hash is visible and copyable.

### #12 Integrate claimBadge tx (MiniPay)
- Files to touch:
  - `apps/web/src/app/result/page.tsx`
  - `apps/web/src/components/claim-badge-button.tsx` (new)
  - `apps/web/src/lib/contracts/badges.ts` (new)
  - `apps/web/src/lib/minipay.ts`
- Risks:
  - Claimed state can desync from on-chain truth.
  - Duplicate claim attempts can present poor UX if revert messages are not surfaced.
- MiniPay validation:
  - Claim once on a real device.
  - Reload the result screen and confirm claimed state persists.

### #14 Leaderboard v1 (read events)
- Files to touch:
  - `apps/web/src/app/api/leaderboard/route.ts` (new)
  - `apps/web/src/app/leaderboard/page.tsx`
  - `apps/web/src/lib/contracts/scoreboard.ts`
  - `apps/web/src/lib/leaderboard.ts` (new)
- Risks:
  - RPC log scans can get expensive without block-range discipline.
  - Sorting rules can create inconsistent ties if not specified.
- MiniPay validation:
  - Open `/leaderboard` inside MiniPay and confirm it renders from live chain data.
  - Verify cached refresh behavior does not stale too long after a fresh score submit.

### #15 Share Card (result screenshotable)
- Files to touch:
  - `apps/web/src/app/result/page.tsx`
  - `apps/web/src/components/share-card.tsx` (new)
  - `apps/web/src/lib/share.ts` (new)
- Risks:
  - Card height can exceed screen capture bounds.
  - Permalink state can drift from actual result data if encoded poorly.
- MiniPay validation:
  - Capture a screenshot inside MiniPay and confirm legibility.
  - Test the copied permalink on mobile.

### #16 Demo Video Script + Recording Checklist
- Files to touch:
  - `docs/submission/demo-video-script.md`
  - `README.md`
- Risks:
  - Script can drift from the actual shipped product.
- MiniPay validation:
  - Dry-run the full flow on a phone before recording.

### #17 Deck (8-10 slides)
- Files to touch:
  - `docs/submission/deck-outline.md`
  - `README.md`
- Risks:
  - Messaging can over-promise if it is not aligned with shipped scope.
- MiniPay validation:
  - Include only flows already validated on device.

### #18 Karma GAP Finalize
- Files to touch:
  - `README.md`
  - `docs/submission/karma-gap-checklist.md` (new)
- Risks:
  - Final links can be inconsistent across README, deck, and Karma GAP.
- MiniPay validation:
  - Final live URL must be the same URL validated in MiniPay on a real device.
