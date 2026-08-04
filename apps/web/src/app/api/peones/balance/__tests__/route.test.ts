/**
 * Tests for GET /api/peones/balance — Sprint 3 commit C of Training
 * Economy Alpha (2026-06-07). READ-ONLY endpoint, NO writes, NO
 * earn, NO spend, NO UI consumer yet.
 *
 * Mocks the Supabase client + the demo-signing guards + the logger.
 * The migration from commit A is NOT applied to hosted Supabase yet,
 * so these tests are the only contract enforcement until a future
 * deploy-time smoke runs against real tables.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/server/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(),
}));

vi.mock("@/lib/server/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Sprint 4 commit J — welcome pack helper. Default = no-op (returns
// false / "already seeded") so legacy Sprint 3 tests behave bit-
// identically. Specific welcome-pack-seeded tests override per-test.
vi.mock("@/lib/peones/welcome-pack-server", () => ({
  ensurePeonesWelcomePack: vi.fn(async () => false),
}));

import { GET } from "../route";
import { PEONES_DAILY_CAP } from "@/lib/peones/types";
import { enforceOrigin } from "@/lib/server/demo-signing";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { getSupabaseServer } from "@/lib/supabase/server";
import { ensurePeonesWelcomePack } from "@/lib/peones/welcome-pack-server";

const mockedOrigin = vi.mocked(enforceOrigin);
const mockedRate = vi.mocked(checkRateLimit);

/** The guard's "you may proceed" shape. */
const ALLOWED = { allowed: true, outcome: "allowed", resetAt: null } as const;
const mockedSupabase = vi.mocked(getSupabaseServer);
const mockedWelcomePack = vi.mocked(ensurePeonesWelcomePack);

const VALID_WALLET = "0xabcdef0123456789abcdef0123456789abcdef01";
const VALID_WALLET_UPPER = "0xABCDEF0123456789ABCDEF0123456789ABCDEF01";
const VALID_WALLET_MIXED = "0xAbCdEf0123456789AbCdEf0123456789AbCdEf01";

function makeRequest(wallet: string | null) {
  const suffix = wallet === null ? "" : `?wallet=${wallet}`;
  return new Request(`http://localhost/api/peones/balance${suffix}`, {
    method: "GET",
  });
}

/**
 * Builds a chainable Supabase mock that returns the configured rpc
 * result + a `from(...).select(...).eq(...).maybeSingle()` result.
 * Tracks call counts on rpc + from so tests can assert read-only.
 */
function buildSupabaseMock(opts: {
  rpcResult?: { data: unknown; error: unknown };
  maybeSingleResult?: { data: unknown; error: unknown };
}) {
  const rpc = vi.fn().mockResolvedValue(
    opts.rpcResult ?? { data: null, error: null },
  );
  const maybeSingle = vi.fn().mockResolvedValue(
    opts.maybeSingleResult ?? { data: null, error: null },
  );
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  // Write methods stay defined but throw if called — proves the
  // endpoint is read-only. The contract tests below assert
  // they're never invoked.
  const insert = vi.fn(() => {
    throw new Error("insert called on a read-only endpoint");
  });
  const update = vi.fn(() => {
    throw new Error("update called on a read-only endpoint");
  });
  const del = vi.fn(() => {
    throw new Error("delete called on a read-only endpoint");
  });

  const supabase = {
    rpc,
    from,
    // Track these so the read-only assertion has something to inspect.
    _writeProbes: { insert, update, delete: del },
  };
  return { supabase, rpc, from, maybeSingle };
}

