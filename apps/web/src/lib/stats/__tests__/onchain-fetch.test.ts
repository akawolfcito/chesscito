import { describe, it, expect } from "vitest";

import { fetchOnchainStats } from "../onchain";
import { ACCEPTED_TOKENS } from "@/lib/contracts/tokens";

const USDC = ACCEPTED_TOKENS.find((t) => t.symbol === "USDC")!;

/**
 * Thenable supporting the chainable Supabase calls fetchOnchainStats
 * uses: .select(...).eq(...).gte(...).range(...). Resolves to the given
 * fixture regardless of how many qualifiers are appended.
 */
type QueryFixture = { count?: number | null; data?: unknown[] | null; error?: unknown };

function thenable(fixture: QueryFixture) {
  const value = {
    count: fixture.count ?? null,
    data: fixture.data ?? null,
    error: fixture.error,
  };
  const obj: Record<string, unknown> = {
    then: (resolve: (v: typeof value) => unknown) => Promise.resolve(value).then(resolve),
    eq: () => obj,
    gte: () => obj,
    order: () => obj,
    limit: () => obj,
    range: () => obj,
  };
  return obj;
}

/** Sequences one fixture per `.from(...)` call, in the order
 *  fetchOnchainStats issues them (15 queries — see the spec contract). */
function buildStub(fixtures: QueryFixture[]) {
  const calls = [...fixtures];
  return {
    from: () => ({
      select: () => thenable(calls.shift() ?? { count: null, data: null }),
    }),
  } as never;
}

/** base-unit string for `human` USDC (6 dp). */
function usdcUnits(human: number): string {
  return (BigInt(Math.round(human * 100)) * 10n ** 4n).toString();
}

// Query order: 0-2 victories counts, 3 victories players, 4-6 pack counts,
// 7 pack rows (wallet+metadata), 8-10 scores counts, 11 scores players,
// 12-14 welcome counts.
function happyFixtures(): QueryFixture[] {
  return [
    { count: 50 }, // 0 victories lifetime
    { count: 12 }, // 1 victories 30d
    { count: 4 }, // 2 victories 7d
    { data: [{ player: "0xAAA" }, { player: "0xbbb" }] }, // 3 victory players
    { count: 9 }, // 4 pack lifetime
    { count: 3 }, // 5 pack 30d
    { count: 1 }, // 6 pack 7d
    {
      data: [
        { wallet: "0xbbb", metadata: { token: USDC.address, amountPaid: usdcUnits(0.5) } },
        { wallet: "0xccc", metadata: { token: USDC.address, amountPaid: usdcUnits(1) } },
      ],
    }, // 7 pack rows (volume 1.5 USDC; union wallets bbb,ccc)
    { count: 20 }, // 8 scores lifetime
    { count: 6 }, // 9 scores 30d
    { count: 2 }, // 10 scores 7d
    { data: [{ player: "0xccc" }, { player: "0xddd" }] }, // 11 score players
    { count: 100 }, // 12 welcome lifetime
    { count: 15 }, // 13 welcome 30d
    { count: 5 }, // 14 welcome 7d
  ];
}

describe("fetchOnchainStats", () => {
  it("composes method counts, volume, and the distinct-wallet union (happy path)", async () => {
    const stats = await fetchOnchainStats(buildStub(happyFixtures()));

    expect(stats.methodTx.victoryMints).toEqual({ lifetime: 50, last30d: 12, last7d: 4 });
    expect(stats.methodTx.packPurchases).toEqual({ lifetime: 9, last30d: 3, last7d: 1 });
    expect(stats.methodTx.scoreSaves).toEqual({ lifetime: 20, last30d: 6, last7d: 2 });
    expect(stats.methodTx.welcomePackClaims).toEqual({ lifetime: 100, last30d: 15, last7d: 5 });

    expect(stats.getPeonesVolume.usdc).toBe(1.5);

    // Union of victory players {aaa,bbb} ∪ pack wallets {bbb,ccc} ∪
    // score players {ccc,ddd} = {aaa,bbb,ccc,ddd} = 4 distinct.
    expect(stats.uniqueOnchainUsersLifetime).toBe(4);

    // Roadmap fields stay literal-null.
    expect(stats.networkFeesPaidUsd).toBeNull();
    expect(stats.failedTxRate).toBeNull();
  });

  it("nulls only the failed count, keeping siblings intact", async () => {
    const fx = happyFixtures();
    fx[1] = { count: null, error: new Error("boom") }; // victories 30d FAILS
    const stats = await fetchOnchainStats(buildStub(fx));

    expect(stats.methodTx.victoryMints.last30d).toBeNull();
    expect(stats.methodTx.victoryMints.lifetime).toBe(50); // sibling OK
    expect(stats.methodTx.packPurchases.lifetime).toBe(9); // other method OK
  });

  it("pack-rows failure → volume all-null AND union null (B source failed)", async () => {
    const fx = happyFixtures();
    fx[7] = { data: null, error: new Error("pack scan fail") };
    const stats = await fetchOnchainStats(buildStub(fx));

    expect(stats.getPeonesVolume).toEqual({ usdc: null, usdt: null, cusd: null });
    expect(stats.uniqueOnchainUsersLifetime).toBeNull();
  });

  it("scores-players failure → union null (C source failed)", async () => {
    const fx = happyFixtures();
    fx[11] = { data: null, error: new Error("scores fail") };
    const stats = await fetchOnchainStats(buildStub(fx));

    expect(stats.uniqueOnchainUsersLifetime).toBeNull();
    // volume unaffected — it doesn't depend on scores
    expect(stats.getPeonesVolume.usdc).toBe(1.5);
  });
});
