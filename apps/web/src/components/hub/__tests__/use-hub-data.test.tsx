import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { useHubData } from "@/components/hub/use-hub-data";
import { EXERCISES } from "@/lib/game/exercises";
import { pieceProgressStorageKey } from "@/lib/lite-progress-storage";

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
  afterEach(() => {
    window.localStorage.clear();
  });

  // Paso 2 — docs/specs/2026-08-09-hub-tile-progress-counter.md
  it("exposes the id-keyed stars map and flags hydration once mounted", () => {
    const firstRookId = EXERCISES.rook[0].id;
    window.localStorage.setItem(
      pieceProgressStorageKey("rook"),
      JSON.stringify({ stars: { [firstRookId]: 2 } }),
    );

    const { result } = renderHook(() => useHubData());

    // The counter must not assert a number before the mount effect ran; by
    // the time renderHook returns, effects have flushed.
    expect(result.current.shared.isProgressHydrated).toBe(true);
    // Raw id→stars, NOT a total: the count is taken later by
    // `completedExerciseCount`, which intersects with the live catalog so the
    // tile agrees with the drawer.
    expect(result.current.shared.starsByIdPerPiece.rook).toEqual({
      [firstRookId]: 2,
    });
  });

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
