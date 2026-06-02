# Labyrinth System v0.2 — Universal Mintability + Campaigns

**Status:** APPROVED / DESIGN FROZEN (2026-06-02) — design only, no
contracts, no API routes, no UI changes. Phase B (type extension +
mint-policy resolver) is unblocked. See §10 for the freeze checklist.
**Author:** Wolfcito 🐾
**Date:** 2026-06-02
**Supersedes:** none (v0.1 stays valid for rule/design work; v0.2 adds the
mintability layer on top).
**Prereq reading:** `docs/superpowers/specs/2026-06-02-labyrinth-design-v0.1.md`
(catalog + rule fixes) and the Victory NFT spec at
`docs/superpowers/specs/2026-03-17-mint-your-victory-design.md` (the closest
on-chain pattern we already have shipped to mainnet).

## 1. Why v0.2

v0.1 closed the rule-correctness gap for pawn labyrinths and added the first
King labyrinth. It treats every labyrinth as a self-contained local exercise:
solve → record best in `localStorage` → unlock the next one. No on-chain
attestation, no leaderboard surface, no campaign hook.

Product is moving toward a model where the labyrinth catalog is a **content
engine** for ongoing engagement: weekly themed labs, partner challenges,
seasonal cosmetics, sponsored campaigns. That model requires a verifiable
proof-of-completion that doesn't live in `localStorage` (trivially editable,
device-bound, lost on uninstall).

The smallest change that unblocks all of those product moves is to make
**every labyrinth optionally mintable** — a uniform, default-on opt-in instead
of a per-lab hand-curated flag. This spec defines that model.

## 2. Non-goals

This spec **does not** define:
- Specific contract code or ABI (post-design phase).
- The leaderboard UI / endpoint shape (separate spec when the leaderboard
  cluster opens).
- Campaign curation tooling (separate spec).
- Pricing, fees, or treasury split (inherits Victory NFT defaults until a
  campaign-specific override is needed).
- Any change to the existing `Exercise` shape that would break the v0.1
  catalog — additions only, all optional.

## 3. Mintability model

### 3.1 Core principles

1. **Play is always free.** Tapping into a labyrinth, attempting it, retrying,
   and recording a `localStorage` best never requires a wallet, a signature,
   or a transaction.
2. **Every completion is potentially mintable.** No allow-list. No
   per-labyrinth "isMintable" toggle to forget. The default is *mintable=true*
   and the player opts in *after* completion if they want a verifiable proof.
3. **Mint is the bridge to verifiable surfaces.** Local best stays as the
   casual progress signal. Anything that needs trust (leaderboard, rewards,
   partner eligibility, season ranking) reads from the minted proof, not
   from `localStorage`.
4. **Mint never gates progress.** A player who never mints can complete every
   labyrinth, claim every badge that depends on local stars, and finish the
   training ladder. The mint only opens *additional* surfaces.
5. **One mint per (wallet, labyrinthId, star tier).** Mint is opt-in but
   not unbounded. For a given wallet + labyrinth, at most one proof per
   star tier (1★, 2★, 3★) is allowed. A new mint is permitted **only when
   the player strictly improves their star tier** (e.g. previously minted
   1★, now solved 3★ → new mint allowed). Re-minting an identical or lower
   tier is rejected by both the sign endpoint and the contract. This
   principle is enforced at the protocol layer; the UI surfaces it via the
   anti-spam mechanics in §6.5 but never relies on UI alone. Rationale:
   keeps the proof inventory meaningful (one entry per real improvement),
   blocks gas-spam loops, and gives the leaderboard a deterministic
   "best-known minted proof" per player+lab without timestamp tie-breakers.

### 3.2 Two persistence layers

| Layer            | Source                              | Trust model     | Powers                                    |
|------------------|-------------------------------------|-----------------|-------------------------------------------|
| Casual progress  | `localStorage` (`labyrinth-progress.ts`) | Client-only, editable | UI best/star display, next-lab unlock, badge progress |
| Verifiable proof | On-chain NFT (or signed attestation) | EIP-712 + chain | Leaderboard, campaigns, rewards, partners |

