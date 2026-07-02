# Red Team Review — Victory NFT `mintSignedWithPermit` design

**Date**: 2026-07-02
**Reviewer mindset**: hostile QA + senior contract engineer (independent
subagent, no shared context with the spec author)
**Spec under review**: `2026-07-02-victory-nft-permit-mint-design.md`
**Code checked at**: `main` @ `6f60de23` (working tree clean)
**Cross-check status**: 3 citations independently re-verified against the
live repo before accepting the report — confirmed accurate: `isUserCancellation`
matches only `"user rejected"`/`"user denied"`/`"cancelled"` substrings
(`apps/web/src/lib/errors.ts:3-7`), `@openzeppelin/contracts` /
`@openzeppelin/contracts-upgradeable` pinned at `5.6.1`
(`apps/contracts/package.json:78-79`), and `useMintVictory` is called
unconditionally in the real arena entry point
(`apps/web/src/app/[locale]/arena/page.tsx:68,327`) — not gated behind
`NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK` as the hook's own docstring claims.

## What the spec got right (verified, not manufactured)

- **`_splitPayment` has no off-by-one under an exact-value permit.**
  `VictoryNFTUpgradeable.sol:184-189`: `treasuryAmount = totalAmount*80/100`,
  `poolAmount = totalAmount - treasuryAmount` — the two transfers sum to
  exactly `totalAmount`; allowance lands at 0, no remainder.
- **Reentrancy is well-guarded.** Effects (`usedNonces`, `lastMintAt`) are
  set before `permit()`/`_splitPayment` in the proposed body; `_mint` (not
  `_safeMint`) means no ERC-721 receiver callback surface.
- **Cross-function voucher replay already blocked.** `usedNonces` is one
  shared mapping (`:85`) — a voucher consumed by `mintSigned` cannot be
  replayed via `mintSignedWithPermit`, and vice versa.
- **`sendSig` really is orphaned** — declared (`use-mint-victory.ts:57`),
  never read in `start()`. Confirmed, not touched by this feature.
- **Flag pattern accurately mirrored** —
  `isGetPeonesCanaryClientRequested()` (`get-peones-canary.ts:35-37`).
- **`IERC20Permit` import is valid** for the pinned OZ version (`5.6.1`).
- **No storage-layout risk** — `version` metadata genuinely absent from
  `tokens.ts` today; `__gap` (`uint256[39]`, `:93`) is untouched by adding a
  function + import.

## P0 — Must fix before implementation

None. No fund-loss or DOA defect identified.

## P1 — Should resolve before writing/deploying the contract

### [P1-1] Front-runnable permit + "reverts bubble unwrapped" = gas-griefing DoS, not rescued by the client fallback as claimed

EIP-2612 `permit()` is submittable by **anyone** holding the signature, not
only the account it authorizes. An attacker watching the mempool can
extract `v/r/s` from a pending `mintSignedWithPermit` call and submit
`token.permit(...)` directly with higher gas. Because the signed `spender`
is the VictoryNFT contract itself, this does not steal funds — but it does
consume the token's EIP-2612 nonce before the player's own transaction
reaches its internal `permit()` call, which then reverts (invalid nonce),
unwinding the entire mint (including the `usedNonces` write — the voucher
stays reusable, but the player's tx still fails and gas is spent up to the
revert point).

The spec's own text ("Reverts bubble unwrapped") makes this the designed
behavior, and separately claims the client-side fallback protects against
"technical" permit failures — it does not, for this case: the client
fallback (`use-mint-victory.ts:529-547`) only triggers on **pre-broadcast**
`isUserCancellation`/`isTransactionTimeout`. A revert surfacing during
`waitForReceiptWithTimeout` (`:452`) lands in the generic `error` phase with
no fallback attempt.

