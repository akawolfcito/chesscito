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
    expect(result.current.lite.challenge.shieldBonus).toBe(3);

    // Lite-gated data is null when CHESSCITO_LITE_MODE is off (test default).
    expect(result.current.lite.focusPassport).toBeNull();
  });

  // AC5 · discriminación 21≠30 — la meta y la ventana viajan a la tarjeta en
  // campos DISTINTOS, cada uno con su cifra. Es el consumidor donde el
  // typecheck no puede ayudar: los dos son `number` y cruzarlos compila.
  it("AC5 · discriminación 21≠30 — la meta es 21 y la ventana 30, sin cruzarse", () => {
    const { result } = renderHook(() => useHubData());
    const challenge = result.current.lite.challenge;

    expect(challenge.challengeGoalDays).toBe(21);
    expect(challenge.accessDurationDays).toBe(30);
    // Cruzados es el modo de falla real, y sin esta línea pasaría inadvertido.
    expect(challenge.challengeGoalDays).not.toBe(challenge.accessDurationDays);
  });
});
