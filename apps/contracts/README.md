# chesscito - Smart Contracts

This package contains the on-chain proof layer for Chesscito on Celo.

## Contracts

- `ScoreboardUpgradeable.sol`: EIP-712 signed score submission with anti-spam controls
- `BadgesUpgradeable.sol`: EIP-712 signed ERC-1155 badge claims (one mint per wallet and level)
- `ChesscitoTreasury.sol`: non-upgradeable ERC-20 custody contract for direct-transfer payment POCs

## Local workflow

```bash
pnpm --filter hardhat compile
pnpm --filter hardhat test
```

## Deploy

```bash
pnpm --filter hardhat deploy
pnpm --filter hardhat deploy:alfajores
pnpm --filter hardhat deploy:celo-sepolia
pnpm --filter hardhat deploy:celo
pnpm --filter hardhat verify:alfajores
pnpm --filter hardhat verify:celo-sepolia
pnpm --filter hardhat verify:celo
```

### ChesscitoTreasury POC (manual only)

These commands are never called by tests, the web app, or the dev server.

```bash
# Deploy after setting SAFE_OWNER and optionally TREASURY_PAYOUT_ADDRESS.
pnpm --filter hardhat deploy:treasury:celo-sepolia

# Configure metadata after setting CHESSCITO_TREASURY_ADDRESS and
# TREASURY_ACCEPTED_TOKENS (comma-separated token addresses).
pnpm --filter hardhat configure:treasury:celo-sepolia
```

Mainnet variants exist but must only be run manually after reviewing the active
network, owner, payout address, accepted tokens, and deployer account. They also
require `CONFIRM_MAINNET_TREASURY_DEPLOY=YES` or
`CONFIRM_MAINNET_TREASURY_CONFIG=YES`. Replacing an address already present in a
deployment record additionally requires `CONFIRM_TREASURY_REDEPLOY=YES`.

Default deploy parameters:
- `submitCooldown=60`
- `maxSubmissionsPerDay=25`
- `initialOwner=SAFE_OWNER`
- `baseURI=ipfs://chesscito/badges`
- `kind=transparent`

## Environment

Copy `.env.example` to `.env` and fill only what you need:

```env
DEPLOYER_PRIVATE_KEY=your_private_key_with_0x_prefix
SIGNER_PRIVATE_KEY=server_signer_private_key_with_0x_prefix
SAFE_OWNER=0xYourSafeAddress
ALFAJORES_RPC_URL=https://alfajores-forno.celo-testnet.org
CELO_SEPOLIA_RPC_URL=https://forno.celo-sepolia.celo-testnet.org
CELO_RPC_URL=https://forno.celo.org
CELOSCAN_API_KEY=your_celoscan_api_key
```

## Notes

- Never commit `.env` with real keys
- Current recommended Celo testnet flow is Celo Sepolia
- Deploy writes `deployments/<network>.json` with proxy and implementation addresses
- The Scoreboard contract emits `ScoreSubmitted` and enforces cooldown/max submissions/day with signed payloads
- The Badges contract exposes `claimBadgeSigned(levelId, nonce, deadline, signature)` and serves `baseURI + tokenId + .json`
