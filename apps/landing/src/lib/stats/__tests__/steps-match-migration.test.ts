/**
 * The label map must cover the step literals the MIGRATION actually emits.
 *
 * 🔬 This guard exists because it caught a real defect. The access funnel's
 * first checkpoint is `gate_viewed`, but `web_access_gate_viewed` — the raw
 * analytics event the SQL selects its cohort FROM — is the name everyone,
 * including the spec, reaches for. Mapping only the event name rendered
 * "Unknown step" on the first row of a public page, and every unit test passed
 * because they all asserted against the same wrong list.
 *
 * The only cure is reading the source of truth. This test parses the migration
 * and fails if a literal has no label — including one added later.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { STATS_LOCALES } from "../locale";
import { STEP_LABELS, UNKNOWN_STEP_LABEL, stepLabel } from "../step-labels";

// vitest runs with the package root as cwd (apps/landing).
const MIGRATION = join(
  process.cwd(),
  "../web/supabase/migrations/20260805000000_stats_aggregation_rpcs.sql",
);

/** The `select <n>, '<literal>',` rows inside the two `steps as (...)` CTEs. */
function emittedSteps(sql: string): string[] {
  const out = new Set<string>();
  for (const block of sql.split(/\bsteps as \(/).slice(1)) {
    const body = block.split(/\n\s*\)\s*\n/)[0];
    for (const m of body.matchAll(/select\s+\d+(?:\s+as\s+ord)?,\s*'([a-z_]+)'/g)) {
      out.add(m[1]);
    }
  }
  return [...out].sort();
}

describe("step labels vs the migration", () => {
  const found = existsSync(MIGRATION);

  it("can read the migration it validates against", () => {
    // Without this, a moved file would turn every assertion below into a
    // vacuous pass over an empty list.
    expect(found, `migration not found at ${MIGRATION}`).toBe(true);
  });

  const sql = found ? readFileSync(MIGRATION, "utf8") : "";
  const steps = found ? emittedSteps(sql) : [];

  it("parses a plausible number of step literals", () => {
    expect(steps.length).toBeGreaterThanOrEqual(10);
  });

  it("includes the two first-step literals that differ from their event names", () => {
    expect(steps).toContain("app_opened");
    expect(steps).toContain("gate_viewed");
  });

  it("every literal the SQL emits has a label in EVERY language", () => {
    for (const locale of STATS_LOCALES) {
      const unlabelled = steps.filter(
        (s) => stepLabel(s, locale) === UNKNOWN_STEP_LABEL[locale],
      );
      expect(unlabelled, `unlabelled in ${locale}`).toEqual([]);
    }
  });

  it("the label map has no key the SQL never emits, except the documented alias", () => {
    // Dead entries rot. `web_access_gate_viewed` is kept on purpose as the
    // event-name alias, so it is the one allowed extra.
    const mapped = Object.keys(STEP_LABELS.en);
    const extra = mapped.filter((k) => !steps.includes(k));
    expect(extra).toEqual(["web_access_gate_viewed"]);
  });
});
