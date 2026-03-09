<div align="center">
  <img src="apps/web/public/art/bg-splash-chesscito.png" alt="Chesscito" width="320" />

  <h3>Pre-chess puzzles on Celo — playable inside MiniPay</h3>

  <p>
    <a href="https://celo.org"><img src="https://img.shields.io/badge/Celo-Mainnet-FCFF52?style=flat-square&labelColor=1A1A2E" alt="Celo Mainnet" /></a>
    <a href="https://docs.celo.org/build/build-on-minipay/overview"><img src="https://img.shields.io/badge/MiniPay-Compatible-35D07F?style=flat-square&labelColor=1A1A2E" alt="MiniPay" /></a>
    <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-14-white?style=flat-square&logo=next.js&labelColor=1A1A2E" alt="Next.js 14" /></a>
    <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&labelColor=1A1A2E" alt="TypeScript" /></a>
    <img src="https://img.shields.io/badge/license-MIT-8B5CF6?style=flat-square&labelColor=1A1A2E" alt="MIT License" />
  </p>
</div>

---

## What is Chesscito?

Chesscito is an educational MiniApp distributed via **MiniPay on Celo**. Players solve short pre-chess puzzles — moving a single piece to a target square in the fewest moves possible — earning on-chain badges and scores as proof of progress.

- **Learn** how chess pieces move through interactive puzzles
- **Earn** on-chain badges and leaderboard scores on Celo Mainnet
- **Play** directly inside MiniPay — no wallet setup required

## Gameplay

Three pieces. Five puzzles each. Stars awarded by precision.

| Piece | Trials | Badge |
|-------|--------|-------|
| Rook (Torre) | 5 | Rook Ascendant |
| Bishop (Alfil) | 5 | Bishop Ascendant |
| Knight (Caballo) | 5 | Knight Ascendant |

Stars are awarded based on move efficiency:
- **3 stars** — solved in the optimal number of moves
- **2 stars** — one extra move used
- **1 star** — two extra moves used

Earn ≥ 10/15 stars per piece to unlock your on-chain badge.

## On-chain Contracts (Celo Mainnet)

| Contract | Address |
|----------|---------|
| Badges (ERC-1155) | [`0xf92759E5...`](https://celoscan.io/address/0xf92759E5525763554515DD25E7650f72204a6739) |
| Scoreboard | [`0x1681aAA1...`](https://celoscan.io/address/0x1681aAA176d5f46e45789A8b18C8E990f663959a) |
| Shop | [`0xc66773A9...`](https://celoscan.io/address/0xc66773A9e897641951DAACa8Bae90dA15d90588B) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 App Router + TypeScript |
| Styling | Tailwind CSS |
| Blockchain | Celo Mainnet (chain ID 42220) |
| Wallet | MiniPay via wagmi + viem |
| Monorepo | Turborepo + pnpm |
| Contracts | Solidity + Hardhat + OpenZeppelin v5 |

## Project Structure

```
chesscito/
├── apps/
│   ├── web/          # Next.js 14 MiniApp frontend
│   └── contracts/    # Hardhat contracts and deploy scripts
└── docs/             # Planning and submission assets
```

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Available Scripts

```bash
pnpm dev                          # start local development
pnpm build                        # build all workspaces
pnpm lint                         # lint all workspaces
pnpm type-check                   # type-check all workspaces
pnpm contracts:compile            # compile contracts
pnpm contracts:deploy:alfajores   # deploy to Alfajores testnet
pnpm contracts:deploy:celo        # deploy to Celo Mainnet
```

## Testing in MiniPay

1. Start the dev server: `pnpm --filter web dev`
2. Expose it via ngrok: `ngrok http 3000`
3. In MiniPay → Settings → About → tap **Version** repeatedly to enable Developer Mode
4. Open **Developer Settings** → **Load Test Page**
5. Paste the HTTPS ngrok URL and launch

> MiniPay uses legacy transactions. `feeCurrency` is optional and validated at runtime.

## Submission Links

| | |
|-|-----|
| Live demo | [chesscito.vercel.app](https://chesscito.vercel.app/) |
| Demo video | [youtube.com/watch?v=h-DGIxbEoms](https://www.youtube.com/watch?v=h-DGIxbEoms) |
| Presentation deck | [Google Slides](https://docs.google.com/presentation/d/e/2PACX-1vQpOSWoGHS1hKB5H9uHAHmWVVKfuOUADdVL0NV2jHzr3ZeQxelNS8tNjNKlxHRdm0ae5VYBWSpI3gLF/pub?start=false&loop=false&delayms=3000) |
| Karma GAP project | [karmahq.xyz/project/chesscito](https://www.karmahq.xyz/project/chesscito) |
| Public repo | [github.com/wolfcito/chesscito](https://github.com/wolfcito/chesscito) |

---

<div align="center">
  <sub>Built with love on Celo · <a href="https://github.com/wolfcito">@wolfcito</a></sub>
</div>
