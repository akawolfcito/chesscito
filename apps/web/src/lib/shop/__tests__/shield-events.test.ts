import { afterEach, describe, expect, it, vi } from "vitest";

import {
  dispatchShieldChange,
  subscribeToShieldChanges,
} from "@/lib/shop/shield-events";

describe("shield-events", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dispatch + subscribe: handler fires once per dispatch", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToShieldChanges(handler);

    dispatchShieldChange();
    expect(handler).toHaveBeenCalledTimes(1);

    dispatchShieldChange();
    expect(handler).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it("unsubscribe removes the listener", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToShieldChanges(handler);

    unsubscribe();
    dispatchShieldChange();

    expect(handler).not.toHaveBeenCalled();
  });

  it("multiple subscribers each receive the event", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unA = subscribeToShieldChanges(a);
    const unB = subscribeToShieldChanges(b);

    dispatchShieldChange();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    unA();
    unB();
  });
});
