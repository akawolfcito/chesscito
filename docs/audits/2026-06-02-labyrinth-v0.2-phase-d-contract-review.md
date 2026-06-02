# Phase D Contract Review — Labyrinth System v0.2

**Date:** 2026-06-02
**Author:** Wolfcito 🐾
**Scope:** Decide whether the soulbound labyrinth proof contract should
(A) extend `BadgesUpgradeable` via an upgrade with a backwards-compat
shim, or (B) ship as a new `LabyrinthBadges` contract. The product
decision (soulbound, Badge UX pattern) is already locked in spec §6.
This review is the technical gating condition called out in §6.4 and §9.
**Status:** Audit only. No Solidity, no UI, no spec edits, no Phase C
artifact changes, no push.

**Prereq reading:**
- `docs/superpowers/specs/2026-06-02-labyrinth-system-v0.2.md` §6.1, §6.4, §6.5
- `apps/contracts/contracts/BadgesUpgradeable.sol`
- `apps/web/src/app/api/sign-labyrinth/route.ts` (Phase C, commit `63c64c8b`)
- `apps/web/src/lib/game/labyrinth-mint-policy.ts` (Phase B)

## 1. Storage layout snapshot of `BadgesUpgradeable`

### 1.1 Inherited slot budgets (OZ Upgradeable v5, as documented in the contract footer)

| Parent                  | Reserved gap |
|-------------------------|--------------|
| `Initializable`         | 0 (uses `InitializableStorageLayout`, no raw slots) |
| `ERC1155Upgradeable`    | `__gap[47]` |
| `OwnableUpgradeable`    | `__gap[49]` |
| `PausableUpgradeable`   | `__gap[49]` |
| `EIP712Upgradeable`     | `__gap[48]` |

These parents are append-only by OZ convention; upgrades must preserve the
order in `BadgesUpgradeable`'s `is` clause (lines 17-23). Reordering
breaks every claim already minted in production.

### 1.2 Own storage (5 slots, declared lines 50-59)

| Slot offset | Variable                                                       | Type                                                    | Notes |
|-------------|----------------------------------------------------------------|---------------------------------------------------------|-------|
| 0           | `hasClaimedBadge`                                              | `mapping(address => mapping(uint256 => bool))`          | levelId-keyed, already populated on mainnet for shipped badges |
| 1           | `usedNonces`                                                   | `mapping(address => mapping(uint256 => bool))`          | per-player nonce ledger, shared across any future claim type |
| 2           | `baseMetadataURI`                                              | `string` (dynamic)                                      | metadata CDN root |
| 3           | `signer`                                                       | `address`                                               | EIP-712 voucher signer (server hot wallet) |
| 4           | `maxLevelId`                                                   | `uint256`                                               | allowlist upper bound for badge `levelId` |

### 1.3 Gap

`uint256[45] private __gap` at line 232. Reserved budget per the comment:
50 slots total for own contract (5 used, 45 free). Append-only additions
must consume from this gap and not exceed it.

### 1.4 Variables that an Option-A extension would need to add

Minimum viable shim for spec §6.5 step 1 enforcement (one mint per
wallet+lab+star tier, only on strict improvement):

| Proposed variable                                              | Type                                                       | Slot cost |
|----------------------------------------------------------------|------------------------------------------------------------|-----------|
| `bestMintedStars`                                              | `mapping(address => mapping(bytes32 => uint8))`            | 1 |
| `knownLabyrinthIds` (optional on-chain allowlist)              | `mapping(bytes32 => bool)`                                 | 1 |
| `labyrinthSigner` (optional separate hot wallet)               | `address`                                                  | 0 or 1 |

Realistic net slot consumption: 1 to 3 slots from `__gap[45]`. Remaining
gap stays at 42 to 44, which is safe and within OZ Upgrades plugin
tolerance. Append-only ordering is mechanically checked by
`@openzeppelin/hardhat-upgrades --inspect` before any upgrade transaction.

**Storage compatibility verdict:** mechanically feasible. The shim does
not collide with any existing slot, and the OZ Upgrades plugin will
verify layout preservation before an actual `upgradeToAndCall`. Storage
alone is not the blocker.

## 2. Critical finding: EIP-712 domain name mismatch

This is the non-obvious gating condition that was not flagged in spec
§6.4. It surfaces only when reading the contract's `initialize` against
the Phase C sign endpoint side by side.

### 2.1 Current contract domain

Line 86: `__EIP712_init("Badges", "1")`. This caches a domain separator
keyed on:

- `nameHash = keccak256("Badges")`
- `versionHash = keccak256("1")`
- `chainId` (resolved at call time via `block.chainid`)
- `verifyingContract = address(this)`

