import { describe, expect, it, vi, afterEach } from "vitest";
import { renderWithIntl as render, waitFor } from "@/test-utils/render-with-intl";
import { PlayLeadersSheet } from "../play-leaders-sheet";

// getVictoryAddress()'s real implementation reads getConfiguredChainId(),
// which is unset in the test environment — mock it "configured" so the
// fetch path (rather than the early-return unconfigured path) is exercised.
vi.mock("@/lib/game/victory-events", () => ({ getVictoryAddress: () => "0xconfigured" }));

const originalFetch = global.fetch;

describe("PlayLeadersSheet", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("does not fetch when closed", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<PlayLeadersSheet open={false} onOpenChange={() => {}} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches /api/hall-of-fame when opened", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<PlayLeadersSheet open={true} onOpenChange={() => {}} />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith("/api/hall-of-fame"));
  });

  it("keeps a repeat winner's fresh optimistic victory even when the fetched list already has an older win from the same player", async () => {
    sessionStorage.setItem(
      "chesscito:optimistic-victory",
      JSON.stringify({
        tokenId: "999",
        player: "0xSamePlayer",
        difficulty: 1,
        totalMoves: 10,
        timeMs: 5000,
        ts: Date.now(),
      }),
    );
    const fetchSpy = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              tokenId: "1",
              player: "0xSamePlayer",
              difficulty: 0,
              totalMoves: 20,
              timeMs: 9000,
              timestamp: 1000,
            },
          ]),
      } as Response),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<PlayLeadersSheet open={true} onOpenChange={() => {}} />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    // The optimistic entry (tokenId 999) is NOT in the fetched rows (only
    // tokenId 1 is), so it must be prepended, not silently dropped just
    // because the same player already has a different confirmed win —
    // clearOptimisticVictory() must NOT have fired.
    await waitFor(() =>
      expect(sessionStorage.getItem("chesscito:optimistic-victory")).not.toBeNull(),
    );
  });
});
