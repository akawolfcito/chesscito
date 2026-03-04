# Chesscito Buildathon Backlog

## North Star
Ship a MiniPay MiniApp on Celo Mainnet with:
- Gameplay MVP for Tower first, then Bishop/Knight if time remains
- On-chain proof via `submitScore` and `claimBadge`
- Functional Top 10 leaderboard
- Submission pack: public repo, live demo, deck, demo video, Karma GAP

## Milestones

### M0 — Project Setup & Baseline
- Define app skeleton + routes
- MiniPay compatibility gate
- Submission placeholders in repo
- Stitch screen import plan

### M1 — Gameplay MVP (Tower)
- Board renderer + coordinates
- Tower rules engine
- Tutorial level
- Tower challenge

### M2 — On-chain Proof + Mainnet
- Scoreboard contract
- ERC-1155 badges contract
- Submit score tx in MiniPay
- Claim badge tx in MiniPay
- Mainnet deploy + live demo

### M3 — Leaderboard + Polish + Submission Pack
- Event-based leaderboard
- Share card
- Demo video
- Deck
- Karma GAP finalize

### M4 — Stretch
- Human.Passport gating
- Shop v0
- Bishop
- Knight
- Achievements roadmap

## PR Sequence
1. `pr/m0-app-skeleton-routes`
2. `pr/m0-minipay-gate-readme`
3. `pr/m1-board-renderer`
4. `pr/m1-rook-rules-and-tests`
5. `pr/m1-rook-tutorial-and-challenge`
6. `pr/m2-scoreboard-contract`
7. `pr/m2-badges-contract`
8. `pr/m2-submit-score-web`
9. `pr/m2-claim-badge-web`
10. `pr/m2-mainnet-deploy-config`
11. `pr/m3-leaderboard-api-ui`
12. `pr/m3-share-card`
13. `pr/m3-submission-pack`
14. `pr/m4-passport-gating`
15. `pr/m4-extra-pieces-and-extras`

## MiniPay Validation Rules
- Test only on a physical device.
- Enable Developer Mode and use Load Test Page.
- Use `ngrok` when testing localhost.
- Guard all wallet bootstrapping behind `window.provider` or `window.ethereum`.
- Assume legacy transactions only.
- Validate `feeCurrency` against the current supported stablecoin in the target environment before enabling it in UI.

## References
- Celo MiniPay quickstart: https://docs.celo.org/build/build-on-minipay/quickstart
- Celo ngrok setup: https://docs.celo.org/build/build-on-minipay/prerequisites/ngrok-setup
- Celo viem docs: https://docs.celo.org/developer/viem
