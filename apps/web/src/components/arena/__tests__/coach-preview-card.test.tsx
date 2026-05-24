import { describe, expect, it, vi } from "vitest";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import userEvent from "@testing-library/user-event";

import { CoachPreviewCard } from "../coach-preview-card";
import { ARENA_COPY } from "@/lib/content/editorial";

// Pull canonical copy from editorial so the assertions track future
// renames automatically (the post-PRO-discoverability refactor renamed
// "Unlock Full Review" → "PRO REVIEW" and "Coach Review Ready" →
// "REVIEW"; the test had not been updated).
const COPY = ARENA_COPY.coachPreview;

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

    expect(screen.getByText(COPY.inactiveTitle)).toBeInTheDocument();
    expect(screen.getByText(/You finished a Easy match in 12 moves/i)).toBeInTheDocument();
    expect(screen.getByText(/behind your win/i)).toBeInTheDocument();
    for (const benefit of COPY.lockedBenefits) {
      expect(screen.getByText(benefit)).toBeInTheDocument();
    }

    await userEvent.click(screen.getByRole("button", { name: COPY.inactiveCta }));
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

    expect(screen.getAllByText(COPY.activeTitle).length).toBeGreaterThan(0);
    expect(screen.getByText(COPY.activeBody)).toBeInTheDocument();
    // Locked benefits chips should not render in active mode.
    for (const benefit of COPY.lockedBenefits) {
      expect(screen.queryByText(benefit)).not.toBeInTheDocument();
    }

    await userEvent.click(screen.getByRole("button", { name: COPY.activeCta }));
    expect(onPrimaryCta).toHaveBeenCalledTimes(1);
  });
});