Both can coexist for the same labyrinth completion. Local writes happen
synchronously on success; the mint sheet is offered after but never blocks
the local write.

### 3.3 What "minted result" represents

A minted labyrinth result attests, at minimum:
- `player` (wallet address)
- `labyrinthId` (stable key, e.g. `pawn-lab-1`)
- `moves` (the count achieved on this attempt)
- `stars` (derived: 3 / 2 / 1 from `labyrinthStars(moves, optimal)`)
- `timestamp` (when signed)
- `seasonId` / `campaignId` (if present at signing time)
- `nonce`, `deadline` (anti-replay, same pattern as Badge/Victory)

It does NOT attest to move-by-move correctness. A v0.2 lab proof is
"player asserted completion in N moves at time T" backed by a server-side
sanity check that `N >= optimalMoves` and `N` is plausible (see §6.2). For
labs that need replay-verified proof (high-stakes campaigns), §6.3 defines
the upgrade path.

## 4. Metadata model

### 4.1 Additions to the `Exercise` type

All fields are **optional** and **additive**. The existing `Exercise` shape
(`apps/web/src/lib/game/types.ts:26-42`) stays valid; legacy labs without any
of these fields fall back to default behavior (mintable, no campaign).

```ts
export type Exercise = {
  // ... existing fields unchanged ...

  /** Mint surfaces. Default true. Set false to suppress the post-completion
   *  mint CTA entirely (e.g. tutorial labs that should not pollute the
   *  player's NFT inventory). */
  mintable?: boolean;

  /** When true, this labyrinth participates in the public leaderboard
   *  at all. Default false (the lab is solo-only, no public board entry).
   *
   *  Hard rule (see §7): every public leaderboard, on every lab, reads
   *  ONLY from minted proofs. `localStorage` bests never appear on a
   *  public board, regardless of this flag. So setting
   *  `leaderboardEligible=true` is exactly the statement "to appear on
   *  this lab's leaderboard, the player MUST mint". There is no
   *  intermediate mode where unminted local bests get listed publicly. */
  leaderboardEligible?: boolean;

  /** When true, this labyrinth participates in the rewards engine.
   *  Default false. Reward distribution reads from minted proofs only. */
  rewardEligible?: boolean;

  /** When true, this labyrinth is part of an active campaign. Default
   *  false. Implies that `campaignId` is set. */
  campaignEligible?: boolean;

  /** Minimum stars required to enable the mint CTA. Default 1 (any
   *  completion mints). Set to 3 to enforce "mint only perfect runs". */
  minStarsToMint?: number;

  /** Minimum stars to qualify for the reward pool tied to this labyrinth.
   *  Independent of mint — a player can mint a 1★ proof and not be reward-
   *  eligible. Default = minStarsToMint when rewardEligible=true. */
  minStarsForReward?: number;

  /** Optional season key. Used to scope leaderboards and rewards by time
   *  window (e.g. "2026-Q3", "halloween-2026"). Null = evergreen lab. */
  seasonId?: string;

  /** Optional campaign key. Used to group labs into a themed challenge
   *  (e.g. "rook-week-2026-06", "partner-celo-summer"). */
  campaignId?: string;

  /** Optional partner key. Used for revenue share / co-branded surfaces.
   *  Set when a lab is sponsored or co-created with an external brand. */
  partnerId?: string;

  /** Reward category for the minted proof. Default "in_game" when
   *  rewardEligible=true, "none" otherwise. "mystery" intentionally hides
   *  the reward until the player mints (drives intrigue for limited
   *  campaigns; the actual reward is resolved server-side at claim time). */
  rewardTier?: "none" | "in_game" | "partner" | "mystery";
};
```

### 4.2 Default resolution rules

When a field is absent from a labyrinth definition, the runtime treats it as:

