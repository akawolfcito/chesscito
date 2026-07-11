import { beforeEach, describe, expect, it, vi } from "vitest";

import { subscribeToShieldChanges } from "@/lib/shop/shield-events";
import {
  readCreditedCache,
  writeCreditedCache,
} from "@/lib/shop/shield-storage";
import {
  applyServerCredited,
  syncShieldsFromServer,
} from "@/lib/shop/shield-sync";

const WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd" as const;

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("syncShieldsFromServer", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("mirrors the server credited counter into the local cache and notifies subscribers", async () => {
    const seen = vi.fn();
    const unsubscribe = subscribeToShieldChanges(seen);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse({ ok: true, credited: 6 }),
    );

    const credited = await syncShieldsFromServer(WALLET);

    expect(credited).toBe(6);
    expect(readCreditedCache()).toBe(6);
    expect(seen).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("reads the counter for the given wallet", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okResponse({ ok: true, credited: 3 }));

    await syncShieldsFromServer(WALLET);

    expect(fetchSpy).toHaveBeenCalledWith(
      `/api/shields/me?wallet=${encodeURIComponent(WALLET)}`,
    );
  });

  it("leaves the cached counter untouched when the read fails", async () => {
    writeCreditedCache(3);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 500 }),
    );

    expect(await syncShieldsFromServer(WALLET)).toBeNull();
    expect(readCreditedCache()).toBe(3);
  });

  it("survives a network throw without clobbering the cache", async () => {
    writeCreditedCache(3);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    expect(await syncShieldsFromServer(WALLET)).toBeNull();
    expect(readCreditedCache()).toBe(3);
  });
});

describe("applyServerCredited", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("caches an absolute counter the server already handed us and notifies", () => {
    const seen = vi.fn();
    const unsubscribe = subscribeToShieldChanges(seen);

    applyServerCredited(3);

    expect(readCreditedCache()).toBe(3);
    expect(seen).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
