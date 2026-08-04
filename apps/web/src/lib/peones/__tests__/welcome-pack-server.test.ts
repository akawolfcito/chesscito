/**
 * Sprint 4 commit J — Peones welcome pack helper tests.
 *
 * Pure helper: Supabase is injected, no env required. Contracts:
 *   - happy first-seed: inserts row with canonical fields, returns true
 *   - already seeded (23505): returns false silently
 *   - other Supabase error: returns false (fail-soft), never throws
 *   - invalid wallet: returns false without touching Supabase
 *   - idempotency key format: welcome_pack:{lowercased wallet}
 */

import { describe, expect, it, vi } from "vitest";

import {
  buildWelcomePackIdempotencyKey,
  ensurePeonesWelcomePack,
  hasPeonesWelcomePack,
  PEONES_WELCOME_PACK_AMOUNT,
  type WelcomePackSupabase,
} from "@/lib/peones/welcome-pack-server";

const W = "0xabcdef0123456789abcdef0123456789abcdef01";
const W_UPPER = "0xABCDEF0123456789ABCDEF0123456789ABCDEF01";

function buildSupabaseMock(opts: {
  insertError?: { code?: string; message?: string } | null;
}): {
  client: WelcomePackSupabase;
  insertSpy: ReturnType<typeof vi.fn>;
} {
  const insertSpy = vi
    .fn()
    .mockResolvedValue({ error: opts.insertError ?? null });
  const client: WelcomePackSupabase = {
    from: () => ({ insert: insertSpy as never }),
  };
  return { client, insertSpy };
}

describe("buildWelcomePackIdempotencyKey", () => {
  it("uses welcome_pack:<lowercased wallet>", () => {
    expect(buildWelcomePackIdempotencyKey(W)).toBe(`welcome_pack:${W}`);
    expect(buildWelcomePackIdempotencyKey(W_UPPER)).toBe(`welcome_pack:${W}`);
  });
});

describe("ensurePeonesWelcomePack — fresh wallet", () => {
  it("inserts a row with the canonical welcome_pack payload + returns true", async () => {
    const { client, insertSpy } = buildSupabaseMock({});
    const result = await ensurePeonesWelcomePack(client, W);
    expect(result).toBe(true);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const payload = insertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      wallet: W,
      event_type: "earn",
      amount: PEONES_WELCOME_PACK_AMOUNT,
      source: "welcome_pack",
      source_id: null,
      idempotency_key: `welcome_pack:${W}`,
      metadata: { welcome_pack: true },
    });
    expect(payload.attestation_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(typeof payload.day_utc).toBe("string");
  });

  it("normalises wallet to lowercase before inserting", async () => {
    const { client, insertSpy } = buildSupabaseMock({});
    await ensurePeonesWelcomePack(client, W_UPPER);
    const payload = insertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.wallet).toBe(W);
    expect(payload.idempotency_key).toBe(`welcome_pack:${W}`);
  });
});

describe("ensurePeonesWelcomePack — already seeded", () => {
  it("returns false silently when Supabase raises 23505 unique_violation", async () => {
    const { client } = buildSupabaseMock({
      insertError: { code: "23505", message: "duplicate key" },
    });
    const result = await ensurePeonesWelcomePack(client, W);
    expect(result).toBe(false);
  });

  it("does NOT throw on the duplicate case", async () => {
    const { client } = buildSupabaseMock({
      insertError: { code: "23505", message: "duplicate key" },
    });
    await expect(ensurePeonesWelcomePack(client, W)).resolves.toBe(false);
  });
});

describe("ensurePeonesWelcomePack — fail-soft", () => {
  it("returns false on transient Supabase error (non-23505)", async () => {
    const { client } = buildSupabaseMock({
      insertError: { code: "08006", message: "connection_failure" },
    });
    const result = await ensurePeonesWelcomePack(client, W);
    expect(result).toBe(false);
  });

  it("never throws even when Supabase rejects with no code", async () => {
    const { client } = buildSupabaseMock({
      insertError: { message: "boom" },
    });
    await expect(ensurePeonesWelcomePack(client, W)).resolves.toBe(false);
  });
});

