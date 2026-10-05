# Play cron adaptive log pagination — 2026-10-05

Branch: `fix/cron-adaptive-log-pagination`, isolated from `origin/main` at `46bb578341a9557386d0bb09b0e0e0aa2173ce7d`. The original dirty checkout and landing migration are untouched.

## Diagnosis and scope

The operator diagnosed RPC error `-32062` / `Block range is too large` from `apps/web/src/lib/server/sync-blockchain.ts`. Its `getLogsPaginated` previously always requested up to 50,000 inclusive blocks. Cron authentication and destination are reported working; neither workflow nor `CRON_URL`/`CRON_SECRET` requires a change.

Repository inspection confirms `SHOP_DEPLOY_BLOCK_CELO` is read only by `apps/web/src/app/api/founder-status/route.ts` (plus its tests). It bounds Shop `ItemPurchased` scans for founder badges. The configurable scan floor remains useful for redeployed/fixture contracts, but the environment name is optional because the route falls back to `37_800_000n`. No production value was inspected or changed. The Shop flow is independent of the score/victory sync cursor.

Cron keeps `DEFAULT_FROM_BLOCK = 61_113_664`; subsequent runs start at `Number(sync_state.last_synced_block) + 1`. No cursor reset, historical skip or replacement with the Shop deployment block was introduced.

## Change and invariants

The shared helper starts each scan with the existing 50,000-block maximum. On an explicit range-limit error it halves the attempted inclusive range and retries the same starting block. It retains the smaller size for later successful chunks. A one-block rejection terminates by throwing the original error. Non-range errors propagate immediately.

Range classification recognizes numeric/string `-32062` and equivalent block-range-limit messages through Ethers/provider `error`, `info`, and `cause` wrappers, with cycle protection. Successful responses alone append logs and advance the next start to the prior end plus one. Rejected attempts contribute no logs. Both score and victory scans continue to call the same helper. Existing per-log processing behavior is unchanged.

`setSyncState("last_synced_block", ...)` remains after both scans and passport complete. Tests assert it is not called for either scan failure, a later chunk failure after partial progress, or passport failure. Writes already performed before a failure are not rolled back; the existing authoritative upsert behavior supports rescanning from the unchanged cursor.

## Validation

- Relevant tests: **35 passed across 3 files**, including new sync tests, cron route and founder-status route.
- Covered maximum success, nested `-32062`, repeated reductions, message equivalents, partial-tail reduction, single-block termination, unrelated errors, empty interval, exact successful-range coverage, both contract scans and cursor behavior.
- Focused TypeScript validation of the changed sync module, its new tests and imported dependencies: **passed** (temporary validation config, not committed).
- Full app `pnpm --filter web exec tsc --noEmit`: **fails with 54 existing diagnostics**, including React type incompatibilities and unavailable `react-dom.preload`. Comparing against the baseline sync source found zero new diagnostics; baseline-only new-test missing-export errors were excluded from that comparison. No unrelated UI/type changes were made.
- No RPC, database, production endpoint or workflow was executed by this validation. No secret values or local dotenv files were read.

## Operator verification after a separately authorized release

1. Release the reviewed fix to the Play application through its normal process; this task does not deploy it.
2. Record the existing sync cursor through an authorized secure operational view; preserve it unchanged before the run. Do not reset or fast-forward it.
3. Manually dispatch the existing `Cron — Supabase cache sync` workflow using its existing destination/auth configuration. Do not print authentication headers or RPC credentials.
4. Check that the endpoint returns success, `fromBlock` equals the previous cursor plus one (or the unchanged default for first sync), and `toBlock` is the captured chain head. Confirm the stored cursor advances only on success and expected score/victory updates exist.
5. Verify the next scheduled run starts at the prior successful end plus one. On an RPC failure confirm the cursor stays unchanged and retry from it after recovery.

A very small provider limit can require many requests and exceed the route's existing 60-second budget. Adaptive pagination fixes range rejection, but does not prove production backlog duration or provider quota capacity. Validate one controlled run; do not load-test, skip history or reset the cursor to hide a timeout.
