# Labyrinth Badges Contract v0.1

**Status:** APPROVED / DESIGN FROZEN (2026-06-02). Design only, no Solidity,
no tests, no deploy. Phase D implementation is unblocked under the locked
contract surface defined below.
**Author:** Wolfcito 🐾
**Date:** 2026-06-02
**Supersedes:** none.
**Prereq reading:**
- `docs/superpowers/specs/2026-06-02-labyrinth-system-v0.2.md` (frozen)
- `docs/audits/2026-06-02-labyrinth-v0.2-phase-d-contract-review.md`
- `apps/contracts/contracts/BadgesUpgradeable.sol` (reference scaffold)
- `apps/web/src/app/api/sign-labyrinth/route.ts` (Phase C, locked)

## 1. Objective

Define a soulbound, upgradeable, ERC-1155 contract that holds verifiable
labyrinth completion proofs on Celo. The contract is consumed by the
Phase C sign endpoint (`/api/sign-labyrinth`) and by future leaderboard
and campaign readers. Phase D ships the testnet deploy; Phase E ships
the client mint flow.

## 2. Why Option B (recap)

`docs/audits/2026-06-02-labyrinth-v0.2-phase-d-contract-review.md`
recommended Option B with a weighted score of 8.65/10 vs 6.35/10 for
Option A. Three decisive factors:

1. The Phase C endpoint already signs under domain
   `name: "LabyrinthBadges"`. A fresh contract initialized with the same
   name produces a matching domain separator without code churn.
   Extending `BadgesUpgradeable` would force either reopening the
   Phase-C-locked artifact to revert to `name: "Badges"`, or
   implementing a non-standard second domain separator inside the
   contract.
2. Production badges are soulbound assets in real wallets. A new
   contract provides hard isolation from any labyrinth-driven bug,
   removing the worst-case regression class entirely.
3. The audit cost premium of a fresh contract is bounded and one-time.
   The implicit cost of extending Badges is long-tail: shared gap,
   shared pause, shared metadata routing, shared audit blast radius
   across every future labyrinth feature.

This spec implements that recommendation.

## 3. Base standard

ERC-1155 Upgradeable (OpenZeppelin v5), soulbound via `_update` override.

Reasons:

- Matches the Badges family idiom and the existing operational pattern.
- Cheaper batch claim and batch view operations for future leaderboard
  reads.
- Single metadata URI template covers all token IDs with deterministic
  decomposition.

ERC-721 was considered as an alternative. It maps closer to Victory NFT
semantics, but per-token metadata clarity is not a v0.1 requirement and
the Badges parallelism reduces operator cognitive load. Revisit only if
a campaign demands bespoke per-token artwork.

## 4. EIP-712 domain

Initialization:

- `name`: `"LabyrinthBadges"`
- `version`: `"1"`
- `chainId`: resolved at runtime via `block.chainid`
- `verifyingContract`: `address(this)`

`__EIP712_init("LabyrinthBadges", "1")` is called once during
`initialize` and the domain separator is cached by
`EIP712Upgradeable`. The Phase C endpoint already signs against the
same name and version, so the digest produced server-side will recover
to `signer` once `verifyingContract` swaps to this contract's proxy
address.

## 5. `LabyrinthMint` struct and typehash

The struct mirrors the Phase C endpoint's request shape exactly. Any
deviation would break signature recovery.

```solidity
LabyrinthMint(
  address player,
  bytes32 labyrinthId,
  uint256 moves,
  uint256 stars,
  bytes32 campaignId,
  uint256 nonce,
  uint256 deadline
)
```

`LABYRINTH_MINT_TYPEHASH = keccak256("LabyrinthMint(address player,bytes32 labyrinthId,uint256 moves,uint256 stars,bytes32 campaignId,uint256 nonce,uint256 deadline)")`

Hashing rules carried over from Phase C (see `route.ts:86-87`):

- `labyrinthId` is `ethers.id(labyrinthIdString)` server-side and the
  raw `bytes32` is passed to the contract.
- `campaignId` is `ethers.id(campaignIdString)` when present,
  `ethers.ZeroHash` when null.

## 6. Storage layout

Own slots (declaration order matters; OZ Upgrades plugin enforces
append-only on any future upgrade):

