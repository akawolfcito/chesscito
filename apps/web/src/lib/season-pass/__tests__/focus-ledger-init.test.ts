import { describe, expect, it, vi } from "vitest";

import {
  countFocusDays,
  ensureFocusLedgerInitialized,
  parseBackfillReport,
} from "../focus-ledger-init";

const WALLET = "0xaaaabbbbccccddddeeeeffff0000111122223333";
const SEASON = "21day-mind-challenge-2026-q3";
const NOW = Date.parse("2026-07-27T12:00:00.000Z");
/** Bought 5 days ago, 21-day pass: window opened 2026-07-23. */
const EXPIRES = "2026-08-13T00:00:00.000Z";

type LatchRow = { wallet: string; season_id: string } | null;

/**
 * Minimal stand-in for the supabase-js builder. Only the two shapes this
 * module uses: a counting select and an upsert.
 */
function buildSupabase(opts: {
  count?: number | null;
  countError?: unknown;
  latch?: LatchRow;
  latchError?: unknown;
  upsertError?: unknown;
} = {}) {
  const upserts: Array<{ table: string; rows: unknown; options: unknown }> = [];

  const from = vi.fn((table: string) => ({
    select: vi.fn((_cols: string, _o?: unknown) => {
      if (table === "focus_ledger_init") {
        const maybeSingle = vi
          .fn()
          .mockResolvedValue({ data: opts.latch ?? null, error: opts.latchError ?? null });
        const eq2 = vi.fn(() => ({ maybeSingle }));
        return { eq: vi.fn(() => ({ eq: eq2 })) };
      }
      const eq2 = vi.fn(() =>
        Promise.resolve({ count: opts.count ?? 0, error: opts.countError ?? null }),
      );
      return { eq: vi.fn(() => ({ eq: eq2 })) };
    }),
    upsert: vi.fn((rows: unknown, options: unknown) => {
      upserts.push({ table, rows, options });
      return Promise.resolve({ error: opts.upsertError ?? null });
    }),
  }));

  return { supabase: { from } as never, upserts, from };
}

type Upsert = { table: string; rows: unknown; options: unknown };

function ledgerUpserts(upserts: Upsert[]) {
  return upserts.filter((u) => u.table === "focus_day_ledger");
}
function latchUpserts(upserts: Upsert[]) {
  return upserts.filter((u) => u.table === "focus_ledger_init");
}

function init(
  supabase: never,
  report: { streak: number; lastCompletedDate: string | null } | null,
) {
  return ensureFocusLedgerInitialized({
    supabase,
    wallet: WALLET,
    seasonId: SEASON,
    report,
    expiresAt: EXPIRES,
    durationDays: 21,
    goal: 21,
    now: NOW,
  });
}

describe("parseBackfillReport", () => {
  const params = (query: string) => new URLSearchParams(query);

  // AC28 — the parse contract, independent of what the backfill then does.
  it("treats an absent streak as 'not known yet'", () => {
    expect(parseBackfillReport(params("wallet=0x1"))).toBeNull();
  });

  it("treats an empty streak as 'not known yet'", () => {
    expect(parseBackfillReport(params("streak=&lastCompletedDate=2026-07-27"))).toBeNull();
  });

  it("treats a non-numeric streak as 'not known yet'", () => {
    expect(parseBackfillReport(params("streak=abc&lastCompletedDate=2026-07-27"))).toBeNull();
  });

  it("reads streak=0 as a real report of zero", () => {
    expect(parseBackfillReport(params("streak=0"))).toEqual({
      streak: 0,
      lastCompletedDate: null,
    });
  });

  it("reads a positive streak with its anchor date", () => {
    expect(parseBackfillReport(params("streak=4&lastCompletedDate=2026-07-27"))).toEqual({
      streak: 4,
      lastCompletedDate: "2026-07-27",
    });
  });

  // A positive streak with no anchor cannot be placed on a calendar. Latching
  // on it would freeze that player at zero forever.
  it("treats a positive streak without a valid anchor as 'not known yet'", () => {
    expect(parseBackfillReport(params("streak=4"))).toBeNull();
    expect(parseBackfillReport(params("streak=4&lastCompletedDate=27-07-2026"))).toBeNull();
  });

  it("rejects a negative streak", () => {
    expect(parseBackfillReport(params("streak=-3&lastCompletedDate=2026-07-27"))).toBeNull();
  });
});

describe("countFocusDays", () => {
  it("returns the row count for the wallet and season", async () => {
    const { supabase } = buildSupabase({ count: 7 });
    await expect(countFocusDays(supabase, WALLET, SEASON)).resolves.toBe(7);
  });

  it("returns null when the ledger cannot answer", async () => {
    const { supabase } = buildSupabase({ countError: { code: "unavailable" } });
    await expect(countFocusDays(supabase, WALLET, SEASON)).resolves.toBeNull();
  });

  it("reads a null count as zero, not as unavailable", async () => {
    const { supabase } = buildSupabase({ count: null });
    await expect(countFocusDays(supabase, WALLET, SEASON)).resolves.toBe(0);
  });
});

