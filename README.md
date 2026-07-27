<div align="center">
  <img src="apps/web/public/art/favicon-wolf.png" alt="Chesscito" width="180" />

  <h3>Pre-chess puzzles, full chess vs AI, and AI Coach — on Celo, designed with MiniPay in mind</h3>

  <p>
    <a href="https://celo.org"><img src="https://img.shields.io/badge/Celo-Mainnet-FCFF52?style=flat-square&labelColor=1A1A2E" alt="Celo Mainnet" /></a>
    <a href="https://docs.celo.org/build/build-on-minipay/overview"><img src="https://img.shields.io/badge/MiniPay-Compatible-35D07F?style=flat-square&labelColor=1A1A2E" alt="MiniPay" /></a>
    <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-14-white?style=flat-square&logo=next.js&labelColor=1A1A2E" alt="Next.js 14" /></a>
    <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&labelColor=1A1A2E" alt="TypeScript" /></a>
    <img src="https://img.shields.io/badge/license-Apache--2.0-8B5CF6?style=flat-square&labelColor=1A1A2E" alt="Apache 2.0 License" />
  </p>
</div>

---

## What is Chesscito?

Chesscito is an educational MiniApp on **Celo**, designed to be used with MiniPay-compatible wallets. Players solve short pre-chess puzzles — moving a single piece to a target square in the fewest moves possible — earning on-chain badges and scores as proof of progress.

- **Learn** how all six chess pieces move through interactive puzzles, labyrinths, and signature games
- **Earn** Peones (in-game currency), on-chain badges, and leaderboard scores on Celo Mainnet
- **Play** in MiniPay with the wallet you already have, or sign in on the web with email or Google — a wallet is created for you, no extension to install
- **Battle** full chess vs AI in Arena and save any finished match as an on-chain NFT
- **Improve** with the AI Coach analyzing your games (LLM-powered)

### Two surfaces, one codebase

Chesscito ships as two focused apps built from the same repo, selected at build time via
`NEXT_PUBLIC_CHESSCITO_MODE`:

| Mode    | Host                    | What it is                                                                     |
| ------- | ----------------------- | ------------------------------------------------------------------------------ |
| `learn` | `learn.chesscito.com`   | Pre-chess training: puzzles, signature games, daily loop, Season Pass, badges, leaderboard |
| `play`  | `play.chesscito.com`    | Full chess: Arena vs AI, Victory NFT, AI Coach                                  |

`full` mode (everything on one host) exists for local development; it is not a shipped
surface. Cross-mode links redirect to the right host automatically.

### Two ways in

| Environment                       | How you get a wallet                                                            |
| --------------------------------- | ------------------------------------------------------------------------------- |
| MiniPay (and any injected wallet) | The wallet is already there — Chesscito connects to it and never asks you to sign in |
| Web browser                       | Sign in with email or Google; an embedded wallet on Celo Mainnet is created on first login |

On the web this is a gate, not an option: the app renders only once the session is
authenticated **and** the wallet is ready. There is no guest mode, and no seed phrase to
write down. MiniPay never sees the gate — the branch resolver keeps it on the injected
path.

## Gameplay

All six pieces. 59 exercises plus a second lane of longer challenges. Stars awarded by precision.

Every piece trains on two lanes: short **exercises** (move one piece to a target square), and
**Special Training** — a longer challenge built around what makes that piece itself. All six pieces
now have their signature game; for the Rook, that game is its rail labyrinths.

| Piece            | Exercises | Special Training                 |
| ---------------- | --------- | -------------------------------- |
| Rook (Torre)     | 10        | **Rail labyrinths** (4)          |
| Bishop (Alfil)   | 9         | **Diagonal Run** (3)             |
| Knight (Caballo) | 10        | **Knight's Tour** (3)            |
| Pawn (Peón)      | 10        | **Promotion Run** (3)            |
| Queen (Dama)     | 10        | **N-Queens** (3)                 |
| King (Rey)       | 10        | **Safe Path** (3)                |

