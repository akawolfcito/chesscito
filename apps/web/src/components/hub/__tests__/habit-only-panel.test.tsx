/**
 * Pausing the paid challenge must keep the panel AND the daily habit.
 *
 * ⛔ TWO MISTAKES, BOTH MINE, BOTH CLOSED HERE.
 *
 * 1. `ChallengeCard` returned `null` when sales were paused. It carried two
 *    products in one container — the paid 21-day challenge AND the free daily
 *    habit — so hiding the first deleted the second. The Learn hub lost its most
 *    used surface: 357 Daily starts in 7 days against 167 exercise touches.
 *
 * 2. The first fix rebuilt the habit in a NEW component beside this one, which
 *    threw away the panel and the weekday letters. The visual structure was
 *    worked out over time and copying it lost pieces of it silently
 *    (founder, 2026-08-25).
 *
 * So: same panel, same passport, same `?`, same CTA — minus everything that
 * belongs to the paused product.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { ChallengeCard } from "../challenge-card";
import type { ChallengeProgressView } from "@/lib/season-pass/focus-days";

const passport = {
  streak: 3,
  totalCompleted: 9,
  todayDone: false,
  isLoading: false,
  lastCompletedDate: "2026-08-24",
};

const challenge = {
  challengeGoalDays: 21,
  priceLabel: "$0.99",
  shieldBonus: 3,
} as never;

const HABIT_ONLY: ChallengeProgressView = { state: "unavailable" };

const OFFER: ChallengeProgressView = { state: "offer" };

function renderCard(progress: ChallengeProgressView) {
  return render(
    <ChallengeCard
      challenge={challenge}
      ctaSlot={{
        kind: "action",
        variant: "daily-pending",
        destination: "/exercises?piece=rook",
        labelKey: "ctaStartToday",
        noteKey: null,
      }}
      focusPassport={passport}
      onFocusTap={vi.fn()}
      onJoinChallenge={vi.fn()}
      onPassportTap={vi.fn()}
      onReplayTour={vi.fn()}
      progress={progress}
      seasonPass={{ active: false, isLoading: false }}
      shields={{ count: 2 }}
      today="2026-08-25"
    />,
  );
}

describe("habit-only panel (sales paused)", () => {
  it("KEEPS the panel — it must not vanish", () => {
    renderCard(HABIT_ONLY);
    expect(screen.getByTestId("challenge-card")).toBeInTheDocument();
  });

  it("KEEPS the weekly row with its day letters", () => {
    // The first fix swapped this for the standalone FocusPassport, which has no
    // weekday letters and no real dates. That regression is what this pins.
    renderCard(HABIT_ONLY);
    expect(screen.getAllByTestId("challenge-week-day").length).toBe(7);
  });

  it("KEEPS the mini-tour help chip", () => {
    renderCard(HABIT_ONLY);
    expect(screen.getByTestId("challenge-replay-tour")).toBeInTheDocument();
  });

  it("KEEPS the Start Focus CTA", () => {
    renderCard(HABIT_ONLY);
    expect(screen.getByTestId("challenge-cta")).toBeInTheDocument();
  });

  it("DROPS the benefits row — those are terms of a paused sale", () => {
    renderCard(HABIT_ONLY);
    expect(screen.queryByTestId("challenge-stats")).toBeNull();
  });

  it("DROPS the purchase banner, however unbought the pass is", () => {
    renderCard(HABIT_ONLY);
    // The PRICE badge is what only the purchase banner has. The chevron is
    // NOT: the ordinary loop CTA draws one too, so asserting on it would fail
    // for the wrong reason.
    expect(screen.queryByTestId("challenge-cta-price")).toBeNull();
  });

  it("DROPS the 21-day counter and the window", () => {
    renderCard(HABIT_ONLY);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/of 21|21 Focus|days left|\$0\.99/i);
  });

  it("⛔ the OFFER state is untouched — the pause changed nothing for it", () => {
    // Re-enabling sales must bring the whole card back, benefits and banner
    // included. If this goes red, the pause stopped being reversible.
    renderCard(OFFER);
    expect(screen.getByTestId("challenge-stats")).toBeInTheDocument();
    expect(screen.getByTestId("challenge-card")).toBeInTheDocument();
  });
});