`EIP712Upgradeable` does not expose a setter for name or version. The
cached values are immutable from the proxy's perspective. Any digest
produced via `_hashTypedDataV4` will use `"Badges"` forever, on this
proxy.

### 2.2 Phase C sign endpoint domain

`apps/web/src/app/api/sign-labyrinth/route.ts:89-95` produces signatures
with:

- `name: "LabyrinthBadges"`
- `version: "1"`
- `chainId` (from `getDemoConfig()`)
- `verifyingContract: badgesAddress` (transitional, see Phase C memory)

### 2.3 Implication for Option A

If a `claimLabyrinthSigned` function in `BadgesUpgradeable` calls
`_hashTypedDataV4(keccak256(abi.encode(LABYRINTH_MINT_TYPEHASH, ...)))`,
the digest will be built under the `"Badges"` domain. The signature
produced by the Phase C endpoint will recover to a different address
than `signer`, and the claim reverts with `InvalidSignature()`. **Hard
fact, not a tunable.**

There are three theoretical mitigations:

- **A.i — Revert sign endpoint to `name: "Badges"`.** EIP-712 still
  disambiguates between claim types because the struct type name is
  encoded in the typehash (`BadgeClaim(...)` vs `LabyrinthMint(...)`).
  Cost: reopens a Phase-C-locked artifact and contradicts the spec's
  stated intent of a distinct "LabyrinthBadges" surface. Phase C memory
  marks the route shipped under commit `63c64c8b` and the TODO on line 83
  explicitly anticipates a `verifyingContract` swap, not a domain rename.
- **A.ii — Implement a second domain separator manually in the
  contract.** Compute `keccak256(abi.encode(DOMAIN_TYPEHASH,
  keccak256("LabyrinthBadges"), keccak256("1"), block.chainid,
  address(this)))` inside `claimLabyrinthSigned`, bypassing
  `_hashTypedDataV4`. Cost: duplicates logic already in
  `EIP712Upgradeable`, increases audit surface, and is non-standard for
  OZ-based contracts. Auditors will flag it.
- **A.iii — Override `_EIP712Name()` to switch per call.** Not possible
  in OZ v5. The cached domain separator is set during `__EIP712_init`
  and the override hooks are virtual but the cached values are not
  recomputed per call.

A.i is the cleanest of the three and the only path that does not add
non-standard cryptography. It still forces a Phase C diff.

### 2.4 Implication for Option B

The new contract's `__EIP712_init("LabyrinthBadges", "1")` matches the
sign endpoint as shipped. The Phase C TODO is resolved by a single-line
swap of `verifyingContract` to the new proxy address. Zero domain logic
churn, zero non-standard cryptography.

## 3. Option A analysis: extend `BadgesUpgradeable`

### 3.1 Shim composition

Minimum scope to satisfy spec §6.5 step 1 on the existing contract:

- New constants: `LABYRINTH_MINT_TYPEHASH = keccak256("LabyrinthMint(address player,bytes32 labyrinthId,uint256 moves,uint256 stars,bytes32 campaignId,uint256 nonce,uint256 deadline)")`.
- New mapping: `mapping(address => mapping(bytes32 => uint8)) public bestMintedStars` (slot 5).
- New external: `claimLabyrinthSigned(bytes32 labyrinthIdHash, uint256 moves, uint256 stars, bytes32 campaignIdHash, uint256 nonce, uint256 deadline, bytes calldata signature)`.
- New errors and events (`LabyrinthClaimed`, `StarsNotStrictlyBetter`, `InvalidLabyrinthId`, etc.).
- New token ID strategy (see §3.3).
- EIP-712 domain resolution path (§2.3 above).

### 3.2 Backwards compatibility

`hasClaimedBadge`, `usedNonces`, `baseMetadataURI`, `signer`,
`maxLevelId`: untouched. Existing `claimBadgeSigned` and
`tokenIdForLevel` are not modified. Production badges in player wallets
remain valid because their tokenIds, balances, and metadata URIs are
preserved. The OZ Upgrades plugin verifies this layer.

`usedNonces` becomes a shared per-player ledger across badge and
labyrinth claims. This is acceptable: nonces are per-player unique
strings and the sign endpoints already coordinate via `createNonce`.
Note for the audit: a sufficiently aggressive bot could try to burn
labyrinth nonces to grief future badge claims, but the rate limiter and
unique-nonce-per-call invariants make this a non-issue at any realistic
attack rate.

### 3.3 Token ID namespace problem

`tokenIdForLevel(levelId) returns (uint256) { return levelId; }` (line
127). Badge token IDs occupy `1..maxLevelId` and grow as new levels
ship. Labyrinth tokens must occupy a disjoint subset of `uint256`.

Two viable strategies:

