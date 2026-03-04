# chesscito - Smart Contracts

This package contains the on-chain proof layer for Chesscito on Celo.

## Contracts

- `Scoreboard.sol`: event-based score submission with anti-spam controls

## Local workflow

```bash
pnpm --filter hardhat compile
pnpm --filter hardhat test
```

## Deploy

```bash
pnpm --filter hardhat deploy
pnpm --filter hardhat deploy:celo-sepolia
pnpm --filter hardhat deploy:celo
```

Default ignition parameters:
- `submitCooldown=60`
- `maxSubmissionsPerDay=20`
- `initialOwner=deployer`

## Environment

Copy `.env.example` to `.env` and fill only what you need:

```env
PRIVATE_KEY=your_private_key_without_0x_prefix
ETHERSCAN_API_KEY=your_etherscan_api_key
CELO_RPC_URL=https://forno.celo.org
CELO_SEPOLIA_RPC_URL=https://forno.celo-sepolia.celo-testnet.org/
```

## Notes

- Never commit `.env` with real keys
- Use Celo Sepolia before Celo Mainnet
- The Scoreboard contract emits `ScoreSubmitted` and enforces cooldown plus max submissions per day
