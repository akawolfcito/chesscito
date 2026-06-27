import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { useHubData } from "@/components/hub/use-hub-data";

// useHubData fans out to wagmi reads + two app hooks. Stub them so the hook
// mounts in isolation; localStorage-backed loaders return their natural
// empty defaults under jsdom.
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useChainId: () => 42220,
  useReadContracts: () => ({ data: undefined }),
}));

vi.mock("@/lib/season-pass/use-season-pass-status", () => ({
  useSeasonPassStatus: () => ({ active: false, isLoading: false, refresh: vi.fn() }),
}));

vi.mock("@/lib/welcome-package/use-welcome-package", () => ({
  useWelcomePackage: () => ({ isUnlocked: false, isClaimed: false }),
}));

describe("useHubData", () => {
  it("returns shared guest defaults and the season challenge meta", () => {
    const { result } = renderHook(() => useHubData());

    expect(result.current.shared.isConnected).toBe(false);
    expect(result.current.shared.trophies).toBe(0);
    expect(result.current.shared.starsPerPiece).toEqual({});

    // challenge meta is pure config — always available regardless of mode.
    expect(result.current.lite.challenge.durationDays).toBe(21);
    expect(result.current.lite.challenge.shieldBonus).toBe(3);

    // Lite-gated data is null when CHESSCITO_LITE_MODE is off (test default).
    expect(result.current.lite.focusPassport).toBeNull();
  });
});
