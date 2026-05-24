import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { HUB_V2_TRAINING_COPY } from "@/lib/content/editorial";

/** Phase 6 — <TrainingPassBand> (design-lock §1.5 + §2.3 + §5 + §9.4).
 *
 *  4 asserts:
 *    1. Active state renders kicker + days + sessions progress + renews date
 *    2. Inactive state renders title + price + 3 perks
 *    3. Tap (both states) fires hub_v2_training_band_tap with proActive flag
 *    4. onActivate callback fires once on active prop transition false → true;
 *       does NOT fire on initial mount with active=true (atmosphere shift in
 *       scaffold owns this trigger; band exposes the callback for wiring) */

const trackMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/telemetry", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

import { TrainingPassBand } from "../training-pass-band";

beforeEach(() => {
  trackMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("<TrainingPassBand> — Phase 6 primitive", () => {
  it("(1) active: renders kicker + days + sessions progress + renews date", () => {
    const { container } = render(
      <TrainingPassBand
        active={true}
        daysRemaining={26}
        sessionsUsed={8}
        sessionsTotal={12}
        renewsAt="6/3"
        onTap={vi.fn()}
      />,
    );

    const band = container.querySelector(
      '[data-component="training-pass-band"]',
    );
    expect(band?.getAttribute("data-state")).toBe("active");

    expect(screen.getByTestId("band-kicker").textContent).toBe(
      HUB_V2_TRAINING_COPY.active.kicker,
    );
    expect(screen.getByTestId("band-days").textContent).toBe(
      HUB_V2_TRAINING_COPY.active.daysFormat(26),
    );
    expect(screen.getByTestId("band-sessions").textContent).toBe(
      HUB_V2_TRAINING_COPY.active.sessionsFormat(8, 12),
    );
    expect(screen.getByTestId("band-renews").textContent).toBe(
      HUB_V2_TRAINING_COPY.active.renewsFormat("6/3"),
    );

    expect(band?.getAttribute("aria-label")).toBe(
      HUB_V2_TRAINING_COPY.active.ariaLabel(26, 8, 12),
    );
  });

  it("(2) inactive: renders title + price + 3 perks", () => {
    const { container } = render(
      <TrainingPassBand active={false} onTap={vi.fn()} />,
    );

    const band = container.querySelector(
      '[data-component="training-pass-band"]',
    );
    expect(band?.getAttribute("data-state")).toBe("inactive");

    expect(screen.getByTestId("band-title").textContent).toBe(
      HUB_V2_TRAINING_COPY.inactive.title,
    );
    expect(screen.getByTestId("band-price").textContent).toBe(
      HUB_V2_TRAINING_COPY.inactive.priceLabel,
    );

    const perks = screen.getAllByTestId("band-perk");
    expect(perks).toHaveLength(3);
    perks.forEach((perk, i) => {
      expect(perk.textContent).toBe(HUB_V2_TRAINING_COPY.inactive.perks[i]);
    });

    expect(band?.getAttribute("aria-label")).toBe(
      HUB_V2_TRAINING_COPY.inactive.ariaLabel,
    );
  });

  it("(3) tap (both states) fires hub_v2_training_band_tap { proActive } and onTap callback", async () => {
    const user = userEvent.setup();

    const onTapActive = vi.fn();
    const { container, unmount } = render(
      <TrainingPassBand
        active={true}
        daysRemaining={26}
        sessionsUsed={8}
        sessionsTotal={12}
        renewsAt="6/3"
        onTap={onTapActive}
      />,
    );
    await user.click(
      container.querySelector(
        '[data-component="training-pass-band"]',
      ) as HTMLElement,
    );

    let bandCalls = trackMock.mock.calls.filter(
      (call) => call[0] === "hub_v2_training_band_tap",
    );
    expect(bandCalls).toHaveLength(1);
    expect(bandCalls[0][1]).toMatchObject({ proActive: true });
    expect(onTapActive).toHaveBeenCalledTimes(1);

    trackMock.mockReset();
    unmount();

    const onTapInactive = vi.fn();
    const { container: containerInactive } = render(
      <TrainingPassBand active={false} onTap={onTapInactive} />,
    );
    await user.click(
      containerInactive.querySelector(
        '[data-component="training-pass-band"]',
      ) as HTMLElement,
    );

    bandCalls = trackMock.mock.calls.filter(
      (call) => call[0] === "hub_v2_training_band_tap",
    );
    expect(bandCalls).toHaveLength(1);
    expect(bandCalls[0][1]).toMatchObject({ proActive: false });
    expect(onTapInactive).toHaveBeenCalledTimes(1);
  });

  it("(4) onActivate fires once on active false → true transition; NOT called on mount with active=true", () => {
    // Case A: mount directly with active=true → should NOT fire onActivate
    const onActivateMountActive = vi.fn();
    const { unmount } = render(
      <TrainingPassBand
        active={true}
        daysRemaining={26}
        sessionsUsed={8}
        sessionsTotal={12}
        renewsAt="6/3"
        onTap={vi.fn()}
        onActivate={onActivateMountActive}
      />,
    );
    expect(onActivateMountActive).not.toHaveBeenCalled();
    unmount();

    // Case B: mount with active=false, then re-render with active=true
    // → should fire onActivate exactly once
    const onActivateTransition = vi.fn();
    const { rerender } = render(
      <TrainingPassBand
        active={false}
        onTap={vi.fn()}
        onActivate={onActivateTransition}
      />,
    );
    expect(onActivateTransition).not.toHaveBeenCalled();

    rerender(
      <TrainingPassBand
        active={true}
        daysRemaining={26}
        sessionsUsed={8}
        sessionsTotal={12}
        renewsAt="6/3"
        onTap={vi.fn()}
        onActivate={onActivateTransition}
      />,
    );
    expect(onActivateTransition).toHaveBeenCalledTimes(1);

    // Re-render again with active=true (no transition) → no extra call
    rerender(
      <TrainingPassBand
        active={true}
        daysRemaining={25}
        sessionsUsed={8}
        sessionsTotal={12}
        renewsAt="6/3"
        onTap={vi.fn()}
        onActivate={onActivateTransition}
      />,
    );
    expect(onActivateTransition).toHaveBeenCalledTimes(1);

    // Re-render with active=false (transition true → false) → still 1
    rerender(
      <TrainingPassBand
        active={false}
        onTap={vi.fn()}
        onActivate={onActivateTransition}
      />,
    );
    expect(onActivateTransition).toHaveBeenCalledTimes(1);
  });
});
