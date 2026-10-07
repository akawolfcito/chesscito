# Deployment topology

Canonical cross-surface deployment guide. Recheck project/domain ownership before a release; local `.vercel` links and historical Git integration checks can refer to retired deployments. Evidence captured on 2026-10-07 while releasing `coach-purge` from `5caad13e569cb6f9dd2275a913285e4fb3c1fea9`.

## Architecture and evidence

| Surface | Production domain | Code / build root | Platform | Project / Worker | Deployment method |
| --- | --- | --- | --- | --- | --- |
| Play | `play.chesscito.com` | `apps/web`; upload repository root for its pnpm workspace | Vercel | **`chesscito-play`**, project `prj_C0CCNCflbhnGsizesTW5yKBTLk3z`, team `team_vOGGEXd4hLuyJsuSDNYlX0uI`, scope **`play-chess`** | Vercel CLI with explicit `--project` and `--scope`; project and production domain verified through authenticated CLI API reads |
| Learn | `learn.chesscito.com` | Shared `apps/web` source; current remote root/settings still require verification with Learn-team access | Vercel | Root `.vercel/project.json`: **`chesscito-learn`**, project `prj_s7BO914NONrXoK4hniM4ARlkncWG`, team `team_P9OVCozI5zSnR4vaI9vWSvC3`; slug not verified | Vercel CLI against the verified Learn project/team; do not deploy using Play credentials or an assumed scope |
| Landing | `www.chesscito.com` | `apps/landing`, Cloudflare/Vinext source on branch `migration/www-cloudflare-production` | Cloudflare | **`chesscito-www-vinext-poc`**; `www.chesscito.com` declared as Worker Custom Domain | `pnpm --filter landing run deploy:vinext --execute`, from repository root on the branch containing the approved wrapper/config |

Play's current project is Next.js, remote `rootDirectory = apps/web`, default framework build/install commands (no overrides), Node `24.x`. Its production `NEXT_PUBLIC_CHESSCITO_MODE` setting exists; encrypted values were not decrypted. Public mode routing was verified after the CLI release: `play.chesscito.com/exercises` returns 307 to `learn.chesscito.com/exercises`, as defined for Play in source. The Learn host's `/arena` similarly redirects to Play. A setting's presence alone does not prove its value.

Learn's name/IDs above are **local configuration evidence**, not a fresh verification of its production alias. The CLI account available during this release could access only team `play-chess`; querying the team in root `.vercel/project.json` returned 403. Do not treat the historical `lite-chesscito` mapping as current without checking.

Landing's Cloudflare identity/config/wrapper were read directly from local branch `migration/www-cloudflare-production`, commit `476f5d22e492a0120ab2f42f2cc2dd30fd402fb5`, and match the operator's report that www runs on Cloudflare. No Cloudflare remote state was queried or changed during this release. The apex `chesscito.com` attachment/redirect is not declared in that Worker config; verify its separate routing before including it in a release scope.

### Repository drift to preserve explicitly

- `main` at the fix SHA does **not** contain the Cloudflare runtime config, build scripts or wrapper. They remain on the Cloudflare production branch. Do not deploy Landing's old Next.js source from `main` as a replacement Worker.
- `scripts/ops/lib/target.ts`, the launch-health runbook and build-skipping runbook retain the former Vercel map: `chesscito` / `lite-chesscito` / `chesscito-landing`, with production Git ref `production`. They describe the older monitor/Git topology and are not deployment selectors for this CLI release.
- `apps/web/.vercel/project.json` points to old project `chesscito` (`prj_ZiblC0AJ0K6Mgz2MOPa1IwBugQoS`, team `team_0dmhnRXlcKWVAYSdAfs9cphe`). It does **not** match live Play. Leave it untouched; do not relink automatically.
- `apps/landing/.vercel/project.json` points to preserved Vercel fallback `chesscito-landing` (`prj_DiR2FO5AJJQgqozSqmGWxdEGm1Lh`, same former team). It is not the www Cloudflare deploy path.
- Root `.vercel/project.json` points to Learn, not Play. Never use a bare `vercel --prod` from root to release a Play-only fix.
- `.vercel/project.json` files are local/ignored, not tracked configuration. This guide records their non-sensitive identities for discoverability without committing those files.
- No Vercel deployment wrapper exists in this `main` checkout or in the inspected Cloudflare branch. The verified Play mechanism is the installed Vercel CLI's explicit project/scope selection.

