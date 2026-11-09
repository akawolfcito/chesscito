/**
 * Tests for POST /api/peones/earn — Sprint 3 commit D of Training
 * Economy Alpha (2026-06-07). First REAL write to the Peones ledger.
 * Pure server-side; no UI, no localStorage, no telemetry. The
 * idempotency contract + cap truncation are the two contracts these
 * tests pin.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));

// FAIL-CLOSED route (it writes the ledger), so it keeps the throwing guard.
vi.mock("@/lib/server/rate-limit", () => ({
  enforceReadRateLimit: vi.fn(),
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

import { POST } from "../route";
import { enforceOrigin } from "@/lib/server/demo-signing";
import { enforceReadRateLimit } from "@/lib/server/rate-limit";
import { getSupabaseServer } from "@/lib/supabase/server";

const mockedOrigin = vi.mocked(enforceOrigin);
const mockedRate = vi.mocked(enforceReadRateLimit);
const mockedSupabase = vi.mocked(getSupabaseServer);

const W = "0xabcdef0123456789abcdef0123456789abcdef01";
const W_UPPER = "0xABCDEF0123456789ABCDEF0123456789ABCDEF01";

type Body = Record<string, unknown>;

function makeRequest(body: Body | string): Request {
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
  return new Request("http://localhost/api/peones/earn", init);
}

function baseBody(over: Partial<Body> = {}): Body {
  return {
    wallet: W,
    amount: 3,
    source: "daily_tactic",
    sourceId: "dt-queen-2",
    idempotencyKey: `daily_tactic:${W}:2026-06-07:dt-queen-2`,
    ...over,
  };
}

/**
 * Supabase mock that simulates the four code paths the handler
 * uses:
 *  - from('peones_ledger').select(...).eq(...).maybeSingle() —
 *    idempotency pre-check + post-insert race lookup.
 *  - rpc('peones_balance_with_caps', {...}).
 *  - from('peones_ledger').insert(...).select('id').maybeSingle() —
 *    write path. Tracks insert count for the read-only proofs.
 */
function buildSupabaseMock(opts: {
  /** Pre-check lookup. Default: no existing row. */
  existingRow?: { id: number; amount: number; attestation_hash: string; day_utc?: string } | null;
  existingRowError?: { code?: string; message?: string };
  /** rpc result for peones_balance_with_caps. */
  capRow?: { balance: number; daily_earned_capped: number; daily_cap: number } | null;
  capError?: { code?: string; message?: string };
  /** Insert result. Returns the inserted row id, or an error. */
  insertResult?: { data: { id: number } | null; error: { code?: string; message?: string } | null };
  /** Post-race lookup after a 23505 unique violation. */
  raceRow?: { id: number; amount: number; attestation_hash: string } | null;
}) {
  const rpc = vi.fn().mockResolvedValue({
    data: opts.capRow !== undefined ? [opts.capRow] : [{ balance: 0, daily_earned_capped: 0, daily_cap: 10 }],
    error: opts.capError ?? null,
  });

  // Shared counter — each from('peones_ledger').select(...) chain
  // increments. First select chain serves the idempotency pre-check
  // (existingRow); second serves the post-23505 race re-resolve
  // (raceRow). Lives outside the from() factory so successive from()
  // calls share the queue.
  let selectCallIndex = 0;
  const insertSpy = vi.fn();
  const fromSpy = vi.fn();

  fromSpy.mockImplementation((tableName: string) => {
    if (tableName !== "peones_ledger" && tableName !== "peones_balances") {
      throw new Error(`unexpected from(${tableName})`);
    }
    return {
      // Used by both the idempotency pre-check and the race-window re-resolve.
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockImplementation(() => {
            const idx = selectCallIndex++;
            if (idx === 0) {
              return Promise.resolve({
                data: opts.existingRow ?? null,
                error: opts.existingRowError ?? null,
              });
            }
            // Subsequent select chains: post-race re-resolve.
            return Promise.resolve({
              data: opts.raceRow ?? null,
              error: null,
            });
          }),
        })),
      })),
      // Used by the write path.
      insert: insertSpy.mockReturnValue({
        select: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue(
            opts.insertResult ?? { data: { id: 1 }, error: null },
          ),
        })),
      }),
      // Write-probe surfaces — verified NEVER called by the read-only
      // contract tests in the GET endpoint; here they exist so an
      // accidental update/delete from a future refactor explodes.
      update: vi.fn(() => {
        throw new Error("update called on /api/peones/earn — must be append-only");
      }),
      delete: vi.fn(() => {
        throw new Error("delete called on /api/peones/earn — must be append-only");
      }),
    };
  });

  return {
    supabase: { rpc, from: fromSpy } as never,
    rpc,
    from: fromSpy,
    insertSpy,
  };
}

