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
`setAcceptedToken` write plus separate validation.

## Source verification and bytecode match — 2026-07-01

- Celoscan source verification: **PASS** (completed manually).
- Verification URL:
  `https://celoscan.io/address/0xcD3837DD017dFA5E31A2e3Cf390721E16Ac8Fbf0#code`
- Bytecode-vs-artifact match: **PASS** (byte-for-byte).
  - Artifact: `apps/contracts/artifacts/contracts/ChesscitoTreasury.sol/ChesscitoTreasury.json`
  - Deployed runtime equals local artifact runtime bytecode (1751 bytes, metadata trailer included).
  - Build: solc `0.8.28`, evmVersion `cancun`, optimizer enabled, runs `200`.
- **Control 2 status: `on-chain-source-and-bytecode-evidence-ready`.**
  Custody reads (owner, pendingOwner, payout), source verification, and bytecode
  match are all evidenced. The one remaining Control 2 item is a signed
  custodian/withdrawal runbook sign-off (see Custodian runbook below).

## Candidate token matrix v1 decision

- Canary v1 is **USDT-only**.
  - Token: USDT `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e`
  - Chain: Celo Mainnet `42220`, decimals `6`, Treasury `acceptedToken=true`.
- USDC and cUSD/USDm are **excluded from v1** because on-chain `acceptedToken=false`.
  They require an owner `setAcceptedToken` write plus separate validation before
  any later cycle (cUSD/USDm additionally needs 18-decimal validation).

## Finality decision note

- Decision for canary v1: `CHESSCITO_TREASURY_CANARY_CONFIRMATIONS=3` (about 15s on Celo IBF).
- Scope: Get Peones Treasury canary only. SKU `peones_pack_50`. Amount `$0.50`.
  Entitlement: `50 Peones`.
- Reason: measure real MiniPay UX impact of 3 confirmations during the internal
  canary. This value may be reduced later based on observed `time_to_credit`.
- Measurement note: during the canary, record and observe `time_to_receipt`,
  `time_to_3_confirmations`, and `time_to_credit` to inform any later reduction.
- Status: value **approved for canary v1** as a decision record only. Env vars are
  **not set** by this PR; until the env is deliberately configured, the server
  fails closed with `canary_finality_unconfigured`.

## Auth risk sign-off note

- `ALLOW_CLIENT_ASSERTED_WALLET_FOR_GET_PEONES_CANARY=true` is required before any
  enablement. Default must remain OFF. Without it the config fails closed with
  `canary_client_asserted_wallet_not_allowed`.
- Strong wallet-session auth (for example SIWE/SIWC at app entry) is desired
  later and is not part of this canary.
- Decision for canary v1: client-asserted wallet risk is **accepted only for the
  internal/founder canary**, and only under all of these constraints:
  - USDT-only;
  - SKU `peones_pack_50`;
  - amount `$0.50`;
  - entitlement `50 Peones`;
  - internal/founder canary only (no public rollout);
  - credit constrained to the canonical transaction sender and `Transfer.from`.
- Status: accepted as a **documented decision record only**. The risk gate env is
  **not set** by this PR and remains OFF.

## Custodian runbook

- Owner/custodian Safe: `0x917497b64eeB85859edcf2e4ca64059eDfeC1923`.
- `withdrawTokenToPayout(token, amount)` sends to the configured `payoutAddress`.
- `withdrawToken(token, to, amount)` sends to an arbitrary recipient, owner only.
- `renounceOwnership()` is disabled by design (`OwnershipRenunciationDisabled`).
- Any owner write requires explicit operational approval.
- **No withdrawal or owner write is authorized by this PR.**

### Custodian sign-off

- Custodian reviewed and accepted the canary v1 runbook.
- No owner write is authorized by this PR.
- Any withdrawal, payout change, or token allowlist change (`setAcceptedToken`)
  requires separate explicit approval.
- Signed-off by: Wolfcito / owner operator.
- Date: 2026-07-01.

## Rollback exercise — live evidence 2026-07-01

Evidence source: real HTTP requests against a real Vercel Preview deployment
(`poc/minipay-treasury-contract` branch), sharing the hosted production
Supabase project `brsbdzpuvotxsadmcxyj`. No Production deployment was touched.

Setup: canary env vars (`GET_PEONES_TREASURY_CANARY_ENABLED`,
`CHESSCITO_TREASURY_CANARY_ADDRESS`, `_CONFIG_VERSION=rollback-exercise-2026-07-01`,
`_PRICE_VERSION=rollback-exercise-2026-07-01`, `_CONFIRMATIONS=3`,
`_TOKEN_ADDRESSES=<USDT>`, `ALLOW_CLIENT_ASSERTED_WALLET_FOR_GET_PEONES_CANARY`)
set on Vercel scoped to Preview + this branch only. `CELO_RPC_URL` (public Forno
endpoint, no secret) added to the same scope; it did not previously exist outside
Production, which caused an initial `canary_config_unverifiable` failure until added.

