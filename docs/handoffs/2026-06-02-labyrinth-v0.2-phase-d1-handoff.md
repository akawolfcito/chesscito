# Handoff — 2026-06-02 — Labyrinth v0.2 Phase D.1 (Sepolia checkpoint)

## Status

- Phases A+B+C+D shipped to `main`.
- **Phase D.1 (Sepolia deploy + final-architecture smoke) closed.**
  Working tree clean on `5f335d74`; range `434e30df..5f335d74` pushed to
  `origin/main` 2026-06-02. Phase D.2 (mainnet) is queued but **not the
  immediate next session**.
- LabyrinthBadges is **NOT** live on mainnet. Mint UI is not built.
  No payment/fee path. Proof remains soulbound; the transferable
  economy is deferred to a separate rewards/cosmetics layer.

## What landed in Phase D.1

| Commit       | Message                                                       |
|--------------|---------------------------------------------------------------|
| `434e30df`   | chore(contracts): add LabyrinthBadges Sepolia smoke script    |
| `ac6e9ae1`   | docs(deploy): record LabyrinthBadges Sepolia deployment       |
| `ac149a1e`   | feat(api): wire sign-labyrinth to LabyrinthBadges address     |
| `5f335d74`   | chore(config): document LabyrinthBadges address env var       |

## LabyrinthBadges — Celo Sepolia (chainId 11142220)

