import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const TEST_WALLET = "0x000000000000000000000000000000000000abcd";
const BADGES_ADDRESS = "0x0000000000000000000000000000000000000bad6";

const useAccountMock = vi.hoisted(() =>
  vi.fn(
    () =>
      ({ address: TEST_WALLET, isConnected: true }) as {
        address: string | undefined;
        isConnected: boolean;
      },
  ),
);
const useChainIdMock = vi.hoisted(() => vi.fn(() => 42220));
const useReadContractsMock = vi.hoisted(() =>
  vi.fn(() => ({
    data: undefined as
      | undefined
      | { result?: boolean | undefined; status?: string }[],
    refetch: vi.fn(),
  })),
);
const writeContractAsyncMock = vi.hoisted(() => vi.fn());
const useWriteContractMock = vi.hoisted(() =>
  vi.fn(() => ({
    writeContractAsync: writeContractAsyncMock,
    isPending: false,
  })),
);
const trackMock = vi.hoisted(() => vi.fn());
const hapticSuccessMock = vi.hoisted(() => vi.fn());
const navigateToTrophiesMock = vi.hoisted(() => vi.fn());

vi.mock("wagmi", () => ({
  useAccount: () => useAccountMock(),
  useChainId: () => useChainIdMock(),
  useReadContracts: () => useReadContractsMock(),
  useWriteContract: () => useWriteContractMock(),
}));

vi.mock("@/lib/contracts/chains", () => ({
  getBadgesAddress: () => BADGES_ADDRESS,
  getConfiguredChainId: () => 42220,
  getMiniPayFeeCurrency: () => undefined,
}));

vi.mock("@/lib/contracts/badges", () => ({
  badgesAbi: [] as const,
}));

vi.mock("@/lib/contracts/scoreboard", () => ({
  getLevelId: (piece: string) => {
    const ids: Record<string, bigint> = {
      rook: 1n,
      bishop: 2n,
      knight: 3n,
      pawn: 4n,
      queen: 5n,
      king: 6n,
    };
    return ids[piece] ?? 0n;
  },
}));

vi.mock("@/lib/telemetry", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

vi.mock("@/lib/haptics", () => ({
  hapticSuccess: () => hapticSuccessMock(),
}));

vi.mock("@/lib/errors", () => ({
  isUserCancellation: (err: unknown) =>
    err instanceof Error && err.message.includes("User rejected"),
}));

import { useBadgeSheetState } from "../use-badge-sheet-state";

beforeEach(() => {
  useAccountMock.mockReset();
  useChainIdMock.mockReset();
  useReadContractsMock.mockReset();
  writeContractAsyncMock.mockReset();
  useWriteContractMock.mockReset();
  trackMock.mockReset();
  hapticSuccessMock.mockReset();
  navigateToTrophiesMock.mockReset();

  useAccountMock.mockReturnValue({ address: TEST_WALLET, isConnected: true });
  useChainIdMock.mockReturnValue(42220);
  useReadContractsMock.mockReturnValue({
    data: undefined,
    refetch: vi.fn(),
  });
  useWriteContractMock.mockReturnValue({
    writeContractAsync: writeContractAsyncMock,
    isPending: false,
  });

  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useBadgeSheetState — open/close", () => {
  it("starts closed; openSheet flips open=true on sheetProps", () => {
    const { result } = renderHook(() =>
      useBadgeSheetState({ onNavigateToTrophies: navigateToTrophiesMock }),
    );
    expect(result.current.open).toBe(false);
    expect(result.current.sheetProps.open).toBe(false);

    act(() => {
      result.current.openSheet();
    });
    expect(result.current.open).toBe(true);
    expect(result.current.sheetProps.open).toBe(true);
  });

  it("closeSheet is a no-op while a claim is in flight (isClaimBusy)", async () => {
    // Hold the writeContractAsync promise so claimingPiece stays set.
    let resolveTx: (hash: string) => void = () => {};
    writeContractAsyncMock.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveTx = resolve;
        }),
    );
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nonce: "1",
        deadline: "9999999999",
        signature: "0xsig",
      }),
    });

    const { result } = renderHook(() =>
      useBadgeSheetState({ onNavigateToTrophies: navigateToTrophiesMock }),
    );
    act(() => {
      result.current.openSheet();
    });

    // Fire claim — does NOT await; the in-flight tx promise is parked.
    act(() => {
      result.current.sheetProps.onClaim("rook");
    });

    await waitFor(() => {
      expect(result.current.sheetProps.isClaimBusy).toBe(true);
    });

    act(() => {
      result.current.closeSheet();
    });
    // Sheet must NOT close while a claim is in flight — the user would
    // lose the tx-pending feedback otherwise.
    expect(result.current.open).toBe(true);

    // Drain the parked tx so the test fixture cleans up.
    resolveTx("0xtx");
    await waitFor(() => {
      expect(result.current.sheetProps.isClaimBusy).toBe(false);
    });
  });
});

