import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { act, screen } from "@testing-library/react";

/**
 * Tour → first activity, wired end to end in the LEARN hub.
 *
 * Control keeps `tour → hub`. The variant opens the Daily Focus sheet this hub
 * already owns. What this file has to prove is not "a sheet opened" — it is
 * that the two arms are DISTINGUISHABLE, that nobody is forced into the
 * activity who should not be, and that nothing repeats.
 */

const trackMock = vi.hoisted(() => vi.fn());
const tourArgs = vi.hoisted(
  () => ({ current: null }) as {
    current: {
      onFinished?: (a: {
        outcome: "completed" | "skipped";
        replay: boolean;
      }) => void;
    } | null;
  },
);
const hubState = vi.hoisted(() => ({
  todayDone: false,
  streak: 0,
}));

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/telemetry", () => ({ track: trackMock }));
vi.mock("@/lib/feature-flags", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/feature-flags")>()),
  CHESSCITO_LITE_MODE: true,
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: undefined,
    isConnected: false,
    status: "disconnected",
  }),
}));
vi.mock("@/lib/wallet/use-connect-wallet", () => ({
  useConnectWallet: () => ({ connectWallet: vi.fn() }),
}));
vi.mock("@/lib/peones/use-peones-balance", () => ({
  usePeonesBalance: () => ({ state: { kind: "guest" }, refetch: vi.fn() }),
}));
vi.mock("@/lib/pro/use-pro-sheet-state", () => ({
  useProSheetState: () => ({
    openSheet: vi.fn(),
    proStatus: null,
    sheetProps: {},
  }),
}));
vi.mock("@/lib/pro/use-is-pro-active", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pro/use-is-pro-active")>()),
  useProEntitlement: () => ({ isPro: false, isLoading: false, source: null }),
}));
vi.mock("@/lib/badges/use-badge-sheet-state", () => ({
  useBadgeSheetState: () => ({ openSheet: vi.fn(), sheetProps: {} }),
}));
vi.mock("@/lib/shop/use-shop-sheet-state", () => ({
  useShopSheetState: () => ({
    openSheet: vi.fn(),
    sheetProps: {},
    confirmProps: {},
  }),
}));
vi.mock("@/hooks/use-claim-queue", () => ({ useClaimQueue: vi.fn() }));
vi.mock("@/lib/shop/use-shield-sync", () => ({ useShieldSync: vi.fn() }));
vi.mock("@/lib/content/catalog-context", () => ({
  useLabyrinthCatalog: () => [],
}));
vi.mock("@/lib/progression/use-milestone-seeding", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/progression/use-milestone-seeding")
  >()),
  useMilestoneSeeding: vi.fn(),
}));

// Capture the args the hub passes so the test can drive `onFinished` exactly
// as the real tour does, without rendering the tour itself.
vi.mock("@/components/hub/use-hub-tour", () => ({
  useHubTour: (args: Record<string, unknown>) => {
    tourArgs.current = args as never;
    return { open: false, includeDaily: false, finish: vi.fn(), replay: vi.fn() };
  },
}));

vi.mock("@/components/hub/use-hub-data", () => ({
  useHubData: () => ({
    shared: {
      address: undefined,
      isConnected: false,
      trophies: 0,
      badgesClaimed: {},
      starsPerPiece: {},
      completedPerPiece: {},
      shieldCount: 0,
      hero: null,
    },
    lite: {
      focusPassport: {
        streak: hubState.streak,
        totalCompleted: hubState.streak,
        todayDone: hubState.todayDone,
        isLoading: false,
      },
      contentLoop: { action: null, isHydrated: true, primaryPiece: "rook" },
      sessionQuota: { isAtFreeLimit: false, isAtHardMax: false },
      seasonPass: {
        active: false,
        source: null,
        loading: false,
        refresh: vi.fn(),
      },
      challengeSeasonPass: { active: false, isLoading: false },
      challenge: { durationDays: 21, shieldBonus: 3, priceLabel: "$1.99" },
    },
  }),
}));

