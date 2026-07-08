import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithIntl as render, screen, fireEvent, waitFor } from "@/test-utils/render-with-intl";
import { setWelcomePackageState, DEFAULT_STATE } from "@/lib/welcome-package/storage";

// Mock Lite mode ON
vi.mock("@/lib/feature-flags", () => ({ CHESSCITO_LITE_MODE: true }));
vi.mock("@/lib/daily/progress", () => ({
  getDailyProgress: vi.fn(() => ({ streak: 0, lastCompletedDate: null, totalCompleted: 0 })),
}));

const signMessageAsyncMock = vi.hoisted(() => vi.fn(async () => "0xsig"));
const useAccountMock = vi.hoisted(() => vi.fn());

vi.mock("wagmi", () => ({
  useAccount: useAccountMock,
  useSignMessage: () => ({ signMessageAsync: signMessageAsyncMock }),
}));

const { WelcomePackageStamp } = await import("../welcome-package-stamp");

beforeEach(() => {
  localStorage.clear();
  signMessageAsyncMock.mockClear();
  signMessageAsyncMock.mockResolvedValue("0xsig");
  useAccountMock.mockReturnValue({ address: "0xabc123", isConnected: true });
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
    expect(screen.getByText("Tap to open your Welcome Package")).toBeInTheDocument();
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

describe("<WelcomePackageStamp> claim flow with wallet", () => {
  it("transitions to signing phase when Claim CTA is tapped", async () => {
    setWelcomePackageState({ ...DEFAULT_STATE, unlocked: true, unlockedAt: "now", autoShowCount: 2 });
    // Hang sign so we can observe the signing state
    signMessageAsyncMock.mockReturnValue(new Promise(() => {}));

    render(<WelcomePackageStamp />);
    fireEvent.click(screen.getByTestId("welcome-package-pending"));
    fireEvent.click(screen.getByRole("button", { name: /^claim$/i }));

    await waitFor(() => {
      expect(screen.getByTestId("wp-signing-title")).toBeInTheDocument();
    });
  });

  it("shows success overlay after signature resolves", async () => {
    setWelcomePackageState({ ...DEFAULT_STATE, unlocked: true, unlockedAt: "now", autoShowCount: 2 });
    signMessageAsyncMock.mockResolvedValue("0xsig");

    render(<WelcomePackageStamp />);
    fireEvent.click(screen.getByTestId("welcome-package-pending"));
    fireEvent.click(screen.getByRole("button", { name: /^claim$/i }));

    await waitFor(() => {
      expect(screen.getByTestId("wp-success-title")).toBeInTheDocument();
    });
    expect(screen.getByText("Welcome Gift Claimed")).toBeInTheDocument();
  });

  it("shows error overlay when signature is rejected", async () => {
    setWelcomePackageState({ ...DEFAULT_STATE, unlocked: true, unlockedAt: "now", autoShowCount: 2 });
    signMessageAsyncMock.mockRejectedValue(new Error("User rejected"));

    render(<WelcomePackageStamp />);
    fireEvent.click(screen.getByTestId("welcome-package-pending"));
    fireEvent.click(screen.getByRole("button", { name: /^claim$/i }));

    await waitFor(() => {
      expect(screen.getByTestId("wp-error-body")).toBeInTheDocument();
    });
  });

  it("returns to idle after retry tap in error state", async () => {
    setWelcomePackageState({ ...DEFAULT_STATE, unlocked: true, unlockedAt: "now", autoShowCount: 2 });
    signMessageAsyncMock.mockRejectedValue(new Error("User rejected"));

    render(<WelcomePackageStamp />);
    fireEvent.click(screen.getByTestId("welcome-package-pending"));
    fireEvent.click(screen.getByRole("button", { name: /^claim$/i }));

    await waitFor(() => screen.getByTestId("wp-retry-cta"));
    fireEvent.click(screen.getByTestId("wp-retry-cta"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^claim$/i })).toBeInTheDocument();
    });
  });
});

describe("<WelcomePackageStamp> claim flow without wallet", () => {
  it("skips signing and shows success immediately when no wallet", async () => {
    useAccountMock.mockReturnValue({ address: undefined, isConnected: false });
    setWelcomePackageState({ ...DEFAULT_STATE, unlocked: true, unlockedAt: "now", autoShowCount: 2 });

    render(<WelcomePackageStamp />);
    fireEvent.click(screen.getByTestId("welcome-package-pending"));
    fireEvent.click(screen.getByRole("button", { name: /^claim$/i }));

    await waitFor(() => {
      expect(screen.getByTestId("wp-success-title")).toBeInTheDocument();
    });
    expect(signMessageAsyncMock).not.toHaveBeenCalled();
  });
});
