/**
 * POST /api/admin/content/stage — content-staging-model slice 4.
 *
 * Promote/demote one puzzle version by calling the transactional `promote_content`
 * RPC, then revalidate THIS deployment's `content` tag (no cross-deployment
 * fan-out — other envs refresh on the TTL). ADMIN_TOKEN-gated + rate-limited.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/server/demo-signing", () => ({
  enforceRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(() => supabaseMock),
}));

import { POST } from "../route";
import { revalidateTag } from "next/cache";
import { enforceRateLimit } from "@/lib/server/demo-signing";
import { getSupabaseServer } from "@/lib/supabase/server";

const mockedRevalidate = vi.mocked(revalidateTag);
const mockedRate = vi.mocked(enforceRateLimit);
const mockedSupabase = vi.mocked(getSupabaseServer);

const TOKEN = "s3cr3t-admin-token";

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/admin/content/stage", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function authed(body: unknown) {
  return req(body, { "x-admin-token": TOKEN });
}

const VALID = { kind: "exercise", id: "rook-1", from: "draft", to: "published" };

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock.rpc.mockResolvedValue({ data: 1, error: null });
  mockedSupabase.mockReturnValue(supabaseMock as never);
  process.env.ADMIN_TOKEN = TOKEN;
});

afterEach(() => {
  delete process.env.ADMIN_TOKEN;
});

describe("POST /api/admin/content/stage", () => {
  it("503 and no RPC when ADMIN_TOKEN is unset", async () => {
    delete process.env.ADMIN_TOKEN;
    const res = await POST(authed(VALID));
    expect(res.status).toBe(503);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("403 and no RPC on a bad/absent token", async () => {
    const res = await POST(req(VALID, { "x-admin-token": "wrong" }));
    expect(res.status).toBe(403);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("429 when the rate limit is exceeded", async () => {
    mockedRate.mockRejectedValueOnce(new Error("Rate limit exceeded"));
    const res = await POST(authed(VALID));
    expect(res.status).toBe(429);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("400 on an invalid stage value", async () => {
    const res = await POST(authed({ ...VALID, to: "prod" }));
    expect(res.status).toBe(400);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("400 when from === to (no-op rejected)", async () => {
    const res = await POST(authed({ ...VALID, from: "draft", to: "draft" }));
    expect(res.status).toBe(400);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("400 on a missing id", async () => {
    const res = await POST(authed({ kind: "exercise", from: "draft", to: "preview" }));
    expect(res.status).toBe(400);
  });

  it("404 when the RPC reports the `from` version is absent (returns 0)", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 0, error: null });
    const res = await POST(authed(VALID));
    expect(res.status).toBe(404);
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });

  it("promotes via the transactional RPC, revalidates content, returns from/to", async () => {
    const res = await POST(authed(VALID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, from: "draft", to: "published" });
    expect(supabaseMock.rpc).toHaveBeenCalledWith("promote_content", {
      p_kind: "exercise",
      p_id: "rook-1",
      p_from: "draft",
      p_to: "published",
    });
    expect(mockedRevalidate).toHaveBeenCalledWith("content");
  });

  it("supports a demote (published → draft)", async () => {
    const res = await POST(authed({ ...VALID, from: "published", to: "draft" }));
    expect(res.status).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      "promote_content",
      expect.objectContaining({ p_from: "published", p_to: "draft" }),
    );
  });

  it("500 when the RPC errors", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await POST(authed(VALID));
    expect(res.status).toBe(500);
  });
});
