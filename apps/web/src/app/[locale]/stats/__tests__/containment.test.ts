import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("web stats containment", () => {
  it("redirects instead of importing the old heavy aggregator", () => {
    const source = readFileSync(join(process.cwd(), "src/app/[locale]/stats/page.tsx"), "utf8");
    expect(source).toContain("redirect(");
    expect(source).not.toMatch(/getPublicStats|public-aggregator|loadPlayersCensus|unstable_cache/);
  });
});
