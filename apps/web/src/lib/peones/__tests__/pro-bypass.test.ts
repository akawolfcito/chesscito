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
  it("matches calibration §6 defaults", () => {
    expect(PRO_BYPASS_DAILY_QUOTA.coach).toBe(5);
    expect(PRO_BYPASS_DAILY_QUOTA.hint).toBe(20);
    expect(PRO_BYPASS_DAILY_QUOTA.retry).toBe(10);
    expect(PRO_BYPASS_DAILY_QUOTA.save_game).toBe(
      Number.POSITIVE_INFINITY,
    );
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
    const retry = await resolveProBypass(W, "retry", DAY);
    if (retry.apply) expect(retry.quotaLimit).toBe(10);
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

describe("resolveProBypass — unlimited target (save_game)", () => {
  it("returns apply=true WITHOUT touching supabase", async () => {
    mockedIsProActive.mockResolvedValue({ active: true, expiresAt: 1e15 });
    const result = await resolveProBypass(W, "save_game", DAY);
    expect(result.apply).toBe(true);
    if (result.apply) {
      expect(result.quotaLimit).toBe(Number.POSITIVE_INFINITY);
    }
    expect(mockedSupabase).not.toHaveBeenCalled();
  });
});
