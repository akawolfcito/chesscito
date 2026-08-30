import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { HubTour, TOUR_TITLE_KEYS } from "../hub-tour";
import {
  buildLearnHubTourSteps,
  type HubTourStep,
} from "@/lib/hub/hub-tour";
import { HUB_TOUR_COPY, PLAY_HUB_COPY } from "@/lib/content/editorial";
import { PRO_DURATION_DAYS } from "@/lib/contracts/shop-catalog";

function mountTargets(targets: string[]) {
  const host = document.createElement("div");
  host.innerHTML = targets
    .map((target) => `<div data-tour-target="${target}">${target}</div>`)
    .join("");
  document.body.appendChild(host);
}

function stubRect(
  target: string,
  rect: { top: number; left: number; width: number; height: number },
) {
  const element = document.querySelector<HTMLElement>(
    `[data-tour-target="${target}"]`,
  );
  if (!element) throw new Error(`missing target: ${target}`);
  element.getBoundingClientRect = () =>
    ({
      ...rect,
      bottom: rect.top + rect.height,
      right: rect.left + rect.width,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect;
}

const CHALLENGE = { days: 21, shields: 3, price: "$0.99" };
const LEARN_STEPS = buildLearnHubTourSteps({
  dailyDone: false,
  streak: 0,
  hasSeasonPass: false,
});

/* The PLAY itinerary builder was removed with the PLAY mini-tour (2026-08-30),
 * but the `HubTour` COMPONENT still ships for LEARN. These steps stay as a
 * literal so the component keeps its rendering, anchoring and keyboard
 * coverage — the data is only a fixture here, never the thing under test. */
const PLAY_STEPS: HubTourStep[] = [
  { id: "kingdom", target: "kingdom", bodyKey: "kingdomBody" },
  { id: "pro", target: "pro", bodyKey: "proJoin" },
  { id: "play", target: "play", bodyKey: "playStart" },
];

beforeEach(() => {
  mountTargets(["daily", "challenge", "rook", "kingdom", "pro", "play"]);
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("<HubTour>", () => {
  it("uses the whole overlay as Next and renders no Next button", () => {
    render(
      <HubTour steps={LEARN_STEPS} challenge={CHALLENGE} onFinish={vi.fn()} />,
    );
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    expect(screen.getByText(HUB_TOUR_COPY.tapToContinue)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();

    fireEvent.click(screen.getByTestId("hub-tour-scrim"));
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    expect(screen.getByText(HUB_TOUR_COPY.challengeTitle)).toBeInTheDocument();
  });

  it("closes from the themed X without advancing", () => {
    const onFinish = vi.fn();
    render(
      <HubTour steps={LEARN_STEPS} challenge={CHALLENGE} onFinish={onFinish} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: HUB_TOUR_COPY.closeAriaLabel }),
    );
    expect(
      document.querySelector('[data-theme-slot="shared.close"]'),
    ).not.toBeNull();
    expect(onFinish).toHaveBeenCalledWith("skipped");
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("finishes LEARN on Rook without launching the introduced action", () => {
    const onFinish = vi.fn();
    render(
      <HubTour
        steps={LEARN_STEPS}
        challenge={CHALLENGE}
        onFinish={onFinish}
      />,
    );
    fireEvent.click(screen.getByTestId("hub-tour-scrim"));
    fireEvent.click(screen.getByTestId("hub-tour-scrim"));
    expect(screen.getByText(HUB_TOUR_COPY.rookTitle)).toBeInTheDocument();
    expect(screen.getByText(HUB_TOUR_COPY.tapToExplore)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("hub-tour-scrim"));
    expect(onFinish).toHaveBeenCalledWith("completed");
  });

  it("walks PLAY as context → offer → action, counting three steps", () => {
    render(
      <HubTour
        mode="play"
        steps={PLAY_STEPS}
        pro={{ active: false, price: "$1.99" }}
        onFinish={vi.fn()}
      />,
    );
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    expect(screen.getByText(HUB_TOUR_COPY.kingdomTitle)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("hub-tour-scrim"));
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    expect(screen.getByText(HUB_TOUR_COPY.proTitle)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("hub-tour-scrim"));
    expect(screen.getByText("3 of 3")).toBeInTheDocument();
    expect(screen.getByText(HUB_TOUR_COPY.playTitle)).toBeInTheDocument();
    expect(screen.getByText(HUB_TOUR_COPY.tapToExplore)).toBeInTheDocument();
  });

  it("spotlights the whole Play Kingdom card on the context step", () => {
    render(
      <HubTour
        mode="play"
        steps={PLAY_STEPS}
        pro={{ active: false, price: "$1.99" }}
        onFinish={vi.fn()}
      />,
    );
    expect(
      document.querySelector('[data-tour-target="kingdom"]'),
    ).toHaveAttribute("data-tour-spotlight", "active");
    expect(screen.getByTestId("hub-tour-spotlight")).toHaveAttribute(
      "data-target",
      "kingdom",
    );
  });

  /** The context step orients; the card underneath is the illustration. A strip
   *  here would repeat the chips the spotlight is already showing. */
  it("gives the context step no strip and no benefits", () => {
    render(
      <HubTour
        mode="play"
        steps={PLAY_STEPS}
        pro={{ active: false, price: "$1.99" }}
        onFinish={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("hub-tour-story")).toBeNull();
    expect(screen.queryByTestId("hub-tour-pro-benefits")).toBeNull();
    expect(screen.queryByTestId("hub-tour-pro-price")).toBeNull();
  });

  it("keeps the context body distinct from the card's own body", () => {
    expect(HUB_TOUR_COPY.kingdomBody).not.toBe(PLAY_HUB_COPY.kingdomPanelBody);
    render(
      <HubTour
        mode="play"
        steps={PLAY_STEPS}
        pro={{ active: false, price: "$1.99" }}
        onFinish={vi.fn()}
      />,
    );
    expect(screen.getByText(HUB_TOUR_COPY.kingdomBody)).toBeInTheDocument();
    expect(screen.queryByText(PLAY_HUB_COPY.kingdomPanelBody)).toBeNull();
  });

  /** The sale step must carry the subscription's perks, not the hub's
   *  navigation chips — otherwise steps 1 and 2 are the same strip twice. */
  it("sells PRO with its own three benefits, not the Kingdom navigation trio", () => {
    render(
      <HubTour
        mode="play"
        steps={PLAY_STEPS}
        pro={{ active: false, price: "$1.99" }}
        onFinish={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("hub-tour-scrim"));

    const benefits = screen.getByTestId("hub-tour-pro-benefits");
    expect(benefits).toHaveTextContent(HUB_TOUR_COPY.proBenefitSeasonPass);
    expect(benefits).toHaveTextContent(HUB_TOUR_COPY.proBenefitUnlimitedCoach);
    expect(benefits).toHaveTextContent(
      HUB_TOUR_COPY.proBenefitCompleteExperience,
    );
    expect(benefits).not.toHaveTextContent(PLAY_HUB_COPY.quickMatchLabel);
    expect(benefits).not.toHaveTextContent(PLAY_HUB_COPY.rewardsLabel);

    for (const slot of [
      "hub.pro-benefit-season-pass",
      "hub.pro-benefit-coach",
      "hub.pro-benefit-complete",
    ]) {
      expect(benefits.querySelector(`[data-theme-slot="${slot}"]`)).not.toBeNull();
    }
  });

  it("interpolates the PRO price and duration instead of hardcoding them", () => {
    expect(HUB_TOUR_COPY.proPrice).not.toMatch(/\$\d/);
    expect(HUB_TOUR_COPY.proPrice).toContain("{price}");
    expect(HUB_TOUR_COPY.proPrice).toContain("{days}");

    render(
      <HubTour
        mode="play"
        steps={PLAY_STEPS}
        pro={{ active: false, price: "$4.20" }}
        onFinish={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("hub-tour-scrim"));
    const price = screen.getByTestId("hub-tour-pro-price");
    expect(price).toHaveTextContent("$4.20");
    expect(price).toHaveTextContent(`${PRO_DURATION_DAYS} days`);
  });

  it("ends PLAY on the action step without launching the selector", () => {
    const onFinish = vi.fn();
    render(
      <HubTour
        mode="play"
        steps={PLAY_STEPS}
        pro={{ active: false, price: "$1.99" }}
        onFinish={onFinish}
      />,
    );
    fireEvent.click(screen.getByTestId("hub-tour-scrim"));
    fireEvent.click(screen.getByTestId("hub-tour-scrim"));
    fireEvent.click(screen.getByTestId("hub-tour-scrim"));
    expect(onFinish).toHaveBeenCalledWith("completed");
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("shows Challenge terms from config and never hardcodes them", () => {
    render(
      <HubTour
        steps={LEARN_STEPS}
        challenge={{ days: 30, shields: 5, price: "$2.49" }}
        onFinish={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("hub-tour-scrim"));
    expect(screen.getByTestId("hub-tour-benefits")).toHaveTextContent("30 Days");
    expect(screen.getByTestId("hub-tour-benefits")).toHaveTextContent(
      "+5 Shields",
    );
    expect(screen.getByTestId("hub-tour-value")).toHaveTextContent("$2.49");
  });

  it("moves the active spotlight marker with each tap", () => {
    render(
      <HubTour steps={LEARN_STEPS} challenge={CHALLENGE} onFinish={vi.fn()} />,
    );
    expect(document.querySelector('[data-tour-target="daily"]')).toHaveAttribute(
      "data-tour-spotlight",
      "active",
    );
    fireEvent.click(screen.getByTestId("hub-tour-scrim"));
    expect(
      document.querySelector('[data-tour-target="challenge"]'),
    ).toHaveAttribute("data-tour-spotlight", "active");
  });

  it("keeps keyboard progression equivalent to touch progression", () => {
    render(
      <HubTour steps={LEARN_STEPS} challenge={CHALLENGE} onFinish={vi.fn()} />,
    );
    fireEvent.keyDown(screen.getByTestId("hub-tour-scrim"), { key: "Enter" });
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
  });

  it("drops an unavailable target instead of pointing at empty space", () => {
    document.body.innerHTML = "";
    mountTargets(["challenge", "rook"]);
    render(
      <HubTour steps={LEARN_STEPS} challenge={CHALLENGE} onFinish={vi.fn()} />,
    );
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getByText(HUB_TOUR_COPY.challengeTitle)).toBeInTheDocument();
  });

  /** One ritual, one vocabulary: the strip summarises the body sentence, so
   *  both must survive together on the variants that describe the ritual. */
  it.each([
    ["dailyStart", 0, HUB_TOUR_COPY.dailyTitleStart],
    ["dailyKeep", 7, HUB_TOUR_COPY.dailyTitleKeep],
  ] as const)(
    "shows the Daily ritual strip on %s",
    (bodyKey, streak, title) => {
      const steps = buildLearnHubTourSteps({
        dailyDone: false,
        streak,
        hasSeasonPass: false,
      });
      expect(steps[0]?.bodyKey).toBe(bodyKey);

      render(<HubTour steps={steps} challenge={CHALLENGE} onFinish={vi.fn()} />);
      expect(screen.getByText(title)).toBeInTheDocument();
      const story = screen.getByTestId("hub-tour-story");
      expect(story).toHaveTextContent(HUB_TOUR_COPY.dailyStripGift);
      expect(story).toHaveTextContent(HUB_TOUR_COPY.dailyStripTactic);
      expect(story).toHaveTextContent(HUB_TOUR_COPY.dailyStripCombo);
      expect(screen.getByText(HUB_TOUR_COPY[bodyKey])).toBeInTheDocument();
    },
  );

  /** "Come back tomorrow" next to gift → tactic → streak advertises a sequence
   *  the player cannot run today. */
  it("hides the ritual strip once today's Daily is done", () => {
    const steps = buildLearnHubTourSteps({
      dailyDone: true,
      streak: 4,
      hasSeasonPass: false,
    });
    expect(steps[0]?.bodyKey).toBe("dailyDone");

    render(<HubTour steps={steps} challenge={CHALLENGE} onFinish={vi.fn()} />);
    expect(screen.queryByTestId("hub-tour-story")).toBeNull();
    expect(screen.getByText(HUB_TOUR_COPY.dailyDone)).toBeInTheDocument();
    expect(screen.getByText(HUB_TOUR_COPY.dailyTitle)).toBeInTheDocument();
  });

  it("keeps one vocabulary across the two ritual variants", () => {
    for (const body of [HUB_TOUR_COPY.dailyStart, HUB_TOUR_COPY.dailyKeep]) {
      expect(body).toContain("quick tactic");
      expect(body).toContain("focus streak");
      expect(body).not.toMatch(/lesson/i);
    }
  });

  /** The panel resolves copy dynamically (`t(step.bodyKey)`), so a bodyKey with
   *  no matching HUB_TOUR_COPY entry paints the raw key path on screen instead
   *  of throwing. The static t()-scan cannot see through the indirection. */
  it("resolves every itinerary bodyKey and title to real copy", () => {
    const steps = [
      ...buildLearnHubTourSteps({ dailyDone: false, streak: 0, hasSeasonPass: false }),
      ...buildLearnHubTourSteps({ dailyDone: true, streak: 9, hasSeasonPass: true }),
      ...PLAY_STEPS,
      { id: "pro", target: "pro", bodyKey: "proActive" } as HubTourStep,
    ];
    const copy = HUB_TOUR_COPY as Record<string, unknown>;

    for (const step of steps) {
      expect(typeof copy[step.bodyKey]).toBe("string");
    }
    for (const titleKey of Object.values(TOUR_TITLE_KEYS)) {
      expect(typeof copy[titleKey]).toBe("string");
    }
  });

  it("anchors below a top target and points the arrow inside the panel", () => {
    stubRect("daily", { top: 12, left: 320, width: 60, height: 60 });
    render(
      <HubTour steps={LEARN_STEPS} challenge={CHALLENGE} onFinish={vi.fn()} />,
    );
    const panel = screen
      .getByTestId("hub-tour-story")
      .closest(".hub-tour-panel") as HTMLElement;
    expect(panel).toHaveClass("is-below");
    expect(Number.parseFloat(panel.style.top)).toBeGreaterThan(72);
    expect(
      Number.parseFloat(screen.getByTestId("hub-tour-arrow").style.left),
    ).toBeLessThanOrEqual(320);
  });
});
