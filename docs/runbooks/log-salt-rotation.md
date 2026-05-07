# `LOG_SALT` Rotation Runbook

> **Cadence:** Quarterly (every ~90 days). Set a recurring calendar reminder.
> **Owner:** Server-side secrets steward (currently @akawolfcito).
> **Spec reference:** `docs/superpowers/specs/2026-05-06-coach-session-memory-design.md` §8.4 / red-team P1-8.

## Why

`LOG_SALT` is the server-side secret that turns wallet addresses into stable, non-reversible 16-hex-char identifiers in our logs (`hashWallet(wallet) = sha256(wallet.toLowerCase() + LOG_SALT).slice(0, 16)` — see `apps/web/src/lib/server/logger.ts`). Without rotation, an attacker who eventually obtains `LOG_SALT` (e.g., via a misconfigured Vercel env export, an insider leak, or a forensic image of a build artifact) can rainbow-table all historical wallet hashes back to their plaintext addresses.

Rotation breaks the correlation window: hashes from before the rotation are no longer correlatable to hashes after the rotation, so the blast radius of any future salt leak is bounded to ~one quarter of historical logs rather than the entire log history.

## How

### 1. Generate a new salt

```bash
openssl rand -hex 32
```

(64 hex chars / 256 bits of entropy. Save the output to your password manager BEFORE pasting it into Vercel — if you lose it mid-rotation, you'll need to redeploy with a fresh value and the previous quarter's hashes become uncorrelatable too.)

### 2. Rotate in Vercel

For each environment that uses `LOG_SALT` (production, preview, development if used):

```bash
# Remove the old value
vercel env rm LOG_SALT production
# Add the new value (Vercel CLI prompts for stdin)
vercel env add LOG_SALT production
```

Repeat for `preview` and `development` if applicable.

### 3. Trigger a redeploy

The new `LOG_SALT` only takes effect on the next build. Either:

- Push an empty commit to `main` (`git commit --allow-empty -m "chore: redeploy for LOG_SALT rotation" && git push`), or
- Use the Vercel dashboard "Redeploy" button on the latest production deployment.

### 4. Verify

After the redeploy completes, exercise any Coach surface that emits `wallet_hash` (e.g., `/api/coach/analyze` with a PRO wallet, or trigger `/api/cron/coach-purge` manually via the GH Actions `workflow_dispatch`). Confirm new log lines have `wallet_hash` values that DON'T match historical hashes for the same wallet — that's the rotation working.

If `hashWallet()` is throwing `LOG_SALT env is required (server-side secret)`, the env var didn't propagate. Re-check the Vercel env list (`vercel env ls`) and redeploy.

## Operational notes

- **Old log lines stay valid** — they just become uncorrelatable to post-rotation lines. This is the intended privacy property.
- **Cross-period investigations**: if you need to correlate a wallet across a rotation boundary (e.g., for an abuse investigation), you'll need both the old and new salts. The old salt is in your password manager from the previous rotation; the new one is in your password manager from THIS rotation.
- **Rotation atomicity**: `LOG_SALT` is read fresh on every `hashWallet()` call (no caching), so the rotation transition is atomic at the request level — once the new build serves traffic, every new log line uses the new salt.
- **Don't commit `LOG_SALT`**: it lives in Vercel env only. Pre-commit hook (`DRAGON` guard) blocks `.env*` files; double-check your local `.env.local` if you also use it for local dev.
- **Recovery**: if you rotate by accident or lose the new salt before saving to the password manager, the operational impact is just "this quarter's logs become uncorrelatable to next quarter's". Redeploy with a fresh `openssl rand -hex 32` and continue.

## Calendar template

Add to your team calendar:

> **Title**: Rotate `LOG_SALT` (Chesscito)
> **Recurrence**: Every 90 days
> **Description**: See `docs/runbooks/log-salt-rotation.md`. Estimated 10 minutes total. Required quarterly to limit historical-log deanonymization windows.
