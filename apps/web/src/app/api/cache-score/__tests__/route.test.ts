import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/queries", () => ({
  insertScore: vi.fn(),
}));
vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
}));

import { POST } from "../route";
import { insertScore } from "@/lib/supabase/queries";
import { enforceOrigin } from "@/lib/server/demo-signing";

const mockedInsert = vi.mocked(insertScore);
const mockedOrigin = vi.mocked(enforceOrigin);

const VALID_ADDRESS = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";
const VALID_BODY = {
  player: VALID_ADDRESS,
  levelId: 1,
  score: 900,
  timeMs: 15_000,
  txHash: "0xdeadbeef",
};

function makeRequest(body: unknown) {
  return new NextRequest(new URL("http://localhost/api/cache-score"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/cache-score", () => {
  beforeEach(() => {
    mockedInsert.mockReset();
    mockedOrigin.mockReset();
    mockedOrigin.mockImplementation(() => {});
    mockedInsert.mockResolvedValue(undefined);
  });

  it("returns 200 and forwards the row to insertScore on a valid body", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockedInsert).toHaveBeenCalledWith({
      player: VALID_ADDRESS.toLowerCase(),
      level_id: 1,
      score: 900,
      time_ms: 15_000,
      tx_hash: "0xdeadbeef",
    });
  });

  it("returns 403 when origin is rejected", async () => {
    mockedOrigin.mockImplementation(() => { throw new Error("Forbidden"); });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toEqual(403);
  });

  it("returns 400 for invalid player address", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, player: "0xnope" }));
    expect(res.status).toEqual(400);
    expect((await res.json()).error).toEqual("Invalid player address");
  });

  it("returns 400 for levelId out of range (0 or > 6)", async () => {
    for (const bad of [0, 7, "1" as unknown as number]) {
      const res = await POST(makeRequest({ ...VALID_BODY, levelId: bad }));
      expect(res.status).toEqual(400);
      expect((await res.json()).error).toEqual("Invalid levelId");
    }
  });

  it("returns 400 for score <= 0", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, score: 0 }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 for missing/malformed txHash", async () => {
    for (const bad of [undefined, "nothex"]) {
      const res = await POST(makeRequest({ ...VALID_BODY, txHash: bad }));
      expect(res.status).toEqual(400);
    }
  });

  it("does not call insertScore on any validation failure", async () => {
    await POST(makeRequest({ ...VALID_BODY, player: "0xnope" }));
    expect(mockedInsert).not.toHaveBeenCalled();
  });
});
