# Chesscito MiniPay Treasury Rail — Wave 0 Control Register

- **Register date:** 2026-06-30
- **Scope:** Documentation and evidence planning only
- **Environment/chain:** Celo Mainnet (`42220`) unless a row states otherwise
- **Canary:** Get Peones `peones_pack_50`
- **Gate state:** Blocked

## Status rules

- `PASS`: every approved acceptance condition has an owner, dated evidence, environment/chain, and no unresolved fail condition.
- `FAIL`: current source or behavior contradicts an acceptance condition.
- `BLOCKED`: required evidence or an approved decision is unavailable; `BLOCKED` is never equivalent to `PASS`.

No control is marked `PASS` from source inspection or POC evidence alone. Runtime secrets were not read, no on-chain operational action was executed, and no implementation was performed for this register.

## Approved sources

- [`chesscito-minipay-treasury-rail-finding-2026-06-29.md`](./chesscito-minipay-treasury-rail-finding-2026-06-29.md)
- [`chesscito-one-transaction-onchain-architecture-audit-2026-06-29.md`](./chesscito-one-transaction-onchain-architecture-audit-2026-06-29.md)
- [`spec-minipay-treasury-rail-wave-0-controls.md`](../../_bmad-output/implementation-artifacts/spec-minipay-treasury-rail-wave-0-controls.md)
- [`spec-get-peones-treasury-canary.md`](../../_bmad-output/implementation-artifacts/spec-get-peones-treasury-canary.md)

## Classification summary

The primary workstream identifies the next dominant activity. `Requires implementation` remains independent because most design controls also need enforcement code before `PASS`.

| # | Control | Current status | Primary workstream | Can reach PASS without code? | Requires implementation? | Canary impact |
|---:|---|---|---|---|---|---|
| 1 | Canonical Treasury address source | `FAIL` | Product/backend design | No | Yes | Blocking |
| 2 | Treasury deployment verification | `BLOCKED` | Evidence-only / operational verification | Yes | No product code | Blocking |
| 3 | Token allowlist reconciliation | `BLOCKED` | Product/backend design | No | Yes | Blocking |
| 4 | Payment intent before broadcast | `FAIL` | Product/backend design | No | Yes | Blocking |
| 5 | Transaction target and calldata verification | `FAIL` | Implementation-required | No | Yes | Blocking |
| 6 | Receipt and event verification | `FAIL` | Implementation-required | No | Yes | Blocking |
| 7 | Global idempotency and replay prevention | `FAIL` | Implementation-required | No | Yes, including persistence | Blocking |
| 8 | Entitlement separation | `FAIL` | Product/backend design | No | Yes | Blocking |
| 9 | Recovery and reconciliation | `FAIL` | Product/backend design | No | Yes | Blocking |
| 10 | Fallback and duplicate-payment risk | `FAIL` | Implementation-required | No | Yes | Blocking |
| 11 | Finality and reorg policy | `FAIL` | Product/backend design | No | Yes after policy approval | Blocking |
| 12 | Rollback | `FAIL` | Product/backend design | No | Yes | Blocking |
| 13 | Observability | `FAIL` | Implementation-required | No | Yes | Blocking |

## Control records

### 1. Canonical Treasury address source

| Field | Record |
|---|---|
| Current status | `FAIL` |
| Owner | `TBD — Payments/Platform owner` |
| Verification date | Not verified; source review dated 2026-06-30 |
| Environment/chain | Celo Mainnet (`42220`) |
| Required evidence | Approved canonical chain/address record; client/server resolution contract; config version; comparison evidence; missing/mismatch tests; runtime diagnostics; proof Treasury mode cannot fall back to an EOA. |
| Current evidence | `rail-config.ts` reads `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS` client-side and `CHESSCITO_TREASURY_ADDRESS ?? TREASURY_ADDRESS` server-side. `chains.ts` separately reads `NEXT_PUBLIC_CHESSCITO_TREASURY_CONTRACT_ADDRESS`. POC evidence names a Treasury recipient but is not canonical runtime configuration. |
| Evidence gaps | No approved source of truth, versioning, client/server equality evidence, contract-code check in the resolver, or observable mismatch state. The server fallback explicitly permits different recipient semantics. |
| Documentation/ops only? | Partially: ownership and canonical-source decisions can be documented, but current fallback/enforcement behavior prevents `PASS`. |
| Requires implementation? | Yes: canonical resolver/enforcement, no-EOA fallback in Treasury mode, config version binding, and fail-closed diagnostics. |
| Proposed next action | Approve the canonical source and version schema, then specify a chain-scoped client/server resolver and mismatch test matrix. Do not change runtime values in this step. |
| Get Peones impact | Blocking: an incorrect or drifting recipient can irreversibly route user funds elsewhere. |

