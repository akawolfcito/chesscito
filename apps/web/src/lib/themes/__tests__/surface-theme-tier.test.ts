import { describe, expect, it } from "vitest";

import type { ProEntitlementState } from "@/lib/pro/use-is-pro-active";
import type { SeasonPassStatus } from "@/lib/season-pass/use-season-pass-status";

import {
  resolveThemeTierPresentation,
  resolveSurfaceThemeTierPresentation,
  runtimeThemeSurface,
} from "../use-effective-theme-tier";

const PRO_INACTIVE: ProEntitlementState = {
  status: "inactive",
  active: false,
  loading: false,
  expiresAt: null,
  stale: null,
  error: null,
};

const PRO_ACTIVE: ProEntitlementState = {
  status: "active",
  active: true,
  loading: false,
  expiresAt: Date.now() + 86_400_000,
  stale: null,
  error: null,
};

function trainingPass(
  state: SeasonPassStatus["state"],
  source: SeasonPassStatus["source"] = null,
): SeasonPassStatus {
  return {
    state,
    active: state === "active",
    source,
    seasonPassExpiresAt: source === "season_pass" ? "2099-01-01T00:00:00.000Z" : null,
    proExpiresAt: source === "pro" ? Date.now() + 86_400_000 : null,
    loading: state === "loading",
    error: null,
    seasonId: null,
    supporterStatus: null,
    shieldsCredited: source === "season_pass" ? 3 : 0,
  };
}

describe("surface-aware visual theme tier", () => {
  it.each([
    ["learn", "learn"],
    ["play", "play"],
    ["full", "full-legacy"],
  ] as const)("maps %s mode to the expected runtime surface", (mode, expected) => {
    expect(runtimeThemeSurface(mode)).toBe(expected);
  });

  it("uses effective Training Pass only for LEARN", () => {
    const direct = trainingPass("active", "season_pass");

    expect(
      resolveSurfaceThemeTierPresentation("learn", PRO_INACTIVE, direct, "default"),
    ).toEqual({ tier: "pro", stale: false });
    expect(
      resolveSurfaceThemeTierPresentation("play", PRO_INACTIVE, direct, "default"),
    ).toEqual({ tier: "default", stale: false });
  });

  it("selects the technical PRO visual slot in LEARN for real PRO coverage", () => {
    expect(
      resolveSurfaceThemeTierPresentation(
        "learn",
        PRO_ACTIVE,
        trainingPass("active", "pro"),
        "default",
      ),
    ).toEqual({ tier: "pro", stale: false });
  });

  it("keeps confirmed PRO visual coverage if the Training Pass ledger fails", () => {
    expect(
      resolveSurfaceThemeTierPresentation(
        "learn",
        PRO_ACTIVE,
        trainingPass("error"),
        "default",
      ),
    ).toEqual({ tier: "pro", stale: false });
  });

  it("keeps PLAY and FULL on the existing real-PRO rule", () => {
    const inactivePass = trainingPass("inactive");

    expect(
      resolveSurfaceThemeTierPresentation("play", PRO_ACTIVE, inactivePass, "default"),
    ).toEqual({ tier: "pro", stale: false });
    expect(
      resolveSurfaceThemeTierPresentation(
        "full-legacy",
        PRO_ACTIVE,
        inactivePass,
        "default",
      ),
    ).toEqual({ tier: "pro", stale: false });
  });

  it.each([
    PRO_ACTIVE,
    PRO_INACTIVE,
    { ...PRO_INACTIVE, status: "loading" as const, loading: true },
    { ...PRO_INACTIVE, status: "error" as const },
    { ...PRO_INACTIVE, status: "unknown" as const },
  ])("keeps FULL byte-for-byte equivalent to the previous PRO resolver", (pro) => {
    expect(
      resolveSurfaceThemeTierPresentation(
        "full-legacy",
        pro,
        trainingPass("active", "season_pass"),
        "pro",
      ),
    ).toEqual(resolveThemeTierPresentation(pro, "pro"));
  });

  it.each(["loading", "error", "unknown"] as const)(
    "retains only the last successful LEARN tier during %s",
    (state) => {
      expect(
        resolveSurfaceThemeTierPresentation(
          "learn",
          PRO_INACTIVE,
          trainingPass(state),
          "pro",
        ),
      ).toEqual({ tier: "pro", stale: true });
      expect(
        resolveSurfaceThemeTierPresentation(
          "learn",
          PRO_INACTIVE,
          trainingPass(state),
          "default",
        ),
      ).toEqual({ tier: "default", stale: true });
    },
  );

  it("returns LEARN to DEFAULT after confirmed expiry/inactivity", () => {
    expect(
      resolveSurfaceThemeTierPresentation(
        "learn",
        PRO_INACTIVE,
        trainingPass("inactive"),
        "pro",
      ),
    ).toEqual({ tier: "default", stale: false });
  });
});
