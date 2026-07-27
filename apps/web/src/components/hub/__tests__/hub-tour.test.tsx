import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { HubTour } from "../hub-tour";
import {
  buildLearnHubTourSteps,
  buildPlayHubTourSteps,
} from "@/lib/hub/hub-tour";
import { HUB_TOUR_COPY } from "@/lib/content/editorial";

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

beforeEach(() => {
  mountTargets(["daily", "challenge", "rook", "pro", "play"]);
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

  it("renders a PLAY-specific PRO offer and ends on Play", () => {
    const steps = buildPlayHubTourSteps({
      dailyDone: false,
      streak: 0,
      includeDaily: false,
      proStatus: "inactive",
    });
    render(
      <HubTour
        mode="play"
        steps={steps}
        pro={{ active: false, price: "$1.99" }}
        onFinish={vi.fn()}
      />,
    );
    expect(screen.getByText(HUB_TOUR_COPY.proTitle)).toBeInTheDocument();
    expect(screen.getByText(/\$1\.99/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("hub-tour-scrim"));
    expect(screen.getByText(HUB_TOUR_COPY.playTitle)).toBeInTheDocument();
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
