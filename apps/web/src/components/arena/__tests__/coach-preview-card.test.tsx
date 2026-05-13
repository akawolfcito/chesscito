import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CoachPreviewCard } from "../coach-preview-card";

describe("CoachPreviewCard", () => {
  it("renders the locked full review benefits for non-PRO users", async () => {
    const onPrimaryCta = vi.fn();
    render(
      <CoachPreviewCard
        proActive={false}
        difficultyLabel="Easy"
        resultLabel="win"
        moveCount={12}
        onPrimaryCta={onPrimaryCta}
      />,
    );

    expect(screen.getByText("Coach Preview")).toBeInTheDocument();
    expect(screen.getByText(/You finished a Easy match in 12 moves/i)).toBeInTheDocument();
    expect(screen.getByText(/behind your win/i)).toBeInTheDocument();
    expect(screen.getByText("Key moments")).toBeInTheDocument();
    expect(screen.getByText("Better moves")).toBeInTheDocument();
    expect(screen.getByText("Next training")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Unlock Full Review" }));
    expect(onPrimaryCta).toHaveBeenCalledTimes(1);
  });

  it("renders the active Coach Review action without locked benefit chips", async () => {
    const onPrimaryCta = vi.fn();
    render(
      <CoachPreviewCard
        proActive
        difficultyLabel="Hard"
        resultLabel="loss"
        moveCount={28}
        onPrimaryCta={onPrimaryCta}
      />,
    );

    expect(screen.getByText("Coach Review Ready")).toBeInTheDocument();
    expect(screen.getByText("Review your key moments and next training step.")).toBeInTheDocument();
    expect(screen.queryByText("Better moves")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Review Match" }));
    expect(onPrimaryCta).toHaveBeenCalledTimes(1);
  });
});
