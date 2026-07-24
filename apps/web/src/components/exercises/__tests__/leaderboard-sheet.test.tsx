import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const originalFetch = global.fetch;

describe("LeaderboardSheet — no fetch while closed", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("does not call fetch when mounted closed", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(<LeaderboardSheet open={false} onOpenChange={() => {}} showTrigger={false} />);

    // Give any stray microtask a chance to fire, then assert it didn't.
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches exactly once when opened", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(<LeaderboardSheet open={true} onOpenChange={() => {}} showTrigger={false} />);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
  });
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
  // Identity Lite: rows carry an opaque rowId + server-derived variant, never
  // a wallet. EN bundle template → "{style} {piece} #{number}".
  const rows = [
    { rank: 1, rowId: "id_a", variant: { piece: "king", style: "golden", number: 1 }, score: 9000, isVerified: false, hasOnchain: true },
    { rank: 2, rowId: "id_b", variant: { piece: "rook", style: "blue", number: 22 }, score: 8000, isVerified: false, hasOnchain: true },
    { rank: 3, rowId: "id_c", variant: { piece: "pawn", style: "green", number: 33 }, score: 7000, isVerified: false, hasOnchain: false },
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
    const row3 = screen.getByText("Green Pawn #33").closest(".leaderboard-row-compact");
    expect(row3?.querySelector('img[alt="Saved on Celo"]')).toBeNull();
  });

  // Founder 2026-06-16: the list is the FULL board. #1 used to be lifted into
  // the banner only, so the list mysteriously started at #2/#3. It must now
  // also appear as a row in the list.
  it("renders the champion (#1) as a row in the full list, not just the banner", async () => {
    accountState.address = undefined as unknown as string;
    accountState.isConnected = false;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rows, player: null }),
    }) as unknown as typeof fetch;

    render(<LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} />);

    await waitFor(() => {
      const champRow = screen.getByText("Golden King #1").closest(".leaderboard-row-compact");
      expect(champRow).not.toBeNull();
    });
  });

  it("requests the caller's own rank when connected and renders the Your-rank row", async () => {
    accountState.address = "0xABCD000000000000000000000000000000001234";
    accountState.isConnected = true;
    const own = { rank: 42, rowId: "id_own", variant: { piece: "queen", style: "coral", number: 42 }, score: 120, isVerified: false, hasOnchain: true, walletShort: "0xABCD…1234" };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rows, player: own }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} />);

    await waitFor(() => {
      expect(screen.getByTestId("leaderboard-own-row")).toBeInTheDocument();
      // Own row shows the generated nickname (no custom name set in test).
      expect(screen.getByText("Coral Queen #42")).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "player=0xABCD000000000000000000000000000000001234",
    );
  });

  it("pins the Your-rank row in a footer OUTSIDE the scrolling list (anchored)", async () => {
    accountState.address = "0xABCD000000000000000000000000000000001234";
    accountState.isConnected = true;
    const own = { rank: 42, rowId: "id_own", variant: { piece: "queen", style: "coral", number: 42 }, score: 120, isVerified: false, hasOnchain: true, walletShort: "0xABCD…1234" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rows, player: own }),
    }) as unknown as typeof fetch;

    render(<LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} />);

    await waitFor(() => {
      expect(screen.getByTestId("leaderboard-own-row")).toBeInTheDocument();
    });
    const ownRow = screen.getByTestId("leaderboard-own-row");
    // Anchored footer, NOT inside the competitors scroll container.
    expect(ownRow.closest(".leaderboard-own-rank-footer")).not.toBeNull();
    expect(ownRow.closest(".overflow-y-auto")).toBeNull();
  });

  it("wears the Chesscito ID chip's identity shell — 'this row is me'", async () => {
    // 2026-07-17: the pinned Your-rank row carried `--top2`, a rank color it
    // has no claim to: the row is the CALLER, whatever rank they hold. It now
    // wears the same cream identity shell as the Account sheet's Chesscito ID
    // chip, so the player meets one "this is me" surface in both places.
    accountState.address = "0xABCD000000000000000000000000000000001234";
    accountState.isConnected = true;
    const own = { rank: 42, rowId: "id_own", variant: { piece: "queen", style: "coral", number: 42 }, score: 120, isVerified: false, hasOnchain: true, walletShort: "0xABCD…1234" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rows, player: own }),
    }) as unknown as typeof fetch;

    render(<LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} />);

    await waitFor(() => {
      expect(screen.getByTestId("leaderboard-own-row")).toBeInTheDocument();
    });
    const ownRow = screen.getByTestId("leaderboard-own-row");
    expect(ownRow).toHaveClass("leaderboard-row-compact--identity");
    expect(ownRow).not.toHaveClass("leaderboard-row-compact--top2");
  });

  it("disconnected: legacy array request, no Your-rank row", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => rows,
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} />);

    await waitFor(() => {
      expect(screen.getByText("Blue Rook #22")).toBeInTheDocument();
    });
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("player=");
    expect(screen.queryByTestId("leaderboard-own-row")).not.toBeInTheDocument();
  });
});

