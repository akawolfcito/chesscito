# Celo Sepolia Deploy Report (2026-03-04)

## Scope

- Transparent proxies for:
  - `BadgesUpgradeable`
  - `ScoreboardUpgradeable`
- Server-authoritative flow (EIP-712 signer, nonce, deadline, pause)

## Command executed

```bash
pnpm --filter hardhat deploy:celo-sepolia
```

## Result

- Network: `celo-sepolia`
- Chain ID: `11142220`
- Deployment artifact: `apps/contracts/deployments/celo-sepolia.json`

Addresses:
- Badges proxy: `0x8da0175d515ddc09bE3ECC6E0A267F7C52afE032`
- Badges implementation: `0xAe50B740951c2299415864F41b29d2B7deB5be90`
- Scoreboard proxy: `0x9b091AC8f8Db060B134A2FCE33563b3eF4A74015`
- Scoreboard implementation: `0x931fA4c0e5838Bb3308ADc8f13F154bc5ecA358c`
- ProxyAdmin: `0x3e42ad59D0E4fB9E4C195EFb610A7Bd8Db122897`

## Frontend env export (testnet)

```env
NEXT_PUBLIC_CHAIN_ID=11142220
NEXT_PUBLIC_BADGES_ADDRESS=0x8da0175d515ddc09bE3ECC6E0A267F7C52afE032
NEXT_PUBLIC_SCOREBOARD_ADDRESS=0x9b091AC8f8Db060B134A2FCE33563b3eF4A74015
```

## Notes

- Deploy script transfers ProxyAdmin ownership to `SAFE_OWNER`.
- Deployments are persisted for verify/runbook automation.
- Verification command executed:
  - `pnpm --filter hardhat verify:celo-sepolia`
  - status: success
  - Badges impl verified: `https://sepolia.celoscan.io/address/0xAe50B740951c2299415864F41b29d2B7deB5be90#code`
  - Scoreboard impl verified: `https://sepolia.celoscan.io/address/0x931fA4c0e5838Bb3308ADc8f13F154bc5ecA358c#code`
- Next step: MiniPay real-device validation on Sepolia.
