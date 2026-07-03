# Victory NFT — Mainnet deploy, red-team, pricing + treasury unification (2026-07-03)

Continuation of `docs/handoffs/2026-07-03-victory-nft-permit-mint-handoff.md`
(same day, second session). That handoff left `mintSignedWithPermit`
code-complete on `main`, deployed nowhere. This session closed the entire
rollout, plus an unplanned but resolved monetization-model question that
came up mid-session.

## What shipped today

### 1. Sepolia deploy + real mint proof
- Proxy `0x87cC9fe03E76A5894De2FE1372E85D6f5Bb922A9` upgraded to impl
  `0x4dE7e2CCD1A7d5fdf6d0Aea80729bf450d993276`, verified on Celoscan.
- 3 real `mintSignedWithPermit` calls executed — no `approve()` tx, correct
  80/20 split (verified via `Transfer` event decoding, not balance deltas —
  Sepolia's treasury happened to equal the player wallet, making a naive
  balance-delta check read as a false failure).
- New reusable scripts in `apps/contracts/scripts/`: `upgrade-victory-nft.ts`,
  `verify-victory-nft-impl.ts`, `deploy-mock-permit-token.ts`,
  `smoke-victory-permit-mint.ts`.

### 2. Pre-deploy code-level red-team (the gate the prior handoff required)
Reviewed the merged diff (`03ac2485`) against the previously-live mainnet
implementation. No HIGH/MEDIUM findings. Confirmed: the `permit()`
try/catch griefing defense is correctly scoped (front-runner can only
pre-grant the exact allowance the user already authorized, no fund
redirection possible); reentrancy guard shared across `mintSigned`/
`mintSignedWithPermit`; voucher binds to `msg.sender`, not replayable by a
third party; `viaIR: true` is a codegen change only, already regression-
tested (117/117).

### 3. Mainnet deploy
- Proxy `0x0eE22F830a99e7a67079018670711C0F94Abeeb0` upgraded to impl
  `0x4dE7e2CCD1A7d5fdf6d0Aea80729bf450d993276` (same bytecode as Sepolia).
- Verified on Celoscan.
- **Client flag `NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED` is still
  unset/OFF everywhere** — this deploy alone changes nothing for real
  users. `mintSigned` (approve + mint, 2 tx) is unaffected and still the
  only live path.

### 4. Unplanned: pricing + treasury/prizePool unification (Mainnet + Sepolia)
Came from the founder asking "who actually gets the 80/20" mid-review,
which snowballed into a full monetization-model audit (see
`_bmad-output/brainstorming/brainstorming-session-2026-07-03-0713.md` for
the complete session — Mary/bmad-agent-analyst persona, First Principles →
Morphological Analysis → convergence). Key non-obvious findings, in
`[[project_victory_nft_pricing_treasury_2026_07_03]]` (memory):

- The mint's "momentum" (Checkmate! popup) and "curated" (Diary > REVIEW
  MATCH) moments **both already existed in production** — no new UX to
  build, the architecture the founder was second-guessing was already
  correct.
- Arena's "Checkmate!" popup had a **pre-existing cosmetic bug**: displayed
  Easy as $0.01 (2-decimal rounding of the real $0.005) while the Coach
  viewer correctly showed $0.005 via a different formatting helper. Instead
  of fixing the display down, founder chose to raise the real price up to
  match — see next point. **The underlying rounding bug in
  `apps/web/src/lib/contracts/tokens.ts`'s `formatUsd` is still there**,
  latent, would resurface if any future price goes sub-cent again.
- **Prices changed**: Easy $0.005→$0.01, Medium $0.01→$0.02, Hard
  $0.02→$0.03. Verified independently via raw RPC on both networks after
  the founder ran `configure-victory-nft-treasury.ts`.
- **Treasury/prizePool were both founder EOAs** (a March placeholder) — now:
  - `treasury` → existing `ChesscitoTreasury` (`0xcD3837DD017dFA5E31A2e3Cf390721E16Ac8Fbf0`,
    same contract already used by Get Peones/Season Pass).
  - `prizePool` → **new** second `ChesscitoTreasury` instance, deployed
    today, custody-only (no distribution logic — that's GitHub issue #101
    "Prize pool distribution v2", explicitly not solved today). Mainnet:
    `0x63DEfFD397B6470521f84Da621f47e1727424a51`, owner=payout=founder
    wallet. Verified on Celoscan.
