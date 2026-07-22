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
    expect(report.totalSlots).toBe(160);
    expect(report.initialCategoryCounts).toEqual({
      A: 2,
      B: 64,
      C: 26,
      D: 38,
      E: 19,
      F: 11,
      G: 0,
    });
    expect(report.connectedSlots).toBe(149);
    expect(report.excludedSlots).toBe(11);
    expect(
      report.slots.filter(
        (slot: { category: string; currentConsumerState: string }) =>
          slot.category !== "F" && slot.currentConsumerState !== "resolver",
      ),
    ).toEqual([]);
    // mara-avatar left this list by being cataloged as arena.rival-mara —
    // an "exception" is an asset nobody can replace from the builder.
    expect(report.exceptions).toEqual([
      expect.objectContaining({ basename: "/art/redesign/icons/close", detected: false }),
      expect.objectContaining({ basename: "/art/shop/pro" }),
    ]);
  }, 20_000);
});
