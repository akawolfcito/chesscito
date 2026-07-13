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

/** jsdom measures every element as 0x0. The panel's placement is a function of
 *  the target's rect, so the rect has to be real for those assertions. */
function stubRect(
  target: string,
  rect: { top: number; left: number; width: number; height: number },
) {
  const el = document.querySelector<HTMLElement>(
    `[data-tour-target="${target}"]`,
  );
  if (!el) throw new Error(`no target ${target}`);
  el.getBoundingClientRect = () =>
    ({
      ...rect,
      bottom: rect.top + rect.height,
      right: rect.left + rect.width,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect;
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

  it("hangs the panel below a target in the top half, so it never covers it", () => {
    // The header gift lives at the top of the hub. A panel parked at a fixed
    // offset from the viewport floor drifted all the way down onto Start Focus.
    stubRect("daily", { top: 12, left: 320, width: 60, height: 60 });

    render(<HubTour steps={steps} onFinish={vi.fn()} />);

    const panel = screen.getByText(HUB_TOUR_COPY.dailyPending).closest(
      ".hub-tour-panel",
    ) as HTMLElement;
    expect(panel.className).toContain("is-below");
    // Below the target's bottom edge (12 + 60), never on top of it.
    expect(Number.parseFloat(panel.style.top)).toBeGreaterThan(72);
  });

  it("lifts the panel above a target in the bottom half", () => {
    stubRect("daily", { top: 700, left: 40, width: 200, height: 60 });

    render(<HubTour steps={steps} onFinish={vi.fn()} />);

    const panel = screen.getByText(HUB_TOUR_COPY.dailyPending).closest(
      ".hub-tour-panel",
    ) as HTMLElement;
    expect(panel.className).toContain("is-above");
    expect(panel.style.bottom).not.toBe("");
  });

  it("points its arrow at the target it is describing", () => {
    stubRect("daily", { top: 12, left: 320, width: 60, height: 60 });

    render(<HubTour steps={steps} onFinish={vi.fn()} />);

    // Target center is 350px — off the right edge of a 320px centered panel, so
    // the arrow clamps inside the panel instead of floating past its corner.
    const arrow = screen.getByTestId("hub-tour-arrow");
    const left = Number.parseFloat(arrow.style.left);
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThanOrEqual(320);
  });

  it("adapts the copy to a player who already holds the pass and solved today", () => {
    const veteran = buildHubTourSteps({ dailyDone: true, hasSeasonPass: true });
    render(<HubTour steps={veteran} onFinish={vi.fn()} />);

    expect(screen.getByText(HUB_TOUR_COPY.dailyDone)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.next }));
    expect(screen.getByText(HUB_TOUR_COPY.challengeEnrolled)).toBeInTheDocument();
  });
});
