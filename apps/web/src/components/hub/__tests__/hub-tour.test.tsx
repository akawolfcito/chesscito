import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { HubTour } from "../hub-tour";
import { buildHubTourSteps } from "@/lib/hub/hub-tour";
import { HUB_TOUR_COPY } from "@/lib/content/editorial";

/** The hub targets the tour points at. Mounted into `document.body` so the
 *  presenter finds them exactly as it does on the real hub. */
function mountTargets(targets: string[]) {
  const host = document.createElement("div");
  host.innerHTML = targets
    .map((target) => `<div data-tour-target="${target}">${target}</div>`)
    .join("");
  document.body.appendChild(host);
  return host;
}

/** The invariant, counted the only way that holds: `LabyrinthCompleteOverlay`
 *  is a dialog carrying `role="alert"`, so counting `role="dialog"` reports one
 *  modal while two are stacked. */
function modalCount() {
  return document.querySelectorAll('[aria-modal="true"]').length;
}

const ALL_TARGETS = ["daily", "challenge", "start-focus"];

beforeEach(() => {
  mountTargets(ALL_TARGETS);
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("<HubTour>", () => {
  const steps = buildHubTourSteps({ dailyDone: false, hasSeasonPass: false });

  it("is the only modal on screen while it runs", () => {
    render(<HubTour steps={steps} onFinish={vi.fn()} />);
    expect(modalCount()).toBe(1);
  });

  it("opens on the daily and walks to start focus", () => {
    render(<HubTour steps={steps} onFinish={vi.fn()} />);
    expect(screen.getByText(HUB_TOUR_COPY.dailyPending)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.next }));
    expect(screen.getByText(HUB_TOUR_COPY.challengeJoin)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.next }));
    expect(screen.getByText(HUB_TOUR_COPY.startFocus)).toBeInTheDocument();
  });

  it("closes on Got it and reports the tour completed", () => {
    const onFinish = vi.fn();
    render(<HubTour steps={steps} onFinish={onFinish} />);

    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.next }));
    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.next }));
    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.done }));

    expect(onFinish).toHaveBeenCalledWith("completed");
  });

  it("reports a skip as a skip — it is a decision, not a postponement", () => {
    const onFinish = vi.fn();
    render(<HubTour steps={steps} onFinish={onFinish} />);

    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.skip }));

    expect(onFinish).toHaveBeenCalledWith("skipped");
  });

  it("offers Skip on every step, not just the first", () => {
    render(<HubTour steps={steps} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.next }));
    expect(
      screen.getByRole("button", { name: HUB_TOUR_COPY.skip }),
    ).toBeInTheDocument();
  });

  it("skips a step whose target never mounted — a 2-step tour beats an arrow pointing at nothing", () => {
    document.body.innerHTML = "";
    mountTargets(["daily", "start-focus"]);

    render(<HubTour steps={steps} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.next }));

    expect(screen.queryByText(HUB_TOUR_COPY.challengeJoin)).toBeNull();
    expect(screen.getByText(HUB_TOUR_COPY.startFocus)).toBeInTheDocument();
    // Last reachable step → the primary is the closer, not another Next.
    expect(screen.getByRole("button", { name: HUB_TOUR_COPY.done })).toBeInTheDocument();
  });

  it("finishes immediately when no target is on screen at all", () => {
    document.body.innerHTML = "";
    const onFinish = vi.fn();

    render(<HubTour steps={steps} onFinish={onFinish} />);

    expect(onFinish).toHaveBeenCalledWith("completed");
    expect(modalCount()).toBe(0);
  });

  it("ignores a tap outside the panel — the tour exits by Skip or by finishing", () => {
    const onFinish = vi.fn();
    render(<HubTour steps={steps} onFinish={onFinish} />);

    fireEvent.click(screen.getByTestId("hub-tour-scrim"));

    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByText(HUB_TOUR_COPY.dailyPending)).toBeInTheDocument();
  });

  it("spotlights the target of the current step", () => {
    render(<HubTour steps={steps} onFinish={vi.fn()} />);
    expect(screen.getByTestId("hub-tour-spotlight")).toHaveAttribute(
      "data-target",
      "daily",
    );

    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.next }));
    expect(screen.getByTestId("hub-tour-spotlight")).toHaveAttribute(
      "data-target",
      "challenge",
    );
  });

  it("adapts the copy to a player who already holds the pass and solved today", () => {
    const veteran = buildHubTourSteps({ dailyDone: true, hasSeasonPass: true });
    render(<HubTour steps={veteran} onFinish={vi.fn()} />);

    expect(screen.getByText(HUB_TOUR_COPY.dailyDone)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.next }));
    expect(screen.getByText(HUB_TOUR_COPY.challengeEnrolled)).toBeInTheDocument();
  });
});
