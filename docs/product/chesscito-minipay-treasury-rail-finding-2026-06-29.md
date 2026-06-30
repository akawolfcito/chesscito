# Chesscito MiniPay Treasury Rail: Finding and Controlled Migration Plan

- **Date:** 2026-06-29
- **Status:** Finding confirmed; migration not started
- **Scope:** Documentation and migration planning only
- **Source snapshot:** `db37ad5a2865ba65ca1f409897e46b407b4723a2`

## Executive finding

The two mainnet POC paths answer two different questions:

1. The current `ShopUpgradeable.buyItem` path cannot charge a wallet with zero allowance. Calling `buyItem(1, 1, USDT)` without first approving the Shop failed during gas estimation with `ERC20: transfer amount exceeds allowance`.
2. A MiniPay wallet successfully sent USDT to `ChesscitoTreasury` in one broadcast user transaction without `approve` and without calling Shop.

**Conclusion:** the MiniPay single-user-transaction Treasury rail is viable as a payment rail. This does not prove that `ShopUpgradeable.buyItem` can remove `approve`, and it does not replace the Shop item-purchase lifecycle.

The successful transaction was a call to the **USDT token contract**:

```text
USDT.transfer(ChesscitoTreasury, 10_000)
```

`ChesscitoTreasury` was the recipient recorded in the USDT `Transfer` event. The wallet did not call a user-facing function on `ChesscitoTreasury`, and the Treasury contract executed no receive callback or payment logic. Standard ERC-20 `transfer` does not notify the recipient contract.

## Mainnet evidence

The exact values below are session evidence supplied after running the isolated MiniPay POC. They were not inferred from repository configuration.

### Evidence limits

- `confirmed-by-mainnet-poc` means the result was observed and supplied from the mainnet POC session. It was not independently reproduced or explorer-verified during this documentation task.
- The Treasury evidence confirms one successful broadcast transaction and matching event. It does not independently record the MiniPay version, number of wallet prompts, block number, block timestamp, confirmation depth, or gas-payment details.
- The Shop evidence is an `eth_estimateGas` revert against the configured mainnet path, not a mined transaction. It proves the simulated `buyItem` call could not proceed with zero allowance; it does not claim an on-chain failed receipt.
- The Treasury amount is independently interpretable as `0.01 USDT` because Chesscito's source config treats this USDT address as a six-decimal token. Runtime token metadata should still be checked before a production rollout.

### Shop no-approve baseline

| Field | Result |
|---|---|
| Status | Failed before broadcast during `eth_estimateGas` |
| Chain | Celo Mainnet (`42220`) |
| Wallet | `0xCc4179A22b473Ea2eB2B9b9b210458d0F60Fc2dD` |
| User tx target | Shop contract `0x24846C772af7233ADfD98b9A96273120f3a1f74b` |
| Function | `buyItem(1, 1, USDT)` |
| Token | USDT `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` |
| Allowance before | `0` |
| Error | `ERC20: transfer amount exceeds allowance` |
| Tx hash | None; transaction was not broadcast |
| Classification | Current Shop path still requires approval when allowance is insufficient |
| Confidence | `confirmed-by-mainnet-poc` |

This result is specific to the existing Shop implementation: `buyItem` calls `safeTransferFrom(msg.sender, treasury, totalAmount)`, so the Shop must have sufficient allowance.

### Treasury transfer POC

| Field | Result |
|---|---|
| Status | Success |
| Receipt status | Success |
| Chain | Celo Mainnet (`42220`) |
| Tx hash | `0xa7ab550ca799c139b0c00098f07e19c38156d7808537ae6f9bf0671d55d24b2b` |
| Wallet / `Transfer.from` | `0xCc4179A22b473Ea2eB2B9b9b210458d0F60Fc2dD` |
| User tx target | USDT token contract `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` |
| Function | `transfer(ChesscitoTreasury, 10_000)` |
| Treasury / `Transfer.to` | `0xCD3837DD017dFA5E31A2e3Cf390721E16Ac8Fbf0` |
| Amount | `0.01 USDT` (`10_000` raw units) |
| Transfer log index | `22` |
| Approve skipped | Yes |
| Shop skipped | Yes |
| Classification | `single-user-tx treasury payment viable` |
| Confidence | `confirmed-by-mainnet-poc` |

