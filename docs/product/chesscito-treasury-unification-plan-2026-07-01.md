# ChesscitoTreasury unification — plan (2026-07-01)

Status: **proposed, not started**. Nothing in this plan has been executed.
Requires explicit approval per surface before any env/config/on-chain change.

## Context

The Get Peones Treasury canary (`0xcD3837DD017dFA5E31A2e3Cf390721E16Ac8Fbf0`,
owner/payout Safe `0x917497b64eeB85859edcf2e4ca64059eDfeC1923`) is now proven
live end-to-end: real MiniPay purchase, real on-chain custody, real
withdrawal recoverability (see
`docs/ops/get-peones-treasury-canary-operational-checklist-2026-06-30.md`).

Separately, three other money-moving surfaces exist today, all already
terminating at the **same Safe**, but through different mechanisms:

| Surface | SKU/item | Current recipient | Mechanism |
| --- | --- | --- | --- |
| Shop | PRO / Founder / Shield | Safe directly (`ShopUpgradeable.treasury`, settable) | `IERC20.safeTransferFrom(buyer, treasury, amount)` (needs prior `approve`) |
| Legacy Get Peones | `peones_pack_50` (no canary flag) | Safe directly, via `CHESSCITO_TREASURY_ADDRESS` / `TREASURY_ADDRESS` env (confirmed live 2026-07-01 against Production — passes the fail-closed gate and reaches real on-chain receipt lookup) | `ERC20.transfer(treasury, amount)` (single-tx, no approve) |
| Season Pass | `lite_season_pass_21` | Same env vars as legacy Get Peones (shared rail-config) | Same single-tx transfer |
| Get Peones canary | `peones_pack_50` (canary flag ON) | `ChesscitoTreasury` contract, dedicated env vars | Same single-tx transfer |

Correction on record: an earlier check in this session concluded the legacy
treasury vars were unset in Production, based on `vercel env pull` showing
empty strings. That was wrong — those vars are marked **Sensitive** in
Vercel, which makes the CLI/API always show them blank regardless of the
real value. Verified instead by hitting the real `/api/verify-payment`
endpoint on `play.chesscito.com`: it passed the treasury fail-closed gate and
reached real on-chain lookup (`receipt_not_found` for a garbage tx, not
`rail_not_configured`). The legacy treasury is live and already points at the
same Safe as everything else (operator-confirmed).

## Why unify

All four surfaces already end up controlled by the same Safe. The
`ChesscitoTreasury` contract adds one thing none of the others have: a
single audited, source-verified, `Ownable2Step` custody layer with
token-allowlist metadata and a uniform `withdrawToken` / `withdrawTokenToPayout`
recovery path — already proven with real funds and a real recovery today.
Consolidating onto it trades three different ad-hoc integration points for
one.

## Approve-elimination feasibility (2026-07-01 update)

Operator's actual goal is broader than unifying custody: reduce every paid
flow to one transaction, and separate "money-sending" transactions from
"contract-execution" transactions. Audited every payment-touching contract to
answer: which flows are genuinely money-only (already single-tx capable) vs.
which genuinely require on-chain execution tied to the payment (mint, atomic
split), and whether the latter can also drop the separate `approve` step.

**Corrected inventory** (operator's initial list included some flows that
turned out not to be paid at all):

| Flow | Payment? | Mechanism today | Can it be single-tx? |
| --- | --- | --- | --- |
| Get Peones (legacy + canary) | Yes, $0.50 | `ERC20.transfer` | Already yes (canary proven) |
| Season Pass | Yes, $1.99 | `ERC20.transfer` | Already yes, mechanism-wise |
| Shop (PRO/Founder/Shield) | Yes | `approve` + `buyItem` (`transferFrom`) | **Yes — see below, no permit needed** |
| Victory NFT mint | Yes, $0.005–$0.02 | `approve` + `mintSigned` (`transferFrom` x2, atomic 80/20 split, real ERC-721 mint) | **Conditionally yes, via EIP-2612 permit — see below** |
| Badges (soulbound) | **No** — free, EIP-712 voucher claim only | n/a | n/a |
| Labyrinth badges | **No** — free, voucher claim only | n/a | n/a |
| Save game (`/api/scores/save`) | **No** — free | n/a | n/a |
| Coach analysis | **No per-use fee** — gated by one-time PRO status (a Shop purchase), not paid per analysis | n/a | n/a |

So the real scope is smaller than it first looked: only **Shop** and
**Victory NFT minting** are payment flows that still require a separate
`approve` transaction today. Badges, Labyrinth badges, save, and Coach
analysis were never payment flows to begin with.