| Field                          | Default                                        |
|--------------------------------|------------------------------------------------|
| `mintable`                     | `true`                                         |
| `leaderboardEligible`          | `false`                                        |
| `rewardEligible`               | `false`                                        |
| `campaignEligible`             | `false`                                        |
| `minStarsToMint`               | `1`                                            |
| `minStarsForReward`            | `minStarsToMint` if `rewardEligible`, else N/A |
| `seasonId` / `campaignId` / `partnerId` | `undefined`                          |
| `rewardTier`                   | `"in_game"` if `rewardEligible`, else `"none"` |

Centralize the resolution in a single helper
(`lib/game/labyrinth-mint-policy.ts`) so the UI, the sign endpoint, and any
future leaderboard reader share one source of truth.

### 4.3 Validation rules (catalog-side)

To prevent footguns when authoring new labs:
- If `campaignEligible=true`, `campaignId` must be set.
- If `rewardTier !== "none"`, `rewardEligible` must be true.
- If `leaderboardEligible=true`, `mintable` must be true (no point in
  flagging a lab for leaderboard surfacing if the player has no way to
  produce a verifiable proof).
- `minStarsToMint` ∈ {1, 2, 3}.

These should be enforced by a regression test alongside the existing
`labyrinths-catalog.test.ts` so a malformed entry fails CI rather than
shipping a silently broken campaign.

## 5. Post-labyrinth CTA

### 5.1 State machine

After the player completes a labyrinth, the `LabyrinthCompleteOverlay`
decides the primary CTA from this matrix:

| Completion state                                | Primary CTA                  | Secondary CTAs                              |
|-------------------------------------------------|------------------------------|---------------------------------------------|
| `mintable=false` OR `stars < minStarsToMint`    | "Next Labyrinth"             | "Back to Exercises", "Try Arena"            |
| Stars qualify, not yet minted, no campaign      | **"Mint Result"**            | "Next Labyrinth", "Back to Exercises"       |
| Stars qualify, not yet minted, **3★** result    | **"Mint your perfect path"** | "Next Labyrinth", "Back to Exercises"       |
| Stars qualify, not yet minted, in campaign      | **"Claim Proof"**            | "Next Labyrinth" (campaign progress chip)   |
| Stars qualify, already minted this attempt      | "Next Labyrinth"             | "View Proof" (links to coach viewer-like), "Back to Exercises" |

Rules of thumb:
- The mint CTA is always *opt-in* and *never the only path forward*. Even
  when minting is the visually primary action, a non-minting branch is
  always one tap away.
- The verb shifts by context: "Mint Result" is the neutral default,
  "Claim Proof" is the campaign-flavored variant, "Mint your perfect path"
  is the 3★ celebration variant. All three render through the same
  underlying CTA token (see [cta-token-system](../../audits/2026-06-01-button-families-inventory.md)).

### 5.2 Mint sheet contents

When the player taps the mint CTA, open a sheet (not a full-screen viewer)
showing:
- The labyrinth board thumbnail (reuse `board-thumbnail.tsx`).
- Stars earned + move count.
- Plain-language reward summary, sourced from `rewardTier`:
  - `none` → "Verifiable proof on Celo. Counts for leaderboard."
  - `in_game` → "Verifiable proof + counts toward in-game rewards."
  - `partner` → "Sponsored by {partner}. Verifiable proof unlocks partner
     rewards."
  - `mystery` → "Verifiable proof. Reward revealed after mint."
- Estimated cost (USD6 cents) and chain.
- Primary "Confirm mint" + secondary "Not now".
- Anti-AI-prose rule applies (no em-dashes, plain language).

The mint sheet is closeable at any point. No state is destroyed by
dismissing.

### 5.3 Discoverability of unminted history

A player might solve a lab today and decide to mint it next week. To support
that:
- The exercises drawer shows a small "Unminted" pill next to any lab where
  `bestMoves` is set locally but no minted proof exists for the current
  wallet on the current chain.
- Tapping the pill re-opens the mint sheet pre-populated with the local
  best — same anti-replay nonce protections as a fresh completion.
- This is a v0.2 *target*, not a blocker; ship the post-completion mint
  flow first, the "mint historical" affordance can land in a follow-up.