The payment proof is the USDT contract's `Transfer` event with the expected token address, sender, Treasury recipient, and amount. `ChesscitoTreasury` does not emit a custom payment event for a direct ERC-20 transfer.

## Status and confidence labels

- `confirmed-by-mainnet-poc`: directly observed in the supplied Celo Mainnet POC result.
- `confirmed-by-source`: behavior is explicit in the current repository source.
- `inferred-from-code`: migration suitability follows from multiple code paths but has not been exercised end to end.
- `inactive/dev-only`: implementation or tooling exists but is not an active production user flow.
- `needs-verification`: current runtime/deployment state cannot be established from versioned source alone.

Each inventory row uses exactly one primary label. A label confirms the row's stated current mechanism; it does not imply that a proposed migration has been tested.

## Current on-chain flow inventory

| Flow | Current mechanism | User tx target | Requires approve | Can use Treasury rail | Needs backend entitlement | Needs contract claim/proof | Migration priority | Status / confidence |
|---|---|---|---|---|---|---|---|---|
| Get Peones pack | `ERC20.transfer(configuredTreasury, amount)`; `/api/verify-payment` verifies the receipt and credits the Peones ledger | **Token contract call**; configured Treasury is recipient only | No | Yes; direct recipient alignment to `ChesscitoTreasury` | Yes: payment verification, idempotency, and Peones credit | No | **Wave 1 / highest** | `confirmed-by-source` |
| Lite Season Pass | `ERC20.transfer(configuredTreasury, amount)`; `/api/verify-payment` creates the pass and credits shields | **Token contract call**; configured Treasury is recipient only | No | Yes; direct recipient alignment to `ChesscitoTreasury` | Yes: pass, expiry, supporter status, and shields | No | **Wave 1 / high**, after Peones canary | `confirmed-by-source` |
| Retry Shields, Shop item `2` | Allowance check, conditional `ERC20.approve`, then `Shop.buyItem`; `/api/credit-shield` verifies `ItemPurchased` and credits shields | Approve targets token contract; purchase targets **Shop contract**; Shop treasury is recipient only | Yes, when current allowance is insufficient | Conditional; replace only the payment leg and adapt verification | Yes: shield credit and reconciliation must remain | Current proof is Shop `ItemPurchased`; a rail version would use verified `Transfer` instead | **Wave 2 / high** | `confirmed-by-source` |
| Coach packs 5/20, Shop items `3/4` | Allowance check, conditional `approve`, then `Shop.buyItem`; `/api/coach/verify-purchase` credits Redis | Approve targets token contract; purchase targets **Shop contract** | Yes, when allowance is insufficient | Conditional; good payment-leg candidate | Yes: idempotent Coach credit grant | Current proof is Shop `ItemPurchased`; no new contract claim is needed for a rail version | **Wave 2 / high** | `confirmed-by-source` |
| Chesscito PRO, Shop item `6` | Conditional `approve`, `Shop.buyItem`, then `/api/verify-pro` activates or extends the server-side TTL | Approve targets token contract; purchase targets **Shop contract** | Yes, when allowance is insufficient | Conditional; payment can move, activation cannot be removed | Yes: PRO activation, expiry, idempotency, and recovery | Current proof is Shop `ItemPurchased`; no contract claim is required after a rail redesign | **Wave 2 / medium** | `confirmed-by-source` |
| Founder Badge, Shop items `1/5` | Conditional `approve` then `Shop.buyItem`; permanent Founder status is derived from canonical `ItemPurchased` logs and cached server-side | Approve targets token contract; purchase targets **Shop contract** | Yes, when allowance is insufficient | **Not drop-in.** A future Treasury payment plus durable backend entitlement is possible, but it would create a new canonical lifecycle | Yes for any future rail design; current status derives from Shop logs | Current canonical proof is Shop `ItemPurchased`; future rail would need an explicitly designed durable entitlement source | **Wave 3 / product decision** | `confirmed-by-source` |
| Victory NFT | Conditional token `approve`, then signed `VictoryNFT.mintSigned`; contract performs two `transferFrom` calls, an 80/20 split, nonce consumption, and NFT mint | Approve targets token contract; mint targets **VictoryNFT contract**; treasury and prize pool are recipients only | Yes, when allowance is insufficient | No direct substitution; a bare Treasury payment omits the split and atomic mint lifecycle | Cache/persistence follows the mint, but the entitlement is the NFT | Yes: signed mint, nonce, victory proof, NFT, and payment split | **Deferred / do not migrate** | `confirmed-by-source` |
| Piece badge claim | Backend signature followed by `Badges.claimBadgeSigned` | **Badges contract call** | No | No; this is a claim, not a payment | No payment entitlement | Yes: signed on-chain badge claim/mint | **Not applicable** | `confirmed-by-source` |
| On-chain score proof | Backend signature followed by `Scoreboard.submitScoreSigned`; Exercises also caches the result | **Scoreboard contract call** | No | No; this is an optional proof write, not a payment | No payment entitlement; DB cache is separate | Yes: signed score proof | **Not applicable** | `confirmed-by-source` |
| Labyrinth badge | Contract and signing endpoint exist, but no active frontend consumer of `claimLabyrinthSigned` was found | Would be a **LabyrinthBadges contract call** | No | No; claim/proof flow | No payment entitlement | Yes: signed claim, stars/policy, and mint | **Inactive; verify before roadmap use** | `inactive/dev-only` |
| Dev Shop no-approve POC | Direct `Shop.buyItem(1, 1, token)` with no preceding approval | **Shop contract call**; Shop treasury is recipient only | Approval deliberately skipped; call failed at zero allowance | Diagnostic only | No new entitlement path | Exercises current Shop lifecycle if it succeeds | **No migration** | `confirmed-by-mainnet-poc` |
| Dev Treasury contract POC | One explicit `ERC20.transfer(ChesscitoTreasury, 10_000)` with local receipt/event verification | **Token contract call**; `ChesscitoTreasury` is recipient only | No | Yes; this is the isolated proof | None; the POC grants no product | No | **Evidence only** | `confirmed-by-mainnet-poc` |
| Dev direct-rail smoke | Direct token transfer followed by `/api/verify-payment` | **Token contract call**; configured treasury is recipient only | No | Yes; smoke coverage for existing direct rail | Yes: Peones credit | No | **Dev verification only** | `inactive/dev-only` |
| Admin contract operations | Generic CLI simulates and sends an owner-selected ABI write with audit logging | **Selected managed contract call** | No ERC-20 approval as a generic prerequisite | No; operational writes are not user payments | No user entitlement | Depends on selected admin function | **Outside payment migration** | `confirmed-by-source` |

