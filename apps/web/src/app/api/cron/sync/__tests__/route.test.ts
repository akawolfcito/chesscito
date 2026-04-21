import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const runSyncMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/sync-blockchain", () => ({
  runSync: runSyncMock,
}));

import { GET } from "../route";
import { NextRequest } from "next/server";

function makeRequest(auth?: string) {
  const headers = new Headers();
  if (auth !== undefined) headers.set("authorization", auth);
  return new NextRequest("http://localhost/api/cron/sync", { headers });
}

describe("GET /api/cron/sync", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    runSyncMock.mockReset();
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("returns sync result on success when auth header matches CRON_SECRET", async () => {
    process.env.CRON_SECRET = "s3cret";
    const result = { synced: 5, failed: 0 };
    runSyncMock.mockResolvedValue(result);

    const res = await GET(makeRequest("Bearer s3cret"));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual(result);
    expect(runSyncMock).toHaveBeenCalledOnce();
  });

  it("returns 401 when authorization header is missing and CRON_SECRET is set", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await GET(makeRequest());
    expect(res.status).toEqual(401);
    expect(runSyncMock).not.toHaveBeenCalled();
  });

  it("returns 401 when authorization header does not match CRON_SECRET", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await GET(makeRequest("Bearer wrong"));
    expect(res.status).toEqual(401);
    expect(runSyncMock).not.toHaveBeenCalled();
  });

  it("runs the sync without auth check when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    runSyncMock.mockResolvedValue({ synced: 0, failed: 0 });
    const res = await GET(makeRequest());
    expect(res.status).toEqual(200);
    expect(runSyncMock).toHaveBeenCalledOnce();
  });

  it("returns 500 when runSync throws", async () => {
    process.env.CRON_SECRET = "s3cret";
    runSyncMock.mockRejectedValue(new Error("rpc dead"));
    const res = await GET(makeRequest("Bearer s3cret"));
    expect(res.status).toEqual(500);
    expect(await res.json()).toEqual({ error: "Sync failed" });
  });
});
