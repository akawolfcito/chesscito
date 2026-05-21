import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type {
  OnboardingSignalResult,
} from "@/hooks/use-onboarding-signal";

// Hoisted mocks — wagmi + onboarding signal injected before the component imports.
const useAccountMock = vi.hoisted(() =>
  vi.fn(() => ({ address: undefined as `0x${string}` | undefined })),
);
vi.mock("wagmi", () => ({
  useAccount: useAccountMock,
}));

// Default the mock to a "fresh" state but widen the return type so each
// test can mock any of the 3 discriminated-union status values
// (resolving / fresh / returning) with any of the 5 signal sources.
const signalMock = vi.hoisted(() =>
  vi.fn<() => { status: string; signal: string | null }>(() => ({
    status: "fresh",
    signal: null,
  })),
);
vi.mock("@/hooks/use-onboarding-signal", () => ({
  useOnboardingSignal: signalMock,
}));

// Telemetry mock — hoisted so the overlay's track() calls land here
// instead of the real /api/telemetry fetch. Pattern mirrors
// tx-progress-steps.test.tsx + pro-sheet.test.tsx.
const trackMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/telemetry", () => ({ track: trackMock }));

import { WelcomeOverlay } from "../welcome-overlay";

const STORAGE_KEY = "chesscito:welcome-dismissed";

