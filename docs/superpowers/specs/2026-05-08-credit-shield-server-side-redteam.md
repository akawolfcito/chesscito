# Red Team Review — credit-shield-server-side (v2)

**Date**: 2026-05-08
**Reviewer mindset**: hostile QA + senior engineer
**Spec under review**: `2026-05-08-credit-shield-server-side-design.md` (v2)

---

## v1 → v2 status (closed findings)

The original v1 review surfaced 4 P0s and 7 P1s. v2 spec addresses
each:

| # | v1 finding | v2 resolution |
|---|---|---|
| P0-1 | Single-endpoint dual-mode read/write | Q5 — split into `POST /api/credit-shield` + `GET /api/shields/me`. |
| P0-2 | Read inherits write rate-limit | Q5 split + separate buckets (10/min write, 60/min read). |
| P0-3 | Read endpoint unauthenticated wallet leak | Q7 — explicit "public-readable" stance, documented; chain already exposes the data. |
| P0-4 | Cap-vs-spend race | Q6 — server holds monotonic `credited`, no cap; client tracks `consumed` separately; display is derived. Race eliminated by construction. |
| P1-1 | Sync direction (overwrite spends) | New counter model — sync only updates `credited`, never `consumed`. Direction problem dissolves. |
| P1-2 | `tx_not_found` leaks tx-existence | Errors collapsed: pre-validation specific, post-validation unified to `unprocessable`. |
| P1-3 | Hardcoded mainnet | Q8 — `getConfiguredChainId()` selects mainnet/sepolia. |
| P1-4 | 30s poll vs. Vercel timeout | Reduced to 20s. |
| P1-5 | Concurrent same-tx race | Q9 — SETNX inside Lua. |
| P1-6 | Telemetry no `wallet_hash` | Added; `hashWallet()` non-throwing. |
| P1-7 | "Best-effort fetch, no retry" gap | Q10 — `pending-shield-tx` localStorage queue; boot-sync drains before reading. |

All v1 P0+P1 findings resolved. Now a **fresh adversarial pass on v2**.

---

## Findings (v2 pass)

### P0 — Must address before implementation

