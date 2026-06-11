import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";

import { renderWithIntl } from "@/test-utils/render-with-intl";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import type { PieceId, PieceProgress } from "@/lib/game/types";
import {
  buildTrainingPath,
  type TrainingPathInput,
} from "@/lib/training/path";
import { TrainingPathRail } from "@/components/exercises/training-path-rail";

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

describe("<TrainingPathRail> — read-only path", () => {
  it("renders every node group: exercise chips, labyrinth rows, badge, mastery", () => {
    renderWithIntl(<TrainingPathRail path={knightPath()} connected={false} />);

    expect(
      screen.getAllByLabelText(/Exercise \d+: \d of 3 stars/),
    ).toHaveLength(EXERCISES.knight.length);
    expect(screen.getAllByText(/Labyrinth \d+/)).toHaveLength(
      LABYRINTHS.knight.length,
    );
    expect(screen.getByText("Badge")).toBeInTheDocument();
    expect(screen.getByText("Mastery")).toBeInTheDocument();
  });

  it("0★: labyrinths locked with rule-specific copy, badge + mastery locked", () => {
    renderWithIntl(<TrainingPathRail path={knightPath()} connected={false} />);

    expect(screen.getByText("Unlocks at 6★")).toBeInTheDocument();
    expect(screen.getAllByText("Beat previous lab")).toHaveLength(
      LABYRINTHS.knight.length - 1,
    );
    expect(screen.getByText("Badge at 10★")).toBeInTheDocument();
    expect(screen.getByText("Badge + labyrinths")).toBeInTheDocument();
  });

  it("6★: first labyrinth shows as ready", () => {
    const path = knightPath({
      progress: makeProgress("knight", starsTotaling("knight", 6)),
    });
    renderWithIntl(<TrainingPathRail path={path} connected={false} />);

    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getAllByText("Beat previous lab")).toHaveLength(
      LABYRINTHS.knight.length - 1,
    );
  });

  it("10★ with labyrinths incomplete: badge ready, mastery explains both rules (P0-3)", () => {
    const path = knightPath({
      progress: makeProgress("knight", starsTotaling("knight", 10)),
    });
    renderWithIntl(<TrainingPathRail path={path} connected={true} />);

    // Badge communicates its own stars rule, milestone is not blocked by labs.
    expect(screen.getByText("Badge ready")).toBeInTheDocument();
    // Mastery explains it needs the labyrinth leg too, instead of looking broken.
    expect(screen.getByText("Badge + labyrinths")).toBeInTheDocument();
    expect(screen.queryByText("Mastered")).not.toBeInTheDocument();
  });

  it("guest at 10★: badge milestone asks to connect instead of claiming", () => {
    const path = knightPath({
      progress: makeProgress("knight", starsTotaling("knight", 10)),
    });
    renderWithIntl(<TrainingPathRail path={path} connected={false} />);

    expect(screen.getByText("Connect to claim")).toBeInTheDocument();
    expect(screen.queryByText("Badge ready")).not.toBeInTheDocument();
  });

  it("completed labyrinth shows its derived stars", () => {
    const path = knightPath({
      progress: makeProgress("knight", starsTotaling("knight", 6)),
      labyrinthBests: { "knight-lab-1": 5 }, // optimal 3 → 2★
    });
    renderWithIntl(<TrainingPathRail path={path} connected={false} />);

    expect(screen.getByText("2★")).toBeInTheDocument();
  });

  it("mastered state: badge claimed + all labyrinths solved", () => {
    const path = knightPath({
      badgeClaimed: true,
      labyrinthBests: Object.fromEntries(
        LABYRINTHS.knight.map((lab) => [lab.id, lab.optimalMoves]),
      ),
    });
    renderWithIntl(<TrainingPathRail path={path} connected={true} />);

    expect(screen.getByText("Claimed")).toBeInTheDocument();
    expect(screen.getByText("Mastered")).toBeInTheDocument();
  });

  it("is strictly read-only: renders no interactive elements", () => {
    renderWithIntl(
      <TrainingPathRail
        path={knightPath({
          progress: makeProgress("knight", starsTotaling("knight", 10)),
        })}
        connected={true}
      />,
    );

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });
});