### Shop: the approve step can be removed entirely, no permit needed

`ShopUpgradeable`'s own docstring: *"Entitlements are handled off-chain via
the `ItemPurchased` event."* Confirmed by reading the contract: there is no
on-chain inventory, no minted token, no persisted per-user state at all — the
entire contract does is pull payment via `transferFrom` and emit an event
that the backend listens to. This means Shop does not need a contract call
in the first place. It can be migrated to the **exact same architecture as
Season Pass/Peones**: user sends a single `ERC20.transfer(ChesscitoTreasury,
amount)` (no approve), backend verifies the `Transfer` event on-chain against
an intent (itemId + expected amount), and grants PRO/Founder/Shield the same
way it already grants Peones/Season Pass entitlements. This is strictly
better than the originally-proposed `setTreasury()` swap (step 1 below is
revised accordingly) — it removes the approve step, not just changes the
destination.

### Victory NFT: genuinely needs on-chain execution, but permit can still remove the approve tx

Unlike Shop, `VictoryNFTUpgradeable.mintSigned` does real, load-bearing
on-chain work tied to the payment: it mints an actual ERC-721 (the token must
exist on-chain) and enforces the 80/20 treasury/prizePool split atomically in
the same transaction the backend's EIP-712 voucher authorizes. This cannot be
reduced to a bare transfer without either minting separately (still 2 txs,
just reordered) or weakening the atomic split guarantee to an off-chain
process (not recommended — the on-chain split is a real trust property worth
keeping).

Checked on-chain (2026-07-01, read-only, Celo Mainnet) whether the accepted
stablecoins support **EIP-2612 `permit`** (a signature-based approval that
does not need its own transaction — the mint function itself would call
`permit()` then `transferFrom()` internally, given the signature as calldata):

| Token | `nonces(address)` | `DOMAIN_SEPARATOR()` | Permit-capable |
| --- | --- | --- | --- |
| USDT | returns `0` successfully | returns a real domain hash | Yes |
| USDC | returns `0` successfully | returns a real domain hash | Yes |
| cUSD | returns `0` successfully | returns a real domain hash | Yes |

All three do. This means **removing the approve transaction for Victory NFT
minting is technically feasible**, via a new `mintSignedWithPermit(...,
uint8 v, bytes32 r, bytes32 s, uint256 permitDeadline)` function added to
`VictoryNFTUpgradeable` (it is an upgradeable proxy — a new implementation
can add this without losing the existing address, state, or minted tokens).
The mint becomes one on-chain transaction; the "approve" becomes a signature
the user's wallet produces (no separate broadcast tx, no separate gas).

**Open unknown, must be validated before committing to this path**: whether
MiniPay's wallet can produce a valid `eth_signTypedData_v4` signature for the
permit message. [[minipay-supports-personal-sign]] only confirms
`personal_sign` (verified 2026-06-12); typed-data signing (`eth_signTypedData_v4`,
what permit requires) is a different RPC method and has not been tested.
This is a cheap, low-risk spike — a `/dev/permit-probe`-style page asking
MiniPay to sign an EIP-2612 typed-data message and checking the recovered
signer matches — and it should happen **before** any contract-upgrade work,
since it gates whether the whole permit approach is viable for MiniPay users
specifically (desktop/MetaMask wallets support typed-data signing already,
this is purely a MiniPay WebView question).

## What does NOT need to change

- The Safe itself, its owner set, `payoutAddress` — unchanged throughout.
- Any contract redeploy — `ChesscitoTreasury` already exists and is already
  the target; `ShopUpgradeable.setTreasury` is an existing owner-only setter,
  no upgrade needed.
- The single-tx transfer mechanism for Season Pass / Peones (`ERC20.transfer`)
  — a plain ERC20 transfer works identically whether the recipient is an EOA
  or a contract; `ChesscitoTreasury` does not need to "opt in" to receive
  funds (its `acceptedToken` mapping is app-layer metadata only, not enforced
  on-chain — confirmed from the contract's own docstring).

## Proposed order (lowest risk / highest information value first)

### 0. MiniPay `eth_signTypedData_v4` probe (do this first — cheap, gates step 3)

- A `/dev`-only page, same pattern as the existing `/dev/sign-probe`: ask
  MiniPay to sign a throwaway EIP-712 typed-data message, recover the signer,
  confirm it matches the connected address. No contracts touched, no funds
  moved. Answers whether the Victory NFT permit path (step 3) is viable at
  all before investing in a contract upgrade for it.

### 1. Shop → migrate to the no-approve single-tx rail (revised from `setTreasury`)

- Since Shop's "execution" is only an event (no on-chain state, confirmed
  above), reuse the Season Pass/Peones architecture directly: new intent
  endpoint (`/api/payment-intents/shop` or similar) + client sends
  `ERC20.transfer(ChesscitoTreasury, amount)` directly (no approve) + backend
  verify route grants the item the same way `/api/verify-payment` already
  grants Peones/Season Pass. `ShopUpgradeable.buyItem` stays deployed
  untouched as a fallback/legacy path during rollout, retired later once the
  new path is proven — same staged pattern as the canary itself.
