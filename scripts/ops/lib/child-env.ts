/**
 * Hand a secret to a child process WITHOUT putting it on a command line.
 *
 * ⛔ THE RULE: `docker run -e NAME` (name only), never `-e NAME=${value}`.
 *
 * `-e NAME=value` is an argument of the HOST `docker` process, and arguments
 * are world-readable in the process table: any local user running `ps aux`
 * while the command is in flight sees the password, or the whole connection
 * string with the password inside it. `-e NAME` tells Docker to forward the
 * variable it already holds, so the value travels through the environment —
 * visible only to the process itself and to root.
 *
 * ⚠️ THIS WAS A REAL GAP BETWEEN A COMMENT AND THE CODE, in six places at once.
 * Every one of these scripts carried a note promising the connection string
 * "never travels in argv" while `-e NAME=${conn}` put it exactly there;
 * `verify-stats-rpcs.ts` even spelled out the threat — *"argv is visible in
 * `ps` on the host"* — directly above the line that created it. The intent was
 * right everywhere and the code was wrong everywhere, which is what a
 * convention buys you and why `__tests__/child-env.test.ts` now scans for it.
 * Found in review 2026-08-21, before the new tooling shipped.
 *
 * ⚠️ NOT a complete fix for every channel, and it should not be sold as one:
 * `execFileSync` already avoids the shell (nothing reaches shell history) and
 * `--rm` disposes of the container, but a value in the environment is still
 * readable through `/proc/<pid>/environ` as root and can land in a core dump.
 * What this closes is the cheap channel — another local user, or a screenshot
 * of `ps`.
 *
 * ⚠️ THE EXCEPTION, deliberately narrow: an inline `-e NAME=value` whose value
 * is a PLAIN LITERAL is fine, because a literal is already readable in this
 * public repository — `POSTGRES_PASSWORD=throwaway` on the disposable restore
 * container leaks nothing that `git clone` does not. The guard therefore flags
 * INTERPOLATED and CONCATENATED values, which are the ones that carry something
 * the source does not already show.
 */

/**
 * The current environment plus `extra`, for `execFileSync`'s `env` option.
 *
 * Pass the SAME names to `docker run -e`, without values.
 */
export function childEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  return { ...process.env, ...extra };
}