- **[queue/dequeue-on-unprocessable]** Spec §"useShieldSync sequence"
  step 1 says "On `unprocessable`, dequeue (terminal)". But the v2
  error contract collapses *all* post-validation failures into
  `unprocessable` — including "tx not mined within the 20s poll",
  which is a **transient** state, not terminal. So:
  - User submits tx with low gas; client fetch fails (server polled
    but tx wasn't mined in 20s); server returns `unprocessable`.
  - Client dequeues. Tx mines 30 seconds later. Credit lost.
  This is exactly the bug class we're trying to fix, smuggled back in
  via the queue's dequeue logic.
  **Why blocking:** identical user-visible failure mode as the v1 bug,
  just routed through a new code path.
  **Fix:** dequeue **only on 2xx with non-zero delta OR 2xx with
  delta=0 (already processed)**. On *any* error response (4xx/5xx),
  leave the entry queued. Add a per-entry timestamp + 30-day TTL to
  prevent unbounded retry of permanently-bad txs (failed, dropped,
  fee-too-low). Ring-buffer trim at 32 still applies.

### P1 — Should address

- **[migration §9 dead branch]** Spec §"Behavior 9" includes a "if
  `credited > 0`, set `consumed = max(0, credited − legacy)`" branch.
  In practice this branch is **dead code**: pre-deploy nobody has a
  server-side `credited`, so on first sync after deploy `credited`
  is always 0 for everyone. The branch only matters if we ever
  rollback-then-redeploy, which is a 1-in-1000 ops scenario for
  pre-prod.
  **Risk if ignored:** untested code path lives in the codebase
  forever, future readers wonder when it fires.
  **Fix:** simplify §9 to a single rule — "on first sync, if legacy
  number exists, **forfeit** it; clear the key; emit telemetry
  `migration` with the forfeited count for ops visibility". Document
  the rollback edge case as out-of-scope.

- **[footer chip migration scope]** AC15 covers the receipt-watcher
  removal but not the *display* migration. Today the
  `chesscito-footer` chip and the retry button both read
  `localStorage["chesscito:shields"]` directly. v2 introduces
  `readDisplayedShields()` (derived from `credited - consumed`). If
  the chip's read site isn't migrated *in the same PR*, the legacy
  key gets deleted by §9 and the chip displays 0 even though
  credit/consumed are correct.
  **Risk if ignored:** UI regression on first deploy — chip stuck at 0.
  **Fix:** add an explicit AC: "the `chesscito-footer` chip and any
  shield-read site (grep `chesscito:shields` minus storage helpers)
  read via `readDisplayedShields()`. Spec lands as a single PR; no
  shipping a half-migrated state."

- **[Lua failure path]** Spec §"Behavior 5" and §6 don't say what
  happens if `redis.eval` itself fails (network blip, Redis down).
  Current `verify-pro` lets the exception bubble to the route's
  outer `try/catch` and returns `internal` 500. Same here, but
  spec should call it out so client retry semantics are clear: 500
  responses keep the txHash in the queue (matches §"§"Behavior 1"
  P0 fix above).
  **Risk if ignored:** ambiguity at TDD time about whether 500 means
  "retry" or "give up".
  **Fix:** explicit error mapping in spec — `500 internal` →
  client keeps queued; `4xx unprocessable` → client keeps queued
  (per P0 fix); only `2xx` dequeues.

- **[banner-vs-credit timing]** §1 says "before the success-banner
  timeout fires" but the banner auto-dismisses at 6s and the server
  polls up to 20s. The fetch may not have *responded* by the time the
  banner is gone. That's actually fine — banner truthfulness is "tx
  submitted", not "credit written" — but the spec should say so
  explicitly. Otherwise reviewers will ask "why does the banner
  disappear before we know the credit landed?"
  **Risk if ignored:** confusing review thread + a future PR that
  "fixes" the banner to wait for credit, breaking UX.
  **Fix:** one-paragraph note in §1: "The success banner reflects
  *tx submission*, not *server-side credit success*. The credit
  resolves async; the chip will reflect the new total when boot-sync
  next runs (or, if the post-submit fetch resolves before unmount,
  immediately via `writeCreditedCache`)."

- **[useShieldSync re-entry]** The hook fires on `useAccount` connect.
  Wagmi can fire connect twice during a session (account switch,
  reconnect after sleep). Without a guard, two boot-syncs run
  concurrently — both try to drain the same queue, both call the
  read endpoint, both write `credited-cache`. Idempotent at the
  storage level, but it doubles the API calls and races on
  `dequeuePendingTx`.
  **Risk if ignored:** redundant API load, tiny race on dequeue
  (one drain succeeds, the other sees a stale queue and re-tries
  already-processed entries — produces a 2xx with delta=0, harmless
  but noisy).
  **Fix:** `useRef<boolean>` guard inside `useShieldSync` —
  `if (syncingRef.current) return;` before kicking off; reset in
  `finally`.

### P2 — Nice to clarify

- **[wallet enumeration]** Read endpoint is per-IP rate-limited.
  An attacker rotating IPs (cheap with residential proxies) can
  enumerate wallets at scale. We documented "public-readable" but
  the *fingerprinting* (which wallets have shield purchases) is
  more useful than the count alone for some adversaries. Mitigation
  is cheap: also rate-limit by `wallet` (e.g.,
  `shields:read:wallet:${wallet}` 30/min). Doesn't close it but
  raises cost.
- **[migration release note]** §9 forfeits legacy shields. Pre-prod
  testers should be told. One-line release note + a soft toast on
  first sync if `legacy > 0` ("your local shield count was migrated
  — see release notes").
- **[Lua redundancy]** `tonumber(ARGV[1])` cast inside the EVAL is
  redundant (Lua's INCRBY argument coerces). Cosmetic.
- **[ABI freshness]** §"Operational readiness" mentions re-running
  the ABI generator. Add to the **PR checklist** explicitly so it
  doesn't get missed. 2026-05-02 incident memory.
- **[storage key naming]** New keys use both `chesscito:shields`
  (legacy, deleted in migration) and `chesscito:shields:consumed`
  / `chesscito:shields:credited-cache` / `chesscito:shields:pending-tx`.
  Consistent prefix. If the legacy key migration runs partial
  (deleted but consumed-cache write fails), we're stuck. Wrap §9
  in a transaction-shaped helper that only deletes legacy *after*
  consumed + credited-cache + pending-tx-clear all succeed.

## Categories audited

### Contract gaps
- Read response is `{ ok: true, credited: number }` — clean union.
  No issues.
- Write response is `{ ok: true, credited, delta, txHash }` — clean.
- Error union: `unprocessable` collapses 5+ post-validation cases.
  P0 above — combined with the queue's dequeue logic this is the
  load-bearing risk.

### Behavioral ambiguity
- §1 banner timing (P1 above).
- §7 boot-sync re-entry (P1 above).
- §9 migration dead branch (P1 above).

### Hidden assumptions
- Upstash Redis is single-shard so EVAL serialization is total order.
  Documented in the PR notes as a single-line assumption.
- `getConfiguredChainId()` returns the chain that the user actually
  signed against. If a user signs against mainnet but the env says
  sepolia (or vice versa), the receipt fetch will fail with "tx not
  found" → `unprocessable`. With the v2 P0 fix, it stays in the
  queue forever (until ring-buffer trim). Acceptable but document.

### Backward compatibility
- §9 migration forfeits legacy shields — release note required.
- Removing `pendingShieldCredit` flag and the `useEffect` is a hard
  cut in the same PR as the new path. Explicitly single-PR per
  AC15.

### Security & data
- Read endpoint enumeration (P2 above).
- Stablecoin whitelist + chain selection: covered.
- Rate-limit + origin: covered.
- `LOG_SALT` reused for `wallet_hash`: covered.

### Test coverage gaps
- AC13 (Lua atomicity) needs an explicit "concurrent Promise.all on
  same txHash" assertion shape in the test plan, not just the AC.
- New test needed: post-submit fetch fails → entry stays queued
  (covers P0).
- New test needed: 500 from server → entry stays queued.
- New test needed: 2xx with delta=0 → entry dequeues (covers
  idempotent retry path).
- New test needed: ring-buffer trim at 32 + per-entry TTL.
- Footer chip read site test (covers P1 footer-chip-migration).

### Operational readiness
- Logging covered.
- Monitoring covered.
- Rollback flag is documented as kill-switch only — explicit, OK.
- ABI freshness — promote to PR checklist (P2).

## Verdict

**READY for /tdd, with one P0 fix.**

The single P0 (queue dequeue logic) is a one-line revision in §1 and
§7 — change "dequeue on `unprocessable`" to "dequeue only on 2xx; add
30-day TTL + ring-buffer for organic eviction". Spec author can
fold this into the existing draft as a v2.1 patch without a full
re-review.

P1s are all in-spec clarifications (banner timing, dead branch,
footer chip scope, Lua failure mapping, hook re-entry guard) — TDD
will surface them naturally if missed.

P2s are nice-to-haves; track in §"Open questions".

**Recommended:** patch §1 + §7 + AC list with the queue-dequeue fix
(single edit pass), then proceed to TDD. The remaining P1s can be
folded into the same patch or addressed as TDD discovers them.

**Next:**
1. Apply the v2.1 P0 patch (queue dequeue only on 2xx + TTL).
2. Optionally fold the P1s into the same patch.
3. Run `/tdd credit-shield-server-side` to start implementation.
