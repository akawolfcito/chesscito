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
  PEONES_WELCOME_PACK_AMOUNT,
} from "@/lib/peones/welcome-pack-server";

const W = "0xabcdef0123456789abcdef0123456789abcdef01";
const W_UPPER = "0xABCDEF0123456789ABCDEF0123456789ABCDEF01";

type SupabaseClientLike = {
  from: ReturnType<typeof vi.fn>;
};

function buildSupabaseMock(opts: {
  insertError?: { code?: string; message?: string } | null;
}): {
  client: SupabaseClientLike;
  insertSpy: ReturnType<typeof vi.fn>;
} {
  const insertSpy = vi
    .fn()
    .mockResolvedValue({ error: opts.insertError ?? null });
  const from = vi.fn().mockReturnValue({ insert: insertSpy });
  return { client: { from } as SupabaseClientLike, insertSpy };
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ensurePeonesWelcomePack(client as any, W);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ensurePeonesWelcomePack(client as any, W_UPPER);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ensurePeonesWelcomePack(client as any, W);
    expect(result).toBe(false);
  });

  it("does NOT throw on the duplicate case", async () => {
    const { client } = buildSupabaseMock({
      insertError: { code: "23505", message: "duplicate key" },
    });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ensurePeonesWelcomePack(client as any, W),
    ).resolves.toBe(false);
  });
});

describe("ensurePeonesWelcomePack — fail-soft", () => {
  it("returns false on transient Supabase error (non-23505)", async () => {
    const { client } = buildSupabaseMock({
      insertError: { code: "08006", message: "connection_failure" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ensurePeonesWelcomePack(client as any, W);
    expect(result).toBe(false);
  });

  it("never throws even when Supabase rejects with no code", async () => {
    const { client } = buildSupabaseMock({
      insertError: { message: "boom" },
    });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ensurePeonesWelcomePack(client as any, W),
    ).resolves.toBe(false);
  });
});

describe("ensurePeonesWelcomePack — invalid wallet", () => {
  it("returns false WITHOUT calling Supabase when wallet is malformed", async () => {
    const { client, insertSpy } = buildSupabaseMock({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ensurePeonesWelcomePack(client as any, "0xnotvalid");
    expect(result).toBe(false);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
