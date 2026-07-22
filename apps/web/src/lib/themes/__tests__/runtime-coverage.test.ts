import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("theme runtime catalog coverage", () => {
  it("keeps every active catalog slot on the resolver", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/audit-theme-runtime-coverage.mjs", "--check"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(result.status, result.stderr || result.stdout).toBe(0);

    const report = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "../../docs/audits/2026-07-18-theme-runtime-inventory.json"),
        "utf8",
      ),
    );
    // The audit scopes itself to slots the web app owns. The landing.* slots
    // render in apps/landing, so they are excluded here and covered by
    // landing-assets.test.ts instead.
    expect(report.totalSlots).toBe(162);
    expect(report.initialCategoryCounts).toEqual({
      A: 2,
      B: 66,
      C: 26,
      D: 38,
      E: 19,
      F: 11,
      G: 0,
    });
    expect(report.connectedSlots).toBe(150);
    expect(report.excludedSlots).toBe(12);
    expect(
      report.slots.filter(
        (slot: { category: string; currentConsumerState: string }) =>
          slot.category !== "F" && slot.currentConsumerState !== "resolver",
      ),
    ).toEqual([]);
    // Empty on purpose: an "exception" is an asset nobody can replace from
    // the builder. All three former ones are registered slots now.
    expect(report.exceptions).toEqual([]);
    // No `/art/...` literal in the source resolves to a real file that no
    // slot declares — the catalog covers the web app with nothing left over.
    expect(report.literalDiff.unregisteredExistingAssets).toEqual([]);
  }, 20_000);
});
