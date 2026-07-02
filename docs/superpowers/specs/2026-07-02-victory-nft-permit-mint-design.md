# Victory NFT permit mint (`mintSignedWithPermit`) — design

Status: **proposed, not implemented**. This is Shop consolidation step 3 from
`docs/product/chesscito-treasury-unification-plan-2026-07-01.md`. Nothing in
this document is executed — no contract change, no deploy, no client code.
Scope for the session that produced this doc was spec + design only, per
explicit operator decision (see "Scope" below).

## Context

Today, claiming a Victory NFT (`VictoryNFTUpgradeable.mintSigned`) requires
two on-chain transactions from the player's wallet:

1. `approve(victoryNFTAddress, amount)` on the payment token (USDC/USDT/cUSD)
2. `mintSigned(...)` — verifies a server-issued EIP-712 voucher, pulls payment
   via two `transferFrom` calls (80% treasury / 20% prizePool), mints the
   ERC-721.

The treasury unification plan (2026-07-01) established that this is the last
payment flow in the app still requiring a separate `approve` transaction —
Shop, Get Peones, and Season Pass have all already moved to single-tx rails.
Victory NFT genuinely needs on-chain execution tied to the payment (real
ERC-721 mint + atomic split), so it cannot be reduced to a bare transfer like
the others — but it CAN drop the separate `approve` tx, because all three
accepted stablecoins on Celo Mainnet (USDC, USDT, cUSD) implement EIP-2612
`permit`, confirmed via on-chain reads (`nonces()`/`DOMAIN_SEPARATOR()` both
return real values, 2026-07-01) — and MiniPay was confirmed on a real device
to support `eth_signTypedData_v4`, the wallet RPC method `permit` signing
requires (see [[minipay-supports-typed-data-signing]]).

## Scope of this document

Confirmed with operator before writing this spec:

- **This session: spec + design only.** No contract code, no deploy (not
  even to Sepolia), no client code. Implementation is a separate future
  session, gated on red-team review of this spec (contract-change process,
  [[feedback_security_review_gate]]).
- **Rollout gating: feature flag / canary.** Mirrors the Get Peones canary
  pattern — flag default OFF, `mintSigned` (approve-based) stays live and
  unchanged as an automatic fallback, both at the contract level (function
  never removed) and the client level (falls back transparently on
  technical failure).
- **Permit domain data: read on-chain live where possible.** Refined during
  design — see "Token domain data" below; `name()` and `nonces(owner)` are
  read live, `version` needs a one-time on-chain verification pass before
  implementation because it has no standard getter guarantee.

## What this reduces, precisely

**2 on-chain transactions → 1 on-chain transaction.** Not "2 wallet prompts
→ 1 wallet prompt" — the user still sees two wallet interactions:

1. Sign the permit (EIP-712 `eth_signTypedData_v4`) — free, no gas, no
   broadcast. MiniPay renders this as a "Digital signature" screen, distinct
   from a transaction confirmation (verified live 2026-07-01).
2. Confirm `mintSignedWithPermit` — the only step that costs gas and reaches
   the chain.

`signTypedData` and `sendTransaction` are fundamentally different wallet
operations; EIP-2612 cannot collapse them into one prompt. What permit
replaces is the **second transaction** (`approve`), not the interaction
count.

## Architecture

```
Voucher fetch (fetch, no wallet) — unchanged
        │
        ▼
Read token nonce on-chain (nonces(owner), silent RPC read)
        │
        ▼
Sign EIP-2612 permit (wallet signature, free, no gas)
        │
        ▼
mintSignedWithPermit() — single broadcast tx:
  permit() → _splitPayment() [reused, unchanged] → mint
```

## Contract changes

New function on `VictoryNFTUpgradeable.sol` (new implementation behind the
same proxy — no redeploy of the proxy address, no storage layout change,
`__gap` untouched):

