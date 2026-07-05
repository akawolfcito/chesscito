import { describe, expect, it, vi, afterEach } from "vitest";
import { renderWithIntl as render, waitFor } from "@/test-utils/render-with-intl";
import { PlayLeadersSheet } from "../play-leaders-sheet";

vi.mock("@/lib/game/victory-events", () => ({ getVictoryAddress: () => "0xconfigured" }));

const originalFetch = global.fetch;

describe("PlayLeadersSheet", () => {
  afterEach(() => {
    global.fetch = originalFetch;
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
});
