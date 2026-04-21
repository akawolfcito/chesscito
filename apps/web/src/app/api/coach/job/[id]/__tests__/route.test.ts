import { describe, it, expect, vi, beforeEach } from "vitest";

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
    mockedOrigin.mockReset();
    redisMock.get.mockReset();
    mockedOrigin.mockImplementation(() => {});
  });

  it("returns 200 with the job payload when owner matches", async () => {
    const job = { status: "ready", response: { summary: "good play" }, wallet: VALID_WALLET };
    redisMock.get.mockResolvedValue(job);
    const res = await GET(makeRequest(VALID_WALLET), { params: { id: JOB_ID } });
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual(job);
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

  it("returns 200 when the stored job has no wallet metadata (legacy)", async () => {
    const job = { status: "pending" };
    redisMock.get.mockResolvedValue(job);
    const res = await GET(makeRequest(VALID_WALLET), { params: { id: JOB_ID } });
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual(job);
  });
});
