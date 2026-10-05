# Original infrastructure worktree curation — 2026-10-05

Reviewed original branch `migration/www-vinext-poc` and every listed dirty/untracked item. Main and origin/main both resolve to `2d282139981d71e8c51ed26860ad22793a9cb517`, including `fdfe9e47` and `15857d13`. The clean candidate is `docs/curated-infrastructure-audits` in `/private/tmp/chesscito-infra-curation`; no PoC commit was cherry-picked. This is a local Git comparison, not a fresh remote fetch or live infrastructure inventory.

The operator reports www, Play and Learn stable. This task does not reproduce production measurements, run a refresh, apply SQL, modify remote configuration or change secret values.

## File-by-file decisions

All paths are repository-relative. KEEP_AND_VERSION audits receive an archive banner and trailing-whitespace normalization; their historical findings are retained.

| Original item | Classification | Reason and disposition |
| --- | --- | --- |
| `.gitignore` modification | KEEP_AND_VERSION, revised | Intentional dotenv protection. Original bare `.env*` also hides new safe templates/examples. Candidate adds that pattern with `!.env.template` and `!.env.example`; tracked files are unaffected. No env contents were opened. |
| `.vercelignore` | KEEP_BUT_DO_NOT_MERGE_YET | Broad upload-hardening proposal, not proven necessary for current Play/Learn builds. Duplicates many ignore rules and includes duplicate dotenv/dependency rules; excludes every dotenv variant, templates/examples, tool directories and build/artifact paths. Preserve for a separate packaging/security review; do not implicitly change stable Vercel uploads or rollback behavior. Not a required Cloudflare source file. |
| `apps/web/scripts/db/__tests__/bounded-analytics-retention-migration.test.ts` | KEEP_BUT_DO_NOT_MERGE_YET | Eight useful static guards paired with the blocked prototype SQL; tests require that migration path. Passing string assertions cannot prove production timeout safety. Keep with experimental work, outside this merge candidate. |
| `apps/web/scripts/db/test-analytics-retention-bounded.mjs` | KEEP_BUT_DO_NOT_MERGE_YET | Destructive scratch-only integration harness: inserts/deletes synthetic fixtures, takes locks, creates triggers/schema and cleans ledger rows. Hardcoded container/refusal checks reduce risk, but it does not test an accepted per-batch statement timeout and needs its paired fixtures/migration. Do not run against data-bearing state. |
| `apps/web/supabase/migrations/20260929000000_bounded_analytics_events_retention.sql` | KEEP_BUT_DO_NOT_MERGE_YET | Explicit NOT READY prototype. Guard throws when pg_cron exists because per-batch statement_timeout is unresolved. Self-committing CALL has row caps/advisory lock/ledger but weekly mode uses zero wall budget; it must not enter the production migration queue. Existing main implementation review already records the blocker. |
| `apps/web/supabase/tests/retention-scratch/` | KEEP_BUT_DO_NOT_MERGE_YET | Only two authored synthetic source fixtures found; no data dumps, logs, generated artifacts or credentials. The name alone does not make it disposable. Keep with the experimental harness, not in candidate. |
| `apps/web/supabase/tests/retention-scratch/bootstrap.sql` | KEEP_BUT_DO_NOT_MERGE_YET | Synthetic analytics schema/roles/index and no-op legacy function, used to reproduce the isolated experiment. It is useful paired source, not production schema. |
| `apps/web/supabase/tests/retention-scratch/supabase/config.toml` | KEEP_BUT_DO_NOT_MERGE_YET | Dedicated local project identity/ports and disabled services/migrations/seeds. Needed to isolate the harness from the real local web stack; no credentials or runtime data. |
| `docs/audits/2026-09-30-public-stats-investigation.md` | KEEP_AND_VERSION | Unique publication/lease architecture, metric null-versus-zero semantics, omitted RPC costs and measured-evidence boundaries. Refresh status/remediation are historical, not current instructions. Not present on main. |
| `docs/audits/2026-09-30-stats-refresh-reliability-followup.md` | KEEP_AND_VERSION | Distinct later snapshot observation (54-hour stale snapshot, actual zero metrics with a nonzero cohort), telemetry bundle evidence and access limitations. Complements rather than duplicates the investigation; banner prevents stale cron/auth conclusions being treated as current. Not present on main. |
| `docs/audits/2026-10-02-production-incident-diagnosis.md` | KEEP_AND_VERSION | Unique bounded incident evidence separating transport/static-resource failure from backend health. Supabase incident and Vercel deployment state describe the capture only. Not present on main. |
| `docs/audits/2026-10-02-production-performance-diagnosis.md` | KEEP_AND_VERSION | Detailed stage timings, path comparison, completed-sample survivor bias and simulated MiniPay browser limitations extend the shorter incident report. Historical diagnostic addresses are not DNS recommendations. Not present on main. |
| `docs/audits/2026-10-03-cloudflare-vinext-free-tier-discovery.md` | KEEP_AND_VERSION | Historical route/dependency/runtime inventory and distinction between hosting cost and total infrastructure cost remain useful. Migration ordering, framework pins and platform limits are dated assumptions, not present deployment state or current pricing. Not present on main. |
| `docs/audits/2026-10-04-play-learn-env-audit.md` | KEEP_AND_VERSION | Extensive names-only reader/reachability/timing and ownership evidence, including public/private boundaries and callable shared APIs. Counts and source line references describe 78c599ca, not a live inventory; later supplied operational lists differ within the document. Archive label prevents its old decisions being applied blindly. Not present on main. |
| `docs/audits/2026-10-05-www-cloudflare-productionization.md` | DUPLICATE / SUPERSEDED | Original 227-line read-only plan is the historical base of the expanded committed report on migration/www-cloudflare-production. That branch also carries topology verification, Observability preservation and the runbook. Copying the old file would restore obsolete missing-domain/secret/Spanish-lang blockers and conflict at later integration. Exclude this old copy entirely. |