| Slot | Variable                  | Type                                                   | Purpose |
|------|---------------------------|--------------------------------------------------------|---------|
| 0    | `bestMintedStars`         | `mapping(address => mapping(bytes32 => uint8))`        | per-player best minted tier per labyrinth; source of truth for spec §6.5 step 1 |
| 1    | `usedNonces`              | `mapping(address => mapping(uint256 => bool))`         | per-player single-use nonces, mirrors Badges semantics |
| 2    | `signer`                  | `address`                                              | EIP-712 voucher signer (server hot wallet) |
| 3    | `baseMetadataURI`         | `string`                                               | CDN root for token metadata |

Reserve `uint256[46] __gap` after the own slots (4 used + 46 free = 50
total budget, mirrors Badges' convention).

### 6.1 On-chain allowlist (deferred)

Spec §6.4 and the Phase C plan mention an optional
`knownLabyrinthIds` mapping. **Recommendation: skip for v0.1.**

Reasons:

- The sign endpoint already validates `labyrinthId` against the
  in-memory catalog (`findLabyrinth` in `route.ts:19-27`). A spoofed
  `labyrinthId` cannot obtain a valid signature, which is what the
  contract verifies.
- An on-chain allowlist adds an owner-only transaction every time a new
  lab ships, and an extra `SLOAD` per claim. Operational cost not
  justified at v0.1 catalog scale.
- It can be added in a v0.2 upgrade by consuming one gap slot if a
  partner campaign demands an on-chain commitment to which labs
  qualify.

## 7. Anti-spam rule (spec §6.5 step 1 enforcement)

Reject any mint where `incomingStars <= bestMintedStars[player][labyrinthIdHash]`.

- Error: `StarsNotStrictlyBetter(uint8 prior, uint8 incoming)`.
- The contract is the authoritative source. The sign endpoint may also
  pre-reject for gas savings (spec §6.5 step 2), but the contract holds
  even if the endpoint is bypassed.
- On success, the contract writes `bestMintedStars[player][labyrinthIdHash] = uint8(incomingStars)`.

`incomingStars` must be in `{1, 2, 3}`. Any other value reverts with
`InvalidStars(uint256 stars)`.

## 8. Soulbound behavior

```solidity
function _update(
  address from,
  address to,
  uint256[] memory ids,
  uint256[] memory values
) internal override {
  if (from != address(0)) revert("LabyrinthBadges: non-transferable");
  super._update(from, to, ids, values);
}
```

Mirrors `BadgesUpgradeable._update` line 144-152.

**Locked invariants (v0.1):**

- Minting (`from == address(0)`) is allowed.
- Transfers between any two non-zero addresses are rejected.
- Burns (`to == address(0)`) are rejected. A labyrinth proof, once
  minted, is permanent for the wallet that earned it. There is no
  contract path that can remove it.
- Owner cannot bypass these rules. Pause halts new mints but never
  unlocks transfers or burns.

Rationale: a player who improves their star tier accumulates a new
tier-specific token (see §11). Older lower-tier proofs persist as
historical artifacts; the leaderboard reads `bestMintedStars`, not
token balances, so dangling lower-tier tokens do not affect ranking.
Adding burn surface would invite "delete my history" UX flows that are
out of scope and contradict the verifiable-proof model.

Test coverage for the soulbound invariants is enumerated in §16, tests
18-19 (transfer attempts) plus a new test 19b asserting that
`safeTransferFrom(player, address(0), ...)` reverts with the same
soulbound revert string (burn blocked).

## 9. Events

```solidity
event LabyrinthClaimed(
  address indexed player,
  bytes32 indexed labyrinthIdHash,
  uint256 indexed tokenId,
  uint256 moves,
  uint8 stars,
  bytes32 campaignIdHash,
  uint256 nonce,
  uint256 deadline
);
event SignerUpdated(address indexed signer);
event BaseURIUpdated(string baseURI);
```

Three indexed parameters on `LabyrinthClaimed` is the EVM ceiling.
`player`, `labyrinthIdHash`, and `tokenId` are the most query-relevant
fields for off-chain indexers (leaderboard, campaign reporting,
explorer surfaces). `stars`, `moves`, `campaignIdHash`, `nonce`,
`deadline` ride as non-indexed data.

## 10. Errors

```solidity
error InvalidSignature();
error SignatureExpired(uint256 deadline);
error NonceUsed(address player, uint256 nonce);
error StarsNotStrictlyBetter(uint8 prior, uint8 incoming);
error InvalidStars(uint256 stars);
error InvalidSigner();
error InvalidBaseURI();
```

`InvalidLabyrinthId` is intentionally not declared at v0.1 because no
on-chain allowlist exists (see §6.1). Add it alongside
`knownLabyrinthIds` if and when a campaign requires it.

## 11. Token ID strategy

```solidity
function tokenIdFor(bytes32 labyrinthIdHash, uint8 stars) public pure returns (uint256) {
  return uint256(keccak256(abi.encodePacked("labyrinth", labyrinthIdHash, stars)));
}
```

Properties:

- 1★, 2★, and 3★ proofs for the same lab map to distinct token IDs. A
  player who progresses from 1★ to 3★ ends with two tokens in
  inventory: a 1★ historical proof and the 3★ best proof. The
  leaderboard reads `bestMintedStars`, so the inventory shape does not
  affect ranking.
- Explicit `"labyrinth"` namespace prefix in the preimage guarantees
  the resulting digest cannot collide with any Badges token ID space
  (which uses small `uint256` values in `[1, maxLevelId]`). Even if
  Badges later adopts a hash-based ID scheme, a different prefix keeps
  the spaces disjoint.
- `stars` is folded into the preimage rather than packed in the low
  byte, so the strategy never truncates `labyrinthIdHash` and has no
  shift arithmetic to verify in audit.
- Off-chain decomposition is not required. The `LabyrinthClaimed` event
  emits `labyrinthIdHash`, `stars`, and `tokenId` together, so any
  indexer or metadata server can correlate the three without recomputing
  the hash.

`tokenIdFor` is a `pure` view; the sign endpoint can compute it
client-side or off-chain without contract calls.

## 12. Metadata URI strategy

```solidity
function uri(uint256 tokenId) public view override returns (string memory) {
  return string.concat(baseMetadataURI, Strings.toString(tokenId), ".json");
}
```

Mirrors `BadgesUpgradeable.uri` (line 136-138). The CDN at
`baseMetadataURI` is responsible for serving per-tokenId JSON. Off-chain
the URI path decomposes to `(labyrinthIdHash, stars)`, so the metadata
server can render tier-specific artwork without on-chain branching.

v0.1 baseline: the metadata JSON reuses the board thumbnail render as
the image, per spec §8.2. Bespoke campaign artwork is a v0.2 concern.

## 13. Admin surface

Standard OZ patterns mirrored from `BadgesUpgradeable`:

- `pause()` and `unpause()` onlyOwner.
- `setSigner(address nextSigner)` onlyOwner, rejects `address(0)`.
- `setBaseURI(string memory nextBaseURI)` onlyOwner, validates via the
  same `_normalizeBaseURI` helper Badges uses.
- `OwnableUpgradeable` (1-step) for v0.1 to mirror Badges and minimize
  audit diff. Revisit `Ownable2StepUpgradeable` only if owner rotation
  becomes a real operational concern.

## 14. Initializer signature

```solidity
function initialize(
  string memory initialBaseURI,
  address initialSigner,
  address initialOwner
) public initializer {
  if (initialSigner == address(0)) revert InvalidSigner();

  __ERC1155_init("");
  __Ownable_init(initialOwner);
  __Pausable_init();
  __EIP712_init("LabyrinthBadges", "1");

  baseMetadataURI = _normalizeBaseURI(initialBaseURI);
  signer = initialSigner;

  emit BaseURIUpdated(baseMetadataURI);
  emit SignerUpdated(initialSigner);
}
```

No `initialMaxLevelId` analogue is needed because the labyrinth ID
space is `bytes32` and no on-chain allowlist exists at v0.1 (see §6.1).

## 15. External claim function

```solidity
function claimLabyrinthSigned(
  bytes32 labyrinthIdHash,
  uint256 moves,
  uint256 stars,
  bytes32 campaignIdHash,
  uint256 nonce,
  uint256 deadline,
  bytes calldata signature
) external whenNotPaused {
  if (stars == 0 || stars > 3) revert InvalidStars(stars);
  if (block.timestamp > deadline) revert SignatureExpired(deadline);
  if (usedNonces[msg.sender][nonce]) revert NonceUsed(msg.sender, nonce);

  uint8 incomingStars = uint8(stars);
  uint8 priorStars = bestMintedStars[msg.sender][labyrinthIdHash];
  if (incomingStars <= priorStars) {
    revert StarsNotStrictlyBetter(priorStars, incomingStars);
  }

  _verifyClaimSignature(
    msg.sender,
    labyrinthIdHash,
    moves,
    stars,
    campaignIdHash,
    nonce,
    deadline,
    signature
  );

  usedNonces[msg.sender][nonce] = true;
  bestMintedStars[msg.sender][labyrinthIdHash] = incomingStars;

  uint256 tokenId = tokenIdFor(labyrinthIdHash, incomingStars);
  _mint(msg.sender, tokenId, 1, "");

  emit LabyrinthClaimed(
    msg.sender,
    labyrinthIdHash,
    tokenId,
    moves,
    incomingStars,
    campaignIdHash,
    nonce,
    deadline
  );
}
```

`_verifyClaimSignature` recomputes the typed-data digest using
`_hashTypedDataV4(keccak256(abi.encode(LABYRINTH_MINT_TYPEHASH, ...)))`
and reverts with `InvalidSignature` on mismatch. Same scaffold as Badges
`_verifyClaimSignature` (line 196-208).

## 16. Tests required (target 15-20 cases, Hardhat + chai)

Happy path:

1. Sign, claim, balance increments by 1 on the expected `tokenId`.
2. `bestMintedStars` updates from 0 to incoming.
3. `LabyrinthClaimed` event fires with the expected fields.

Anti-spam:

4. Re-claim same stars reverts with `StarsNotStrictlyBetter`.
5. Re-claim lower stars reverts with `StarsNotStrictlyBetter`.
6. Re-claim higher stars succeeds and updates `bestMintedStars`.

Signature integrity:

7. Expired deadline reverts with `SignatureExpired`.
8. Replayed nonce reverts with `NonceUsed`.
9. Wrong signer reverts with `InvalidSignature`.
10. Tampered field (e.g. stars in calldata differs from signed stars)
    reverts with `InvalidSignature`.
11. Domain separator cross-check: a digest computed via the Phase C
    endpoint's exact ethers.js call must recover to `signer`. Locks
    the cross-stack contract.

Validation:

12. `stars == 0` reverts with `InvalidStars`.
13. `stars > 3` reverts with `InvalidStars`.

Admin:

14. Non-owner cannot `pause`, `setSigner`, or `setBaseURI`.
15. `pause` blocks claim with the OZ `EnforcedPause` revert.
16. `setSigner(address(0))` reverts with `InvalidSigner`.
17. `setBaseURI("")` reverts with `InvalidBaseURI`.

Soulbound:

18. `safeTransferFrom` between two non-zero addresses reverts with
    `"LabyrinthBadges: non-transferable"`.
19. `safeBatchTransferFrom` reverts the same way.
19b. `safeTransferFrom(player, address(0), tokenId, 1, "")` (a burn
    attempt) reverts with `"LabyrinthBadges: non-transferable"`.

Metadata and tokenId:

20. `uri(tokenId)` returns the expected concatenation.
21. `tokenIdFor(labyrinthIdHash, stars)` is deterministic: identical
    `(labyrinthIdHash, stars)` inputs always return the same
    `tokenId`, and any change to either input produces a different
    `tokenId`. No off-chain decomposition is asserted.

Upgradeable scaffolding:

- OZ Upgrades plugin `validateImplementation` passes on the initial
  deploy. Future upgrade tests added per-upgrade.

## 17. Deploy plan

Sequence (Phase D implementation, separate session):

1. Implement contract under `apps/contracts/contracts/LabyrinthBadges.sol`
   alongside its test file.
2. Deploy on Celo Sepolia via a new Hardhat script
   `apps/contracts/scripts/deploy-labyrinth-badges.ts`. Record the
   proxy address in the deploy log and in the post-deploy handoff.
3. End-to-end smoke from local: call the Phase C endpoint with the
   Sepolia `verifyingContract` overridden via a per-request config,
   then submit `claimLabyrinthSigned` from a test wallet against the
   Sepolia proxy. Verify event emission and `bestMintedStars` update.
4. Audit pass (external if budget allows, internal red-team review at
   minimum). The audit doc from the Phase D review names the EIP-712
   domain match and soulbound invariant as the highest-priority
   checks.
5. Deploy on Celo mainnet via the same Hardhat scripting pattern as
   Badges and Victory. Provision a dedicated `LabyrinthBadgesProxyAdmin`
   so its upgrade authority is separable from Badges.
6. Phase C swap (see §18).

## 18. Phase C `verifyingContract` swap

After mainnet deploy, a single follow-up commit on the web side:

1. Add `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS` to the **versioned env
   templates only**: `apps/web/.env.template` (and the equivalent
   `.env.example` if present). Do not commit edits to `apps/web/.env`
   or `apps/web/.env.mainnet`; those are gitignored local files that
   each operator manages outside the repo (per CLAUDE.md secrets
   policy).
2. Configure the real address in the deployment environment: set
   `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS` in Vercel project env
   (Production scope, plus Preview if the testnet proxy should drive
   previews) via `vercel env add`. Document the value in
   `docs/deployment/contracts.md` (or equivalent canonical contracts
   doc) so future operators can recover it without inspecting Vercel.
3. Extend `getDemoConfig()` (`apps/web/src/lib/server/demo-signing.ts`)
   to read and validate the new address, exposing it as
   `labyrinthBadgesAddress`.
4. In `apps/web/src/app/api/sign-labyrinth/route.ts` change line 84
   from:
   ```ts
   const verifyingContract = badgesAddress;
   ```
   to:
   ```ts
   const verifyingContract = labyrinthBadgesAddress;
   ```
   Remove the `TODO(phase-D)` comment on the preceding line.
5. Add the new contract row to `MEMORY.md` and to the README "What's
   live" contracts table.
6. Verify the existing 10 Phase C test cases still pass; add at most
   one new case asserting `labyrinthBadgesAddress` is passed through.

This is mechanically the entire Phase C touch. No domain rename, no
struct change, no test rewrites.

## 19. Open questions (non-blocking)

1. **Mint cost.** v0.1 baseline: free, the contract has no payable
   path. Spec §8.1 notes a possible $0.005 nominal fee to deter
   spam-mint bots. If we adopt that, add `mintFee` storage plus a
   `payable` claim function plus a `treasury` recipient. Decide before
   mainnet deploy; testnet stays free.
2. **Per-tier artwork.** v0.1 uses the board thumbnail render for
   every tier. Per-campaign bespoke artwork is a v0.2 concern that
   does not change the contract.
3. **Owner handoff safety.** `OwnableUpgradeable` (1-step) for v0.1.
   Revisit `Ownable2StepUpgradeable` if multisig handoff becomes a
   real operational concern.
4. **Cross-chain.** Celo only at v0.1. No multi-chain commitment.

## 20. Approval criteria for v0.1 design freeze

Design freeze signed off 2026-06-02:

- [x] §5 struct and typehash match the Phase C endpoint exactly.
- [x] §6 storage layout supports spec §6.5 step 1 without modifying the
      already-frozen system spec.
- [x] §7 anti-spam rule wording is agreed (strict improvement only).
- [x] §8 soulbound semantics (no burn at v0.1, no transfer, owner cannot
      bypass) are agreed.
- [x] §11 token ID strategy is agreed (per-tier distinct tokens via
      `keccak256("labyrinth" || labyrinthIdHash || stars)`, no
      lower-tier replacement, no off-chain decomposition required).
- [x] §16 test list is approved (additions allowed; deletions need
      explicit justification).
- [x] §17 deploy plan is agreed, including dedicated proxy admin.
- [x] §19 open questions are explicitly marked "deferred" and not
      blocking implementation.

Phase D implementation is unblocked. Solidity work proceeds in a fresh
session against this frozen spec.