**Fix (folded into design, see updated Contract changes section):** wrap
the internal `permit()` call in `try/catch` inside `mintSignedWithPermit`
and let `_splitPayment`'s `transferFrom` enforce whatever allowance
actually exists afterward — the standard router/Permit2 pattern. If a
front-runner replayed the exact signed values, the allowance the contract
needs is already there and the mint proceeds normally; if the permit
genuinely never lands, `transferFrom` reverts with an honest
insufficient-allowance reason instead of an opaque bubbled `permit()`
revert.

### [P1-2] "All three tokens implement EIP-2612" is under-verified — presence of `nonces()`/`DOMAIN_SEPARATOR()` is necessary but not sufficient

The 2026-07-01 on-chain check confirmed `nonces()` and `DOMAIN_SEPARATOR()`
return real values for USDC/USDT/cUSD on Celo Mainnet, but that does not
prove `permit()` itself succeeds with the assumed signature scheme —
several real-world USDT deployments expose 2612-shaped getters without a
working `permit()`, and per-token domain `version` commonly diverges (e.g.
Circle USDC canonically uses `"2"`; a different token may use `"1"`) in a
way no getter reveals.

**Fix (folded into design):** the pre-implementation verification pass must
execute a **real `permit()` call** per token (fork or Sepolia-equivalent,
not just read-only getter checks) and pin the confirmed `name`+`version`
per token, not assume uniformity.

### [P1-3] Cancellation-vs-technical distinction relies on substring matching never exercised against a wallet signature rejection

`isUserCancellation` (`errors.ts:3-7`) matches only literal
`"user rejected"` / `"user denied"` / `"cancelled"` substrings. This
classifier has never been exercised against a `signTypedData` rejection in
this codebase — only against transaction (`sendTransaction`) rejections.
If MiniPay's `eth_signTypedData_v4` rejection string doesn't match, a
deliberate cancel is misclassified as a technical failure, forcing the
unwanted approve+mint fallback right after the user just declined.

**Fix (folded into design):** capture MiniPay's real permit-rejection
payload via the existing `/dev/permit-probe` and assert the classification
holds before enabling the flag — added as an explicit pre-flag-enable gate.

## P2 — Noted, not blocking

- **[P2-1]** Reading `nonces(owner)` then signing then submitting is
  TOCTOU-racy under concurrent permits from the same wallet; low likelihood,
  cleanly retryable, no fix required.
- **[P2-2]** viem's base `erc20Abi` (used today for `name()`) does not
  include `nonces()`/`DOMAIN_SEPARATOR()`/`permit()` — the client needs an
  extended permit ABI fragment. Not a spec error, just an unstated
  dependency — folded into the ABI bullet.
- **[P2-3]** `use-mint-victory.ts:129`'s docstring claims the hook sits
  behind `NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK` (default OFF) with
  "production reads the inline path in arena/page.tsx until T13" — false
  today, confirmed unconditional usage at
  `apps/web/src/app/[locale]/arena/page.tsx:327`. Pre-existing doc rot,
  unrelated to this feature but touched by this change — fix in the same
  PR.
- **[P2-4]** Spec pseudocode must keep `_verifySignature` ordered strictly
  before the `usedNonces` write, matching `mintSigned:146→148` — the spec
  text already states this order but should keep it unambiguous in the
  final code, not just the prose.
- **[P2-5]** No change to the `VictoryMinted` event or its consumers — confirmed fine, no action.

## Verdict

**READY TO PROCEED once P1-1 and P1-2 are folded into the design and P1-3
is verified before flag-enable.** No P0 — the reused helpers are sound, the
split math is exact under an exact-value permit, and reentrancy plus
cross-function replay are already covered by existing contract structure.
The two real risks are (1) the explicit "bubble unwrapped" choice being
front-runnable in a way the client fallback does not actually catch, and
(2) the unproven assumption that getter presence implies working `permit()`
across all three tokens. Both are cheap to close now and expensive to
discover after a mainnet upgrade. P2s folded into the same patch where
practical; P2-1/P2-5 need no code change.