describe("useBadgeSheetState — handleClaim", () => {
  it("returns early without telemetry when wallet is missing", async () => {
    useAccountMock.mockReturnValue({ address: undefined, isConnected: false });
    const { result } = renderHook(() =>
      useBadgeSheetState({ onNavigateToTrophies: navigateToTrophiesMock }),
    );

    await act(async () => {
      result.current.sheetProps.onClaim("rook");
    });

    expect(trackMock).not.toHaveBeenCalled();
    expect(writeContractAsyncMock).not.toHaveBeenCalled();
  });

  it("happy path: signs, writes, fires success telemetry, refetches badges", async () => {
    const refetchSpy = vi.fn();
    useReadContractsMock.mockReturnValue({
      data: [
        { result: false, status: "success" },
        { result: false, status: "success" },
        { result: false, status: "success" },
        { result: false, status: "success" },
        { result: false, status: "success" },
        { result: false, status: "success" },
      ],
      refetch: refetchSpy,
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nonce: "7",
        deadline: "9999999999",
        signature: "0xsig",
      }),
    });
    writeContractAsyncMock.mockResolvedValueOnce("0xclaim");

    const { result } = renderHook(() =>
      useBadgeSheetState({ onNavigateToTrophies: navigateToTrophiesMock }),
    );

    await act(async () => {
      result.current.sheetProps.onClaim("bishop");
    });

    await waitFor(() => {
      expect(result.current.sheetProps.isClaimBusy).toBe(false);
    });

    expect(trackMock).toHaveBeenCalledWith("badge_claim_tx", {
      stage: "start",
      piece: "bishop",
    });
    expect(trackMock).toHaveBeenCalledWith("badge_claim_tx", {
      stage: "success",
      piece: "bishop",
    });
    expect(hapticSuccessMock).toHaveBeenCalledTimes(1);
    expect(refetchSpy).toHaveBeenCalledTimes(1);
    expect(writeContractAsyncMock).toHaveBeenCalledTimes(1);
  });

  it("does not double-claim when the badge is already on-chain", async () => {
    useReadContractsMock.mockReturnValue({
      data: [
        { result: true, status: "success" },
        { result: false, status: "success" },
        { result: false, status: "success" },
        { result: false, status: "success" },
        { result: false, status: "success" },
        { result: false, status: "success" },
      ],
      refetch: vi.fn(),
    });

    const { result } = renderHook(() =>
      useBadgeSheetState({ onNavigateToTrophies: navigateToTrophiesMock }),
    );

    await act(async () => {
      result.current.sheetProps.onClaim("rook"); // already claimed (idx 0)
    });

    expect(writeContractAsyncMock).not.toHaveBeenCalled();
    // Skipped guard fires before telemetry — no `start` event.
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("on success: lastClaimedPiece is set then auto-clears after 2.5s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useReadContractsMock.mockReturnValue({
      data: Array.from({ length: 6 }, () => ({
        result: false,
        status: "success",
      })),
      refetch: vi.fn(),
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nonce: "1",
        deadline: "9999999999",
        signature: "0xsig",
      }),
    });
    writeContractAsyncMock.mockResolvedValueOnce("0xtx");

    const { result } = renderHook(() =>
      useBadgeSheetState({ onNavigateToTrophies: navigateToTrophiesMock }),
    );

    await act(async () => {
      result.current.sheetProps.onClaim("pawn");
    });

    await waitFor(() => {
      expect(result.current.sheetProps.lastClaimedPiece).toBe("pawn");
    });

    // Advance past the 2.5s celebration window — banner clears.
    await act(async () => {
      vi.advanceTimersByTime(2_600);
    });
    expect(result.current.sheetProps.lastClaimedPiece).toBeNull();
    vi.useRealTimers();
  });

  it("user cancellation: fires cancelled telemetry and clears claimingPiece", async () => {
    useReadContractsMock.mockReturnValue({
      data: Array.from({ length: 6 }, () => ({
        result: false,
        status: "success",
      })),
      refetch: vi.fn(),
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nonce: "1",
        deadline: "9999999999",
        signature: "0xsig",
      }),
    });
    writeContractAsyncMock.mockRejectedValueOnce(
      new Error("User rejected the request"),
    );

    const { result } = renderHook(() =>
      useBadgeSheetState({ onNavigateToTrophies: navigateToTrophiesMock }),
    );

    await act(async () => {
      result.current.sheetProps.onClaim("knight");
    });

    await waitFor(() => {
      expect(result.current.sheetProps.isClaimBusy).toBe(false);
    });
    expect(trackMock).toHaveBeenCalledWith("badge_claim_tx", {
      stage: "cancelled",
      piece: "knight",
    });
    // No success telemetry — explicit guard against the cancelled path
    // accidentally firing the success event.
    expect(
      trackMock.mock.calls.find(
        (c) => c[0] === "badge_claim_tx" && (c[1] as { stage: string })?.stage === "success",
      ),
    ).toBeUndefined();
  });
});

describe("useBadgeSheetState — sheetProps shape", () => {
  it("forwards onNavigateToTrophies verbatim so the sheet's footer link wires correctly", () => {
    const { result } = renderHook(() =>
      useBadgeSheetState({ onNavigateToTrophies: navigateToTrophiesMock }),
    );
    expect(result.current.sheetProps.onNavigateToTrophies).toBe(
      navigateToTrophiesMock,
    );
  });

  it("derives badgesClaimed from useReadContracts results, mapping by index→piece", () => {
    useReadContractsMock.mockReturnValue({
      data: [
        { result: true, status: "success" }, // rook
        { result: false, status: "success" }, // bishop
        { result: true, status: "success" }, // knight
        { result: false, status: "success" }, // pawn
        { result: undefined, status: "failure" }, // queen → undefined
        { result: false, status: "success" }, // king
      ],
      refetch: vi.fn(),
    });

    const { result } = renderHook(() =>
      useBadgeSheetState({ onNavigateToTrophies: navigateToTrophiesMock }),
    );

    expect(result.current.sheetProps.badgesClaimed).toEqual({
      rook: true,
      bishop: false,
      knight: true,
      pawn: false,
      queen: undefined,
      king: false,
    });
  });
});
