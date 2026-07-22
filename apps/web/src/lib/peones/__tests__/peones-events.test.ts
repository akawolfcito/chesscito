/**
 * Tests for peones-events — the in-tab balance-change signal.
 *
 * Mirrors `lib/shop/shield-events.test.ts` because the bus is the same
 * primitive: a `CustomEvent` on `window` so that a write on one surface
 * (a spend in the action row) can tell a read on another (the balance
 * chip in the tray) to re-read the server.
 *
 * The bus carries NO payload on purpose. The endpoint stays the single
 * source of truth; this only says "go look again".
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  dispatchPeonesChange,
  subscribeToPeonesChanges,
} from "@/lib/peones/peones-events";

describe("peones-events", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dispatch + subscribe: handler fires once per dispatch", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToPeonesChanges(handler);

    dispatchPeonesChange();
    expect(handler).toHaveBeenCalledTimes(1);

    dispatchPeonesChange();
    expect(handler).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it("unsubscribe removes the listener", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToPeonesChanges(handler);

    unsubscribe();
    dispatchPeonesChange();

    expect(handler).not.toHaveBeenCalled();
  });

  it("multiple subscribers each receive the event", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unA = subscribeToPeonesChanges(a);
    const unB = subscribeToPeonesChanges(b);

    dispatchPeonesChange();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    unA();
    unB();
  });

  it("does not collide with the shields bus", async () => {
    const { dispatchShieldChange } = await import("@/lib/shop/shield-events");
    const peonesHandler = vi.fn();
    const unsubscribe = subscribeToPeonesChanges(peonesHandler);

    dispatchShieldChange();

    expect(peonesHandler).not.toHaveBeenCalled();
    unsubscribe();
  });
});