Signature games grade on their own terms, not always by move count: the Knight's Tour asks you to
visit a share of the board, N-Queens asks you to place queens that cannot see each other (blocks
break a queen's rays, which is why one board fits nine queens where a bare 8×8 fits eight), and the
Promotion Run scores by how few times the pawn is caught on its way to promoting.

Stars are awarded based on move efficiency:

- **3 stars** — solved in the optimal number of moves
- **2 stars** — one extra move used
- **1 star** — two extra moves used

Complete 80% of a piece's exercises to unlock its on-chain badge — the badge rewards constancy, not perfection, so a 1-star run and a 3-star run both count and no one is stranded below a star ceiling. Stars are a reward and tiebreak metric, not the gate. Completing exercises and labyrinths also earns **Peones**, the in-game soft currency, which can additionally be purchased with stablecoins (cUSD / USDT / USDC) via a direct payment — no token approvals.

### Progression & Economy

- **Daily loop** — a daily tactic keeps a streak alive; **Shields** rescue a failed exercise so a
  slip does not cost the run
- **Peones** — the soft currency earned by completing exercises and signature games, spendable on
  retries, Coach credits and shop items
- **Season Pass** — the long-arc progression product of Learn mode, with milestone celebrations
  queued so rewards never collide on screen
- **Badges & Trophies** — on-chain ERC-1155 badges per piece plus an in-app achievements vitrine
- **Stats** — personal on-chain metrics (scores, mints, badges) read back from Celo

### Arena — Full Chess vs AI

Play a complete chess game vs AI and save the result as an on-chain NFT — any outcome (win, loss, draw, or resign), not just victories.

- Three difficulty levels: **Easy**, **Medium**, **Hard**
- Powered by `js-chess-engine` (pure JS, runs natively in the MiniPay WebView)
- Victory NFT mint price scales with difficulty (Easy $0.005 / Medium $0.01 / Hard $0.02)

### Chesscito Coach

Post-game analysis powered by an LLM that identifies tactical and positional patterns in your play so you know what to train next. User-triggered per game; PRO Benefit included.

### Leaderboard

DB-backed global leaderboard (Supabase read layer) with an optional on-chain score save to the Scoreboard contract as permanent proof.

## On-chain Contracts (Celo Mainnet)

| Contract            | Address                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------- |
| Badges (ERC-1155)   | [`0xf92759E5...`](https://celoscan.io/address/0xf92759E5525763554515DD25E7650f72204a6739) |
| Scoreboard          | [`0x1681aAA1...`](https://celoscan.io/address/0x1681aAA176d5f46e45789A8b18C8E990f663959a) |
| Shop (proxy)        | [`0x24846C77...`](https://celoscan.io/address/0x24846C772af7233ADfD98b9A96273120f3a1f74b) |
| Victory NFT (proxy) | [`0x0eE22F83...`](https://celoscan.io/address/0x0eE22F830a99e7a67079018670711C0F94Abeeb0) |
| Treasury            | [`0xcD3837DD...`](https://celoscan.io/address/0xcD3837DD017dFA5E31A2e3Cf390721E16Ac8Fbf0) |
| Prize Pool          | [`0x63DEfFD3...`](https://celoscan.io/address/0x63DEfFD397B6470521f84Da621f47e1727424a51) |

Victory NFT mints go through a **permit** path — a single signed transaction, no ERC-20 approval
step — with proceeds routed to the Treasury.

> LabyrinthBadges (ERC-1155 soulbound) is live on Celo Sepolia; mainnet deploy is queued.

## Tech Stack

| Layer       | Technology                                                         |
| ----------- | ------------------------------------------------------------------ |
| Frontend    | Next.js 14 App Router + TypeScript                                 |
| Styling     | Tailwind CSS                                                       |
| Blockchain  | Celo Mainnet (chain ID 42220)                                      |
| Wallet      | Injected (MiniPay / MetaMask) + Privy embedded wallets on web, via wagmi + viem |
| Payments    | Stablecoin direct transfer rail (cUSD / USDT / USDC, no approvals) |
| Monorepo    | Turborepo + pnpm                                                   |
| Contracts   | Solidity + Hardhat + OpenZeppelin v5                               |
| AI Engine   | `js-chess-engine` (pure JS, no WASM)                               |
| Cache layer | Supabase (read layer + cron sync) + Upstash Redis (fast path, rate limiting) |
| AI Coach    | OpenAI-compatible LLM provider                                     |
| i18n        | next-intl (locale-prefixed routes)                                 |
| Content     | CSV/JSON authored catalog compiled into a typed generated module    |

## Project Structure

```
chesscito/
├── apps/
│   ├── web/          # Next.js 14 MiniApp frontend (learn / play modes)
│   ├── landing/      # Public landing page — www.chesscito.com
│   ├── contracts/    # Hardhat contracts and deploy scripts
│   ├── admin/        # Admin operations CLI (encode + simulate + send, append-only audit log)
│   └── video/        # Remotion promo video
└── docs/             # Specs, handoffs, runbooks, postmortems, audits and product direction
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
pnpm content:audit                # audit user-facing copy against the language brief
pnpm contracts:compile            # compile contracts
pnpm contracts:deploy:celo-sepolia # deploy to Celo Sepolia testnet
pnpm contracts:deploy:celo        # deploy to Celo Mainnet
```

## Testing in MiniPay

1. Start the dev server: `pnpm --filter web dev`
2. Expose it via ngrok: `ngrok http 3000`
3. Set both public origin variables to the exact HTTPS ngrok URL:
   `NEXT_PUBLIC_APP_URL=https://<subdomain>.ngrok-free.app` and
   `NEXT_PUBLIC_PREVIEW_URL=https://<subdomain>.ngrok-free.app`.
4. Restart the Next.js dev server. `NEXT_PUBLIC_*` values are captured at
   startup; changing them without restarting leaves `/api/pro/status` on the
   previous origin allowlist.
5. In MiniPay → Settings → About → tap **Version** repeatedly to enable Developer Mode.
6. Open **Developer Settings** → **Load Test Page**.
7. Paste the same HTTPS ngrok URL and launch.

In local development, Chesscito shows a non-destructive warning when the
mobile host does not match either configured host. The comparison mirrors the
server exactly: hostname plus port, excluding protocol. See
[`docs/runbooks/2026-07-19-local-minipay-ngrok.md`](docs/runbooks/2026-07-19-local-minipay-ngrok.md).

> MiniPay uses legacy transactions. `feeCurrency` is optional and validated at runtime.

## Submission Links

|                   |                                                                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live demo         | [chesscito.com](https://chesscito.com/) · [learn.chesscito.com](https://learn.chesscito.com/) · [play.chesscito.com](https://play.chesscito.com/)                                        |
| Demo video        | [youtube.com/watch?v=h-DGIxbEoms](https://www.youtube.com/watch?v=h-DGIxbEoms)                                                                                                           |
| Presentation deck | [Google Slides](https://docs.google.com/presentation/d/e/2PACX-1vQpOSWoGHS1hKB5H9uHAHmWVVKfuOUADdVL0NV2jHzr3ZeQxelNS8tNjNKlxHRdm0ae5VYBWSpI3gLF/pub?start=false&loop=false&delayms=3000) |
| Karma GAP project | [karmahq.xyz/project/chesscito](https://www.karmahq.xyz/project/chesscito)                                                                                                               |
| Public repo       | [github.com/wolfcito/chesscito](https://github.com/wolfcito/chesscito)                                                                                                                   |

## License

The code in this repository is licensed under [Apache License 2.0](LICENSE).
Project attribution and notice details are documented in [NOTICE](NOTICE).
Chesscito branding, logos, official artwork, official badge artwork, and
visual identity are reserved as described in
[BRAND_POLICY.md](BRAND_POLICY.md). Commercial and white-label inquiries are
outlined in [COMMERCIAL.md](COMMERCIAL.md).

---

<div align="center">
  <sub>Built with love on Celo · <a href="https://github.com/wolfcito">@wolfcito</a></sub>
</div>
