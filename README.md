# Chesscito

Chesscito is a MiniPay MiniApp for cognitive enrichment through short pre-chess challenges. The product direction is educational, playful, and measurable. It must not make medical claims.

## Submission Links

- Live demo URL: `TBD`
- Celo Mainnet deployment: `TBD`
- Presentation deck: `TBD`
- Demo video: `TBD`
- Karma GAP project: `TBD`
- Public GitHub repo: https://github.com/wolfcito/chesscito

## North Star

Ship a MiniPay MiniApp on Celo Mainnet with:
- Gameplay MVP for Tower first, then Bishop/Knight if time remains
- On-chain proof via `submitScore` and `claimBadge`
- Functional Top 10 leaderboard
- Submission pack complete in Karma GAP

## Project Structure

This monorepo is managed by Turborepo:

- `apps/web` — Next.js 14 MiniApp frontend
- `apps/contracts` — Hardhat contracts and deployment scripts
- `docs/planning` — roadmap, backlog, and execution notes
- `docs/submission` — deck outline and demo video script
- `.github` — PR workflow defaults and templates

## Workflow

- Use granular, frequent commits during implementation.
- Land changes through small PRs aligned to a single issue or vertical slice.
- Enable auto-merge for PRs after checks pass.
- Follow the project workflow in `CONTRIBUTING.md`.

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Start the development server:
   ```bash
   pnpm dev
   ```
3. Open `http://localhost:3000`.

## Available Scripts

- `pnpm dev` — start local development
- `pnpm build` — build all workspaces
- `pnpm lint` — lint all workspaces
- `pnpm type-check` — type-check all workspaces
- `pnpm contracts:compile` — compile contracts
- `pnpm contracts:test` — run contract tests
- `pnpm contracts:deploy` — deploy to local network
- `pnpm contracts:deploy:celo-sepolia` — deploy to Celo Sepolia
- `pnpm contracts:deploy:celo` — deploy to Celo Mainnet

## Testing in MiniPay (Device)

MiniPay validation must happen on a real mobile device. Do not use an emulator.

1. Start the web app:
   ```bash
   pnpm --filter web dev
   ```
2. Expose the local app:
   ```bash
   ngrok http 3000
   ```
3. On your phone, open MiniPay.
4. Go to `Settings > About`.
5. Tap the `Version` row repeatedly until Developer Mode is enabled.
6. Open `Developer Settings`.
7. Tap `Load Test Page`.
8. Paste the current HTTPS `ngrok` URL and launch the app.

Compatibility rules:
- Guard wallet initialization behind `window.provider` or `window.ethereum`.
- Hide redundant connect-wallet UX inside MiniPay.
- Assume legacy transactions only in MiniPay.
- Treat `feeCurrency` as optional and validate support in the target environment before enabling it.

Troubleshooting:
- If no provider appears, reload the page inside MiniPay and confirm you opened it from `Load Test Page`, not a normal browser tab.
- If the connect button still shows inside MiniPay, verify `window.ethereum?.isMiniPay` is present in the device session and hard-refresh the page.
- If the `ngrok` URL stops working, restart `ngrok`, copy the new HTTPS URL, and update `Load Test Page`.

References:
- MiniPay quickstart: https://docs.celo.org/build/build-on-minipay/quickstart
- MiniPay quickstart (current path): https://docs.celo.org/build-on-celo/build-on-minipay/quickstart
- ngrok setup: https://docs.celo.org/build/build-on-minipay/prerequisites/ngrok-setup
- viem on Celo: https://docs.celo.org/developer/viem

## Delivery Definition

- `pnpm lint` and `pnpm build` pass in `apps/web`
- Contracts have reproducible testnet and mainnet deploy flows
- Demo is recorded on a real mobile device inside MiniPay
- No redundant wallet connect prompt is shown inside MiniPay
- Basic anti-spam protections exist for score submission and badge claim
