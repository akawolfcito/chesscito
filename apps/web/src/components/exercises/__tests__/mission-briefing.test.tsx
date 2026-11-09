import { describe, expect, it, vi } from "vitest";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import {
  MissionBriefing,
  shouldShowMissionBriefing,
} from "@/components/exercises/mission-briefing";

describe("<MissionBriefing> — exercise mode (unchanged)", () => {
  it("renders the move objective with the square target", () => {
    render(
      <MissionBriefing
        pieceType="rook"
        targetLabel="h1"
        isCapture={false}
        onPlay={vi.fn()}
      />,
    );
    expect(screen.getByText(/Move your Rook to h1/i)).toBeInTheDocument();
  });
});

describe("shouldShowMissionBriefing — mount guard", () => {
  const clear = {
    showBriefing: true,
    dockSheetOpen: false,
    proSheetOpen: false,
    accountSheetOpen: false,
    labyrinthActive: false,
  };

  it("shows on a clear exercise view", () => {
    expect(shouldShowMissionBriefing(clear)).toBe(true);
  });

  it("defers while the labyrinth layer is active (micro-fix 2026-06-11)", () => {
    // A deferred first-visit briefing must NEVER mount over a labyrinth:
    // the exercise objective would interpolate the live move counter
    // ("Move your Rook to 0 / 3 moves").
    expect(
      shouldShowMissionBriefing({ ...clear, labyrinthActive: true }),
    ).toBe(false);
  });

  it("keeps the existing deferrals: dock / pro / account sheets", () => {
    expect(shouldShowMissionBriefing({ ...clear, dockSheetOpen: true })).toBe(false);
    expect(shouldShowMissionBriefing({ ...clear, proSheetOpen: true })).toBe(false);
    expect(shouldShowMissionBriefing({ ...clear, accountSheetOpen: true })).toBe(false);
  });

  it("never shows once onboarded", () => {
    expect(shouldShowMissionBriefing({ ...clear, showBriefing: false })).toBe(false);
  });
});
