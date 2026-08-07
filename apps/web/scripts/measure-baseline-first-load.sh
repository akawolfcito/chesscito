#!/usr/bin/env bash
# Measures the SAME milestones against a past commit, so the "before" number is
# produced by the same instrument as the "after" one.
#
# Why a worktree: the measurement script (`measure-first-load.ts`) does not exist
# at the baseline commit, and checking the repo out in place would take the whole
# working tree hostage for four minutes. A worktree gives that commit its own
# directory; the CURRENT script measures it over HTTP. Same instrument, same
# milestones, same persona, different server.
#
# ⛔ node_modules is SYMLINKED, never re-installed: a fresh `pnpm install` in the
# worktree would resolve today's registry, and a dependency bump would show up as
# a bundle difference this change never made.
#
# Usage: pnpm -C apps/web measure:first-load:baseline [<commit>] [<port>]
set -euo pipefail

COMMIT="${1:-cd380e7f}"
PORT="${2:-3003}"

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$APP_DIR/../.." && pwd)"
WORKTREE="$REPO_ROOT/.tmp/baseline-$COMMIT"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then kill "$SERVER_PID" 2>/dev/null || true; fi
  git -C "$REPO_ROOT" worktree remove --force "$WORKTREE" 2>/dev/null || true
}
trap cleanup EXIT

echo "→ worktree $COMMIT"
git -C "$REPO_ROOT" worktree remove --force "$WORKTREE" 2>/dev/null || true
git -C "$REPO_ROOT" worktree add --detach "$WORKTREE" "$COMMIT" >/dev/null

ln -sfn "$REPO_ROOT/node_modules" "$WORKTREE/node_modules"
ln -sfn "$APP_DIR/node_modules" "$WORKTREE/apps/web/node_modules"

echo "→ production build (this takes a few minutes)"
# NEXT_PUBLIC_CHAIN_ID pinned for the same reason the Playwright config pins it:
# a shell export of Celo Sepolia reconfigures the app under measurement.
(cd "$WORKTREE/apps/web" && NEXT_PUBLIC_CHAIN_ID=42220 pnpm exec next build >/dev/null)

echo "→ next start on :$PORT"
(cd "$WORKTREE/apps/web" && NEXT_PUBLIC_CHAIN_ID=42220 pnpm exec next start -p "$PORT" >/dev/null 2>&1) &
SERVER_PID=$!
until curl -sf -o /dev/null "http://localhost:$PORT/"; do sleep 2; done

echo "→ measuring with the CURRENT script"
(cd "$APP_DIR" && pnpm exec tsx scripts/measure-first-load.ts \
  "--label=baseline-$COMMIT" "--url=http://localhost:$PORT/")
