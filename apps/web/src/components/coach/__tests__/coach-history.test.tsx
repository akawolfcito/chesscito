import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithIntl as render, screen, waitFor } from "@/test-utils/render-with-intl";
import { CoachHistory } from "../coach-history";

const VALID_WALLET = "0x1234567890abcdef1234567890abcdef12345678";
const UUID_A = "11111111-2222-3333-4444-555555555555";
const UUID_B = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const UUID_C = "99999999-8888-7777-6666-555555555555";

function analyzedRecord(gameId: string, result: "win" | "loss" = "win") {
  return {
    gameId,
    response: {
      kind: "full" as const,
      summary: "Solid endgame.",
      lessons: ["Trade rooks earlier."],
    },
    game: {
      gameId,
      result,
      difficulty: "medium",
      totalMoves: 32,
      moves: [],
    },
  };
}

function unanalyzedGame(gameId: string) {
  return {
    gameId,
    result: "win",
    difficulty: "easy",
    totalMoves: 28,
    moves: [],
    receivedAt: Date.now(),
  };
}

function mockFetch(historyPayload: unknown, gamesPayload: unknown) {
  return vi.fn(async (url: string) => {
    if (url.includes("/api/coach/history")) {
      return { ok: true, json: async () => historyPayload } as Response;
    }
    if (url.includes("/api/games")) {
      return { ok: true, json: async () => gamesPayload } as Response;
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  });
}

const noop = () => {};

describe("<CoachHistory> — a11y landmark (Cluster E defer #5)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("wraps the panel in a labeled region (head analyzed → LatestReviewCard inside region)", async () => {
    globalThis.fetch = mockFetch(
      [analyzedRecord(UUID_A, "win")],
      [unanalyzedGame(UUID_B), unanalyzedGame(UUID_C)],
    ) as typeof fetch;

    render(
      <CoachHistory
        walletAddress={VALID_WALLET}
        credits={0}
        onSelectEntry={noop}
      />,
    );

    const region = await screen.findByRole("region", { name: /coach review history/i });
    expect(region).toBeInTheDocument();

    // Latest review card lives inside the region.
    const latest = await screen.findByRole("button", {
      name: /Open .* Coach Review/i,
    });
    expect(region.contains(latest)).toBe(true);

    // role="list" of older entries also lives inside the same region.
    const list = await screen.findByRole("list");
    expect(region.contains(list)).toBe(true);
  });

  it("wraps the panel in a labeled region (head unanalyzed → only the list inside region)", async () => {
    globalThis.fetch = mockFetch(
      [],
      [unanalyzedGame(UUID_A), unanalyzedGame(UUID_B)],
    ) as typeof fetch;

    render(
      <CoachHistory
        walletAddress={VALID_WALLET}
        credits={0}
        onSelectEntry={noop}
      />,
    );

    const region = await screen.findByRole("region", { name: /coach review history/i });
    expect(region).toBeInTheDocument();

    const list = await screen.findByRole("list");
    expect(region.contains(list)).toBe(true);

    // No LatestReviewCard because nothing is analyzed.
    expect(screen.queryByText(/Latest Review/i)).not.toBeInTheDocument();
  });

  it("renders the region even on empty state (no landmark loss when there's nothing to show)", async () => {
    globalThis.fetch = mockFetch([], []) as typeof fetch;

    render(
      <CoachHistory
        walletAddress={VALID_WALLET}
        credits={0}
        onSelectEntry={noop}
      />,
    );

    // Empty state still must keep the panel discoverable as a landmark
    // so screen-reader users can navigate to it.
    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /coach review history/i }),
      ).toBeInTheDocument();
    });
  });
});