### 2. Treasury deployment verification

| Field | Record |
|---|---|
| Current status | `BLOCKED` |
| Owner | `TBD — Treasury custodian / contract operations owner` |
| Verification date | Not verified; POC session evidence predates this register |
| Environment/chain | Celo Mainnet (`42220`) |
| Required evidence | Runtime bytecode/build match; contract address and chain; `owner`, `pendingOwner`, `payoutAddress`, `acceptedToken` reads; explorer verification status; accepted and accidental-token withdrawal evidence; approved custody/withdrawal runbook. |
| Current evidence | Repository contains `ChesscitoTreasury.sol`, deployment/config scripts, and a mainnet POC transfer to the documented recipient. Contract source exposes ownership, payout, accepted-token metadata, and unrestricted owner token recovery. |
| Evidence gaps | No dated independent bytecode match, on-chain state capture, explorer-status record, custody approval, withdrawal exercise/evidence, or runbook owner. POC receipt proves token receipt only. |
| Documentation/ops only? | Yes, provided the existing deployment matches source and operational evidence can be collected without modifying application or contract code. An authorized operational withdrawal exercise may still be required. |
| Requires implementation? | No product code. No contract change is expected. |
| Proposed next action | Create a signed/datestamped deployment evidence pack and custody runbook using read-only on-chain checks first; schedule any required withdrawal exercise under separate operational approval. |
| Get Peones impact | Blocking: custody identity and recoverability are unverified. |

### 3. Token allowlist reconciliation

| Field | Record |
|---|---|
| Current status | `BLOCKED` |
| Owner | `TBD — Payments product + backend security owner` |
| Verification date | Not verified; source review dated 2026-06-30 |
| Environment/chain | Celo Mainnet (`42220`) |
| Required evidence | Per-token matrix reconciling frontend, backend, MiniPay policy, Treasury `acceptedToken`, address, symbol, trusted decimals, behavior/upgrade risk, and enablement decision; fail-closed UI/backend tests. |
| Current evidence | `tokens.ts` and `rail-config.ts` currently expose USDC, USDT, and cUSD with configured decimals; client balance selection and backend allowlist reuse that source. Treasury ABI exposes `acceptedToken`. The USDT POC succeeded. |
| Evidence gaps | No approved Wave 0 matrix, live `acceptedToken` reads, exact MiniPay policy record, token behavior assessment, or runtime enforcement that intersects the source allowlist with Treasury metadata. |
| Documentation/ops only? | Partially: policy and evidence matrix are documentation/ops. `PASS` additionally requires enforcement evidence. |
| Requires implementation? | Yes: canary token gating must use only matrix-approved exact addresses and fail closed on metadata mismatch. |
| Proposed next action | Produce the token evidence matrix, choose the smallest canary token set, then specify client/server enforcement and regression tests. |
| Get Peones impact | Blocking: current source configuration alone can enable tokens that Wave 0 has not approved. |

### 4. Payment intent before broadcast

| Field | Record |
|---|---|
| Current status | `FAIL` |
| Owner | `TBD — Payments backend owner` |
| Verification date | Source review dated 2026-06-30 |
| Environment/chain | Celo Mainnet (`42220`) |
| Required evidence | Immutable pre-broadcast intent schema and persistence binding authenticated wallet, SKU, token, raw amount, recipient, chain, recipient/config version, price version, expiry, and unique intent ID; expiry/mutation/replay tests. |
| Current evidence | Get Peones fixes SKU `peones_pack_50`; server independently knows price/reward. Current client sends `chainId`, `txHash`, wallet, token, and SKU only after broadcast. |
| Evidence gaps | No server-created intent, authenticated wallet binding, frozen terms, expiry, intent ID, or cross-SKU intent protection. Plain transfer contains no SKU. |
| Documentation/ops only? | No. A schema decision is necessary but cannot satisfy runtime acceptance. |
| Requires implementation? | Yes: authenticated intent creation, persistence/state, client binding, verification, expiry, and kill-switch integration. |
| Proposed next action | Approve a narrowly scoped Get Peones intent/identity data design before API implementation. |
| Get Peones impact | Blocking: raw transaction hashes cannot safely identify product intent. |