### Inventory boundaries

- `welcomePackage.claim()` and the Lite welcome gift are local/backend flows, not user on-chain writes, so they are not Treasury migration candidates.
- `lib/minipay/rawTx.ts` is a generic transaction helper; no active production write flow consuming it was found.
- Contract deployment/configuration scripts are manual operational writes, not payment flows. They remain outside the user rail.
- The actual runtime recipient type of the existing generic direct rail depends on environment configuration and must be checked before migration. Source confirms the token-call mechanism, not whether the current configured recipient is an EOA or contract.
- The legacy `ExercisesScreen` still contains Shop, badge, and score writes in addition to extracted hooks. Any future migration must inventory both surfaces before rollout.

## Controlled migration plan

This is a plan only. No migration is authorized by this document.

### Wave 0: establish migration controls

Before changing any production recipient or verifier:

1. Verify the deployed `ChesscitoTreasury` bytecode, owner, payout address, accepted-token metadata, and withdrawal runbook.
2. Define one canonical client/server Treasury address source and fail closed on mismatch.
3. Keep `acceptedToken` as metadata and a frontend safety gate. Do not treat it as on-chain receipt enforcement.
4. Require backend proof of receipt success plus a documented confirmation/finality threshold before granting an irreversible entitlement. Define how an orphaned or reorganized receipt is handled.
5. Decode transaction calldata and require a direct ERC-20 `transfer(address,uint256)` call: the transaction target must equal the accepted token contract, `tx.from` must equal the authenticated Chesscito wallet receiving the entitlement, and delegated `transferFrom` movement must be rejected.
6. Verify the accepted token address, Treasury recipient, SKU-decided minimum amount, and one unambiguous matching `Transfer` log. The current rail permits overpayment (`amount >= expected`); underpayment is rejected and overpayment does not change the entitlement.
7. Define `logIndex` as the chain receipt log's canonical `logIndex`, not its array position. If multiple logs satisfy the same proof and the client did not identify one unambiguously, reject the claim rather than choose implicitly.
8. Atomically consume a global payment identity `chainId + txHash + logIndex` with entitlement issuance. A database uniqueness check that races separately from the grant is insufficient.
9. Bind each payment attempt to a server-known SKU, price, recipient, wallet, and validity window before broadcast. A plain `Transfer` does not carry a SKU; if strict on-chain intent is required, this rail alone is insufficient and rollout must stop for a separate design decision.
10. Version recipient and price configuration so a payment broadcast before a configuration change remains verifiable under its original terms.
11. Define a concrete reconciliation path for mined-but-uncredited payments: idempotent user resubmission of the tx hash plus an operational recovery path that uses the same verifier and global consumption record.
12. Restrict rollout to vetted configured stablecoins. Fee-on-transfer, rebasing, paused, blacklisted, or behavior-changing tokens require separate validation and are not implied safe by an accepted address alone.
13. Record and audit who controls `acceptedToken`, and require client metadata, backend allowlist, and Treasury metadata to be reconciled before enabling a token.

