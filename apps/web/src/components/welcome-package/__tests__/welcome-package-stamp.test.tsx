import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithIntl as render, screen, fireEvent } from "@/test-utils/render-with-intl";
import { setWelcomePackageState, DEFAULT_STATE } from "@/lib/welcome-package/storage";

// Mock Lite mode ON
vi.mock("@/lib/feature-flags", () => ({ CHESSCITO_LITE_MODE: true }));
vi.mock("@/lib/daily/progress", () => ({
  getDailyProgress: vi.fn(() => ({ streak: 0, lastCompletedDate: null, totalCompleted: 0 })),
}));

const { WelcomePackageStamp } = await import("../welcome-package-stamp");

beforeEach(() => {
  localStorage.clear();
});

describe("<WelcomePackageStamp>", () => {
  it("renders nothing when package is not unlocked", () => {
    const { container } = render(<WelcomePackageStamp />);
    expect(container.firstChild).toBeNull();
  });

  it("shows pending state when unlocked but not claimed", () => {
    setWelcomePackageState({ ...DEFAULT_STATE, unlocked: true, unlockedAt: "2026-06-20T00:00:00Z", autoShowCount: 2 });
    render(<WelcomePackageStamp />);
    expect(screen.getByTestId("welcome-package-pending")).toBeInTheDocument();
    expect(screen.getByText("Welcome Package")).toBeInTheDocument();
    expect(screen.getByText("Tap to claim your reward")).toBeInTheDocument();
  });

  it("shows claimed state when claimed=true", () => {
    setWelcomePackageState({
      ...DEFAULT_STATE,
      unlocked: true, unlockedAt: "2026-06-20T00:00:00Z",
      claimed: true, claimedAt: "2026-06-20T01:00:00Z",
    });
    render(<WelcomePackageStamp />);
    expect(screen.getByText("Focus Stamp: Day 1")).toBeInTheDocument();
    expect(screen.getByText("Saved on this device. Earned on your first Focus Day.")).toBeInTheDocument();
    expect(screen.queryByTestId("welcome-package-pending")).toBeNull();
  });

  it("opens claim modal when pending tile is tapped", () => {
    setWelcomePackageState({ ...DEFAULT_STATE, unlocked: true, unlockedAt: "now", autoShowCount: 2 });
    render(<WelcomePackageStamp />);
    fireEvent.click(screen.getByTestId("welcome-package-pending"));
    expect(screen.getByTestId("welcome-package-modal")).toBeInTheDocument();
  });
});