### 5. Transaction target and calldata verification

| Field | Record |
|---|---|
| Current status | `FAIL` |
| Owner | `TBD — Payments backend/security owner` |
| Verification date | Source review dated 2026-06-30 |
| Environment/chain | Celo Mainnet (`42220`) |
| Required evidence | Canonical transaction fetch; chain, sender, token target, exact `transfer(address,uint256)` selector, strict calldata decode, recipient, and amount checks; deterministic rejection matrix. |
| Current evidence | `/api/verify-payment` checks requested chain and receipt `to == declared token`, excluding Shop-style receipt targets. Client builder encodes ERC-20 `transfer`. |
| Evidence gaps | Backend does not fetch/decode canonical transaction input, verify selector/trailing calldata, or bind canonical transaction sender to an authenticated intent wallet. Client construction is not authoritative proof. |
| Documentation/ops only? | No. |
| Requires implementation? | Yes: verifier hardening and tests. |
| Proposed next action | Specify one reusable canonical transaction verifier with stable reason codes, scoped initially to Get Peones intents. |
| Get Peones impact | Blocking: current event-plus-receipt check does not prove the required user call shape. |

### 6. Receipt and event verification

| Field | Record |
|---|---|
| Current status | `FAIL` |
| Owner | `TBD — Payments backend/security owner` |
| Verification date | Source review dated 2026-06-30 |
| Environment/chain | Celo Mainnet (`42220`) |
| Required evidence | Successful canonical receipt at approved finality; accepted-token emitter; exact sender/recipient/minimum value; explicit canonical chain-level `logIndex`; ambiguity rejection; unsupported/reverted/orphaned tests. |
| Current evidence | Route fetches receipt, requires success, validates receipt target, and decodes accepted-token `Transfer` logs matching wallet, configured recipient, and minimum value. Existing tests cover common mismatches and under/overpayment. |
| Evidence gaps | No finality threshold; helper returns the first matching event instead of rejecting multiple matches; route substitutes `0` when `logIndex` is missing; client does not identify a canonical event. |
| Documentation/ops only? | No. Finality policy is documented separately, but enforcement requires code. |
| Requires implementation? | Yes: canonical log selection, ambiguity handling, finality integration, reason codes, and tests. |
| Proposed next action | Include receipt/event hardening with the transaction verifier implementation spec. |
| Get Peones impact | Blocking: a receipt is not yet an unambiguous finalized payment proof. |

### 7. Global idempotency and replay prevention

| Field | Record |
|---|---|
| Current status | `FAIL` |
| Owner | `TBD — Payments backend + data owner` |
| Verification date | Source review dated 2026-06-30 |
| Environment/chain | All Treasury-backed endpoints; canary on Celo Mainnet |
| Required evidence | Source-independent global unique identity `chainId + txHash + chain-level logIndex`; atomic consumption with entitlement; concurrency, cross-SKU, cross-endpoint, and recovery replay tests; Shop coexistence policy. |
| Current evidence | Peones derives `pack_purchase:chainId:txHash:logIndex` and inserts into a ledger with globally unique `idempotency_key`. Route pre-check, insert, and race re-check prevent normal same-key duplicate credit. Season Pass stores a separate identity in a separate table. |
| Evidence gaps | Identity is source-prefixed and storage is endpoint/product-specific; no single global consumption record spans Peones, Season Pass, future endpoints, and recovery; no explicit atomic protocol couples global consumption to entitlement. |
| Documentation/ops only? | No. |
| Requires implementation? | Yes: data model/transaction boundary plus concurrency tests. |
| Proposed next action | Approve a global payment-consumption schema and an atomic settlement operation for the Peones ledger. |
| Get Peones impact | Blocking: the same event could be presented across isolated product stores/endpoints. |