## 6. Reuse audit — Badge / Victory pattern

This is the architectural heart of v0.2.

**Product decision (locked):**

- Labyrinth proofs are **soulbound** (non-transferable, one-shot per
  star tier per player+lab).
- The **UX / API surface** clones the Badge pattern: same sign-endpoint
  shape, same EIP-712 envelope, same nonce/deadline anti-replay.

**Technical decision (open — defer to contract design phase):** the
specific contract path stays a binary choice between two options, both
of which honor the product decision above.

- **Option A — extend `BadgesUpgradeable`.** If a contract review confirms
  the existing Badges storage layout can absorb a `labyrinthId` key
  (likely via a `keccak256("lab:{id}")` mapping onto the same `levelId`
  uint slot, or a parallel mapping on a new bytes32 key), ship a v2
  upgrade with a backwards-compat shim for existing badge claims. Lowest
  deploy cost, smallest audit surface.
- **Option B — new `LabyrinthBadges` soulbound contract.** A fresh ERC-721
  with `_update` overridden to block transfers, copying the Badge
  signature verification scaffold. Higher deploy + audit cost, but zero
  risk of regressing the existing badge contract and complete freedom
  on storage layout.

`VictoryNFTUpgradeable` is explicitly **off the table** for the soulbound
proof contract — it's transferable and fee-split, neither of which fits
the proof model. (It remains relevant only as a reference for the
EIP-712 + multi-token signature pattern.)

Both options yield the same player-facing UX. The choice is purely
internal: contract review of `BadgesUpgradeable` is the gate to make it,
and that review is Phase D in §9.

### 6.1 What can be reused

| Asset                                         | Reuse?       | Notes                                                                              |
|-----------------------------------------------|--------------|------------------------------------------------------------------------------------|
| `enforceOrigin` + `enforceRateLimit` helpers (`apps/web/src/lib/server/demo-signing.ts`) | ✅ As-is | Same allowlist semantics. Same IP+player rate limit dimensions. |
| `parseAddress` / `parseInteger`               | ✅ As-is     | Same input shape; just add `parseLabyrinthId` for the new key.                     |
| `createNonce` / `createDeadline`              | ✅ As-is     | Anti-replay model is identical.                                                    |
| EIP-712 envelope (`signer.signTypedData`)     | ✅ Same call | New domain name + new struct, otherwise identical.                                 |
| `BadgesUpgradeable` storage layout            | ⚠️ Open (Option A) | If contract review confirms storage can absorb a `labyrinthId` key without breaking existing badge claims, extend. Otherwise → Option B. |
| `BadgesUpgradeable` signature scaffold         | ✅ Copy         | Whether we extend (A) or fork (B), the Badge sig verification + soulbound `_update` override is the template we replicate. |
| `VictoryNFTUpgradeable` contract              | ❌ Off-table   | Transferable + fee-split. Wrong shape for a soulbound proof. Only useful as an EIP-712 + multi-token reference. |

### 6.2 New endpoint shape — `/api/sign-labyrinth`

