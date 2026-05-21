# `SHOP_DEPLOY_BLOCK_CELO` Runbook

> **Cadence:** One-shot per Shop deploy. Re-run only when the Shop contract is
> re-deployed (new proxy address).
> **Owner:** Server-side env steward (currently @akawolfcito).
> **Code references:**
> - `apps/web/src/app/api/founder-status/route.ts` (consumer + warn-log)
> - `apps/contracts/deployments/celo.json` (deploy block source of truth)

## Why

`GET /api/founder-status` resolves whether a wallet owns the Founder Badge by replaying `BadgeMinted` events from the Shop contract via `eth_getLogs`. Celo's Forno public RPC (and most third-party providers) cap `eth_getLogs` at ~10,000 blocks per call. The Celo mainnet chain is already over 35M blocks tall, so a `fromBlock: "earliest"` call across the entire chain either rejects outright or silently truncates the result set — both of which produce a false "not a founder" verdict.

`SHOP_DEPLOY_BLOCK_CELO` pins the lower bound to the block where the Shop proxy was first deployed, narrowing the scan window to a tractable range. The Founder Badge cannot exist before that block, so no events are lost.

If the env var is missing in `production`, the route falls back to `fromBlock=earliest` and module-load emits a one-time warning via `console.warn`. The hook layer (`useOnboardingSignal`) tolerates the resulting 500 — PRO + badge + shield reads still recover returning-user detection — but the Founder Badge will never resolve as owned until the env var is set.

## How

### 1. Find the Shop deploy block

`apps/contracts/deployments/celo.json` records the proxy address (`shopProxy`) and a deploy timestamp (`shopDeployedAt`), but not the block number directly. To resolve the block:

1. Open Celoscan and paste the `shopProxy` address from `apps/contracts/deployments/celo.json` (also mirrored in `MEMORY.md` → "Smart Contracts").
2. Sort the address's transactions ascending, open the first (contract-creation) tx, copy the "Block" field.

Current value as of the 2026-03-12 deploy: **~37800000** (decimal). If you re-deploy the Shop in the future, update this number both in Vercel and in this runbook's next-paragraph stub line.

### 2. Set in Vercel

```bash
# Production (mandatory — the warn-log fires here)
vercel env add SHOP_DEPLOY_BLOCK_CELO production
# Preview + development (optional but recommended for parity with prod)
vercel env add SHOP_DEPLOY_BLOCK_CELO preview
vercel env add SHOP_DEPLOY_BLOCK_CELO development
```

Paste the block number (decimal, no `0x` prefix) when the CLI prompts.

### 3. Trigger a redeploy

The new env var only takes effect on the next build:

```bash
git commit --allow-empty -m "chore: redeploy for SHOP_DEPLOY_BLOCK_CELO" && git push
```

…or re-trigger the latest deploy from the Vercel dashboard.

### 4. Verify

After the redeploy lands, hit `/api/founder-status?wallet=<known-founder-wallet>` and confirm `ownsFounder: true`. Then check the production logs for the cold-start window:

- Expected: **no** `[founder-status] SHOP_DEPLOY_BLOCK_CELO is not set.` warning.
- Expected: at least one successful 200 response within the next few resolutions.

If the warning is still present after the redeploy, the env var didn't bind to the build — re-run step 2 and confirm via `vercel env ls production | grep SHOP_DEPLOY_BLOCK_CELO`.

## When to re-run

- **Shop re-deploys.** New proxy address → new deploy block → update the var.
- **Chain reorg past the block.** Effectively never on Celo PoS, but documented for completeness.
- **Environment provisioning of new previews / dev branches.** Copy from production.

## Reference

- `MEMORY.md` → "Smart Contracts" → Celo Mainnet → Shop Proxy address.
- `apps/contracts/deployments/celo.json` → `shopProxy.deployBlock` field.
- Cluster D Blind hunter review (2026-05-20) called out the missing-env-var failure mode; this runbook closes the docs half of that defer.
