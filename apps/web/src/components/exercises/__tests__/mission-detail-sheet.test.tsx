import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";

import { renderWithIntl } from "@/test-utils/render-with-intl";
import { EXERCISES } from "@/lib/game/exercises";
import type { PieceId, PieceProgress } from "@/lib/game/types";
import {
  buildTrainingPath,
  type TrainingPathInput,
} from "@/lib/training/path";
import { MissionDetailSheet } from "@/components/exercises/mission-detail-sheet";

function makeProgress(piece: PieceId, stars: number[]): PieceProgress {
  return { piece, exerciseIndex: 0, stars };
}

function starsTotaling(piece: PieceId, total: number): number[] {
  return EXERCISES[piece].map(() => {
    const take = Math.min(3, total);
    total -= take;
    return take;
  });
}

function knightPath(overrides: Partial<TrainingPathInput> = {}) {
  return buildTrainingPath({
    piece: "knight",
    progress: makeProgress("knight", starsTotaling("knight", 0)),
    labyrinthBests: {},
    badgeClaimed: false,
    ...overrides,
  });
}

function renderSheet(
  props: Partial<React.ComponentProps<typeof MissionDetailSheet>> = {},
) {
  const onOpenChange = vi.fn();
  const result = renderWithIntl(
    <MissionDetailSheet
      open
      onOpenChange={onOpenChange}
      selectedPiece="knight"
      targetLabel="e5"
      isCapture={false}
      score="0"
      trigger={<button type="button">peek</button>}
      {...props}
    />,
  );
  return { onOpenChange, ...result };
}

describe("<MissionDetailSheet> — guide-only surface (redistribution D1)", () => {
  it("renders the objective and hint, and NO path/journey sections", () => {
    renderSheet({ trainingPath: knightPath() });

    expect(
      screen.getByText("Move your Knight to e5"),
    ).toBeInTheDocument();
    // TrainingPathRail and JourneyRail left Mission (D1/D2).
    expect(screen.queryByText("Training path")).not.toBeInTheDocument();
    expect(screen.queryByText("Your journey")).not.toBeInTheDocument();
    expect(screen.queryByText("Milestones")).not.toBeInTheDocument();
  });

  it("shows a tappable 'Now' line when the path recommends a labyrinth", async () => {
    const onLabyrinthSelect = vi.fn();
    const user = userEvent.setup();
    const { onOpenChange } = renderSheet({
      trainingPath: knightPath({
        progress: makeProgress("knight", starsTotaling("knight", 6)),
      }),
      onLabyrinthSelect,
    });

    const nowLine = screen.getByRole("button", {
      name: "Start Labyrinth 1",
    });
    expect(nowLine).toHaveTextContent("Now: Labyrinth 1");

    await user.click(nowLine);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onLabyrinthSelect).toHaveBeenCalledWith("knight-lab-1");
  });

  it("renders no 'Now' line when no labyrinth is pending", () => {
    renderSheet({
      trainingPath: knightPath(), // 0★ — every lab locked
      onLabyrinthSelect: vi.fn(),
    });

    expect(
      screen.queryByRole("button", { name: /Start Labyrinth/ }),
    ).not.toBeInTheDocument();
  });
});

describe("<MissionDetailSheet> — save score affordance (D5)", () => {
  it("renders the promise line + save button and fires the handler", async () => {
    const onSaveScore = vi.fn();
    const user = userEvent.setup();
    renderSheet({ canSaveScore: true, onSaveScore, score: "120" });

    // Promise-first narrative (QA F5/G3): the off-chain save promises
    // the leaderboard, never on-chain permanence.
    expect(screen.getByText("Climb the leaderboard")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save score" }));
    expect(onSaveScore).toHaveBeenCalledTimes(1);
  });

  it("disables the save button while a save is in flight", () => {
    renderSheet({
      canSaveScore: true,
      onSaveScore: vi.fn(),
      isSavingScore: true,
      score: "120",
    });

    expect(screen.getByRole("button", { name: "Save score" })).toBeDisabled();
  });

  it("renders no save button when saving is not available", () => {
    renderSheet({ canSaveScore: false, onSaveScore: vi.fn() });

    expect(
      screen.queryByRole("button", { name: "Save score" }),
    ).not.toBeInTheDocument();
  });

  it("renders the on-chain save action when available and fires its handler", async () => {
    const onSaveOnChain = vi.fn();
    const user = userEvent.setup();
    renderSheet({
      canSaveScore: true,
      onSaveScore: vi.fn(),
      canSaveOnChain: true,
      onSaveOnChain,
      score: "120",
    });

    // Its own promise line, distinct from the leaderboard one.
    expect(screen.getByText("Yours for life")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveOnChain).toHaveBeenCalledTimes(1);
  });

  it("hides the on-chain action when unavailable (no dead buttons)", () => {
    renderSheet({
      canSaveScore: true,
      onSaveScore: vi.fn(),
      canSaveOnChain: false,
      onSaveOnChain: vi.fn(),
    });

    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();
  });
});
