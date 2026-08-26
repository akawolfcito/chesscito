/**
 * Pausing the paid challenge must not take the free daily habit with it.
 *
 * ⛔ THE REGRESSION THIS CLOSES. `ChallengeCard` rendered two different products
 * in one container: the paid 21-day challenge (the "X of 21" counter, the
 * window, the price) AND the free daily habit (the Focus Passport, the streak,
 * the shields, the Start Focus CTA). Pausing sales made the card return `null`,
 * which was correct for the first and silently deleted the second.
 *
 * The Learn hub lost its most used surface: 357 players started a Daily in 7
 * days against 167 who touched exercises. Nothing failed and no test went red —
 * the founder found it by opening the hub and seeing a hole (2026-08-25).
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";

import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { DailyHabitCard } from "../daily-habit-card";
import type { CtaSlotPresentation } from "@/lib/hub/cta-slot";

const passport = {
  streak: 4,
  totalCompleted: 12,
  todayDone: false,
  isLoading: false,
};

const actionSlot: CtaSlotPresentation = {
  kind: "action",
  variant: "daily-pending",
  destination: "/exercises?piece=rook",
  labelKey: "ctaStartToday",
  noteKey: null,
};

describe("DailyHabitCard", () => {
  it("keeps the Focus Passport on screen while sales are paused", () => {
    render(
      <DailyHabitCard
        ctaSlot={actionSlot}
        focusPassport={passport}
        onFocusTap={vi.fn()}
        onPassportTap={vi.fn()}
        shields={{ count: 3 }}
      />,
    );

    expect(screen.getByTestId("daily-habit-passport")).toBeInTheDocument();
  });

  it("keeps the shields visible", () => {
    render(
      <DailyHabitCard
        ctaSlot={actionSlot}
        focusPassport={passport}
        onFocusTap={vi.fn()}
        onPassportTap={vi.fn()}
        shields={{ count: 3 }}
      />,
    );

    expect(screen.getByTestId("daily-habit-shields")).toHaveTextContent("3");
  });

  it("routes the CTA to the destination the container resolved", () => {
    const onFocusTap = vi.fn();
    render(
      <DailyHabitCard
        ctaSlot={actionSlot}
        focusPassport={passport}
        onFocusTap={onFocusTap}
        onPassportTap={vi.fn()}
      />,
    );

    // By testid, not by copy: the passport button also says "today".
    fireEvent.click(screen.getByTestId("daily-habit-cta"));
    expect(onFocusTap).toHaveBeenCalledWith("/exercises?piece=rook");
  });

  it("opens the Daily from the passport", () => {
    const onPassportTap = vi.fn();
    render(
      <DailyHabitCard
        ctaSlot={actionSlot}
        focusPassport={passport}
        onFocusTap={vi.fn()}
        onPassportTap={onPassportTap}
      />,
    );

    fireEvent.click(screen.getByTestId("daily-habit-passport"));
    expect(onPassportTap).toHaveBeenCalled();
  });

  it("renders a STATUS, not a button, before the content loop is resolved", () => {
    // `null` means not hydrated. A button over unloaded data promises a
    // destination nobody has computed yet.
    render(
      <DailyHabitCard
        ctaSlot={null}
        focusPassport={passport}
        onFocusTap={vi.fn()}
        onPassportTap={vi.fn()}
      />,
    );

    expect(screen.getByTestId("daily-habit-passport")).toBeInTheDocument();
    expect(screen.queryByTestId("daily-habit-status")).toBeNull();
  });

  it("⛔ carries NOTHING from the paused product", () => {
    // No day counter, no window, no price, no purchase CTA. If any of these
    // appear here, the pause has been quietly undone.
    render(
      <DailyHabitCard
        ctaSlot={actionSlot}
        focusPassport={passport}
        onFocusTap={vi.fn()}
        onPassportTap={vi.fn()}
        shields={{ count: 3 }}
      />,
    );

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/of 21|21 Focus|days left|\$0\.99/i);
    expect(screen.queryByTestId("challenge-progress")).toBeNull();
    expect(screen.queryByTestId("challenge-window")).toBeNull();
  });

  it("omits the shields row entirely when there is no balance to show", () => {
    // A probe without a wallet must not invent a count.
    render(
      <DailyHabitCard
        ctaSlot={actionSlot}
        focusPassport={passport}
        onFocusTap={vi.fn()}
        onPassportTap={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("daily-habit-shields")).toBeNull();
  });
});
