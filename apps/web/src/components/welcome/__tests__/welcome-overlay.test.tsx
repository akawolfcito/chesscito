import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// Hoisted mocks — wagmi + onboarding signal injected before the component imports.
const useAccountMock = vi.hoisted(() =>
  vi.fn(() => ({ address: undefined as `0x${string}` | undefined })),
);
vi.mock("wagmi", () => ({
  useAccount: useAccountMock,
}));

const signalMock = vi.hoisted(() =>
  vi.fn(() => ({ status: "fresh" as const, signal: null as null })),
);
vi.mock("@/hooks/use-onboarding-signal", () => ({
  useOnboardingSignal: signalMock,
}));

import { WelcomeOverlay } from "../welcome-overlay";

const STORAGE_KEY = "chesscito:welcome-dismissed";

describe("WelcomeOverlay", () => {
  beforeEach(() => {
    localStorage.clear();
    useAccountMock.mockReturnValue({ address: undefined });
    signalMock.mockReturnValue({ status: "fresh", signal: null });
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
});
