import { describe, it, expect } from "vitest";
import { computePendingClaims, type ClaimQueueState } from "@/lib/claims/queue";

const baseState: ClaimQueueState = {
  address: "0x1234" as `0x${string}`,
  // Badge thresholds met locally:
  localBadgesEarned: [],
  // Badge mints already on chain:
  badgesOnChain: [],
  // Local scores ready to push:
  localScoresPending: [],
  // Optimistic removals (claims confirmed by user, not yet on chain):
  optimisticRemoved: new Set<string>(),
  // Victory NFTs waiting:
  victoryPending: [],
};

describe("computePendingClaims", () => {
  it("returns empty array when nothing is pending", () => {
    expect(computePendingClaims(baseState)).toEqual([]);
  });

  it("emits a badge claim when threshold met but not on-chain", () => {
    const result = computePendingClaims({
      ...baseState,
      localBadgesEarned: [1n],
      badgesOnChain: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: "badge", id: "badge-1", costGasOnly: true });
  });

  it("DOES NOT emit a badge claim when chain says claimed (chain dominates)", () => {
    const result = computePendingClaims({
      ...baseState,
      localBadgesEarned: [1n],
      badgesOnChain: [1n],
    });
    expect(result).toEqual([]);
  });

  it("emits a score claim for each locally pending score", () => {
    const result = computePendingClaims({
      ...baseState,
      localScoresPending: [{ scoreKey: "rook-l3", points: 540 }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: "score", id: "score-rook-l3", costGasOnly: true });
  });

  it("emits a victory-nft claim for each victory pending under 24h", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const result = computePendingClaims({
      ...baseState,
      victoryPending: [{ txHash: "0xabc", difficulty: 3, mintedAt: nowSec - 60 }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: "victory-nft", costGasOnly: false });
  });

  it("DROPS victory-nft claim older than 24h", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const result = computePendingClaims({
      ...baseState,
      victoryPending: [{ txHash: "0xabc", difficulty: 3, mintedAt: nowSec - 25 * 3600 }],
    });
    expect(result).toEqual([]);
  });

  it("excludes optimistically removed entries", () => {
    const result = computePendingClaims({
      ...baseState,
      localBadgesEarned: [1n],
      optimisticRemoved: new Set(["badge-1"]),
    });
    expect(result).toEqual([]);
  });

  it("returns empty list when address is undefined (cannot claim without wallet)", () => {
    const result = computePendingClaims({
      ...baseState,
      address: undefined,
      localBadgesEarned: [1n],
    });
    expect(result).toEqual([]);
  });
});
