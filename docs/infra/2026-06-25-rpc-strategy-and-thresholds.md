# RPC Strategy & Upgrade Thresholds — 2026-06-25

Reference doc: when (if ever) Chesscito needs a paid RPC tier or an indexer.
Decision context: launching Lite + Full both fully enabled. Today everything
runs on free tier (Forno) and that is sufficient. This doc records the signals
that would justify spending money.

## Current RPC footprint

| Caller | RPC call | Range? | Free-tier safe? |
|---|---|---|---|
| `verify-payment` (the PAYMENT path) | `getTransactionReceipt(hash)` | No — single hash | ✅ Yes, scales fine |
| client/wagmi | `balanceOf`, `waitForTransactionReceipt` | No | ✅ Yes |
| `founder-status` | `getLogs` (historical) + `getBlockNumber` | **Yes — huge** | ⚠️ Needs pagination (done) |
| `sync-blockchain.ts` | reads via `CELO_RPC_URL` | varies | ✅ Yes |

Key insight: **payments do NOT need a paid RPC.** `getTransactionReceipt` looks
up one tx hash — free tiers don't cap that. The only RPC pain is historical
`getLogs` (founder-status), and that's a *design* problem (scanning all chain
history), not a *plan* problem.

## RPC config (as of this date)

- `CELO_RPC_URL` — global, used by verify-payment + sync-blockchain. Currently
  Alchemy free tier. **Untouched** by the founder-status fix.
- `FOUNDER_STATUS_RPC_URL` — founder-status only; defaults to Forno (no
  block-range cap beyond 5000, which the pagination respects).

## Upgrade thresholds — what would change the decision

### Signal 1 — Rate limits (429s) in peak hours
Many concurrent hub users firing `balanceOf` reads (token selection) could hit
free-tier req/s limits. **Action:** move `CELO_RPC_URL` to a PAYG provider
(Alchemy PAYG / dRPC / QuickNode). Reads become more reliable. ~$0 until real
traffic; cheap even then.

### Signal 2 — Payment confirmation latency / flakiness
If `waitForTransactionReceipt` on the payment path gets slow or flaky on Forno
under load. **Action:** dedicated PAYG RPC for the payment client only. Highest
ROI spend — payments are revenue-critical.

### Signal 3 — founder-status (or any historical read) becomes hot
If Founder Badge ownership needs instant resolution at scale, pagination (up to
200 sequential Forno calls cold) is too slow. **Action: NOT a paid RPC — build
an indexer.** A worker follows `ItemPurchased` events into Supabase; the API
reads the DB. This is the same pattern Season Pass already uses (purchases pass
through our backend → recorded in `lite_season_passes`, never scanned).

## Recommendation

- **Now (Lite + Full launch):** free tier is enough. No spend.
- **Monitor:** 429 rate limits, payment receipt latency.
- **First money, if needed:** PAYG RPC for the payment path (Signal 2).
- **Do NOT** reach for paid Alchemy to "fix" founder-status — the right answer
  there is an indexer, and only if that read becomes hot.

## Architectural rule (already in effect)

If a purchase flows through our backend, record a DB reference and never scan
the chain for it. Season Pass follows this. Founder Badge predates it (bought
directly on the Shop contract), which is why it's the one endpoint that scans.
