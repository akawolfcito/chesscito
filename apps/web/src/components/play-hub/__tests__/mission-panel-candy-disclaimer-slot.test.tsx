import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Lottie pulls in canvas APIs that jsdom does not provide. Stub the
// wrapper so the panel mounts cleanly in unit tests.
vi.mock("@/components/ui/lottie-animation", () => ({
  LottieAnimation: () => null,
}));

import { MissionPanelCandy } from "../mission-panel-candy";

const baseProps = {
  selectedPiece: "rook" as const,
  onSelectPiece: () => {},
  pieces: [
    { key: "rook" as const, label: "Rook", enabled: true },
  ],
  phase: "ready" as const,
  targetLabel: "a1",
  score: "0",
  timeMs: "00:00",
  board: <div data-testid="mock-board">board</div>,
  exerciseDrawer: <div data-testid="mock-drawer">drawer</div>,
  isReplay: false,
  contextualAction: <div data-testid="mock-action">action</div>,
  persistentDock: <nav data-testid="mock-dock">dock</nav>,
  currentStars: 0,
  claimedBadges: {},
  isDockSheetOpen: false,
};

describe("MissionPanelCandy — disclaimerSlot", () => {
  it("renders the disclaimer node when the disclaimerSlot prop is provided", () => {
    render(
      <MissionPanelCandy
        {...baseProps}
        disclaimerSlot={
          <p data-testid="disclaimer-probe">does not replace medical diagnosis</p>
        }
      />,
    );
    expect(screen.getByTestId("disclaimer-probe")).toBeInTheDocument();
  });

  it("does not render any extra slot content when disclaimerSlot is omitted", () => {
    render(<MissionPanelCandy {...baseProps} />);
    expect(screen.queryByTestId("disclaimer-probe")).not.toBeInTheDocument();
  });

  it("renders the disclaimer above the persistent dock in the DOM order", () => {
    render(
      <MissionPanelCandy
        {...baseProps}
        disclaimerSlot={<p data-testid="disclaimer-probe">disclaimer</p>}
      />,
    );
    const disclaimer = screen.getByTestId("disclaimer-probe");
    const dock = screen.getByTestId("mock-dock");
    // DOCUMENT_POSITION_FOLLOWING (0x04) means dock comes after disclaimer.
    // eslint-disable-next-line no-bitwise
    expect(disclaimer.compareDocumentPosition(dock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
