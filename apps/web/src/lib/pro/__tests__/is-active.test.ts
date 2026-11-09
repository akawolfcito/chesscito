import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const redisMock = vi.hoisted(() => ({
  get: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => redisMock },
}));

import { isProActive } from "../is-active";

const CHECKSUM_WALLET = "0xCc4179a22B473eA2eb2b9b9b210458D0F60Fc2dd";
const LOWER_WALLET = CHECKSUM_WALLET.toLowerCase();
const PRO_KEY = `coach:pro:${LOWER_WALLET}`;

describe("isProActive", () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    redisMock.get.mockReset();
    vi.spyOn(Date, "now").mockReturnValue(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns active when expiresAt is in the future", async () => {
    const expiresAt = NOW + 5 * 24 * 60 * 60 * 1000;
    redisMock.get.mockResolvedValue(String(expiresAt));

    const result = await isProActive(CHECKSUM_WALLET);
    expect(result).toEqual({ active: true, expiresAt });
    expect(redisMock.get).toHaveBeenCalledWith(PRO_KEY);
  });

  it("returns inactive when the key does not exist", async () => {
    redisMock.get.mockResolvedValue(null);

    const result = await isProActive(CHECKSUM_WALLET);
    expect(result).toEqual({ active: false, expiresAt: null });
  });

  it("returns inactive when expiresAt is in the past (lapsed but not yet purged)", async () => {
    const expiresAt = NOW - 1;
    redisMock.get.mockResolvedValue(String(expiresAt));

    const result = await isProActive(CHECKSUM_WALLET);
    expect(result).toEqual({ active: false, expiresAt });
  });

  it("returns inactive with null expiresAt when Redis returns a non-numeric string", async () => {
    redisMock.get.mockResolvedValue("not-a-number");

    const result = await isProActive(CHECKSUM_WALLET);
    expect(result).toEqual({ active: false, expiresAt: null });
  });

  it("normalizes the wallet to lowercase before hitting Redis", async () => {
    redisMock.get.mockResolvedValue(null);

    await isProActive(CHECKSUM_WALLET);
    expect(redisMock.get).toHaveBeenCalledWith(PRO_KEY);
    expect(redisMock.get).not.toHaveBeenCalledWith(`coach:pro:${CHECKSUM_WALLET}`);
  });

  it("accepts a numeric value from Redis (Upstash sometimes deserializes integers)", async () => {
    const expiresAt = NOW + 1000;
    redisMock.get.mockResolvedValue(expiresAt);

    const result = await isProActive(CHECKSUM_WALLET);
    expect(result).toEqual({ active: true, expiresAt });
  });
});
