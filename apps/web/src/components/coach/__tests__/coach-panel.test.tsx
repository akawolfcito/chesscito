import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoachPanel } from "../coach-panel";
import { COACH_COPY } from "@/lib/content/editorial";
import type { CoachResponse } from "@/lib/coach/types";

const RESPONSE: CoachResponse = {
  kind: "full",
  summary: "You played a tight game.",
  mistakes: [],
  lessons: ["Watch your king safety."],
  praise: ["Solid opening."],
};

const baseProps = {
  response: RESPONSE,
  difficulty: "medium",
  totalMoves: 24,
  elapsedMs: 100_000,
  credits: 5,
  onPlayAgain: vi.fn(),
  onBackToHub: vi.fn(),
};

describe("<CoachPanel> footer (PR 4)", () => {
  it("does NOT render the footer when proActive is undefined", () => {
    render(<CoachPanel {...baseProps} />);
    expect(screen.queryByTestId("coach-history-footer")).toBeNull();
  });

  it("does NOT render the footer when historyMeta is undefined", () => {
    render(<CoachPanel {...baseProps} proActive />);
    expect(screen.queryByTestId("coach-history-footer")).toBeNull();
  });

  it("renders the 'Building your history…' footer when gamesPlayed === 0", () => {
    render(
      <CoachPanel {...baseProps} proActive historyMeta={{ gamesPlayed: 0 }} />,
    );
    const footer = screen.getByTestId("coach-history-footer");
    expect(footer).toHaveTextContent(/Building your history/i);
  });

  it("renders 'Reviewing 1 past game' (singular) when gamesPlayed === 1", () => {
    render(
      <CoachPanel {...baseProps} proActive historyMeta={{ gamesPlayed: 1 }} />,
    );
    expect(screen.getByTestId("coach-history-footer")).toHaveTextContent(/Reviewing 1 past game/i);
  });

  it("renders 'Reviewing 12 past games' (plural) when gamesPlayed > 1", () => {
    render(
      <CoachPanel {...baseProps} proActive historyMeta={{ gamesPlayed: 12 }} />,
    );
    expect(screen.getByTestId("coach-history-footer")).toHaveTextContent(/Reviewing 12 past games/i);
  });

  it("includes a link to /coach/history with the manageLabel text", () => {
    render(
      <CoachPanel {...baseProps} proActive historyMeta={{ gamesPlayed: 5 }} />,
    );
    const link = screen.getByRole("link", { name: /manage history/i });
    expect(link).toHaveAttribute("href", "/coach/history");
  });
});

describe("<CoachPanel> personalized-coaching subtitle", () => {
  // Simplified post-launch to a single always-on subtitle; this suite
  // tracks the CURRENT subtitle behavior.
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the subtitle when proActive && historyMeta is present", () => {
    render(
      <CoachPanel {...baseProps} proActive historyMeta={{ gamesPlayed: 5 }} />,
    );
    expect(screen.getByText(COACH_COPY.historyBannerSubtitle)).toBeInTheDocument();
  });

  it("does NOT render the subtitle when proActive=false", () => {
    render(<CoachPanel {...baseProps} historyMeta={{ gamesPlayed: 5 }} />);
    expect(screen.queryByText(COACH_COPY.historyBannerSubtitle)).toBeNull();
  });

  it("does NOT render the subtitle when historyMeta is undefined", () => {
    render(<CoachPanel {...baseProps} proActive />);
    expect(screen.queryByText(COACH_COPY.historyBannerSubtitle)).toBeNull();
  });
});
