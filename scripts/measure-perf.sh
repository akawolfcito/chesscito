#!/usr/bin/env bash

set -euo pipefail

readonly DEFAULT_RUNS=3
readonly DEFAULT_THRESHOLD=80
readonly BASELINE_PATH="apps/web/lh-prod"
readonly ROUTES=("/" "/exercises" "/arena")
readonly DEFAULT_BASES=("https://lite.chesscito.com" "https://play.chesscito.com")

usage() {
  cat <<'EOF'
Usage: scripts/measure-perf.sh [--base URL] [--url URL] [--runs N] [--out FILE] [--threshold N]
EOF
}

die() {
  echo "Error: $*" >&2
  exit 1
}

require_value() {
  local option="$1"
  local value="${2:-}"

  [[ -n "$value" && "$value" != --* ]] || die "$option requires a value."
}

normalize_base() {
  local base="$1"
  printf '%s' "${base%/}"
}

base_label() {
  local base="$1"
  local authority="${base#*://}"
  authority="${authority%%/*}"
  authority="${authority%%:*}"
  authority="${authority#www.}"
  printf '%s' "${authority%%.*}"
}

url_path() {
  local url="$1"
  local remainder="${url#*://}"

  if [[ "$remainder" == */* ]]; then
    remainder="/${remainder#*/}"
    remainder="${remainder%%\?*}"
    remainder="${remainder%%\#*}"
    printf '%s' "${remainder:-/}"
  else
    printf '/'
  fi
}

slugify() {
  local value="$1"
  value=$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]' | tr -cs '[:alnum:]' '-')
  value="${value#-}"
  value="${value%-}"
  printf '%s' "${value:-url}"
}

chrome_available() {
  local candidate

  if [[ -n "${CHROME_PATH:-}" ]]; then
    [[ -x "$CHROME_PATH" ]]
    return
  fi

  for candidate in google-chrome-stable google-chrome chromium chromium-browser chrome; do
    if command -v "$candidate" >/dev/null 2>&1; then
      return 0
    fi
  done

  for candidate in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "${HOME:-}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "${HOME:-}/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "/opt/google/chrome/chrome"; do
    if [[ -x "$candidate" ]]; then
      return 0
    fi
  done

  return 1
}

base=""
exact_url=""
runs="$DEFAULT_RUNS"
threshold="$DEFAULT_THRESHOLD"
out=""
out_was_passed=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      require_value "$1" "${2:-}"
      base="$2"
      shift 2
      ;;
    --url)
      require_value "$1" "${2:-}"
      exact_url="$2"
      shift 2
      ;;
    --runs)
      require_value "$1" "${2:-}"
      runs="$2"
      shift 2
      ;;
    --out)
      require_value "$1" "${2:-}"
      out="$2"
      out_was_passed=true
      shift 2
      ;;
    --threshold)
      require_value "$1" "${2:-}"
      threshold="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      die "unknown option: $1"
      ;;
  esac
done

[[ "$runs" =~ ^[1-9][0-9]*$ ]] || die "--runs must be a positive integer."
[[ "$threshold" =~ ^[0-9]+$ ]] || die "--threshold must be an integer from 0 to 100."
(( threshold <= 100 )) || die "--threshold must be an integer from 0 to 100."

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(cd "$script_dir/.." && pwd -P)
[[ "$(pwd -P)" == "$repo_root" ]] || die "run this script from the repository root."

if ! command -v lighthouse >/dev/null 2>&1; then
  echo "Install: npm i -g lighthouse" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Install: brew install jq" >&2
  exit 1
fi

chrome_available || die "Chrome or Chromium was not found. Set CHROME_PATH to its executable."

if [[ -z "$out" ]]; then
  out="docs/audits/$(date +%Y-%m-%d)-lh-chesscito-perf.json"
fi

if [[ "$out_was_passed" == false && -e "$out" ]]; then
  out="docs/audits/$(date +%Y-%m-%d-%H%M%S)-lh-chesscito-perf.json"
  [[ ! -e "$out" ]] || die "default timestamped output already exists: $out"