## Exact preservation and exclusions

Candidate changes are the revised root `.gitignore`, the six KEEP_AND_VERSION audit paths above, and this new review. No package, lockfile, application, migration, workflow, deployment config or runtime artifact is copied from the PoC. Main's deployed cron fixes remain intact.

Excluded: `.vercelignore`; all three retention migration/test/harness paths; both source fixtures under retention-scratch; the superseded original productionization report. The expanded production report/runbook remain on their production branch and must accompany that separately reviewed migration integration, not be replaced by this old report.

## Retention readiness

Main already contains `docs/audits/2026-09-28-bounded-analytics-retention-implementation.md`, explicitly NOT READY and describing the same statement-timeout blocker. The proposed SQL guards against pg_cron before DDL, so committing it to main's migration queue could block future migration application, even though it avoids unsafe scheduling. The runner only exercises a dedicated scratch container with no expired pre-existing rows; it creates/deletes fixtures and cannot be executed under this task's no-state-change scope. A new design must address caller-side timeout/transaction orchestration and safe rollout before these files are merge candidates. Static test success or historical scratch results do not change that conclusion.

## Ignore review and validation

`.env*` has no slash and matches dotenv basenames at any depth. New templates/examples need explicit exceptions. Validation uses hypothetical paths with `git check-ignore --no-index`; no real dotenv file is read. Ignored test cases cover root/per-app dotenv variants; allowed cases cover exact safe template/example names. Template files must still be reviewed for safe content before staging; an exception is not permission to commit credentials.

The Vercel upload proposal requires a separate local packaging/build review to establish which files are required and whether matching exclusions already exist. This curation does not change Vercel upload rules or assert that existing rules protect every credential directory.

Documentation checks: six copied bodies match their source after banner insertion/trailing-whitespace normalization; none already exists on main. Credential-pattern, credential-in-URL, contact and wallet-address scans of the copied reports found no matches. Review verified names-only environment tables, aggregate rather than personal evidence, date/source boundaries and existing Markdown structure. New archive links resolve. `git diff --check` and staged path review pass. Existing historical source/file references may be absent or moved; retained as evidence, not current runnable commands. No app tests/build or SQL execution is needed for the documentation/ignore-only candidate; no code/migration was preserved in it.

## Old worktree cleanup recommendation

No old file was deleted or restored during curation. The original worktree deliberately remains dirty until the operator chooses cleanup. After accepting/verifying the curated commit, the six copied untracked audit originals can be removed, and the superseded productionization copy can be removed after confirming the newer report is retained on the production branch. The old `.gitignore` edit can be restored to its branch version; the corrected rule is saved in this candidate.

Do not delete the retention source files or `.vercelignore` merely to make status clean: first park them together in a dedicated NOT-READY experimental/proposal branch or a secure local source archive. Preserve the two scratch fixtures with the harness. No scratch runtime data was found in this directory; no container/volume cleanup is authorized or required. Do not stash unrelated secrets or use blanket `git clean -fd` / `git reset --hard`.

After main review, the recommended local merge is `git switch main` then `git merge --ff-only docs/curated-infrastructure-audits`, executed from a clean main worktree. If main advances, rebase/review this documentation-only branch and rerun the checks first. No push or merge is performed by this task.