| Field                    | Value                                                                              |
|--------------------------|------------------------------------------------------------------------------------|
| Proxy                    | `0x8AA4006dfb3D5B7e255Df26B1065CD87A193171b`                                       |
| Implementation           | `0xade28F98E4B25e20859164Eef5354a4845C87372`                                       |
| ProxyAdmin (dedicated)   | `0xE98b6aBF59FACD94B13FBDC3392f7933D832bB54`                                       |
| Owner                    | `0x917497b64eeB85859edcf2e4ca64059eDfeC1923`                                       |
| Signer                   | `0x50c75be158168eCB3df326610f5E8Ea51F0B3CAe`                                       |
| Base URI                 | `ipfs://chesscito/labyrinth-badges/`                                               |
| Deployed                 | 2026-06-03 (block ~27171330)                                                       |
| Explorer                 | [sepolia.celoscan.io](https://sepolia.celoscan.io/address/0x8AA4006dfb3D5B7e255Df26B1065CD87A193171b) |

Canonical address ledger: `docs/contracts.md`.

## Smoke validation against Sepolia

5/5 checks passed via `apps/contracts/scripts/smoke-labyrinth-badges.ts`:

1. **1★ claim happy path** — tx `0x8e499599…b3897` (block 27171332):
   `balanceOf == 1`, `bestMintedStars == 1`, `LabyrinthClaimed` event fired.
2. **Same-tier re-claim revert** — accepted generic revert (Forno strips
   custom error names; the invariant holds).
3. **Strict-improvement to 3★** — tx `0x412ceee3…79418` (block 27171340):
   distinct tokenId minted, `balance(3★) == 1`, `bestMintedStars == 3`.
4. **`safeTransferFrom` reverts** — soulbound invariant confirmed.
5. **`uri(tokenId)`** — `baseURI + tokenId + .json` format confirmed.

Two earlier smoke runs surfaced false-negative reporting due to Forno
RPC eventual consistency and stripped custom errors. Fixed in
`434e30df` via receipt-block-pinned reads (`{ blockTag }`) and
generic-revert tolerance. On-chain state was correct from the first run.

## Web wiring state

`apps/web/src/app/api/sign-labyrinth/route.ts` now uses
`labyrinthBadgesAddress` as `verifyingContract`, sourced from
`getDemoConfig()` reading `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS`. The
`TODO(phase-D)` marker shipped in `63c64c8b` is removed. EIP-712 domain
unchanged (`name: "LabyrinthBadges"`, `version: "1"`). The 3 sister sign
endpoint tests (`sign-badge`, `sign-score`, `sign-victory`) had their
`getDemoConfig` mocks extended with the new field; type-check is green.

Vercel production env still needs `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS`
provisioned before the route starts producing signed vouchers under
traffic. This is part of D.2, not D.1.

## What's NOT done

- **Mainnet deploy** of `LabyrinthBadges`. Same script (`deploy-labyrinth-badges.ts`)
  + `--network celo` + `vercel env add ... production` is the recipe.
- **Mint sheet UI** (Phase E). Spec §5.2 defines the surface.
- **`docs/contracts.md` mainnet row** is `_pending deploy (Phase D.2)_`.
- **Phase C follow-up #1** — logger instrumentation for
  `sign-badge` + `sign-labyrinth` as one cross-cutting commit. Still
  deferred. Hook surfaced it during D.1 and was correctly skipped.
- **`MEMORY.md` contracts table** — not updated with the new Sepolia
  address (user-only memory; handled in this session).
- **2 untracked files** in `docs/reviews/` from a parallel workflow
  remain untracked, never staged.

## Next session focus — **NOT D.2**

> Per user direction at close-out, the next session is **MiniPay
> listing adjustments**, not the D.2 mainnet pass.

Things to bring into the next session:

- HARD RULE — [minipay-listing-safety](../../README.md): until official
  listing approval, never write "MiniPay game / Free on MiniPay /
  Available on MiniPay". Use "Designed with MiniPay in mind / Pensado
  para MiniPay" instead.
- Two untracked review docs in `docs/reviews/` from your parallel
  workflow are likely related to this push:
  - `docs/reviews/2026-06-02-celopedia-ecosystem-evaluation.md`
  - `docs/reviews/2026-06-02-celopedia-minipay-listing-checklist.md`
  These are the natural starting point for the next session.

D.2 (mainnet deploy + Vercel env + mainnet smoke + `docs/contracts.md`
row) remains queued; pick it up after the MiniPay listing pass settles.

## Open questions (non-blocking)

1. **Logger instrumentation rollout window.** Phase C follow-up #1 needs
   one cross-cutting commit; no current trigger to do it. Bundle with
   D.2 wiring or with a dedicated observability cluster.
2. **Mint fee at mainnet.** Spec §8.1 noted possible $0.005 nominal
   fee. v0.1 contract has no payable path; if a fee is desired before
   E, that decision happens in D.2 spec phase.
3. **Per-tier metadata art.** v0.1 reuses board thumbnail. Campaign
   bespoke art is v0.2.

## Blockers

None for D.1 (closed). D.2 requires:
- a separate deploy session with `--network celo`,
- mainnet SAFE_OWNER + SIGNER_ADDRESS configured (same as Sepolia per
  cross-contract convention),
- `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS` provisioned in Vercel production env via `vercel env add` (NOT committed),
- mainnet smoke against the freshly deployed proxy.

## Verification baseline at handoff

- `git status --short`: only the 2 unrelated `docs/reviews/*.md`
  untracked; tracked tree clean.
- `origin/main` HEAD: `5f335d74`.
- `npx hardhat test` (apps/contracts): 97/97 passing.
- `pnpm vitest run src/app/api/sign-{badge,labyrinth,score,victory}`:
  4 files / 37 tests passing.
- `pnpm type-check` (apps/web): green.
- Sepolia smoke: 5/5 green (see §"Smoke validation").

## Reference artifacts

- Phase D audit: `docs/audits/2026-06-02-labyrinth-v0.2-phase-d-contract-review.md`
- Contract spec (frozen): `docs/superpowers/specs/2026-06-02-labyrinth-badges-contract-v0.1.md`
- System spec (frozen): `docs/superpowers/specs/2026-06-02-labyrinth-system-v0.2.md`
- Contract: `apps/contracts/contracts/LabyrinthBadges.sol`
- Tests: `apps/contracts/test/LabyrinthBadges.test.ts`
- Deploy script: `apps/contracts/scripts/deploy-labyrinth-badges.ts`
- Smoke script: `apps/contracts/scripts/smoke-labyrinth-badges.ts`
- Contracts ledger: `docs/contracts.md`
- Prior handoff: `docs/handoffs/2026-06-02-labyrinth-v0.2-phase-b-handoff.md`