fi

mkdir -p "$(dirname "$out")"

tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/chesscito-lighthouse.XXXXXX")
trap 'rm -rf "$tmp_dir"' EXIT INT TERM

declare -a urls=()
declare -a labels=()

add_base_targets() {
  local target_base
  local label
  local route

  target_base=$(normalize_base "$1")
  [[ "$target_base" =~ ^https?://[^/]+$ ]] || die "invalid base URL: $1"
  label=$(base_label "$target_base")

  for route in "${ROUTES[@]}"; do
    urls+=("${target_base}${route}")
    labels+=("$label $route")
  done
}

if [[ -n "$exact_url" ]]; then
  [[ "$exact_url" =~ ^https?://[^[:space:]]+$ ]] || die "invalid URL: $exact_url"
  urls+=("$exact_url")
  labels+=("$(base_label "$exact_url") $(url_path "$exact_url")")
elif [[ -n "$base" ]]; then
  add_base_targets "$base"
else
  for base in "${DEFAULT_BASES[@]}"; do
    add_base_targets "$base"
  done
fi

baseline_found=false
baseline_note="Baseline not found; comparison skipped."
if [[ -e "$BASELINE_PATH" ]]; then
  baseline_found=true
  baseline_note="Previous known prod score: 72 performance"
  echo "Baseline: $BASELINE_PATH found. Previous known Perf: 72."
else
  echo "Baseline: $BASELINE_PATH not found. Skipping baseline comparison."
fi

results_file="$tmp_dir/results.ndjson"
failing_file="$tmp_dir/failing.ndjson"
: > "$results_file"
: > "$failing_file"

for ((url_index = 0; url_index < ${#urls[@]}; url_index++)); do
  current_url="${urls[$url_index]}"
  current_label="${labels[$url_index]}"
  safe_slug=$(slugify "$current_url")
  run_records="$tmp_dir/${url_index}-${safe_slug}-runs.ndjson"
  : > "$run_records"

  for ((run = 1; run <= runs; run++)); do
    raw_report="$tmp_dir/${url_index}-${safe_slug}-run-${run}.json"
    echo "Running Lighthouse ($run/$runs): $current_url" >&2

    if ! lighthouse "$current_url" \
      --output=json \
      --output-path="$raw_report" \
      --preset=perf \
      --only-categories=performance,accessibility,best-practices,seo \
      --form-factor=mobile \
      --screenEmulation.width=390 \
      --screenEmulation.height=844 \
      --screenEmulation.mobile=true \
      --screenEmulation.deviceScaleFactor=3 \
      --throttling-method=simulate \
      --chrome-flags="--headless --no-sandbox"; then
      echo "Error: Lighthouse failed for $current_url (run $run)." >&2
      exit 1
    fi

    jq -ce --argjson run "$run" '
      def required_number($name; $value):
        if ($value | type) == "number" then $value
        else error("missing numeric Lighthouse field: " + $name)
        end;
      def score($name; $value): (required_number($name; $value) * 100 | round);
      {
        run: $run,
        performance: score("categories.performance.score"; .categories.performance.score),
        accessibility: score("categories.accessibility.score"; .categories.accessibility.score),
        bestPractices: score("categories.best-practices.score"; .categories["best-practices"].score),
        seo: score("categories.seo.score"; .categories.seo.score),
        lcpSeconds: ((required_number("audits.largest-contentful-paint.numericValue"; .audits["largest-contentful-paint"].numericValue) / 1000 * 100 | round) / 100),
        tbtMs: (required_number("audits.total-blocking-time.numericValue"; .audits["total-blocking-time"].numericValue) | round),
        cls: ((required_number("audits.cumulative-layout-shift.numericValue"; .audits["cumulative-layout-shift"].numericValue) * 1000 | round) / 1000)
      }
    ' "$raw_report" >> "$run_records"
  done

  result=$(jq -cn \
    --arg label "$current_label" \
    --arg url "$current_url" \
    --slurpfile runs "$run_records" '
      def median:
        sort as $values
        | ($values | length) as $count
        | if ($count % 2) == 1 then $values[($count / 2 | floor)]
          else (($values[$count / 2 - 1] + $values[$count / 2]) / 2)
          end;
      {
        label: $label,
        url: $url,
        median: {
          performance: ([$runs[].performance] | median),
          accessibility: ([$runs[].accessibility] | median),
          bestPractices: ([$runs[].bestPractices] | median),
          seo: ([$runs[].seo] | median),
          lcpSeconds: ([$runs[].lcpSeconds] | median),
          tbtMs: ([$runs[].tbtMs] | median),
          cls: ([$runs[].cls] | median)
        },
        runs: $runs
      }
    ')

  printf '%s\n' "$result" >> "$results_file"

  if jq -e --argjson threshold "$threshold" '.median.performance < $threshold' >/dev/null <<< "$result"; then
    jq -cn \
      --arg url "$current_url" \
      --argjson performance "$(jq '.median.performance' <<< "$result")" \
      '{url: $url, performance: $performance}' >> "$failing_file"
  fi
done

status="pass"
if [[ -s "$failing_file" ]]; then
  status="fail"
fi

generated_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
final_tmp="$tmp_dir/final.json"
jq -n \
  --arg generatedAt "$generated_at" \
  --argjson runsPerUrl "$runs" \
  --argjson threshold "$threshold" \
  --arg baselinePath "$BASELINE_PATH" \
  --argjson baselineFound "$baseline_found" \
  --arg baselineNote "$baseline_note" \
  --arg status "$status" \
  --slurpfile results "$results_file" \
  --slurpfile failingRoutes "$failing_file" '
    {
      generatedAt: $generatedAt,
      tool: "lighthouse",
      runsPerUrl: $runsPerUrl,
      threshold: $threshold,
      viewport: {
        width: 390,
        height: 844,
        formFactor: "mobile",
        throttlingMethod: "simulate"
      },
      baseline: {
        path: $baselinePath,
        found: $baselineFound,
        note: $baselineNote
      },
      results: $results,
      status: $status,
      failingRoutes: $failingRoutes
    }
  ' > "$final_tmp"
mv "$final_tmp" "$out"

printf '\n%-43s| %6s | %6s | %4s | %5s | %8s | %9s | %5s\n' \
  "Route" "Perf" "A11y" "BP" "SEO" "LCP(s)" "TBT(ms)" "CLS"
printf '%s\n' '-------------------------------------------|--------|--------|------|-------|----------|-----------|-------'

while IFS= read -r result; do
  printf '%-43s| %6s | %6s | %4s | %5s | %8.2f | %9s | %5.3f\n' \
    "$(jq -r '.label' <<< "$result")" \
    "$(jq -r '.median.performance' <<< "$result")" \
    "$(jq -r '.median.accessibility' <<< "$result")" \
    "$(jq -r '.median.bestPractices' <<< "$result")" \
    "$(jq -r '.median.seo' <<< "$result")" \
    "$(jq -r '.median.lcpSeconds' <<< "$result")" \
    "$(jq -r '.median.tbtMs' <<< "$result")" \
    "$(jq -r '.median.cls' <<< "$result")"
done < "$results_file"

printf '\nThreshold: Perf >= %s\n' "$threshold"
printf 'Status: %s\n' "$(printf '%s' "$status" | tr '[:lower:]' '[:upper:]')"

if [[ "$status" == "fail" ]]; then
  echo "Failing routes:"
  while IFS= read -r failure; do
    printf -- '- %s: Perf %s\n' \
      "$(jq -r '.url' <<< "$failure")" \
      "$(jq -r '.performance' <<< "$failure")"
  done < "$failing_file"
fi

echo "Output: $out"

[[ "$status" == "pass" ]]
