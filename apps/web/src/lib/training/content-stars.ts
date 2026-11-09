import { tourStars } from "@/lib/game/tour-score";

export type CoverageStarResult = {
  awardsStars: boolean;
  stars: number;
  previousStars: number;
};

/** Star accounting for coverage games. Knight's Tour passes `starless: true`,
 *  preserving coverage records while producing no display or ledger stars. */
export function resolveCoverageStars({
  covered,
  ceiling,
  previousBest,
  starless,
}: {
  covered: number;
  ceiling: number;
  previousBest: number | null;
  starless: boolean;
}): CoverageStarResult {
  if (starless) {
    return { awardsStars: false, stars: 0, previousStars: 0 };
  }
  return {
    awardsStars: true,
    stars: tourStars(covered, ceiling),
    previousStars: previousBest === null ? 0 : tourStars(previousBest, ceiling),
  };
}
