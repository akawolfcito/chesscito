import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { TrainingContentGate } from "@/components/exercises/training-content-gate";
import { KNIGHT_TOUR } from "@/lib/game/exercises";

const [baseTour, premiumTour] = KNIGHT_TOUR.knight;

describe("TrainingContentGate", () => {
  it("mounts base content while entitlement is unresolved", () => {
    render(
      <TrainingContentGate
        content={baseTour}
        trainingPass={{ active: false, source: null, loading: true }}
        attemptGrantId={null}
      >
        <div data-testid="game" />
      </TrainingContentGate>,
    );
    expect(screen.getByTestId("game")).toBeInTheDocument();
  });

  it("mounts neither premium game nor locked upsell while loading", () => {
    render(
      <TrainingContentGate
        content={premiumTour}
        trainingPass={{ active: false, source: null, loading: true }}
        attemptGrantId={null}
      >
        <div data-testid="game" />
      </TrainingContentGate>,
    );
    expect(screen.queryByTestId("game")).toBeNull();
    expect(screen.getByTestId("training-content-access-loading")).toBeInTheDocument();
    expect(screen.queryByText("Unlock Challenges")).toBeNull();
  });

  it("does not mount denied premium content", () => {
    const { container } = render(
      <TrainingContentGate
        content={premiumTour}
        trainingPass={{ active: false, source: null, loading: false }}
        attemptGrantId={null}
      >
        <div data-testid="game" />
      </TrainingContentGate>,
    );
    expect(screen.queryByTestId("game")).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it.each(["season_pass", "pro"] as const)(
    "mounts premium content for active %s access",
    (source) => {
      render(
        <TrainingContentGate
          content={premiumTour}
          trainingPass={{ active: true, source, loading: false }}
          attemptGrantId={null}
        >
          <div data-testid="game" />
        </TrainingContentGate>,
      );
      expect(screen.getByTestId("game")).toBeInTheDocument();
    },
  );

  it("keeps only the granted attempt mounted after expiry", () => {
    const { rerender } = render(
      <TrainingContentGate
        content={premiumTour}
        trainingPass={{ active: false, source: null, loading: false }}
        attemptGrantId={premiumTour.id}
      >
        <div data-testid="game" />
      </TrainingContentGate>,
    );
    expect(screen.getByTestId("game")).toBeInTheDocument();

    rerender(
      <TrainingContentGate
        content={premiumTour}
        trainingPass={{ active: false, source: null, loading: false }}
        attemptGrantId={null}
      >
        <div data-testid="game" />
      </TrainingContentGate>,
    );
    expect(screen.queryByTestId("game")).toBeNull();
  });
});
