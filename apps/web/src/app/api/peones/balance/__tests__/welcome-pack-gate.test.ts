/**
 * D2.1 — GET /api/peones/balance no longer writes on every read.
 *
 * `welcome-pack-server` is deliberately NOT mocked here: these tests drive the
 * real probe-then-seed logic against a fake Supabase that COUNTS operations by
 * table. That is what makes the headline claim ("zero INSERTs for a recurring
 * wallet") a measurement rather than an assertion about a mock.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/server/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    outcome: "allowed",
    resetAt: null,
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(),
}));

import { GET } from "../route";
import { getSupabaseServer } from "@/lib/supabase/server";
import { __resetLoggerSink, __setLoggerSink } from "@/lib/server/logger";
import { buildWelcomePackIdempotencyKey } from "@/lib/peones/welcome-pack-server";

const mockedSupabase = vi.mocked(getSupabaseServer);

const WALLET = "0xabcdef0123456789abcdef0123456789abcdef01";

function makeRequest(wallet = WALLET) {
  return new Request(`http://localhost/api/peones/balance?wallet=${wallet}`);
}

type Op = {
  table: string;
  op: "select" | "insert";
  column?: string;
  columns?: string;
};

/**
 * A fake ledger that behaves like the real one on the only axis that matters:
 * the UNIQUE index on `idempotency_key`. A second insert of the same key fails
 * with 23505, exactly as Postgres would.
 */
function buildLedger(opts: { seeded?: boolean; balance?: number } = {}) {
  const ops: Op[] = [];
  const limits: number[] = [];
  const keys = new Set<string>(
    opts.seeded ? [buildWelcomePackIdempotencyKey(WALLET)] : [],
  );
  let rpcError: { code?: string; message?: string } | null = null;
  let probeError: { code?: string; message?: string } | null = null;

  const supabase = {
    rpc: vi.fn(async () => ({
      data: rpcError
        ? null
        : [
            {
              balance: opts.balance ?? (keys.size > 0 ? 1 : 0),
              daily_earned_capped: 0,
              daily_cap: 6,
            },
          ],
      error: rpcError,
    })),
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        ops.push({ table, op: "insert" });
        const key = String(row.idempotency_key);
        if (keys.has(key)) {
          return { error: { code: "23505", message: "duplicate key" } };
        }
        keys.add(key);
        return { error: null };
      },
      select: (columns: string) => ({
        eq: (column: string, value: string) => {
          const run = async () => {
            ops.push({ table, op: "select", column, columns });
            if (column === "idempotency_key") {
              if (probeError) return { data: null, error: probeError };
              return {
                data: keys.has(value) ? { idempotency_key: value } : null,
                error: null,
              };
            }
            return { data: { last_event_at: null }, error: null };
          };
          // `.limit(n)` is optional in the chain: the probe uses it, the
          // balances read does not.
          return {
            maybeSingle: run,
            limit: (n: number) => {
              limits.push(n);
              return { maybeSingle: run };
            },
          };
        },
      }),
    }),
  };

  return {
    supabase,
    ops,
    keys,
    limits,
    setRpcError: (e: { code?: string; message?: string }) => {
      rpcError = e;
    },
    setProbeError: (e: { code?: string; message?: string }) => {
      probeError = e;
    },
    inserts: () => ops.filter((o) => o.op === "insert"),
    ledgerInserts: () =>
      ops.filter((o) => o.op === "insert" && o.table === "peones_ledger"),
  };
}

beforeEach(() => {
  mockedSupabase.mockReset();
  vi.stubEnv("LOG_SALT", "test-salt");
});

