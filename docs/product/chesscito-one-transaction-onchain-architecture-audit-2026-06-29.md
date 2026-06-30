# Chesscito One-Transaction On-chain Architecture Audit

- **Audit date:** 2026-06-30
- **Requested document date:** 2026-06-29
- **Repository snapshot:** `b5ce4867763b13e3ff114db79e841815b73cdc63`
- **Status:** Documentation only; no migration authorized

## Executive summary

The Treasury rail is viable for MiniPay payments: the validated mainnet path was one user transaction targeting the USDT token contract and calling `transfer(ChesscitoTreasury, amount)`. `ChesscitoTreasury` was the payment recipient, not the transaction target, and executed no receive callback.

The current `ShopUpgradeable.buyItem` path still requires allowance because Shop calls `safeTransferFrom`. It is one prompt only when sufficient allowance already exists; with insufficient allowance it requires an `approve` transaction followed by `buyItem`. That conditional shortcut is not a deterministic one-transaction architecture.

Treasury direct transfer is not a universal replacement for contract business logic. A passive ERC-20 receipt does not mint a Victory NFT, claim a badge, record a score proof, enforce signed nonces, split payment, or create Shop's canonical `ItemPurchased` event. “1 tx” must therefore be evaluated per product lifecycle, not only per payment transport.

The smallest safe conclusion is:

- Keep existing one-transaction claim/proof flows as contract calls.
- Keep lifecycle-bound paid minting in its current contract flow; Victory remains one transaction only when sufficient allowance already exists.
- Align already-direct payment rails only after Wave 0 controls.
- Consider Shop SKUs individually where backend entitlement can replace `ItemPurchased` as the product source of truth.
- Do not interpret this audit as approval to migrate anything.

### Counting rule

This audit counts user-signed transaction requests and broadcast transactions separately:

- RPC reads such as `allowance` and `balanceOf` are not user transactions.
- Backend voucher requests such as `/api/sign-badge` are HTTP calls, not user transactions.
- A failed compatibility request followed by a retry may create an additional wallet prompt even when only one transaction is ultimately broadcast.
- A flow that is one broadcast transaction only because an old allowance exists is **not deterministically one transaction**.

## Source documentation consulted

### Documented protocol facts

