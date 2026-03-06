# MiniPay Validation Runbook (Issue #13)

## 1) Deploy to Celo Sepolia (chainId 11142220)

```bash
cp .env.example .env
pnpm install
pnpm --filter hardhat compile
pnpm --filter hardhat test
pnpm --filter hardhat deploy:celo-sepolia
```

Expected output:
- `Badges proxy` + `Badges implementation`
- `Scoreboard proxy` + `Scoreboard implementation`
- `ProxyAdmin`
- `deployments/celo-sepolia.json`
- `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_BADGES_ADDRESS`, `NEXT_PUBLIC_SCOREBOARD_ADDRESS`

## 2) Configure Live Demo env

Set in Vercel (or `.env.local`):

```env
SIGNER_PRIVATE_KEY=
NEXT_PUBLIC_CHAIN_ID=11142220
NEXT_PUBLIC_BADGES_ADDRESS=
NEXT_PUBLIC_SCOREBOARD_ADDRESS=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_MINIPAY_FEE_CURRENCY=
```

Redeploy web app and publish URL.

## 3) Real device flow in MiniPay

1. Open MiniPay on real phone and load the live demo URL.
2. Connect wallet (MiniPay injected provider).
3. Play `rook` and end with `success`.
4. Tap `Reclamar badge (NFT)` and confirm tx.
5. Tap `Enviar puntaje on-chain` and confirm tx.
6. Verify tx hashes and explorer links.

MiniPay tx policy:
- Do not set `gasPrice` manually for `submitScoreSigned` or `claimBadgeSigned`.
- Use wallet-managed gas in `eth_sendTransaction`.
- `feeCurrency` is optional: pass it only when `NEXT_PUBLIC_MINIPAY_FEE_CURRENCY` is configured.

## 4) Validation checks (Celo Sepolia)

1. `claimBadgeSigned` success -> `hasClaimedBadge(player, levelId) == true`.
2. `submitScoreSigned` success -> `ScoreSubmitted` event in explorer logs.
3. Replay same nonce -> revert `NonceUsed`.
4. Owner calls `pause()` -> both signed flows revert while paused.
5. In `/tx-lab`, matrix A or B for `submitScoreSigned` must return a real `txHash` in MiniPay Sepolia.

## 5) Mainnet rollout (chainId 42220)

```bash
pnpm --filter hardhat deploy:celo
pnpm --filter hardhat verify:celo
```

Update production web env:

```env
NEXT_PUBLIC_CHAIN_ID=42220
NEXT_PUBLIC_BADGES_ADDRESS=
NEXT_PUBLIC_SCOREBOARD_ADDRESS=
```

Validate again in MiniPay with real wallet on Celo mainnet.

## 6) Ownership hardening

Post-deploy checks:
1. `BadgesUpgradeable.owner() == SAFE_OWNER`
2. `ScoreboardUpgradeable.owner() == SAFE_OWNER`
3. `ProxyAdmin.owner() == SAFE_OWNER`

If ProxyAdmin owner is not SAFE, run deploy again with correct `SAFE_OWNER` or transfer with OZ upgrades admin flow.

## 7) Security closeout

1. Rotate `SIGNER_PRIVATE_KEY` if test key was exposed.
2. Keep signer key only in server env (never frontend env).
3. Keep deployer key distinct from signer key and Safe owner.

## Checklist #13

- [x] Proxies deployed on Celo Sepolia
- [ ] Proxies deployed on Celo Mainnet
- [x] `deployments/celo-sepolia.json` generated
- [ ] `deployments/celo.json` generated
- [ ] ProxyAdmin owned by Safe
- [ ] Live demo URL published with signing endpoints
- [ ] MiniPay real-device validation complete on Celo Sepolia
- [ ] MiniPay real-device validation complete on Celo Mainnet

## Play Hub note

- MiniPay wallet can show `Unknown transaction` for calldata-based txs.
- The app-level confirm modal in `/play-hub` is the source of human-readable action labels (item name, amount, token, addresses).
