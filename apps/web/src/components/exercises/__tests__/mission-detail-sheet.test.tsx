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

/** Convert a positional star array (legacy fixture shape) into the id-map
 *  PieceProgress reads, keyed by catalog order. Sparse: zero entries are
 *  dropped (absent id = not played). */
function makeProgress(piece: PieceId, stars: number[]): PieceProgress {
  const map: Record<string, number> = {};
  EXERCISES[piece].forEach((ex, i) => {
    if ((stars[i] ?? 0) > 0) map[ex.id] = stars[i];
  });
  return { piece, currentId: null, stars: map };
}

/** Capped at 2/exercise (not 3) so a 6★ total naturally spans 3+ exercises —
 *  matching LABYRINTH_MIN_EXERCISES instead of colliding it on exercise 2. */
function starsTotaling(piece: PieceId, total: number): number[] {
  return EXERCISES[piece].map(() => {
    const take = Math.min(2, total);
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

describe("<MissionDetailSheet> — off-chain save state (B2, Lote 2)", () => {
  it("shows the informative 'Score saved' state, never a green Save CTA", () => {
    renderSheet({ scoreSaved: true, score: "120" });

    expect(screen.getByTestId("score-saved-state")).toHaveTextContent(
      "Score saved",
    );
    // The off-chain save is automatic + free: no green protagonist CTA.
    expect(
      screen.queryByRole("button", { name: "Save score" }),
    ).not.toBeInTheDocument();
    // And no leaderboard "value" promise on the off-chain save.
    expect(screen.queryByText("Climb the leaderboard")).not.toBeInTheDocument();
  });

  it("surfaces a FREE manual retry only when the auto-save failed", async () => {
    const onRetrySave = vi.fn();
    const user = userEvent.setup();
    renderSheet({ saveFailed: true, onRetrySave, score: "120" });

    const retry = screen.getByRole("button", { name: "Retry save" });
    await user.click(retry);
    expect(onRetrySave).toHaveBeenCalledTimes(1);
  });

  it("disables the retry while a save is in flight", () => {
    renderSheet({
      saveFailed: true,
      onRetrySave: vi.fn(),
      isSavingScore: true,
      score: "120",
    });

    expect(screen.getByRole("button", { name: "Retry save" })).toBeDisabled();
  });

  it("renders no save state when there is no pending/saved score", () => {
    renderSheet({ canSaveScore: false });

    expect(
      screen.queryByRole("button", { name: "Save score" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry save" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("score-saved-state")).not.toBeInTheDocument();
  });

  it("keeps the on-chain proof as the only explicit save CTA", async () => {
    const onSaveOnChain = vi.fn();
    const user = userEvent.setup();
    renderSheet({
      canSaveScore: true,
      canSaveOnChain: true,
      onSaveOnChain,
      score: "120",
    });

    expect(screen.getByText("Save today’s training proof")).toBeInTheDocument();
    // No competing green off-chain CTA next to the gold proof.
    expect(
      screen.queryByRole("button", { name: "Save score" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save proof" }));
    expect(onSaveOnChain).toHaveBeenCalledTimes(1);
  });

  it("hides the on-chain action when unavailable (no dead buttons)", () => {
    renderSheet({
      canSaveScore: true,
      canSaveOnChain: false,
      onSaveOnChain: vi.fn(),
    });

    expect(
      screen.queryByRole("button", { name: "Save proof" }),
    ).not.toBeInTheDocument();
  });
});

describe("<MissionDetailSheet> — score breakdown (transparency)", () => {
  it("shows stars × 100 breakdown when canSaveScore + totalStars provided", () => {
    renderSheet({
      canSaveScore: true,
      score: "1200",
      totalStars: 12,
      maxPossibleStars: 30,
    });

    expect(screen.getByTestId("score-breakdown")).toBeInTheDocument();
    expect(screen.getByTestId("score-breakdown")).toHaveTextContent("12★ × 100");
  });

  it("shows Max indicator when totalStars equals maxPossibleStars", () => {
    renderSheet({
      canSaveScore: true,
      score: "3000",
      totalStars: 30,
      maxPossibleStars: 30,
    });

    expect(screen.getByTestId("score-breakdown")).toHaveTextContent("Max");
  });

  it("uses the Spanish localized breakdown with both star interpolations", () => {
    const onOpenChange = vi.fn();
    renderWithIntl(
      <MissionDetailSheet
        open
        onOpenChange={onOpenChange}
        selectedPiece="knight"
        targetLabel="e5"
        isCapture={false}
        score="3000"
        canSaveScore
        totalStars={30}
        maxPossibleStars={30}
        trigger={<button type="button">peek</button>}
      />,
      { locale: "es" },
    );

    expect(screen.getByTestId("score-breakdown")).toHaveTextContent(
      "30★ / 30★ · Máximo",
    );
  });

  it("does NOT show breakdown when totalStars is absent", () => {
    renderSheet({
      canSaveScore: true,
      score: "1200",
    });

    expect(screen.queryByTestId("score-breakdown")).not.toBeInTheDocument();
  });

  it("does NOT include labyrinths in the breakdown text", () => {
    renderSheet({
      canSaveScore: true,
      score: "1200",
      totalStars: 12,
      maxPossibleStars: 30,
    });

    const breakdown = screen.getByTestId("score-breakdown");
    expect(breakdown.textContent).not.toMatch(/labyrinth/i);
    expect(breakdown.textContent).not.toMatch(/maze/i);
  });

  it("scorePendingNew gate unchanged: breakdown does not appear when canSaveScore is false", () => {
    renderSheet({
      canSaveScore: false,
      score: "1200",
      totalStars: 12,
      maxPossibleStars: 30,
    });

    expect(screen.queryByTestId("score-breakdown")).not.toBeInTheDocument();
  });
});
