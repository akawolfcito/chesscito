import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/server/hof", () => ({
  getHallOfFame: vi.fn(),
}));

import { GET } from "../route";
import { getHallOfFame } from "@/lib/server/hof";

const mocked = vi.mocked(getHallOfFame);

describe("GET /api/hall-of-fame", () => {
  beforeEach(() => {
    mocked.mockReset();
  });

  it("returns 200 with the victory rows on success", async () => {
    const rows = [{
      tokenId: "7",
      player: "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd",
      difficulty: 1,
      totalMoves: 13,
      timeMs: 11583,
      timestamp: 1774620087,
    }];
    mocked.mockResolvedValue(rows);

    const res = await GET();
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual(rows);
  });

  it("returns 500 with a sanitized error when the service throws", async () => {
    mocked.mockRejectedValue(new Error("internal database error"));
    const res = await GET();
    expect(res.status).toEqual(500);
    const body = await res.json();
    expect(body.error).toEqual("Failed to fetch hall of fame");
    expect(body.error).not.toContain("database"); // raw error not leaked
  });

  it("returns an empty array when no victories exist yet", async () => {
    mocked.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual([]);
  });
});