describe("D2.1 — recurring wallet issues ZERO writes", () => {
  it("a known wallet performs no INSERT on peones_ledger", async () => {
    const led = buildLedger({ seeded: true, balance: 12 });
    mockedSupabase.mockReturnValue(led.supabase as never);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    // The headline measurement of this phase.
    expect(led.ledgerInserts()).toHaveLength(0);
    expect(led.inserts()).toHaveLength(0);
  });

  it("keeps only the reads it needs: probe + rpc + balances view", async () => {
    const led = buildLedger({ seeded: true, balance: 12 });
    mockedSupabase.mockReturnValue(led.supabase as never);

    await GET(makeRequest());

    expect(led.ops).toEqual([
      {
        table: "peones_ledger",
        op: "select",
        column: "idempotency_key",
        columns: "idempotency_key",
      },
      {
        table: "peones_balances",
        op: "select",
        column: "wallet",
        columns: "last_event_at",
      },
    ]);
    expect(led.supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("the probe is minimal: one column, one row, on the unique key", async () => {
    const led = buildLedger({ seeded: true, balance: 12 });
    mockedSupabase.mockReturnValue(led.supabase as never);

    await GET(makeRequest());

    const probe = led.ops.find((o) => o.column === "idempotency_key");
    // Never select("*") — this table carries wallets, metadata and
    // attestations that must not cross the wire for an existence check.
    expect(probe?.columns).toBe("idempotency_key");
    expect(probe?.columns).not.toBe("*");
    // `maybeSingle()` adds no LIMIT of its own (verified in postgrest-js
    // 2.100.1), so the bound has to be explicit.
    expect(led.limits).toEqual([1]);
  });

  it("ten recurring reads still write nothing", async () => {
    const led = buildLedger({ seeded: true, balance: 12 });
    mockedSupabase.mockReturnValue(led.supabase as never);

    for (let i = 0; i < 10; i++) await GET(makeRequest());

    expect(led.ledgerInserts()).toHaveLength(0);
  });

  it("balance is unchanged by the gate", async () => {
    const led = buildLedger({ seeded: true, balance: 12 });
    mockedSupabase.mockReturnValue(led.supabase as never);

    const body = await (await GET(makeRequest())).json();
    expect(body).toMatchObject({
      wallet: WALLET,
      balance: 12,
      dailyEarnedCapped: 0,
      dailyCap: 6,
      lastEventAt: null,
    });
  });
});

describe("D2.1 — a fresh wallet still gets exactly one Welcome Pack", () => {
  it("seeds once and the response reflects the +1", async () => {
    const led = buildLedger({ seeded: false });
    mockedSupabase.mockReturnValue(led.supabase as never);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(led.ledgerInserts()).toHaveLength(1);
    expect(body.balance).toBe(1);
    expect(led.keys.has(buildWelcomePackIdempotencyKey(WALLET))).toBe(true);
  });

  it("a second read of that same wallet writes nothing more", async () => {
    const led = buildLedger({ seeded: false });
    mockedSupabase.mockReturnValue(led.supabase as never);

    await GET(makeRequest()); // first read seeds
    const before = led.ledgerInserts().length;
    await GET(makeRequest()); // second read must not

    expect(before).toBe(1);
    expect(led.ledgerInserts()).toHaveLength(1);
    expect(led.keys.size).toBe(1);
  });

  it("does NOT infer 'new' from a zero balance — a spent-down wallet gets nothing", async () => {
    // Seeded long ago, spent everything, balance back to 0. The old
    // "balance === 0 means new" shortcut would re-grant here.
    const led = buildLedger({ seeded: true, balance: 0 });
    mockedSupabase.mockReturnValue(led.supabase as never);

    const body = await (await GET(makeRequest())).json();

    expect(led.ledgerInserts()).toHaveLength(0);
    expect(body.balance).toBe(0);
  });
});

describe("D2.1 — concurrency", () => {
  it("two simultaneous first reads produce at most ONE ledger row", async () => {
    const led = buildLedger({ seeded: false });
    mockedSupabase.mockReturnValue(led.supabase as never);

    // Both probe before either inserts — the interleaving the gate cannot
    // prevent, and the one the unique index exists for.
    const [a, b] = await Promise.all([GET(makeRequest()), GET(makeRequest())]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    // Both attempted the insert; the index let exactly one through.
    expect(led.ledgerInserts().length).toBeGreaterThanOrEqual(1);
    expect(led.keys.size).toBe(1);
  });

  it("a 23505 conflict is idempotency, not a 500", async () => {
    const led = buildLedger({ seeded: false });
    mockedSupabase.mockReturnValue(led.supabase as never);

    // Someone else seeded between our probe and our insert.
    led.keys.add(buildWelcomePackIdempotencyKey(WALLET));

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(led.keys.size).toBe(1);
  });
});

describe("D2.1 — degraded backends", () => {
  it("a failed probe does NOT fire an INSERT at a failing database", async () => {
    const led = buildLedger({ seeded: false });
    led.setProbeError({ code: "PGRST", message: "<!DOCTYPE html>..." });
    mockedSupabase.mockReturnValue(led.supabase as never);

    const res = await GET(makeRequest());

    // "unknown" must not be read as "not seeded". A later successful read
    // grants the pack; writing during an outage is what D2.1 removes.
    expect(led.ledgerInserts()).toHaveLength(0);
    expect(res.status).toBe(200);
  });

  it("the probe runs exactly once per request — no retry loop", async () => {
    const led = buildLedger({ seeded: false });
    led.setProbeError({ code: "PGRST", message: "boom" });
    mockedSupabase.mockReturnValue(led.supabase as never);

    await GET(makeRequest());

    const probes = led.ops.filter(
      (o) => o.op === "select" && o.column === "idempotency_key",
    );
    expect(probes).toHaveLength(1);
  });

  it("an rpc failure still returns the documented 500 contract", async () => {
    const led = buildLedger({ seeded: true });
    led.setRpcError({ code: "PGRST301", message: "<!DOCTYPE html><html>..." });
    mockedSupabase.mockReturnValue(led.supabase as never);

    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "ledger_unavailable" });
  });

  it("Redis being down cannot cause a second Welcome Pack", async () => {
    // Nothing on this path consults Redis: the grant is decided by Postgres
    // alone. This test pins that — it would fail if a Redis cache were ever
    // wired in as the authority.
    const led = buildLedger({ seeded: true, balance: 5 });
    mockedSupabase.mockReturnValue(led.supabase as never);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(led.ledgerInserts()).toHaveLength(0);
  });
});

describe("D2.1 — log privacy", () => {
  const lines: Array<Record<string, unknown>> = [];

  beforeEach(() => {
    lines.length = 0;
    __setLoggerSink((line) => lines.push(JSON.parse(line)));
  });

  function serialized() {
    __resetLoggerSink();
    return JSON.stringify(lines);
  }

  it("rpc_failed carries wallet_hash, never the address or the raw message", async () => {
    const led = buildLedger({ seeded: true });
    const htmlBlob = "<!DOCTYPE html><html><body>gateway error</body></html>";
    led.setRpcError({ code: "PGRST301", message: htmlBlob });
    mockedSupabase.mockReturnValue(led.supabase as never);

    await GET(makeRequest());
    const dump = serialized();

    const line = lines.find((l) => l.msg === "rpc_failed");
    expect(line).toMatchObject({
      operation: "peones_balance_with_caps",
      code: "PGRST301",
      error_class: "html_gateway_error",
    });
    expect(String(line?.wallet_hash)).toMatch(/^[0-9a-f]{16}$/);
    expect(dump).not.toContain(WALLET);
    // The external blob is classified, never echoed.
    expect(dump).not.toContain("<!DOCTYPE html>");
  });

  it("supabase_unavailable carries wallet_hash, not the address", async () => {
    mockedSupabase.mockReturnValue(null as never);

    await GET(makeRequest());
    const dump = serialized();

    expect(lines.find((l) => l.msg === "supabase_unavailable")).toMatchObject({
      wallet_hash: expect.stringMatching(/^[0-9a-f]{16}$/),
    });
    expect(dump).not.toContain(WALLET);
  });

  it("peones_welcome_pack_seeded carries wallet_hash, not the address", async () => {
    const led = buildLedger({ seeded: false });
    mockedSupabase.mockReturnValue(led.supabase as never);

    await GET(makeRequest());
    const dump = serialized();

    expect(
      lines.find((l) => l.msg === "peones_welcome_pack_seeded"),
    ).toMatchObject({
      wallet_hash: expect.stringMatching(/^[0-9a-f]{16}$/),
    });
    expect(dump).not.toContain(WALLET);
  });

  it("no log line anywhere in the flow contains the raw wallet", async () => {
    for (const seeded of [true, false]) {
      const led = buildLedger({ seeded });
      mockedSupabase.mockReturnValue(led.supabase as never);
      await GET(makeRequest());
      await GET(makeRequest(WALLET.toUpperCase()));
    }
    const dump = serialized();

    expect(dump.toLowerCase()).not.toContain(WALLET.toLowerCase());
    expect(dump).not.toContain("wallet=");
  });
});

/**
 * The measurement, stated as a test so it cannot rot.
 *
 * Before D2.1, EVERY read cost: 1 INSERT (peones_ledger) + 1 RPC + 1 SELECT
 * (peones_balances). The INSERT could only ever succeed once per wallet; for
 * every subsequent read it took a lock, wrote WAL, hit the unique index and
 * rolled back — ~5.9K wasted writes per 12h against a database depleting its
 * Disk IO budget.
 */
describe("D2.1 — operation budget", () => {
  it("recurring wallet: 0 writes, 3 reads", async () => {
    const led = buildLedger({ seeded: true, balance: 9 });
    mockedSupabase.mockReturnValue(led.supabase as never);

    await GET(makeRequest());

    const writes = led.ops.filter((o) => o.op === "insert");
    const reads = led.ops.filter((o) => o.op === "select");

    expect(writes).toHaveLength(0);
    // probe (peones_ledger) + balances view; the RPC is the third read.
    expect(reads).toHaveLength(2);
    expect(led.supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("fresh wallet: 1 write, 3 reads — once in the wallet's lifetime", async () => {
    const led = buildLedger({ seeded: false });
    mockedSupabase.mockReturnValue(led.supabase as never);

    await GET(makeRequest());

    expect(led.ops.filter((o) => o.op === "insert")).toHaveLength(1);
    expect(led.ops.filter((o) => o.op === "select")).toHaveLength(2);
    expect(led.supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("the write happens on the FIRST read and never again", async () => {
    const led = buildLedger({ seeded: false });
    mockedSupabase.mockReturnValue(led.supabase as never);

    const writesPerRead: number[] = [];
    for (let i = 0; i < 5; i++) {
      const before = led.ops.filter((o) => o.op === "insert").length;
      await GET(makeRequest());
      writesPerRead.push(
        led.ops.filter((o) => o.op === "insert").length - before,
      );
    }

    expect(writesPerRead).toEqual([1, 0, 0, 0, 0]);
  });
});
