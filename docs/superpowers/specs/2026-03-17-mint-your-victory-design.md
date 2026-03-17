# Mint your Victory — Design Spec

**Date**: 2026-03-17
**Status**: Approved
**Author**: Wolfcito

## Problem

Chesscito's on-chain transactions are utilitarian (claim badge, submit score, buy item). There's no fun, repeatable tx loop that incentivizes engagement and drives volume. The game needs a tx that players _want_ to do after every session.

## GTM Analysis

| Option | Build Time | Risk | Why Not Now |
|--------|-----------|------|-------------|
| Wagers | 2-3 days | HIGH: regulatory (gambling), farmeable on Easy | Needs PvP, legal review |
| Daily Challenges | 3-5 days | MEDIUM: needs critical mass | Empty with <50 users |
| Collectibles/Cosmetics | 5-7 days | LOW: premature | No one buys skins for a new game |
| Streaks/Staking | 3-4 days | MEDIUM: needs tokenomics | No native token |
| **Mint your Victory** | **2 days** | **ZERO** | **Launch now** |

**Decision**: Mint your Victory — every arena win is a mintable NFT. Works with 1 user, zero regulatory risk, plants the seed for future prize pools and challenges.

## Concept

After winning an Arena match, the player can mint their victory as an ERC-721 NFT on-chain. Each mint costs a micro-fee (variable by difficulty) paid in any accepted stablecoin (cUSD, USDC, USDT). The fee splits 80% treasury / 20% prize pool. Game data is verified via EIP-712 server signature to prevent fabricated mints.

## Contract: `VictoryNFTUpgradeable`

### Architecture
- ERC-721 behind TransparentUpgradeableProxy (same pattern as ShopUpgradeable)
- EIP-712 signature verification (same pattern as BadgesUpgradeable/ScoreboardUpgradeable)
- Accepts same tokens as ShopUpgradeable (cUSD, USDC, USDT via `acceptedTokens` mapping)
- Price normalization identical to ShopUpgradeable (`_normalizePrice`)
- Storage gap for future upgrades
- Token IDs: auto-increment starting at 1 (`uint256 private _nextTokenId = 1`)

### On-chain Data per Token

```solidity
struct VictoryData {
    uint8 difficulty;   // 1=easy, 2=medium, 3=hard
    uint16 totalMoves;  // number of moves to win (must be > 0)
    uint32 timeMs;      // game duration in milliseconds (must be > 0)
    uint64 mintedAt;    // block.timestamp
}
// player is implicit via ownerOf(tokenId)
```

### Pricing (USD with 6 decimals)

| Difficulty | Price (cUSD) | Raw value (6 dec) |
|-----------|-------------|-------------------|
| Easy (1)  | $0.005      | 5000              |
| Medium (2)| $0.01       | 10000             |
| Hard (3)  | $0.02       | 20000             |

### Fee Split
- `treasuryAmount = totalAmount * 80 / 100`
- `poolAmount = totalAmount - treasuryAmount` (avoids rounding dust loss)
- Two `safeTransferFrom` calls: one to treasury, one to prizePool
- Both addresses configurable by owner, validated against `address(0)` and each other

### EIP-712 Signature (Proof of Play)
Following the BadgesUpgradeable/ScoreboardUpgradeable pattern:

```solidity
bytes32 private constant VICTORY_TYPEHASH = keccak256(
    "VictoryMint(address player,uint8 difficulty,uint16 totalMoves,uint32 timeMs,uint256 nonce,uint256 deadline)"
);
```

- Backend signs after verifying the game actually happened (same `/api/sign-*` pattern)
- New endpoint: `POST /api/sign-victory` — receives `{ player, difficulty, totalMoves, timeMs }`
- Server validates: player address, reasonable values (moves > 0, timeMs > 0, difficulty 1-3)
- Returns: `{ nonce, deadline, signature }`
- Nonce single-use per player (same `usedNonces` mapping pattern)

### Mint Rate Limiting
- `mintCooldown`: minimum seconds between mints per address (default: 30s)
- Prevents bot spam; configurable by owner
- Follows ScoreboardUpgradeable's `submitCooldown` pattern

### Key Functions

```
mintSigned(
    uint8 difficulty,
    uint16 totalMoves,
    uint32 timeMs,
    address token,
    uint256 nonce,
    uint256 deadline,
    bytes signature
)
  → requires: valid signature, difficulty in {1,2,3}, totalMoves > 0, timeMs > 0,
              token accepted, sufficient allowance, cooldown elapsed, nonce unused
  → effects: increments _nextTokenId, stores VictoryData, splits fee, mints NFT
  → emits: VictoryMinted(player, tokenId, difficulty, totalMoves, timeMs, token, totalAmount)

// Admin
setPrice(uint8 difficulty, uint256 priceUsd6) onlyOwner
setTreasury(address) onlyOwner — rejects address(0) and same-as-prizePool
setPrizePool(address) onlyOwner — rejects address(0) and same-as-treasury
setSigner(address) onlyOwner
setMintCooldown(uint256 seconds) onlyOwner
setAcceptedToken(address token, uint8 decimals) onlyOwner
removeAcceptedToken(address token) onlyOwner
setBaseURI(string) onlyOwner
pause() / unpause() onlyOwner
```

