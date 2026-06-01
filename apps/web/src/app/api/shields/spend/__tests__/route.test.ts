import { describe, it, expect, vi, beforeEach } from "vitest";

const redisMock = vi.hoisted(() => ({
  eval: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => redisMock },
}));

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "1.2.3.4"),
}));

import { POST } from "../route";
import {
  enforceOrigin,
  enforceRateLimit,
} from "@/lib/server/demo-signing";

const ADDRESS = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";

function makeRequest(body: unknown) {
  return new Request("https://chesscito.com/api/shields/spend", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/shields/spend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("decrements one shield and returns the new balance on success", async () => {
    redisMock.eval.mockResolvedValueOnce([7, 1]);

    const res = await POST(makeRequest({ walletAddress: ADDRESS }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, spent: 1, balance: 7 });
    expect(redisMock.eval).toHaveBeenCalledWith(
      expect.stringContaining("DECRBY"),
      [`coach:shields:credited:${ADDRESS}`],
      [],
    );
  });

  it("returns 409 insufficient when balance is zero", async () => {
    redisMock.eval.mockResolvedValueOnce([0, 0]);

    const res = await POST(makeRequest({ walletAddress: ADDRESS }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("insufficient");
  });

  it("returns 400 when walletAddress is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_params");
    expect(redisMock.eval).not.toHaveBeenCalled();
  });

  it("returns 400 invalid_wallet for non-address strings", async () => {
    const res = await POST(makeRequest({ walletAddress: "not-a-wallet" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_wallet");
    expect(redisMock.eval).not.toHaveBeenCalled();
  });

  it("returns 403 when origin check throws", async () => {
    vi.mocked(enforceOrigin).mockImplementationOnce(() => {
      throw new Error("Forbidden");
    });

    const res = await POST(makeRequest({ walletAddress: ADDRESS }));
    expect(res.status).toBe(403);
    expect(redisMock.eval).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(enforceRateLimit).mockRejectedValueOnce(
      new Error("Rate limit exceeded"),
    );

    const res = await POST(makeRequest({ walletAddress: ADDRESS }));
    expect(res.status).toBe(429);
    expect(redisMock.eval).not.toHaveBeenCalled();
  });

  it("lowercases the wallet address before keying Redis", async () => {
    redisMock.eval.mockResolvedValueOnce([5, 1]);
    const mixedCase = "0xCc4179A22b473Ea2eB2B9b9b210458d0F60Fc2dD";

    await POST(makeRequest({ walletAddress: mixedCase }));

    expect(redisMock.eval).toHaveBeenCalledWith(
      expect.any(String),
      [`coach:shields:credited:${mixedCase.toLowerCase()}`],
      [],
    );
  });

  it("returns 500 on unhandled Redis exception", async () => {
    redisMock.eval.mockRejectedValueOnce(new Error("redis down"));

    const res = await POST(makeRequest({ walletAddress: ADDRESS }));
    expect(res.status).toBe(500);
  });
});