- **High-bit flag.** `tokenIdForLabyrinth(bytes32 idHash) = uint256(idHash) | (1 << 255)`. Badge IDs would need to reach `2^255` to collide, which is mathematically impossible in any realistic chain lifetime. Cost: a custom `uri(tokenId)` override that branches on the high bit to pick the labyrinth metadata route. Adds branching to a public view function.
- **Star-tier-aware token ID.** `tokenId = (uint256(idHash) << 8) | stars`, so 1★, 2★, 3★ proofs for the same lab are distinct ERC-1155 tokens. Visible to players as separate inventory entries. Adds complexity: a strict-improvement mint must either burn the lower-tier token or leave it dangling. ERC-1155 `_burn` is supported but adds surface area and an extra path to test.

Either choice must be documented in NatSpec, tested for collision with
`maxLevelId` growth scenarios, and explained to auditors. Option B
avoids this conversation entirely by living in a contract whose tokenId
namespace is defined fresh.

### 3.4 Deploy and audit footprint

- Deploy: single `upgradeToAndCall` via the existing ProxyAdmin
  (`0xB7ba5e89...` on mainnet). Low gas, idempotent if the new impl is
  redeployable.
- Audit: incremental review on top of the existing audit pass. Scope is
  the new typehash, new claim function, EIP-712 mitigation path, token
  ID strategy, and storage append. Probably 30 to 50 percent of a
  greenfield audit cost.
- Operational: same proxy, same admin, same monitoring dashboards.

### 3.5 Risks specific to Option A

- EIP-712 mismatch forces a Phase C touch or non-standard contract code.
- Token ID namespace requires custom `uri(tokenId)` branching.
- Storage append is safe but consumes from a fixed gap. Future fields
  (replay verification, partner refs, campaign metadata) compete for the
  same 45-slot budget that Badges itself may need to grow into.
- Any future bug in the labyrinth path that requires a contract pause
  also pauses badge claims (single `_pause` flag).

## 4. Option B analysis: new `LabyrinthBadges` contract

### 4.1 Shape

Greenfield contract with:

- Inheritance mirroring `BadgesUpgradeable` (Initializable, ERC1155Upgradeable, OwnableUpgradeable, PausableUpgradeable, EIP712Upgradeable).
- `__EIP712_init("LabyrinthBadges", "1")` matching the Phase C endpoint as shipped.
- Soulbound `_update` override (copy from Badges).
- Own `bestMintedStars`, `usedNonces`, `signer`, optional `knownLabyrinthIds` allowlist.
- Fresh token ID design unconstrained by Badges' `levelId` convention.

### 4.2 ERC-1155 vs ERC-721 (open question, not blocking)

Defaulting to ERC-1155 keeps the Badges family idiom (cheaper batch ops,
shared metadata pattern). ERC-721 maps closer to Victory NFT semantics
(per-token metadata clarity). Recommend ERC-1155 for v0.2 to minimize
the cognitive jump from `BadgesUpgradeable`, and revisit only if a
campaign demands per-token bespoke artwork.

### 4.3 Cost and overhead

- Deploy: impl + proxy + admin. Roughly 3x the gas of an upgrade. On
  Celo this is still trivial in absolute terms.
- Audit: independent pass on a fresh contract. Auditor familiarity with
  the Badges codebase reduces marginal cost, but it remains a full pass.
- Infrastructure: new ABI binding (`apps/web/src/lib/contracts/labyrinth-badges.ts`), new env var (`NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS`), new Hardhat deploy script, new entry in mainnet contracts table.
- Operations: two badge contracts to monitor, pause, and rotate keys
  for. Cost is real but predictable.

### 4.4 Benefits specific to Option B

- Phase C sign endpoint stays bit-for-bit identical except for the
  `verifyingContract` swap. The TODO on line 83 of route.ts becomes a
  one-line resolution.
- Zero regression surface on existing Badges (totally isolated proxy).
- Storage layout designed for §6.5 enforcement plus headroom for §6.3
  upgrade fields (replay verification, campaign window, partner refs)
  without consuming Badges' gap budget.
- Pause flag is independent: a labyrinth bug does not freeze badge
  claims.
- Easier to deprecate or fork if the labyrinth model evolves (per-chain
  variants, partner-specific contracts, season cycling).

### 4.5 Risks specific to Option B

- New attack surface in a fresh contract. Mitigated by copying the
  Badges scaffold near-verbatim and reusing the auditor.
- Two contracts to keep version-synced on key rotations and metadata
  URI updates.
- Slightly more configuration in env files, plus a new mainnet address
  to track in `MEMORY.md` and the README contracts table.

## 5. Decision matrix and recommendation

### 5.1 Weighted matrix

Weights reflect the product's stated priorities: safety of shipped
on-chain assets dominates, EIP-712 coherence with the Phase C artifact
is second, freedom for future campaigns ranks above raw deploy cost.