### Multi-Token Support
Chesscito accepts 3 stablecoins on Celo (addresses in `lib/contracts/tokens.ts`):
- **cUSD** — 18 decimals
- **USDC** — 6 decimals
- **USDT** — 6 decimals

The contract uses the same `acceptedTokens` mapping + `_normalizePrice` pattern from ShopUpgradeable. Frontend auto-selects the first token with sufficient balance (same `selectPaymentToken` logic from play-hub).

### Metadata
- `baseURI/{tokenId}.json` served from CDN
- v1: placeholder metadata endpoint returning basic JSON with on-chain data
- v2 (future): IPFS-hosted metadata with dynamic SVG image showing game stats
- Metadata can be generated lazily from `VictoryMinted` events

## Frontend Changes

### Prerequisites in `use-chess-game.ts`
- Add `moveCount` to state: increment on each successful player move + AI move
- Add `elapsedMs` to state: start timer on `startGame`, stop on terminal status (checkmate/stalemate/draw/resigned)
- Expose both in `ChessGameState` type

### Difficulty Mapping
Frontend `ArenaDifficulty` → on-chain `uint8`:
```typescript
const DIFFICULTY_TO_CHAIN: Record<ArenaDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};
```
Note: this is distinct from `DIFFICULTY_LEVEL` (js-chess-engine levels 1/3/5).

### Victory Mint Button in `ArenaEndState`
- Appears ONLY when `isPlayerWin === true` (status === "checkmate" AND it's black's turn)
- Shows price based on difficulty (e.g., "Mint Victory — 0.01 cUSD")
- Only visible if `isConnected && isCorrectChain`
- Flow:
  1. Click "Mint Victory"
  2. Request signature from `POST /api/sign-victory`
  3. Auto-select payment token (reuse `selectPaymentToken`)
  4. Approve token if needed → wait for confirmation
  5. Call `mintSigned(...)` on VictoryNFT contract
  6. Show ResultOverlay with tx link to Celoscan
- After successful mint: button shows "Victory Minted" (disabled)
- State tracked locally per session

### Editorial Copy
Add `VICTORY_MINT_COPY` to `lib/content/editorial.ts`:
- `mintButton`: "Mint Victory"
- `mintedButton`: "Victory Minted"
- `mintPrice`: helper to format price per difficulty
- `mintConfirm`: "Mint your win as an NFT?"

## Prize Pool Strategy

### v1 (now)
- Prize pool is a regular wallet address controlled by owner
- Funds accumulate passively from 20% of each mint
- Manual distribution for promotions/events

### v2 (future)
- Prize pool becomes a contract that distributes to daily/weekly challenge winners
- Enables wager-like mechanics without gambling classification
- Pool already funded from v1 mints
- EIP-712 signature ensures only verified wins can claim rewards

## Security & Process

### Hard Rules
- **NEVER** commit or display: private keys, API keys, seeds, credentials, `.env` values
- **ALWAYS** review `git diff --staged` before every commit
- **NO** deploy to mainnet without completing the full review gate:
  1. Code review (automated + manual)
  2. Red team analysis (attack vectors, edge cases)
  3. QA on testnet (Celo Sepolia)
  4. Final approval before mainnet deploy

### Contract Security Considerations
- ReentrancyGuard (OZ v5, proxy-safe) with `nonReentrant` on `mintSigned`
- Pausable for emergency stops
- EIP-712 signature prevents fabricated game data
- Single-use nonces prevent replay attacks
- Mint cooldown prevents bot spam (default 30s)
- Input validation: difficulty in {1,2,3}, totalMoves > 0, timeMs > 0
- Price per difficulty must be > 0
- Token must be in acceptedTokens
- Treasury/prizePool cannot be address(0) or the same address
- Fee split uses `total - treasuryAmount` pattern to avoid rounding dust
- Storage gap (`uint256[44] private __gap`) for future upgrades

## Scope Exclusions (v1)

- No marketplace/trading UI
- No PGN/replay storage (gas prohibitive)
- No leaderboard of collections
- No visual rarity/skins per difficulty
- No automatic prize pool distribution
- No dynamic SVG metadata (placeholder only)

## Success Metrics
- Mint rate: % of arena wins that result in a mint
- Tx volume: total mints per day/week
- Prize pool growth: accumulated cUSD in pool
- Retention: do minters come back and play more?
