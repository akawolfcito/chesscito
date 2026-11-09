/**
 * Sprint 4 commit G — PRO bypass resolver tests.
 *
 * Contract assertions:
 *   - Free user (isProActive false) → apply=false, reason=not_pro
 *   - PRO user under quota → apply=true, with quotaLimit/Used/Remaining
 *   - PRO user AT quota → apply=false, reason=quota_exhausted
 *   - PRO user, supabase lookup fails → apply=false,
 *     reason=quota_lookup_failed (fail-closed)
 *   - PRO user, unlimited target (save_game) → apply=true without
 *     touching supabase
 *   - isProActive throws → apply=false (fail-closed)
 *   - Wallet is lowercased before reaching isProActive
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pro/is-active", () => ({
  isProActive: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(),
}));

import { isProActive } from "@/lib/pro/is-active";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  PRO_BYPASS_DAILY_QUOTA,
  resolveProBypass,
} from "@/lib/peones/pro-bypass";

const mockedIsProActive = vi.mocked(isProActive);
const mockedSupabase = vi.mocked(getSupabaseServer);

const W = "0xabcdef0123456789abcdef0123456789abcdef01";
const DAY = "2026-06-08";

function supabaseWith(count: number | null, error: unknown = null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ count, error }),
              }),
            }),
          }),
        }),
      }),
    }),
  } as unknown as ReturnType<typeof getSupabaseServer>;
}

beforeEach(() => {
  mockedIsProActive.mockReset();
  mockedSupabase.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("PRO_BYPASS_DAILY_QUOTA", () => {
  // Economy V1 (2026-07-21) left every PRO quota untouched. It only
  // dropped the `retry` / `save_game` entries, because those targets
  // stopped being spendable and this record is keyed by spend target.
  it("matches calibration §6 defaults, unchanged by Economy V1", () => {
    expect(PRO_BYPASS_DAILY_QUOTA.coach).toBe(5);
    expect(PRO_BYPASS_DAILY_QUOTA.hint).toBe(20);
    // Shield: conservative default (no PRO entitlement decided yet)
    expect(PRO_BYPASS_DAILY_QUOTA.shield).toBe(0);
  });

  it("covers exactly the active spend targets", () => {
    expect(Object.keys(PRO_BYPASS_DAILY_QUOTA).sort()).toEqual([
      "coach",
      "hint",
      "shield",
    ]);
  });
});

describe("resolveProBypass — free user", () => {
  it("returns apply=false, reason=not_pro WITHOUT touching supabase", async () => {
    mockedIsProActive.mockResolvedValue({ active: false, expiresAt: null });
    const result = await resolveProBypass(W, "coach", DAY);
    expect(result).toEqual({
      apply: false,
      proActive: false,
      reason: "not_pro",
    });
    expect(mockedSupabase).not.toHaveBeenCalled();
  });

  it("isProActive throws → apply=false (fail-closed)", async () => {
    mockedIsProActive.mockRejectedValue(new Error("redis_down"));
    const result = await resolveProBypass(W, "coach", DAY);
    expect(result.apply).toBe(false);
    if (!result.apply) expect(result.reason).toBe("not_pro");
  });
});

describe("resolveProBypass — PRO user under quota", () => {
  it("returns apply=true with quota fields populated", async () => {
    mockedIsProActive.mockResolvedValue({ active: true, expiresAt: 1e15 });
    mockedSupabase.mockReturnValue(supabaseWith(2));
    const result = await resolveProBypass(W, "coach", DAY);
    expect(result).toEqual({
      apply: true,
      proActive: true,
      quotaLimit: 5,
      quotaUsedBefore: 2,
      quotaRemainingBefore: 3,
    });
  });

  it("matches each per-target quota limit", async () => {
    mockedIsProActive.mockResolvedValue({ active: true, expiresAt: 1e15 });
    mockedSupabase.mockReturnValue(supabaseWith(0));
    const hint = await resolveProBypass(W, "hint", DAY);
    if (hint.apply) expect(hint.quotaLimit).toBe(20);
    const coach = await resolveProBypass(W, "coach", DAY);
    if (coach.apply) expect(coach.quotaLimit).toBe(5);
  });

  it("lowercases the wallet before isProActive", async () => {
    mockedIsProActive.mockResolvedValue({ active: true, expiresAt: 1e15 });
    mockedSupabase.mockReturnValue(supabaseWith(0));
    const upper = "0xABCDEF0123456789ABCDEF0123456789ABCDEF01";
    await resolveProBypass(upper, "coach", DAY);
    expect(mockedIsProActive).toHaveBeenCalledWith(W);
  });
});

describe("resolveProBypass — PRO user at quota", () => {
  it("returns apply=false, reason=quota_exhausted when used >= limit", async () => {
    mockedIsProActive.mockResolvedValue({ active: true, expiresAt: 1e15 });
    mockedSupabase.mockReturnValue(supabaseWith(5));
    const result = await resolveProBypass(W, "coach", DAY);
    expect(result).toEqual({
      apply: false,
      proActive: true,
      reason: "quota_exhausted",
      quotaLimit: 5,
      quotaUsedBefore: 5,
    });
  });

  it("treats exactly-at-limit as exhausted (5/5, not 5/4)", async () => {
    mockedIsProActive.mockResolvedValue({ active: true, expiresAt: 1e15 });
    mockedSupabase.mockReturnValue(supabaseWith(5));
    const result = await resolveProBypass(W, "coach", DAY);
    expect(result.apply).toBe(false);
  });

  it("shield=0 quota is exhausted on first attempt (no PRO bypass)", async () => {
    mockedIsProActive.mockResolvedValue({ active: true, expiresAt: 1e15 });
    mockedSupabase.mockReturnValue(supabaseWith(0));
    const result = await resolveProBypass(W, "shield", DAY);
    expect(result).toEqual({
      apply: false,
      proActive: true,
      reason: "quota_exhausted",
      quotaLimit: 0,
      quotaUsedBefore: 0,
    });
  });
});

describe("resolveProBypass — supabase lookup failure", () => {
  it("returns apply=false, reason=quota_lookup_failed when supabase returns error", async () => {
    mockedIsProActive.mockResolvedValue({ active: true, expiresAt: 1e15 });
    mockedSupabase.mockReturnValue(supabaseWith(null, { message: "boom" }));
    const result = await resolveProBypass(W, "coach", DAY);
    expect(result).toEqual({
      apply: false,
      proActive: true,
      reason: "quota_lookup_failed",
      quotaLimit: 5,
    });
  });

  it("returns apply=false when supabase client is null", async () => {
    mockedIsProActive.mockResolvedValue({ active: true, expiresAt: 1e15 });
    mockedSupabase.mockReturnValue(null);
    const result = await resolveProBypass(W, "coach", DAY);
    expect(result.apply).toBe(false);
  });
});

// The "unlimited target" case (a non-finite quota, which short-circuits
// the Supabase count) lost its only subject when `save_game` stopped
// being a spend target in Economy V1. The defensive branch stays in
// resolveProBypass for a future unlimited entitlement; there is no
// target to exercise it with today, and casting a retired string past
// the type just to keep a green test would assert nothing real.