| Dimension                          | Weight | Option A | Option B |
|------------------------------------|--------|----------|----------|
| Risk to existing badges            | 25%    | 6 / 10   | 10 / 10  |
| EIP-712 coherence with Phase C     | 20%    | 4 / 10   | 10 / 10  |
| Velocity to testnet                | 15%    | 9 / 10   | 6 / 10   |
| Storage complexity                 | 10%    | 6 / 10   | 10 / 10  |
| Deploy and audit cost              | 15%    | 9 / 10   | 5 / 10   |
| Future campaign freedom            | 15%    | 5 / 10   | 10 / 10  |

Weighted totals:

- **Option A:** 0.25 × 6 + 0.20 × 4 + 0.15 × 9 + 0.10 × 6 + 0.15 × 9 + 0.15 × 5 = **6.35 / 10**
- **Option B:** 0.25 × 10 + 0.20 × 10 + 0.15 × 6 + 0.10 × 10 + 0.15 × 5 + 0.15 × 10 = **8.65 / 10**

Sensitivity check: even if you halve the EIP-712 coherence weight to
10% and redistribute the 10 points to deploy cost, Option B still wins
at roughly 8.15 vs 6.85. The matrix is not sensitive to plausible
reweighting.

### 5.2 Recommendation

**Option B: ship a new `LabyrinthBadges` soulbound contract.**

Three reasons drive this:

1. The EIP-712 domain mismatch (§2) forces Option A into either a
   Phase-C-locked artifact touch or non-standard contract code. Both
   are avoidable by picking Option B, which matches the Phase C endpoint
   as shipped.
2. Production Badges hold real soulbound assets in player wallets. Any
   regression caused by a labyrinth-driven upgrade is an unrecoverable
   trust event, since soulbound tokens cannot be reissued elsewhere
   without losing provenance. Option B's hard isolation removes this
   class of risk entirely.
3. The cost asymmetry (a 30 to 50 percent deploy-and-audit premium on
   Option B) is bounded and predictable. The unbounded cost on Option A
   is the long-tail of constraints it imposes on every future labyrinth
   feature: shared gap, shared pause, shared metadata routing, shared
   audit blast radius.

Spec §6.4's "default of record" is Option A "conditional on contract
review approving the storage-compat shim." This review surfaces a
specific, non-trivial gating condition (the EIP-712 domain mismatch and
token ID namespace), which is exactly the escalation clause the spec
anticipated. Flipping the default to Option B is consistent with the
spec, not a departure from it.

### 5.3 Impact on the five Phase C follow-ups

(per `project_labyrinth_v02_phase_c.md`)

1. **Logger instrumentation** in both `sign-badge` and `sign-labyrinth`:
   independent of Option A or B. Bundle as one cross-cutting commit
   when scheduled.
2. **§6.5 step 2 (409 on tier regression):** Option B exposes a public
   `bestMintedStars(player, labyrinthIdHash)` view that the sign
   endpoint reads to reject tier regressions before signing. Same
   contract surface either way; Option B's reads happen against the
   new proxy address.
3. **Catalog metadata authoring:** independent of A or B. Driven by the
   first campaign scope.
4. **Swap `verifyingContract` plus remove TODO** at `route.ts:83-84`:
   Option B is a single-line address swap. Option A would additionally
   require reverting `name: "LabyrinthBadges"` to `name: "Badges"` on
   route.ts:91 unless A.ii is chosen.
5. **Campaign window validation:** deferred to first campaign manifest.
   Independent of A or B.

### 5.4 Phase D execution shape if Option B is approved (not part of this audit, scoped for the next session)

1. Write a contract spec for `LabyrinthBadges` (separate doc under
   `docs/superpowers/specs/`).
2. Implement with TDD under `apps/contracts/test/LabyrinthBadges.test.ts`.
3. Hardhat deploy script, Sepolia first.
4. ABI export to `apps/web/src/lib/contracts/labyrinth-badges.ts`.
5. Sign endpoint update: `verifyingContract` swap plus TODO removal.
   Single-line diff to a Phase-C artifact.
6. End-to-end smoke test on Sepolia before mainnet promotion.

This audit deliberately stops before step 1.

### 5.5 Final answer

The closing options framed in the prompt were:

1. Recommend Option A.
2. Recommend Option B.
3. Needs contract spike.

**Output: 2. Recommend Option B.**

If Option A is overridden as the final choice anyway, the spec §6.4
escalation clause requires also accepting one of two non-trivial costs:
either a Phase C diff to revert the EIP-712 domain name from
`"LabyrinthBadges"` to `"Badges"`, or a non-standard second domain
separator implemented inside the contract. Both should be called out
explicitly in whatever decision artifact follows this audit.
