import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";

import { ExerciseDrawer } from "@/components/exercises/exercise-drawer";
import { EXERCISES, KNIGHT_TOUR } from "@/lib/game/exercises";
import type { TrainingNode } from "@/lib/training/path";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

const premiumTour = KNIGHT_TOUR.knight[1];
const premiumNode: TrainingNode = {
  id: premiumTour.id,
  kind: "labyrinth",
  piece: "knight",
  unlock: { type: "always" },
  status: "available",
  stars: 0,
  awardsStars: false,
};

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  piece: "knight" as const,
  exercises: EXERCISES.knight,
  stars: {},
  activeIndex: 0,
  totalStars: 0,
  onNavigate: vi.fn(),
  labyrinthNodes: [premiumNode],
  labyrinthLabels: { [premiumTour.id]: "Wider Ground" },
};

describe("ExerciseDrawer Training Pass nodes", () => {
  it("shows compact lock copy and opens checkout only from the locked node tap", () => {
    const onOpenChange = vi.fn();
    const onTrainingPassUnlock = vi.fn();
    const onLabyrinthSelect = vi.fn();
    render(
      <ExerciseDrawer
        {...baseProps}
        onOpenChange={onOpenChange}
        onLabyrinthSelect={onLabyrinthSelect}
        labyrinthAccess={{
          [premiumTour.id]: {
            allowed: false,
            reason: "training_pass_required",
          },
        }}
        onTrainingPassUnlock={onTrainingPassUnlock}
      />,
    );

    const node = screen.getByRole("button", {
      name: "Wider Ground. Challenge Pass / PRO. Unlock Challenges",
    });
    expect(node).toHaveAttribute("data-access-locked", "true");
    expect(screen.getByText("Challenge Pass / PRO")).toBeInTheDocument();
    expect(screen.getByText("Unlock Challenges")).toBeInTheDocument();

    fireEvent.click(node);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onTrainingPassUnlock).toHaveBeenCalledTimes(1);
    expect(onLabyrinthSelect).not.toHaveBeenCalled();
  });

  it("renders no lock or upsell while entitlement is loading", () => {
    const onTrainingPassUnlock = vi.fn();
    const onLabyrinthSelect = vi.fn();
    render(
      <ExerciseDrawer
        {...baseProps}
        onLabyrinthSelect={onLabyrinthSelect}
        labyrinthAccess={{ [premiumTour.id]: { pending: true } }}
        onTrainingPassUnlock={onTrainingPassUnlock}
      />,
    );

    const node = screen.getByRole("button", { name: "Wider Ground" });
    expect(node).toHaveAttribute("data-access-pending", "true");
    expect(node).not.toHaveAttribute("data-locked");
    expect(node).toBeDisabled();
    expect(screen.queryByText("Unlock Challenges")).toBeNull();
    fireEvent.click(node);
    expect(onTrainingPassUnlock).not.toHaveBeenCalled();
    expect(onLabyrinthSelect).not.toHaveBeenCalled();
  });

  it("starts the premium node normally when effective access is active", () => {
    const onLabyrinthSelect = vi.fn();
    render(
      <ExerciseDrawer
        {...baseProps}
        onLabyrinthSelect={onLabyrinthSelect}
        labyrinthAccess={{ [premiumTour.id]: { allowed: true } }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Wider Ground" }));
    expect(onLabyrinthSelect).toHaveBeenCalledWith(premiumTour.id);
    expect(screen.queryByText("Unlock Challenges")).toBeNull();
  });
});
