import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { LabyrinthCompleteOverlay } from "../labyrinth-complete-overlay";
import { track } from "@/lib/telemetry";

vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));

vi.useFakeTimers();

function renderOverlay(
  props: Partial<React.ComponentProps<typeof LabyrinthCompleteOverlay>> = {},
) {
  const onContinue = vi.fn();
  const onRetry = vi.fn();
  render(
    <LabyrinthCompleteOverlay
      moves={3}
      optimalMoves={3}
      stars={3}
      onContinue={onContinue}
      onRetry={onRetry}
      {...props}
    />,
  );
  return { onContinue, onRetry };
}

describe("LabyrinthCompleteOverlay — continue-first (QA F3 2026-06-11)", () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  it("primary CTA is Continue and advances the path", () => {
    const { onContinue, onRetry } = renderOverlay();

    // Shell X (absolute close asset) and primary share the Continue
    // intent — the primary is the non-close one.
    const primary = screen
      .getAllByRole("button", { name: "Continue" })
      .find((b) => !b.className.includes("candy-close-asset-button"));
    expect(primary).toBeDefined();
    fireEvent.click(primary!);
    vi.runAllTimers();
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("Try again is demoted to the secondary action", () => {
    const { onRetry } = renderOverlay();

    const retry = screen.getByRole("button", { name: "Try again" });
    expect(retry).toHaveClass("arena-result-secondary-action");
    fireEvent.click(retry);
    vi.runAllTimers();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("closing with the X also continues — never strands the player in the lab", () => {
    const { onContinue } = renderOverlay();

    const closeX = screen
      .getAllByRole("button", { name: "Continue" })
      .find((b) => b.className.includes("candy-close-asset-button"));
    expect(closeX).toBeDefined();
    fireEvent.click(closeX!);
    vi.runAllTimers();
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("king finale keeps Enter Arena as the primary", () => {
    const onEnterArena = vi.fn();
    renderOverlay({ onEnterArena });

    fireEvent.click(screen.getByRole("button", { name: "Enter Arena" }));
    vi.runAllTimers();
    expect(onEnterArena).toHaveBeenCalledTimes(1);
  });

  it("keeps ludic results visible without rendering a star award", () => {
    renderOverlay({
      awardsStars: false,
      stars: 0,
      moves: 20,
      optimalMoves: 20,
      previousBest: 24,
    });

    expect(screen.queryByText("0/3")).not.toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
  });
});

describe("LabyrinthCompleteOverlay — the consequence line (Paso 1, slice 1B)", () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.mocked(track).mockClear();
  });

  it("says what the attempt changed, and names the prize", () => {
    renderOverlay({ consequence: { kind: "lane_progress", done: 3, total: 4 } });

    expect(screen.getByTestId("consequence-line")).toHaveTextContent(
      "3 of 4 challenges · the crown is at the end",
    );
  });

  it("swaps to the lane-complete line rather than saying 4 of 4 (AC-4)", () => {
    // "4 of 4 · the crown is at the end" is false at the exact moment the
    // player clears the lane. Same rung, different sentence.
    renderOverlay({ consequence: { kind: "lane_progress", done: 4, total: 4 } });

    expect(screen.getByTestId("consequence-line")).toHaveTextContent(
      "Every challenge cleared · your badge is waiting in Exercises",
    );
  });

  it("names the crown when the attempt earned it", () => {
    renderOverlay({ consequence: { kind: "mastery" } });

    expect(screen.getByTestId("consequence-line")).toHaveTextContent(
      "Crown earned · pick your next piece",
    );
  });

  it("counts the exercise lane against the gate", () => {
    renderOverlay({
      consequence: { kind: "badge_progress", done: 7, required: 8 },
    });

    expect(screen.getByTestId("consequence-line")).toHaveTextContent(
      "7 of 8 toward your badge",
    );
  });

  it("renders NOTHING new when there is no consequence (AC-2)", () => {
    renderOverlay();

    expect(screen.queryByTestId("consequence-line")).not.toBeInTheDocument();
  });

  it("leaves the buttons untouched (AC-9)", () => {
    const { onContinue, onRetry } = renderOverlay({
      consequence: { kind: "mastery" },
    });

    const primary = screen
      .getAllByRole("button", { name: "Continue" })
      .find((b) => !b.className.includes("candy-close-asset-button"));
    fireEvent.click(primary!);
    vi.runAllTimers();
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
    // No claim CTA smuggled in alongside the badge copy.
    expect(
      screen.queryByRole("button", { name: /claim/i }),
    ).not.toBeInTheDocument();
  });

  it("reports the announced kind, and stays quiet when nothing is announced (AC-10)", () => {
    renderOverlay({ consequence: { kind: "mastery" } });

    expect(track).toHaveBeenCalledWith("consequence_shown", {
      kind: "mastery",
      surface: "labyrinth",
    });

    vi.mocked(track).mockClear();
    renderOverlay();
    expect(
      vi.mocked(track).mock.calls.filter(([name]) => name === "consequence_shown"),
    ).toEqual([]);
  });
});