```solidity
function mintSignedWithPermit(
    uint8 difficulty,
    uint16 totalMoves,
    uint32 timeMs,
    address token,
    uint256 nonce,          // voucher anti-replay nonce (existing scheme)
    uint256 deadline,       // voucher deadline
    bytes calldata signature,     // server voucher signature (existing scheme)
    uint256 permitDeadline, // token permit deadline
    uint8 v,
    bytes32 r,
    bytes32 s               // user's EIP-2612 permit signature
) external whenNotPaused nonReentrant {
    // Same validation as mintSigned: difficulty/moves/time/voucher-deadline/
    // voucher-nonce/cooldown/token-accepted/price, then _verifySignature(...)
    // identical to mintSigned.

    usedNonces[msg.sender][nonce] = true;
    lastMintAt[msg.sender] = block.timestamp;

    uint256 totalAmount = _normalizePrice(price, tokenDecimals);
    IERC20Permit(token).permit(msg.sender, address(this), totalAmount, permitDeadline, v, r, s);
    _splitPayment(token, totalAmount); // reused unchanged — permit() just granted the allowance it needs

    // Mint block identical to mintSigned
}
```

Key decisions:

- **New function, `mintSigned` byte-identical and untouched.** Considered
  unifying into one function with optional permit params; rejected — that
  would touch the function currently in production handling real funds,
  raising review/deploy risk for no real benefit. Additive-only change,
  isolated diff for red-team review.
- **Two distinct nonce spaces, not to be confused**: the voucher `nonce`
  (server-issued, anti-replay for the mint call itself, existing scheme) and
  the token's own EIP-2612 nonce (internal to the token, consumed by
  `permit()`). The spec and the client code name these distinctly.
- **Permit value is the exact `totalAmount` for this mint**, not a standing
  allowance — spent immediately in the same transaction, no leftover
  approval left on the token afterward.
- **No new storage.** Only a new import (`IERC20Permit` from OpenZeppelin)
  and the function itself.
- **Reverts bubble unwrapped.** If the token's `permit()` reverts (expired
  signature, wrong nonce, already used), the revert propagates as-is — same
  style as `transferFrom` failures today, no wrapper error.
- **Same guards**: `whenNotPaused`, `nonReentrant`, identical to `mintSigned`.

## Token domain data (client-side)

To sign a permit, the client needs the token's EIP-712 domain (`name`,
`version`, `chainId`, `verifyingContract`) and the owner's current nonce.

- `name()` — standard ERC-20 getter, safe to read live via `wagmi`.
- `nonces(owner)` — mandated by EIP-2612, MUST be read live (changes per
  wallet, per permit use) — never cached, never hardcoded.
- `chainId` / `verifyingContract` (= token address) — already known.
- `version` — **no standard getter is guaranteed.** Some tokens expose
  `eip712Domain()` (EIP-5267) which returns it directly; others don't expose
  anything reconstructible on-chain. **Before implementation**, a one-time
  read-only verification pass is required against USDC/USDT/cUSD on Celo
  Mainnet (same kind of check already done 2026-07-01 for
  `nonces()`/`DOMAIN_SEPARATOR()`) to confirm each token's actual domain
  version, then hardcode `version` per token in `lib/contracts/tokens.ts`
  alongside existing `address`/`decimals` metadata.

## Client changes

- **Feature flag**: `NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED` +
  `isVictoryPermitMintEnabled()` in `lib/feature-flags.ts` — mirrors the
  existing Get Peones canary pattern
  (`isGetPeonesCanaryClientRequested()`/`NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED`).
  Default OFF.
- **`useMintVictory` flow** (`apps/web/src/lib/coach/use-mint-victory.ts`),
  after voucher fetch + token selection (both unchanged):
  - If flag ON and the selected token is permit-capable (all three accepted
    tokens are, per the 2026-07-01 verification): read `nonces(owner)`,
    build the domain + `Permit` type, sign via `signTypedDataAsync` (or
    `injected.sendPermit` for tests/VR), split the returned signature into
    `v/r/s`, call `mintSignedWithPermit` (or `injected.sendMintWithPermit`).
  - If flag OFF, or the permit step fails for a **technical** reason
    (unsupported, nonce read failure, etc.): fall back transparently to the
    existing `approve` + `mintSigned` path, in the same click — no extra
    user-visible state, no second manual attempt required.
  - If the user **explicitly rejects** the permit signature: treat as
    `cancelled`, same as an `approve` rejection today. No forced fallback
    prompt after an intentional rejection.
- **New injected overrides** on `MintVictoryInjected` (mirrors existing
  `sendApprove`/`sendMint` pattern, for VR fixtures + tests): `sendPermit`
  and `sendMintWithPermit`.
  - Note: the existing `sendSig` field on `MintVictoryInjected` is declared
    but not wired into `start()` today — pre-existing orphaned scaffolding,
    unrelated to this feature, not touched by this spec.
