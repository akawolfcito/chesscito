# Runbook — db-backed-content Phase 3 (flip + observe)

**Goal:** turn the content overlay live so founder-authored exercises appear in
prod **without redeploy**. Decision locked: **(a)** senda stays completed + new
exercise as optional extra (already the behavior — id-keyed progress, no code) ·
**flip mínimo** (exercises only; descriptions/labyrinths overlay = future).

Code is already on `main` (PRs #123/#126/#128/#130/#131). The flag
`CONTENT_OVERLAY_ENABLED` defaults OFF → prod is currently unaffected.

> ⚠️ Secrets never go through chat/git. Store `ADMIN_TOKEN` in your password
> manager (1Password/Bitwarden), one per environment. It is rotatable — if lost,
> generate a new one + update Vercel + redeploy.

---

## Step 1 — Apply the migration to hosted (once)

Run from `apps/web/` (see [[supabase-cwd]]).

```bash
# 1a. Confirm you are linked to the RIGHT hosted project
supabase projects list          # note which row has the ● linked marker

# 1b. Confirm only the overlay migration is pending (Remote column empty)
supabase migration list
#   20260617000000 |        | 2026-06-17 00:00:00   ← Local only = pending

# 1c. Apply it (additive: CREATE TABLE content_overlay + RLS, no data loss)
supabase db push

# 1d. Verify it landed (timestamp now also in the Remote column)
supabase migration list
```

Rollback if ever needed: `drop table content_overlay;` (table is empty until a
write happens; zero impact on existing data).

---

## Step 2 — Set env vars in Vercel

Use Vercel's **per-environment scopes** — do NOT set "All Environments" (this
project historically shared env; setting it globally would flip prod by accident).

| Variable | Preview | Production | Value |
|---|---|---|---|
| `SUPABASE_URL` | already set | already set | — (do not touch) |
| `SUPABASE_SERVICE_ROLE_KEY` | already set | already set | — (do not touch) |
| `ADMIN_TOKEN` | set (scope = Preview) | set later (scope = Production) | generate: `openssl rand -hex 32` — a different value per env |
| `CONTENT_OVERLAY_ENABLED` | `true` | **leave unset** for now | the switch (only Preview first) |

```bash
openssl rand -hex 32     # generate an ADMIN_TOKEN; save it in your password manager
```

---

## Step 3 — Redeploy preview & smoke test

Env var changes need a **new deploy** to take effect.

```bash
# Trigger a preview deploy (or push any commit / use the Vercel dashboard).
# Then run the smoke against the PREVIEW url.

PREVIEW_URL="https://preview.chesscito.com"   # latest main preview (see [[preview-alias]])
ADMIN_TOKEN="<the preview token you generated>"

# 3a. Write a throwaway test exercise (rook a1→h1 on an empty board — BFS-valid).
curl -sS -X POST "$PREVIEW_URL/api/admin/content" \
  -H "content-type: application/json" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -d '{
    "kind": "exercise",
    "record": {
      "id": "rook-smoke-phase3",
      "piece": "rook",
      "fen": "8/8/8/8/8/8/8/R7 w - - 0 1",
      "target": "h1",
      "mover": "a1",
      "tier": "easy",
      "tags": null,
      "explanation": "Phase 3 smoke — safe to delete.",
      "order": 999,
      "disabled": false
    }
  }'
# Expect: {"ok":true,"saved":{...,"optimal_moves":1},"revalidated":true}
```

Auth/fail responses to expect from this route:
- `503 {"ok":false,"errors":["admin writes disabled"]}` → `ADMIN_TOKEN` unset
- `403 {"ok":false,"errors":["forbidden"]}` → wrong/missing `x-admin-token`
- `400` → unsolvable/malformed record (never persists)

```bash
# 3b. Confirm it shows up LIVE on the rook surface WITHOUT a redeploy.
#     Open in the browser (390px / MiniPay viewport):
#       $PREVIEW_URL/exercises?piece=rook
#     The rook senda should now include the extra "rook-smoke-phase3" exercise
#     at the end. A player who already finished rook keeps the badge (≥10★) and
#     all prior stars — the new one appears as an optional extra (decision a).

# 3c. Clean up: soft-delete the smoke exercise (same id, disabled:true).
curl -sS -X POST "$PREVIEW_URL/api/admin/content" \
  -H "content-type: application/json" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -d '{
    "kind": "exercise",
    "record": {
      "id": "rook-smoke-phase3",
      "piece": "rook",
      "fen": "8/8/8/8/8/8/8/R7 w - - 0 1",
      "target": "h1",
      "mover": "a1",
      "tier": "easy",
      "tags": null,
      "explanation": null,
      "order": 999,
      "disabled": true
    }
  }'
# Reload $PREVIEW_URL/exercises?piece=rook → the extra exercise is gone.
```

**Smoke passes when:** 3a returns `ok:true, revalidated:true`, the exercise
appears live in 3b without any redeploy, and 3c removes it live.

---

## Step 4 — Flip production

Only after the preview smoke passes:

1. Set `ADMIN_TOKEN` (Production scope, a **different** value) + store it.
2. Set `CONTENT_OVERLAY_ENABLED=true` (Production scope).
3. Redeploy production.
4. Re-run the Step 3 smoke against `https://www.chesscito.com` (write → verify
   live → soft-delete). Use the **production** token.

**Kill-switch:** set `CONTENT_OVERLAY_ENABLED=false` (or unset) in Production +
redeploy → the loader is fully bypassed, no DB call, baseline served. Instant
revert with zero data loss.

---

## Observe (post-flip)

Server logs already emit:
- `[admin/content] write` — per write (id, kind, actor token-hash, updated_at).
- The merged catalog exposes `source` (`baseline+overlay` | `baseline-only`) and
  `overlayCount` — surface these in logs if egress/latency ever becomes a concern.

If Supabase (free tier) pauses, the loader times out at 2s → `baseline-only`,
game fully playable. No action needed.

---

## Overlay-full addendum (shipped 2026-06-17, PR #132)

The follow-up landed, so the overlay is no longer exercises-only:
- **Labyrinths** and **exercise descriptions** now flow live too (same flag).
- The **builder publishes in one click** instead of hand-running curl.

### Extra env (LOCAL builder machine only — for the publish button)
| Variable | Where | Value |
|---|---|---|
| `OVERLAY_PUBLISH_BASE_URL` | local `.env` | publish target, e.g. `https://preview.chesscito.com` (no trailing slash needed) |
| `ADMIN_TOKEN` | local `.env` | must match the **target** env's token (preview token to publish to preview) |

These are read **server-side** by `/api/dev/publish`; the token never reaches the
browser. Not needed in Vercel (that's the read side); only on the founder's
machine running the local builder.

### Publish via the builder (replaces the manual curl)
1. Run the builder locally: `http://localhost:3000/dev/labyrinth-builder`.
2. Author/edit an exercise or labyrinth, click **Save**.
   - Green toast = published live + saved to baseline json.
   - Amber toast = saved to baseline but live publish failed (check token/URL).
   - Red toast = validation error (nothing written).
3. **Commit `content/*.json`** afterward (the toast reminds you) so the change is
   versioned in git and folds into the baseline on the next deploy.

The curl path (Step 3) still works as a fallback / CI smoke.

## Out of scope (future)
- Click-time preview-vs-prod target picker in the builder (env-config only).
- VR baselines for the exercises surface (none exist yet).
- `wall1.png` builder wall asset (queued separately).

Wolfcito 🐾 @akawolfcito
