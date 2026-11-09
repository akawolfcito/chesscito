import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useClaimQueue } from "@/hooks/use-claim-queue";

// Mock the underlying claim sources so the hook is testable in isolation
vi.mock("@/lib/claims/sources", () => ({
  readClaimSources: vi.fn(async () => ({
    localBadgesEarned: [1n],
    badgesOnChain: [],
    localScoresPending: [{ scoreKey: "rook-l3", points: 540 }],
    victoryPending: [],
  })),
}));

vi.mock("@/lib/claims/actions", () => ({
  performClaim: vi.fn(async () => ({ ok: true, txHash: "0xabc" })),
}));

describe("useClaimQueue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty claims when address is undefined", async () => {
    const { result } = renderHook(() => useClaimQueue(undefined));
    expect(result.current.claims).toEqual([]);
  });

  it("computes claims when address is set", async () => {
    const { result } = renderHook(() =>
      useClaimQueue("0x0924abcdef1234567890abcdef1234567890eba4"),
    );
    await waitFor(() => expect(result.current.claims.length).toBe(2));
  });

  it("optimistically removes a claim after claimOne resolves", async () => {
    const { result } = renderHook(() =>
      useClaimQueue("0x0924abcdef1234567890abcdef1234567890eba4"),
    );
    await waitFor(() => expect(result.current.claims.length).toBe(2));

    await act(async () => {
      await result.current.claimOne(result.current.claims[0]);
    });

    expect(result.current.claims).toHaveLength(1);
  });

  it("uses opts.performClaim over the default when provided", async () => {
    const injected = vi.fn(async () => ({ ok: true as const, txHash: "0xdef" as const }));
    const { result } = renderHook(() =>
      useClaimQueue("0x0924abcdef1234567890abcdef1234567890eba4", { performClaim: injected }),
    );
    await waitFor(() => expect(result.current.claims.length).toBe(2));

    await act(async () => {
      await result.current.claimOne(result.current.claims[0]);
    });

    expect(injected).toHaveBeenCalledTimes(1);
    expect(injected).toHaveBeenCalledWith(expect.objectContaining({ kind: "badge" }));
    expect(result.current.claims).toHaveLength(1);
  });
});
