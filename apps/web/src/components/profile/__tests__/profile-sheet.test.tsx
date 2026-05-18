import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileSheet } from "@/components/profile/profile-sheet";

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: "0x0924abcdef1234567890abcdef1234567890eba4",
    isConnected: true,
  }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
}));
vi.mock("@/hooks/use-profile-stats", () => ({
  useProfileStats: () => ({
    stats: { trophies: 12, arenaWins: 5, nftsMinted: 4, dailyStreak: 14, puzzlesSolved: 87 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-claim-queue", () => ({
  useClaimQueue: () => ({
    claims: [],
    inFlight: new Set(),
    claimOne: vi.fn(),
    refresh: vi.fn(),
    isLoading: false,
  }),
}));
vi.mock("@/hooks/use-display-name", () => ({
  useDisplayName: () => ({ name: "Akawolf", setName: vi.fn() }),
}));

describe("<ProfileSheet>", () => {
  it("renders banner, stats section, wallet/network rows, disconnect link", () => {
    render(<ProfileSheet open onOpenChange={() => {}} />);
    expect(screen.getByText("Akawolf")).toBeInTheDocument();
    expect(screen.getByText(/general stats/i)).toBeInTheDocument();
    expect(screen.getByText(/^wallet$/i)).toBeInTheDocument();
    expect(screen.getByText(/disconnect/i)).toBeInTheDocument();
  });

  it("does not render Pending Claims section when claims empty", () => {
    render(<ProfileSheet open onOpenChange={() => {}} />);
    expect(screen.queryByText(/pending claims/i)).not.toBeInTheDocument();
  });
});
