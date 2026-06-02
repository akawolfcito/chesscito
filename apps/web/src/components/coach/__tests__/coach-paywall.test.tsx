import { describe, it, expect, vi } from "vitest";
import { renderWithIntl as render, screen, fireEvent } from "@/test-utils/render-with-intl";
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

  it("renders the M1 paywall heading + the canonical Luz subtitle (cierre cálido)", () => {
    render(
      <CoachPaywall
        open
        onOpenChange={() => {}}
        onBuy={() => {}}
      />,
    );
    // M1 funnel (Commit 3) — heading replaces the legacy creditTitle so
    // the surface promises "review your game" before listing prices.
    expect(COACH_COPY.paywallHeading).toBe("Review your game with Luz.");
    expect(
      screen.getAllByText(COACH_COPY.paywallHeading).length,
    ).toBeGreaterThan(0);
    // Subtitle still surfaces the canonical Luz voice (creditExplain).
    expect(COACH_COPY.creditExplain).toBe(
      "I saw your game. You've used your 3 free analyses. Add a pack and we keep talking.",
    );
    expect(
      screen.getAllByText(COACH_COPY.creditExplain).length,
    ).toBeGreaterThan(0);
  });

  it("renders the sample preview block with editorial copy", () => {
    render(
      <CoachPaywall
        open
        onOpenChange={() => {}}
        onBuy={() => {}}
      />,
    );
    expect(
      screen.getByText(COACH_COPY.paywallPreviewTitle),
    ).toBeInTheDocument();
    expect(
      screen.getByText(COACH_COPY.paywallPreviewBody),
    ).toBeInTheDocument();
  });

  it("renders the PRO CTA only when onSeePro is wired", () => {
    const { rerender } = render(
      <CoachPaywall
        open
        onOpenChange={() => {}}
        onBuy={() => {}}
      />,
    );
    expect(
      screen.queryByRole("button", { name: COACH_COPY.paywallProCta }),
    ).toBeNull();

    const onSeePro = vi.fn();
    rerender(
      <CoachPaywall
        open
        onOpenChange={() => {}}
        onBuy={() => {}}
        onSeePro={onSeePro}
      />,
    );
    const proCta = screen.getByRole("button", {
      name: COACH_COPY.paywallProCta,
    });
    fireEvent.click(proCta);
    expect(onSeePro).toHaveBeenCalledTimes(1);
  });

  it("Later link dismisses and is disabled while a buy is in flight", () => {
    const onOpenChange = vi.fn();
    render(
      <CoachPaywall
        open
        onOpenChange={onOpenChange}
        onBuy={() => {}}
      />,
    );
    const later = screen.getByRole("button", {
      name: COACH_COPY.paywallDismiss,
    }) as HTMLButtonElement;
    fireEvent.click(later);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // After a buy starts, Later locks alongside the tiles so the user
    // doesn't dismiss mid-tx.
    onOpenChange.mockReset();
    render(
      <CoachPaywall
        open
        onOpenChange={onOpenChange}
        onBuy={() => {}}
      />,
    );
    const tiles = getTiles();
    fireEvent.click(tiles[0]);
    const laterAfter = screen.getAllByRole("button", {
      name: COACH_COPY.paywallDismiss,
    }) as HTMLButtonElement[];
    expect(laterAfter[laterAfter.length - 1].disabled).toBe(true);
  });
});