describe("LeaderboardSheet — own-rank Save-On-Chain CTA (founder 2026-07-23)", () => {
  const rows = [
    { rank: 1, rowId: "id_a", variant: { piece: "king", style: "golden", number: 1 }, score: 9000, isVerified: false, hasOnchain: true },
  ];
  const own = { rank: 42, rowId: "id_own", variant: { piece: "queen", style: "coral", number: 42 }, score: 120, isVerified: false, hasOnchain: false, walletShort: "0xABCD…1234" };

  const mountConnected = (json: unknown) => {
    accountState.address = "0xABCD000000000000000000000000000000001234";
    accountState.isConnected = true;
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => json }) as unknown as typeof fetch;
  };

  it("makes the own-rank block a tappable CTA that runs the save handler", async () => {
    mountConnected({ rows, player: own });
    const onSaveOnChain = vi.fn();
    const user = userEvent.setup();

    render(
      <LeaderboardSheet
        open
        onOpenChange={() => {}}
        showTrigger={false}
        canSaveOnChain
        onSaveOnChain={onSaveOnChain}
      />,
    );

    const cta = await screen.findByRole("button", { name: /save your score forever/i });
    expect(cta).toHaveAttribute("data-testid", "leaderboard-own-row");
    expect(cta).toHaveAttribute("data-cta", "save-onchain");
    await user.click(cta);
    expect(onSaveOnChain).toHaveBeenCalledTimes(1);
  });

  it("stays a static readout (not a button) when there is nothing to save", async () => {
    mountConnected({ rows, player: own });

    render(<LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} />);

    const ownRow = await screen.findByTestId("leaderboard-own-row");
    expect(ownRow.tagName).toBe("DIV");
    expect(
      screen.queryByRole("button", { name: /save your score forever/i }),
    ).not.toBeInTheDocument();
  });

  it("disables the CTA while a save is in flight", async () => {
    mountConnected({ rows, player: own });

    render(
      <LeaderboardSheet
        open
        onOpenChange={() => {}}
        showTrigger={false}
        canSaveOnChain
        onSaveOnChain={vi.fn()}
        isSavingOnChain
      />,
    );

    const cta = await screen.findByRole("button", { name: /save your score forever/i });
    expect(cta).toBeDisabled();
  });
});

describe("LeaderboardSheet — refreshTrigger (post-save invalidation)", () => {
  it("triggers an extra fetch when refreshTrigger increments while open", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { rerender } = render(
      <LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} refreshTrigger={0} />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const callsBefore = fetchMock.mock.calls.length;

    // Simulate save success: increment refreshTrigger while sheet is open
    await act(async () => {
      rerender(
        <LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} refreshTrigger={1} />,
      );
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it("renders latest data when sheet is opened after save (refreshTrigger wired)", async () => {
    const initialRows = [
      { rank: 1, rowId: "id_a", variant: { piece: "king", style: "golden", number: 1 }, score: 100, isVerified: false },
    ];
    const updatedRows = [
      { rank: 1, rowId: "id_a", variant: { piece: "king", style: "golden", number: 1 }, score: 200, isVerified: false },
    ];

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => initialRows })
      .mockResolvedValue({ ok: true, json: async () => updatedRows });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { rerender } = render(
      <LeaderboardSheet open={false} onOpenChange={() => {}} showTrigger={false} refreshTrigger={0} />,
    );

    // Open the sheet: shows initial data
    await act(async () => {
      rerender(<LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} refreshTrigger={0} />);
    });
    await waitFor(() => expect(screen.getByText("Golden King #1")).toBeInTheDocument());

    // Simulate save success and sheet-open re-fetch
    await act(async () => {
      rerender(<LeaderboardSheet open onOpenChange={() => {}} showTrigger={false} refreshTrigger={1} />);
    });

    // After trigger, updated score should appear
    await waitFor(() => {
      expect(screen.getByText("200")).toBeInTheDocument();
    });
  });
});
