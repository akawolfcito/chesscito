# Victory NFT permit mint — handoff (2026-07-03)

Status: **merged to `main` locally** (`688b8a03`), not yet pushed (operator
pushing separately), not deployed anywhere. Shop consolidation step 3 from
`docs/product/chesscito-treasury-unification-plan-2026-07-01.md`.

## What shipped in this branch

Full spec → red-team review → 12-task staged TDD implementation via
Subagent-Driven Development, all tasks individually reviewed + one final
whole-branch review (opus). Docs:
- `docs/superpowers/specs/2026-07-02-victory-nft-permit-mint-design.md`
- `docs/superpowers/specs/2026-07-02-victory-nft-permit-mint-redteam.md`
- `docs/superpowers/plans/2026-07-02-victory-nft-permit-mint.md`
- Full task-by-task ledger: was at
  `.superpowers/sdd/progress.md` inside the now-merged worktree (gitignored
  scratch — not in the merged history; this handoff is the durable record).

**Contract** (`apps/contracts/contracts/VictoryNFTUpgradeable.sol`): new
`mintSignedWithPermit` function, additive-only — `mintSigned` is
byte-identical (confirmed: diff on that file was insertions-only, zero
deletions, verified independently at every review stage). Lets a player
mint using an EIP-2612 permit signature instead of a separate `approve()`
transaction. The internal `permit()` call is `try/catch`-wrapped — a
deliberate fix for front-running/griefing (red-team P1-1), proven by a
dedicated test that simulates a third party submitting the signature first.

**Compiler**: `viaIR: true` added to `apps/contracts/hardhat.config.ts`
(operator-approved mid-implementation — the new function's 11 params + 4
locals hit legacy codegen's stack limit). Package-wide setting, recompiles
every contract. Verified non-regressing: **117/117** passing across all 7
non-forking contract test suites (Badges, ChesscitoTreasury,
LabyrinthBadges, Scoreboard, Shop, ShopUpgradeable, VictoryNFT).

**Client** (`apps/web/src/lib/coach/use-mint-victory.ts` +
`lib/feature-flags.ts` + `lib/contracts/{tokens,victory,permit-abi}.ts`):
feature flag `NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED` (default OFF, unset
in every environment today) gates a new branch in `useMintVictory` that
reads the token's live on-chain nonce, signs a permit, calls
`mintSignedWithPermit`. Falls back transparently to the legacy
`approve`+`mintSigned` path on any technical failure; an explicit user
rejection of the permit signature short-circuits to `cancelled` (same as
today's approve-rejection UX), no forced second prompt.

**Real on-chain discovery during Task 1**: cUSD rebranded on Celo Mainnet
to **"Mento Dollar"** (symbol `USDm`), EIP-712 domain version `"3"` — not
`"cUSD"`/`"1"` as originally assumed in the plan. Verified via a real
`permit()` call on a mainnet fork, not just a getter read. Threaded
correctly end-to-end: `tokens.ts` pins the confirmed `permitVersion`; the
live client path reads `name()` on-chain rather than hardcoding it —
confirmed by the final whole-branch reviewer, no stray `"cUSD"` domain
string anywhere in the signing path.

## Verification evidence

- Contracts: 117/117 passing (7 suites, includes the new
  `mintSignedWithPermit` coverage + proxy-upgrade storage-safety test).
- Client: 23/23 passing (`use-mint-victory.test.ts`,
  `feature-flags.test.ts`, `errors.test.ts`), tsc clean.
- Device: real MiniPay permit-rejection captured 2026-07-02 via
  `/dev/permit-probe` — `"An internal error was received. Details: User
  rejected signing request Version: viem@2.46.3"` — matches
  `isUserCancellation` as-is, no code change needed.
- Final whole-branch review (opus): **Ready to merge: Yes.** No Critical.
  One Important (evidence gap — Task 6's regression record only covered
  `VictoryNFT.ts`, not the other 6 contract files `viaIR` also recompiles;
  closed by running all 7, 117/117 green). Three Minor, deferred (see
  below).

## Deploy safety — answering "do we need a Vercel flag?"

**No.** `NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED` defaults to `false` when
unset — this is exactly the desired state for this merge. Deploying the web
app as-is ships the flag OFF, the new code path is fully inert, and
behavior is 100% unchanged from before this branch. No Vercel env var needs
to be added for this deploy to be safe.

**But the contract itself is not deployed anywhere yet** (not Sepolia, not
Mainnet) — `mintSignedWithPermit` only exists in this repo's source, not on
any live proxy. Do **not** set the flag to `"true"` in any environment
until the contract upgrade actually happens, or every permit-path attempt
will fail (the function won't exist on-chain) — though it would fail as a
"technical failure" and fall back to the legacy path automatically, so even
a premature flag-flip wouldn't break minting, just wouldn't get the
single-tx benefit.

## Not done — explicitly out of scope, staged for later sessions

Per the design spec's Rollout section (steps 0-6), none of this happened in
this branch:
1. Deploy new implementation to the Sepolia proxy, testnet mint.
2. Deploy to Celo Mainnet proxy (same address, new implementation).
3. Enable flag for founder wallet in Preview, one real small mint.
4. Enable in Production.
5. A second, code-level red-team review of the final diff before any
   mainnet upgrade transaction (the two reviews already done were
   spec-level, pre-implementation, and per-task/whole-branch — a dedicated
   pre-deploy security pass on the merged code is still the standing
   process for any mainnet contract change).

Three Minor items from the final review, deferred to whichever session does
the above (none block this merge):
- Injected `sendPermit` test fixture passes `symbol` where `name` would be
  more accurate (cosmetic — fixtures never verify a real signature).
- `payment_path` telemetry only fires on the `success` stage, not on
  `error`/`cancelled`/`timeout` — limits canary failure-path attribution
  once the flag is eventually enabled.
- `hardforkHistory` addition to `hardhat.config.ts` (needed for Task 1's
  fork test) wasn't logged as a deviation alongside `viaIR` — noted here
  for the record.

## Next steps

1. Operator pushes `main` to origin.
2. Whenever ready to actually enable this feature: Sepolia deploy → Mainnet
   deploy → pre-deploy code-level red-team review → staged flag enable
   (Preview founder-only → Production), per the design spec's Rollout
   section. Not scheduled, no urgency — `mintSigned` keeps working exactly
   as today in the meantime.