### Wave 1: align existing direct rails

Start with **Get Peones**, then **Lite Season Pass**. Both already use the correct MiniPay primitive: one token-contract `transfer` followed by server-side verification.

The controlled change would be limited to making their configured recipient consistently point to the deployed `ChesscitoTreasury`, while preserving the existing token call, exact SKU amount, verifier, ledger/pass logic, and idempotency. The frontend should additionally confirm the selected token is marked accepted before enabling payment; the backend must still independently validate its allowlist.

Roll out one SKU as a canary. Confirm payment receipt, entitlement delivery, duplicate handling, recovery after verifier failure, and owner withdrawal to payout before enabling the second SKU. The contract source confirms owner recovery is permitted for both accepted and accidentally sent unsupported ERC-20 tokens; deployment state must still be verified in Wave 0.

### Wave 2: move payment legs for backend-entitlement Shop SKUs

Evaluate Retry Shields, Coach packs, and PRO independently. For each SKU:

1. Keep the existing Shop path available during validation, with explicit coexistence semantics for repeated purchases, extensions, and historical entitlements. Separate Shop and direct-transfer transactions are separate payments and must never be silently merged.
2. Add a direct-transfer proof format to the server verifier rather than trusting the client POC.
3. Preserve the existing credit/activation logic and reconciliation behavior.
4. Bind the expected amount and product to server-side SKU configuration.
5. Prevent cross-SKU and cross-endpoint replay globally.
6. Canary one SKU and compare entitlement success and support/recovery rates against Shop.

This wave removes `approve` only from the newly selected direct-transfer payment path. It does not modify or prove removable the approval requirement of `ShopUpgradeable.buyItem` itself.

### Wave 3: make an explicit Founder lifecycle decision

Founder has two distinct possibilities:

- **Current canonical lifecycle:** `Shop.buyItem` plus `ItemPurchased`. This is not a drop-in Treasury candidate because Founder status currently depends on Shop logs.
- **Possible future lifecycle:** direct Treasury payment plus a durable backend entitlement keyed to the verified transfer. This is technically plausible because Founder is not currently an NFT, but it requires a product/data migration decision, coexistence rules for historical Shop purchasers, idempotent status storage, and a revised `founder-status` source of truth.

Do not bundle Founder into Wave 2 without approving that lifecycle change explicitly.

### Deferred contractual flows

