import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { dispatchDailyCompleted } from "@/lib/daily/events";
import { recordDailyCompletion } from "@/lib/daily/progress";
import { useFocusDayRecorder } from "../use-focus-day-recorder";
import type { DailyProgressState } from "../use-learn-focus-days";

/**
 * The ONE slice of Stage 2 that writes.
 *
 * Invariants signed by the founder (2026-07-27): the Daily completes locally
 * even if the POST fails · no wallet, no write · the normal write sends NO
 * date (the server owns it) · the retry DOES send `lastCompletedDate` · a date
 * outside [yesterday, today] is never retried · not one POST more per
 * re-render or rehydration.
 */

const liteMode = vi.hoisted(() => ({ value: true }));
vi.mock("@/lib/feature-flags", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/feature-flags")>()),
  get CHESSCITO_LITE_MODE() {
    return liteMode.value;
  },
}));

const WALLET = "0x00000000000000000000000000000000000000ab";
const TODAY = "2026-04-25";
const YESTERDAY = "2026-04-24";

function ready(lastCompletedDate: string | null, streak = 3): DailyProgressState {
  return { status: "ready", value: { streak, lastCompletedDate } };
}

function mockOk(progress = { completed: 5, goal: 21 }) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, progress }),
  });
}

/** The parsed JSON body of the nth POST. */
function bodyOf(fetchMock: ReturnType<typeof vi.fn>, index = 0): Record<string, unknown> {
  const init = fetchMock.mock.calls[index]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body ?? "{}"));
}

beforeEach(() => {
  liteMode.value = true;
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00Z`));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("useFocusDayRecorder — when it must NOT write", () => {
  it("does not write without a wallet, even on a completion", async () => {
    const fetchMock = mockOk();
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() =>
      useFocusDayRecorder({
        wallet: undefined,
        entitlementActive: true,
        dailyProgress: ready(YESTERDAY),
      }),
    );
    act(() => dispatchDailyCompleted(TODAY));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not write without an active entitlement", async () => {
    const fetchMock = mockOk();
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() =>
      useFocusDayRecorder({
        wallet: WALLET,
        entitlementActive: false,
        dailyProgress: ready(YESTERDAY),
      }),
    );
    act(() => dispatchDailyCompleted(TODAY));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not write in PLAY mode", async () => {
    liteMode.value = false;
    const fetchMock = mockOk();
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() =>
      useFocusDayRecorder({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: ready(YESTERDAY),
      }),
    );
    act(() => dispatchDailyCompleted(TODAY));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not retry while local progress is still loading", async () => {
    const fetchMock = mockOk();
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() =>
      useFocusDayRecorder({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: { status: "loading" },
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not retry a player with no history at all", async () => {
    const fetchMock = mockOk();
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() =>
      useFocusDayRecorder({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: ready(null, 0),
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never retries a date older than yesterday", async () => {
    const fetchMock = mockOk();
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() =>
      useFocusDayRecorder({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: ready("2026-04-20"),
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never retries a date in the future (device clock ahead)", async () => {
    const fetchMock = mockOk();
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() =>
      useFocusDayRecorder({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: ready("2026-04-26"),
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useFocusDayRecorder — the completion write", () => {
  it("POSTs without a date: the server owns it", async () => {
    const fetchMock = mockOk();
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() =>
      useFocusDayRecorder({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: ready(null, 0),
      }),
    );
    act(() => dispatchDailyCompleted(TODAY));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/focus-day");
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("POST");
    expect(bodyOf(fetchMock)).toEqual({ wallet: WALLET });
  });

  it("notifies the reader once the server confirms", async () => {
    const fetchMock = mockOk();
    vi.stubGlobal("fetch", fetchMock);
    const onRecorded = vi.fn();

    renderHook(() =>
      useFocusDayRecorder({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: ready(null, 0),
        onRecorded,
      }),
    );
    act(() => dispatchDailyCompleted(TODAY));

    await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1));
  });

  it("does not notify the reader when the write fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ ok: false, error: "ledger_unavailable" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const onRecorded = vi.fn();

    renderHook(() =>
      useFocusDayRecorder({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: ready(null, 0),
        onRecorded,
      }),
    );
    act(() => dispatchDailyCompleted(TODAY));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it("lets the Daily complete locally even when the POST rejects", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() =>
      useFocusDayRecorder({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: ready(null, 0),
      }),
    );
    act(() => {
      recordDailyCompletion(TODAY);
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(localStorage.getItem("chesscito:daily-progress") ?? "{}")).toMatchObject({
      streak: 1,
      lastCompletedDate: TODAY,
    });
  });
});

describe("useFocusDayRecorder — the mount retry", () => {
  it("retries yesterday with an explicit date", async () => {
    const fetchMock = mockOk();
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() =>
      useFocusDayRecorder({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: ready(YESTERDAY),
      }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(bodyOf(fetchMock)).toEqual({ wallet: WALLET, date: YESTERDAY });
  });

  it("retries today too — the UNIQUE makes it idempotent", async () => {
    const fetchMock = mockOk();
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() =>
      useFocusDayRecorder({
        wallet: WALLET,
        entitlementActive: true,
        dailyProgress: ready(TODAY),
      }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(bodyOf(fetchMock)).toEqual({ wallet: WALLET, date: TODAY });
  });

  it("fires once per (wallet, date), not once per render", async () => {
    const fetchMock = mockOk();
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = renderHook(
      (props: { progress: DailyProgressState }) =>
        useFocusDayRecorder({
          wallet: WALLET,
          entitlementActive: true,
          dailyProgress: props.progress,
        }),
      { initialProps: { progress: ready(YESTERDAY) } },
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // A fresh object with the same values — what rehydration looks like.
    rerender({ progress: ready(YESTERDAY) });
    rerender({ progress: ready(YESTERDAY, 4) });

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not re-POST a date the completion already wrote", async () => {
    const fetchMock = mockOk();
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = renderHook(
      (props: { progress: DailyProgressState }) =>
        useFocusDayRecorder({
          wallet: WALLET,
          entitlementActive: true,
          dailyProgress: props.progress,
        }),
      { initialProps: { progress: ready(null, 0) } },
    );
    act(() => dispatchDailyCompleted(TODAY));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // localStorage now says today — the retry path must recognise it as done.
    rerender({ progress: ready(TODAY, 1) });

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a different wallet is a different write", async () => {
    const fetchMock = mockOk();
    vi.stubGlobal("fetch", fetchMock);
    const other = "0x00000000000000000000000000000000000000cd";

    const { rerender } = renderHook(
      (props: { wallet: string }) =>
        useFocusDayRecorder({
          wallet: props.wallet,
          entitlementActive: true,
          dailyProgress: ready(YESTERDAY),
        }),
      { initialProps: { wallet: WALLET } },
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender({ wallet: other });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(bodyOf(fetchMock, 1)).toEqual({ wallet: other, date: YESTERDAY });
  });
});
