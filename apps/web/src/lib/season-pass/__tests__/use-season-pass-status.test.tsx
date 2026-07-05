import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/lib/feature-flags", () => ({ CHESSCITO_LITE_MODE: true }));

import { useSeasonPassStatus } from "../use-season-pass-status";

const originalFetch = global.fetch;
const WALLET = "0xaaaabbbbccccddddeeeeffff0000111122223333";

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("useSeasonPassStatus", () => {
  it("exposes PRO as effective Training Pass coverage", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        active: true,
        source: "pro",
        seasonPassExpiresAt: null,
        proExpiresAt: 1_800_000_000_000,
      }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useSeasonPassStatus(WALLET));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current).toMatchObject({
      active: true,
      source: "pro",
      seasonPassExpiresAt: null,
      proExpiresAt: 1_800_000_000_000,
      shieldsCredited: 0,
    });
  });

  it("preserves direct Season Pass metadata and shields", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        active: true,
        source: "season_pass",
        seasonPassExpiresAt: "2026-07-20T00:00:00.000Z",
        proExpiresAt: null,
        seasonId: "season-1",
        supporterStatus: "challenger",
        shieldsCredited: 3,
      }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useSeasonPassStatus(WALLET));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current).toMatchObject({
      active: true,
      source: "season_pass",
      seasonId: "season-1",
      shieldsCredited: 3,
    });
  });
});