vi.mock("@/components/profile/profile-sheet", () => ({
  ProfileSheet: () => null,
}));
vi.mock("@/components/hub/hub-daily-tile", () => ({
  HubDailyTile: ({
    open,
    onOpenChange,
  }: {
    open?: boolean;
    onOpenChange?: (next: boolean) => void;
  }) => (
    <>
      <button type="button" data-testid="daily" data-open={Boolean(open)} />
      {/* Stands in for the player dismissing the sheet, which is how the real
          tile reports its close. */}
      <button
        type="button"
        data-testid="close-daily"
        onClick={() => onOpenChange?.(false)}
      />
    </>
  ),
}));
vi.mock("@/components/hub/hub-lite-scaffold", () => ({
  HubLiteScaffold: ({ dailySlot }: { dailySlot: ReactNode }) => (
    <div>{dailySlot}</div>
  ),
}));

import { LearnHubClient } from "../learn-hub-client";

const INSTALL_KEY = "chesscito:analytics-session";

function finishTour(
  args: { outcome?: "completed" | "skipped"; replay?: boolean } = {},
) {
  act(() => {
    tourArgs.current?.onFinished?.({
      outcome: args.outcome ?? "completed",
      replay: args.replay ?? false,
    });
  });
}

function eventsNamed(name: string) {
  return trackMock.mock.calls.filter((c) => c[0] === name);
}

function dailyIsOpen() {
  return screen.getByTestId("daily").getAttribute("data-open") === "true";
}

/** Deterministic assignment means the test can pick an arm by choosing an
 *  install id, with no mocking of the hash. These two are verified against
 *  `bucketForInstall` in the module's own suite. */
function useInstall(id: string) {
  window.localStorage.setItem(INSTALL_KEY, id);
}

beforeEach(() => {
  window.localStorage.clear();
  trackMock.mockClear();
  tourArgs.current = null;
  hubState.todayDone = false;
  hubState.streak = 0;
  vi.unstubAllEnvs();
});

describe("LearnHubClient — control arm", () => {
  it("keeps tour → hub exactly as it is, with the rollout off", () => {
    vi.stubEnv("NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT", "0");
    useInstall("some-install-id");
    render(<LearnHubClient />);

    expect(dailyIsOpen()).toBe(false);
    finishTour();

    // Nothing opened, and nothing was requested.
    expect(dailyIsOpen()).toBe(false);
    expect(eventsNamed("onboarding_activity_requested")).toHaveLength(0);
  });

  /** A control arm you cannot see is a control arm you cannot compare
   *  against. */
  it("still reports its assignment, so the arms are distinguishable", () => {
    vi.stubEnv("NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT", "0");
    useInstall("some-install-id");
    render(<LearnHubClient />);
    finishTour();

    const [call] = eventsNamed("onboarding_variant_assigned");
    expect(call?.[1]).toMatchObject({ variant: "control", surface: "learn" });
  });
});

