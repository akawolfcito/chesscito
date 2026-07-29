import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent } from "@testing-library/react";

import { renderWithIntl, screen } from "@/test-utils/render-with-intl";
import { PhaseFlash } from "../mission-panel-candy";

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
