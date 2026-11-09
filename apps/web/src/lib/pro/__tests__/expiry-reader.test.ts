import { describe, expect, it, vi } from "vitest";
import { readProStatus, type ProExpiryReader } from "../expiry-reader";

const WALLET = `0x${"AB".repeat(20)}`;
const NOW = 1_700_000_000_000;

describe("PRO expiry storage contract", () => {
  it.each([
    [null, false, null],
    [NOW + 1, true, NOW + 1],
    [String(NOW + 1), true, NOW + 1],
    [NOW, false, NOW],
    [NOW - 1, false, NOW - 1],
    ["invalid", false, null],
    [Number.NaN, false, null],
    [Number.POSITIVE_INFINITY, false, null],
  ])("preserves the status of stored expiry %s", async (raw, active, expiresAt) => {
    const reader: ProExpiryReader = { getExpiresAt: async () => raw };
    expect(await readProStatus(reader, WALLET, () => NOW)).toEqual({ active, expiresAt });
  });

  it("uses one normalized account for any storage backend", async () => {
    const getExpiresAt = vi.fn().mockResolvedValue(null);
    await readProStatus({ getExpiresAt }, WALLET, () => NOW);
    expect(getExpiresAt).toHaveBeenCalledExactlyOnceWith(WALLET.toLowerCase());
  });

  it("preserves backend failure instead of reporting that PRO is inactive", async () => {
    const error = new Error("store unavailable");
    const reader: ProExpiryReader = { getExpiresAt: async () => { throw error; } };
    await expect(readProStatus(reader, WALLET, () => NOW)).rejects.toBe(error);
  });

  it("checks expiry after a slow read completes", async () => {
    let clock = NOW;
    let resolve!: (expiry: number) => void;
    const reader: ProExpiryReader = {
      getExpiresAt: () => new Promise((done) => { resolve = done; }),
    };
    const status = readProStatus(reader, WALLET, () => clock);
    clock += 2;
    resolve(NOW + 1);
    expect(await status).toEqual({ active: false, expiresAt: NOW + 1 });
  });
});