describe("LearnHubClient — variant arm", () => {
  it("opens the Daily Focus activity right after the tour", () => {
    vi.stubEnv("NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT", "100");
    useInstall("variant-install");
    render(<LearnHubClient />);

    expect(dailyIsOpen()).toBe(false);
    finishTour();
    expect(dailyIsOpen()).toBe(true);
  });

  it("emits assigned → requested → ready, in that order", () => {
    vi.stubEnv("NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT", "100");
    useInstall("variant-install");
    render(<LearnHubClient />);
    finishTour();

    const names = trackMock.mock.calls.map((c) => c[0]);
    const assigned = names.indexOf("onboarding_variant_assigned");
    const requested = names.indexOf("onboarding_activity_requested");
    const ready = names.indexOf("onboarding_activity_ready");
    expect(assigned).toBeGreaterThanOrEqual(0);
    expect(requested).toBeGreaterThan(assigned);
    expect(ready).toBeGreaterThan(requested);
  });

  it("labels every event with the variant and the learn surface", () => {
    vi.stubEnv("NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT", "100");
    useInstall("variant-install");
    render(<LearnHubClient />);
    finishTour();

    for (const name of [
      "onboarding_variant_assigned",
      "onboarding_activity_requested",
      "onboarding_activity_ready",
    ]) {
      expect(eventsNamed(name)[0]?.[1], name).toMatchObject({
        variant: "first-activity",
        surface: "learn",
      });
    }
  });

  /** No payload may carry an address, an email or free text. */
  it("carries no PII in any onboarding event", () => {
    vi.stubEnv("NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT", "100");
    useInstall("variant-install");
    render(<LearnHubClient />);
    finishTour();

    for (const [name, payload] of trackMock.mock.calls) {
      if (typeof name !== "string" || !name.startsWith("onboarding_")) continue;
      const serialized = JSON.stringify(payload ?? {});
      expect(serialized, name).not.toMatch(/0x[a-f0-9]{6}/i);
      expect(serialized, name).not.toContain("@");
      expect(Object.keys(payload ?? {}), name).not.toContain("wallet");
      expect(Object.keys(payload ?? {}), name).not.toContain("address");
    }
  });
});

describe("LearnHubClient — who is left alone", () => {
  /** A veteran replaying the tour from settings is already using the product.
   *  Hijacking their hub is a regression, not an experiment. */
  it("never opens the activity on a manual tour replay", () => {
    vi.stubEnv("NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT", "100");
    useInstall("variant-install");
    render(<LearnHubClient />);

    finishTour({ replay: true });

    expect(dailyIsOpen()).toBe(false);
    expect(eventsNamed("onboarding_variant_assigned")).toHaveLength(0);
  });

  /** Opening a finished Daily shows "come back tomorrow" — a closed door. The
   *  player stays on the hub, and it is reported as a fallback rather than as
   *  a silent no-op. */
  it("falls back to the hub when today's Daily is already done", () => {
    vi.stubEnv("NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT", "100");
    useInstall("variant-install");
    hubState.todayDone = true;
    hubState.streak = 4;
    render(<LearnHubClient />);
    finishTour();

    expect(dailyIsOpen()).toBe(false);
    expect(eventsNamed("onboarding_activity_failed")[0]?.[1]).toMatchObject({
      reason: "already-done",
    });
    expect(eventsNamed("onboarding_fallback_to_hub")[0]?.[1]).toMatchObject({
      reason: "already-done",
    });
  });

  /** An install with no id cannot be attributed or counted, so it stays out of
   *  the experiment entirely rather than padding the control arm. */
  it("stays out of the experiment when there is no install id", () => {
    vi.stubEnv("NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT", "100");
    // localStorage cleared in beforeEach; getAnonymousId would MINT one, so
    // the unattributable case is simulated by making storage throw.
    const spy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });
    const setSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });
    render(<LearnHubClient />);
    finishTour();

    expect(dailyIsOpen()).toBe(false);
    expect(eventsNamed("onboarding_variant_assigned")).toHaveLength(0);
    spy.mockRestore();
    setSpy.mockRestore();
  });
});

describe("LearnHubClient — idempotence", () => {
  /** The real guard is the tour's own seen-flag, which makes a second
   *  completion impossible per install. This asserts the layer below it: even
   *  if `onFinished` somehow ran twice, the arm is stable and the activity is
   *  not re-requested from a fresh state. */
  it("assigns the same arm every time for a given install", () => {
    vi.stubEnv("NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT", "50");
    useInstall("repeatable-install");
    render(<LearnHubClient />);

    finishTour();
    finishTour();
    finishTour();

    const variants = eventsNamed("onboarding_variant_assigned").map(
      (c) => (c[1] as { variant: string }).variant,
    );
    expect(new Set(variants).size).toBe(1);
  });

  /** Re-mounting (refresh, back navigation) must not auto-open anything on its
   *  own: the activity opens only from a tour completion. */
  it("does not open the activity on a plain mount", () => {
    vi.stubEnv("NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT", "100");
    useInstall("variant-install");
    const { unmount } = render(<LearnHubClient />);
    expect(dailyIsOpen()).toBe(false);
    unmount();

    render(<LearnHubClient />);
    expect(dailyIsOpen()).toBe(false);
    expect(eventsNamed("onboarding_activity_ready")).toHaveLength(0);
  });
});

