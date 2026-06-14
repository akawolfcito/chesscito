import { describe, expect, it, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { LeaderboardSheet } from "../leaderboard-sheet";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

const accountState: { address?: string; isConnected: boolean } = {
  address: undefined,
  isConnected: false,
};

vi.mock("wagmi", () => ({
  useAccount: () => accountState,
}));

beforeEach(() => {
  accountState.address = undefined;
  accountState.isConnected = false;
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
  }) as unknown as typeof fetch;
});

describe("LeaderboardSheet — showTrigger gate", () => {
  it("renders the dock trigger by default", () => {
    render(<LeaderboardSheet open={false} onOpenChange={() => {}} />);
    expect(screen.getByRole("button", { name: /leaders/i })).toBeInTheDocument();
  });

  it("omits the orphan trigger when showTrigger is false", () => {
    render(
      <LeaderboardSheet open={false} onOpenChange={() => {}} showTrigger={false} />,
    );
    expect(screen.queryByRole("button", { name: /leaders/i })).not.toBeInTheDocument();
  });
});

describe("LeaderboardSheet — ContextualHeader canary", () => {
  it("mounts the close-control ContextualHeader (not the legacy ad-hoc header)", () => {
    render(<LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} />);
    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-component", "contextual-header");
    expect(header).toHaveAttribute("data-variant", "close-control");
  });

  it("renders exactly one close affordance (inline, not the floating absolute X)", () => {
    render(<LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} />);
    const closeButtons = screen.getAllByRole("button", { name: /close leaders/i });
    expect(closeButtons).toHaveLength(1);
    expect(closeButtons[0].getAttribute("data-slot")).toBe("close-control");
  });
});

describe("LeaderboardSheet — on-chain marker + own rank (QA 2026-06-11)", () => {
  const rows = [
    { rank: 1, player: "0x1111...aaaa", score: 9000, isVerified: false, hasOnchain: true },
    { rank: 2, player: "0x2222...bbbb", score: 8000, isVerified: false, hasOnchain: true },
    { rank: 3, player: "0x3333...cccc", score: 7000, isVerified: false, hasOnchain: false },
  ];

  it("marks on-chain rows and leaves off-chain rows unmarked", async () => {
    accountState.address = "0xABCD000000000000000000000000000000001234";
    accountState.isConnected = true;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rows, player: null }),
    }) as unknown as typeof fetch;

    render(<LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} />);

    await waitFor(() => {
      // Rank 2 row (competitor) carries the on-chain seal; rank 3 does not.
      expect(screen.getAllByAltText("Saved on Celo").length).toBeGreaterThanOrEqual(1);
    });
    const row3 = screen.getByText("0x3333...cccc").closest("div");
    expect(row3?.querySelector('img[alt="Saved on Celo"]')).toBeNull();
  });

  it("requests the caller's own rank when connected and renders the Your-rank row", async () => {
    accountState.address = "0xABCD000000000000000000000000000000001234";
    accountState.isConnected = true;
    const own = { rank: 42, player: "0xabcd...1234", score: 120, isVerified: false, hasOnchain: true };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rows, player: own }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} />);

    await waitFor(() => {
      expect(screen.getByText("Your rank")).toBeInTheDocument();
      expect(screen.getByText("0xabcd...1234")).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "player=0xABCD000000000000000000000000000000001234",
    );
  });

  it("disconnected: legacy array request, no Your-rank row", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => rows,
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} />);

    await waitFor(() => {
      expect(screen.getByText("0x2222...bbbb")).toBeInTheDocument();
    });
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("player=");
    expect(screen.queryByText("Your rank")).not.toBeInTheDocument();
  });
});
