import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

// `result-overlay.tsx` imports LottieAnimation at module-load, which
// pulls lottie-web → triggers a JSDOM canvas/fillStyle crash. The
// piece-complete prompt itself never renders a Lottie, so a no-op mock
// is safe here and keeps the test surface tiny.
vi.mock("@/components/ui/lottie-animation", () => ({
  LottieAnimation: () => null,
}));

// ShareModal mounts heavy share/og dependencies on import; PieceComplete
// does not render it, but the result-overlay module still pulls it.
vi.mock("@/components/share/share-modal", () => ({
  ShareModal: () => null,
}));

import { PieceCompletePrompt } from "../result-overlay";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

const baseProps = {
  pieceType: "king" as const,
  nextPiece: null,
  hasClaimedBadge: true,
  totalStars: 12,
  onNextPiece: vi.fn(),
  onArena: vi.fn(),
  onPracticeAgain: vi.fn(),
};

describe("PieceCompletePrompt — CTA hierarchy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("primary = Start {nextPiece} when nextPiece exists", () => {
    render(
      <PieceCompletePrompt
        {...baseProps}
        pieceType="queen"
        nextPiece="king"
      />,
    );
    // Two matches are expected: the primary CTA button and the
    // CandyGlassShell close affordance whose aria-label mirrors the
    // primary action (existing UX pattern, not introduced by Phase B.1).
    expect(
      screen.getAllByRole("button", { name: "Start King" }).length,
    ).toBeGreaterThanOrEqual(1);
    // ARENA must NOT be the primary in this branch.
    expect(
      screen.queryByRole("button", { name: "ARENA" }),
    ).not.toBeInTheDocument();
    // Secondary "Try Arena" text-link is suppressed when nextPiece exists
    // (the Coach hint covers the Arena bridge instead — see comment in
    // result-overlay.tsx).
    expect(
      screen.queryByRole("button", { name: "Try Arena" }),
    ).not.toBeInTheDocument();
  });

  it("primary = Try Labyrinth when no nextPiece and onTryLabyrinth defined", () => {
    const onTryLabyrinth = vi.fn();
    render(
      <PieceCompletePrompt {...baseProps} onTryLabyrinth={onTryLabyrinth} />,
    );
    expect(
      screen.getByRole("button", { name: "Try Labyrinth" }),
    ).toBeInTheDocument();
    // ARENA uppercase primary must not surface in this branch.
    expect(
      screen.queryByRole("button", { name: "ARENA" }),
    ).not.toBeInTheDocument();
  });

  it("primary = Choose another piece when no nextPiece + no labyrinth + onChoosePiece defined", () => {
    const onChoosePiece = vi.fn();
    render(
      <PieceCompletePrompt {...baseProps} onChoosePiece={onChoosePiece} />,
    );
    expect(
      screen.getByRole("button", { name: "Choose another piece" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "ARENA" }),
    ).not.toBeInTheDocument();
  });

  it("renders Arena as secondary text-link when primary != Arena and nextPiece is null", () => {
    const onChoosePiece = vi.fn();
    render(
      <PieceCompletePrompt {...baseProps} onChoosePiece={onChoosePiece} />,
    );
    expect(
      screen.getByRole("button", { name: "Try Arena" }),
    ).toBeInTheDocument();
  });

  it("falls back to Arena primary when nextPiece null + no labyrinth + no onChoosePiece", () => {
    render(<PieceCompletePrompt {...baseProps} />);
    expect(
      screen.getByRole("button", { name: "ARENA" }),
    ).toBeInTheDocument();
    // In the fallback branch the primary IS Arena, so there must not be
    // a duplicate "Try Arena" text-link below it.
    expect(
      screen.queryByRole("button", { name: "Try Arena" }),
    ).not.toBeInTheDocument();
  });
});
