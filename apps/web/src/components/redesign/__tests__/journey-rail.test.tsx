import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test-utils/render-with-intl";
import { JourneyRail } from "@/components/redesign/journey-rail";

describe("<JourneyRail> — grayscale-to-color milestone icons (D4)", () => {
  it("pending tiers keep their real icon in the pending (grayscale) treatment", () => {
    const { container } = renderWithIntl(
      <JourneyRail currentPiece="rook" currentStars={0} claimedBadges={{}} />,
    );

    // No tier swaps to a generic lock glyph anymore — the icon itself
    // carries the milestone identity, color carries the completion.
    expect(container.querySelector('img[src*="lock.png"]')).toBeNull();
    expect(container.querySelector('img[src*="trophy.png"]')).not.toBeNull();
    expect(container.querySelector('img[src*="crown.png"]')).not.toBeNull();
    expect(
      container.querySelectorAll(".journey-row-icon--pending").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("completed tiers drop the pending treatment (full color)", () => {
    const { container } = renderWithIntl(
      <JourneyRail
        currentPiece="rook"
        currentStars={15}
        claimedBadges={{ rook: true }}
      />,
    );

    const rows = container.querySelectorAll(".journey-row");
    const doneRow = Array.from(rows).find(
      (row) => row.getAttribute("data-status") === "done",
    );
    expect(doneRow).toBeDefined();
    expect(doneRow!.querySelector(".journey-row-icon--pending")).toBeNull();
  });
});
