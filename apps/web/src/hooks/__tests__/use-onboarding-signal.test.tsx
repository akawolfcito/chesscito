import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ─── Hoisted mocks (run before the hook module imports) ─────────────
const readDisplayedShieldsMock = vi.hoisted(() => vi.fn(() => 0));
vi.mock("@/lib/shop/shield-storage", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/shop/shield-storage")
  >("@/lib/shop/shield-storage");
  return {
    ...actual,
    readDisplayedShields: readDisplayedShieldsMock,
  };
});

const readContractMock = vi.hoisted(() => vi.fn());
vi.mock("wagmi", () => ({
  useChainId: () => 42220,
  usePublicClient: () => ({ readContract: readContractMock }),
}));

vi.mock("@/lib/contracts/chains", () => ({
  getBadgesAddress: () =>
    "0xf92759E5525763554515DD25E7650f72204a6739" as `0x${string}`,
}));

import { useOnboardingSignal } from "../use-onboarding-signal";

const WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd" as const;
const CACHE_KEY = `chesscito:onboarding-signal:${WALLET.toLowerCase()}`;

function mockFetchResponses(map: Record<string, unknown>) {
  global.fetch = vi.fn((url: RequestInfo | URL) => {
    const href = typeof url === "string" ? url : url.toString();
    for (const path of Object.keys(map)) {
      if (href.includes(path)) {
        return Promise.resolve(
          new Response(JSON.stringify(map[path]), { status: 200 }),
        );
      }
    }
    return Promise.resolve(new Response("not mocked", { status: 404 }));
  }) as typeof fetch;
}

describe("useOnboardingSignal", () => {
  beforeEach(() => {
    window.localStorage.clear();
    readDisplayedShieldsMock.mockReturnValue(0);
    readContractMock.mockReset();
    mockFetchResponses({
      "/api/pro/status": { active: false, expiresAt: null },
      "/api/founder-status": { ownsFounder: false, since: null },
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it("returns fresh status when no wallet is connected", () => {
    const { result } = renderHook(() => useOnboardingSignal(undefined));
    expect(result.current.status).toBe("fresh");
    expect(result.current.signal).toBeNull();
  });

  it("returns the cached result synchronously when localStorage has a valid entry", () => {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        status: "returning",
        signal: "founder",
        cachedAt: Date.now(),
      }),
    );
    const { result } = renderHook(() => useOnboardingSignal(WALLET));
    expect(result.current.status).toBe("returning");
    expect(result.current.signal).toBe("founder");
    // No network calls
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("ignores expired cache entries and refreshes", async () => {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        status: "returning",
        signal: "founder",
        cachedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
      }),
    );
    readContractMock.mockResolvedValue(false);
    const { result } = renderHook(() => useOnboardingSignal(WALLET));

    await waitFor(() => {
      expect(result.current.status).toBe("fresh");
    });
  });

  it("commits returning via shield signal (localStorage sync — wins instantly)", () => {
    readDisplayedShieldsMock.mockReturnValueOnce(3);
    const { result } = renderHook(() => useOnboardingSignal(WALLET));
    // Shield is sync — no waitFor needed, signal commits in the same render cycle.
    expect(result.current.status).toBe("returning");
    expect(result.current.signal).toBe("shield");
    // Cache written
    const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "{}");
    expect(cached.signal).toBe("shield");
  });

  it("commits returning via PRO when /api/pro/status returns active=true", async () => {
    mockFetchResponses({
      "/api/pro/status": { active: true, expiresAt: Date.now() + 86400000 },
      "/api/founder-status": { ownsFounder: false, since: null },
    });
    readContractMock.mockResolvedValue(false);
    const { result } = renderHook(() => useOnboardingSignal(WALLET));

    await waitFor(() => {
      expect(result.current.status).toBe("returning");
    });
    expect(result.current.signal).toBe("pro");
  });

  it("commits returning via founder when /api/founder-status returns ownsFounder=true", async () => {
    mockFetchResponses({
      "/api/pro/status": { active: false },
      "/api/founder-status": { ownsFounder: true, since: 50_000_000 },
    });
    readContractMock.mockResolvedValue(false);
    const { result } = renderHook(() => useOnboardingSignal(WALLET));

    await waitFor(() => {
      expect(result.current.status).toBe("returning");
    });
    expect(result.current.signal).toBe("founder");
  });

  it("commits returning via badge when hasClaimedBadge(player, 1n) is true", async () => {
    readContractMock.mockResolvedValue(true);
    const { result } = renderHook(() => useOnboardingSignal(WALLET));

    await waitFor(() => {
      expect(result.current.status).toBe("returning");
    });
    expect(result.current.signal).toBe("badge");
  });

  it("settles fresh when ALL signals resolve negative", async () => {
    readContractMock.mockResolvedValue(false);
    const { result } = renderHook(() => useOnboardingSignal(WALLET));

    await waitFor(() => {
      expect(result.current.status).toBe("fresh");
    });
    expect(result.current.signal).toBeNull();
  });

  it("settles fresh via fallback when the 2000ms budget expires before any read resolves", async () => {
    vi.useFakeTimers();
    // Reads that never resolve
    global.fetch = vi.fn(
      () => new Promise(() => {}),
    ) as typeof fetch;
    readContractMock.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useOnboardingSignal(WALLET));
    expect(result.current.status).toBe("resolving");

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(result.current.status).toBe("fresh");
    expect(result.current.signal).toBe("fallback");
  });
});
