import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DailyTacticCard } from "../daily-tactic-card";

describe("DailyTacticCard — pending state", () => {
  const baseProps = {
    puzzleName: "Smothered mate",
    streak: 0,
    isCompletedToday: false,
    hoursUntilNext: 12,
  };

  it("shows the puzzle name and a Play CTA when not yet completed today", () => {
    render(<DailyTacticCard {...baseProps} onPlay={() => {}} />);
    expect(screen.getByText("Smothered mate")).toBeInTheDocument();
    expect(screen.getByText("Play")).toBeInTheDocument();
  });

  it("renders an interactive button (not a div) when pending", () => {
    render(<DailyTacticCard {...baseProps} onPlay={() => {}} />);
    const card = screen.getByTestId("daily-tactic-card");
    expect(card.tagName).toBe("BUTTON");
    expect(card).toHaveAttribute("data-state", "pending");
  });

  it("calls onPlay when the card is clicked", () => {
    const onPlay = vi.fn();
    render(<DailyTacticCard {...baseProps} onPlay={onPlay} />);
    fireEvent.click(screen.getByTestId("daily-tactic-card"));
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it("uses an encouraging copy when streak is 0", () => {
    render(<DailyTacticCard {...baseProps} streak={0} onPlay={() => {}} />);
    expect(screen.getByText(/Start your streak/i)).toBeInTheDocument();
  });

  it("shows the current streak when > 0", () => {
    render(<DailyTacticCard {...baseProps} streak={5} onPlay={() => {}} />);
    expect(screen.getByText(/Streak: 5 days/i)).toBeInTheDocument();
  });

  it("uses singular 'day' for streak of 1", () => {
    render(<DailyTacticCard {...baseProps} streak={1} onPlay={() => {}} />);
    expect(screen.getByText(/Streak: 1 day$/)).toBeInTheDocument();
  });
});

describe("DailyTacticCard — completed state", () => {
  const completedProps = {
    puzzleName: "Smothered mate",
    streak: 3,
    isCompletedToday: true,
    hoursUntilNext: 8,
  };

  it("renders a non-interactive div when completed", () => {
    render(<DailyTacticCard {...completedProps} onPlay={() => {}} />);
    const card = screen.getByTestId("daily-tactic-card");
    expect(card.tagName).toBe("DIV");
    expect(card).toHaveAttribute("data-state", "completed");
  });

  it("shows 'Solved!' instead of the puzzle name", () => {
    render(<DailyTacticCard {...completedProps} onPlay={() => {}} />);
    expect(screen.getByText("Solved!")).toBeInTheDocument();
    expect(screen.queryByText("Smothered mate")).not.toBeInTheDocument();
  });

  it("shows the next-window timer", () => {
    render(<DailyTacticCard {...completedProps} hoursUntilNext={8} onPlay={() => {}} />);
    expect(screen.getByText(/fresh in 8h/i)).toBeInTheDocument();
  });

  it("shows the streak badge with day count", () => {
    render(<DailyTacticCard {...completedProps} streak={7} onPlay={() => {}} />);
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("days")).toBeInTheDocument();
  });

  it("hides the streak badge when streak is 0 (player just broke streak)", () => {
    render(<DailyTacticCard {...completedProps} streak={0} onPlay={() => {}} />);
    expect(screen.queryByText(/days?$/i)).not.toBeInTheDocument();
  });

  it("formats sub-hour windows as <1h", () => {
    render(<DailyTacticCard {...completedProps} hoursUntilNext={0.5} onPlay={() => {}} />);
    expect(screen.getByText(/fresh in <1h/i)).toBeInTheDocument();
  });
});