### 8. Entitlement separation

| Field | Record |
|---|---|
| Current status | `FAIL` |
| Owner | `TBD — Payments product + backend owner` |
| Verification date | Source review dated 2026-06-30 |
| Environment/chain | Celo Mainnet and backend entitlement store |
| Required evidence | Durable state model for intent created, wallet requested, hash captured, receipt observed, payment verified, payment consumed, Peones granted, and grant failed/recoverable; transition and compensation tests. |
| Current evidence | Client has transient phases and shows success after the verifier reports ledger credit. Ledger row records successful Peones entitlement. |
| Evidence gaps | No durable payment lifecycle or recoverable failure record; receipt, consumption, and entitlement transitions are not independently queryable; support cannot reliably resume after session loss. |
| Documentation/ops only? | No. State semantics need approval, then enforcement/persistence. |
| Requires implementation? | Yes. |
| Proposed next action | Define the minimal Get Peones payment/settlement state machine together with the intent and global consumption design. |
| Get Peones impact | Blocking: paid-but-uncredited states cannot be managed reliably. |

### 9. Recovery and reconciliation

| Field | Record |
|---|---|
| Current status | `FAIL` |
| Owner | `TBD — Payments operations + support owner` |
| Verification date | Source review dated 2026-06-30 |
| Environment/chain | Celo Mainnet and entitlement backend |
| Required evidence | User resubmission, mined-but-uncredited recovery, authenticated operator path, duplicate/overpayment/underpayment/expired-intent policies, entitlement retry, rollback cutoff, common verifier, runbook, and deterministic scenarios. |
| Current evidence | Client retries transient verification after settlement and retains a hash for same-session “Verify again.” Route rechecks ledger after insert errors. |
| Evidence gaps | No durable post-session recovery, authenticated operator workflow, recovery intent, finality-aware reconciliation, cutoff/version handling, compensation policy, or complete overpayment/duplicate-payment runbook. |
| Documentation/ops only? | No. Policies/runbook are documentation, but recovery must be executable through the same verifier/idempotency boundary. |
| Requires implementation? | Yes. |
| Proposed next action | Design one recovery path as part of settlement core; avoid a separate bypass endpoint. |
| Get Peones impact | Blocking: a mined transfer can still be stranded after UI/backend failure. |

### 10. Fallback and duplicate-payment risk

| Field | Record |
|---|---|
| Current status | `FAIL` |
| Owner | `TBD — MiniPay client/payments owner` |
| Verification date | Source review dated 2026-06-30 |
| Environment/chain | MiniPay/Celo Mainnet client flow |
| Required evidence | Provider error taxonomy proving pre-broadcast cases; no-resend behavior for unknown/post-submission state; hash-captured recovery; timeout/lost-response tests. |
| Current evidence | User cancellation does not retry. After a non-cancellation error on a `feeCurrency` write, `use-payment-rail.ts` submits a second write without `feeCurrency`. Verification POST retries occur only after a captured hash and do not themselves transfer funds. |
| Evidence gaps | First write failure is not proven pre-broadcast; unknown submission state is not represented; no recovery-first behavior or duplicate-payment tests for provider timeout/lost response. |
| Documentation/ops only? | No. |
| Requires implementation? | Yes: client orchestration/state and tests. |
| Proposed next action | Specify a narrow safe-submit adapter: auto-fallback only for allowlisted pre-broadcast errors; all unknown states enter observation/recovery. |
| Get Peones impact | Blocking: current fallback can potentially request a second real payment. |

### 11. Finality and reorg policy

