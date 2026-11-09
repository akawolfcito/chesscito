import { describe, expect, it } from "vitest";

import { resolveCoverageStars } from "@/lib/training/content-stars";

describe("coverage content star accounting", () => {
  it.each([
    ["base Knight's Tour", 8, 12],
    ["premium Knight's Tour", 12, 12],
  ])("awards zero stars for %s", (_label, covered, ceiling) => {
    expect(
      resolveCoverageStars({
        covered,
        ceiling,
        previousBest: 6,
        starless: true,
      }),
    ).toEqual({ awardsStars: false, stars: 0, previousStars: 0 });
  });

  it("keeps the existing coverage grading for non-Tour games", () => {
    expect(
      resolveCoverageStars({
        covered: 10,
        ceiling: 12,
        previousBest: 6,
        starless: false,
      }),
    ).toEqual({ awardsStars: true, stars: 1, previousStars: 0 });
  });
});
