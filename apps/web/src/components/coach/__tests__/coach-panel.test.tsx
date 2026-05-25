import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  renderWithIntl as render,
  screen,
  fireEvent,
} from "@/test-utils/render-with-intl";
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

// ──────────────────────────────────────────────────────────────────────
// Per-locale cache migration (2026-05-24)
// ──────────────────────────────────────────────────────────────────────

describe("<CoachPanel> locale badge (2026-05-24)", () => {
  it("renders 'EN' badge when analysisLocale='en'", () => {
    render(<CoachPanel {...baseProps} analysisLocale="en" />);
    expect(screen.getByTestId("coach-analysis-locale-badge")).toHaveTextContent("EN");
  });

  it("renders 'ES' badge when analysisLocale='es'", () => {
    render(<CoachPanel {...baseProps} analysisLocale="es" />, { locale: "es" });
    expect(screen.getByTestId("coach-analysis-locale-badge")).toHaveTextContent("ES");
  });

  it("falls back to the active UI locale when analysisLocale is omitted (legacy record)", () => {
    render(<CoachPanel {...baseProps} />);
    // Default test locale is "en" — see render-with-intl.tsx.
    expect(screen.getByTestId("coach-analysis-locale-badge")).toHaveTextContent("EN");
  });

  it("exposes an a11y aria-label naming the language", () => {
    render(<CoachPanel {...baseProps} analysisLocale="en" />);
    expect(screen.getByTestId("coach-analysis-locale-badge")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Analysis language: EN/),
    );
  });
});

describe("<CoachPanel> reanalyze CTA (2026-05-24)", () => {
  it("does NOT render the CTA when onReanalyze is undefined", () => {
    render(<CoachPanel {...baseProps} />);
    expect(screen.queryByTestId("coach-reanalyze-cta")).toBeNull();
  });

  it("renders the CTA when onReanalyze is provided", () => {
    const onReanalyze = vi.fn().mockResolvedValue(undefined);
    render(<CoachPanel {...baseProps} onReanalyze={onReanalyze} />);
    expect(screen.getByTestId("coach-reanalyze-cta")).toHaveTextContent(/Reanalyze/i);
  });

  it("renders the discovery panel (title + body) above the CTA", () => {
    const onReanalyze = vi.fn().mockResolvedValue(undefined);
    render(<CoachPanel {...baseProps} onReanalyze={onReanalyze} />);
    const panel = screen.getByTestId("coach-reanalyze-panel");
    expect(panel).toBeInTheDocument();
    // Both halves of the leg must render — title explains WHAT, body
    // explains WHY. Missing either is a user-discoverability bug.
    expect(panel).toHaveTextContent(COACH_COPY.reanalyze.panelTitle);
    expect(panel).toHaveTextContent(COACH_COPY.reanalyze.panelBody);
  });

  it("does NOT render the discovery panel when onReanalyze is omitted", () => {
    render(<CoachPanel {...baseProps} />);
    expect(screen.queryByTestId("coach-reanalyze-panel")).toBeNull();
  });

  it("opens a confirm sheet before invoking onReanalyze (no accidental credit spend)", () => {
    const onReanalyze = vi.fn().mockResolvedValue(undefined);
    render(<CoachPanel {...baseProps} onReanalyze={onReanalyze} />);
    fireEvent.click(screen.getByTestId("coach-reanalyze-cta"));
    // The confirm dialog is open. The handler MUST NOT have fired yet.
    expect(onReanalyze).not.toHaveBeenCalled();
    expect(screen.getByText(COACH_COPY.reanalyze.confirmTitle)).toBeInTheDocument();
  });

  it("confirm body says '1 credit' for non-PRO users", () => {
    const onReanalyze = vi.fn().mockResolvedValue(undefined);
    render(<CoachPanel {...baseProps} onReanalyze={onReanalyze} />);
    fireEvent.click(screen.getByTestId("coach-reanalyze-cta"));
    expect(screen.getByText(COACH_COPY.reanalyze.confirmBody)).toBeInTheDocument();
    expect(screen.queryByText(COACH_COPY.reanalyze.confirmBodyPro)).toBeNull();
  });

  it("confirm body says 'PRO subscribers don't spend credits' for PRO users", () => {
    const onReanalyze = vi.fn().mockResolvedValue(undefined);
    render(
      <CoachPanel {...baseProps} proActive onReanalyze={onReanalyze} />,
    );
    fireEvent.click(screen.getByTestId("coach-reanalyze-cta"));
    expect(screen.getByText(COACH_COPY.reanalyze.confirmBodyPro)).toBeInTheDocument();
    expect(screen.queryByText(COACH_COPY.reanalyze.confirmBody)).toBeNull();
  });

  it("disables the CTA + relabels while isReanalyzing", () => {
    render(
      <CoachPanel
        {...baseProps}
        onReanalyze={vi.fn().mockResolvedValue(undefined)}
        isReanalyzing
      />,
    );
    const cta = screen.getByTestId("coach-reanalyze-cta");
    expect(cta).toBeDisabled();
    expect(cta).toHaveTextContent(COACH_COPY.reanalyze.inFlightLabel);
  });
});