beforeEach(() => {
  mockedOrigin.mockReset();
  mockedRate.mockReset();
  mockedRate.mockResolvedValue(ALLOWED);
  mockedSupabase.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/peones/balance — input validation", () => {
  it("returns 400 invalid_wallet when no wallet query param is present", async () => {
    const { supabase } = buildSupabaseMock({});
    mockedSupabase.mockReturnValue(supabase as never);

    const res = await GET(makeRequest(null));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_wallet" });
  });

  it("returns 400 invalid_wallet when the wallet is malformed", async () => {
    const { supabase } = buildSupabaseMock({});
    mockedSupabase.mockReturnValue(supabase as never);

    const res = await GET(makeRequest("0xnot-a-wallet"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_wallet" });
  });

  it("returns 400 invalid_wallet when the wallet is too short", async () => {
    const { supabase } = buildSupabaseMock({});
    mockedSupabase.mockReturnValue(supabase as never);

    const res = await GET(makeRequest("0xabc"));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/peones/balance — wallet normalisation", () => {
  it("normalises an uppercase wallet to lowercase before querying", async () => {
    const { supabase, rpc, from } = buildSupabaseMock({
      rpcResult: {
        data: [{ balance: 7, daily_earned_capped: 5, daily_cap: 10 }],
        error: null,
      },
      maybeSingleResult: {
        data: { last_event_at: "2026-06-07T10:00:00Z" },
        error: null,
      },
    });
    mockedSupabase.mockReturnValue(supabase as never);

    const res = await GET(makeRequest(VALID_WALLET_UPPER));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { wallet: string };
    expect(json.wallet).toBe(VALID_WALLET);

    // rpc + from were both called with lowercase wallet
    expect(rpc).toHaveBeenCalledWith(
      "peones_balance_with_caps",
      expect.objectContaining({ p_wallet: VALID_WALLET }),
    );
    expect(from).toHaveBeenCalledWith("peones_balances");
  });

  it("normalises a mixed-case wallet identically", async () => {
    const { supabase } = buildSupabaseMock({
      rpcResult: { data: [{ balance: 0, daily_earned_capped: 0, daily_cap: 10 }], error: null },
    });
    mockedSupabase.mockReturnValue(supabase as never);

    const res = await GET(makeRequest(VALID_WALLET_MIXED));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { wallet: string };
    expect(json.wallet).toBe(VALID_WALLET);
  });
});

describe("GET /api/peones/balance — success path", () => {
  it("returns the canonical shape from rpc + view", async () => {
    const { supabase } = buildSupabaseMock({
      rpcResult: {
        data: [{ balance: 12, daily_earned_capped: 8, daily_cap: 10 }],
        error: null,
      },
      maybeSingleResult: {
        data: { last_event_at: "2026-06-07T10:00:00Z" },
        error: null,
      },
    });
    mockedSupabase.mockReturnValue(supabase as never);

    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      wallet: VALID_WALLET,
      balance: 12,
      dailyEarnedCapped: 8,
      dailyCap: 10,
      lastEventAt: "2026-06-07T10:00:00Z",
    });
  });

  it("falls back to dailyCap=PEONES_DAILY_CAP + balance=0 when rpc returns no rows", async () => {
    const { supabase } = buildSupabaseMock({
      rpcResult: { data: [], error: null },
      maybeSingleResult: { data: null, error: null },
    });
    mockedSupabase.mockReturnValue(supabase as never);

    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      wallet: VALID_WALLET,
      balance: 0,
      dailyEarnedCapped: 0,
      dailyCap: PEONES_DAILY_CAP,
      lastEventAt: null,
    });
  });

  it("returns lastEventAt=null when the view has no row for the wallet", async () => {
    const { supabase } = buildSupabaseMock({
      rpcResult: {
        data: [{ balance: 3, daily_earned_capped: 3, daily_cap: 10 }],
        error: null,
      },
      maybeSingleResult: { data: null, error: null },
    });
    mockedSupabase.mockReturnValue(supabase as never);

    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { lastEventAt: string | null };
    expect(json.lastEventAt).toBeNull();
  });
});

describe("GET /api/peones/balance — error paths", () => {
  it("returns 429 rate_limited when the identifier really is over its budget", async () => {
    mockedRate.mockResolvedValueOnce({
      allowed: false,
      outcome: "limited",
      resetAt: null,
    });
    const { supabase } = buildSupabaseMock({});
    mockedSupabase.mockReturnValue(supabase as never);

    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited" });
  });

  // D0.1 — the whole point of the hotfix. Before this, an Upstash fault
  // reached the handler as a thrown error and came out as 429, so the panel
  // reported user throttling during a backend outage.
  it("takes its own bucket and a fail-open policy (Upstash fault ≠ 429)", async () => {
    const { supabase } = buildSupabaseMock({});
    mockedSupabase.mockReturnValue(supabase as never);

    await GET(makeRequest(VALID_WALLET));

    expect(mockedRate).toHaveBeenCalledWith({
      identifier: "127.0.0.1",
      route: "peones-balance",
      policy: "fail-open",
    });
  });

  it("still serves the balance when the limiter fails open on a backend fault", async () => {
    mockedRate.mockResolvedValueOnce({
      allowed: true,
      outcome: "redis_error",
      resetAt: null,
    });
    const { supabase } = buildSupabaseMock({
      rpcResult: {
        data: [
          { balance: 7, daily_earned_capped: 0, daily_cap: PEONES_DAILY_CAP },
        ],
        error: null,
      },
    });
    mockedSupabase.mockReturnValue(supabase as never);

    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toBe(200);
    expect((await res.json()).balance).toBe(7);
  });

  it("returns 429 rate_limited when enforceOrigin throws", async () => {
    mockedOrigin.mockImplementationOnce(() => {
      throw new Error("Forbidden origin");
    });
    const { supabase } = buildSupabaseMock({});
    mockedSupabase.mockReturnValue(supabase as never);

    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toBe(429);
  });

  it("returns 500 ledger_unavailable when the Supabase client is missing", async () => {
    mockedSupabase.mockReturnValue(null);

    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "ledger_unavailable" });
  });

  it("returns 500 ledger_unavailable when rpc errors (e.g. function missing pre-migration)", async () => {
    const { supabase } = buildSupabaseMock({
      rpcResult: {
        data: null,
        error: { code: "42883", message: "function peones_balance_with_caps does not exist" },
      },
    });
    mockedSupabase.mockReturnValue(supabase as never);

    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "ledger_unavailable" });
  });
});

