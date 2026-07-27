import { describe, expect, it } from "vitest";

import { resolveFocusDaysGate } from "@/lib/season-pass/focus-days-gate";

/** Spec: docs/specs/2026-07-27-focus-days-ledger.md (APPROVED) — AC27.
 *  Redis override → env default → safe default in code. A Vercel env var is
 *  snapshotted into the deployment, so it is the deployment default, never the
 *  hot kill switch. */
describe("resolveFocusDaysGate", () => {
  it("lets a Redis override switch the feature on over an env that says off", () => {
    expect(resolveFocusDaysGate("true", "false")).toMatchObject({
      enabled: true,
      source: "redis",
    });
  });

  it("lets a Redis override kill the feature without a redeploy", () => {
    expect(resolveFocusDaysGate("false", "true")).toMatchObject({
      enabled: false,
      source: "redis",
    });
  });

  it("falls back to the env default when no override exists", () => {
    expect(resolveFocusDaysGate(null, "true")).toMatchObject({ enabled: true, source: "env" });
    expect(resolveFocusDaysGate(undefined, "true")).toMatchObject({ enabled: true, source: "env" });
  });

  it("treats a Redis outage as no override, not as off", () => {
    // The caller passes null when the read threw. The env default still rules.
    expect(resolveFocusDaysGate(null, "true")).toMatchObject({ enabled: true, source: "env" });
  });

  it("is off when nothing is configured anywhere", () => {
    expect(resolveFocusDaysGate(null, undefined)).toMatchObject({
      enabled: false,
      source: "default",
    });
  });

  it("ships off by default: only the literal 'true' enables it", () => {
    expect(resolveFocusDaysGate(null, "True").enabled).toBe(false);
    expect(resolveFocusDaysGate(null, "1").enabled).toBe(false);
    expect(resolveFocusDaysGate(null, "yes").enabled).toBe(false);
  });

  it("falls to the safe default on a corrupt override, and reports it for logging", () => {
    const gate = resolveFocusDaysGate("maybe", "true");
    expect(gate.enabled).toBe(false);
    expect(gate.source).toBe("default");
    expect(gate.invalidOverride).toBe("maybe");
  });

  it("does not report an invalid override when the value is well formed", () => {
    expect(resolveFocusDaysGate("true", "false").invalidOverride).toBeUndefined();
    expect(resolveFocusDaysGate(null, "true").invalidOverride).toBeUndefined();
  });
});
