# Handoff — Victory NFT permit mint: mainnet activation & debug (2026-07-03)

## TL;DR
- **"SAVE VICTORY firma pero no mintea"** root cause: the mainnet VictoryNFT proxy `0x0eE22F83…` still pointed at the **OLD implementation** `0x522342F7` which lacks `mintSignedWithPermit` (selector `b31e32cc`). Any call → **empty `0x` revert** on gas estimation ("Network fee Unavailable"), on any wallet.
- The prior 2026-07-03 handoff **claimed** the new impl was "deployed + verified on mainnet" — it was **not**. The new impl `0x4dE7e2CC…` had code **only on Sepolia**. Likely the `forceImport` no-op footgun the upgrade script's own docstring documents.
- **FIXED**: deployed a fresh mainnet impl `0x21cbB2dB6F4d023623A4dfe3A0dD05E8E51C741c` + upgraded the proxy. Verified working with 3 real MiniPay permit mints.

## Root-cause path (how it was found)
Systematic on-chain verification (all read-only, no signing):
1. Server signer == on-chain `signer` (`0x50c75be1…`) → `_verifySignature` passes ✓
2. Permit domain separators for USDC/USDT/USDm all match client construction ✓
3. Permit signature from the user's calldata recovers to the owner → permit valid ✓
4. `permit()` on USDT succeeds in isolation; balance sufficient; not expired ✓
5. Full `mintSignedWithPermit` eth_call → **empty `0x` revert** across 3 RPCs → not a decoded custom error → **selector not present in live impl**.
6. Read EIP-1967 impl slot → proxy → `0x522342F7` (OLD); `getCode` had no `b31e32cc`. New impl `0x4dE7e2CC…` → **no code on mainnet**, code only on Sepolia. → **proxy never upgraded on mainnet.**

Lesson memorized: on a proxy bug, read the EIP-1967 impl slot + `getCode(impl).includes(selector)` FIRST; a handoff "deployed on mainnet" claim is a draft. Empty `0x` revert on a proxy = selector absent in live impl.

## Fixes applied this session
1. **yParity signature normalization** — commit `76e4283b` on `main` (pushed). `permitSignatureToVRS` normalizes viem `parseSignature` yParity 0/1 → v 27/28 (MiniPay format). Real latent bug, **but NOT the blocker** here. 4579/4579 tests, tsc+eslint clean.
2. **Mainnet proxy upgrade** (user ran; deployer `0x917497b6…` owns ProxyAdmin `0xB7ba5e89…`):
   - Command: `cd apps/contracts && CONFIRM_UPGRADE=yes pnpm run upgrade:victory-nft:celo`
   - First attempt failed: **insufficient CELO gas** on deployer (had 0.4375, needed ~0.74). Topped up → succeeded.
   - New impl `0x21cbB2dB6F4d023623A4dfe3A0dD05E8E51C741c`; upgrade tx `0x5c071eeec358541eb7eaae76989ef67205bc8c305bb194c9b1eaf7f770e67b70`, block 71208562, 2026-07-03T20:08Z.
   - `deployments/celo.json` updated (gitignored → local only): `victoryNFTImpl` new, `victoryNFTImplPrevious` = old, `victoryNFTUpgradedAt`.

## Verification (VERIFIED WORKING)
- 3 real MiniPay permit mints (`mintSignedWithPermit`, selector `b31e32cc`), all OK, from `0xcc4179a2`: `0x2a1cf5…` (20:28), `0xc88920…` (20:29), `0x36ca91…` (20:33).
- Proxy impl slot now → `0x21cbB2dB…`, selector present. ✓
- **Payment split confirmed correct**: mint `0x36ca91…` moved 0.008 USDT → treasury (`0xcD3837DD…`) + 0.002 USDT → prizePool (`0x63DEfFD3…`) = **$0.01 total** (80/20). The "0.008 raro" the founder saw was just the 80% treasury leg. Gas (~$0.006) paid **in USDT** via Celo fee-currency abstraction (MiniPay), which is why extra small USDT transfers appear in the same tx.

## Token support (all 3 viable)
On-chain EIP-2612 `permit` (`d505accf`) presence + domain/version match:
- **USDT** ✓ (impl `0xbf83f843`, version "1")
- **USDm/cUSD** ✓ (impl `0x815795c3`, version "3") — the dominant MiniPay stablecoin; fully viable.
- **USDC** ✓ (permit exists; the check script false-negatived because USDC's proxy doesn't use the standard EIP-1967 slot; domain matched earlier with version "2").
- Selection = `selectMaxBalanceToken` (max USD balance among tokens with balance ≥ price). Ties resolve by array order **USDC → USDT → USDm** (USDm last). Founder confirmed max-balance criterion is the desired behavior; a "preferred token" option is a possible future add.

## Edge case documented (the confusing part)
**Coach "REVIEW MATCH" `?wallet=` URL param goes stale on wallet switch.** The coach page (`app/[locale]/coach/[gameId]/page.tsx`) reads `?wallet=` and passes it as `walletAddress` to `useMintVictory`, where `address = injected ?? walletAddress ?? wagmiAccount.address` — **the URL param takes precedence over the connected wallet.** During testing the founder entered DIARIO with wallet A (`0x693E…`), then switched the connected wallet to B (`0x0924d1af`) but the REVIEW MATCH URL kept `?wallet=A`. Result:
- Balances read from **A** (`0x693E`: 2.049 USDT, 0.003 USDm) → selected **USDT** (USDm below the $0.01 min for A), even though the connected wallet B holds 0.495 USDm.
- Permit requested with `owner = A` but signed by connected wallet **B** → owner mismatch → permit throws → **graceful fallback to legacy approve + mintSigned** (the "Spending cap request" screen). Fallback works as designed.

**Not a production bug** (a user's own coach link carries their own address, so URL == connected). It only manifests on wallet switch mid-session in testing. Optional hardening: refresh the coach `?wallet=` (or prefer the connected wallet) when the account changes.

## Remaining to close the cluster
1. **Enable flag in Production**: `NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED=true` in the `play` Production env.
2. **Release `main` → `production`** (currently `production` at `101988ee`, missing `e8a8e7c2` price sync + `76e4283b` yParity fix). Legacy `mintSigned` in Prod is also affected by the missing price sync until this ships.
3. **MiniPay "Unknown transaction / dev mode"**: MiniPay's calldata decoder doesn't recognize our contract, so it shows "unknown" and restricts to dev mode. Not a code bug — a MiniPay integration/listing item (register/verify the contract with MiniPay). Verify whether prod MiniPay allows "unknown" sends or if registration is required before listing.

## Optional hardening backlog
- `useMintVictory` balance reads use `allowFailure: true`; a transient RPC failure on one token's `balanceOf` silently drops it from selection (could pick a worse token). Consider retry or a clear error.
- Coach stale-`?wallet=` refresh on account change (see edge case above).

## Open questions
- MiniPay production: does "unknown transaction" block real users, or is it just a warning? Needs confirmation before listing.
- Coach's 1-Peón price for Coach analysis still flagged "sospechoso" (unrelated; needs real LLM-cost data).
