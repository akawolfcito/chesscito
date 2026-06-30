# Get Peones Treasury Canary — Operational Checklist

- **Date:** 2026-06-30
- **Branch checked:** `poc/minipay-treasury-contract`
- **Type:** Operations checklist (not a spec)
- **Canary state:** Disabled (fail-closed, default OFF)

This document persists the operational evidence steps for the Get Peones to
ChesscitoTreasury canary. It records the completed local validation and lists
the read-only on-chain reads and decisions still required before any enablement.
It authorizes no enablement, deploy, production config change, or commit.

## Local Supabase/Postgres validation summary

Validated against real Postgres using Supabase local on alternate ports
`55321-55329` (to avoid colliding with another local project). Migration under
test: `apps/web/supabase/migrations/20260630120000_get_peones_treasury_canary_foundation.sql`.

Schema:

- migration applies cleanly; `supabase db reset` reapplies cleanly and reproducibly;
- `treasury_payment_intents` exists;
- `treasury_payment_consumptions` exists;
- global identity unique constraint exists on `(chain_id, tx_hash, log_index)`;
- intent immutability trigger exists and is enabled (rejects UPDATE/DELETE);
- RLS enabled on both tables;
- deny-all RLS policies present for `anon` and `authenticated`;
- the three RPCs are `security definer`;
- execute grants restricted to `service_role` and `postgres` (no `anon`, `authenticated`, `public`).

RPC behavior (exercised against real Postgres):

- canary first use returns `credited`;
- same canary payment plus same intent returns `duplicate` idempotently;
- same payment plus different intent returns `payment_replay`;
- same payment reused for Season Pass returns `payment_replay`;
- legacy Get Peones to Season Pass cross-product replay returns `payment_replay`;
- Season Pass to legacy Get Peones cross-product replay returns `payment_replay`;
- two concurrent settlements on one fresh identity grant exactly one entitlement
  (one `credited`, one `duplicate`, exactly one ledger row).

Quality gates: 77/77 tests passed, TypeScript clean, `git diff --check` clean.

### Control 7 status

**`operational-evidence-ready local`.** The global identity
`chainId + txHash + logIndex` is consumed atomically with the entitlement,
demonstrated against real Postgres with concurrency, cross-product replay, and
same-product idempotency. This is local evidence only; it does not cover the
cloud/hosted database.

## Local environment state

- Supabase local (project `web`) was stopped cleanly with `supabase stop`.
  Containers removed; data volumes preserved (`supabase_db_web`,
  `supabase_storage_web`). No volumes deleted.
- Generated local tooling files remain untracked and must not be committed:
  - `apps/web/supabase/config.toml`
  - `apps/web/supabase/.gitignore`
- Another local Supabase project `qxwztvfazronkshgkckk` appears to be running on
  ports `54321-54327`. It belongs to a different local repo (its ref does not
  match any cloud project in this account). Do not stop or delete it without
  confirming its owner first. If later confirmed orphaned, stop it from its own
  project directory with `supabase stop`; never `docker volume rm` blindly.

## Control 2 — Treasury deployment read-only checklist (Celo Mainnet)

Known deployment record:

- Treasury: `0xcD3837DD017dFA5E31A2e3Cf390721E16Ac8Fbf0`
- Chain: Celo Mainnet `42220`
- Owner/Payout expected: `0x917497b64eeB85859edcf2e4ca64059eDfeC1923`

All commands below are read-only (`cast call` / `cast code`). No signing, no
writes. Requires Foundry and a Celo RPC.

```bash
TRE=0xcD3837DD017dFA5E31A2e3Cf390721E16Ac8Fbf0
RPC=https://forno.celo.org
EXPECTED_OWNER=0x917497b64eeB85859edcf2e4ca64059eDfeC1923

# 1. Bytecode non-empty (confirms a contract, not an EOA)
cast code $TRE --rpc-url $RPC | head -c 12        # must NOT be "0x"

# 2. owner()        -> expected EXPECTED_OWNER
cast call $TRE "owner()(address)" --rpc-url $RPC

# 3. pendingOwner() -> expected 0x000...000 (no pending transfer)
cast call $TRE "pendingOwner()(address)" --rpc-url $RPC

# 4. payoutAddress() -> expected EXPECTED_OWNER
cast call $TRE "payoutAddress()(address)" --rpc-url $RPC

# 5. acceptedToken(token) per candidate -> true enables the token
cast call $TRE "acceptedToken(address)(bool)" 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e --rpc-url $RPC  # USDT
cast call $TRE "acceptedToken(address)(bool)" 0xcebA9300f2b948710d2653dD7B07f33A8B32118C --rpc-url $RPC  # USDC
cast call $TRE "acceptedToken(address)(bool)" 0x765DE816845861e75A25fCA122bb6898B8B1282a --rpc-url $RPC  # cUSD/USDm

# 6. decimals() on-chain per token -> must match tokens.ts
cast call 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e "decimals()(uint8)" --rpc-url $RPC  # expected 6
cast call 0xcebA9300f2b948710d2653dD7B07f33A8B32118C "decimals()(uint8)" --rpc-url $RPC  # expected 6
cast call 0x765DE816845861e75A25fCA122bb6898B8B1282a "decimals()(uint8)" --rpc-url $RPC  # expected 18
```

