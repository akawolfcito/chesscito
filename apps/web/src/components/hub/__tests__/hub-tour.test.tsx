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

const ALL_TARGETS = ["daily", "challenge"];

/** The pass's real terms, as the ChallengeCard receives them. */
const CHALLENGE = { days: 21, shields: 3, price: "$0.99" };

const FRESH = { dailyDone: false, streak: 0, hasSeasonPass: false };

beforeEach(() => {
  mountTargets(ALL_TARGETS);
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("<HubTour>", () => {
  const steps = buildHubTourSteps(FRESH);

  it("is the only modal on screen while it runs", () => {
    render(<HubTour steps={steps} challenge={CHALLENGE} onFinish={vi.fn()} />);
    expect(modalCount()).toBe(1);
  });

  it("opens on the daily and closes on the challenge — two steps, not three", () => {
    render(<HubTour steps={steps} challenge={CHALLENGE} onFinish={vi.fn()} />);
    // The daily sentence now lives behind the `?`; the visible surface is the
    // art strip, so we anchor the "we opened on daily" check on its first label.
    expect(screen.getByText(HUB_TOUR_COPY.dailyStripGift)).toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.next }));

    expect(screen.getByText("2 of 2")).toBeInTheDocument();
    // Last step → the primary closes the tour instead of promising another one.
    expect(
      screen.getByRole("button", { name: HUB_TOUR_COPY.done }),
    ).toBeInTheDocument();
  });

  it("hides the daily sentence behind the `?` and reveals it on tap", () => {
    render(<HubTour steps={steps} challenge={CHALLENGE} onFinish={vi.fn()} />);
    // Closed by default: the art strip carries the message, the full sentence is
    // one tap away — and opening it must NOT reflow the panel (it's a popover).
    expect(screen.queryByText(HUB_TOUR_COPY.dailyStart)).toBeNull();
    fireEvent.click(screen.getByTestId("hub-tour-details-toggle"));
    expect(screen.getByText(HUB_TOUR_COPY.dailyStart)).toBeInTheDocument();
  });

  it("labels the daily ritual strip: open gift → solve tactic → build combo", () => {
    render(<HubTour steps={steps} challenge={CHALLENGE} onFinish={vi.fn()} />);
    expect(screen.getByTestId("hub-tour-story")).toBeInTheDocument();
    expect(screen.getByText(HUB_TOUR_COPY.dailyStripGift)).toBeInTheDocument();
    expect(screen.getByText(HUB_TOUR_COPY.dailyStripTactic)).toBeInTheDocument();
    expect(screen.getByText(HUB_TOUR_COPY.dailyStripCombo)).toBeInTheDocument();
  });

  it("does not carry the strip or `?` into the challenge step — that step is its own art", () => {
    render(<HubTour steps={steps} challenge={CHALLENGE} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.next }));
    expect(screen.queryByTestId("hub-tour-story")).toBeNull();
    expect(screen.queryByTestId("hub-tour-details-toggle")).toBeNull();
  });

  it("keeps the pass's real terms visible and quotes them from config, not from a string", () => {
    // The art carries the pitch, but the deal stays on screen. A "$0.99" typed
    // into the copy would survive a price change with the suite green — feed the
    // panel different terms and it must say THOSE.
    render(
      <HubTour
        steps={steps}
        challenge={{ days: 30, shields: 5, price: "$2.49" }}
        onFinish={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.next }));

    expect(screen.getByTestId("hub-tour-value")).toHaveTextContent(
      "30 days · +5 shields · $2.49",
    );
    // And it asks for the transaction by naming the button.
    expect(screen.getByText(HUB_TOUR_COPY.challengeAsk)).toBeInTheDocument();
  });

  it("shows the art but not the sales pitch to a player who already owns the pass", () => {
    const owner = buildHubTourSteps({ ...FRESH, hasSeasonPass: true });
    render(<HubTour steps={owner} challenge={CHALLENGE} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.next }));

    expect(screen.getByAltText(HUB_TOUR_COPY.challengeHeroAlt)).toBeInTheDocument();
    expect(screen.queryByTestId("hub-tour-value")).toBeNull();
    expect(screen.queryByText(HUB_TOUR_COPY.challengeAsk)).toBeNull();
  });

  it("carries the headline as art, with the words reachable as alt text", () => {
    render(<HubTour steps={steps} challenge={CHALLENGE} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.next }));

    // Baked-in words: without alt, a screen reader (and every non-EN locale)
    // gets a nameless image where the headline should be.
    expect(
      screen.getByAltText(HUB_TOUR_COPY.challengeTitleAlt),
    ).toBeInTheDocument();
  });

  it("never promises that the pass forgives a missed day", () => {
    // A shield rescues a FAILED EXERCISE. Streak recovery is a permanent
    // never-build, so this — the one screen that asks for money — must not sell
    // it. Enforced on the copy itself, so it holds for whoever rewrites the
    // pitch next.
    const salesCopy = [
      HUB_TOUR_COPY.challengeJoin,
      HUB_TOUR_COPY.challengeValue,
      HUB_TOUR_COPY.challengeAsk,
    ].join(" ");
    expect(salesCopy).not.toMatch(
      /miss(ed)? (a )?day|recover|restore|save your streak|protect your streak/i,
    );
  });

  it("closes on Got it and reports the tour completed", () => {
    const onFinish = vi.fn();
    render(<HubTour steps={steps} challenge={CHALLENGE} onFinish={onFinish} />);

    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.next }));
    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.done }));

    expect(onFinish).toHaveBeenCalledWith("completed");
  });

  it("has no escape hatch — the daily `?` and Next are not exits, and the challenge step keeps one control", () => {
    render(<HubTour steps={steps} challenge={CHALLENGE} onFinish={vi.fn()} />);
    // The daily step offers exactly two controls — the `?` that reveals detail
    // and Next that advances — and neither bleeds the player out of the tour.
    expect(screen.queryByText(/skip/i)).toBeNull();
    expect(screen.getByTestId("hub-tour-details-toggle")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: HUB_TOUR_COPY.next }),
    ).toBeInTheDocument();
    // The challenge step is carried by art alone: one advancing control, no exit.
    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.next }));
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByText(/skip/i)).toBeNull();
  });

  it("skips a step whose target never mounted — a 1-step tour beats an arrow pointing at nothing", () => {
    document.body.innerHTML = "";
    mountTargets(["daily"]);

    render(<HubTour steps={steps} challenge={CHALLENGE} onFinish={vi.fn()} />);

    expect(screen.getByText("1 of 1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: HUB_TOUR_COPY.done }),
    ).toBeInTheDocument();
  });

  it("finishes immediately when no target is on screen at all", () => {
    document.body.innerHTML = "";
    const onFinish = vi.fn();

    render(<HubTour steps={steps} challenge={CHALLENGE} onFinish={onFinish} />);

    expect(onFinish).toHaveBeenCalledWith("completed");
    expect(modalCount()).toBe(0);
  });

  it("ignores a tap outside the panel — the tour exits by Skip or by finishing", () => {
    const onFinish = vi.fn();
    render(<HubTour steps={steps} challenge={CHALLENGE} onFinish={onFinish} />);

    fireEvent.click(screen.getByTestId("hub-tour-scrim"));

    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByText(HUB_TOUR_COPY.dailyStripGift)).toBeInTheDocument();
  });

  it("spotlights the target of the current step", () => {
    render(<HubTour steps={steps} challenge={CHALLENGE} onFinish={vi.fn()} />);
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

  it("stops selling the moment the pass confirms, even mid-tour", () => {
    // Found on a real device: the card read ACTIVE and the panel was still
    // quoting "$0.99". The step OBJECTS were frozen at mount, so a pass that
    // confirmed one tick after the tour opened kept being sold to its owner.
    const { rerender } = render(
      <HubTour steps={steps} challenge={CHALLENGE} onFinish={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.next }));
    expect(screen.getByTestId("hub-tour-value")).toBeInTheDocument();

    rerender(
      <HubTour
        steps={buildHubTourSteps({ ...FRESH, hasSeasonPass: true })}
        challenge={CHALLENGE}
        onFinish={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("hub-tour-value")).toBeNull();
    expect(screen.queryByText(HUB_TOUR_COPY.challengeAsk)).toBeNull();
  });

  it("fits the panel to the room that actually exists, not to a 844px phone", () => {
    // MiniPay's chrome eats the bottom of the viewport. Anchored to an assumed
    // height, the panel — and "Got it" with it — walked off the screen, and the
    // tour could not be finished at all.
    const original = window.innerHeight;
    try {
      Object.defineProperty(window, "innerHeight", {
        value: 600,
        configurable: true,
      });
      // Card sits low: only ~200px left under it, but ~330px above it.
      stubRect("challenge", { top: 330, left: 6, width: 378, height: 168 });

      render(
        <HubTour
          steps={steps}
          challenge={CHALLENGE}
          onFinish={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.next }));

      const panel = screen.getByTestId("hub-tour-value").closest(
        ".hub-tour-panel",
      ) as HTMLElement;
      // It took the roomier side...
      expect(panel.className).toContain("is-above");
      // ...and capped itself to that room, so the button stays reachable.
      const cap = Number.parseFloat(panel.style.maxHeight);
      expect(cap).toBeGreaterThan(0);
      expect(cap).toBeLessThanOrEqual(600);

      // The art is the sacrifice, and it is the ONLY one: the deal and the
      // button — the two things that make the step worth showing — survive.
      expect(screen.queryByAltText(HUB_TOUR_COPY.challengeHeroAlt)).toBeNull();
      expect(screen.getByTestId("hub-tour-value")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: HUB_TOUR_COPY.done }),
      ).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "innerHeight", {
        value: original,
        configurable: true,
      });
    }
  });

  it("hangs the panel below a target in the top half, so it never covers it", () => {
    // The header gift lives at the top of the hub. A panel parked at a fixed
    // offset from the viewport floor drifted all the way down onto Start Focus.
    stubRect("daily", { top: 12, left: 320, width: 60, height: 60 });

    render(<HubTour steps={steps} challenge={CHALLENGE} onFinish={vi.fn()} />);

    const panel = screen
      .getByTestId("hub-tour-story")
      .closest(".hub-tour-panel") as HTMLElement;
    expect(panel.className).toContain("is-below");
    // Below the target's bottom edge (12 + 60), never on top of it.
    expect(Number.parseFloat(panel.style.top)).toBeGreaterThan(72);
  });

  it("lifts the panel above a target in the bottom half", () => {
    stubRect("daily", { top: 700, left: 40, width: 200, height: 60 });

    render(<HubTour steps={steps} challenge={CHALLENGE} onFinish={vi.fn()} />);

    const panel = screen
      .getByTestId("hub-tour-story")
      .closest(".hub-tour-panel") as HTMLElement;
    expect(panel.className).toContain("is-above");
    expect(panel.style.bottom).not.toBe("");
  });

  it("points its arrow at the target it is describing", () => {
    stubRect("daily", { top: 12, left: 320, width: 60, height: 60 });

    render(<HubTour steps={steps} challenge={CHALLENGE} onFinish={vi.fn()} />);

    // Target center is 350px — off the right edge of a 320px centered panel, so
    // the arrow clamps inside the panel instead of floating past its corner.
    const arrow = screen.getByTestId("hub-tour-arrow");
    const left = Number.parseFloat(arrow.style.left);
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThanOrEqual(320);
  });

  it("tells a veteran to keep the streak and does not re-sell a pass they own", () => {
    const veteran = buildHubTourSteps({
      dailyDone: false,
      streak: 12,
      hasSeasonPass: true,
    });
    render(<HubTour steps={veteran} challenge={CHALLENGE} onFinish={vi.fn()} />);

    // The keep-the-streak sentence now lives behind the `?`; it must be the
    // KEEP copy, not the START copy, for a mid-streak veteran.
    fireEvent.click(screen.getByTestId("hub-tour-details-toggle"));
    expect(screen.getByText(HUB_TOUR_COPY.dailyKeep)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: HUB_TOUR_COPY.next }));
    expect(
      screen.getByText("Track your focus days and complete your 21-day commitment."),
    ).toBeInTheDocument();
  });
});