describe("LearnHubClient — closure and the hub afterwards", () => {
  /** ⚠️ NOT `daily_streak_updated`. That fires from the same block as the
   *  completion, so using it as the closure signal would measure the
   *  completion a second time under a different name. This event means the
   *  player actually saw a finished screen with their progress on it. */
  it("reports a real closure once the Daily completes with the sheet up", () => {
    vi.stubEnv("NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT", "100");
    useInstall("variant-install");
    const { rerender } = render(<LearnHubClient />);
    finishTour();
    expect(dailyIsOpen()).toBe(true);
    expect(eventsNamed("onboarding_closure_shown")).toHaveLength(0);

    // The player solves it: the passport flips to done while the sheet is up.
    hubState.todayDone = true;
    hubState.streak = 1;
    act(() => {
      rerender(<LearnHubClient />);
    });

    expect(eventsNamed("onboarding_closure_shown")[0]?.[1]).toMatchObject({
      variant: "first-activity",
      closure: "first-focus-day",
    });
  });

  it("does not report a closure for a sheet that was never solved", () => {
    vi.stubEnv("NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT", "100");
    useInstall("variant-install");
    render(<LearnHubClient />);
    finishTour();

    act(() => {
      screen.getByTestId("close-daily").click();
    });

    expect(eventsNamed("onboarding_closure_shown")).toHaveLength(0);
  });

  it("reports reaching the hub after the activity, and whether it was finished", () => {
    vi.stubEnv("NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT", "100");
    useInstall("variant-install");
    const { rerender } = render(<LearnHubClient />);
    finishTour();

    hubState.todayDone = true;
    hubState.streak = 1;
    act(() => {
      rerender(<LearnHubClient />);
    });
    act(() => {
      screen.getByTestId("close-daily").click();
    });

    expect(eventsNamed("onboarding_hub_reached")[0]?.[1]).toMatchObject({
      variant: "first-activity",
      completed_activity: true,
    });
  });

  it("distinguishes dismissing the activity from finishing it", () => {
    vi.stubEnv("NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT", "100");
    useInstall("variant-install");
    render(<LearnHubClient />);
    finishTour();

    act(() => {
      screen.getByTestId("close-daily").click();
    });

    expect(eventsNamed("onboarding_hub_reached")[0]?.[1]).toMatchObject({
      completed_activity: false,
    });
  });

  /** Reopening the Daily later, by hand, is ordinary product use — it must not
   *  emit a second experiment closure or a second hub-reached. */
  it("reports the closure and the hub landing at most once", () => {
    vi.stubEnv("NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT", "100");
    useInstall("variant-install");
    const { rerender } = render(<LearnHubClient />);
    finishTour();

    hubState.todayDone = true;
    hubState.streak = 1;
    act(() => {
      rerender(<LearnHubClient />);
    });
    act(() => {
      screen.getByTestId("close-daily").click();
    });
    // The player opens it again from the corner gift and closes it again.
    act(() => {
      screen.getByTestId("daily").click();
      rerender(<LearnHubClient />);
    });
    act(() => {
      screen.getByTestId("close-daily").click();
    });

    expect(eventsNamed("onboarding_closure_shown")).toHaveLength(1);
    expect(eventsNamed("onboarding_hub_reached")).toHaveLength(1);
  });
});
