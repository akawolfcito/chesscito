/**
 * The score-save pair on the ops:health snapshot.
 *
 * ⛔ WHY THIS LINE EXISTS AT ALL. On 2026-08-25 `session_required` stopped being
 * counted as `score_save_failed` and became `score_save_deferred`. Nothing in
 * the repo read the new name — not ops:health, not a dashboard, not a script —
 * so the predicted outcome ("failed drops ~96%, deferred absorbs it") had no
 * observer. What you would actually have seen is a large event vanishing and no
 * place where it reappeared, which is indistinguishable from broken telemetry.
 *
 * ⚠️ `top_events_24h` could not cover it: that block is a top-20, so an event
 * leaves the report exactly when it gets rarer — the direction being measured.
 */
import { describe, expect, it } from "vitest";

import { formatScoreSaves } from "../launch-health-snapshot";

describe("score-save line", () => {
  it("reports BOTH numbers, because either alone is ambiguous", () => {
    const line = formatScoreSaves({
      score_save_failed: 40,
      score_save_deferred: 960,
    });

    // A collapse in `failed` means "the fix worked" or "saves stopped being
    // attempted". Only the second number separates those two.
    expect(line).toContain("fallo=40");
    expect(line).toContain("aplazado=960");
    expect(line).toContain("96%");
  });

  it("treats a missing key as a real zero, not as unknown", () => {
    // Postgres omits a group with no rows, so `deferred` is simply absent until
    // something defers. That is a measured zero and must print as one.
    const line = formatScoreSaves({ score_save_failed: 7 });

    expect(line).toContain("fallo=7");
    expect(line).toContain("aplazado=0");
    expect(line).toContain("0%");
  });

  it("says nothing happened rather than printing a calm-looking 0 · 0", () => {
    // ⚠️ An empty window and a healthy window are different facts. Rendering
    // "fallo=0 · aplazado=0" for a window with no data would read as measured
    // calm, which is the failure mode this whole line exists to avoid.
    for (const empty of [undefined, {}, { score_save_failed: 0 }]) {
      const line = formatScoreSaves(empty);
      expect(line).toContain("sin eventos");
      expect(line).not.toContain("%");
    }
  });

  it("shows the pre-fix shape too, so the BEFORE is legible", () => {
    // What the world looked like on 2026-08-25: everything counted as a failure.
    const line = formatScoreSaves({ score_save_failed: 2_332 });

    expect(line).toContain("aplazado=0");
    expect(line).toContain("0%");
  });
});
