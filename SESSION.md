# Session Handoff — 2026-07-03 (cont.)

Full detail: `docs/handoffs/2026-07-03-victory-nft-permit-mint-mainnet-activation-handoff.md`.

## Completed
- Root-caused "SAVE VICTORY firma pero no mintea": mainnet proxy was still on the OLD impl (no `mintSignedWithPermit`) — prior handoff's "deployed on mainnet" claim was false (`forceImport` footgun).
- Fixed: fresh mainnet impl `0x21cbB2dB6F4d023623A4dfe3A0dD05E8E51C741c` deployed + proxy upgraded (block 71208562). Verified with 3 real MiniPay permit mints, correct 80/20 split.
- yParity signature normalization shipped (`76e4283b`, v=27/28 for MiniPay).
- **Cluster closed**: `NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED=true` activated in Production (`play`); `main`→`production` release confirmed (both at `76e4283b`). Awaiting next Production deploy to bake in the env var (`NEXT_PUBLIC_*` is build-time).
- Checkmate popup 2-decimal rounding bug: resolved as a side effect of the whole-cent repricing (1/2/3 ctvs) — no code change needed.
- MiniPay review call feedback captured — 3 asks, driving next priorities (see below).

## Current State
- **Branch**: `main` == `production` @ `76e4283b`, working tree clean except this handoff commit.
- **Build**: 4579/4579 passing, tsc+eslint clean.

## Next Tasks (MiniPay listing feedback, priority order)
1. **Landing redesign, ~4 onboarding slides (mobile)** — founder has designs ready. Scoped exception to the no-carousels rule, landing only. Also verify Privacy Policy / Terms / Support links are clearly visible (reviewer flagged explicitly).
2. **Validate save-score-onchain is gas-only** — ties to reviewer's "simpler initial flow" ask.
3. **Full → play simplification**: hide/retire Train Pieces (Lite mode) from the primary entry; rename Lite → "Train Pieces", Play → "Play Chess + Coach".
4. After those: remaining backlog — Coach Peones price (needs real LLM cost data), issue #101 prize pool distribution v2, coach stale `?wallet=` edge case.

## Blockers
None.

## Notes
- Key Mainnet addresses: VictoryNFT proxy `0x0eE22F830a99e7a67079018670711C0F94Abeeb0`, impl `0x21cbB2dB6F4d023623A4dfe3A0dD05E8E51C741c` (upgraded 2026-07-03T20:08Z), treasury `0xcD3837DD017dFA5E31A2e3Cf390721E16Ac8Fbf0`, prizePool `0x63DEfFD397B6470521f84Da621f47e1727424a51`.
- Never run `hardhat run` deploy/configure scripts myself via Bash expecting them to sign — hand the exact command instead.
- Command hygiene: `git -C`/`pnpm -C`, never `cd`; one cmd per call; Write tool for files.
