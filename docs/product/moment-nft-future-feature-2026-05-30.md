# Moment NFT — Future Feature Note

**Date:** 2026-05-30
**Status:** Documented for future — NOT scheduled, NOT in current roadmap.
**Owner:** @akawolfcito

## What this is

A note capturing the intent to expand the current Victory NFT from
"complete checkmate win" to a more general **moment-based** NFT that
celebrates a single chess position the player wants to remember,
regardless of how the game ended.

The trigger to write this down: in MiniPay smoke on 2026-05-30 the
player noticed that resigning, losing, or drawing the game removes
the Save Victory affordance. That's correct *today* — the contract
validates a real checkmate transcript — but it's a limit we want to
outgrow once the coach analysis module matures.

## Today (locked, by design)

- Save Victory mints `VictoryNFTUpgradeable` on Celo Mainnet.
- Server route `/api/sign-victory` replays the SAN transcript and
  enforces:
  - `chess.isCheckmate()` at the final position.
  - The mating side === the player's color.
- Visor surfaces:
  - `result === "win"` (only path to checkmate today) → Save Victory tile.
  - `result === "lose" | "draw" | "resigned"` → tile hidden, only Play
    Again + Ask Coach.
- Pricing: Easy $0.005 / Medium $0.01 / Hard $0.02 (USD6).
- Token metadata: difficulty, totalMoves, timeMs.

## Future ("Moment NFT" — when we get there)

> "Lo hiciste genial — esa jugada merece guardar el recuerdo para
> toda la vida" — incluso si la partida termina mal después.

A second mintable surface, anchored not on the *result* of the whole
game but on a *specific position* (FEN) within it. The coach analysis
module is the natural producer of these moments:

- A `!!` move flagged by the analyzer (brilliant tactic).
- A puzzle-quality position (pin, fork, sacrifice, smothered mate
  pattern, etc.).
- A user-driven "I want to keep this" tap during replay.

### Likely shape

- **Contract**: new `MomentNFT` (or a `MomentNFTUpgradeable` sibling)
  with metadata schema `{ fen, plyIndex, gameId, motif?, severity? }`.
  Or extend `VictoryNFT` with a `kind` enum (`victory | moment`) if
  we want one collection — TBD.
- **Server validation**: replay transcript to `plyIndex`, assert the
  FEN matches, then sign. No checkmate requirement.
- **Pricing**: independent tier. Could be cheaper than victories or
  PRO-only, depending on the economic model at the time.
- **Surfacing**:
  - Visor replay slider gains a "Save this position" affordance per
    move, *or*
  - Coach analysis output marks specific positions and the user taps
    a primary CTA on that move.
  - Available in `loss / draw / resigned` flows once enabled.
- **OG / share**: per-token board snapshot at the FEN (similar to
  current `/api/og/victory/[id]` pattern).
- **Compatibility**: design metadata so the NFT is interpretable by
  external chess-aware marketplaces (subastable). Include the FEN +
  motif description in tokenURI so any reader knows what they hold.

### What we'd need first

These need to land before Moment NFT is even on the roadmap:

1. **Coach analysis maturity** — the `!!` / motif detection has to
   be reliable enough that the moments we surface are genuinely
   shareable (not noise).
2. **Per-position OG renderer** — extend the victory OG pipeline so
   any FEN renders as a board snapshot with the motif label.
3. **Contract decision** — extend VictoryNFT vs. new MomentNFT
   contract; affects upgrade paths + collection identity on
   marketplaces.
4. **Economic model** — moment NFTs are abundant by nature; pricing
   has to match scarcity expectations or we devalue the victory NFT.

## Decision until then

Resign / loss / draw correctly hide Save Victory in the visor. No
warning popup in the resign confirm flow ("you'll lose mint chance")
because the framing today is "Victory NFT" = checkmate wins. Adding
the warning would commit us to a UX promise we'd then have to either
keep or break when Moment NFT launches. Better to keep the current
framing clean and revisit when the broader feature ships.

## Related work in repo

- Contract: `apps/contracts/contracts/VictoryNFTUpgradeable.sol`
- Sign route: `apps/web/src/app/api/sign-victory/route.ts`
- Visor state machine: `apps/web/src/components/coach/game-actions-bar.tsx`
- Coach analysis hook (producer of future motifs):
  `apps/web/src/lib/coach/use-coach-analysis.ts`

## Cross-reference

- Memory: `project_moment_nft_roadmap`
- This doc: `docs/product/moment-nft-future-feature-2026-05-30.md`
