# P0 — `/api/peones/spend` unauthorized debit

**Status:** route-layer fix shipped **behind a flag (default OFF)**; durable grantor-side
migration drafted below, **NOT applied** (needs founder sign-off + a staged rollout).
**Date:** 2026-08-10. **Branch:** `security/peones-spend-authz` (kept separate from the
retention experiment on purpose — see the phase-2 brief).

## Finding (re-verified against current code, commit `b3d07c90`)

`POST /api/peones/spend` took the debited `wallet` from the **request body**
(`route.ts` `parseAndValidate`, `body.wallet`) and gated the handler with only
`enforceOrigin` + an IP rate-limit. `enforceOrigin` **returns without throwing when both
`Origin` and `Referer` are absent** (`lib/server/demo-signing.ts:118-146`, its own comment:
"any curl … also passes"). The handler holds the Supabase **`service_role`** key, which
**bypasses the `peones_ledger` RLS** (`peones_ledger_no_client_writes … WITH CHECK false`)
that stops a direct anon write. `peones_spend` (SQL) checks idempotency, a `FOR UPDATE`
lock, and balance — but **never checks who is calling**; the debited wallet is `lower(p_wallet)`,
whatever the route passed.

### Trust boundary / exploitability
- **Not reachable anonymously via PostgREST** — RLS blocks the client-role INSERT (Agent C
  confirmed `peones_ledger` policies are `WITH CHECK false` for `anon`/`authenticated`).
- **Reachable via the HTTP route** — anyone who can POST to the route (origin check
  bypassable by omitting both headers) can name any public wallet address and debit its
  Peones. Wallet addresses are public on-chain.
- **Impact: grief, not theft.** The debit removes the victim's Peones; the attacker gains
  nothing. Balances are tiny today (most wallets sit at 1; total historical spend ≈230).
  Severity is P0 as an *unauthorized debit primitive* and because the retention roadmap may
  make Peones more valuable — not because of current dollar loss.

## The fix (shipped, flag-gated)

Mirror the score path: the wallet cannot come from the body — it must be **proven** by a
score **write-session** (the capability the wallet buys with one EIP-191 signature and that
`save_score_attempt` resolves via `p_token_hash`). A valid, unexpired, unrevoked, *authorized*
session token proves the caller controls the wallet.

- `lib/scores/spend-session-guard.ts` — resolves a `Authorization: Bearer <token>` to a
  wallet by reading `score_write_sessions` (the same table the score path signs into),
  fail-closed on missing/unknown/unsigned/revoked/expired/unreachable. **Unit-tested** (15
  cases): the wallet is resolved *from the row*, looked up by the token **hash**, never
  trusted from the caller.
- `app/api/peones/spend/route.ts` — new block **9b**: when enforcement is on, require a
  token that resolves to **exactly the wallet being debited** (`resolved.wallet === wallet`,
  else `401`); store unreachable → `503` fail-closed. Route tests cover both arms; the
  legacy flag-off tests are the regression guard that the default path is byte-for-byte
  unchanged.
- **Gate:** `PEONES_SPEND_REQUIRE_SESSION` (default OFF). Read at request time so it flips
  by config, no redeploy.

### Mandatory rollout order (why the flag exists)
Unlike the score path, spend has **no absent-id grace** — the moment enforcement is on, an
older cached client bundle that doesn't send a token loses the ability to spend until it
reloads. So:

1. **Ship the client** that attaches the token to every spend (see below), flag still OFF.
2. **Verify token propagation** in prod telemetry (spends carrying an `Authorization` header /
   401 rate stays ~0 while OFF).
3. **Flip `PEONES_SPEND_REQUIRE_SESSION=true`** to enforce. Watch the spend 401 rate; roll
   back by flipping it off (no deploy).

### Client wiring (rollout step 1 — TODO, spec'd here)
`submitPeonesSpend` must attach `Authorization: Bearer <token>` where the token is the active
score session (`peekScoreSession()?.token`, no prompt). Spends already occur inside a play
session that has usually authorized one (you must complete+save to earn Peones, which mints a
session). For the cold case (Peones from a prior day, spend before any save today), the spend
gesture should call `ensureScoreSession(...)` — a signature prompt **in direct response to the
user's spend tap is legitimate** and does not reintroduce the mount-time phishing class the
2026-08-09 fix closed. Call sites: `peones-hint-button.tsx`, `use-fail-rescue.ts`,
`use-coach-analysis.ts` (via the coach/shield fallbacks).

## Durable follow-up — guard the grantor (migration, NOT applied)

The route-layer fix guards a *caller*. The standing rule
([[feedback_guard_the_grantor_not_the_callers]]) is to guard the **grantor**: resolve the
wallet inside `peones_spend` itself, as `save_score_attempt` does. This closes the hole even
if a second `service_role` caller is ever added. It requires a **prod migration** (changes the
RPC signature: drop `p_wallet`, add `p_token_hash`) and a matching route change, deployed
**after** the token-carrying client — so it is left for founder sign-off, not applied here.

Sketch (faithful to the current body in `20260608000000_peones_spend_rpc.sql`):

```sql
-- BEFORE APPLYING: (1) founder sign-off on a prod migration; (2) the token-carrying
-- client must already be live; (3) the route must switch from p_wallet to p_token_hash
-- in the same deploy. Reversible: keep the old function under a versioned name.
create or replace function public.peones_spend(
  p_token_hash        text,          -- NEW: replaces p_wallet as the identity source
  p_amount            integer,
  p_target            text,
  p_target_id         text,
  p_idempotency_key   text,
  p_attestation_hash  text,
  p_metadata          jsonb,
  p_apply_pro_bypass  boolean default false
) returns table (...) language plpgsql volatile as $$
declare
  v_normalized_wallet text;
begin
  -- Resolve the wallet FROM THE SESSION, never from the caller. Mirrors
  -- save_score_attempt: an authorized, unrevoked, unexpired write-session.
  select lower(wallet) into v_normalized_wallet
    from public.score_write_sessions
   where token_hash = p_token_hash
     and authorized_at is not null
     and revoked_at is null
     and expires_at > now();
  if v_normalized_wallet is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  -- … remainder identical to the current body (idempotency → pro-bypass →
  --    FOR UPDATE balance check → append-only insert), using v_normalized_wallet.
end; $$;
```

## Non-critical integrity note (separate, not this P0)
`MAX_SUBMITTABLE_SCORE = 30000` is ~10× the real per-piece ceiling and `score` is
client-supplied; no inflated row exists in prod today (Agent C: 0 rows > 3000), but a single
forged 30000 would be permanent under the leaderboard's MAX aggregate. Cheap to prevent by
tightening the validator to the per-level ceiling. Tracked in the deep audit, not here.
