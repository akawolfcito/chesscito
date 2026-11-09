import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DailyTacticCard } from "../daily-tactic-card";

const baseProps = {
  puzzleName: "Smothered mate",
  streak: 0,
  isCompletedToday: false,
  hoursUntilNext: 12,
};

function getStone(): HTMLButtonElement {
  return screen
    .getByTestId("daily-tactic-card")
    .querySelector('[data-component="stone-pedestal"]') as HTMLButtonElement;
}

describe("DailyTacticCard — pending state (post-StonePedestal migration)", () => {
  it("wraps the pedestal in <span data-testid='daily-tactic-card' data-state='pending'>", () => {
    render(<DailyTacticCard {...baseProps} onPlay={() => {}} />);
    const card = screen.getByTestId("daily-tactic-card");
    expect(card.tagName).toBe("SPAN");
    expect(card.getAttribute("data-state")).toBe("pending");
    expect(
      card.querySelector('[data-component="stone-pedestal"]'),
    ).not.toBeNull();
  });

  it("inner StonePedestal is enabled <button> when pending", () => {
    render(<DailyTacticCard {...baseProps} onPlay={() => {}} />);
    const stone = getStone();
    expect(stone.tagName).toBe("BUTTON");
    expect(stone.disabled).toBe(false);
  });

  it("aria-label embeds the puzzle name when pending", () => {
    render(
      <DailyTacticCard
        {...baseProps}
        puzzleName="Fork the king"
        onPlay={() => {}}
      />,
    );
    expect(getStone().getAttribute("aria-label")).toMatch(/Fork the king/);
  });

  it("clicking the pedestal fires onPlay", () => {
    const onPlay = vi.fn();
    render(<DailyTacticCard {...baseProps} onPlay={onPlay} />);
    fireEvent.click(getStone());
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it("hides the streak badge when streak=0", () => {
    render(<DailyTacticCard {...baseProps} streak={0} onPlay={() => {}} />);
    expect(screen.queryByTestId("daily-tactic-streak")).toBeNull();
  });

  it("renders the streak badge when streak>0", () => {
    render(<DailyTacticCard {...baseProps} streak={5} onPlay={() => {}} />);
    expect(screen.getByTestId("daily-tactic-streak").textContent).toBe("5");
  });
});

describe("DailyTacticCard — completed state", () => {
  const completedProps = {
    puzzleName: "Smothered mate",
    streak: 3,
    isCompletedToday: true,
    hoursUntilNext: 8,
  };

  it("wrapper data-state='completed', inner StonePedestal disabled", () => {
    render(<DailyTacticCard {...completedProps} onPlay={() => {}} />);
    const card = screen.getByTestId("daily-tactic-card");
    expect(card.getAttribute("data-state")).toBe("completed");
    expect(getStone().disabled).toBe(true);
  });

  it("aria-label includes 'completed' + the next-window timer", () => {
    render(
      <DailyTacticCard
        {...completedProps}
        hoursUntilNext={8}
        onPlay={() => {}}
      />,
    );
    const label = getStone().getAttribute("aria-label") ?? "";
    expect(label).toMatch(/completed/i);
    expect(label).toMatch(/fresh in 8h/i);
  });

  it("aria-label uses '<1h' for sub-hour windows", () => {
    render(
      <DailyTacticCard
        {...completedProps}
        hoursUntilNext={0.5}
        onPlay={() => {}}
      />,
    );
    expect(getStone().getAttribute("aria-label")).toMatch(/<1h/i);
  });

  it("click is suppressed when completed (disabled button)", () => {
    const onPlay = vi.fn();
    render(<DailyTacticCard {...completedProps} onPlay={onPlay} />);
    fireEvent.click(getStone());
    expect(onPlay).not.toHaveBeenCalled();
  });

  it("renders the streak badge when completed + streak>0", () => {
    render(<DailyTacticCard {...completedProps} streak={7} onPlay={() => {}} />);
    expect(screen.getByTestId("daily-tactic-streak").textContent).toBe("7");
  });

  it("hides the streak badge when completed + streak=0", () => {
    render(<DailyTacticCard {...completedProps} streak={0} onPlay={() => {}} />);
    expect(screen.queryByTestId("daily-tactic-streak")).toBeNull();
  });
});
