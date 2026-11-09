import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import {
  useLearnFocusDays,
  type DailyProgressState,
} from "../use-learn-focus-days";

/**
 * LEARN-only Focus Days read (founder, 2026-07-27).
 *
 * `EffectiveTrainingPassProvider` stays the single authority on paid access and
 * never learns about the Daily. This hook is the ONLY caller that attaches the
 * backfill report, and it must not fire before local progress has hydrated:
 * `?streak=0` latches the ledger permanently, an absent `streak` does not, so a
 * race against our own localStorage read would freeze a real player at zero and
 * only a manual row delete could undo it.
 */

const liteMode = vi.hoisted(() => ({ value: true }));
vi.mock("@/lib/feature-flags", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/feature-flags")>()),
  get CHESSCITO_LITE_MODE() {
    return liteMode.value;
  },
}));

const WALLET = "0x00000000000000000000000000000000000000ab";

const READY: DailyProgressState = {
  status: "ready",
  value: { streak: 4, lastCompletedDate: "2026-07-26" },
};

function mockJson(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  });
}

/** The single URL the hook requested, as a parsed query string. */
function requestedParams(fetchMock: ReturnType<typeof vi.fn>): URLSearchParams {
  const url = String(fetchMock.mock.calls[0]?.[0]);
  return new URL(url, "https://x.test").searchParams;
}

beforeEach(() => {
  liteMode.value = true;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useLearnFocusDays", () => {
  it("makes NO request while local Daily progress is still loading", async () => {
    const fetchMock = mockJson({});
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useLearnFocusDays({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: { status: "loading" },
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toEqual({ status: "idle" });
  });

  it("emits a literal streak=0 once hydrated with no history", async () => {
    const fetchMock = mockJson({
      focusDays: { status: "ok", completed: 0, goal: 21, seasonId: "s1" },
    });
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() =>
      useLearnFocusDays({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: {
          status: "ready",
          value: { streak: 0, lastCompletedDate: null },
        },
      }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // "0" is a claim ("no history"); absent is "I don't know yet". Only the
    // first may latch the backfill.
    expect(requestedParams(fetchMock).get("streak")).toBe("0");
  });

  it("never emits an empty streak param", async () => {
    const fetchMock = mockJson({
      focusDays: { status: "ok", completed: 0, goal: 21, seasonId: "s1" },
    });
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() =>
      useLearnFocusDays({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: {
          status: "ready",
          value: { streak: 0, lastCompletedDate: null },
        },
      }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // The server treats "" as unknown (focus-ledger-init.ts:40); shipping it
    // would silently disable the backfill instead of seeding a zero.
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toMatch(/streak=(&|$)/);
  });

  it("sends lastCompletedDate when there is a run to anchor", async () => {
    const fetchMock = mockJson({
      focusDays: { status: "ok", completed: 4, goal: 21, seasonId: "s1" },
    });
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() =>
      useLearnFocusDays({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: READY,
      }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const params = requestedParams(fetchMock);
    expect(params.get("streak")).toBe("4");
    expect(params.get("lastCompletedDate")).toBe("2026-07-26");
    expect(params.get("wallet")).toBe(WALLET);
  });

  it("omits lastCompletedDate entirely when there is none", async () => {
    const fetchMock = mockJson({
      focusDays: { status: "ok", completed: 0, goal: 21, seasonId: "s1" },
    });
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() =>
      useLearnFocusDays({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: {
          status: "ready",
          value: { streak: 0, lastCompletedDate: null },
        },
      }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(requestedParams(fetchMock).has("lastCompletedDate")).toBe(false);
  });

  it("does not run in PLAY", async () => {
    liteMode.value = false;
    const fetchMock = mockJson({});
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useLearnFocusDays({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: READY,
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toEqual({ status: "idle" });
  });

  it("does not run without an active entitlement", async () => {
    const fetchMock = mockJson({});
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useLearnFocusDays({
        wallet: WALLET,
        entitlementActive: false,
        dailyProgress: READY,
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toEqual({ status: "idle" });
  });

  it("reports unavailable on a failed request, so the card degrades", async () => {
    const fetchMock = mockJson({}, false);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useLearnFocusDays({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: READY,
      }),
    );

    // `unavailable` is a failure of OURS, and the card must say so rather than
    // paint an invented zero. Access is unaffected: it lives in the provider.
    await waitFor(() => expect(result.current).toEqual({ status: "unavailable" }));
  });

  it("treats a response with no focusDays slice as unavailable, not as zero", async () => {
    const fetchMock = mockJson({ active: true, source: "season_pass" });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useLearnFocusDays({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: READY,
      }),
    );

    await waitFor(() => expect(result.current).toEqual({ status: "unavailable" }));
  });

  it("passes the disabled slice through untouched (a decision, not a fault)", async () => {
    const fetchMock = mockJson({ focusDays: { status: "disabled" } });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useLearnFocusDays({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: READY,
      }),
    );

    await waitFor(() => expect(result.current).toEqual({ status: "disabled" }));
  });

  it("never surfaces entitlement fields from the response", async () => {
    const fetchMock = mockJson({
      active: false,
      source: null,
      focusDays: { status: "ok", completed: 4, goal: 21, seasonId: "s1" },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useLearnFocusDays({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: READY,
      }),
    );

    // A second read of `active` here would make this hook a competing
    // authority on paid access. It only ever reports progress.
    await waitFor(() =>
      expect(result.current).toEqual({
        status: "ok",
        completed: 4,
        goal: 21,
        seasonId: "s1",
      }),
    );
  });
});

/**
 * A write and this read are separate calls, and the write happens second. The
 * recorder bumps a token once the server confirms, which is the only thing that
 * makes the number move in the same session it was earned.
 */
describe("useLearnFocusDays — re-reading after a write", () => {
  it("re-counts when the refresh token changes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ focusDays: { status: "ok", completed: 4, goal: 21, seasonId: "s1" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ focusDays: { status: "ok", completed: 5, goal: 21, seasonId: "s1" } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      (props: { token: number }) =>
        useLearnFocusDays({
          wallet: WALLET,
          entitlementActive: true,
          dailyProgress: READY,
          refreshToken: props.token,
        }),
      { initialProps: { token: 0 } },
    );
    await waitFor(() => expect(result.current).toMatchObject({ completed: 4 }));

    rerender({ token: 1 });

    await waitFor(() => expect(result.current).toMatchObject({ completed: 5 }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not re-count while the token holds still", async () => {
    const fetchMock = mockJson({
      focusDays: { status: "ok", completed: 4, goal: 21, seasonId: "s1" },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      (props: { token: number }) =>
        useLearnFocusDays({
          wallet: WALLET,
          entitlementActive: true,
          dailyProgress: READY,
          refreshToken: props.token,
        }),
      { initialProps: { token: 3 } },
    );
    await waitFor(() => expect(result.current).toMatchObject({ completed: 4 }));

    rerender({ token: 3 });

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
