# Coach Session Memory — Red-Team Review (2026-05-06)

> Reviewed against spec commit: `845270af04ca36b776037ea875bac0adb471c9d4`
> Spec path: `docs/superpowers/specs/2026-05-06-coach-session-memory-design.md`
> Reviewer: code-reviewer subagent

## Summary

Adversarial review surfaced **23 findings** (8 P0 / 10 P1 / 5 P2). The design is architecturally sound but has multiple security and consistency holes that **must** be closed before the implementation plan is drafted. The most dangerous: (1) the delete-by-self signed message has no nonce-replay defense and lacks chain/domain binding, (2) the route never propagates `historyMeta` to the response in the file the spec claims to modify (`<CoachPanel>` doesn't take `historyMeta` as a prop today), and (3) several "existing" infra references in §10 don't exist or live elsewhere (no `lib/content/legal-copy.ts`, no `/coach/history` route, no `<Link href="/coach/history">` target — `CoachHistory` is mounted inside `/arena`). Verdict: **send back to author for a §10/§9 reconciliation pass + delete-endpoint hardening before plan generation.**

---

## P0 — Must fix before implementation plan

### P0-1. Delete signature has no nonce store → trivial replay

**Where:** §8.2 ("Delete-by-self endpoint")
**What breaks:** The spec says "wallet signs `Delete my Coach history\nNonce: {nonce}\nIssued: {ISO}`. Server verifies via viem `verifyMessage`, rejects if signature mismatched or message older than 5 minutes." There is **no server-side nonce registry**. Within the 5-minute window, the same signed payload can be re-submitted unlimited times. Worse: if a leaked sig is captured (browser history, MITM on a non-HTTPS dev path, browser extension exfil), an attacker with no key can replay until expiry. Even more: viem `verifyMessage` is **not yet imported anywhere in the codebase** (verified: `grep -r verifyMessage src/` returns 0 hits) — meaning this is a brand-new auth surface that the spec doesn't fully design.
**Fix:**
- Server stores `coach:delete-nonce:${nonce}` with `nx, ex=300` BEFORE accepting the signature; reject on collision (replay) or absence in window.
- Bind the message to chainId + domain: `\nDomain: chesscito.app\nChain: 42220` to prevent message confusion across other Chesscito signed surfaces.
- Add the address from `recoverMessageAddress` to a comparison vs. the body-supplied wallet — both must match (defense against caller spoofing wallet field).
- Document expected error responses (401 vs 403 vs 410 expired).

### P0-2. `/coach/history` route does not exist → footer link 404s

**Where:** §9.1 (`<Link href="/coach/history">`) and §9.2 ("Section appended to `<CoachHistory>`")
**What breaks:** Verified via `find apps/web/src/app -type d -name history`: only `app/api/coach/history/` exists; **no page route at `/coach/history`**. The component `<CoachHistory>` is rendered inside `apps/web/src/app/arena/page.tsx` (line 1254). The spec's footer link will hit a 404. The "delete surface" must be appended to the rendered `<CoachHistory>` component on `/arena`, not a new dedicated route.
**Fix:** Either (a) drop the link and inline a "Manage history" button right in the panel, or (b) explicitly create a new `app/coach/history/page.tsx` route in §10's module map and add it to §13 rollout — current spec does neither.

### P0-3. `historyMeta` plumbing has no surface in `<CoachPanel>` today

**Where:** §6.4 (response payload), §9.1 (`<CoachPanel>` footer)
**What breaks:** Verified `apps/web/src/components/coach/coach-panel.tsx` lines 9–18: the props are `response, difficulty, totalMoves, elapsedMs, credits, onPlayAgain, onBackToHub, onViewHistory`. There is no `proActive` and no `historyMeta`. The spec's `{proActive && historyMeta && (…)}` block requires plumbing through `<CoachPanel>` props **and** the `arena/page.tsx` parent that consumes the analyze response. §10's module map only marks `coach-panel.tsx` as MODIFIED — but `arena/page.tsx` (a 1000+ line file) also needs threading. Hidden complexity.
**Fix:** Add `arena/page.tsx` to the §10 module map. Define the new `<CoachPanel>` Props shape (with `proActive?: boolean; historyMeta?: { gamesPlayed: number }`) explicitly in the spec.

### P0-4. `lib/content/legal-copy.ts` does not exist + privacy path wrong

**Where:** §8.3 (privacy copy), §10 module map line `lib/content/legal-copy.ts | MODIFIED`
**What breaks:** Verified: `apps/web/src/lib/content/` contains only `editorial.ts`. There is **no `legal-copy.ts`**. Also: the spec says "Append to `apps/web/src/app/legal/privacy/page.tsx`" but the actual route is `apps/web/src/app/privacy/page.tsx` (no `legal/` prefix). §14 already flags this as "confirm during implementation" — that's not acceptable: it leaks into rollout (you can't apply a migration that adds privacy copy if you don't know where it goes). Also `editorial.ts` is single-source-of-truth per CLAUDE.md project rules ("`editorial.ts` — single source of truth for ALL user-facing copy") — splitting privacy copy into a new file would violate that convention.
**Fix:** Confirm the path (`app/privacy/page.tsx`) in the spec, append legal copy directly into `editorial.ts` (e.g., a new `PRIVACY_COACH_COPY` constant), and remove the `legal-copy.ts` row from §10.

### P0-5. Backfill races against in-flight `/analyze` for the same wallet

**Where:** §7 (backfill), §6.2 (read path)
**What breaks:** The backfill runs **before** `aggregateHistory` on the same request. If a user fires two simultaneous `/analyze` calls (e.g., double-tap + retry), request A acquires the Redis lock, B sees `acquired === false` and **returns immediately with `{copied: 0}`**. Request B then proceeds to `aggregateHistory(wallet)` against an empty Supabase table → `digest === null` → augmentation block omitted. The user paid for PRO and the second call gets free-tier-equivalent prompting. The "fail-soft" claim hides this.
**Fix:** When the lock is held, B should **wait** (poll up to ~3s) for the lock to release, OR `aggregateHistory` should fall back to reading the Redis `analysisList` directly when Supabase returns 0 rows for a PRO user with non-empty Redis history.

### P0-6. Cron purge has no idempotency guard against multi-runner concurrency

**Where:** §8.1
**What breaks:** GitHub Actions can fire the cron twice on rare retries; if the workflow runs from two clones (manual `workflow_dispatch` during a scheduled run), two `delete WHERE expires_at < now()` execute concurrently. Supabase will serialize the writes (no data loss) but you'll log `rows_deleted: N` then `rows_deleted: 0` — the metric becomes useless for monitoring. Worse: the deletion is **unbounded** — if a backlog accumulates (e.g., cron failed for a week), a single call deletes potentially millions of rows in one transaction, blocking the table. The spec's existing `cron-cache-sync.yml` doesn't have a job-mutex pattern either, so this is a class issue.
**Fix:** Cap deletion: `delete … LIMIT 5000 returning *` in a loop, or add `concurrency: { group: cron-coach-purge, cancel-in-progress: false }` to the GH Actions job, plus a Redis advisory lock (`coach:cron:purge`) with `nx, ex=600` at endpoint entry.

### P0-7. RLS policy admits service_role only — but client `<CoachHistory>` reads via `/api/coach/history` (Redis path, not Supabase). Where does the Supabase read for §9.2's "delete UI" come from?

**Where:** §5 (RLS), §9.2 (delete surface), §6.2 (PRO-only persists)
**What breaks:** The RLS policy is `service_role full access`. That's fine for server-side endpoints. **But** the spec never specifies how the delete UI knows there is anything to delete. It just shows a button. Edge: a PRO user clicks "Delete history" with **zero rows** in Supabase (e.g., backfill failed silently per §6.5). They sign a message, the server deletes 0 rows in Supabase + flushes 0 Redis keys, returns success. Telemetry says `coach_history_deleted: { supabase_rows: 0, redis_keys: 0 }` — the user thinks they deleted something they never had. Confusing UX.
**Fix:** Either (a) read row count first and disable the button if 0 (extra round-trip but honest), or (b) the success toast message must be neutral ("All Coach data cleared from our records") — never imply a positive action that didn't happen. Spec's `successToast: "History deleted"` violates this.

### P0-8. `recoverMessageAddress` failure mode + signature **must** be lowercase-normalized vs. the wallet field

**Where:** §8.2
**What breaks:** Spec says verify the signature, then "deletes the wallet's rows in Supabase + flushes its Redis keys." Which wallet? The body-supplied `walletAddress`, or the recovered address from the signature? If different, attacker can submit a signed message from wallet A but pass `walletAddress: B` in the body, deleting B's history. Mainline crypto pitfall.
**Fix:** Server MUST: `const recovered = await recoverMessageAddress(...); if (recovered.toLowerCase() !== body.walletAddress.toLowerCase()) reject`. Then key everything off the recovered address, NEVER the body field, when issuing the deletes.

---

## P1 — Should fix

### P1-1. `extractWeaknessTags` taxonomy is undefined — finalizing during implementation hides multi-day work

**Where:** §5 ("~20 labels"), §14 ("finalize the ~20-label set during implementation")
**What breaks:** This is not a triviality. To be useful, the tags must (a) cover the explanation surface of LLM output (which is non-deterministic), (b) be stable across model upgrades (a `gpt-4o-mini → gpt-5` swap will produce different `mistake.explanation` phrasing — your regex/keyword heuristics rot), and (c) support aggregation. §13's risk register says "New tags can be added without migration" — true, but adding them retroactively means existing rows with no tag don't benefit. This is a 2-3 day mini-project: build a labeled corpus of ~50 mistake.explanation strings, derive labels, write deterministic extraction, write tests against the corpus, decide refresh policy.
**Fix:** Lift this into its own pre-spec design item OR explicitly scope it as a "v1: ~5 labels matched by explicit keyword sets" with a clear deferral note for richer taxonomy. Don't ship `weakness_tags text[] not null default '{}'` as a binding column shape until the taxonomy is named.

### P1-2. UPSERT amplification — high-volume PRO user (100 analyses/day × 365 days)

**Where:** §5 schema, §13 risk register
**What breaks:** Composite PK is `(wallet, game_id)`. UPSERT on every PRO write. Index `coach_analyses_wallet_recent_idx (wallet, created_at desc)` will be bloated. After 365 days × 100/day = 36,500 rows for a single power user. The on-read aggregate `SELECT … LIMIT 20 ORDER BY created_at DESC` is fine on the index, but `expires_at` index has no `LIMIT` cap on cron purge (see P0-6). Realistic load is much lower (most users <10/day) but the spec doesn't model it.
**Fix:** Add an explicit row cap per wallet. After insert, fire `delete from coach_analyses where wallet = $1 and game_id not in (select game_id from … order by created_at desc limit 200)` — or at the very least, log a warning when a wallet exceeds 500 rows.

### P1-3. LLM token amplification — every PRO request adds ~300 tokens + costs

**Where:** §6.3 prompt augmentation
**What breaks:** Today's prompt is ~600 tokens. Adding the history block + instruction is ~300 tokens **per PRO request**. With 1000 PRO analyses/month, that's 300k extra input tokens/month — at gpt-4o-mini pricing (~$0.15/1M) ~$0.05/month. Negligible today. But if PRO base grows 100×, it's $5/month per "Etapa 2" — and the spec never identifies a budget owner. More importantly: the spec doesn't show the **ceiling**. If `digest.recurringMistakes` is allowed full Mistake[] payload, a verbose explanation field could push a single block to 1500 tokens.
**Fix:** Cap the prompt block at a fixed character budget (e.g., 600 chars), truncate explanations, document expected token delta in §13 risk register.

### P1-4. `historyMeta.gamesPlayed` vs. `historyDepth` naming inconsistency in spec

**Where:** §6.4 (`historyMeta.gamesPlayed`), §6.5 ("respond with `historyMeta.historyDepth: 0`")
**What breaks:** Internal inconsistency. The author flagged a similar issue in the self-review (`historyMeta.gamesPlayed` rename) but missed §6.5's `historyDepth`. The TS contract becomes ambiguous to the implementer.
**Fix:** Pick one (`gamesPlayed` is more user-friendly, lines up with `digest.gamesPlayed`) and replace `historyDepth` everywhere.

### P1-5. `kind="quick"` LLM responses bypass `coach_analyses` insert — but the predicate is `digest.kind !== "full"` only inside backfill, not in the live write path

**Where:** §6.1 write path (`normalized.data.kind === "full"` check) and §7 backfill (`analysis.response.kind !== "full" continue`)
**What breaks:** OK on a careful read — both paths gate on `kind === "full"`. **But** the spec's §5 `summary_text text not null` and `mistakes jsonb not null` schema commits to the full schema. If a future migration adds `BasicCoachResponse` to the table (e.g., to track quick analyses), the columns `mistakes / lessons / praise` are NOT NULL but quick responses don't have them. Latent forward-compat bug.
**Fix:** Either drop the NOT NULL on those columns (lessons + praise can be empty arrays) and store `kind` as a real column, or add an explicit constraint `check (kind = 'full')` to make intent loud.

### P1-6. Backfill `expires_at` defaults to `now() + 1y` even when source analysis is 25-29 days old (Redis 30d TTL boundary)

**Where:** §7 (`expires_at uses default (now + 1y)`)
**What breaks:** A user who has been Free for 25 days, accumulating 20 analyses, then upgrades. Backfill runs, copies all 20. They get **1y retention from upgrade date** for analyses that were originally Day 1 of free use (24 days ago). This is OK from a privacy-promised-to-user POV (the privacy copy says "365 days from creation" — ambiguous). But §8.3 privacy copy says "We retain match analyses for **365 days** from creation" — `creation` here is the original analyze date, not the upgrade date. Drift up to 30 days. Compliance auditor catches it: privacy notice is wrong by up to 30 days.
**Fix:** Set `expires_at = analysis.createdAt + 1y` in backfill rather than the table default. Trivial 1-line fix; leaves the spec consistent with the privacy notice.

### P1-7. `extractWeaknessTags` failure path silently drops the row

**Where:** §6.5 ("`extractWeaknessTags` throws → Skip persistence (don't insert with empty tags). Log warn.")
**What breaks:** A LLM hiccup → bad mistake explanations → tag extraction throws → row skipped → no Supabase footprint for a paid analysis. Subsequent analyses on this wallet have less history → degraded coaching. Better to insert with `weakness_tags = '{}'` and log warn for the tag failure separately.
**Fix:** Wrap `extractWeaknessTags` in a try/catch INSIDE `persistAnalysis`, default to `[]` on throw, log the tag-extraction failure as a separate event.

### P1-8. Wallet hashing for logs is reversible by attacker who controls log access

**Where:** §8.4 (`hashWallet(wallet) = sha256(wallet + LOG_SALT).slice(0, 12)`)
**What breaks:** The total wallet address space is 2^160, but the **active wallet space** is the union of all wallets that have used Chesscito (small, queryable from on-chain or your own Supabase scoreboard cache). Given the salt is a single env var, an attacker with read access to logs + the salt can rainbow-table all known wallets in seconds. `slice(0, 12)` (48 bits) further means **collisions are possible** (~16M wallets to expect collision) but this is high enough to be unique-per-wallet and low enough to allow brute-force enumeration of an attacker-known shortlist.
**Fix:** Either (a) document that `LOG_SALT` itself is treated as a secret (rotated quarterly, never committed), or (b) use a longer hash prefix (16+ chars). The current "stable but non-reversible" claim is misleading without those caveats.

### P1-9. Concurrent writes for the same `gameId` from two devices — same wallet, same game

**Where:** Not covered in §6.5 failure modes
**What breaks:** Wallet on phone + tablet both fire `/analyze` for the same `gameId`. Redis idempotency at the route level handles this (existing pattern). But on the Supabase side, the upsert composite PK `(wallet, game_id)` will resolve race-cleanly. The issue: the first request inserts row with `weakness_tags=[A,B]`, the second request (LLM regenerated → different mistakes) UPSERTs with `weakness_tags=[A,C]`, **silently overwriting**. The aggregate history now shows different patterns depending on which version "won the race". This is not a security issue but a data-quality one.
**Fix:** Make `coach_analyses` insert use `on conflict do nothing` instead of `upsert`. The first analysis to land sticks; subsequent are noops.

### P1-10. `recurringMistakes` by exact `(moveNumber, played)` will rarely fire

**Where:** §1, §3 decision 3, §6.3
**What breaks:** "Third time you played Bxh7 sacrifice" is the marketing dream. Reality: chess move numbers + SAN almost never repeat exactly across games (different opponents → different positions → different move numbers for the same idea). If a beginner blunders Bxh7 in game 1 at move 14 and game 2 at move 17, they don't match. The actual recurring-pattern rate may be near-zero, making the augmentation block frequently say "Recurring concrete mistakes:" with empty content.
**Fix:** Either (a) match on `played` only (collision risk: "e4" appears in many games — would over-flag), (b) match on `weakness_tag + played` pair, or (c) document an empirical threshold ("if recurring set is empty, omit the section entirely"). The current spec says §6.3 "Recurring concrete mistakes:" is always rendered if `digest !== null`, which means the prompt frequently lies about the user's history.

---

## P2 — Nice to have

### P2-1. `<ConfirmDeleteModal>` primitive doesn't exist — must be built atop `<Sheet>`

**Where:** §9.2, §10 (`components/coach/confirm-delete-modal.tsx | NEW`), §14 ("choose between `<Sheet>` and `<Dialog>`")
**What breaks:** Verified: `apps/web/src/components/ui/` has `sheet.tsx` only — no `dialog.tsx`. So the choice from §14 isn't really a choice. Spec just under-specifies a component.
**Fix:** Commit to `<Sheet>` in the spec; remove the §14 OQ.

### P2-2. Telemetry event field `redis_keys` is ambiguous — count or array?

**Where:** §12 (`coach_history_deleted` event fields)
**What breaks:** `{ wallet_hash, supabase_rows, redis_keys }` — is `redis_keys` a count of keys flushed or the keys themselves (PII risk)? Implementer might log raw key strings, which contain the wallet.
**Fix:** Rename to `redis_keys_deleted: number`, explicit count.

### P2-3. §13 rollout step 5 ("`PRO_COPY` array swap") competes with the `ComingSoonChip` system

**Where:** §13 step 5, §9.4
**What breaks:** Verified `editorial.ts` line 967: comment says `<ComingSoonChip />` is rendered against `perksRoadmap`. Moving the item to `perksActive` works — but `perksActive` items don't have a "newly active" affordance (no "NEW" chip). Users who saw the item with SOON for weeks won't notice it flipped to active. Pure copy move = silent ship. Marketing miss, not a bug.
**Fix:** Add a transient "NEW" chip to the moved item for one release cycle, OR ship a one-time `<Banner>` callout in `<CoachPanel>` first run after the swap. (Explicitly out-of-scope for this spec, just flag.)

### P2-4. `coach_purge_complete` event has no `error` branch

**Where:** §8.1, §12
**What breaks:** Cron handler logs success only. If the Supabase delete returns an error (auth issue, network blip), the GH Actions step will succeed (HTTP 200) because the route catches and returns 200. Silent rot.
**Fix:** Wrap in try/catch, on error log `coach_purge_failed` and return 500 so the GH Actions step shows red.

### P2-5. Privacy copy says "wallet loss = no recovery" implicitly — explicitly call it out

**Where:** §8.3 privacy copy
**What breaks:** GDPR right-to-erasure requires a path even for users who lose their wallet. The spec's delete-by-self requires signing. A user with a lost key has no recourse. This is fine legally if disclosed, but the privacy copy doesn't mention it.
**Fix:** Add to privacy copy: "Note: deletion requires control of the wallet that owns the analyses. If you lose access to your wallet, contact us at [email] for an out-of-band deletion request."

---

## False positives / non-issues

- **Initially flagged: "Same `gameId` across devices = duplicate inserts."** Resolved: composite PK `(wallet, game_id)` blocks duplicates per-wallet. Cross-wallet duplicates are fine (different users, different rows).
- **Initially flagged: "RLS policy too permissive."** Resolved: `service_role` is the standard SR backdoor; the spec correctly omits anon/authenticated policies.
- **Initially flagged: "Backfill 100KB single insert too big."** Resolved: well within Supabase row/payload limits.
- **Initially flagged: "Free path leaks Supabase touches."** Resolved: §6.1 + §6.2 both gate on `proStatus.active`. Free path is bit-identical.
- **Initially flagged: "OpenAI 429 missing from §6.5."** Resolved: existing `/analyze` already wraps the LLM call in try/catch and degrades to `502 / failed`. Feature is additive.
- **Initially flagged: "Vercel-plugin / next-forge / vercel-storage skill suggestions."** Resolved: all false positives from path-suffix matchers in subagent hooks. Codebase is Turborepo (not next-forge), Supabase is direct (not Marketplace), and review work doesn't author new function/cache code.

---

## Verified claims

| Spec claim | File read | Result |
|---|---|---|
| `lib/coach/redis-keys.ts` shape | `apps/web/src/lib/coach/redis-keys.ts` | Confirmed — has `analysis`, `analysisList`, `game`. Spec's proposed `backfillClaim` is a clean addition. |
| `lib/server/demo-signing.ts` exists | `apps/web/src/lib/server/demo-signing.ts` | Confirmed — exports `enforceOrigin`, `enforceRateLimit`, `getRequestIp`, `parseAddress`. Has `ethers` (not viem) — spec proposes `viem.verifyMessage` (mixed-stack risk noted in P0-1). |
| `lib/pro/is-active.ts` shape | `apps/web/src/lib/pro/is-active.ts` | Confirmed — `isProActive(wallet)` returns `{ active, expiresAt }`. Lowercases wallet internally. |
| `lib/supabase/server.ts` exists | `apps/web/src/lib/supabase/server.ts` | Confirmed — `getSupabaseServer()` returns null on missing env (graceful degradation). Spec must handle null return path explicitly. |
| `<Sheet>` primitive exists | `apps/web/src/components/ui/sheet.tsx` | Confirmed. **No `<Dialog>` primitive** — §14 OQ is a non-choice. |
| `lib/content/legal-copy.ts` | `apps/web/src/lib/content/` | **NOT FOUND** — only `editorial.ts`. P0-4. |
| `/coach/history` route page | `apps/web/src/app/coach/history/` | **NOT FOUND** — only `/api/coach/history` exists; UI lives in `<CoachHistory>` mounted in `/arena`. P0-2. |
| `/legal/privacy/page.tsx` | `apps/web/src/app/legal/privacy/` | **NOT FOUND** — actual path is `/app/privacy/page.tsx`. P0-4. |
| `<CoachPanel>` props include `proActive`/`historyMeta` | `apps/web/src/components/coach/coach-panel.tsx` | **NOT FOUND** — current props don't include either. New plumbing required through `arena/page.tsx`. P0-3. |
| `analysisList` Redis key shape | `apps/web/src/lib/coach/redis-keys.ts:7` | Confirmed — `coach:analyses:${wallet}`. Spec's `lrange(…, 0, 19)` matches existing GET handler at `app/api/coach/history/route.ts:22`. |
| `verifyMessage` already in use | `grep -r src/` | **NOT FOUND** — brand-new auth surface. Strengthens P0-1 case. |
| `cron-cache-sync.yml` exists | `.github/workflows/cron-cache-sync.yml` | Confirmed — sample for the new `coach-purge` schedule. Lacks concurrency guard (P0-6). |
| `PRO_COPY.perksRoadmap[0]` | `apps/web/src/lib/content/editorial.ts:977` | Confirmed — "Personalized coaching plan from match history" is the first entry. Array swap at rollout (§13) is a one-line edit. |
| `lib/server/logger.ts` redaction pattern | `apps/web/src/lib/server/logger.ts` | Confirmed — has `SECRET_KEY_RE` redaction; **does not** export a `hashWallet` helper. Spec proposes the helper as new (consistent with file shape but not "mirrors the existing pattern" — there's no existing wallet-hash pattern, only a key-redaction pattern). |
