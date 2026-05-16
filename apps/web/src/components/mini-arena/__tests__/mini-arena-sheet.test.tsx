import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MiniArenaSheet } from "../mini-arena-sheet";
import type { MiniArenaSetup } from "@/lib/game/mini-arena";

const SETUP: MiniArenaSetup = {
  id: "kr-vs-k",
  name: "K+R vs K",
  description: "The classic endgame.",
  fen: "4k3/8/8/8/8/8/8/R3K3 w - - 0 1",
  parMoves: 16,
  aiLevel: 0,
};

// Mock haptics to avoid runtime issues in test environment.
vi.mock("@/lib/haptics", () => ({
  hapticImpact: vi.fn(),
  hapticReject: vi.fn(),
  hapticSuccess: vi.fn(),
  hapticTap: vi.fn(),
}));

// Mock ArenaBoard since it depends on canvas/image rendering.
vi.mock("@/components/arena/arena-board", () => ({
  ArenaBoard: (props: Record<string, unknown>) => (
    <div data-testid="arena-board" data-props={JSON.stringify(props)}>
      ArenaBoard
    </div>
  ),
}));

// Mock ShareModal.
vi.mock("@/components/share/share-modal", () => ({
  ShareModal: (props: Record<string, unknown>) => (
    <div data-testid="share-modal" data-props={JSON.stringify(props)}>
      ShareModal
    </div>
  ),
}));

// Mock CandyIcon to avoid icon resolution issues.
vi.mock("@/components/redesign/candy-icon", () => ({
  CandyIcon: (props: Record<string, unknown>) => (
    <span data-testid="candy-icon" data-name={props.name}>
      {props.name}
    </span>
  ),
}));

// Mock MissionHeaderCandy.
vi.mock("@/components/exercises/mission-header-candy", () => ({
  MissionHeaderCandy: (props: Record<string, unknown>) => (
    <div data-testid="mission-header" data-title={props.title}>
      {props.title}
    </div>
  ),
}));

describe("MiniArenaSheet — rendering", () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <MiniArenaSheet
        open={false}
        onOpenChange={onOpenChange}
        setup={SETUP}
      />,
    );
    expect(container.querySelector('[data-testid="mini-arena-sheet"]'))
      .toBeNull();
  });

  it("renders the sheet content when open", () => {
    render(
      <MiniArenaSheet
        open
        onOpenChange={onOpenChange}
        setup={SETUP}
      />,
    );
    expect(screen.getByTestId("mini-arena-sheet")).toBeInTheDocument();
  });

  it("shows the mission header with setup name", () => {
    render(
      <MiniArenaSheet
        open
        onOpenChange={onOpenChange}
        setup={SETUP}
      />,
    );
    expect(screen.getByTestId("mission-header")).toHaveAttribute(
      "data-title",
      "K+R vs K",
    );
  });

  it("renders the ArenaBoard", () => {
    render(
      <MiniArenaSheet
        open
        onOpenChange={onOpenChange}
        setup={SETUP}
      />,
    );
    expect(screen.getByTestId("arena-board")).toBeInTheDocument();
  });

  it("shows move counter in playing status", () => {
    render(
      <MiniArenaSheet
        open
        onOpenChange={onOpenChange}
        setup={SETUP}
      />,
    );
    const status = screen.getByTestId("mini-arena-status");
    expect(status).toHaveTextContent(/Moves:\s*0\s*\/\s*16/);
  });

  it("shows share challenge link during playing state", () => {
    render(
      <MiniArenaSheet
        open
        onOpenChange={onOpenChange}
        setup={SETUP}
      />,
    );
    expect(screen.getByText("Share Challenge")).toBeInTheDocument();
  });

  it("does NOT show result overlay when first opened (playing)", () => {
    const { container } = render(
      <MiniArenaSheet
        open
        onOpenChange={onOpenChange}
        setup={SETUP}
      />,
    );
    // The overlay shows "Checkmate in" or "Draw" — neither should be visible.
    expect(container.querySelector('[aria-label="Close"]')).not.toBeInTheDocument();
  });
});

describe("MiniArenaSheet — share integration", () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens share modal when share challenge is clicked", async () => {
    const user = userEvent.setup();
    render(
      <MiniArenaSheet
        open
        onOpenChange={onOpenChange}
        setup={SETUP}
      />,
    );

    // Initially share modal should not be visible.
    expect(screen.queryByTestId("share-modal")).not.toBeInTheDocument();

    // Click "Share Challenge" in the footer.
    await user.click(screen.getByText("Share Challenge"));

    // Now the share modal should appear.
    expect(screen.getByTestId("share-modal")).toBeInTheDocument();
  });
});