Explorer verification:
`https://celoscan.io/address/0xcD3837DD017dFA5E31A2e3Cf390721E16Ac8Fbf0#code`.
Confirm source verified, `Ownable2Step`, and no unexpected proxy.

Withdrawal runbook (read-only notes; do not execute without operational approval):

- `withdrawTokenToPayout(token, amount)` sends to the configured `payoutAddress`.
- `withdrawToken(token, to, amount)` sends to any destination (owner only).
- `renounceOwnership()` is reverted by design (`OwnershipRenunciationDisabled`).
- Any write requires the owner `0x917497b64eeB85859edcf2e4ca64059eDfeC1923`
  (Safe) signature.

## Candidate token matrix

| Token | Address | Expected decimals | MiniPay POC | acceptedToken | Canary decision |
| --- | --- | --- | --- | --- | --- |
| USDT | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | 6 | Used in mainnet POC | true (verified 2026-06-30) | First canary candidate |
| USDC | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | 6 | Not tested | false (verified 2026-06-30) | Second cycle (needs owner setAcceptedToken) |
| cUSD/USDm | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | 18 | Not tested | false (verified 2026-06-30) | Separate validation (18 decimals, needs owner setAcceptedToken) |

A token is enabled only when `acceptedToken(token)` is true and on-chain
`decimals()` matches `tokens.ts`. The intent endpoint already fails closed on a
decimals mismatch (`token_decimals_mismatch`).

## On-chain read evidence — 2026-06-30

Evidence only. This does not mark the canary ready.

- Branch: `poc/minipay-treasury-contract`
- Chain: Celo Mainnet `42220`
- RPC: `https://forno.celo.org`
- Method: read-only viem `getBytecode` + `readContract` (no signing, no writes)
- Treasury: `0xcD3837DD017dFA5E31A2e3Cf390721E16Ac8Fbf0`

Treasury custody reads:

- bytecode length: `3504`
- bytecode non-empty: PASS
- `owner()`: `0x917497b64eeB85859edcf2e4ca64059eDfeC1923` PASS (matches expected)
- `pendingOwner()`: `0x0000000000000000000000000000000000000000` PASS (zero, no pending transfer)
- `payoutAddress()`: `0x917497b64eeB85859edcf2e4ca64059eDfeC1923` PASS (matches expected)

Token reads:

| Token | Address | acceptedToken | decimals | Verdict |
| --- | --- | --- | --- | --- |
| USDT | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | true | 6 | First canary token |
| USDC | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | false | 6 | Not enabled on-chain |
| cUSD/USDm | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | false | 18 | Not enabled on-chain |

USDT is the only token currently accepted by the Treasury, so the first canary
must be USDT-only. Enabling USDC or cUSD/USDm later requires an owner
`setAcceptedToken` write plus separate validation. Pending for full Control 2
PASS: Celoscan source-verification confirmation, reproducible bytecode-to-build
match, and a signed custody/withdrawal runbook.

## Finality decision note

- Recommended: `CHESSCITO_TREASURY_CANARY_CONFIRMATIONS=3` (about 15s on Celo IBF).
- Scope: Get Peones Treasury canary only. SKU `peones_pack_50`. Amount `$0.50`.
- Reason: conservative enough for a small Celo canary while still usable.
- Status: **not approved yet. Do not set env vars.** Without an approved value the
  config fails closed with `canary_finality_unconfigured`.

## Auth risk sign-off note

- `ALLOW_CLIENT_ASSERTED_WALLET_FOR_GET_PEONES_CANARY=true` is required before any
  enablement.
- Default must remain OFF. Without it the config fails closed with
  `canary_client_asserted_wallet_not_allowed`.
- Accepts limited risk because no SIWE/SIWC or authenticated wallet session
  exists. Credit remains constrained to the canonical transaction sender and
  `Transfer.from`.
- Status: **not approved yet. Do not enable the risk gate.**

## Remaining blockers before enablement

1. Control 2 on-chain reads executed, dated, and signed by the custodian.
2. Token matrix reads: `acceptedToken` true plus on-chain decimals per enabled token.
3. Finality approval: explicitly approve `CONFIRMATIONS=3`.
4. Auth risk sign-off: documented acceptance of the client-asserted wallet model.
5. DB cloud migration applied to the hosted chesscito project via deploy/CI
   (local validation does not substitute the hosted apply).
6. Rollback exercise: documented kill-switch run that stops new intents while
   preserving recovery of mined payments.

## Non-authorization statement

No production config changed. No cloud/production database touched. No deploy.
No destructive Docker cleanup. No commit. The canary is not enabled; all canary
env vars remain unset and default OFF.
