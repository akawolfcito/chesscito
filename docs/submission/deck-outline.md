# Deck Outline

## Slide 1 — Title
- Chesscito
- MiniPay MiniApp for cognitive enrichment through pre-chess mini-games
- Team, repo, live demo URL

## Slide 2 — Problem
- Mobile users need short, measurable cognitive play loops
- Existing chess learning flows are too heavy for casual daily use
- Buildathon angle: educational, fun, measurable, on-chain proof

## Slide 3 — Solution
- Short piece-based challenges
- Mobile-first MiniPay experience
- On-chain score proof and collectible progression

## Slide 4 — Product Demo
- Home
- Levels
- Tower tutorial
- Tower challenge
- Result screen

## Slide 5 — Why MiniPay
- Embedded wallet UX
- Celo fee abstraction support
- Natural fit for mobile-first micro-interactions

## Slide 6 — Architecture
- Next.js MiniApp frontend
- Hardhat contracts on Celo
- viem/wagmi transaction layer
- Event-based leaderboard API

## Slide 7 — On-chain Proof
- `submitScore(levelId, score, timeMs, nonce)`
- `claimBadge(levelId)`
- ERC-1155 badges
- Anti-spam and one-badge-per-wallet-per-level

## Slide 8 — Leaderboard + Retention Loop
- Top 10 leaderboard
- Shareable result card
- Daily return loop and future achievements

## Slide 9 — Traction / Validation
- Real-device MiniPay testing
- Mainnet deployment
- Demo metrics captured during playtests

## Slide 10 — Roadmap
- Bishop and Knight levels
- Passport-gated ranked rewards
- Shop and achievements
- Event-linked VIP perks
