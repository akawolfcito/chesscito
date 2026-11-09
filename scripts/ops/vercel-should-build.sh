#!/usr/bin/env bash
#
# Vercel "Ignored Build Step" — decides whether a commit deserves a build.
#
# Wired into every Vercel project as:
#
#     bash ../../scripts/ops/vercel-should-build.sh <workspace>
#
# (Vercel runs it from the project's Root Directory, hence the ../../.)
#
# ── WHY THIS IS A FILE AND NOT A COMMAND IN THE DASHBOARD ────────────────
#
# The previous setup lived only in Vercel's settings, which means nobody reading
# this repository could see it. That is how `chesscito-landing` carried
# `git diff HEAD^ HEAD --quiet -- .` for months with a defect nobody noticed:
# invisible configuration does not get reviewed. Here it is versioned, it shows
# up in diffs, and it has a test.
#
# ── EXIT CODES (Vercel's contract, and it is backwards from intuition) ───
#
#     exit 0      → CANCEL the build
#     exit non-0  → RUN the build
#
# ── DECISION ORDER ───────────────────────────────────────────────────────
#
#   1. An explicit flag in the commit message wins over everything.
#   2. Otherwise `turbo-ignore` answers "did anything this workspace depends on
#      change since the last SUCCESSFUL deployment?"
#   3. Anything unexpected → BUILD.
#
# ── WHY NOT `git diff HEAD^ HEAD` ────────────────────────────────────────
#
# Because it only looks at the LAST COMMIT of a push. Push a code commit and
# then a docs commit together and Vercel evaluates only the docs one, cancels,
# and the code never ships. Measured against this repo's own history:
#
#     HEAD^..HEAD over b90ee4f6 (docs)  → SKIP  ← ebdc5c1c's hotfix never deploys
#     ebdc5c1c^..b90ee4f6               → BUILD ← correct
#
# `turbo-ignore` compares against `VERCEL_GIT_PREVIOUS_SHA`, the commit of the
# last successful deployment, so a cancelled build does not "lose" the changes
# it skipped — they are still pending against that baseline and the next build
# picks them up. Verified:
#
#     Found previous deployment ("ebdc5c1cc5cc") for "web"
#     --filter="web...[ebdc5c1cc5cc]"  →  Proceeding with deployment
#
# ⚠️ Outside Vercel that variable is unset and turbo-ignore falls back to
# `HEAD^`. Local runs are therefore indicative, not authoritative.
#
# ── FAIL-SAFE ────────────────────────────────────────────────────────────
#
# Every failure path exits non-zero, i.e. BUILDS. A broken guard must never be
# able to leave production without a deploy; the worst it may do is waste one
# build. `set -e` is deliberately NOT used — this script's whole job is to
# inspect exit codes rather than die on them.

set -uo pipefail

# Pinned, per the team convention on third-party tooling. turbo-ignore is
# deprecated upstream in favour of `turbo query affected`, which does NOT exist
# in turbo 1.13.4 (this repo's version) — re-check when turbo goes to 2.x.
TURBO_IGNORE_VERSION="2.10.8"

WORKSPACE="${1:-}"
MESSAGE="${VERCEL_GIT_COMMIT_MESSAGE:-}"

say() { echo "[should-build] $*"; }

# ── 1. Explicit flags ────────────────────────────────────────────────────
#
# Both bracketed and plain spellings are accepted. The plain one exists because
# zsh expands unquoted brackets as globs, and this repo has already been broken
# once by exactly that (`git add` with a bracketed pathspec). `skip-build` is
# safe to type without quotes; `[skip build]` is the industry convention. Take
# whichever you will remember.
if printf '%s' "$MESSAGE" | grep -qiE '(\[skip build\]|\bskip-build\b)'; then
  say "SKIP — explicit flag in the commit message"
  exit 0
fi

if printf '%s' "$MESSAGE" | grep -qiE '(\[force build\]|\bforce-build\b)'; then
  say "BUILD — explicit flag in the commit message"
  exit 1
fi

# ── 2. Guard rails ───────────────────────────────────────────────────────
if [ -z "$WORKSPACE" ]; then
  say "BUILD — no workspace argument given (fail-safe)"
  exit 1
fi

# Escape hatch for the test suite: exercises the flag logic above without a
# network round trip. Never set in Vercel.
if [ -n "${VERCEL_SHOULD_BUILD_DRY_RUN:-}" ]; then
  say "BUILD — dry run, would delegate to turbo-ignore for '$WORKSPACE'"
  exit 1
fi

# ── 3. Delegate ──────────────────────────────────────────────────────────
say "delegating to turbo-ignore for workspace '$WORKSPACE'"
npx --yes "turbo-ignore@${TURBO_IGNORE_VERSION}" "$WORKSPACE"
status=$?

# turbo-ignore's contract matches Vercel's: 0 = ignore, 1 = build. Anything
# else (network failure, bad workspace name, npx could not resolve) is unknown,
# and unknown means BUILD.
if [ "$status" -eq 0 ]; then
  say "SKIP — turbo-ignore reports this workspace is unaffected"
  exit 0
fi

if [ "$status" -ne 1 ]; then
  say "BUILD — turbo-ignore exited $status, treating as unknown (fail-safe)"
  exit 1
fi

say "BUILD — turbo-ignore reports this workspace is affected"
exit 1
