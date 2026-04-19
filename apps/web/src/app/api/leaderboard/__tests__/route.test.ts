import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/server/leaderboard", () => ({
  fetchLeaderboard: vi.fn(),
}));

import { GET } from "../route";
import { fetchLeaderboard } from "@/lib/server/leaderboard";

const mocked = vi.mocked(fetchLeaderboard);

describe("GET /api/leaderboard", () => {
  beforeEach(() => {
    mocked.mockReset();
  });

  it("returns 200 with the leaderboard JSON on success", async () => {
    const rows = [{ rank: 1, player: "0xcc41...c2dd", score: 3000, isVerified: false }];
    mocked.mockResolvedValue(rows);

    const res = await GET();
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual(rows);
  });

  it("returns 500 with a sanitized error message when the service throws", async () => {
    mocked.mockRejectedValue(new Error("supabase connection refused"));

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET();
    expect(res.status).toEqual(500);
    const body = await res.json();
    expect(body.error).toEqual("Failed to fetch leaderboard");
    expect(body.error).not.toContain("supabase"); // raw error not leaked to client
    errorSpy.mockRestore();
  });
});