describe("WelcomeOverlay", () => {
  beforeEach(() => {
    localStorage.clear();
    useAccountMock.mockReturnValue({ address: undefined });
    signalMock.mockReturnValue({ status: "fresh", signal: null });
    trackMock.mockClear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("renders nothing when the welcome flag is already set", () => {
    localStorage.setItem(STORAGE_KEY, "1");
    render(<WelcomeOverlay />);
    expect(screen.queryByTestId("welcome-overlay")).not.toBeInTheDocument();
  });

  it("renders the first slide with English copy on a fresh device", () => {
    render(<WelcomeOverlay />);
    expect(screen.getByTestId("welcome-overlay")).toBeInTheDocument();
    expect(screen.getByText(/Welcome, Champion!/i)).toBeInTheDocument();
  });

  it("renders the panel through <CandyCard> with the gold atmosphere (Cluster D visual fix)", () => {
    render(<WelcomeOverlay />);
    const scrim = screen.getByTestId("welcome-overlay");
    const card = scrim.querySelector(
      '[data-component="candy-card"][data-atmosphere="gold"]',
    );
    expect(card).not.toBeNull();
    expect(card).toHaveClass("candy-frame", "candy-frame-gold");
  });

  it("advances through the 3 slides with the Continue button", () => {
    render(<WelcomeOverlay />);
    fireEvent.click(screen.getByTestId("welcome-next"));
    expect(screen.getByText(/Climb to Arena with AI/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("welcome-next"));
    expect(screen.getByText(/Ready to play\?/i)).toBeInTheDocument();
    // Terminal CTA carries the `▶` ornament per addendum §2.1.3
    expect(screen.getByText(/Play ▶/)).toBeInTheDocument();
  });

  it("dismisses on the final slide and persists the welcome flag", () => {
    render(<WelcomeOverlay />);
    fireEvent.click(screen.getByTestId("welcome-next")); // → slide 2
    fireEvent.click(screen.getByTestId("welcome-next")); // → slide 3
    fireEvent.click(screen.getByTestId("welcome-next")); // dismiss
    expect(screen.queryByTestId("welcome-overlay")).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("renders the Skip button on EVERY slide including the terminal one (§0.2 escape hatch)", () => {
    render(<WelcomeOverlay />);
    expect(screen.getByTestId("welcome-skip")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("welcome-next")); // → slide 2
    expect(screen.getByTestId("welcome-skip")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("welcome-next")); // → slide 3 (terminal)
    expect(screen.getByTestId("welcome-skip")).toBeInTheDocument();
  });

  it("dismisses on Skip and persists the flag (English copy)", () => {
    render(<WelcomeOverlay />);
    fireEvent.click(screen.getByTestId("welcome-skip"));
    expect(screen.queryByTestId("welcome-overlay")).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  // ─── Cluster D signal-driven skip ─────────────────────────────────

  it("returns null while the onboarding signal is still resolving (Cluster D — no flash)", () => {
    signalMock.mockReturnValue({ status: "resolving", signal: null });
    render(<WelcomeOverlay />);
    expect(screen.queryByTestId("welcome-overlay")).not.toBeInTheDocument();
  });

  it("auto-dismisses when the onboarding signal commits returning (Cluster D)", () => {
    signalMock.mockReturnValue({ status: "returning", signal: "pro" });
    render(<WelcomeOverlay />);
    expect(screen.queryByTestId("welcome-overlay")).not.toBeInTheDocument();
    // welcome-dismissed flag is set too so subsequent mounts skip the
    // overlay even if the signal cache expires
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("declares carousel ARIA per §0.4: role=dialog + aria-roledescription=carousel + per-slide label", () => {
    render(<WelcomeOverlay />);
    const scrim = screen.getByTestId("welcome-overlay");
    expect(scrim.getAttribute("role")).toBe("dialog");
    expect(scrim.getAttribute("aria-roledescription")).toBe("carousel");
    const slideContainer = scrim.querySelector(
      '[aria-roledescription="slide"]',
    );
    expect(slideContainer).not.toBeNull();
    expect(slideContainer?.getAttribute("aria-label")).toBe("Slide 1 of 3");
  });

  // ─── Cluster D funnel telemetry (Blind hunter defer #4, 2026-05-20) ──

  it("emits welcome_view with slide_index=0 on initial render of a fresh device", () => {
    render(<WelcomeOverlay />);
    const viewCalls = trackMock.mock.calls.filter(
      ([event]) => event === "welcome_view",
    );
    expect(viewCalls.length).toBe(1);
    expect(viewCalls[0][1]).toEqual({ slide_index: 0, slide_count: 3 });
  });

  it("emits welcome_view per slide entry (and dedupes re-renders of the same slide)", () => {
    const { rerender } = render(<WelcomeOverlay />);
    // Re-render same slide — dedupe must hold
    rerender(<WelcomeOverlay />);
    fireEvent.click(screen.getByTestId("welcome-next")); // slide 2
    fireEvent.click(screen.getByTestId("welcome-next")); // slide 3
    const viewCalls = trackMock.mock.calls.filter(
      ([event]) => event === "welcome_view",
    );
    expect(viewCalls.length).toBe(3);
    expect(viewCalls.map(([, props]) => props)).toEqual([
      { slide_index: 0, slide_count: 3 },
      { slide_index: 1, slide_count: 3 },
      { slide_index: 2, slide_count: 3 },
    ]);
  });

  it("does NOT emit welcome_view while the signal is resolving (no flash → no phantom view)", () => {
    signalMock.mockReturnValue({ status: "resolving", signal: null });
    render(<WelcomeOverlay />);
    const viewCalls = trackMock.mock.calls.filter(
      ([event]) => event === "welcome_view",
    );
    expect(viewCalls.length).toBe(0);
  });

  it("does NOT emit welcome_view when suppressed (dock sheet open over the overlay)", () => {
    render(<WelcomeOverlay suppressed />);
    const viewCalls = trackMock.mock.calls.filter(
      ([event]) => event === "welcome_view",
    );
    expect(viewCalls.length).toBe(0);
  });

  it("emits welcome_skip with at_slide=index on Skip", () => {
    render(<WelcomeOverlay />);
    fireEvent.click(screen.getByTestId("welcome-next")); // → slide 2
    fireEvent.click(screen.getByTestId("welcome-skip"));
    const skipCalls = trackMock.mock.calls.filter(
      ([event]) => event === "welcome_skip",
    );
    expect(skipCalls.length).toBe(1);
    expect(skipCalls[0][1]).toEqual({ at_slide: 1, slide_count: 3 });
  });

  it("emits welcome_complete with via=play_cta on the terminal Play tap", () => {
    render(<WelcomeOverlay />);
    fireEvent.click(screen.getByTestId("welcome-next")); // → slide 2
    fireEvent.click(screen.getByTestId("welcome-next")); // → slide 3
    fireEvent.click(screen.getByTestId("welcome-next")); // → dismiss via Play
    const completeCalls = trackMock.mock.calls.filter(
      ([event]) => event === "welcome_complete",
    );
    expect(completeCalls.length).toBe(1);
    expect(completeCalls[0][1]).toEqual({ via: "play_cta", final_slide: 2 });
  });

  it("emits welcome_auto_dismissed with signal source when the signal commits returning", () => {
    signalMock.mockReturnValue({ status: "returning", signal: "pro" });
    render(<WelcomeOverlay />);
    const autoCalls = trackMock.mock.calls.filter(
      ([event]) => event === "welcome_auto_dismissed",
    );
    expect(autoCalls.length).toBe(1);
    expect(autoCalls[0][1]).toEqual({ signal: "pro", at_slide: 0 });
  });
});