**ON** — `POST /api/payment-intents/get-peones` against
`chesscito-iyhovegt4-goodwolf.vercel.app` and `chesscito-mf8pdw6v7-goodwolf.vercel.app`,
wallet `0x000000000000000000000000000000000000dEaD` (test/burn address, never funded,
no real payment ever sent), token USDT, sku `peones_pack_50`: `200 ok:true`, intent
created (ids `92b95d41-6c3f-490f-bcb0-e2d6a7ef5a9b`, `471fa9a4-e64d-4bb5-8503-7cfd1f5a62c6`),
one row written to hosted `treasury_payment_intents` per call.

**OFF** — removed only `GET_PEONES_TREASURY_CANARY_ENABLED` from the Preview/branch
scope (other 6 canary vars left in place), redeployed
(`chesscito-ospmnqoj5-goodwolf.vercel.app`), same POST: `404 canary_disabled`,
confirmed no wallet/chain interaction occurs before the gate.

**Verification/recovery not gated** — with the flag OFF, `POST
/api/verify-payment/get-peones-canary` against the same OFF deployment with a
well-formed but non-existent tx hash returned `400 receipt_not_found` (real
receipt lookup attempted), not `canary_disabled`. Confirms already-submitted
payments can still be recovered after intent creation is cut off.

- Legacy Get Peones and Season Pass remain unaffected: they use their own routes
  and RPCs and are not gated by the canary flag (unchanged from prior analysis,
  not re-exercised live since they are out of scope for this canary).
- Re-enabling requires an explicit env/config review (open item below).

**Known side effect**: `treasury_payment_intents` has an active immutability
trigger (`BEFORE DELETE OR UPDATE`) by design (anti-tamper on payment audit
records). The 2 test intent rows above cannot be deleted through normal means
and were left in place rather than bypassing the trigger. They carry no
consumption (no matching row was ever written to
`treasury_payment_consumptions`, since no real transfer occurred) and use an
address that never received or sent canary funds.

**Incident during setup (self-corrected)**: the 7 canary env vars were
initially added scoped to both Preview and Production simultaneously. Caught
before any Production deployment picked them up. Removing the Production scope
via `vercel env rm NAME production` deleted the variable record entirely
(Preview scope was a single combined record, not two independent ones), so all
7 were re-added from scratch, this time scoped to Preview + this branch only.
Verified via `vercel env ls` that Production ended the exercise with only its
pre-existing `CELO_RPC_URL` and none of the 7 canary vars.

## Hosted Supabase migration — applied 2026-07-01

- Project ref: `brsbdzpuvotxsadmcxyj`.
- Migration: `20260630120000_get_peones_treasury_canary_foundation.sql`.
- Applied with: `supabase db push --linked --yes` (after a `--dry-run` confirming
  it was the only pending migration).
- Confirmed by: `supabase migration list --linked` (now shows on Local and Remote).
- Verification method: `supabase db dump --schema public` plus remote schema inspection.
- Objects verified on remote:
  - `treasury_payment_intents`;
  - `treasury_payment_consumptions`;
  - unique `(chain_id, tx_hash, log_index)` on `treasury_payment_consumptions`;
  - immutability trigger `treasury_payment_intents_immutable` (BEFORE DELETE OR UPDATE);
  - RLS enabled on both tables;
  - deny-all policies for `anon` and `authenticated`;
  - the 3 RPCs (`consume_get_peones_treasury_payment`,
    `consume_legacy_get_peones_payment`, `consume_lite_season_pass_payment`);
  - grants restricted to `service_role` (revoked from `public`/`anon`/`authenticated`).
- No records inserted; tables are empty by construction.
- Canary envs remain OFF; applying the migration changes no runtime behavior.

## Final env/config review — 2026-07-01

Reviewed every env var the server config path touches
(`resolveGetPeonesCanaryServerConfig` + `isGetPeonesCanaryServerEnabled`), plus
the client-side gate, against the decisions already recorded above.

**Server-side (7 vars) — recommended Production values on enablement:**

