/**
 * The purchase sheet itself refuses to open while sales are paused.
 *
 * ⛔ THE THIRD LEAK OF THE SAME PAUSE. The card's banner was hidden, then the
 * tour's step was dropped — and `/exercises` still opened this sheet from the
 * dock's "shop" destination (`exercises-screen.tsx:5008` → `LearnShopSheet` →
 * `SeasonPassSheet`). Two doors closed, a third one open.
 *
 * ⛔ SO THE GUARD GOES IN THE GRANTOR, not in a third caller. Patching each
 * entry point is what produced this list in the first place: every new surface
 * that mounts the sheet would have to remember. The sheet already self-gates on
 * `CHESSCITO_LITE_MODE`; the pause belongs beside it.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const salesEnabled = vi.fn(() => false);

vi.mock("@/lib/feature-flags", () => ({
  CHESSCITO_LITE_MODE: true,
  CHESSCITO_MODE: "learn",
  isSeasonPassSalesEnabled: () => salesEnabled(),
}));

import { SeasonPassSheet } from "../season-pass-sheet";

beforeEach(() => vi.clearAllMocks());

describe("SeasonPassSheet — paused sales", () => {
  it("⛔ renders NOTHING when sales are paused, however it is opened", () => {
    salesEnabled.mockReturnValue(false);

    const { container } = render(
      <SeasonPassSheet open onOpenChange={vi.fn()} onSuccess={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("stays closed when it is not open, paused or not", () => {
    salesEnabled.mockReturnValue(true);

    const { container } = render(
      <SeasonPassSheet
        open={false}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
