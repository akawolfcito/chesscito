# Chesscito — Release Process & Rollback Strategy

> **Canonical release flow.** Use this for every push to production. Last revision: 2026-06-02.

---

## 1. Branch model

| Branch | Role | Tracks | Vercel deploy |
|---|---|---|---|
| `main` | Integration branch. All feature merges land here first. Tests + audits run on push. | `origin/main` | Preview deploys per commit |
| `production` | Deploy branch. Vercel watches this for the production environment. | `origin/production` | **Production deploy on every push** |
| `feat/*`, `fix/*`, `chore/*` | Topic branches. Open PR against `main`. | own remote | Preview per PR |

**Invariant:** `production` is **always** a strict ancestor of `main`. Fast-forward only. No
direct commits to `production`. No merge commits between them. Every production push is a
clean replay of commits already verified on `main`.

---

## 2. Release flow (the canonical 6 steps)

Runs from the repo root, working tree must be clean.

```bash
# 0. Pre-flight (do this in your head, not as a command)
#    - Working tree clean: git status
#    - All target commits committed and on local main
#    - Tests green locally for the cluster you're shipping
#    - No secrets, no .env, no private/ in the staged diff

# 1. Sync remote main with all the cluster's commits
git push origin main

# 2. Switch to the deploy branch
git checkout production

# 3. Make sure local production matches remote (ff only, no surprises)
git pull --ff-only origin production

# 4. Fast-forward production to main (production must be strictly behind)
git merge --ff-only main

# 5. Push — Vercel auto-triggers the production deploy on this push
git push origin production

# 6. Return to working branch
git checkout main
```

If any step fails:

- **Step 1 rejected (non-fast-forward on main)** → someone else pushed; `git pull --rebase origin main`, re-run tests, then retry from step 1.
- **Step 3 fails** → local `production` has diverged. Stop. Investigate with `git log production..origin/production` before doing anything destructive.
- **Step 4 refuses ff** → `main` is not a descendant of `production`. Stop. Something is wrong with the branch model. Do not force.
- **Step 5 rejected** → similar to step 3; never `--force` without explicit Wolfcito sign-off.

---

## 3. Post-push verification

After step 5 the deploy is live in roughly 1 to 3 minutes. Verify:

1. Vercel deployments dashboard shows the latest `production` SHA as the active production deployment.
2. Smoke `https://chesscito.com` (apex) and `https://www.chesscito.com` (www) on:
   - Desktop browser (Chrome).
   - MiniPay (Android, real device).
3. Check `/api/sign-victory`, `/api/sign-purchase`, `/api/pro/status` respond 200 from `www.chesscito.com` (origin check guard).
4. Optional: tail Vercel function logs for `origin_bypass_triggered` spikes for 5 minutes.

If anything looks wrong, jump straight to §4 rollback.

---

## 4. Rollback strategy

Two viable rollbacks. Pick by speed required.

### 4.1 Fastest — Vercel dashboard promote previous deployment

1. Open Vercel project → Deployments tab.
2. Find the last known-good production deployment (commit SHA listed).
3. Click "Promote to Production."
4. Vercel re-routes the production alias to that deployment in seconds.

Pros: under 30 seconds, no git operation, no team coordination.
Cons: git `production` head no longer matches the deployed code. Heal git in step 4.3 below.

### 4.2 Git-native — revert the bad commit on `production`

For a single bad commit:

```bash
git checkout production
git pull --ff-only origin production           # confirm we're at the bad head
git revert --no-edit <bad-sha>                  # creates a clean revert commit
git push origin production                      # triggers a fresh deploy of the revert
git checkout main
```

For multiple bad commits, prefer §4.3 reset over chained reverts.

### 4.3 Git-native — hard reset to a prior known-good SHA

Use this when many recent commits all need to go. **Destructive on the deploy branch; the
reverted commits stay on `main` so nothing is lost — only the production pointer moves.**

```bash
git checkout production
git fetch origin
git reset --hard <known-good-sha>               # production now points at the safe commit
git push --force-with-lease origin production   # triggers redeploy of the safe SHA
git checkout main
```

Use `--force-with-lease`, never raw `--force`. This guards against a teammate's push
sneaking in between your fetch and your push.

After §4.1 or §4.3, the deployed commit will sit behind `main`. The "bad" commits are still
on `main`. Decide:

- Were they bad code? Open a fix PR against `main`, ship the fix, then re-run §2 release flow.
- Were they good code but bad deploy timing? Wait, then re-run §2 to re-land them.

### 4.4 What we never do

- Never `git push --force origin production` without `--with-lease`.
- Never `git push --force origin main` for any reason.
- Never rewrite history on `main` or `production`.
- Never deploy a commit that hasn't been on `main` first.
- Never skip the pre-flight checklist when shipping under time pressure.

---

## 5. When **not** to release

Skip or delay the release if any of these are true:

- Tests are red on `main`.
- Working tree on `main` has uncommitted changes that look related to the cluster.
- VR baselines are stale for the surfaces you're shipping (refresh first or document the
  intentional defer in `_bmad-output/implementation-artifacts/deferred-work.md`).
- A handoff doc for the cluster has not been written yet (per Cluster Closure Protocol in
  `CLAUDE.md`).
- You are within 24 hours of a known partner / community demo and you have not coordinated
  the release window.
- Vercel status page reports a platform incident.

---

## 6. Pre-flight checklist (printable)

Copy this block into the cluster handoff or the PR description before triggering §2:

```
[ ] All cluster commits on local main
[ ] Working tree clean (git status)
[ ] Tests green locally (unit + RTL)
[ ] VR baselines refreshed for affected surfaces (or defer documented)
[ ] No .env / private/ / secrets in the diff
[ ] Handoff doc written for the cluster
[ ] MEMORY.md index entry updated if the cluster introduces lasting context
[ ] Smoke targets identified (which routes / which devices)
[ ] Rollback owner identified (who watches Vercel for the first 10 minutes)
```

---

## 7. History of this process

| Date | Change |
|---|---|
| 2026-06-02 | Initial canonical version written after the v0.6 landing narrative + M1 monetization release. Production branch tracking fixed in the same operation. |

If you change this flow, append a row and update §2 + §4 accordingly. Do not mutate this
file silently — any change to the release flow is a release in itself.
