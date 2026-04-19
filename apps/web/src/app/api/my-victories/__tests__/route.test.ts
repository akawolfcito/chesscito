import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/server/hof", () => ({
  getPlayerVictories: vi.fn(),
}));

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
}));

import { GET } from "../route";
import { getPlayerVictories } from "@/lib/server/hof";
import { enforceOrigin } from "@/lib/server/demo-signing";

const mockedVictories = vi.mocked(getPlayerVictories);
const mockedOrigin = vi.mocked(enforceOrigin);

function makeRequest(url: string, origin = "https://chesscito.vercel.app") {
  return new NextRequest(new URL(url), {
    headers: { origin },
  });
}

const VALID_ADDRESS = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";

describe("GET /api/my-victories", () => {
  beforeEach(() => {
    mockedVictories.mockReset();
    mockedOrigin.mockReset();
    mockedOrigin.mockImplementation(() => {}); // default: allow
  });

  it("returns 403 when the origin is not allowed", async () => {
    mockedOrigin.mockImplementation(() => {
      throw new Error("Forbidden");
    });
    const req = makeRequest(`http://localhost/api/my-victories?player=${VALID_ADDRESS}`);
    const res = await GET(req);
    expect(res.status).toEqual(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("returns 400 when the player query param is missing", async () => {
    const req = makeRequest("http://localhost/api/my-victories");
    const res = await GET(req);
    expect(res.status).toEqual(400);
    expect((await res.json()).error).toEqual("Missing or invalid player address");
  });

  it("returns 400 when the player address is malformed", async () => {
    const req = makeRequest("http://localhost/api/my-victories?player=0x0000");
    const res = await GET(req);
    expect(res.status).toEqual(400);
  });

  it("returns 200 with the player's victory rows for a valid address", async () => {
    const rows = [{
      tokenId: "7",
      player: VALID_ADDRESS,
      difficulty: 1,
      totalMoves: 13,
      timeMs: 11583,
      timestamp: 1774620087,
    }];
    mockedVictories.mockResolvedValue(rows);

    const req = makeRequest(`http://localhost/api/my-victories?player=${VALID_ADDRESS}`);
    const res = await GET(req);
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual(rows);
    expect(mockedVictories).toHaveBeenCalledWith(VALID_ADDRESS);
  });

  it("returns 200 with empty array when the player has no victories", async () => {
    mockedVictories.mockResolvedValue([]);
    const req = makeRequest(`http://localhost/api/my-victories?player=${VALID_ADDRESS}`);
    const res = await GET(req);
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual([]);
  });
});