| Var | Recommended value | Basis |
| --- | --- | --- |
| `GET_PEONES_TREASURY_CANARY_ENABLED` | `true` | the kill switch itself |
| `CHESSCITO_TREASURY_CANARY_ADDRESS` | `0xcD3837DD017dFA5E31A2e3Cf390721E16Ac8Fbf0` | Control 2 evidence above |
| `CHESSCITO_TREASURY_CANARY_CONFIG_VERSION` | `canary-v1` | new label, not `rollback-exercise-*` (that label is now burned by the 2 test intents; reusing it would be confusing in future audits) |
| `CHESSCITO_TREASURY_CANARY_PRICE_VERSION` | `canary-v1` | same reasoning; `peones_pack_50` price is hardcoded in `rail-config.ts` ($0.50 / `priceUsd6: 500_000n`), this label is descriptive only, not a live price switch |
| `CHESSCITO_TREASURY_CANARY_CONFIRMATIONS` | `3` | Finality decision above |
| `CHESSCITO_TREASURY_CANARY_TOKEN_ADDRESSES` | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` (USDT) | Token matrix v1 decision above |
| `ALLOW_CLIENT_ASSERTED_WALLET_FOR_GET_PEONES_CANARY` | `true` | Auth risk sign-off above |

**`CELO_RPC_URL`**: already present in Production (pre-existing, used
successfully by the legacy `/api/verify-payment` route). No action needed
there. (Preview needed it added during the rollback exercise because it never
existed outside Production — see Rollback exercise section.)

**Finding — client-side flag is not founder-gated.** The buy UI
(`components/payments/get-peones-sheet.tsx` → `usePaymentRail` →
`isGetPeonesCanaryClientRequested()`) reads
`NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED`, a build-time public var with
no wallet/allowlist check anywhere in that path. The internal dev smoke page
(`/dev/rail-smoke`) 404s in Production by design, so it **cannot** be used to
test the canary there — the only way to exercise the canary through the actual
UI in Production is flipping this public flag, which makes the buy flow
visible to **any** visitor, not just the founder. This does not create a fund-
drainage risk (crediting still requires a real on-chain payment bound to the
payer's own wallet), but it does mean "internal/founder canary only" is
currently a **traffic fact** (no other real users in Production today, per
[[production-as-personal-staging]]), not a technical control. Two paths:

1. **Leave `NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED` unset** and test
   the canary in Production the same way this review did in Preview: direct
   `POST` calls to `/api/payment-intents/get-peones` /
   `/api/verify-payment/get-peones-canary`, no UI exposure at all.
2. **Set it**, accepting that any visitor could technically see and use the
   $0.50 buy flow, relying on the current no-other-real-users state of
   Production as the only mitigation. Must be revisited (add real founder
   gating, e.g. wallet allowlist) before any public MiniPay listing traffic
   arrives.

No default is applied here — this is a decision for the operator, not
something inferable from existing docs.

**Decision (2026-07-01): option 1.** `NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED`
stays **unset** in Production. The canary, once enabled, will be exercised via
direct `POST` calls to `/api/payment-intents/get-peones` and
`/api/verify-payment/get-peones-canary` only — same method already proven live
in the rollback exercise above. The buy UI stays on the legacy path
(`no_treasury`, unavailable) for every visitor, founder included. Revisit if
the operator later wants a real in-app canary UX; requires adding actual
founder-wallet gating to `get-peones-sheet.tsx` first.

**Other checks, no action needed:**

- Rate limiting / origin enforcement: reuses existing shared infra
  (`enforceReadRateLimit`, `enforceOrigin`), not canary-specific, already
  proven in Production by other routes.
- RLS, grants, immutability trigger, replay-identity uniqueness: verified on
  the hosted migration (see Hosted Supabase migration section above).
- Intent TTL (`10 minutes`, `GET_PEONES_CANARY_INTENT_TTL_SECONDS`) and reward
  (`50 Peones`, `GET_PEONES_CANARY_REWARD`): hardcoded constants, not env
  vars, no config drift possible.
- Token/decimals cross-check: enforced live per-request (`token_decimals_mismatch`
  fails closed), already evidenced against real on-chain reads above.

## Remaining blockers before enablement

Closed:

- Control 2 on-chain reads (custody, source verification, bytecode match): evidenced.
- Token matrix v1: decided (USDT-only).
- Finality: decided (`CONFIRMATIONS=3`, decision record only).
- Auth risk: decided (constrained internal/founder acceptance, decision record only).
- Custodian/runbook sign-off: recorded (see Custodian sign-off above).
- Hosted Supabase migration: applied and verified on `brsbdzpuvotxsadmcxyj`
  (see Hosted Supabase migration — applied 2026-07-01 above).
- Rollback exercise: performed live against a real Preview deployment (see
  Rollback exercise — live evidence 2026-07-01 above). ON→OFF confirmed;
  verify/recovery confirmed independent of the flag.
- Final env/config review: recommended Production values recorded, including
  the `NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED` decision (kept unset;
  API-only testing) (see Final env/config review above).

Still open:

1. Nothing blocking. Enablement itself — setting the 7 recommended
   server-side vars in Production — is a separate, deliberate operator action,
   not authorized or performed by this PR.

## Non-authorization statement

The only hosted database change from this PR's code is the additive migration
`20260630120000` applied on 2026-06-30/07-01 (new tables, RLS, trigger, and
RPCs). The rollback exercise on 2026-07-01 additionally wrote 2 test intent
rows to hosted `treasury_payment_intents` via the real Preview deployment (see
Rollback exercise above); no existing object was altered or dropped, no
consumption/entitlement was created, and no real funds moved. Preview
environment variables were added and later corrected on Vercel (documented
above); Production environment variables were not changed net of this
exercise (a transient Production-scoped copy was added in error and removed
before any Production deployment used it). No production deploy occurred. No
destructive SQL. The canary is not enabled in Production; all canary env vars
remain unset there and default OFF.