- **Telemetry**: add `payment_path: "permit" | "approve"` to the existing
  `onClaimTelemetry` events, to monitor canary adoption the same way Get
  Peones was monitored.
- **ABI**: new `mintSignedWithPermit` entry in `lib/contracts/victory.ts`.

## Error handling

- Token-level permit reverts (e.g. OZ's `ERC2612ExpiredSignature`,
  `ERC2612InvalidSigner`, or legacy require-string equivalents depending on
  token implementation) bubble unwrapped — `classifyTxErrorKind` needs a new
  recognized case for these so the user sees a translated message instead of
  an opaque fallback, mirroring the existing
  `/No token with sufficient balance/i` special-case.
- Client applies the same 30s expiry buffer pattern already used for the
  voucher deadline to the permit deadline before submitting.
- Optional cheap self-check: `recoverTypedDataAddress` (viem) against the
  freshly-produced signature before submitting, to catch a malformed
  signature locally instead of waiting for an on-chain revert (same
  technique the `/dev/permit-probe` already uses).
- Double-submit races are already covered by the existing `claimingRef`
  single-flight guard — no new code needed.
- If the permit path fails technically AND the fallback `approve` +
  `mintSigned` also fails, the error surfaces exactly as it does today (same
  `error` phase, same classification) — no new state.
- Contract pause (`whenNotPaused`) behaves identically on both functions.

## Testing plan

**Contract** (`apps/contracts/test/VictoryNFT.ts`, extended):

- Happy path against a mock `ERC20Permit` token: mint succeeds, 80/20 split
  correct, permit consumed exactly once.
- Mirror all existing `mintSigned` rejection cases (invalid/expired voucher,
  reused voucher nonce, cooldown, unaccepted token) against the new
  function.
- Reject expired permit deadline / invalid permit signature / reused permit
  nonce — token-level revert bubbles correctly.
- **Mandatory regression**: full existing `mintSigned` suite passes
  unchanged — zero behavior diff on the already-audited path.
- Storage-layout validation via `@openzeppelin/hardhat-upgrades`, same
  mechanism used for prior Shop/Badges/VictoryNFT upgrades.

**Client** (`use-mint-victory.test.ts`, extended):

- Flag OFF → always legacy path (all existing tests keep passing untouched).
- Flag ON + permit succeeds → `sendPermit` + `sendMintWithPermit` called,
  `sendApprove`/`sendMint` never called.
- Flag ON + technical permit failure → transparent fallback to
  `sendApprove`+`sendMint` in the same `start()` call.
- Flag ON + user rejects permit signature → `cancelled` phase, no forced
  fallback.
- [[mint-hook-gameid-scoping]] regression on the new path.
- `payment_path` present in telemetry for both paths.

**E2E/VR**: no new visual baseline needed — the flow has no new UI, only a
different mechanism underneath. Real-chain verification (Sepolia first, then
Mainnet) happens during implementation, not as part of this spec.

## Rollout (out of scope for this session — documented for the implementation session)

1. Red-team review of the contract diff (separate session, standing 4-step
   contract-change process, [[feedback_security_review_gate]]).
2. Deploy new implementation to the existing Sepolia proxy, run full suite +
   one real testnet mint via permit.
3. Deploy to the Celo Mainnet proxy (same address, new implementation) —
   flag stays OFF by default, zero user-facing impact at deploy time.
4. Enable the flag for the founder wallet in Preview, one real small mint,
   confirm single-tx behavior and the fallback path both work.
5. Enable in Production.
6. `mintSigned` is never removed from the contract. Whether (and when) to
   deprecate the client's `approve` path is a decision for after the permit
   path is proven in real production use — not part of this plan.

## Explicitly out of scope

- Any change to `mintSigned` itself.
- Any change to pricing, the 80/20 split ratio, or the accepted-token list.
- Percentage-based / cohort rollout — the founder is currently the only real
  trafficker in Production ([[production-as-personal-staging]]), so a binary
  flag is sufficient; no gradual-rollout infrastructure needed.
- Deprecating or removing the `approve`+`mintSigned` client path.
- Any work on Shop consolidation step 4 (canary flag retirement) — separate,
  unrelated backlog item.