describe("ensurePeonesWelcomePack — invalid wallet", () => {
  it("returns false WITHOUT calling Supabase when wallet is malformed", async () => {
    const { client, insertSpy } = buildSupabaseMock({});
    const result = await ensurePeonesWelcomePack(client, "0xnotvalid");
    expect(result).toBe(false);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

/**
 * D2.1 — the probe that gates the seed.
 *
 * It is an optimisation, and every test here exists to prove it cannot become
 * a correctness dependency: the UNIQUE index stays the guarantee.
 */
describe("hasPeonesWelcomePack", () => {
  function client(opts: {
    data?: unknown;
    error?: { code?: string; message?: string } | null;
    throws?: boolean;
  }) {
    const maybeSingle = vi.fn(async () => {
      if (opts.throws) throw new Error("network down");
      return { data: opts.data ?? null, error: opts.error ?? null };
    });
    const limit = vi.fn(() => ({ maybeSingle }));
    const eq = vi.fn(() => ({ limit, maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const insert = vi.fn(async () => ({ error: null }));
    return {
      supabase: { from: vi.fn(() => ({ select, insert })) },
      select,
      eq,
      limit,
      insert,
      maybeSingle,
    };
  }

  it("probes by idempotency_key on the unique index — never a table scan", async () => {
    const c = client({ data: { idempotency_key: "x" } });
    await hasPeonesWelcomePack(c.supabase as never, W);

    expect(c.supabase.from).toHaveBeenCalledWith("peones_ledger");
    expect(c.eq).toHaveBeenCalledWith(
      "idempotency_key",
      buildWelcomePackIdempotencyKey(W),
    );
  });

  it("selects ONE column and bounds the result to ONE row", async () => {
    const c = client({ data: null });
    await hasPeonesWelcomePack(c.supabase as never, W);

    // Not `*`: this table holds wallets, metadata and attestation hashes.
    expect(c.select).toHaveBeenCalledWith("idempotency_key");
    // postgrest-js 2.100.1's `maybeSingle()` adds no LIMIT — it only
    // post-processes the array — so the bound must be explicit.
    expect(c.limit).toHaveBeenCalledWith(1);
  });

  it("reports true when the row exists, false when it does not", async () => {
    await expect(
      hasPeonesWelcomePack(client({ data: { idempotency_key: "x" } }).supabase as never, W),
    ).resolves.toBe(true);
    await expect(
      hasPeonesWelcomePack(client({ data: null }).supabase as never, W),
    ).resolves.toBe(false);
  });

  it("normalizes the wallet before probing", async () => {
    const c = client({ data: null });
    await hasPeonesWelcomePack(c.supabase as never, W_UPPER);
    expect(c.eq).toHaveBeenCalledWith(
      "idempotency_key",
      buildWelcomePackIdempotencyKey(W),
    );
  });

  it("reports 'unknown' on a DB error — NOT false", async () => {
    // Folding an outage into "not seeded" would fire an INSERT at a database
    // that just failed a read, which is the behaviour D2.1 removes.
    await expect(
      hasPeonesWelcomePack(
        client({ error: { code: "PGRST", message: "boom" } }).supabase as never,
        W,
      ),
    ).resolves.toBe("unknown");
  });

  it("reports 'unknown' when the client throws", async () => {
    await expect(
      hasPeonesWelcomePack(client({ throws: true }).supabase as never, W),
    ).resolves.toBe("unknown");
  });

  it("never writes", async () => {
    const c = client({ data: null });
    await hasPeonesWelcomePack(c.supabase as never, W);
    expect(c.insert).not.toHaveBeenCalled();
  });

  it("treats a malformed wallet as seeded, so no write is attempted", async () => {
    const c = client({ data: null });
    await expect(
      hasPeonesWelcomePack(c.supabase as never, "0xnotvalid"),
    ).resolves.toBe(true);
    expect(c.supabase.from).not.toHaveBeenCalled();
  });

  it("does not make the index redundant: a stale 'false' still cannot double-grant", async () => {
    // The probe says "not seeded" while the row already exists — the exact
    // race the gate cannot prevent. The insert must no-op on 23505.
    const insert = vi.fn(async () => ({
      error: { code: "23505", message: "duplicate key" },
    }));
    const supabase = { from: vi.fn(() => ({ insert })) };

    await expect(
      ensurePeonesWelcomePack(supabase as never, W),
    ).resolves.toBe(false);
  });
});