describe("<CoachHistory> — zero-move filter (T11 / red-team H-9)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hides analyzed entries with totalMoves === 0 from the list", async () => {
    const zeroMoveRecord = {
      ...analyzedRecord(UUID_A, "win"),
      game: { ...analyzedRecord(UUID_A, "win").game, totalMoves: 0 },
    };
    const normalRecord = analyzedRecord(UUID_B, "win");

    globalThis.fetch = mockFetch([zeroMoveRecord, normalRecord], []) as typeof fetch;

    render(
      <CoachHistory walletAddress={VALID_WALLET} credits={0} onSelectEntry={noop} />,
    );

    // The normal entry renders via LatestReviewCard (role="button").
    // The zero-move entry is silently filtered — only 1 entry total.
    const latestCard = await screen.findByRole("button", {
      name: /Open .* Coach Review/i,
    });
    expect(latestCard).toBeInTheDocument();
    // Zero-move record must not appear — no "0 moves" text anywhere.
    expect(screen.queryByText(/\b0 moves\b/)).not.toBeInTheDocument();
  });

  it("hides unanalyzed entries with totalMoves === 0", async () => {
    const zeroMoveGame = { ...unanalyzedGame(UUID_A), totalMoves: 0 };
    const normalGame = unanalyzedGame(UUID_B);

    globalThis.fetch = mockFetch([], [zeroMoveGame, normalGame]) as typeof fetch;

    render(
      <CoachHistory walletAddress={VALID_WALLET} credits={0} onSelectEntry={noop} />,
    );

    await screen.findByRole("region", { name: /coach review history/i });
    // Only the normal unanalyzed entry renders (role="listitem" on the button).
    // Zero-move entry must produce no row — no "0 moves" text in the list.
    await screen.findByRole("listitem");
    expect(screen.queryByText(/\b0 moves\b/)).not.toBeInTheDocument();
  });

  it("shows empty state when ALL entries have totalMoves === 0", async () => {
    const zeroMoveGame = { ...unanalyzedGame(UUID_A), totalMoves: 0 };

    globalThis.fetch = mockFetch([], [zeroMoveGame]) as typeof fetch;

    render(
      <CoachHistory walletAddress={VALID_WALLET} credits={0} onSelectEntry={noop} />,
    );

    await screen.findByRole("region", { name: /coach review history/i });
    // All filtered → empty state rendered.
    await screen.findByRole("link", { name: /go to arena/i });
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});

describe("<CoachHistory> — locale-aware fetch (2026-05-24)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes the active locale as ?locale= so ES users see their ES analyses", async () => {
    const fetchSpy = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => [],
    })) as unknown as typeof fetch;
    globalThis.fetch = fetchSpy;

    render(
      <CoachHistory
        walletAddress={VALID_WALLET}
        credits={0}
        onSelectEntry={noop}
      />,
      { locale: "es" },
    );

    await waitFor(() => {
      const historyCall = (fetchSpy as unknown as { mock: { calls: string[][] } }).mock.calls.find(
        (args) => typeof args[0] === "string" && args[0].includes("/api/coach/history"),
      );
      expect(historyCall).toBeDefined();
      expect(historyCall![0]).toContain(`wallet=${VALID_WALLET}`);
      expect(historyCall![0]).toContain("locale=es");
    });
  });

  it("defaults to ?locale=en when the active UI locale is EN", async () => {
    const fetchSpy = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => [],
    })) as unknown as typeof fetch;
    globalThis.fetch = fetchSpy;

    render(
      <CoachHistory
        walletAddress={VALID_WALLET}
        credits={0}
        onSelectEntry={noop}
      />,
    );

    await waitFor(() => {
      const historyCall = (fetchSpy as unknown as { mock: { calls: string[][] } }).mock.calls.find(
        (args) => typeof args[0] === "string" && args[0].includes("/api/coach/history"),
      );
      expect(historyCall).toBeDefined();
      expect(historyCall![0]).toContain("locale=en");
    });
  });
});

describe("<CoachHistory> — Save Later chip (2026-05-31)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function recordWithMint(
    gameId: string,
    result: "win" | "loss",
    mintedTokenId?: string,
  ) {
    return {
      ...analyzedRecord(gameId, result),
      game: {
        ...analyzedRecord(gameId, result).game,
        mintedTokenId,
      },
    };
  }

  it("renders the chip on a win row that was never minted", async () => {
    globalThis.fetch = mockFetch(
      [recordWithMint(UUID_A, "win", undefined)],
      [],
    ) as typeof fetch;
    render(
      <CoachHistory walletAddress={VALID_WALLET} credits={0} onSelectEntry={noop} />,
    );
    expect(await screen.findByText(/save available/i)).toBeInTheDocument();
  });

  it("hides the chip on a win row that is already minted", async () => {
    globalThis.fetch = mockFetch(
      [recordWithMint(UUID_A, "win", "42")],
      [],
    ) as typeof fetch;
    render(
      <CoachHistory walletAddress={VALID_WALLET} credits={0} onSelectEntry={noop} />,
    );
    // Wait for the row to mount via its open-label affordance.
    await screen.findByText("32 moves");
    expect(screen.queryByText(/save available/i)).not.toBeInTheDocument();
  });

  it("hides the chip on a loss row regardless of mint state", async () => {
    globalThis.fetch = mockFetch(
      [recordWithMint(UUID_A, "loss", undefined)],
      [],
    ) as typeof fetch;
    render(
      <CoachHistory walletAddress={VALID_WALLET} credits={0} onSelectEntry={noop} />,
    );
    await screen.findByText("32 moves");
    expect(screen.queryByText(/save available/i)).not.toBeInTheDocument();
  });
});