describe("GET /api/peones/balance — read-only contract", () => {
  it("never invokes insert/update/delete on the Supabase client", async () => {
    const { supabase } = buildSupabaseMock({
      rpcResult: {
        data: [{ balance: 5, daily_earned_capped: 0, daily_cap: 10 }],
        error: null,
      },
    });
    mockedSupabase.mockReturnValue(supabase as never);

    await GET(makeRequest(VALID_WALLET));

    expect(supabase._writeProbes.insert).not.toHaveBeenCalled();
    expect(supabase._writeProbes.update).not.toHaveBeenCalled();
    expect(supabase._writeProbes.delete).not.toHaveBeenCalled();
  });

  it("only touches the read surfaces (rpc + peones_balances view)", async () => {
    const { supabase, rpc, from } = buildSupabaseMock({
      rpcResult: {
        data: [{ balance: 5, daily_earned_capped: 0, daily_cap: 10 }],
        error: null,
      },
    });
    mockedSupabase.mockReturnValue(supabase as never);

    await GET(makeRequest(VALID_WALLET));

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      "peones_balance_with_caps",
      expect.any(Object),
    );
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("peones_balances");
  });
});

describe("GET /api/peones/balance — welcome pack seed (Sprint 4 commit J)", () => {
  beforeEach(() => {
    mockedOrigin.mockReset();
    mockedRate.mockReset();
    mockedSupabase.mockReset();
    mockedWelcomePack.mockReset();
    mockedOrigin.mockImplementation(() => {});
    mockedRate.mockResolvedValue(ALLOWED);
    mockedWelcomePack.mockResolvedValue(false);
  });

  it("calls ensurePeonesWelcomePack with the normalized wallet before reading balance", async () => {
    mockedWelcomePack.mockResolvedValueOnce(true);
    const { supabase } = buildSupabaseMock({
      rpcResult: {
        data: [{ balance: 1, daily_earned_capped: 0, daily_cap: 10 }],
        error: null,
      },
    });
    mockedSupabase.mockReturnValue(supabase as never);
    const res = await GET(makeRequest(VALID_WALLET_UPPER));
    expect(res.status).toBe(200);
    expect(mockedWelcomePack).toHaveBeenCalledTimes(1);
    expect(mockedWelcomePack).toHaveBeenCalledWith(supabase, VALID_WALLET);
  });

  it("fresh wallet → response carries balance:1 reflecting the seed", async () => {
    mockedWelcomePack.mockResolvedValueOnce(true);
    const { supabase } = buildSupabaseMock({
      rpcResult: {
        data: [{ balance: 1, daily_earned_capped: 0, daily_cap: 10 }],
        error: null,
      },
    });
    mockedSupabase.mockReturnValue(supabase as never);
    const res = await GET(makeRequest(VALID_WALLET));
    const body = await res.json();
    expect(body.balance).toBe(1);
  });

  it("returning wallet (already seeded) → ensure called but no fresh insert observed", async () => {
    mockedWelcomePack.mockResolvedValueOnce(false);
    const { supabase } = buildSupabaseMock({
      rpcResult: {
        data: [{ balance: 12, daily_earned_capped: 3, daily_cap: 10 }],
        error: null,
      },
    });
    mockedSupabase.mockReturnValue(supabase as never);
    const res = await GET(makeRequest(VALID_WALLET));
    const body = await res.json();
    expect(body.balance).toBe(12);
    expect(mockedWelcomePack).toHaveBeenCalledTimes(1);
  });

  it("helper rejection does NOT block balance read (fail-soft defense-in-depth)", async () => {
    mockedWelcomePack.mockRejectedValueOnce(new Error("transient"));
    const { supabase } = buildSupabaseMock({
      rpcResult: {
        data: [{ balance: 0, daily_earned_capped: 0, daily_cap: 10 }],
        error: null,
      },
    });
    mockedSupabase.mockReturnValue(supabase as never);
    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.balance).toBe(0);
  });
});
