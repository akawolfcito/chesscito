import { describe, it, expect, vi, beforeEach } from "vitest";

const supabaseChain = vi.hoisted(() => {
  const state = { data: null as unknown, error: null as unknown };
  const reset = () => {
    state.data = null;
    state.error = null;
  };
  const chain = {
    from: vi.fn(() => chain),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: state.data, error: state.error })),
    __setNextResult: (data: unknown, error: unknown) => {
      state.data = data;
      state.error = error;
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
  enforceReadRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "1.2.3.4"),
}));

import { GET } from "../route";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  enforceOrigin,
  enforceReadRateLimit,
} from "@/lib/server/demo-signing";

const VALID_WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";

function makeRequest(wallet: string | null) {
  const url = wallet
    ? `https://chesscito.com/api/welcome-pack/status?wallet=${wallet}`
    : `https://chesscito.com/api/welcome-pack/status`;
  return new Request(url, { method: "GET" });
}

describe("GET /api/welcome-pack/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseChain.__reset();
    vi.mocked(getSupabaseServer).mockReturnValue(supabaseChain as never);
  });

  it("returns claimed=true with claimed_at when a row exists", async () => {
    supabaseChain.__setNextResult(
      { claimed_at: "2026-05-31T12:00:00.000Z" },
      null,
    );

    const res = await GET(makeRequest(VALID_WALLET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      claimed: true,
      claimed_at: "2026-05-31T12:00:00.000Z",
    });
    expect(supabaseChain.eq).toHaveBeenCalledWith(
      "wallet_address",
      VALID_WALLET,
    );
  });

  it("returns claimed=false when no row exists", async () => {
    supabaseChain.__setNextResult(null, null);

    const res = await GET(makeRequest(VALID_WALLET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, claimed: false, claimed_at: null });
  });

  it("lowercases the wallet before querying (consistent with PK normalization)", async () => {
    supabaseChain.__setNextResult(null, null);
    const mixedCase = "0xCc4179A22b473Ea2eB2B9b9b210458d0F60Fc2dD";

    await GET(makeRequest(mixedCase));

    expect(supabaseChain.eq).toHaveBeenCalledWith(
      "wallet_address",
      mixedCase.toLowerCase(),
    );
  });

  it("returns 400 missing_params when wallet query string is absent", async () => {
    const res = await GET(makeRequest(null));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_params");
    expect(supabaseChain.maybeSingle).not.toHaveBeenCalled();
  });

  it("returns 400 invalid_wallet for non-address input", async () => {
    const res = await GET(makeRequest("not-an-address"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_wallet");
    expect(supabaseChain.maybeSingle).not.toHaveBeenCalled();
  });

  it("returns 403 when origin check throws", async () => {
    vi.mocked(enforceOrigin).mockImplementationOnce(() => {
      throw new Error("Forbidden");
    });

    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toBe(403);
    expect(supabaseChain.maybeSingle).not.toHaveBeenCalled();
  });

  it("returns 429 when read-limiter throws", async () => {
    vi.mocked(enforceReadRateLimit).mockRejectedValueOnce(
      new Error("Rate limit exceeded"),
    );

    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limited");
  });

  it("returns 500 when Supabase env is missing", async () => {
    vi.mocked(getSupabaseServer).mockReturnValueOnce(null);

    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toBe(500);
  });

  it("returns 500 when Supabase query returns an error", async () => {
    supabaseChain.__setNextResult(null, {
      code: "P0001",
      message: "db down",
    });

    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toBe(500);
  });

  it("uses enforceReadRateLimit (lenient, not the strict signing limiter)", async () => {
    supabaseChain.__setNextResult(null, null);
    await GET(makeRequest(VALID_WALLET));
    expect(enforceReadRateLimit).toHaveBeenCalledTimes(1);
  });
});
