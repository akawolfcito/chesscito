import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Chess } from "chess.js";

import { MiniArenaSheet } from "../mini-arena-sheet";
import type { MiniArenaSetup } from "@/lib/game/mini-arena";
import type { MoveSuggestion } from "@/lib/game/mini-arena-ai";

const SETUP: MiniArenaSetup = {
  id: "kr-vs-k",
  name: "K+R vs K",
  description: "The classic endgame.",
  fen: "4k3/8/8/8/8/8/8/R3K3 w - - 0 1",
  parMoves: 16,
  aiLevel: 0,
};

// A setup where white can deliver checkmate in 1 move (Kf7#).
// White: Kg6, Rh1  Black: Kh8  →  Kf7# seals escapes g7+g8,
// rook on h1 covers the h-file. Verified with chess.js.
const CHECKMATE_IN_1_SETUP: MiniArenaSetup = {
  id: "kr-vs-k-mate-1",
  name: "K+R vs K (Mate in 1)",
  description: "Deliver checkmate.",
  fen: "7k/8/6K1/8/8/8/8/7R w - - 0 1",
  parMoves: 1,
  aiLevel: 0,
};

// Dev-only: mate-in-one with a rook move (Ra8#).
// White: Kg6, Ra1  Black: Kh8  →  Ra8# covers the 8th rank,
// king on g6 seals g7/h7 escapes.
const ROOK_MATE_IN_1_SETUP: MiniArenaSetup = {
  id: "kr-vs-k-rook-mate-1",
  name: "K+R vs K (Rook Mate)",
  description: "Deliver Ra8#.",
  fen: "7k/8/6K1/8/8/8/8/R7 w - - 0 1",
  parMoves: 1,
  aiLevel: 0,
};

// Mock board onSquareClick capture
let boardOnSquareClick: (square: string) => void = () => {};

// Mock haptics to avoid runtime issues in test environment.
vi.mock("@/lib/haptics", () => ({
  hapticImpact: vi.fn(),
  hapticReject: vi.fn(),
  hapticSuccess: vi.fn(),
  hapticTap: vi.fn(),
}));

// Mock ArenaBoard since it depends on canvas/image rendering.
vi.mock("@/components/arena/arena-board", () => ({
  ArenaBoard: (props: Record<string, unknown>) => {
    boardOnSquareClick = props.onSquareClick as (square: string) => void;
    return <div data-testid="arena-board">ArenaBoard</div>;
  },
}));

// Mock AI to return predictable moves.
const mockPickAiMove = vi.fn();
vi.mock("@/lib/game/mini-arena-ai", () => ({
  pickAiMoveOrFallback: (
    _game: Chess,
    _aiLevel: number,
    _random?: () => number,
  ): MoveSuggestion | null => mockPickAiMove(),
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
    boardOnSquareClick = () => {};
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
    render(
      <MiniArenaSheet
        open
        onOpenChange={onOpenChange}
        setup={SETUP}
      />,
    );
    expect(screen.queryByTestId("mini-arena-result-overlay"))
      .not.toBeInTheDocument();
  });
});

describe("MiniArenaSheet — share integration", () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    boardOnSquareClick = () => {};
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

describe("MiniArenaSheet — result ceremony lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boardOnSquareClick = () => {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows result overlay after checkmate via terminalResult", () => {
    const onOpenChange = vi.fn();
    render(
      <MiniArenaSheet
        open
        onOpenChange={onOpenChange}
        setup={CHECKMATE_IN_1_SETUP}
      />,
    );

    // No overlay before checkmate.
    expect(
      screen.queryByTestId("mini-arena-result-overlay"),
    ).not.toBeInTheDocument();

    // Select the king on g6, then move to f7 delivering Kf7#.
    act(() => boardOnSquareClick("g6"));
    act(() => boardOnSquareClick("f7"));

    // Overlay should appear (terminalResult set).
    expect(
      screen.getByTestId("mini-arena-result-overlay"),
    ).toBeInTheDocument();
  });

  it("hides result overlay on close, then shows retry button", () => {
    const onOpenChange = vi.fn();
    render(
      <MiniArenaSheet
        open
        onOpenChange={onOpenChange}
        setup={CHECKMATE_IN_1_SETUP}
      />,
    );

    // Deliver checkmate.
    act(() => boardOnSquareClick("g6"));
    act(() => boardOnSquareClick("f7"));

    // Overlay visible.
    expect(
      screen.getByTestId("mini-arena-result-overlay"),
    ).toBeInTheDocument();

    // Close the overlay via the ceremony's close button.
    act(() => {
      screen.getByLabelText("Close").click();
    });

    // Overlay is hidden (dismissedTerminalRef prevents recovery).
    expect(
      screen.queryByTestId("mini-arena-result-overlay"),
    ).not.toBeInTheDocument();

    // Retry button should still be visible in the Sheet footer.
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("shows result overlay after Ra8# rook checkmate (dev FEN)", () => {
    render(
      <MiniArenaSheet
        open
        onOpenChange={vi.fn()}
        setup={ROOK_MATE_IN_1_SETUP}
      />,
    );

    // Select rook on a1, move to a8 delivering Ra8#.
    act(() => boardOnSquareClick("a1"));
    act(() => boardOnSquareClick("a8"));

    expect(
      screen.getByTestId("mini-arena-result-overlay"),
    ).toBeInTheDocument();
  });

  it("mounts the result overlay as a top-level modal, outside the sheet", () => {
    render(
      <MiniArenaSheet
        open
        onOpenChange={vi.fn()}
        setup={ROOK_MATE_IN_1_SETUP}
      />,
    );

    act(() => boardOnSquareClick("a1"));
    act(() => boardOnSquareClick("a8"));

    expect(screen.getByTestId("mini-arena-sheet")).not.toContainElement(
      screen.getByTestId("mini-arena-result-overlay"),
    );
  });

  it("does not restore overlay after ceremony close (dismissedTerminalRef)", () => {
    render(
      <MiniArenaSheet
        open
        onOpenChange={vi.fn()}
        setup={CHECKMATE_IN_1_SETUP}
      />,
    );

    // Deliver checkmate → terminalResult set, overlay visible.
    act(() => boardOnSquareClick("g6"));
    act(() => boardOnSquareClick("f7"));
    expect(
      screen.getByTestId("mini-arena-result-overlay"),
    ).toBeInTheDocument();

    // Close the ceremony → terminalResult cleared.
    act(() => {
      screen.getByLabelText("Close").click();
    });

    // Overlay stays hidden (dismissedTerminalRef prevents recovery).
    expect(
      screen.queryByTestId("mini-arena-result-overlay"),
    ).not.toBeInTheDocument();
  });

  it("resets game state on retry after dismiss", () => {
    const onOpenChange = vi.fn();
    render(
      <MiniArenaSheet
        open
        onOpenChange={onOpenChange}
        setup={CHECKMATE_IN_1_SETUP}
      />,
    );

    // Deliver checkmate.
    act(() => boardOnSquareClick("g6"));
    act(() => boardOnSquareClick("f7"));

    // Retry from the overlay (recovery keeps it visible).
    act(() => {
      screen.getByText("Retry").click();
    });

    // Board should be back to playing state — move count reset.
    expect(
      screen.getByTestId("mini-arena-status"),
    ).toHaveTextContent(/Moves:\s*0\s*\/\s*1/);
  });
});
