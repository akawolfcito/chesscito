import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CoachPaywall } from "../coach-paywall";
import { COACH_COPY } from "@/lib/content/editorial";

function getTiles() {
  return screen
    .getAllByRole("button")
    .filter((el) =>
      el.getAttribute("data-component") === "treasure-tile",
    ) as HTMLButtonElement[];
}

describe("CoachPaywall — TreasureTile composition (post-M3.5)", () => {
  it("renders two <TreasureTile> buttons (5-pack small + 20-pack large)", () => {
    render(
      <CoachPaywall
        open
        onOpenChange={() => {}}
        onBuy={() => {}}
        onQuickReview={() => {}}
      />,
    );
    const tiles = getTiles();
    expect(tiles).toHaveLength(2);
    expect(tiles[0].getAttribute("data-size")).toBe("small");
    expect(tiles[1].getAttribute("data-size")).toBe("large");
  });

  it("20-pack has ribbon='BEST' (locked enum)", () => {
    render(
      <CoachPaywall
        open
        onOpenChange={() => {}}
        onBuy={() => {}}
        onQuickReview={() => {}}
      />,
    );
    const tiles = getTiles();
    const bestRibbon = tiles[1].querySelector(
      '[data-ribbon="BEST"]',
    ) as HTMLElement | null;
    expect(bestRibbon).not.toBeNull();
    expect(bestRibbon?.textContent).toBe("BEST");
  });

  it("5-pack has no ribbon", () => {
    render(
      <CoachPaywall
        open
        onOpenChange={() => {}}
        onBuy={() => {}}
        onQuickReview={() => {}}
      />,
    );
    const tiles = getTiles();
    expect(
      tiles[0].querySelector(".treasure-tile-ribbon"),
    ).toBeNull();
  });

  it("aria-labels embed the pack count + price for screen readers", () => {
    render(
      <CoachPaywall
        open
        onOpenChange={() => {}}
        onBuy={() => {}}
        onQuickReview={() => {}}
      />,
    );
    const tiles = getTiles();
    expect(tiles[0].getAttribute("aria-label")).toMatch(/5/);
    expect(tiles[0].getAttribute("aria-label")).toMatch(/0\.05/);
    expect(tiles[1].getAttribute("aria-label")).toMatch(/20/);
    expect(tiles[1].getAttribute("aria-label")).toMatch(/0\.10/);
  });

  it("clicking 5-pack fires onBuy(5)", () => {
    const onBuy = vi.fn();
    render(
      <CoachPaywall
        open
        onOpenChange={() => {}}
        onBuy={onBuy}
        onQuickReview={() => {}}
      />,
    );
    fireEvent.click(getTiles()[0]);
    expect(onBuy).toHaveBeenCalledWith(5);
  });

  it("clicking 20-pack fires onBuy(20)", () => {
    const onBuy = vi.fn();
    render(
      <CoachPaywall
        open
        onOpenChange={() => {}}
        onBuy={onBuy}
        onQuickReview={() => {}}
      />,
    );
    fireEvent.click(getTiles()[1]);
    expect(onBuy).toHaveBeenCalledWith(20);
  });

  it("after a buy starts, BOTH tiles are blocked: clicked one shows loading, the other is disabled", () => {
    const onBuy = vi.fn();
    render(
      <CoachPaywall
        open
        onOpenChange={() => {}}
        onBuy={onBuy}
        onQuickReview={() => {}}
      />,
    );
    fireEvent.click(getTiles()[0]); // start buying 5-pack

    const tilesAfter = getTiles();
    // 5-pack now in loading state
    expect(tilesAfter[0].getAttribute("data-state")).toBe("loading");
    expect(tilesAfter[0].querySelector(".treasure-tile-spinner")).not.toBeNull();
    // 20-pack disabled
    expect(tilesAfter[1].disabled).toBe(true);
  });

  it("Quick Review link is disabled while a buy is in flight", () => {
    render(
      <CoachPaywall
        open
        onOpenChange={() => {}}
        onBuy={() => {}}
        onQuickReview={() => {}}
      />,
    );
    fireEvent.click(getTiles()[0]);
    // Source the label from editorial.ts so the test stays aligned with
    // the COACH_COPY.orQuickReview canonical copy (renamed to "REVIEW"
    // in the M3.5 copy purge; previous string was "Quick Review").
    const quickReview = screen.getByRole("button", {
      name: COACH_COPY.orQuickReview,
    }) as HTMLButtonElement;
    expect(quickReview.disabled).toBe(true);
  });
});