- [MiniPay: Send a Transaction](https://docs.minipay.xyz/technical-references/send-transaction.html) shows ERC-20 payments encoded as `transfer`, with the token contract as transaction `to` and the receiver inside calldata. It also separates the `feeCurrency` adapter from the payment token address.
- [Celo: MiniPay Code Library](https://docs.celo.org/build-on-celo/build-on-minipay/code-library) shows `sendTransaction({ to: tokenAddress, data: transfer(...) })`, receipt waiting, and the 6-decimal treatment of Celo USDC/USDT versus 18 decimals for USDm.
- [Celo: Get Started Building on MiniPay](https://docs.celo.org/build-on-celo/build-on-minipay/quickstart) documents MiniPay's injected provider, Celo-only network scope, stablecoin UX, `feeCurrency`, and legacy transaction handling.
- [ERC-20 / EIP-20](https://eips.ethereum.org/EIPS/eip-20) defines `transfer`, delegated `transferFrom`, `approve`, `allowance`, and the `Transfer`/`Approval` events. `transferFrom` is expected to require deliberate authorization from the token owner.
- [OpenZeppelin Contracts 5.x: SafeERC20](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20#SafeERC20) states that `safeTransferFrom` spends approval granted by `from` to the calling contract and safely handles false/no-return token implementations.
- The local Celopedia `minipay-guide`, `builder-guide`, `network-info`, and `docs-map` references were used for navigation. They are cached guidance, so current official pages above take precedence where wording or support lists differ.

`feeCurrency` affects how the network fee is paid. It does not change the business transaction target, ERC-20 payment recipient, product proof, or entitlement lifecycle.

### Repository facts

Repository facts come from current Solidity contracts, frontend write hooks, API verifiers, ABI/config modules, deployment scripts, `README.md`, and `docs/contracts.md`. They are labeled `confirmed-by-source` when explicit. Official protocol documentation does not establish Chesscito deployment addresses, proxy state, ownership, ABI-to-bytecode linkage, or runtime compatibility. Runtime environment values were not read.

### Session POC evidence

The approved [Treasury rail finding](./chesscito-minipay-treasury-rail-finding-2026-06-29.md) and supplied session output record:

- Shop no-approve: Celo chain `42220`; wallet `0xCc4179A22b473Ea2eB2B9b9b210458d0F60Fc2dD`; Shop target `0x24846C772af7233ADfD98b9A96273120f3a1f74b`; USDT `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e`; zero allowance; `buyItem(1, 1, USDT)`; gas-estimation revert `ERC20: transfer amount exceeds allowance`; no broadcast transaction hash.
- Treasury rail: the same chain, wallet and USDT; token-contract target; Treasury recipient `0xCD3837DD017dFA5E31A2e3Cf390721E16Ac8Fbf0`; amount `10_000` raw (`0.01 USDT`); transaction `0xa7ab550ca799c139b0c00098f07e19c38156d7808537ae6f9bf0671d55d24b2b`; successful receipt and matching `Transfer` log; no approve and no Shop call.

These are labeled `confirmed-by-mainnet-poc`, the required label for the supplied session evidence. In this audit that label means “observed and recorded in the approved mainnet POC session”; it does **not** mean independently replayed, explorer-verified, or linked to verified deployed bytecode during this audit.

### Assumptions and inferences

Migration feasibility is an architecture inference, not deployed behavior. Rows labeled `inferred-from-code` describe what appears possible if the named companion system is designed. `needs-verification` means versioned sources conflict or runtime/deployment state cannot be established safely without an explicit Wave 0 check.

## Current contracts and roles

| Contract | Source/config path | Address/config source | Upgradeable? | User tx target? | User-facing methods | Payment method | Product state/lifecycle | Events/proof source | Notes | Status/confidence |
|---|---|---|---|---|---|---|---|---|---|---|
| `ShopUpgradeable` | `apps/contracts/contracts/ShopUpgradeable.sol`; `lib/contracts/chains.ts`; `lib/contracts/shop.ts` | `NEXT_PUBLIC_SHOP_ADDRESS`; supplied mainnet POC targeted `0x24846C772af7233ADfD98b9A96273120f3a1f74b`; `docs/contracts.md` instead lists legacy Shop `0xc667…` | Yes; Transparent proxy per source/deploy script | Yes | `buyItem(itemId, quantity, token)` | Source implementation calls token `safeTransferFrom(user, treasury, amount)` | Source validates token/item/quantity and emits the purchase event used by entitlements | `ItemPurchased` | The source behavior and POC revert agree, but implementation/proxy linkage was not independently established. Owner, ProxyAdmin, implementation, and canonical address require Wave 0 verification. | `needs-verification` |
| Legacy `Shop` | `apps/contracts/contracts/Shop.sol`; `docs/contracts.md` | Versioned mainnet entry `0xc66773A9e897641951DAACa8Bae90dA15d90588B` | No; source inherits `Ownable` | Not by current three-argument frontend ABI | `buyItem(itemId, quantity)` | Immutable token `safeTransferFrom` to treasury | Legacy `ItemPurchased` lifecycle | `ItemPurchased` | Constructor receives `initialOwner`; deployed owner was not verified. Kept for historical/reference coverage; current frontend targets `ShopUpgradeable` ABI. | `inactive/dev-only` |
| `ChesscitoTreasury` | `apps/contracts/contracts/ChesscitoTreasury.sol`; `lib/contracts/treasury.ts`; `lib/contracts/chains.ts` | `NEXT_PUBLIC_CHESSCITO_TREASURY_CONTRACT_ADDRESS`; POC recipient `0xCD3837DD017dFA5E31A2e3Cf390721E16Ac8Fbf0` | No; `Ownable2Step` in source | **No for user payments.** User targets the token contract. | Source has no user payment method; owner config/withdraw methods only | Source can hold externally transferred ERC-20 and withdraw via SafeERC20 | Custody only; no SKU, payer, order, claim, or entitlement state | Token's `Transfer`; Treasury admin/withdraw events in source | Source confirms ownership/withdraw/`acceptedToken` semantics; the POC confirms only that the address received USDT. Deployed bytecode, owner, payout, and accepted-token state require Wave 0 verification. | `confirmed-by-source` |
| `VictoryNFTUpgradeable` | `apps/contracts/contracts/VictoryNFTUpgradeable.sol`; `lib/contracts/victory.ts`; `lib/contracts/chains.ts` | `NEXT_PUBLIC_VICTORY_NFT_ADDRESS`; `README.md` lists `0x0eE22F830a99e7a67079018670711C0F94Abeeb0` | Yes; Transparent proxy per deploy script | Yes | `mintSigned(...)` | Two `safeTransferFrom` calls split payment 80/20 to treasury/prize pool | Consumes signed nonce, enforces deadline/cooldown, stores victory, mints ERC-721 | `VictoryMinted`, ERC-721 ownership | Owner/ProxyAdmin derive from `SAFE_OWNER`; signer is configured separately. Runtime values need operational verification. | `confirmed-by-source` |
| `BadgesUpgradeable` | `apps/contracts/contracts/BadgesUpgradeable.sol`; `lib/contracts/badges.ts`; `lib/contracts/chains.ts` | `NEXT_PUBLIC_BADGES_ADDRESS`; `README.md`/`docs/contracts.md`: `0xf92759E5525763554515DD25E7650f72204a6739` | Yes; `deploy-proxies.ts` says Transparent, legacy `deploy.ts` says UUPS | Yes | `claimBadgeSigned(levelId, nonce, deadline, signature)` | No token movement | Verifies signer/deadline/nonce, records claimed level, mints soulbound ERC-1155 | `BadgeClaimed`, `hasClaimedBadge`, token balance | `SAFE_OWNER` is owner/ProxyAdmin target in the Transparent script; the legacy UUPS script starts with deployer ownership. Deployed proxy kind, implementation, owner and admin require verification. | `needs-verification` |
| `ScoreboardUpgradeable` | `apps/contracts/contracts/ScoreboardUpgradeable.sol`; `lib/contracts/scoreboard.ts`; `lib/contracts/chains.ts` | `NEXT_PUBLIC_SCOREBOARD_ADDRESS`; `README.md`/`docs/contracts.md`: `0x1681aAA176d5f46e45789A8b18C8E990f663959a` | Yes; `deploy-proxies.ts` says Transparent, legacy `deploy.ts` says UUPS | Yes for optional on-chain save | `submitScoreSigned(...)` | No token movement | Verifies signature/nonce/deadline, cooldown and daily cap; records public proof event | `ScoreSubmitted` | Base score save is off-chain. Deployed proxy kind, implementation, owner and admin require verification because scripts conflict. | `needs-verification` |
| `LabyrinthBadges` | `apps/contracts/contracts/LabyrinthBadges.sol`; `/api/sign-labyrinth`; deploy script | No mainnet address; `docs/contracts.md` lists Sepolia proxy `0x8AA4006dfb3D5B7e255Df26B1065CD87A193171b`; root env template lacks its frontend variable | Yes; Transparent proxy on Sepolia per script/docs | No active frontend write consumer found | `claimLabyrinthSigned(...)` | No token movement | Verifies voucher/nonce, enforces strictly better stars, mints soulbound ERC-1155 | `LabyrinthClaimed`, `bestMintedStars` | Initial contract owner is `SAFE_OWNER`; the script omits explicit ProxyAdmin `initialOwner`. Docs record a separate Sepolia owner and ProxyAdmin, but live state was not checked. Mainnet is pending. | `inactive/dev-only` |
| USDC | `apps/web/src/lib/contracts/tokens.ts` | Hardcoded Celo address `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`; also optional `NEXT_PUBLIC_USDC_ADDRESS` | External; outside local control | Yes for direct rail and `approve`; otherwise recipient movement is initiated by Shop/Victory | `transfer`, `approve`, `allowance`, `balanceOf`, `transferFrom` | Direct or delegated ERC-20 | Token balances/allowances only | `Transfer`, `Approval` | 6 decimals in official Celo/MiniPay docs. External admin/upgrade model is outside this repository audit. | `confirmed-by-source` |
| USDT | `apps/web/src/lib/contracts/tokens.ts` | Hardcoded Celo address `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | External; outside local control | Yes for direct rail and `approve` | ERC-20 surface used by Chesscito | Direct or delegated ERC-20 | Token balances/allowances only | `Transfer`, `Approval` | Source/docs establish address usage and 6 decimals; the supplied POC separately observed one direct transfer to Treasury. | `confirmed-by-source` |
| USDm / legacy `cUSD` label | `apps/web/src/lib/contracts/tokens.ts` | Hardcoded Celo address `0x765DE816845861e75A25fCA122bb6898B8B1282a` | External; outside local control | Yes for direct rail and `approve` | Standard ERC-20 surface used by Chesscito | Direct or delegated ERC-20 | Token balances/allowances only | `Transfer`, `Approval` | Repository symbol remains `cUSD`; current Celo documentation calls it USDm. 18 decimals. | `confirmed-by-source` |
| CELO ERC-20 surface | `apps/web/src/lib/contracts/tokens.ts`; Shop item `5` | Hardcoded `0x471EcE3750Da237f93B8E339c536989b8978a438` | External Celo protocol asset | Web-only Shop approve path; not offered in MiniPay | ERC-20 `approve`/transfer surface | Delegated Shop payment | Founder helper purchase through `ItemPurchased` | `Approval`, `Transfer`, `ItemPurchased` | Explicitly excluded from MiniPay UI; do not use it to claim MiniPay one-tx support. | `confirmed-by-source` |
| ProxyAdmin / proxy infrastructure | deploy scripts; `docs/contracts.md` | Versioned addresses exist for older deployments; active Shop/Victory/Treasury-era records are not canonicalized in one document | Administrative infrastructure | No | Upgrade/admin operations | No user payment | Controls implementation upgrades for proxied contracts | Ownership/upgrade state | Not a user flow. Actual admin and implementation slots belong in Wave 0 verification. | `needs-verification` |
| Fee-currency adapter/infrastructure | `NEXT_PUBLIC_MINIPAY_FEE_CURRENCY`; official MiniPay/Celo docs | Runtime env plus official adapter tables | External Celo infrastructure | Transaction field, not business target | Fee abstraction only | Pays network fee | No Chesscito product state | Transaction fee fields | Must not be confused with token contract target or payment recipient. | `needs-verification` |

### Recipient-only addresses

The generic rail recipient (`NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS` client-side and `CHESSCITO_TREASURY_ADDRESS ?? TREASURY_ADDRESS` server-side), Shop treasury, Victory treasury, Victory prize pool, and Treasury payout address may be EOAs or contracts. They are recipients/configuration, not necessarily user transaction targets. Their actual runtime values and code status require Wave 0 verification.

Two public Treasury variables coexist: `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS` for the existing direct rail and `NEXT_PUBLIC_CHESSCITO_TREASURY_CONTRACT_ADDRESS` for the POC contract getter. The audit records this drift and does not choose a canonical source.

### Documented configuration discrepancies

- `README.md` and the mainnet Shop POC identify `0x24846…` as the active Shop proxy; `docs/contracts.md` still lists `0xc667…` as “Shop”. The latter matches the legacy two-argument contract shape, while the current frontend ABI calls three-argument `ShopUpgradeable.buyItem`. Wave 0 must verify and then update the canonical public record; this audit changes neither source.
- `docs/contracts.md` says all listed contracts use Transparent proxies, but `Shop.sol` is explicitly non-upgradeable and `ChesscitoTreasury` is a separate non-upgradeable contract not present in that table. Treat the statement as scoped/stale rather than universal.
- Proxy deployment scripts conflict: `deploy-proxies.ts` declares Badges/Scoreboard Transparent proxies with `SAFE_OWNER` as ProxyAdmin owner, while legacy `deploy.ts` declares both as UUPS and initially owned by the deployer. The active deployed proxy kind/admin cannot be inferred from source alone.
- The root `.env.example` contains both Treasury frontend variables but no `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS`, although the signing route and Sepolia contract reference it.
- `apps/contracts/deployments` has no versioned Celo deployment JSON in the current tree, even though scripts and route comments refer to deployment records. Runtime configuration must not be reconstructed from those comments.
- `README.md` summarizes payments as direct transfer with no approvals. That is correct for Get Peones/Season Pass, not for Shop or Victory. Product documentation should name the specific rail whenever it makes a one-transaction claim.

## Current user-facing on-chain flows

| Flow | UI/API location | User tx target | Contract/function | Current tx pattern | Requires approve? | Uses transferFrom? | Current user prompts | Current broadcasts | Product state changed | Current proof source | Status/confidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Get Peones | `components/payments/get-peones-sheet.tsx`; `lib/payments/use-payment-rail.ts`; `/api/verify-payment` | Selected ERC-20 token; configured treasury is recipient only | `token.transfer(treasury, amount)` | Direct payment, receipt, backend verification/ledger credit | No | No | 1 normal request; fee fallback may add a request only after an error reported as pre-broadcast | 1 normal path; duplicate-broadcast risk needs verification if provider errors after submission | Peones ledger balance | Direct token `Transfer` plus backend idempotency | `confirmed-by-source` |
| Lite Season Pass | `components/payments/season-pass-sheet.tsx`; `lib/season-pass/use-season-pass-rail.ts`; `/api/verify-payment` | Selected ERC-20 token; configured treasury is recipient only | `token.transfer(treasury, amount)` | Direct payment, receipt, backend pass/shield grant | No | No | 1 normal request; same fallback caveat | 1 normal path; post-submission error handling needs verification | Pass expiry/status and shields | Direct token `Transfer` plus backend record | `confirmed-by-source` |
| Founder Badge stablecoin, item `1` | Shop sheet hook and legacy `ExercisesScreen`; `/api/founder-status` | Conditional approve: token; purchase: Shop proxy; Shop treasury is recipient | If allowance is insufficient, `approve(Shop, amount)`; then `Shop.buyItem(1,1,token)` | Delegated payment plus canonical Shop purchase event | Conditional | Yes, inside Shop | Sufficient allowance: 1; insufficient: normally 2; a zero-first token could require 3 or fail and needs verification | 1 purchase plus 0/1/2 approval broadcasts | Permanent Founder status derived from Shop history | `ItemPurchased` scan/cache; scan bounds and historical backfill need verification | `confirmed-by-source` |
| Founder Badge CELO helper, item `5` | Same Shop surfaces; web-only branch | Conditional approve: CELO token; purchase: Shop proxy | If allowance is insufficient, `approve`; then `buyItem(5,1,CELO)` | Same delegated Shop lifecycle | Conditional | Yes | Sufficient allowance: 1; insufficient: normally 2; not a MiniPay-supported UI path | 1 purchase plus conditional approval broadcast(s) | Same Founder status | `ItemPurchased` | `confirmed-by-source` |
| Retry Shields, item `2` | Shop hook and legacy `ExercisesScreen`; `/api/credit-shield`; shield sync | Conditional approve: token; purchase: Shop proxy | If allowance is insufficient, `approve`; then `buyItem(2,1,token)` | Shop event followed by idempotent backend credit/reconciliation | Conditional | Yes | Sufficient allowance: 1; insufficient: normally 2 | 1 purchase plus conditional approval broadcast(s) | Server-side shield credit | `ItemPurchased` verified by endpoint | `confirmed-by-source` |
| Coach pack 5/20, items `3/4` | Shop hook; `/api/coach/verify-purchase` | Conditional approve: token; purchase: Shop proxy | If allowance is insufficient, `approve`; then `buyItem(3/4,1,token)` | Shop event followed by Redis credit | Conditional | Yes | Sufficient allowance: 1; insufficient: normally 2 | 1 purchase plus conditional approval broadcast(s) | Coach credit ledger | `ItemPurchased` verified by endpoint | `confirmed-by-source` |
| PRO 30 days, item `6` | `lib/pro/purchase.ts`, PRO sheet, Shop hook, legacy `ExercisesScreen`; `/api/verify-pro` | Conditional approve: token; purchase: Shop proxy | If allowance is insufficient, `approve`; then `buyItem(6,1,token)` | Shop purchase followed by server TTL activation | Conditional | Yes | Sufficient allowance: 1; insufficient: normally 2 | 1 purchase plus conditional approval broadcast(s) | PRO expiry/active status | `ItemPurchased` plus processed-tx record | `confirmed-by-source` |
| Save finished match / Victory NFT | Arena/Coach consumers; `lib/coach/use-mint-victory.ts`; `/api/sign-victory` | Conditional approve: token; mint: Victory NFT proxy; treasury/prize pool are recipients | If allowance is insufficient, `approve`; then `VictoryNFT.mintSigned(...)` | Backend voucher, contract-defined delegated split payment, NFT mint | Conditional | Yes, twice inside mint | Sufficient allowance: 1; insufficient: normally 2 | 1 mint plus conditional approval broadcast(s) | ERC-721 ownership, victory data, used nonce/cooldown | `VictoryMinted`, `ownerOf`, stored victory | `confirmed-by-source` |
| Piece badge claim | Badge sheet, `ExercisesScreen`, Profile claim queue; `/api/sign-badge` | Badges proxy | `Badges.claimBadgeSigned(...)` | Backend voucher then one contract write | No | No | 1 normal request; fee fallback may add a failed request | 1 normal path; post-submission error behavior needs verification | Soulbound badge, claimed mapping, used nonce | `BadgeClaimed`, balance, `hasClaimedBadge` | `confirmed-by-source` |
| Optional on-chain score proof | `ExercisesScreen` and Profile claim queue; `/api/sign-score` | Scoreboard proxy | `Scoreboard.submitScoreSigned(...)` | Backend voucher then one proof write | No | No | 1 normal request; compatibility fallback may add a failed request | 1 normal path; post-submission error behavior needs verification | Nonce/cooldown/daily state and public score event | `ScoreSubmitted` | `confirmed-by-source` |
| Labyrinth badge claim | Signing endpoint and Sepolia contract exist; no active frontend caller found | Would target LabyrinthBadges proxy | `claimLabyrinthSigned(...)` | Source suggests voucher then claim/mint; runtime inactive | No | No | Inferred 1 if activated | Inferred 1; no active mainnet broadcast path | Best-star tier, nonce, soulbound badge | `LabyrinthClaimed`, `bestMintedStars` | `inactive/dev-only` |
| Dev Shop no-approve POC | `/dev/minipay-no-approve-poc` | Shop proxy | `buyItem(1,1,USDT)` without approve | Diagnostic request failed during estimation at zero allowance | Skipped deliberately | Shop attempted it | Prompt count not recorded | 0 | None because call failed | Revert reason | `confirmed-by-mainnet-poc` |
| Dev Treasury POC | Same dev route, Treasury section | USDT token; ChesscitoTreasury is recipient only | `USDT.transfer(ChesscitoTreasury,10_000)` | One direct transfer, local receipt/event verification | No | No | Prompt count not recorded | 1 | Token custody only; no entitlement | USDT `Transfer` log | `confirmed-by-mainnet-poc` |
| Dev direct-rail smoke | `/dev/rail-smoke` | Selected ERC-20 token | `transfer(configuredTreasury, amount)` | Direct payment plus `/api/verify-payment` | No | No | Intended 1 | Intended 1 | Peones backend credit | Direct `Transfer` plus verifier | `inactive/dev-only` |

### Explicit non-on-chain and operational boundaries

- Base score save now posts to `/api/scores/save` and creates **zero** user transactions. The optional Scoreboard action is a separate proof lane.
- Welcome Pack claims, Peones spends, Coach analysis consumption, and shield spending are backend/local flows, not blockchain writes.
- `apps/web/src/lib/minipay/rawTx.ts` is a generic sender helper; no active production consumer was found.
- `apps/admin/src/lib/tx-runner.ts` and Hardhat deploy/config scripts perform operator/admin writes. They are not MiniPay user-facing flows and do not count toward user prompt architecture.
- Test mocks and contract tests demonstrate behavior but are not production flows.

## One-transaction feasibility matrix

| Flow | Current tx count | Target tx count | 1-tx feasible? | Feasibility category | Mechanism needed | What breaks if forced through Treasury rail? | Recommended action | Priority | Status/confidence |
|---|---:|---:|---|---|---|---|---|---|---|
| Get Peones | 1 | 1 | Direct transfer is one tx now; recipient alignment to Treasury is unverified | `already-one-tx-direct-payment` | Keep token `transfer`; align verified recipient only after Wave 0 | Backend credit fails if verifier/config is not migrated coherently | `migrate-after-wave-0` | 1 | `confirmed-by-source` |
| Lite Season Pass | 1 | 1 | Direct transfer is one tx now; recipient alignment to Treasury is unverified | `already-one-tx-direct-payment` | Same direct rail; preserve pass/shield verifier | Payment alone does not create pass or shields | `migrate-after-wave-0` | 2 | `confirmed-by-source` |
| Retry Shields | 1 with sufficient allowance; normally 2 with insufficient allowance | 1 | Only after redesign | `one-tx-with-backend-entitlement-redesign` | Treasury payment plus payment intent and idempotent shield entitlement verifier | Loses `ItemPurchased`, Shop pause/item/token/quantity enforcement, and current credit endpoint contract | `candidate-after-backend-entitlement-design` | 3 | `inferred-from-code` |
| Coach packs | 1 with sufficient allowance; normally 2 with insufficient allowance | 1 | Only after redesign | `one-tx-with-backend-entitlement-redesign` | Treasury payment plus payment intent and Coach credit entitlement | Loses Shop item identity/event and Shop controls; transfer carries no SKU | `candidate-after-backend-entitlement-design` | 4 | `inferred-from-code` |
| PRO | 1 with sufficient allowance; normally 2 with insufficient allowance | 1 | Only after redesign | `one-tx-with-backend-entitlement-redesign` | Treasury payment plus payment intent, activation/renewal/recovery | Loses Shop event and Shop controls used to authorize TTL activation | `candidate-after-backend-entitlement-design` | 5 | `inferred-from-code` |
| Founder Badge | 1 with sufficient allowance; normally 2 with insufficient allowance | 1 | Possible only with a new canonical entitlement design | `one-tx-with-backend-entitlement-redesign` | Treasury payment plus payment intent, durable Founder record, historical backfill and legacy coexistence | Removes current permanent canonical `ItemPurchased` history and Shop controls | `redesign-needed` | 6 | `inferred-from-code` |
| Victory NFT | 1 with sufficient allowance; normally 2 with insufficient allowance | 1 | Conditionally one tx now; not deterministic without redesign | `not-one-tx-without-major-redesign` | Keep current; any future deterministic one-tx design must preserve contract-defined split and mint atomically | Loses NFT, signed proof, nonce, cooldown, event, ownership and split | `keep-current-contract-flow` | Deferred | `confirmed-by-source` |
| Piece badge claim | 1 | 1 | Yes now | `already-one-tx-no-payment` | Keep signed contract claim | Loses badge mint, soulbound ownership and replay protection | `keep-current-contract-flow` | Keep | `confirmed-by-source` |
| Optional score proof | 1 | 1 | Yes now | `already-one-tx-no-payment` | Keep signed proof call | Loses public score event, signature/nonce and anti-spam state | `keep-current-contract-flow` | Keep | `confirmed-by-source` |
| Labyrinth badge | Not active | 1 if activated | Inferred from source only; no active mainnet path | `inactive-or-dev-only` | Mainnet/config/product activation plus existing voucher lifecycle | Loses strict-improvement state and soulbound proof | `document-only` | None | `inactive/dev-only` |
| Dev Shop POC | No broadcast | N/A | Diagnostic only | `inactive-or-dev-only` | None | N/A | `document-only` | None | `confirmed-by-mainnet-poc` |
| Dev Treasury POC | 1 | N/A | Proven for payment transport only | `inactive-or-dev-only` | None | It already intentionally has no entitlement | `document-only` | Evidence | `confirmed-by-mainnet-poc` |

## Treasury rail compatibility

| Flow | Can use Treasury rail? | Drop-in or payment-leg only? | Needed companion system | Migration priority | Risk level | Status/confidence |
|---|---|---|---|---|---|---|
| Get Peones | Conditionally; direct rail exists, Treasury recipient is unverified | Recipient alignment of an already-direct payment; not an entitlement replacement | backend entitlement | `migrate-after-wave-0` | Medium until address/code/config, replay and recovery controls are verified | `needs-verification` |
| Lite Season Pass | Conditionally; direct rail exists, Treasury recipient is unverified | Recipient alignment only | backend entitlement | After Get Peones | Medium until the same gates pass | `needs-verification` |
| Retry Shields | Conditionally | Payment leg only | backend entitlement | Shop candidate 1 | Medium | `inferred-from-code` |
| Coach packs | Conditionally | Payment leg only | backend entitlement | Shop candidate 2 | Medium | `inferred-from-code` |
| PRO | Conditionally | Payment leg only | backend entitlement | Shop candidate 3 | Medium-high due renewal/recovery | `inferred-from-code` |
| Founder Badge | Technically possible, not drop-in | Payment leg plus canonical lifecycle redesign | lifecycle redesign + backend entitlement | Separate decision | High | `inferred-from-code` |
| Victory NFT | No as replacement | Not compatible with passive receipt | lifecycle redesign / new contract if ever pursued | Do not migrate now | Critical guarantee loss | `confirmed-by-source` |
| Piece badge claim | No | Contract claim is the product lifecycle | none; keep contract call | Do not migrate | High guarantee loss | `confirmed-by-source` |
| Optional score proof | No | Contract proof is the product lifecycle | none; keep contract call | Do not migrate | High guarantee loss | `confirmed-by-source` |
| Labyrinth badge | No | Contract claim is the intended lifecycle | claim contract (already exists on Sepolia) | Document only | High guarantee loss | `inactive/dev-only` |
| Future claim/reward eligibility | No as a generic substitute | A payment receipt proves payment, not eligibility or reward ownership | operator proof, Merkle proof, signature proof, or claim contract only after a separate threat model | Future research | High | `inferred-from-code` |

Frontend receipt verification is useful UX but is not an authoritative entitlement system. Any paid entitlement must be verified server-side or enforced by the product contract, with chain, transaction target, authenticated payer, token, recipient, exact quoted amount, receipt status, event identity, finality, and atomic replay consumption checked.

For a future Treasury-backed entitlement rail, a server-created payment intent must bind the authenticated wallet, SKU, token, exact amount, recipient/config version, expiry, and a unique intent ID **before** transfer. The authoritative verifier must use one global payment-consumption key (`chainId + txHash + chain-level logIndex`) across all SKUs and rails, and atomically consume that key with entitlement issuance. This is a proposed design gate, not current behavior. It must also reject a fallback retry unless failure is provably pre-broadcast; otherwise a provider error after submission can produce duplicate payment.

## Flows that should not use Treasury rail

### Victory NFT

`mintSigned` combines authorization, replay protection, cooldown, token selection, two `transferFrom` payments, the 80/20 treasury/prize-pool split, stored victory data, ERC-721 minting, and `VictoryMinted`. A direct transfer to Treasury performs none of those operations and sends nothing to the prize pool. It may be one payment transaction, but it is not a Victory lifecycle transaction.

Recommendation: `keep-current-contract-flow`. A deterministic one-prompt Victory mint would require major redesign or documented token authorization support that preserves atomic payment and minting; neither is available from the current contract.

### Piece badge claims

`claimBadgeSigned` validates the backend signer, deadline and unused nonce, enforces one badge per player/level, updates `hasClaimedBadge`, mints the soulbound ERC-1155, and emits `BadgeClaimed`. Treasury receipt cannot express level completion or create ownership.

Recommendation: keep the existing one-user-transaction claim.

### Score proofs

`submitScoreSigned` validates a signed score, consumes a nonce, enforces cooldown/daily limits and emits the public `ScoreSubmitted` proof. Treasury payment is unrelated to score validity. The base leaderboard path is already off-chain; the on-chain action should remain explicitly optional proof.

Recommendation: keep the existing one-user-transaction proof call.

### Labyrinth proof claims

The intended claim enforces strictly improving stars, consumes a nonce and mints a soulbound proof. A transfer cannot update `bestMintedStars` or mint the token. The mainnet/config path is inactive, so no migration is proposed.

### Future claim/reward contracts

A Treasury `Transfer` event proves that a wallet paid a token amount to a recipient. It does not prove tournament rank, campaign eligibility, an allocation, a one-time reward claim, or payout ownership. A future reward system may need an operator signature, Merkle root/proof, backend ledger, or claim contract depending on its trust model. Those are lifecycle mechanisms, not payment-rail features.

## Candidate redesigns toward 1 tx

These are architecture options only, not approved implementation work.

### Keep current flow

Use this for Badges, Scoreboard, Labyrinth claims, and Victory. Badge and score writes are already one user transaction without payment. Victory retains its guarantees even though insufficient allowance can require two transactions.

### Treasury payment plus backend entitlement

Suitable for products whose durable value can be backend canonical: Peones, Season Pass, Retry Shields, Coach credits, and PRO. Before payment, the backend must issue an expiring intent that binds authenticated wallet, SKU, exact amount, token and recipient/config version. Verification must check the direct token call and event, then atomically consume the global payment identity and grant entitlement. The design must preserve product pause/enable/token/quantity rules, support mined-but-uncredited recovery, and prevent replay or duplicate credit across Treasury and legacy Shop rails.

Founder could use this pattern only after explicitly replacing or supplementing `ItemPurchased` as its permanent canonical ownership source.

### Contract-specific claim or mint with backend signature

This is the current Badges/Scoreboard/Labyrinth pattern: the backend authorizes a payload and the user submits one contract transaction that creates public state. It is appropriate when the contract lifecycle, not payment, is the product guarantee.

### Future claim contract

For future rewards, define the trust model first. Operator signatures, Merkle proofs, or another claim proof can enable a one-transaction claim, but require replay protection, allocation semantics, expiry/revocation decisions, funding, and recovery. No such architecture is approved here.

### Permit or transfer authorization

Do not plan immediate permit use. EIP-20 does not include permit, the current Chesscito token interfaces do not use it, and the official MiniPay sources consulted here do not establish the exact message-signing and token-support combination needed for USDC, USDT, and USDm. Reconsider only after official documentation confirms support for the exact token contract and MiniPay interaction.

### Account abstraction

Account abstraction could research batching or sponsored execution in the future, but it is not a Wave 0 or first-canary dependency and does not remove the need to preserve product lifecycle guarantees.

## Recommended migration order

1. **Documentation only:** approve this audit; make no runtime change.
2. **Wave 0 controls:** block all canaries until canonical addresses, contract code/admin/owner, accepted tokens, authenticated payment intents, exact-price policy, global cross-rail replay atomicity, finality, recovery, monitoring and rollback are verified. Version price/recipient configuration and define a bounded dual-acceptance window for already-submitted payments.
3. **Get Peones canary:** align the existing direct payment recipient to verified `ChesscitoTreasury` while preserving `/api/verify-payment` and ledger semantics.
4. **Season Pass alignment:** reuse the validated direct rail after the Peones canary proves recovery and reconciliation.
5. **Shop backend-entitlement SKUs individually:** Retry Shields, Coach packs, then PRO; any temporary Shop fallback requires cross-rail deduplication and an explicit source-precedence/coexistence policy.
6. **Founder lifecycle decision:** choose whether Shop logs remain canonical or a durable backend entitlement becomes a second source.
7. **Defer lifecycle-bound flows:** Victory, badges, score proofs, Labyrinth and future reward claims remain contract-specific.

## Open questions

- Which current and future flows must remain on-chain canonical?
- Which entitlements may be backend canonical, and what availability/recovery guarantees do they require?
- Which public/config source becomes canonical for `ChesscitoTreasury`, given the two current frontend variables and server fallback?
- Which Shop address record is canonical, and how will stale `docs/contracts.md` versus current README/POC evidence be reconciled operationally?
- What are the verified owner, ProxyAdmin, implementation, signer, payout, prize-pool and recipient values on each active deployment?
- Which stablecoin contracts are supported by current MiniPay runtime and by Chesscito policy? Official source lists and runtime behavior must be reconciled before enabling each token.
- Which flows need refunds, manual reconciliation, or automated recovery after payment succeeds but entitlement fails?
- Which flows require immutable public proof rather than internal product state?
- What finality threshold is sufficient before granting irreversible entitlement?
- How are price/recipient changes versioned for transactions already pending?
- What bounded dual-acceptance window preserves payments submitted under the prior price/recipient version?
- What canonical store and transaction boundary atomically consume a global `chainId + txHash + logIndex` identity with entitlement issuance across every verifier?
- How are Shop and Treasury purchases deduplicated, and which source has precedence during coexistence and historical backfill?
- Which retry errors are provably pre-broadcast, so fee-currency fallback cannot create a second payment?
- How are Shop pause, item enablement, accepted token, quantity and historical Founder semantics preserved outside `buyItem`?
- Should overpayment remain accepted, and how are underpayment and fee-on-transfer tokens handled?
- Can current fee-currency fallbacks generate a second prompt after cancellation or provider error, and should that behavior be standardized before claiming one-prompt UX?
- For future rewards, what trust model justifies backend records, operator signatures, Merkle proofs, or a claim contract?

## Non-authorization statement

This audit does not authorize code changes, production changes, environment/configuration changes, deployments, contract upgrades, new contracts, new POCs, claims, rewards, operator systems, permit, batching, relayers, account abstraction, or migration of any flow. Its recommendations become actionable only through separately approved Wave 0 and canary specifications.
