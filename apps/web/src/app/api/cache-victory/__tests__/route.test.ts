import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/queries", () => ({
  insertVictory: vi.fn(),
}));
vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
}));

import { POST } from "../route";
import { insertVictory } from "@/lib/supabase/queries";
import { enforceOrigin } from "@/lib/server/demo-signing";

const mockedInsert = vi.mocked(insertVictory);
const mockedOrigin = vi.mocked(enforceOrigin);

const VALID_ADDRESS = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";
const VALID_BODY = {
  player: VALID_ADDRESS,
  tokenId: "7",
  difficulty: 1,
  totalMoves: 13,
  timeMs: 11_583,
  txHash: "0xabc123",
};

function makeRequest(body: unknown) {
  return new NextRequest(new URL("http://localhost/api/cache-victory"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/cache-victory", () => {
  beforeEach(() => {
    mockedInsert.mockReset();
    mockedOrigin.mockReset();
    mockedOrigin.mockImplementation(() => {});
    mockedInsert.mockResolvedValue(undefined);
  });

  it("returns 200 and forwards the row to insertVictory on a valid body", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ ok: true });
    const forwarded = mockedInsert.mock.calls[0][0];
    expect(forwarded.player).toEqual(VALID_ADDRESS.toLowerCase());
    expect(forwarded.token_id).toEqual(7);
    expect(forwarded.difficulty).toEqual(1);
    expect(forwarded.total_moves).toEqual(13);
    expect(forwarded.time_ms).toEqual(11_583);
    expect(forwarded.tx_hash).toEqual("0xabc123");
    expect(typeof forwarded.minted_at).toEqual("string");
  });

  it("returns 403 when origin is rejected", async () => {
    mockedOrigin.mockImplementation(() => { throw new Error("Forbidden"); });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toEqual(403);
  });

  it("returns 400 for invalid player address", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, player: "0xnope" }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when tokenId is missing/empty/not-a-string", async () => {
    for (const bad of [undefined, "", 7]) {
      const res = await POST(makeRequest({ ...VALID_BODY, tokenId: bad }));
      expect(res.status).toEqual(400);
    }
  });

  it("returns 400 when difficulty is outside 1-3", async () => {
    for (const bad of [0, 4, "1" as unknown as number]) {
      const res = await POST(makeRequest({ ...VALID_BODY, difficulty: bad }));
      expect(res.status).toEqual(400);
    }
  });

  it("returns 400 for non-positive totalMoves or timeMs", async () => {
    let res = await POST(makeRequest({ ...VALID_BODY, totalMoves: 0 }));
    expect(res.status).toEqual(400);
    res = await POST(makeRequest({ ...VALID_BODY, timeMs: -1 }));
    expect(res.status).toEqual(400);
  });

  it("does not call insertVictory on any validation failure", async () => {
    await POST(makeRequest({ ...VALID_BODY, tokenId: "" }));
    expect(mockedInsert).not.toHaveBeenCalled();
  });
});
