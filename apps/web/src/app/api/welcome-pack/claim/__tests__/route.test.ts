import { describe, it, expect, vi, beforeEach } from "vitest";

const redisMock = vi.hoisted(() => ({
  incrby: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => redisMock },
}));

const supabaseChain = vi.hoisted(() => {
  type ChainResult = { data: unknown; error: unknown };
  const state = { last: { data: null as unknown, error: null as unknown } };
  const reset = () => {
    state.last = { data: null, error: null };
  };
  const chain = {
    from: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async (): Promise<ChainResult> => state.last),
    __setNextResult: (data: unknown, error: unknown) => {
      state.last = { data, error };
    },
    __reset: reset,
  };
  return chain;
});

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(() => supabaseChain),
}));

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "1.2.3.4"),
}));

vi.mock("@/lib/server/welcome-pack", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/server/welcome-pack")
  >("@/lib/server/welcome-pack");
  return {
    ...actual,
    validateClaimInput: vi.fn(),
    hashIp: vi.fn(() => "ip-hash-stub"),
    hashUserAgent: vi.fn(() => "ua-hash-stub"),
  };
});

import { POST } from "../route";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  enforceOrigin,
  enforceRateLimit,
} from "@/lib/server/demo-signing";
import { validateClaimInput } from "@/lib/server/welcome-pack";

const ADDRESS = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";
const ADDRESS_LOWER = ADDRESS.toLowerCase();
const VALID_BODY = {
  address: ADDRESS,
  signature: "0xsig",
  message: `Chesscito Welcome Pack — claim for ${ADDRESS} at 2026-05-31T12:00:00.000Z`,
};

function makeRequest(body: unknown) {
  return new Request("https://chesscito.com/api/welcome-pack/claim", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "user-agent": "test-ua" },
  });
}

describe("POST /api/welcome-pack/claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseChain.__reset();
    vi.mocked(validateClaimInput).mockResolvedValue({
      ok: true,
      address: ADDRESS as `0x${string}`,
    });
    vi.mocked(getSupabaseServer).mockReturnValue(supabaseChain as never);
    redisMock.incrby.mockResolvedValue(3);
  });

  it("claims successfully on first call — inserts row + credits 3 shields", async () => {
    supabaseChain.__setNextResult(
      { claimed_at: "2026-05-31T12:00:00.000Z" },
      null,
    );

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      claimed: true,
      shields_granted: 3,
      credited: 3,
      claimed_at: "2026-05-31T12:00:00.000Z",
    });
    expect(supabaseChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        wallet_address: ADDRESS_LOWER,
        ip_hash: "ip-hash-stub",
        signature: "0xsig",
        user_agent_hash: "ua-hash-stub",
      }),
    );
    expect(redisMock.incrby).toHaveBeenCalledWith(
      `coach:shields:credited:${ADDRESS_LOWER}`,
      3,
    );
  });

  it("returns already_claimed (200) on Postgres unique violation (23505)", async () => {
    let call = 0;
    supabaseChain.maybeSingle.mockImplementation(async () => {
      call += 1;
      if (call === 1) {
        return { data: null, error: { code: "23505", message: "dup" } };
      }
      // Second call: the post-conflict SELECT
      return {
        data: { claimed_at: "2026-05-20T10:00:00.000Z" },
        error: null,
      };
    });

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      already_claimed: true,
      claimed_at: "2026-05-20T10:00:00.000Z",
    });
    // Critical: do NOT credit on already-claimed branch
    expect(redisMock.incrby).not.toHaveBeenCalled();
  });

  it("returns 403 when origin check throws", async () => {
    vi.mocked(enforceOrigin).mockImplementationOnce(() => {
      throw new Error("Forbidden");
    });

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toBe("origin_blocked");
    expect(supabaseChain.insert).not.toHaveBeenCalled();
  });

  it("returns 400 when address/signature/message are missing", async () => {
    const res = await POST(makeRequest({ address: ADDRESS }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("missing_params");
    expect(validateClaimInput).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limit is exceeded", async () => {
    vi.mocked(enforceRateLimit).mockRejectedValueOnce(
      new Error("Rate limit exceeded"),
    );

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("rate_limited");
    expect(supabaseChain.insert).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid_address validation error", async () => {
    vi.mocked(validateClaimInput).mockResolvedValueOnce({
      ok: false,
      error: "invalid_address",
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_address");
  });

  it("returns 401 for signature_mismatch validation error", async () => {
    vi.mocked(validateClaimInput).mockResolvedValueOnce({
      ok: false,
      error: "signature_mismatch",
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("signature_mismatch");
  });

  it("returns 401 for stale_request (replay attempt)", async () => {
    vi.mocked(validateClaimInput).mockResolvedValueOnce({
      ok: false,
      error: "stale_request",
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("stale_request");
  });

  it("returns 500 when Supabase env is missing", async () => {
    vi.mocked(getSupabaseServer).mockReturnValueOnce(null);

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("claim_failed");
  });

  it("returns 500 credit_failed when INSERT succeeds but Redis INCRBY fails (v1 edge case)", async () => {
    supabaseChain.__setNextResult(
      { claimed_at: "2026-05-31T12:00:00.000Z" },
      null,
    );
    redisMock.incrby.mockRejectedValueOnce(new Error("redis down"));

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("credit_failed");
  });

  it("lowercases the wallet address before persisting (idempotency invariant)", async () => {
    supabaseChain.__setNextResult({ claimed_at: "2026-05-31T12:00:00.000Z" }, null);
    const mixedCase = "0xCc4179A22b473Ea2eB2B9b9b210458d0F60Fc2dD";
    vi.mocked(validateClaimInput).mockResolvedValueOnce({
      ok: true,
      address: mixedCase as `0x${string}`,
    });

    await POST(makeRequest({ ...VALID_BODY, address: mixedCase }));

    expect(supabaseChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ wallet_address: mixedCase.toLowerCase() }),
    );
    expect(redisMock.incrby).toHaveBeenCalledWith(
      `coach:shields:credited:${mixedCase.toLowerCase()}`,
      3,
    );
  });
});