- This is a real, if small, app-code change (new intent+verify routes mirroring
  the existing rail, reusing `rail-config.ts` conventions) — not a pure config
  flip like the original `setTreasury`-only proposal. Test the same way as
  every other flow this session: real small purchase, on-chain balance
  before/after, in-app entitlement confirmed.
- `ShopUpgradeable.setTreasury` remains available as a cheap fallback if the
  full migration is deprioritized — it still gets Shop's proceeds into
  `ChesscitoTreasury` (better custody) even without removing the approve step.

### 2. Legacy Get Peones + Season Pass → repoint `CHESSCITO_TREASURY_ADDRESS`
   / `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS`

- Preview first: change both vars in Preview scope to
  `0xcD3837DD017dFA5E31A2e3Cf390721E16Ac8Fbf0`, redeploy Preview, run one real
  `peones_pack_50` purchase through the **legacy** (non-canary) path and, if
  Preview can run in Lite mode, one real Season Pass purchase. Confirm
  balances the same way as every other test this session.
- Production: same change, but flagged as **higher cutover risk** than Shop,
  because it is two build-time-baked values
  (`NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS` requires a redeploy to change the
  client bundle) plus one server value. A client bundle cached in a user's
  browser/MiniPay WebView mid-session at cutover time could sign a transfer
  to the OLD address while the server now verifies against the NEW one,
  producing `transfer_not_found` for that one payment. Funds are not lost
  (old address is the same Safe) but the entitlement would need manual
  reconciliation. Mitigation: do this during a deliberate low-traffic window,
  since [[production-as-personal-staging]] means traffic is effectively only
  the founder today — real risk window is small, but should be a conscious
  choice, not a surprise.
- No app code changes required for money to move correctly. Optional
  follow-up (separate, not blocking): add an on-chain `acceptedToken` check
  to `/api/verify-payment` matching the canary's rigor, since the legacy
  route currently only checks its own app-level token allowlist, not the
  destination contract's on-chain mapping.

### 3. Victory NFT → `mintSignedWithPermit` (only if step 0 confirms MiniPay support)

- Contract upgrade (proxy stays, new implementation) adding a permit-based
  mint function. Backend voucher-signing logic (`_verifySignature`) is
  unchanged; only the payment leg changes from "assume prior approve" to
  "consume a permit signature inline."
- Full spec + red-team review + staged TDD before touching the deployed
  proxy, per the standing contract-change process
  ([[feedback_security_review_gate]]). Not started until step 0 lands.
- `mintSigned` (the current approve-based function) stays available in
  parallel — never remove a working path before the replacement is proven.

### 4. Canary flag retirement (optional, later)

- Once legacy Get Peones also targets `ChesscitoTreasury`, the canary's
  separate code path (`get-peones-canary*.ts`, its own intent table, its own
  env vars) becomes redundant for `peones_pack_50` specifically — legacy and
  canary would be moving money to the same place. Decide then whether to
  fully retire the canary code path or keep it for future SKUs/tokens. Not
  part of this plan; flagged only so it is not forgotten.

## Explicitly out of scope for this plan

- PRO/Founder/Shield item pricing or catalog changes.
- Labyrinth badge fees — confirmed free (voucher-only claim, no payment at
  all), nothing to change.
- Any change to `acceptedToken` on `ChesscitoTreasury` beyond USDT (still
  v1, USDT-only, per the canary's token matrix decision).

## Approval checklist

Nothing below is executed until checked off with explicit operator
confirmation, one surface at a time:

- [ ] MiniPay `eth_signTypedData_v4` probe (step 0)
- [ ] Shop → no-approve rail migration (step 1)
- [ ] Legacy Get Peones + Season Pass — Preview test (step 2)
- [ ] Legacy Get Peones + Season Pass — Production cutover, chosen window (step 2)
- [ ] Victory NFT `mintSignedWithPermit` — spec + red-team review, only if step 0 passes (step 3)
