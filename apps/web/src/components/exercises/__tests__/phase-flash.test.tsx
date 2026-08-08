import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent } from "@testing-library/react";

import { renderWithIntl, screen } from "@/test-utils/render-with-intl";
import { PhaseFlash } from "../mission-panel-candy";
import { track } from "@/lib/telemetry";

vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));

// Lottie + confetti don't paint under jsdom and are irrelevant to the
// text/timing assertions here.
vi.mock("@/components/ui/lottie-animation", () => ({
  LottieAnimation: () => null,
}));
vi.mock("@/components/redesign/confetti-burst", () => ({
  ConfettiBurst: () => null,
}));

afterEach(() => {
  vi.useRealTimers();
});

describe("PhaseFlash", () => {
  it("A — holds a beat before the banner appears, so the final move is seen", () => {
    vi.useFakeTimers();
    renderWithIntl(<PhaseFlash phase="success" lessonTitle="Move along the rank" />);

    // Immediately after the phase flips there is no banner yet: the board's
    // move/capture is still on screen and readable.
    expect(screen.queryByText("Well Done!")).toBeNull();

    // After the entry beat the banner reveals.
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByText("Well Done!")).toBeInTheDocument();
  });

  it("C — renders the headline as real (i18n) text, not only image alt", () => {
    vi.useFakeTimers();
    renderWithIntl(<PhaseFlash phase="failure" />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    // A live text node the translator owns — so ES gets "Reintenta", and no
    // baked-in art carries the word.
    const headline = screen.getByText("Try Again");
    expect(headline.tagName).not.toBe("IMG");
  });

  it("B — names the lesson on success (what the player just learned)", () => {
    vi.useFakeTimers();
    renderWithIntl(<PhaseFlash phase="success" lessonTitle="Move along the rank" />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByText(/Move along the rank/)).toBeInTheDocument();
  });

  it("B — shows no lesson line on failure", () => {
    vi.useFakeTimers();
    renderWithIntl(<PhaseFlash phase="failure" lessonTitle="Move along the rank" />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.queryByText(/Move along the rank/)).toBeNull();
  });

  describe("the consequence line (Paso 1, slice 1C)", () => {
    /** Reveal the flash — everything below only exists after the entry beat. */
    function reveal() {
      act(() => {
        vi.advanceTimersByTime(800);
      });
    }

    it("says what the solve moved, counted against the badge gate", () => {
      vi.useFakeTimers();
      renderWithIntl(
        <PhaseFlash
          phase="success"
          lessonTitle="Move along the rank"
          consequence={{ kind: "badge_progress", done: 7, required: 8 }}
        />,
      );
      reveal();

      expect(screen.getByTestId("consequence-line")).toHaveTextContent(
        "7 of 8 toward your badge",
      );
    });

    it("announces the challenge a solve opened — the rung that sews the two lanes", () => {
      vi.useFakeTimers();
      renderWithIntl(
        <PhaseFlash
          phase="success"
          consequence={{ kind: "challenge_unlocked", nodeId: "rook-rail-1" }}
        />,
      );
      reveal();

      expect(screen.getByTestId("consequence-line")).toHaveTextContent(
        "New challenge unlocked · it is on your path now",
      );
    });

    it("renders NOTHING new without a consequence (AC-2)", () => {
      vi.useFakeTimers();
      renderWithIntl(<PhaseFlash phase="success" lessonTitle="Move along the rank" />);
      reveal();

      expect(screen.queryByTestId("consequence-line")).not.toBeInTheDocument();
    });

    it("never announces progress on a failed attempt", () => {
      vi.useFakeTimers();
      // A failure changes nothing in the piece. The host should not pass one,
      // and the surface refuses it anyway: this is the celebration channel.
      renderWithIntl(
        <PhaseFlash
          phase="failure"
          consequence={{ kind: "badge_progress", done: 7, required: 8 }}
        />,
      );
      reveal();

      expect(screen.queryByTestId("consequence-line")).not.toBeInTheDocument();
    });

    it("reports the kind on the exercise surface (AC-10)", () => {
      vi.useFakeTimers();
      vi.mocked(track).mockClear();
      renderWithIntl(
        <PhaseFlash
          phase="success"
          consequence={{ kind: "challenge_unlocked", nodeId: "rook-rail-1" }}
        />,
      );
      reveal();

      expect(track).toHaveBeenCalledWith("consequence_shown", {
        kind: "challenge_unlocked",
        surface: "exercise",
      });
    });

    it("stays quiet when there is nothing to announce (AC-10)", () => {
      vi.useFakeTimers();
      vi.mocked(track).mockClear();
      renderWithIntl(<PhaseFlash phase="success" />);
      reveal();

      expect(
        vi.mocked(track).mock.calls.filter(([n]) => n === "consequence_shown"),
      ).toEqual([]);
    });
  });

  describe("tap to continue", () => {
    it("holds indefinitely instead of auto-dismissing", () => {
      vi.useFakeTimers();
      const onContinue = vi.fn();
      renderWithIntl(
        <PhaseFlash phase="success" lessonTitle="Move along the rank" awaitTap onContinue={onContinue} />,
      );
      // Long past the legacy auto-dismiss window (~3.1s): the banner is still up.
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(screen.getByText("Well Done!")).toBeInTheDocument();
      expect(onContinue).not.toHaveBeenCalled();
    });

    it("shows the 'Tap to Continue' prompt once armed", () => {
      vi.useFakeTimers();
      renderWithIntl(<PhaseFlash phase="success" awaitTap onContinue={vi.fn()} />);
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.getByText("Tap to Continue")).toBeInTheDocument();
    });

    it("runs onContinue when the overlay is tapped after arming", () => {
      vi.useFakeTimers();
      const onContinue = vi.fn();
      renderWithIntl(<PhaseFlash phase="success" awaitTap onContinue={onContinue} />);
      act(() => {
        vi.advanceTimersByTime(2000); // reveal + arm
      });
      fireEvent.click(screen.getByRole("button", { name: "Tap to Continue" }));
      act(() => {
        vi.advanceTimersByTime(300); // fade-out before the callback fires
      });
      expect(onContinue).toHaveBeenCalledTimes(1);
    });

    /* ⛔ Playtest 2026-08-08: the WELL DONE flash came BACK — confetti, lottie
     * and all — underneath the "All Exercises Complete!" menu.
     *
     * The host lowers `awaitTap` and opens the continuation menu in the SAME
     * commit (`handleFlashContinue` → `setAwaitFlashTap(false)` then the held
     * closure's `setShowPieceComplete(true)`), and on the last exercise it
     * never calls `resetBoard()`, so `phase` stays `"success"`. With `awaitTap`
     * in the effect's dependency array that prop change re-ran the whole setup,
     * which took the auto-dismiss branch and REPLAYED the celebration from
     * scratch. The flash is a moment; a moment does not come back. */
    it("does not replay when the host lowers awaitTap after the tap", () => {
      vi.useFakeTimers();
      const onContinue = vi.fn();
      const { rerender } = renderWithIntl(
        <PhaseFlash phase="success" lessonTitle="Move along the rank" awaitTap onContinue={onContinue} />,
      );
      act(() => {
        vi.advanceTimersByTime(2000); // reveal + arm
      });
      fireEvent.click(screen.getByRole("button", { name: "Tap to Continue" }));
      act(() => {
        vi.advanceTimersByTime(300); // fade-out, then onContinue fires
      });
      expect(onContinue).toHaveBeenCalledTimes(1);

      // The host's continuation: awaitTap drops, but the phase is untouched —
      // the board was not reset, because the continuation menu takes over.
      rerender(
        <PhaseFlash phase="success" lessonTitle="Move along the rank" awaitTap={false} onContinue={onContinue} />,
      );
      // ⚠️ The window that matters is 600ms (the entry beat) to 3700ms (the
      // auto-dismiss). A replay is INVISIBLE to a test that jumps past 3700 —
      // it re-reveals and hides itself again, and the assertion passes on a
      // broken build. Sample inside the window, and at the far end.
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.queryByText("Well Done!")).toBeNull();
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.queryByText("Well Done!")).toBeNull();
    });

    it("ignores an eager tap before the arm beat", () => {
      vi.useFakeTimers();
      const onContinue = vi.fn();
      renderWithIntl(<PhaseFlash phase="success" awaitTap onContinue={onContinue} />);
      // Revealed but not yet armed: a tap must not skip the celebration.
      act(() => {
        vi.advanceTimersByTime(650);
      });
      fireEvent.click(screen.getByRole("button", { name: "Tap to Continue" }));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onContinue).not.toHaveBeenCalled();
    });
  });
});
