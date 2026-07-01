# Session Handoff — 2026-07-01

## MERGED — PR #159 → main (2026-07-01, ff2b81fb)
Get Peones Treasury canary foundation is now on `main`, still **disabled by
default** (all 7 server env vars unset in Production). Branch
`poc/minipay-treasury-contract` deleted (remote + confirmed no local copy).
CI: 7/7 green pre-merge. Local suite re-run before the final docs commit:
4587/4587 passing, tsc clean.

**Preview follow-up (operator-owned, not done by this session):** the 8
Preview env vars (7 canary + `CELO_RPC_URL`) were scoped to the now-deleted
branch `poc/minipay-treasury-contract`; they do NOT carry over to `main`
automatically. User is re-adding them scoped to branch `main` (plus
`NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED=true`, Preview-only, decided
2026-07-01 since `preview.chesscito.com` isn't player-facing) using the table
given in this session. Production remains untouched — no canary vars there.

## Completed
- [ PR #159 (Draft) ] Get Peones → ChesscitoTreasury canary foundation, disabled-by-default.
- Commits on `poc/minipay-treasury-contract`: `e5b4e616` (feat foundation+tests+migration), `5d931d55` (docs product), `583a5e2b` / `ddb21ea8` / `378493a9` (docs ops evidence).
- Local Supabase/Postgres validation PASS (schema, RPC atomicity, cross-product replay, concurrency, reset/reapply). 91/91 payment tests, tsc clean, privacy/secrets review PASS.
- On-chain read evidence PASS (Celo Mainnet): Treasury bytecode non-empty, owner/payout = Safe `0x917497b6…1923`, pendingOwner zero, USDT `acceptedToken=true` (decimals 6), USDC/cUSD `false`.
- Bytecode-vs-artifact match PASS (byte-for-byte, solc 0.8.28/cancun/200).
- Celoscan source verification: PASS (manual). Standard JSON Input at `/tmp/chesscito-treasury-standard-json-input.json`.
- Hosted Supabase migration `20260630120000` APPLIED + verified on prod project `brsbdzpuvotxsadmcxyj` (additive only, no data, canary envs OFF).
- Rollback exercise DONE live 2026-07-01 against real Vercel Preview deploys (shares hosted prod Supabase): ON→intent created (200 ok:true, 2 test intents), OFF→`canary_disabled` (404), verify/recovery route confirmed NOT gated by the flag (`400 receipt_not_found`). Full evidence in ops checklist below.
- Final env/config review DONE 2026-07-01: recommended real Production values for all 7 server-side vars (see ops checklist). Found `NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED` (client buy-UI flag) has NO founder/wallet gating — turning it on in Production would expose the $0.50 buy button to any visitor, not just the founder. Decision: keep it unset; canary will be exercised via direct API calls only (same method as the rollback exercise), never through the real UI, until real founder gating is added.

## Current State
- **Branch**: `main` (merged, `poc/minipay-treasury-contract` deleted).
- **Build**: passing (4587/4587 full suite, tsc clean, CI 7/7 green on PR #159 pre-merge).
- **Uncommitted work**: only untracked local Supabase tooling `apps/web/supabase/config.toml` + `apps/web/supabase/.gitignore` — MUST stay untracked, never commit.
- 2 permanent test intent rows in hosted `treasury_payment_intents` (immutability trigger blocks delete by design) — burn-address wallet `0x000...dEaD`, no consumption, no real funds moved.
- Production env: no canary vars set (unchanged, verified clean). Preview env: stale, scoped to the deleted branch — see "Preview follow-up" above for what's being re-added scoped to `main`.

## Next Tasks
1. Operator finishes re-adding the 8 Preview env vars scoped to `main` (in progress, see "Preview follow-up" above), then smoke-tests the real buy UI on `preview.chesscito.com`.
2. On Production enablement (separate deliberate operator action, API-only per the decision above, whenever ready — no deadline): set `GET_PEONES_TREASURY_CANARY_ENABLED=true`, `CHESSCITO_TREASURY_CANARY_ADDRESS=0xcD3837DD017dFA5E31A2e3Cf390721E16Ac8Fbf0`, `_CONFIG_VERSION=canary-v1`, `_PRICE_VERSION=canary-v1`, `_CONFIRMATIONS=3`, `_TOKEN_ADDRESSES=0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e`, `ALLOW_CLIENT_ASSERTED_WALLET_FOR_GET_PEONES_CANARY=true`. Do NOT set `NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED` in Production (API-only, no UI exposure there).

## Blockers
- None. Both prior blockers (rollback exercise, final env/config review) closed 2026-07-01. Enablement itself was never authorized by this PR and remains a separate explicit operator action.

## Notes
- Canary v1 is USDT-only ($0.50 `peones_pack_50` → 50 Peones), founder/internal only, client-asserted wallet risk accepted under constraints (credit bound to canonical tx sender + `Transfer.from`).
- Ops checklist: `docs/ops/get-peones-treasury-canary-operational-checklist-2026-06-30.md` (canonical evidence trail, now includes live rollback exercise section).
- Command hygiene: use `git -C`/`pnpm -C`/`supabase --workdir`, never `cd`; one cmd per call; Write tool for files; run supabase from `apps/web`.
- Local Supabase uses alternate ports 55321–55329 (default ports held by another local project `qxwztvfazronkshgkckk` — do not delete).
- Vercel gotcha learned today: `vercel env rm NAME <environment>` deletes the whole variable record if it was added spanning multiple environments in one shot — it does not surgically remove just that environment's value. Always add canary/sensitive vars with an explicit single-environment (and branch, for Preview) target from the start.
- Vercel project's linked root directory is `apps/web`; run `vercel` commands from the repo root, not from inside `apps/web` (doubles the path and fails).
