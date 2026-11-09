import { describe, it, expect } from "vitest";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import { AchievementsGrid } from "@/components/trophies/achievements-grid";
import { deriveLiteAchievements } from "@/lib/achievements/lite";
import type { DailyProgress } from "@/lib/daily/progress";

function progress(overrides: Partial<DailyProgress> = {}): DailyProgress {
  return { streak: 0, lastCompletedDate: null, totalCompleted: 0, ...overrides };
}

describe("<AchievementsGrid> Lite achievements", () => {
  it("renders 4 achievement tiles when progress is zero (all unearned)", () => {
    const achievements = deriveLiteAchievements(progress(), false);
    render(<AchievementsGrid achievements={achievements} />);
    expect(screen.getByText("First Focus Day")).toBeInTheDocument();
    expect(screen.getByText("First Great Session")).toBeInTheDocument();
    expect(screen.getByText("3-Day Rhythm")).toBeInTheDocument();
    expect(screen.getByText("7-Day Focus")).toBeInTheDocument();
  });

  it("marks First Focus Day as earned when totalCompleted=1", () => {
    const achievements = deriveLiteAchievements(progress({ totalCompleted: 1, streak: 1 }), false);
    const { container } = render(<AchievementsGrid achievements={achievements} />);
    // Unearned tiles with progress bars show .achievement-tile--locked class
    expect(container.querySelectorAll(".achievement-tile--locked")).toHaveLength(3);
    // Earned chip is a <span> from CandyChip (not the section header h3)
    expect(screen.getAllByText("Earned", { selector: "span" })).toHaveLength(1);
  });

  it("marks first + rhythm as earned when streak=3", () => {
    const achievements = deriveLiteAchievements(progress({ totalCompleted: 3, streak: 3 }), false);
    const { container } = render(<AchievementsGrid achievements={achievements} />);
    expect(container.querySelectorAll(".achievement-tile--locked")).toHaveLength(2);
    expect(screen.getAllByText("Earned", { selector: "span" })).toHaveLength(2);
  });

  it("marks all 4 earned when streak=7 and hadGreatSession=true", () => {
    const achievements = deriveLiteAchievements(progress({ totalCompleted: 7, streak: 7 }), true);
    const { container } = render(<AchievementsGrid achievements={achievements} />);
    expect(container.querySelectorAll(".achievement-tile--locked")).toHaveLength(0);
    expect(screen.getAllByText("Earned", { selector: "span" })).toHaveLength(4);
  });

  it("copy contains no prohibited terms", () => {
    const achievements = deriveLiteAchievements(progress(), false);
    render(<AchievementsGrid achievements={achievements} />);
    const container = screen.getByRole("button", { name: /first focus day/i }).closest(".flex");
    const text = container?.textContent ?? document.body.textContent ?? "";
    const prohibited = ["verified", "on-chain", "proof", "nft", "mint", "blockchain", "brain health", "cure", "improves memory", "improves focus"];
    for (const term of prohibited) {
      expect(text.toLowerCase()).not.toContain(term);
    }
  });
});