describe("ensureFocusLedgerInitialized", () => {
  // AC13 — no report means no seed AND no latch: the next call must get to try.
  it("does not seed and does not latch when the client reported nothing", async () => {
    const { supabase, upserts, from } = buildSupabase();
    const result = await init(supabase, null);

    expect(result).toEqual({ status: "skipped", seededRows: 0 });
    expect(upserts).toHaveLength(0);
    expect(from).not.toHaveBeenCalled();
  });

  // AC12 — min(streak, elapsed, goal), consecutive, back from the anchor.
  it("seeds min(streak, elapsed, goal) dates back from the anchor", async () => {
    const { supabase, upserts } = buildSupabase();
    const result = await init(supabase, { streak: 3, lastCompletedDate: "2026-07-27" });

    expect(result).toEqual({ status: "seeded", seededRows: 3 });
    const rows = ledgerUpserts(upserts)[0].rows as Array<Record<string, unknown>>;
    expect(rows.map((r) => r.date_utc)).toEqual(["2026-07-25", "2026-07-26", "2026-07-27"]);
    expect(rows.every((r) => r.source === "backfill_streak")).toBe(true);
    expect(rows.every((r) => r.wallet === WALLET && r.season_id === SEASON)).toBe(true);
  });

  // AC29 — one multi-row INSERT, not N round-trips.
  it("writes the whole seed in a single upsert", async () => {
    const { supabase, upserts } = buildSupabase();
    await init(supabase, { streak: 5, lastCompletedDate: "2026-07-27" });

    expect(ledgerUpserts(upserts)).toHaveLength(1);
    expect(ledgerUpserts(upserts)[0].options).toEqual({
      onConflict: "wallet,season_id,date_utc",
      ignoreDuplicates: true,
    });
  });

  it("clamps a streak longer than the pass has been alive", async () => {
    const { supabase, upserts } = buildSupabase();
    // Pass opened 2026-07-23, so 5 days elapsed by 2026-07-27.
    const result = await init(supabase, { streak: 40, lastCompletedDate: "2026-07-27" });

    expect(result.seededRows).toBe(5);
    const rows = ledgerUpserts(upserts)[0].rows as Array<Record<string, unknown>>;
    expect(rows[0].date_utc).toBe("2026-07-23");
  });

  // AC12 second half — running it twice adds nothing.
  it("does not run again once the latch exists", async () => {
    const { supabase, upserts } = buildSupabase({
      latch: { wallet: WALLET, season_id: SEASON },
    });
    const result = await init(supabase, { streak: 3, lastCompletedDate: "2026-07-27" });

    expect(result).toEqual({ status: "already", seededRows: 0 });
    expect(upserts).toHaveLength(0);
  });

  it("latches a legitimate zero so it is not retried forever", async () => {
    const { supabase, upserts } = buildSupabase();
    const result = await init(supabase, { streak: 0, lastCompletedDate: null });

    expect(result).toEqual({ status: "seeded", seededRows: 0 });
    expect(ledgerUpserts(upserts)).toHaveLength(0);
    expect(latchUpserts(upserts)[0].rows).toMatchObject({
      wallet: WALLET,
      season_id: SEASON,
      seeded_rows: 0,
    });
  });

  it("does not latch when the seed write failed", async () => {
    const { supabase, upserts } = buildSupabase({ upsertError: { code: "unavailable" } });
    const result = await init(supabase, { streak: 3, lastCompletedDate: "2026-07-27" });

    expect(result).toEqual({ status: "unavailable", seededRows: 0 });
    expect(latchUpserts(upserts)).toHaveLength(0);
  });

  it("does not seed when the latch cannot be read", async () => {
    const { supabase, upserts } = buildSupabase({ latchError: { code: "unavailable" } });
    const result = await init(supabase, { streak: 3, lastCompletedDate: "2026-07-27" });

    expect(result).toEqual({ status: "unavailable", seededRows: 0 });
    expect(upserts).toHaveLength(0);
  });

  // PRO has no purchased window, so there is nothing to infer: it latches at
  // zero and starts counting from today forward.
  it("seeds nothing for an entitlement with no expiry", async () => {
    const { supabase, upserts } = buildSupabase();
    const result = await ensureFocusLedgerInitialized({
      supabase,
      wallet: WALLET,
      seasonId: SEASON,
      report: { streak: 6, lastCompletedDate: "2026-07-27" },
      expiresAt: null,
      durationDays: 21,
      goal: 21,
      now: NOW,
    });

    expect(result).toEqual({ status: "seeded", seededRows: 0 });
    expect(ledgerUpserts(upserts)).toHaveLength(0);
  });
});