| Field | Record |
|---|---|
| Current status | `FAIL` |
| Owner | `TBD — Protocol/security + product risk owner` |
| Verification date | No approved policy as of 2026-06-30 |
| Environment/chain | Celo Mainnet (`42220`) |
| Required evidence | Measurable finality threshold, grant timing, reversible/irreversible entitlement rule, orphan response, compensation owner, monitoring/reconciliation window, and enforcement tests. |
| Current evidence | Client waits for a receipt; backend requires receipt status success. POC evidence does not record confirmation depth. |
| Evidence gaps | No confirmation/finality threshold, orphan handling, compensation policy, or verifier enforcement. |
| Documentation/ops only? | Partially: protocol/product policy can be approved without code, but `PASS` requires runtime enforcement and tests. |
| Requires implementation? | Yes after policy approval. |
| Proposed next action | Approve the Celo Mainnet finality/reorg decision before finalizing verifier and entitlement transitions. |
| Get Peones impact | Blocking: receipt success alone cannot authorize an irreversible credit under Wave 0. |

### 12. Rollback

| Field | Record |
|---|---|
| Current status | `FAIL` |
| Owner | `TBD — Release/operations owner` |
| Verification date | Source review dated 2026-06-30 |
| Environment/chain | Get Peones canary on Celo Mainnet |
| Required evidence | Server-authoritative kill switch for new intents, client visibility, unchanged legacy path, versioned cutoff for existing intents/mined payments, ongoing recovery, re-enable approval, and rollback exercise. |
| Current evidence | Missing treasury disables the current rail fail-closed. Existing legacy direct flow can remain unchanged conceptually. Current `feature-flags.ts` exposes Lite mode only. |
| Evidence gaps | No Get Peones Treasury canary gate, intent kill switch, cutoff/version behavior, rollback state, exercise, or re-enable authority. Removing an address would strand flows and is not an acceptable rollback design. |
| Documentation/ops only? | No. Runbook and ownership are ops; enforceable kill switch/cutoff require implementation. |
| Requires implementation? | Yes. |
| Proposed next action | Include a Get Peones-only server/client gate and cutoff semantics in the foundation implementation spec. |
| Get Peones impact | Blocking: there is no safe way to stop new canary payments while preserving recovery. |

### 13. Observability

| Field | Record |
|---|---|
| Current status | `FAIL` |
| Owner | `TBD — Payments reliability/observability owner` |
| Verification date | Source review dated 2026-06-30 |
| Environment/chain | Canary client, backend, persistence, Celo Mainnet |
| Required evidence | Correlated lifecycle logs/metrics, complete stable reason codes, privacy review, dashboards/alerts, paid-without-credit/replay/finality/recovery/rollback monitoring, and response owners. |
| Current evidence | Structured server logger exists; verifier logs selected guard/config/storage errors; ledger metadata retains transaction fields; client exposes transient phases. |
| Evidence gaps | No intent/payment identity correlation, success lifecycle events, complete failure taxonomy, finality/recovery/rollback metrics, dashboards, alert thresholds, or operational owners. Some current logs include wallet context and require privacy review. |
| Documentation/ops only? | No. Dashboard/runbook work is operational, but required telemetry must be emitted by implementation. |
| Requires implementation? | Yes. |
| Proposed next action | Define the event/reason-code catalog with the state machine, then instrument the smallest settlement/client boundaries and attach dashboards/alerts. |
| Get Peones impact | Blocking: payment success cannot be reliably separated from entitlement/recovery failure operationally. |

## Evidence-only and operational verification controls

Only Control 2 can potentially reach `PASS` without product code. It still requires independent mainnet evidence, custody approval, and an operational runbook. Controls 1, 3, 11, 12, and 13 contain documentation/ops decisions, but none can reach `PASS` without enforcement evidence.

## Product/backend design controls

Controls 1, 3, 4, 8, 9, 11, and 12 require explicit decisions before implementation. Their design outputs are canonical configuration/version semantics, token policy, intent schema, settlement state machine, recovery policy, finality/reorg policy, and rollback/cutoff policy.

## Implementation-required controls

Controls 1, 3–13 require implementation before `PASS`. The core enforcement controls are 5, 6, 7, 10, and 13; the design controls above also require implemented enforcement, persistence, tests, or operational instrumentation.

## Gate conclusion

No Wave 0 control is currently recorded `PASS`. One is `BLOCKED` on operational deployment evidence, one is `BLOCKED` on token reconciliation, and eleven are `FAIL` against current acceptance conditions.

**Get Peones canary remains blocked.**

This register authorizes no implementation, configuration, deployment, staging action, POC, contract change, production change, or commit.