- New scripts: `deploy-chesscito-prizepool.ts` (separate record key from
  `deploy-chesscito-treasury.ts` — reusing that script directly would have
  overwritten the first instance's recorded address), `configure-victory-
  nft-treasury.ts` (idempotent).
- **Explicitly deferred, not resolved today**: Coach analysis's 1-Peón
  price, which the code itself flags as "sospechoso" (`spend-service.ts`) —
  needs real per-analysis LLM cost data before repricing. Don't invent a
  number for it without that data; same discipline applied to the mint
  price today.

## Verification discipline this session

Every on-chain claim was independently re-read via raw RPC (`eth_getCode`,
`eth_getStorageAt`, direct contract calls) after each script ran — never
trusted from script stdout alone. This caught two real script bugs before
they caused damage (both now in memory as reusable lessons):
- [[feedback_oz_upgrades_forceimport_new_factory_footgun]] — `forceImport`
  with the new factory silently poisoned the OZ manifest, made
  `upgradeProxy` a false-positive no-op.
- [[feedback_celo_sepolia_forno_rpc_eventual_consistency]] — forno's
  load-balanced nodes produced false negatives (stale reads, "nonce too
  low", "block is out of range") on reads/writes done back-to-back.

Also discovered and documented: [[feedback_never_execute_signing_txs_myself]]
— the agent's shell correctly has no access to `DEPLOYER_PRIVATE_KEY`;
every signing tx this whole session was run by the founder in their own
terminal, agent only wrote scripts + independently verified results
read-only afterward.

## ⚠ Critical bug found and fixed same session: stale client-side price

The founder asked, after all mainnet changes above, "is this now just a
flag-flip + deploy to fully migrate to permit mint?" — investigating that
question surfaced a **live production correctness bug**, not a
flag-rollout question.

**Root cause:** `apps/web/src/lib/contracts/tokens.ts`'s `VICTORY_PRICES`
constant (`1: 5_000n, 2: 10_000n, 3: 20_000n` — the OLD prices) is the
**single source** feeding both the UI price labels AND the amount the
client signs/approves on-chain — there is no live `priceUsd6()` contract
read anywhere in `use-mint-victory.ts`. Confirmed call chain:
`use-mint-victory.ts:197` (`mintPriceUsd6`) → `:379` (`effectivePriceUsd6`)
→ `:418` (`normalizedAmount`) → `:479` (permit `value` field, what the user
signs) and `:513` (legacy `approve(amount)`). Both the permit path and the
legacy approve+mint path derive from the same stale constant.

**Impact:** because mainnet's on-chain price was raised today
($0.005→$0.01 etc., see above) without updating this constant, **the
currently-live `mintSigned` path (approve + mint) was broken in production
from the moment the price change landed** — client approves the old
(lower) amount, contract's `transferFrom` needs the new (higher) amount,
`transferFrom` reverts on insufficient allowance. This affects the live
path regardless of the permit-mint flag; it was not a "future" risk.

**Fix applied same session:** updated `VICTORY_PRICES` to
`1: 10_000n, 2: 20_000n, 3: 30_000n` (`tokens.ts:60-64`). Single source, so
this simultaneously fixes the signed/approved amount for both paths and
all display labels. `use-mint-victory.test.ts` reverified green (16/16)
after the fix. **Not yet committed or deployed** — code change only, still
uncommitted in the working tree as of this handoff.

## Open questions / not done

1. **The price fix above is uncommitted and undeployed.** This is the
   actual blocker — not the permit-mint flag. Must ship before anything
   else touches Victory NFT mint, permit or legacy.
2. Arena "Checkmate!" popup's underlying 2-decimal rounding bug — not
   fixed, currently masked by the price coincidentally now matching what
   it always displayed. `format-price.ts:25`'s sub-cent branch is also now
   dead code with Easy at a whole cent — cosmetic, not blocking.
3. GitHub issue #101 (Prize pool distribution v2) — still open, still no
   actual distribution logic. Today only gave it a proper custody home.
4. Coach's 1-Peón price — unresolved, needs real LLM cost data.
5. Rollout of the permit-mint flag itself: per the original plan (prior
   handoff), staged as Preview founder-only → Production, not a direct jump
   to Production.

## Next steps

1. **Commit + deploy the `tokens.ts` price fix** — urgent, independent of
   the permit-mint flag. The live legacy mint path is broken until this
   ships.
2. Confirm in Preview (or Production, since it's a straight bugfix) that a
   real mint via the legacy `mintSigned` path succeeds at the new price.
3. Only then: enable `NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED=true` in
   **Preview only** first, founder does one real small mint, confirm the
   permit path actually executes (not just falls back silently to
   `mintSigned`) before enabling in Production.
4. Whenever picked back up: Arena display-bug fix (one line, low risk),
   Coach pricing pass (needs LLM cost data first), prize-pool distribution
   design (issue #101, larger scope).