Do not migrate Victory NFT, piece badges, score proofs, or Labyrinth claims to this rail. Their user transaction invokes contract logic that creates or validates the product/proof. A passive Treasury receipt cannot replace that logic.

Victory additionally requires an atomic 80/20 treasury/prize-pool split and signed NFT mint. The current POC proves neither behavior.

## Release gates and rollback

A future production migration should not advance unless all applicable gates pass:

- Mainnet MiniPay canary confirms one wallet prompt, successful direct token call, and verified event.
- Backend rejects wrong chain, wrong token, wrong function selector, wrong transaction target, unauthenticated or mismatched sender, wrong recipient, insufficient amount, reverted or insufficiently final receipt, ambiguous/missing event, and replay.
- Entitlement delivery is idempotent and recoverable after client/network interruption.
- Existing Shop purchases remain valid and historical entitlements remain readable.
- Treasury owner can withdraw accepted and accidentally sent unsupported ERC-20 tokens to the configured payout address.
- Monitoring distinguishes payment success from entitlement success.
- A rollback can disable new rail payment creation and restore the unchanged legacy path without changing deployed contracts. The historical verifier and reconciliation path must remain available through a defined cutoff so already-mined payments are not stranded.

## Explicit non-goals

This document does not:

- replace `ShopUpgradeable.buyItem`;
- change the Shop production flow or remove its approval step;
- change contracts, ABIs, addresses, tokens, treasury configuration, UI, APIs, or environment variables;
- deploy or upgrade any contract;
- implement claims, rewards, registry, operator proofs, relayers, permit, batching, account abstraction, or backend signing;
- authorize a production release.

## Source map

- Treasury POC: `apps/web/src/app/dev/minipay-no-approve-poc/treasury-transfer-section.tsx`
- Shop POC: `apps/web/src/app/dev/minipay-no-approve-poc/minipay-no-approve-poc-client.tsx`
- Treasury contract: `apps/contracts/contracts/ChesscitoTreasury.sol`
- Shop contract: `apps/contracts/contracts/ShopUpgradeable.sol`
- Shop frontend: `apps/web/src/lib/shop/use-shop-sheet-state.ts`
- PRO purchase helper: `apps/web/src/lib/pro/purchase.ts`
- Direct payment rail: `apps/web/src/lib/payments/use-payment-rail.ts`
- Season Pass rail: `apps/web/src/lib/season-pass/use-season-pass-rail.ts`
- Direct-payment verifier: `apps/web/src/app/api/verify-payment/route.ts`
- Retry Shield verifier: `apps/web/src/app/api/credit-shield/route.ts`
- Coach purchase verifier: `apps/web/src/app/api/coach/verify-purchase/route.ts`
- PRO verifier: `apps/web/src/app/api/verify-pro/route.ts`
- Founder status: `apps/web/src/app/api/founder-status/route.ts`
- Victory mint: `apps/web/src/lib/coach/use-mint-victory.ts`
- Badge claim: `apps/web/src/lib/badges/use-badge-sheet-state.ts`
- Score/legacy writes: `apps/web/src/components/exercises/exercises-screen.tsx`
- Profile claim queue: `apps/web/src/components/profile/profile-sheet.tsx`
- Admin write runner: `apps/admin/src/lib/tx-runner.ts`

## Final conclusion

The mainnet POC confirms a MiniPay-friendly payment primitive: the user can call a stablecoin contract once and transfer funds directly to `ChesscitoTreasury` without ERC-20 approval. Proof is the token contract's `Transfer` event to the Treasury contract.

`ChesscitoTreasury` adds explicit owner/payout custody and withdrawal controls compared with an EOA recipient. It does not make the token's transfer logs more visible, observe the transfer, emit a custom payment event, identify a SKU, or grant an entitlement. Those responsibilities remain in receipt verification and the product-specific backend or contract lifecycle.

Therefore, Chesscito's existing direct-transfer products are the first migration candidates once Wave 0 gates pass. The rail is conditionally suitable for products whose delivery is already backend-managed and is not a direct substitute for lifecycle-bound contract calls.
