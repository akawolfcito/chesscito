/**
 * GET /api/admin/lite-stats — Lite B1.2 grant readiness stats.
 *
 * Tests: ADMIN_TOKEN gate, response shape, isLite filter (Lite vs Full events).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const selectMock = vi.hoisted(() => ({
  select: vi.fn(),
  in: vi.fn(),
  gte: vi.fn(),
  lt: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(() => ({
    from: vi.fn(() => selectMock),
  })),
}));

import { GET } from "../route";
import { getSupabaseServer } from "@/lib/supabase/server";

const TOKEN = "test-admin-token";

/** Chainable Supabase select mock: each method returns selectMock so calls chain. */
function mockSelectChain(rows: { event: string; props: unknown }[]) {
  selectMock.select.mockReturnValue(selectMock);
  selectMock.in.mockReturnValue(selectMock);
  selectMock.gte.mockReturnValue(selectMock);
  selectMock.lt.mockResolvedValue({ data: rows, error: null });
}

function req(params = "", headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api/admin/lite-stats${params}`, { headers });
}

beforeEach(() => {
  vi.stubEnv("ADMIN_TOKEN", TOKEN);
  vi.clearAllMocks();
  // Restore getSupabaseServer after any test that calls mockReturnValue(null).
  // vi.clearAllMocks() resets call history but NOT implementations, so a
  // previous mockReturnValue(null) would bleed into subsequent tests.
  vi.mocked(getSupabaseServer).mockImplementation(
    () => ({ from: vi.fn(() => selectMock) }) as any,
  );
  mockSelectChain([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ADMIN_TOKEN gate", () => {
  it("returns 503 when ADMIN_TOKEN env is not set", async () => {
    vi.stubEnv("ADMIN_TOKEN", "");
    const res = await GET(req());
    expect(res.status).toBe(503);
  });

  it("returns 403 when x-admin-token header is missing", async () => {
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it("returns 403 when x-admin-token is wrong", async () => {
    const res = await GET(req("", { "x-admin-token": "wrong-token" }));
    expect(res.status).toBe(403);
  });

  it("returns 200 when x-admin-token matches", async () => {
    const res = await GET(req("", { "x-admin-token": TOKEN }));
    expect(res.status).toBe(200);
  });
});

describe("date range params", () => {
  it("returns 400 for invalid from date", async () => {
    const res = await GET(req("?from=not-a-date&to=2026-06-22", { "x-admin-token": TOKEN }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when from > to", async () => {
    const res = await GET(req("?from=2026-06-22&to=2026-06-21", { "x-admin-token": TOKEN }));
    expect(res.status).toBe(400);
  });

  it("echoes the period in the response", async () => {
    const res = await GET(req("?from=2026-06-21&to=2026-06-22", { "x-admin-token": TOKEN }));
    const body = await res.json() as Record<string, unknown>;
    expect(body["period"]).toEqual({ from: "2026-06-21", to: "2026-06-22" });
  });
});

describe("isLite filter — Lite vs Full events", () => {
  it("counts only events with isLite: true — ignores Full events without isLite", async () => {
    mockSelectChain([
      // Lite event — should be counted
      { event: "daily_tactic_completed", props: { isLite: true } },
      // Full event — no isLite, should NOT be counted
      { event: "daily_tactic_completed", props: { isPro: false } },
      // Full event — isLite: false explicitly, should NOT be counted
      { event: "daily_tactic_completed", props: { isLite: false } },
    ]);
    const res = await GET(req("?from=2026-06-21&to=2026-06-22", { "x-admin-token": TOKEN }));
    const body = await res.json() as Record<string, unknown>;
    expect(body["daily_tactic_completions"]).toBe(1);
  });

  it("counts claim_gift_tap Lite events correctly", async () => {
    mockSelectChain([
      { event: "claim_gift_tap", props: { isLite: true } },
      { event: "claim_gift_tap", props: { isLite: true } },
    ]);
    const res = await GET(req("?from=2026-06-21&to=2026-06-22", { "x-admin-token": TOKEN }));
    const body = await res.json() as Record<string, unknown>;
    expect(body["claim_gift_taps"]).toBe(2);
  });

  it("does not count claim_gift events without isLite: true", async () => {
    mockSelectChain([
      { event: "claim_gift_tap", props: null },
      { event: "claim_gift_success", props: {} },
    ]);
    const res = await GET(req("?from=2026-06-21&to=2026-06-22", { "x-admin-token": TOKEN }));
    const body = await res.json() as Record<string, unknown>;
    expect(body["claim_gift_taps"]).toBe(0);
    expect(body["claim_gift_successes"]).toBe(0);
  });

  it("returns zero for all keys when no Lite rows found", async () => {
    mockSelectChain([]);
    const res = await GET(req("?from=2026-06-21&to=2026-06-22", { "x-admin-token": TOKEN }));
    const body = await res.json() as Record<string, unknown>;
    expect(body["lite_sessions"]).toBe(0);
    expect(body["daily_tactic_starts"]).toBe(0);
    expect(body["daily_tactic_completions"]).toBe(0);
    expect(body["claim_gift_taps"]).toBe(0);
    expect(body["claim_gift_successes"]).toBe(0);
    expect(body["claim_gift_rejections"]).toBe(0);
    expect(body["claim_gift_failures"]).toBe(0);
    expect(body["exercise_completions"]).toBe(0);
    expect(body["labyrinth_completions"]).toBe(0);
  });
});

describe("response shape is stable", () => {
  it("contains all expected keys", async () => {
    const res = await GET(req("?from=2026-06-21&to=2026-06-22", { "x-admin-token": TOKEN }));
    const body = await res.json() as Record<string, unknown>;
    const expectedKeys = [
      "period",
      "lite_sessions",
      "daily_tactic_starts",
      "daily_tactic_completions",
      "daily_streak_updates",
      "claim_gift_taps",
      "claim_gift_successes",
      "claim_gift_rejections",
      "claim_gift_failures",
      "exercise_completions",
      "labyrinth_completions",
      "passport_updates",
      // B2.1 challenge funnel
      "challenge_link_opens",
      "challenge_starts",
      "challenge_completions",
      "challenge_shares",
      "challenge_continue_to_lite",
      "challenge_completion_rate",
      "challenge_share_rate",
      "challenge_continue_rate",
    ];
    for (const key of expectedKeys) {
      expect(body).toHaveProperty(key);
    }
  });

  it("returns 503 when Supabase unavailable", async () => {
    vi.mocked(getSupabaseServer).mockReturnValue(null);
    const res = await GET(req("?from=2026-06-21&to=2026-06-22", { "x-admin-token": TOKEN }));
    expect(res.status).toBe(503);
  });
});

describe("challenge funnel counts", () => {
  it("counts each challenge event with isLite: true", async () => {
    mockSelectChain([
      { event: "challenge_link_opened", props: { isLite: true } },
      { event: "challenge_link_opened", props: { isLite: true } },
      { event: "challenge_started", props: { isLite: true } },
      { event: "challenge_started", props: { isLite: true } },
      { event: "challenge_completed", props: { isLite: true } },
      { event: "challenge_shared", props: { isLite: true } },
      { event: "challenge_continue_to_lite", props: { isLite: true } },
    ]);
    const res = await GET(req("?from=2026-06-21&to=2026-06-22", { "x-admin-token": TOKEN }));
    const body = await res.json() as Record<string, unknown>;
    expect(body["challenge_link_opens"]).toBe(2);
    expect(body["challenge_starts"]).toBe(2);
    expect(body["challenge_completions"]).toBe(1);
    expect(body["challenge_shares"]).toBe(1);
    expect(body["challenge_continue_to_lite"]).toBe(1);
  });

  it("does not count challenge events without isLite: true", async () => {
    mockSelectChain([
      { event: "challenge_link_opened", props: { source: "challenge_link" } },
      { event: "challenge_started", props: null },
      { event: "challenge_completed", props: { isLite: false } },
    ]);
    const res = await GET(req("?from=2026-06-21&to=2026-06-22", { "x-admin-token": TOKEN }));
    const body = await res.json() as Record<string, unknown>;
    expect(body["challenge_link_opens"]).toBe(0);
    expect(body["challenge_starts"]).toBe(0);
    expect(body["challenge_completions"]).toBe(0);
  });

  it("computes challenge_completion_rate = completions / starts", async () => {
    mockSelectChain([
      { event: "challenge_started", props: { isLite: true } },
      { event: "challenge_started", props: { isLite: true } },
      { event: "challenge_started", props: { isLite: true } },
      { event: "challenge_started", props: { isLite: true } },
      { event: "challenge_completed", props: { isLite: true } },
      { event: "challenge_completed", props: { isLite: true } },
      { event: "challenge_completed", props: { isLite: true } },
    ]);
    const res = await GET(req("?from=2026-06-21&to=2026-06-22", { "x-admin-token": TOKEN }));
    const body = await res.json() as Record<string, unknown>;
    expect(body["challenge_completion_rate"]).toBeCloseTo(3 / 4);
  });

  it("challenge_completion_rate is null when starts === 0", async () => {
    mockSelectChain([]);
    const res = await GET(req("?from=2026-06-21&to=2026-06-22", { "x-admin-token": TOKEN }));
    const body = await res.json() as Record<string, unknown>;
    expect(body["challenge_completion_rate"]).toBeNull();
  });

  it("challenge_share_rate is null when completions === 0", async () => {
    mockSelectChain([
      { event: "challenge_started", props: { isLite: true } },
    ]);
    const res = await GET(req("?from=2026-06-21&to=2026-06-22", { "x-admin-token": TOKEN }));
    const body = await res.json() as Record<string, unknown>;
    expect(body["challenge_share_rate"]).toBeNull();
  });

  it("challenge_continue_rate is null when completions === 0", async () => {
    mockSelectChain([]);
    const res = await GET(req("?from=2026-06-21&to=2026-06-22", { "x-admin-token": TOKEN }));
    const body = await res.json() as Record<string, unknown>;
    expect(body["challenge_continue_rate"]).toBeNull();
  });

  it("computes share_rate and continue_rate against completions", async () => {
    mockSelectChain([
      { event: "challenge_completed", props: { isLite: true } },
      { event: "challenge_completed", props: { isLite: true } },
      { event: "challenge_shared", props: { isLite: true } },
      { event: "challenge_continue_to_lite", props: { isLite: true } },
      { event: "challenge_continue_to_lite", props: { isLite: true } },
    ]);
    const res = await GET(req("?from=2026-06-21&to=2026-06-22", { "x-admin-token": TOKEN }));
    const body = await res.json() as Record<string, unknown>;
    expect(body["challenge_share_rate"]).toBeCloseTo(1 / 2);
    expect(body["challenge_continue_rate"]).toBeCloseTo(2 / 2);
  });
});
