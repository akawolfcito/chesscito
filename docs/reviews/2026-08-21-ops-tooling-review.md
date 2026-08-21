# Review — the three unpushed ops commits

**Date**: 2026-08-21
**Scope**: `54027222` (ops:backup + GO/NO-GO), `06d5815e` (ops:archive),
`4a71c3d6` (ops:no-token) — 1 832 added lines across 3 scripts + 3 test files.
**Question asked**: is this safe to push?

**Verdict: SAFE TO PUSH.** One real finding, low severity, cheap to fix, and
unrelated to what gets deployed.

---

## Deployment impact: none, and that matters

`scripts/ops/**` is not bundled into any app. The only deployed artefact these
commits touch is the root `package.json`, and only its `scripts` block.

⚠️ That is however exactly what drags **LANDING** into a rebuild despite having
zero changed files — turbo 1.13.4 treats the root `package.json` as a global
input. Measured by bisection:

```
4a71c3d6  BUILD  [package.json]   ops:no-token
06d5815e  BUILD  [package.json]   ops:archive
54027222  BUILD  [package.json]   ops:backup
c51274e7  SKIP   []               docs only
```

A no-op rebuild of identical code. `skip-build` cannot be used to avoid it —
that flag reads the last commit's message and applies to every project, so it
would skip LEARN and PLAY too.

---

## What I checked, and what held

### The most dangerous line in the batch is safe

`backup.ts:220` runs `DROP SCHEMA public CASCADE`. It is scoped to a container
the same function created three lines earlier —
`chesscito-restore-<timestamp>`, vanilla `postgres` image,
`POSTGRES_PASSWORD=throwaway`, `-d restore` — reached by `docker exec`, with no
connection string and no credentials in play. **It cannot address production
even by mistake.** `finally { docker rm -f }` guarantees cleanup, and the
`--rm -d --name` form matches the repo's own Docker convention.

### No production data can reach the repository

- Output roots are `private/backups` and `private/archive`; **both gitignored**.
- `assertUnderBackupRoot()` refuses a write outside the root.
- Tracked files: **0 `.dump`, 0 `.parquet`, 0 `.sql` carrying bulk data.** The
  72 tracked `.sql` files are migrations (46), tests (11), deploy (6) and docs.

### Read-only is enforced at two layers

- `assertNoWrites()` — a write-verb regex on every DuckDB path.
- `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` on every psql path, so
  the *server* refuses a write rather than the caller's intentions.

⚠️ Asymmetry worth knowing: `psql()` relies on the server-side guard only and
does **not** call `assertNoWrites`. That is arguably the stronger of the two —
but it means deleting that one line would leave the path unguarded, where the
DuckDB paths would still refuse.

### The verification actually verifies

- `duckOffline` runs with **`--network none`**: the archive is proven readable
  with no database in reach, which is the whole point of an archive.
- `verifyManifest` compares **in both directions** — missing partitions,
  row-count mismatches, `min_ts`/`max_ts` drift, *and* partitions present in the
  archive but absent from the manifest.
- The restore check reads **stderr** (`2>&1`), with a comment recording that the
  first version reported PASS over a restore that had logged 9 errors.
- Missing-role errors are filtered, narrowly and with justification: Supabase's
  roles do not exist in a vanilla container, which is a property of the target,
  not a defect of the dump.

### The backup/archive split is coherent

`backup.ts` excludes `analytics_events` and **declares that exclusion in the
manifest**; `archive.ts` owns that history, exporting it to partitioned Parquet
and verifying it offline. The two together cover the database — which is what
the GO/NO-GO for a Supabase Free downgrade rests on. No gap found.

### The tests are real and they run

`apps/web/vitest.config.ts` explicitly includes
`../../scripts/ops/**/__tests__/**/*.test.ts`. Measured: **14 files, 432 tests,
green** — and inside the 712-file suite already reported for this branch.

---

## ⚠️ FINDING — credentials travel in the `docker run` command line

`archive.ts:300` and `archive.ts:329` (and the same shape in the other scripts):

```ts
"-e", `PGPASSWORD=${creds.password}`
"-e", `PGCONN=${conn}`          // conn embeds the password
```

Those are **argv of the host `docker` process**, so the password is visible in
`ps aux` to any local user for the duration of the call, and can surface in
process-level diagnostics.

The module header states *"the password rides in the child process env"*. That
is true of the container — but it got there through the host's command line,
which is the exposure the sentence reads as ruling out.

**Severity: LOW.** Single-user developer machine, short-lived processes,
`execFileSync` (no shell, so nothing lands in shell history), and `--rm` removes
the container afterwards. It is a gap between a stated invariant and the
behaviour, not an open door.

**Fix (cheap, ~4 call sites):** pass the variable by NAME so Docker inherits it,
and put the value in `execFileSync`'s `env`:

```ts
execFileSync("docker", ["run", "--rm", "-e", "PGPASSWORD", …], {
  env: { ...process.env, PGPASSWORD: creds.password },
});
```

The value then never appears in any argv.

---

## Not findings, recorded so they are not re-litigated

- `redactSecrets()` exists and scrubs both the password and `password=` query
  forms before anything is printed.
- `resolveAllRange` uses a **half-open** range and documents the off-by-one that
  would silently drop the last day — *"the loss would look exactly like a quiet
  day"*. It also normalises Postgres's `+00` offset, which `Date` rejects.
- Every `docker run` uses `--rm`, per CLAUDE.md.

---

## ✅ FIXED before the push (founder's call)

### It was six places, not three

The same pattern was in three **already-pushed** scripts —
`collectors/supabase.ts`, `verify-stats-rpcs.ts`, `read-only-query.ts` — each
carrying the same false comment. `verify-stats-rpcs.ts` spelled out the exact
threat, *"argv is visible in `ps` on the host, container env is not"*, directly
above the line that created it.

⚠️ **The intent was right in all six and the code was wrong in all six.** Fixing
only the three new ones would have left the invariant false repo-wide, so all
six were changed.

### The fix

`scripts/ops/lib/child-env.ts` — one helper, one documented rule:

```ts
"-e", "PGCONN",                              // name only, never NAME=value
env: childEnv({ PGCONN: conn })              // the value goes here
```

**Verified functionally, not just by reading**: a probe ran the exact new shape
against a real container and the value arrived intact (24/24 bytes) while never
appearing in the docker argv. Without that check, a fix that silently delivered
an empty variable would have broken all six tools at once, and only against
production.

### The exception, deliberately narrow

`POSTGRES_PASSWORD=throwaway` and `POSTGRES_DB=restore` on the disposable
restore container stay inline. A **plain literal** leaks nothing that cloning
this public repository does not already give you; only INTERPOLATED and
CONCATENATED values carry something the source does not show. The guard was
first written too strictly, flagged exactly these two, and was narrowed — the
distinction is the point, not a concession.

### The guard

`scripts/ops/__tests__/child-env.test.ts` scans all six scripts, asserts the
pattern itself against both what it must catch and what it must allow, and
fails if a **new** script starts running `psql`/`pg_dump` in Docker without
joining the list. A convention is what produced this defect; a test is what
replaces it.

**After the fix**: ops suite 15 files / 453 tests green; full suite
**713 files · 9045 passed · 1 todo** in 160 s; tsc clean. Nothing under `apps/`
was touched.

---

## Recommendation

**Push.** The batch was already safe; the one finding is now closed, in its own
commit, with a regression guard and a functional check behind it.
