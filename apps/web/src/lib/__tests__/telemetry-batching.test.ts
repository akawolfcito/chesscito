/**
 * Fase 1 — client-side queue.
 *
 * Two properties matter more than the batching itself, both born of the
 * Supabase 522 incident of 2026-08-03:
 *   1. a failed flush is DROPPED, never retried or re-queued;
 *   2. nothing here can block navigation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/analytics/identity", () => ({
  getAnonymousId: () => "anon-test",
}));
vi.mock("@/lib/analytics/account", () => ({
  getTelemetryAccount: () => null,
}));
vi.mock("@/lib/analytics/client-dimensions", () => ({
  clientDimensions: () => ({
    visit_id: "v1",
    surface: "play",
    container: "browser",
    locale: "en",
    source: "direct",
    campaign: null,
    app_version: "test",
  }),
}));

import {
  TELEMETRY_BATCH_SIZE,
  TELEMETRY_FLUSH_IDLE_MS,
  __resetTelemetryQueue,
  __telemetryQueueSize,
  flushTelemetry,
  track,
} from "../telemetry";

let fetchMock: ReturnType<typeof vi.fn>;
let beaconMock: ReturnType<typeof vi.fn>;

function bodyOf(call: unknown[]): { events?: unknown[]; event?: string } {
  return JSON.parse((call[1] as { body: string }).body);
}

beforeEach(() => {
  vi.useFakeTimers();
  __resetTelemetryQueue();
  vi.unstubAllEnvs();

  fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal("fetch", fetchMock);

  beaconMock = vi.fn(() => true);
  vi.stubGlobal("navigator", { sendBeacon: beaconMock });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  __resetTelemetryQueue();
});

describe("batching — request count", () => {
  it("sends ONE request for 20 events", () => {
    for (let i = 0; i < TELEMETRY_BATCH_SIZE; i++) track(`event_${i}`);

    // The headline number: 20 track() calls, 1 HTTP request.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = bodyOf(fetchMock.mock.calls[0]);
    expect(body.events).toHaveLength(TELEMETRY_BATCH_SIZE);
    expect(__telemetryQueueSize()).toBe(0);
  });

  it("does not send before the batch fills or the idle window elapses", () => {
    for (let i = 0; i < 5; i++) track(`event_${i}`);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(__telemetryQueueSize()).toBe(5);
  });

  it("flushes a partial batch after the idle window", () => {
    track("only_one");
    expect(fetchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(TELEMETRY_FLUSH_IDLE_MS + 1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodyOf(fetchMock.mock.calls[0]).events).toHaveLength(1);
  });

  it("keeps every event and its props intact through the queue", () => {
    track("a", { n: 1 });
    track("b", { n: 2 });
    vi.advanceTimersByTime(TELEMETRY_FLUSH_IDLE_MS + 1);

    const events = bodyOf(fetchMock.mock.calls[0]).events as Array<{
      event: string;
      props?: { n: number };
    }>;
    expect(events.map((e) => e.event)).toEqual(["a", "b"]);
    expect(events.map((e) => e.props?.n)).toEqual([1, 2]);
  });

  it("stamps dims per EVENT, not per batch", () => {
    track("a");
    track("b");
    vi.advanceTimersByTime(TELEMETRY_FLUSH_IDLE_MS + 1);

    // A batch can span a navigation, so surface/locale must travel per event.
    const events = bodyOf(fetchMock.mock.calls[0]).events as Array<{
      dims?: unknown;
    }>;
    expect(events.every((e) => e.dims)).toBe(true);
  });
});

describe("failure policy — no retry storm (the 522 case)", () => {
  it("does NOT re-queue a rejected flush", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("522")));

    for (let i = 0; i < TELEMETRY_BATCH_SIZE; i++) track(`event_${i}`);
    await vi.runAllTimersAsync();

    // One attempt, and the batch is gone. Retrying would aim a queue at the
    // exact resource that is already saturated.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(__telemetryQueueSize()).toBe(0);
  });

  it("does not amplify: N failing batches cost exactly N requests", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("522")));

    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < TELEMETRY_BATCH_SIZE; i++) track(`r${round}_e${i}`);
      await vi.runAllTimersAsync();
    }

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("treats a 5XX body as delivered — the client never reads the status", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 522 })),
    );

    for (let i = 0; i < TELEMETRY_BATCH_SIZE; i++) track(`event_${i}`);
    await vi.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(__telemetryQueueSize()).toBe(0);
  });

  it("cannot grow an unbounded backlog — the queue is capped by construction", () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("522")));

    let peak = 0;
    for (let i = 0; i < TELEMETRY_BATCH_SIZE * 5; i++) {
      track(`unique_event_${i}`);
      peak = Math.max(peak, __telemetryQueueSize());
    }

    // Every fill flushes, and every flush empties whether or not the request
    // lands. So there is no buffer to bound separately, and no chunking
    // needed to stay inside the server's 20-event limit.
    expect(peak).toBeLessThan(TELEMETRY_BATCH_SIZE);
  });

  it("never throws out of track(), even if fetch throws synchronously", () => {
    fetchMock.mockImplementation(() => {
      throw new Error("network stack exploded");
    });

    // Navigation must not break because analytics did.
    expect(() => {
      for (let i = 0; i < TELEMETRY_BATCH_SIZE; i++) track(`event_${i}`);
    }).not.toThrow();
  });

  it("track() returns synchronously — it never awaits the network", () => {
    let resolveFetch: (() => void) | undefined;
    fetchMock.mockImplementation(
      () => new Promise<Response>((r) => {
        resolveFetch = () => r(new Response(null, { status: 204 }));
      }),
    );

    for (let i = 0; i < TELEMETRY_BATCH_SIZE; i++) track(`event_${i}`);

    // The flush is in flight and unresolved, yet the queue is already clear
    // and control returned. Nothing downstream can be blocked by it.
    expect(__telemetryQueueSize()).toBe(0);
    expect(resolveFetch).toBeTypeOf("function");
  });
});

describe("unload", () => {
  it("uses sendBeacon when flushing on the way out", () => {
    track("a");
    flushTelemetry(true);

    expect(beaconMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to fetch when the beacon is refused", () => {
    beaconMock.mockReturnValue(false);
    track("a");
    flushTelemetry(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when the queue is empty", () => {
    flushTelemetry(true);
    expect(beaconMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("kill switches", () => {
  it("NEXT_PUBLIC_TELEMETRY_ENABLED=0 makes track() completely inert", () => {
    vi.stubEnv("NEXT_PUBLIC_TELEMETRY_ENABLED", "0");

    for (let i = 0; i < TELEMETRY_BATCH_SIZE * 2; i++) track(`event_${i}`);
    vi.advanceTimersByTime(TELEMETRY_FLUSH_IDLE_MS * 10);

    // Nothing queued, nothing sent, no timer armed. Turning telemetry off must
    // SHED load, never restore one-request-per-event.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(beaconMock).not.toHaveBeenCalled();
    expect(__telemetryQueueSize()).toBe(0);
  });

  it("NEXT_PUBLIC_TELEMETRY_BATCH_ENABLED=0 restores one request per event", () => {
    vi.stubEnv("NEXT_PUBLIC_TELEMETRY_BATCH_ENABLED", "0");

    track("a");
    track("b");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Old wire shape: a bare event, no `events` array.
    const body = bodyOf(fetchMock.mock.calls[0]);
    expect(body.event).toBe("a");
    expect(body.events).toBeUndefined();
  });

  it("an UNSET flag means enabled — a missing env cannot blind the funnel", () => {
    track("a");
    vi.advanceTimersByTime(TELEMETRY_FLUSH_IDLE_MS + 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("server rejection (413) — still no re-queue", () => {
  it("drops a batch the server refuses as too large", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 413 })),
    );

    for (let i = 0; i < TELEMETRY_BATCH_SIZE; i++) track(`event_${i}`);
    await vi.runAllTimersAsync();

    // A 413 is a permanent rejection: retrying the identical body would fail
    // identically, forever. One attempt, then gone.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(__telemetryQueueSize()).toBe(0);
  });

  it("never sends more than the server's batch limit in one request", async () => {
    // Sustained traffic with every flush failing — the worst case for request
    // size. The server refuses >20 with a 413, so exceeding it here would mean
    // silently losing whole batches in production.
    fetchMock.mockImplementation(() => Promise.reject(new Error("522")));
    for (let i = 0; i < 45; i++) track(`unique_${i}`);
    await vi.runAllTimersAsync();

    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    for (const call of fetchMock.mock.calls) {
      const events = bodyOf(call).events as unknown[];
      expect(events.length).toBeLessThanOrEqual(TELEMETRY_BATCH_SIZE);
    }
  });
});