## Choose affected surfaces

- Play-only features (Arena, Coach, games, Victory UI): deploy Play. Confirm shared helpers do not also affect Learn.
- Learn-only features (exercises, training, Learn progression): deploy Learn after verifying its own project, public mode and alias.
- Landing changes: deploy only the Cloudflare Worker through its approved wrapper and branch. Vercel fallback deployment does not publish www.
- Shared `apps/web` components, public assets, middleware, flags or backend helpers: trace imports/callers and decide whether Play, Learn or both need the new behavior. They have separate builds and environments even though they share source.
- Shared changes to pnpm lockfile or workspace dependencies: evaluate each affected build; do not deploy all surfaces automatically.

### API ownership and `coach-purge`

Play and Learn both build the `apps/web/src/app/api` tree. `NEXT_PUBLIC_CHESSCITO_MODE` changes UI/routing; it does not remove API route files. `apps/web/src/middleware.ts` explicitly excludes `/api` from mode/locale routing. Therefore `/api/...` is not globally owned by Play simply because a feature is shown only there: identify the route's source app and actual caller origin.

Landing has its own `apps/landing/src/app/api` tree, including stats refresh/entry handlers. It does not contain `apps/web/src/app/api/cron/coach-purge/route.ts`.

`coach-purge` is included in **both web builds**. The operational release target for the Coach is Play; validate that the scheduled caller reaches the updated deployment. `.github/workflows/cron-coach-purge.yml` constructs its destination from the repository secret `CRON_URL`; the origin is not versioned or recoverable through the GitHub secrets metadata API. Do not disclose its secret value or presume that successful dispatch alone proves it hit Play. Correlate the new workflow with Play runtime logs; if it reaches another origin, stop and resolve ownership without silently changing secrets or deploying Learn.

## Vercel CLI release

Use the existing project only. No `vercel link`, project creation, team transfer, environment modification or billing change is needed. The installed CLI (58.4.4 in this release) supports `--project` independently of the local link. Git integration is **not** the assumed publication mechanism: a blocked check for an old Vercel project says nothing about readiness of a different CLI deployment.

For an ordinary clean Play checkout, from repository root, after confirming the identities above still own the production alias:

```sh
vercel deploy . --project prj_C0CCNCflbhnGsizesTW5yKBTLk3z --scope play-chess --prod --yes
```

Review upload inventory before executing. The `coach-purge` release used an isolated `git archive` export, containing only tracked code from the exact fix SHA, to exclude local credentials, stale links and unrelated audit changes. The actual release command was:

```sh
vercel deploy /private/tmp/chesscito-coach-purge-release-5caad13e --project prj_C0CCNCflbhnGsizesTW5yKBTLk3z --scope play-chess --prod --yes --no-wait --meta sourceCommit=5caad13e569cb6f9dd2275a913285e4fb3c1fea9 --meta githubCommitSha=5caad13e569cb6f9dd2275a913285e4fb3c1fea9 --meta githubCommitRef=main
```

The temporary path is a release artifact, not a permanent checkout. For a future SHA create a fresh reviewed export; never reuse stale output. Verify route, lockfile, package and Next config bytes against `git show <sha>:<path>`. A metadata SHA alone is an assertion, not proof of uploaded source. Do not pass secrets via CLI arguments or print raw project/environment API responses.

The CLI's `--no-wait` success means upload/create succeeded. Its message can say "ready" while `readyState` is still `INITIALIZING`; require the API state **`READY`** before validation:

```sh
vercel inspect <deployment-url> --scope play-chess
vercel inspect https://play.chesscito.com --scope play-chess
```

Check deployment ID, `target=production`, `projectId`, `readyState`, SHA provenance (`meta.sourceCommit`, `meta.githubCommitSha` or authentic `gitSource.sha`) and the production alias. Both inspections must identify the intended deployment. Filter metadata in memory; never emit environment values. The public build chip derives from `VERCEL_GIT_COMMIT_SHA`; an archive upload may lack automatic Git build variables, so the chip alone cannot certify provenance.

For Learn, use only the project/team actually verified for `learn.chesscito.com`. The root local link supplies candidate IDs, but access, alias, root and public `learn` mode must be established before recording/executing a production command. No tested Learn CLI command or matching team slug was found in the inspected sources; do not invent one.

## Cloudflare release

Existing surface-specific canonical runbook: `docs/runbooks/www-cloudflare-deploy.md` on `migration/www-cloudflare-production` (not yet integrated into `main`). Read it together with `apps/landing/cloudflare.config.ts`, `apps/landing/package.json` and `apps/landing/scripts/deploy-vinext.mjs` from that same reviewed revision. To inspect it without changing branches:

```sh
git show migration/www-cloudflare-production:docs/runbooks/www-cloudflare-deploy.md
```

The source uses `cf/config` and the pinned `cf` CLI, **not a standalone Wrangler config**. The Worker declares `domains: ["www.chesscito.com"]`, no fetch routes, disabled workers.dev/preview URLs and enabled Observability logs. Keep the same Worker and domain attachment.

From repository root in the approved Cloudflare source checkout, the established sequence is:

```sh
pnpm --filter landing run build:vinext
pnpm --filter landing run verify:vinext --release
pnpm --filter landing run deploy:vinext --execute
```

The wrapper requires a clean checkout and verifies source/artifact/public-input digests and topology before invoking pinned `cf deploy --prebuilt --mode production`. Do not use raw `wrangler deploy` or raw `cf deploy --prebuilt`: they bypass the release checks and artifact provenance. Retain the approved public build inputs and existing runtime bindings without displaying or changing credentials. Deployment is a separately authorized action; this guide does not authorize it for unrelated fixes.

## Database ordering

If new code depends on a new RPC/migration, **apply and verify SQL first, then deploy code**. Database application remains a distinct manual checkpoint when requested.

Example: `coach-purge` first requires `20261006000000_coach_purge_batch.sql`, defining `public.purge_expired_coach_analyses()`, integer return, SECURITY INVOKER, execution restricted to `service_role`, and a PostgREST schema reload. Only after that verification deploy the route using the RPC. Publishing the route first can produce `PGRST202`/HTTP 500. Creating the function does not invoke the purge; a successful cron response with `rows_deleted: 0` is valid.

## Reusable checklist

1. Identify affected surfaces, source revision, API callers, current project/Worker and production aliases; resolve stale configuration before upload.
2. Run affected tests and lint; review `git diff --check`. Do not fix unrelated pre-existing failures as part of release.
3. Apply and verify required migrations first, respecting manual checkpoints. Never reapply already confirmed SQL casually.
4. Deploy only affected surfaces through their verified CLI/wrapper; exclude credentials, private data and generated artifacts.
5. Verify deployment READY, production target/alias and code provenance; distinguish upload success from build success.
6. Run minimum product smoke tests, using the correct production host and mobile viewport. Verify actual Coach analysis, not only page loading; report auth/session limitations honestly.
7. Verify relevant crons/endpoints and correlate their destination/runtime logs. For this fix the operator additionally requires cron success **before** the Coach smoke: dispatch `Cron — Coach analyses purge`, inspect `Trigger /api/cron/coach-purge`, HTTP status/count and Redis/Supabase/RPC errors.

Record evidence and unresolved gates in a dated audit; documentation-only commits/pushes do not require a fresh app deployment. Blocked historical Git checks do not invalidate a separately verified CLI release.
