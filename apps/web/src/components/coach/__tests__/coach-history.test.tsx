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