beforeEach(() => {
  mockedOrigin.mockReset();
  mockedRate.mockReset();
  mockedSupabase.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ──────────────────────────────────────────────────────────────────
// Input validation
// ──────────────────────────────────────────────────────────────────

describe("POST /api/peones/earn — input validation", () => {
  it("returns 400 invalid_input when the body is not JSON", async () => {
    mockedSupabase.mockReturnValue(buildSupabaseMock({}).supabase);
    const res = await POST(makeRequest("{not-json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
  });

  it("returns 400 invalid_input when body is not an object", async () => {
    mockedSupabase.mockReturnValue(buildSupabaseMock({}).supabase);
    const res = await POST(makeRequest("[]"));
    expect(res.status).toBe(400);
  });

  it("returns 400 invalid_wallet on missing wallet", async () => {
    mockedSupabase.mockReturnValue(buildSupabaseMock({}).supabase);
    const res = await POST(makeRequest(baseBody({ wallet: undefined })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_wallet" });
  });

  it("returns 400 invalid_wallet on malformed wallet", async () => {
    mockedSupabase.mockReturnValue(buildSupabaseMock({}).supabase);
    const res = await POST(makeRequest(baseBody({ wallet: "0xbad" })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_wallet" });
  });

  it.each([0, -1, 1.5, Number.NaN, 51, 9999])(
    "returns 400 invalid_input on amount=%s",
    async (amount) => {
      mockedSupabase.mockReturnValue(buildSupabaseMock({}).supabase);
      const res = await POST(makeRequest(baseBody({ amount })));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_input" });
    },
  );

  it("returns 400 invalid_source on unknown source", async () => {
    mockedSupabase.mockReturnValue(buildSupabaseMock({}).supabase);
    const res = await POST(makeRequest(baseBody({ source: "coach" })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_source" });
  });

  it("returns 400 invalid_source on parked source (senda_milestone)", async () => {
    mockedSupabase.mockReturnValue(buildSupabaseMock({}).supabase);
    const res = await POST(
      makeRequest(
        baseBody({
          source: "senda_milestone",
          idempotencyKey: `senda_milestone:${W}:king`,
        }),
      ),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 invalid_idempotency_key when missing", async () => {
    mockedSupabase.mockReturnValue(buildSupabaseMock({}).supabase);
    const res = await POST(makeRequest(baseBody({ idempotencyKey: "" })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_idempotency_key" });
  });

  it("returns 400 invalid_idempotency_key when prefix mismatches source", async () => {
    mockedSupabase.mockReturnValue(buildSupabaseMock({}).supabase);
    const res = await POST(
      makeRequest(
        baseBody({
          source: "daily_tactic",
          idempotencyKey: `training:${W}:rook:rook-4:1->3`,
        }),
      ),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_idempotency_key" });
  });

  it("accepts exercise_completion with the milestone key prefix", async () => {
    const { supabase, insertSpy } = buildSupabaseMock({
      insertResult: { data: { id: 77 }, error: null },
    });
    mockedSupabase.mockReturnValue(supabase);
    const res = await POST(
      makeRequest(
        baseBody({
          source: "exercise_completion",
          idempotencyKey: `exercise_milestone:${W}:3`,
          sourceId: "milestone:3",
          amount: 1,
        }),
      ),
    );
    expect(res.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ source: "exercise_completion", amount: 1 }),
    );
  });

  it("rejects exercise_completion carrying the retired per-exercise key", async () => {
    // The `training:{wallet}:{piece}:{id}:{a}->{b}` format WAS the
    // exercise_completion key until Economy V1. Historical rows keep
    // it; new writes must not, or a client could mint one Peón per
    // exercise again just by keeping the old key shape.
    mockedSupabase.mockReturnValue(buildSupabaseMock({}).supabase);
    const res = await POST(
      makeRequest(
        baseBody({
          source: "exercise_completion",
          idempotencyKey: `training:${W}:rook:rook-4:0->3`,
          sourceId: "rook:rook-4",
          amount: 1,
        }),
      ),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_idempotency_key" });
  });

  // ── Retired earn sources ───────────────────────────────────────
  //
  // Each of these was reachable from this public, unauthenticated
  // endpoint. `admin_grant` was the worst of them: it skipped the
  // prefix check entirely and accepted up to 50 Peones per call, so
  // anyone who could POST could mint. The rest simply had no live
  // caller, which is the same hole with a smaller hat.
  //
  // The requests below are otherwise VALID — right shape, right key
  // prefix, sane amount. The rejection has to come from the source
  // allow-list itself.
  it.each([
    {
      source: "admin_grant",
      idempotencyKey: "grant-2026-q3-batch-1",
      sourceId: "ops-ticket-123",
      amount: 5,
      why: "ops-only mint reachable from the public route",
    },
    {
      source: "labyrinth_completion",
      idempotencyKey: `labyrinth_completion:${W}:knight:knight-lab-3`,
      sourceId: "knight:knight-lab-3",
      amount: 1,
      why: "labyrinths no longer pay Peones",
    },
    {
      source: "daily_lab",
      idempotencyKey: `daily_lab:${W}:2026-07-21`,
      sourceId: "lab-1",
      amount: 1,
      why: "dormant, never had a caller",
    },
    {
      source: "daily_streak_bonus",
      idempotencyKey: `daily_streak_bonus:${W}:2026-07-21:7`,
      sourceId: "streak-7",
      amount: 1,
      why: "dormant, never had a caller",
    },
  ])("returns 400 invalid_source for $source ($why)", async (over) => {
    const { supabase, insertSpy } = buildSupabaseMock({
      insertResult: { data: { id: 42 }, error: null },
    });
    mockedSupabase.mockReturnValue(supabase);

    const { why: _why, ...body } = over;
    const res = await POST(makeRequest(baseBody(body)));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_source" });
    // Nothing was written — the rejection happens before the ledger.
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("returns 400 invalid_input on non-serialisable metadata (BigInt)", async () => {
    mockedSupabase.mockReturnValue(buildSupabaseMock({}).supabase);
    // Build the request body manually because JSON.stringify of a
    // BigInt throws before our handler sees the body.
    const req = new Request("http://localhost/api/peones/earn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Smuggle a metadata field with a non-serialisable-once-parsed
      // value would require server-side payload. Easier: send the
      // body with a function-like structure pre-parsed inside an
      // override. We instead exercise the metadata=array branch
      // (also rejected).
      body: JSON.stringify({ ...baseBody(), metadata: ["not", "an", "object"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ──────────────────────────────────────────────────────────────────
// Daily cap behaviour
// ──────────────────────────────────────────────────────────────────

describe("POST /api/peones/earn — daily cap", () => {
  it("credits the full amount when cap headroom is available", async () => {
    const mock = buildSupabaseMock({
      capRow: { balance: 4, daily_earned_capped: 3, daily_cap: 10 },
      insertResult: { data: { id: 11 }, error: null },
    });
    mockedSupabase.mockReturnValue(mock.supabase);

    const res = await POST(makeRequest(baseBody({ amount: 3 })));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      requested: 3,
      credited: 3,
      capReached: false,
      newBalance: 7, // 4 + 3
      dailyEarnedCapped: 6, // 3 + 3
      dailyCap: 10,
      ledgerId: 11,
    });
    expect(json.attestationHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(mock.insertSpy).toHaveBeenCalledTimes(1);
  });

  it("truncates the credited amount when the request would breach the cap (partial)", async () => {
    const mock = buildSupabaseMock({
      capRow: { balance: 8, daily_earned_capped: 8, daily_cap: 10 },
      insertResult: { data: { id: 22 }, error: null },
    });
    mockedSupabase.mockReturnValue(mock.supabase);

    const res = await POST(makeRequest(baseBody({ amount: 3 })));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      requested: 3,
      credited: 2, // 10 - 8 headroom
      capReached: true,
      newBalance: 10, // 8 + 2
      dailyEarnedCapped: 10,
      ledgerId: 22,
    });
    expect(mock.insertSpy).toHaveBeenCalledTimes(1);
  });

  it("does NOT insert when the cap is already exhausted (credited=0)", async () => {
    const mock = buildSupabaseMock({
      capRow: { balance: 10, daily_earned_capped: 10, daily_cap: 10 },
    });
    mockedSupabase.mockReturnValue(mock.supabase);

    const res = await POST(makeRequest(baseBody({ amount: 3 })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      wallet: W,
      requested: 3,
      credited: 0,
      capReached: true,
      newBalance: 10,
      dailyEarnedCapped: 10,
      dailyCap: 10,
      attestationHash: null,
      ledgerId: null,
    });
    expect(mock.insertSpy).not.toHaveBeenCalled();
  });

  // Economy recalibration 2026-06-10: every accepted earn source is now
  // capped (the daily-family + exercise_completion), so the endpoint no
  // longer has an accepted non-capped source to exercise the passthrough
  // branch — the former "ignores the cap for exercise_completion" test was
  // removed. exercise_completion respects the cap (truncates).
  it("truncates an exercise milestone to the daily cap", async () => {
    const mock = buildSupabaseMock({
      capRow: { balance: 5, daily_earned_capped: 2, daily_cap: 3 },
      insertResult: { data: { id: 34 }, error: null },
    });
    mockedSupabase.mockReturnValue(mock.supabase);

    const res = await POST(
      makeRequest(
        baseBody({
          source: "exercise_completion",
          idempotencyKey: `exercise_milestone:${W}:2`,
          sourceId: "milestone:2",
          amount: 2,
        }),
      ),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      credited: 1, // 3 cap - 2 already earned = 1 headroom
      capReached: true,
    });
    expect(mock.insertSpy).toHaveBeenCalledTimes(1);
  });

  it("credits the Daily Tactic's +1 and shares the cap with milestones", async () => {
    // Economy V1: the Daily pays 1, and the free ceiling is 3 for the
    // whole day across every capped source. A wallet that already
    // earned 3 today gets nothing more, whatever it solves.
    const mock = buildSupabaseMock({
      capRow: { balance: 12, daily_earned_capped: 3, daily_cap: 3 },
    });
    mockedSupabase.mockReturnValue(mock.supabase);

    const res = await POST(makeRequest(baseBody({ amount: 1 })));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      credited: 0,
      capReached: true,
      newBalance: 12,
    });
    // A zero credit never writes a row.
    expect(mock.insertSpy).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────
// Idempotency
// ──────────────────────────────────────────────────────────────────

describe("POST /api/peones/earn — idempotency", () => {
  it("returns duplicate:true without inserting when the idempotency_key already exists", async () => {
    const mock = buildSupabaseMock({
      existingRow: {
        id: 77,
        amount: 3,
        attestation_hash: "sha256:deadbeef",
        day_utc: "2026-06-07",
      },
      capRow: { balance: 7, daily_earned_capped: 3, daily_cap: 10 },
    });
    mockedSupabase.mockReturnValue(mock.supabase);

    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      requested: 3,
      credited: 3,
      duplicate: true,
      attestationHash: "sha256:deadbeef",
      ledgerId: 77,
      newBalance: 7,
    });
    expect(mock.insertSpy).not.toHaveBeenCalled();
  });

  it("handles a 23505 race condition by re-resolving and returning duplicate:true", async () => {
    const mock = buildSupabaseMock({
      existingRow: null, // pre-check sees no row
      capRow: { balance: 0, daily_earned_capped: 0, daily_cap: 10 },
      insertResult: {
        data: null,
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      },
      // After the 23505 fires, the handler re-reads the existing row.
      raceRow: { id: 88, amount: 3, attestation_hash: "sha256:cafebabe" },
    });
    mockedSupabase.mockReturnValue(mock.supabase);

    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      requested: 3,
      credited: 3,
      duplicate: true,
      attestationHash: "sha256:cafebabe",
      ledgerId: 88,
    });
  });
});

// ──────────────────────────────────────────────────────────────────
// Wallet normalisation
// ──────────────────────────────────────────────────────────────────

describe("POST /api/peones/earn — wallet normalisation", () => {
  it("lowercases an uppercase wallet before everything downstream", async () => {
    const mock = buildSupabaseMock({
      insertResult: { data: { id: 99 }, error: null },
    });
    mockedSupabase.mockReturnValue(mock.supabase);

    const res = await POST(
      makeRequest({
        wallet: W_UPPER,
        amount: 3,
        source: "daily_tactic",
        sourceId: "dt-queen-2",
        idempotencyKey: `daily_tactic:${W}:2026-06-07:dt-queen-2`, // already lowercase in key
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { wallet: string };
    expect(json.wallet).toBe(W);

    // Insert payload was called with lowercase wallet.
    expect(mock.insertSpy).toHaveBeenCalledTimes(1);
    expect(mock.insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ wallet: W }),
    );
  });
});

// ──────────────────────────────────────────────────────────────────
// Error paths
// ──────────────────────────────────────────────────────────────────

describe("POST /api/peones/earn — error paths", () => {
  it("returns 429 rate_limited when enforceReadRateLimit throws", async () => {
    mockedRate.mockRejectedValueOnce(new Error("Rate limit exceeded"));
    mockedSupabase.mockReturnValue(buildSupabaseMock({}).supabase);

    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited" });
  });

  it("returns 429 rate_limited when enforceOrigin throws", async () => {
    mockedOrigin.mockImplementationOnce(() => {
      throw new Error("Forbidden origin");
    });
    mockedSupabase.mockReturnValue(buildSupabaseMock({}).supabase);

    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(429);
  });

  it("returns 500 ledger_unavailable when the Supabase client is missing", async () => {
    mockedSupabase.mockReturnValue(null);
    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "ledger_unavailable" });
  });

  it("returns 500 ledger_unavailable when the rpc errors", async () => {
    const mock = buildSupabaseMock({
      capError: { code: "42883", message: "function peones_balance_with_caps does not exist" },
    });
    mockedSupabase.mockReturnValue(mock.supabase);

    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "ledger_unavailable" });
  });

  it("returns 500 ledger_unavailable when the idempotency lookup errors", async () => {
    const mock = buildSupabaseMock({
      existingRowError: { code: "42P01", message: 'relation "peones_ledger" does not exist' },
    });
    mockedSupabase.mockReturnValue(mock.supabase);

    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "ledger_unavailable" });
  });

  it("returns 500 ledger_write_failed when insert errors with a non-23505 code", async () => {
    const mock = buildSupabaseMock({
      capRow: { balance: 0, daily_earned_capped: 0, daily_cap: 10 },
      insertResult: {
        data: null,
        error: { code: "23502", message: "null value violates not-null" },
      },
    });
    mockedSupabase.mockReturnValue(mock.supabase);

    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "ledger_write_failed" });
  });
});

// ──────────────────────────────────────────────────────────────────
// Read-only contract surface (defensive)
// ──────────────────────────────────────────────────────────────────

describe("POST /api/peones/earn — append-only contract", () => {
  it("never calls update or delete on peones_ledger", async () => {
    const mock = buildSupabaseMock({
      capRow: { balance: 0, daily_earned_capped: 0, daily_cap: 10 },
      insertResult: { data: { id: 1 }, error: null },
    });
    mockedSupabase.mockReturnValue(mock.supabase);

    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(200);
    // Probes throw if invoked; reaching here proves they didn't.
    expect(mock.from).toHaveBeenCalledWith("peones_ledger");
  });

  it("inserts a row with event_type='earn' and positive amount", async () => {
    const mock = buildSupabaseMock({
      capRow: { balance: 0, daily_earned_capped: 0, daily_cap: 10 },
      insertResult: { data: { id: 1 }, error: null },
    });
    mockedSupabase.mockReturnValue(mock.supabase);

    await POST(makeRequest(baseBody({ amount: 3 })));
    expect(mock.insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "earn",
        amount: 3,
        source: "daily_tactic",
      }),
    );
    const inserted = mock.insertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(Number(inserted.amount)).toBeGreaterThan(0);
  });
});
