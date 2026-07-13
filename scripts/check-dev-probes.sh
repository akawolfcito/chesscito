#!/usr/bin/env bash
# Drift check for the dev/debug route inventory.
#
# A COUNT is only an alarm: two opposite changes (one route added, one removed)
# keep the count identical while the inventory is already wrong. This does a
# SET DIFF instead — it fails if a route is missing OR extra.
#
# Expected set: docs/testing/dev-probes.expected.txt
# Documented in: memory topic `project_dev_probes_index`
#
# Routes hang off app/dev — NOT app/[locale]/dev. Searching under [locale]
# finds nothing, which is exactly how /dev/reset got reported as nonexistent.

set -euo pipefail
cd "$(dirname "$0")/.."

actual="$(mktemp)"
trap 'rm -f "$actual"' EXIT

{
  git ls-files "apps/web/src/app/dev/**/page.tsx" "apps/web/src/app/lite-debug/**/page.tsx" \
    | sed -E 's#^apps/web/src/app##; s#/page.tsx$##'
  git ls-files "apps/web/src/app/api/dev/**/route.ts" \
    | sed -E 's#^apps/web/src/app##; s#/route.ts$##'
} | sort > "$actual"

pages=$(grep -cv '^/api/dev/' "$actual" || true)
apis=$(grep -c '^/api/dev/' "$actual" || true)

if diff -u docs/testing/dev-probes.expected.txt "$actual"; then
  echo "dev-probes OK — ${pages} pages, ${apis} api routes"
  exit 0
fi

echo ""
echo "DRIFT: the dev/debug route inventory changed."
echo "  '-' = documented but GONE from the repo"
echo "  '+' = in the repo but UNDOCUMENTED"
echo "Update BOTH docs/testing/dev-probes.expected.txt AND the memory topic"
echo "'project_dev_probes_index' (gate, side effects, mirrors-real-screen)."
exit 1
