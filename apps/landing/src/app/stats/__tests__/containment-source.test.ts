import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(join(process.cwd(), "src/app/stats/page.tsx"), "utf8");

describe("public stats containment", () => {
  it("does not import or invoke the Supabase aggregators", () => {
    expect(page).not.toMatch(/getPublicStats|loadStatsSnapshot|loadPlayersCensus|readPlayersCensus/);
    expect(page).toContain("readPersistedStatsSnapshot");
  });

  it("ignores filter query strings and uses only all/all", () => {
    expect(page).toContain("const filters = DEFAULT_STATS_FILTERS");
  });
});