Mirrors `/api/sign-badge` closely. v0.2 default (the "trust the client +
sanity check" tier):

```ts
// POST /api/sign-labyrinth
// body:
{
  player: "0x…",
  labyrinthId: "pawn-lab-1",
  moves: 3,
  campaignId?: "rook-week-2026-06"  // optional
}
// response:
{
  player, labyrinthId, moves, stars, campaignId,
  nonce, deadline, signature
}
```

Server-side validation (cheap, runs in the same nodejs runtime as
`/api/sign-badge`):
1. `enforceOrigin` + `enforceRateLimit`.
2. `parseAddress(player)`, `parseLabyrinthId` (must match a known catalog
   entry — same allowlist trick used by Badge `levelId` range).
3. `parseInteger(moves)` ∈ `[optimalMoves, optimalMoves * 5]` (basic plausibility
   bound — a player can't claim fewer moves than optimal, nor an absurd
   5× count that suggests bot-clicking or fuzzing).
4. Compute `stars = labyrinthStars(moves, optimal)`.
5. Look up the labyrinth's mint policy (resolved per §4.2) — reject if
   `mintable=false` or `stars < minStarsToMint`.
6. If a `campaignId` is provided, verify the lab actually belongs to that
   campaign (allowlist) and the campaign is open at `deadline`.
7. Sign the EIP-712 `LabyrinthMint` struct.

This is **deliberately less paranoid than `/api/sign-victory`**. Victory
replays the full SAN transcript to detect cheating because the prize pool
distributes real money. Labyrinth proofs are cheap, ladder-style attestations
where the worst spoofable case is "player claimed 1 move better than they
actually did" — caught by leaderboard sanity (the `optimal` lower bound) and
by the move-count plausibility bound. The cost/value of full replay
verification doesn't pencil out for v0.2.

### 6.3 Upgrade path: replay-verified proof

For campaigns where prize money is at stake (partner rewards, season finals),
escalate to a Victory-style proof:
- Client emits the full move list during the labyrinth attempt.
- Server replays moves through the labyrinth rule engine (the same
  `getValidTargets` we already test against).
- Server asserts the final position is the target and the move count is
  what's claimed.

This is purely additive — the endpoint adds a `moveHistory?: string[]`
optional field, and high-stakes labs declare `replayRequired: true` (new
metadata field, deferred to v0.3 unless a campaign requires it before then).

### 6.4 Contract path — A vs B

Soulbound is locked at the product level (see §6 lede). The remaining
choice is whether to extend or fork. The decision matrix below names
what each option costs and what gates it.

| Dimension                 | Option A — extend `BadgesUpgradeable`             | Option B — new `LabyrinthBadges`                    |
|---------------------------|---------------------------------------------------|-----------------------------------------------------|
| Deploy + audit cost       | Low (upgrade + storage-compat review)             | High (fresh contract, fresh audit)                  |
| Risk of regressing badges | Non-zero (storage layout collision possible)      | Zero (totally isolated)                             |
| Storage shape freedom     | Constrained to existing Badge layout              | Full freedom                                        |
| Player-facing UX          | Identical                                         | Identical                                           |
| Time to first testnet     | Faster                                            | Slower                                              |
| Gate                      | Contract review must approve storage-compat shim  | None beyond standard audit                          |

**Default of record:** Option A, *conditional on* contract review
approving the storage-compat shim. If the review surfaces any risk of
breaking existing badge claims (the soulbound badges already in player
wallets), Option B is the immediate fallback — same UX, same Phase E
shipping window, just an extra audit pass.

Either way the player sees the same flow: complete labyrinth → opt-in
mint → soulbound proof appears in their on-chain inventory.

### 6.5 Anti-spam mechanics (enforcement of §3.1 principle 5)

The core anti-spam rule is a **product principle**, declared at §3.1.5 (one
mint per wallet+lab+star tier, only allowed when stars strictly improve).
This section enumerates the layered enforcement that backs that principle —
every layer is required, no layer is sufficient alone.

1. **Contract layer (authoritative).** The soulbound contract maintains a
   `(player, labyrinthId) → bestMintedStars` mapping and rejects any mint
   where `incomingStars <= bestMintedStars`. This is the source of truth;
   even if the UI and the sign endpoint are bypassed, the contract holds.
2. **Sign endpoint layer.** `/api/sign-labyrinth` reads the same mapping
   (or refuses to sign without it) and returns 409 Conflict for tier
   regressions. Saves gas — the user never gets a signature they couldn't
   spend on-chain.
3. **Rate limit layer.** Reuse `enforceRateLimit` from
   `lib/server/demo-signing.ts` — already capped per (IP, player) pair.
4. **UI guard layer.** The post-completion mint sheet (§5.2) is suppressed
   entirely when the local best minted tier ≥ the new completion's stars.
   When suppressed, the overlay surfaces "You already have this on-chain"
   with a "View Proof" affordance instead.
5. **No silent re-mint loops.** UI never auto-retries a mint after
   rejection; any retry is an explicit user tap. Failed mints surface a
   non-blocking inline error, not a modal.

## 7. Leaderboard model (forward reference)

This spec does not define the leaderboard endpoint, but it pins down what
the leaderboard MUST read:

1. **Public boards (cross-player)** read **only from minted proofs**. Never
   from `localStorage`. Anything else creates a trivially fakable score
   surface — see [domain-migration-origin-check] for what happens when the
   server-side surface is the only thing trusted.
2. **Personal "your best" displays** can still read from `localStorage` for
   the unminted case. An unminted personal best stays in the player's own
   UI but never appears in cross-player rankings.
3. **Aggregation key.** Leaderboards group by some combination of
   `(seasonId, campaignId, labyrinthId, piece)`. Exact aggregation TBD by
   the leaderboard spec; the metadata fields here are the inputs it will
   read.
4. **Backfill is the player's job.** A player who solved a lab pre-v0.2
   has no proof; they need to re-attempt and mint to appear on the board.
   We do not migrate `localStorage` bests into signed proofs (no
   server-side knowledge that the local data is real).

## 8. Open questions (do not block v0.2 design freeze)

1. **Mint cost.** Free? Same fee tier as Victory ($0.005 Easy)?
   Sponsored-by-treasury for the first campaign? Recommend a single flat
   nominal cost (e.g. $0.005) that's small enough not to gate, large
   enough to deter spam-mint bots. Decide in the contract design phase.
2. **Art per labyrinth.** Reuse the board thumbnail render as the NFT
   image (cheap, deterministic, no asset pipeline change) versus
   bespoke artwork per campaign. v0.2 baseline = thumbnail; campaigns can
   override later.
3. **Cross-chain.** Labyrinths shipped on Celo mainnet only. No multi-chain
   commitment in v0.2.
4. **Catalog scaling.** With more campaigns, the labyrinth catalog will
   grow. Need a story for filtering / ordering ("show me only active
   campaign labs") in the exercises drawer. Deferred to UX cluster.

## 9. Phasing

| Phase | Scope                                                                 | Status |
|-------|-----------------------------------------------------------------------|--------|
| A     | This spec, reviewed + approved                                        | this PR |
| B     | `Exercise` type extension + mint-policy resolver (no UI, no endpoint) | next   |
| C     | `/api/sign-labyrinth` (badge-shape) + plausibility validation         | next+1 |
| D     | Contract review of `BadgesUpgradeable` → pick Option A or B → deploy testnet | next+2 |
| E     | Post-completion mint CTA + sheet (opt-in, never blocks progress)      | next+3 |
| F     | "Mint historical" affordance + Unminted pill                          | next+4 |
| G     | Leaderboard reads minted proofs (separate spec)                       | future |
| H     | First campaign (e.g. "Rook Week") using `campaignId`                  | future |

Each phase is independently shippable; the catalog and rule engine never
break because every new field is optional.

## 10. Acceptance criteria for v0.2 design freeze

Design freeze signed off 2026-06-02:
- [x] All metadata field semantics in §4 are agreed (names — including
      `leaderboardEligible`, defaults, validation rules).
- [x] CTA matrix in §5.1 is agreed (verbs, fallback rules).
- [x] §3.1 core principles 1-5 are agreed, including the elevated
      principle 5 (one mint per wallet+lab+star tier, only on strict
      improvement).
- [x] §6 product decision (soulbound + Badge UX pattern) is agreed.
- [x] §6.4 Option A / Option B framing is agreed — design freeze does
      NOT require picking A or B (that's Phase D after contract review);
      it only requires agreement that both options honor the product
      decision and have a clear gating condition.
- [x] §6.5 layered anti-spam enforcement is agreed (contract +
      sign-endpoint + rate-limit + UI guard + no-silent-retry).
- [x] Leaderboard read-source rule in §7 is agreed (minted only on
      public boards, localStorage allowed only on personal "your best").
- [x] Open questions §8 are explicitly marked "deferred" and not blocking
      Phase B.

Once frozen, Phase B (type extension) is unblocked; everything else can
proceed incrementally without re-opening the design.
