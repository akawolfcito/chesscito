import { describe, it, expect, vi, beforeEach } from "vitest";
const authorizeMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/coach-request-authorization", () => ({ authorizeCoachRequest: authorizeMock }));
const GAME_ID = "12345678-1234-4234-8234-123456789012";

const redisMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => redisMock },
}));

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
}));

import { GET } from "../route";
import { enforceOrigin } from "@/lib/server/demo-signing";

const mockedOrigin = vi.mocked(enforceOrigin);

const VALID_WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";
const OTHER_WALLET = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
const JOB_ID = "job-abc-123";

function makeRequest(wallet: string | null) {
  const suffix = wallet === null ? "" : `?wallet=${wallet}`;
  return new Request(`http://localhost/api/coach/job/${JOB_ID}${suffix}`, { method: "GET" });
}

describe("GET /api/coach/job/[id]", () => {
  beforeEach(() => {
    authorizeMock.mockResolvedValue({ gameId: GAME_ID });
    mockedOrigin.mockReset();
    redisMock.get.mockReset();
    mockedOrigin.mockImplementation(() => {});
  });

  it("returns 200 with the job payload when owner matches", async () => {
    const job = { status: "ready", response: { summary: "good play" }, wallet: VALID_WALLET, gameId: GAME_ID, internal: "qa-private-diagnostic" };
    redisMock.get.mockResolvedValue(job);
    const res = await GET(makeRequest(VALID_WALLET), { params: { id: JOB_ID } });
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ status: "ready", response: { summary: "good play" } });
  });

  it("returns 403 when enforceOrigin rejects", async () => {
    mockedOrigin.mockImplementation(() => { throw new Error("Forbidden"); });
    const res = await GET(makeRequest(VALID_WALLET), { params: { id: JOB_ID } });
    expect(res.status).toEqual(403);
  });

  it("returns 400 when the wallet query param is missing", async () => {
    const res = await GET(makeRequest(null), { params: { id: JOB_ID } });
    expect(res.status).toEqual(400);
  });

  it("returns 400 when the wallet address is malformed", async () => {
    const res = await GET(makeRequest("0xnope"), { params: { id: JOB_ID } });
    expect(res.status).toEqual(400);
  });

  it("returns 404 when the job does not exist", async () => {
    redisMock.get.mockResolvedValue(null);
    const res = await GET(makeRequest(VALID_WALLET), { params: { id: JOB_ID } });
    expect(res.status).toEqual(404);
  });

  it("returns 403 when the job belongs to another wallet", async () => {
    redisMock.get.mockResolvedValue({ status: "ready", wallet: OTHER_WALLET });
    const res = await GET(makeRequest(VALID_WALLET), { params: { id: JOB_ID } });
    expect(res.status).toEqual(403);
  });

  it("rejects legacy jobs with no wallet metadata", async () => {
    const job = { status: "pending" };
    redisMock.get.mockResolvedValue(job);
    const res = await GET(makeRequest(VALID_WALLET), { params: { id: JOB_ID } });
    expect(res.status).toEqual(403);
  });
  it("checks proof before reading any job", async () => {
    authorizeMock.mockResolvedValue(null);
    const res = await GET(makeRequest(VALID_WALLET), { params: { id: JOB_ID } });
    expect(res.status).toBe(401); expect(redisMock.get).not.toHaveBeenCalled();
  });
  it("rejects a job for another game even with the same wallet", async () => {
    redisMock.get.mockResolvedValue({ status: "pending", wallet: VALID_WALLET, gameId: "different" });
    expect((await GET(makeRequest(VALID_WALLET), { params: { id: JOB_ID } })).status).toBe(403);
  });
  it("returns only a safe reason for a failed owned job", async () => {
    redisMock.get.mockResolvedValue({ status: "failed", wallet: VALID_WALLET.toUpperCase(), gameId: GAME_ID, internal: "qa-private", reason: "qa-provider-details" });
    const res = await GET(makeRequest(VALID_WALLET), { params: { id: JOB_ID } });
    expect(await res.json()).toEqual({ status: "failed", reason: "Analysis failed, please retry" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

});
