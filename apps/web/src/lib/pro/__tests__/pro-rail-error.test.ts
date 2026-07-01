import { describe, expect, it } from "vitest";
import { classifyProRailError } from "../pro-rail-error";

describe("classifyProRailError", () => {
  it("no reason, or a user cancellation → silent (no banner, no telemetry)", () => {
    expect(classifyProRailError(null, false)).toBe("silent");
    expect(classifyProRailError(undefined, false)).toBe("silent");
    expect(classifyProRailError("user_rejected", false)).toBe("silent");
    expect(classifyProRailError("user_rejected", true)).toBe("silent");
  });

  it("a tx hash already exists → verifyFailed, regardless of the reason string", () => {
    expect(classifyProRailError("amount_too_low", true)).toBe("verifyFailed");
    expect(classifyProRailError("ledger_write_failed", true)).toBe("verifyFailed");
    expect(classifyProRailError("some raw viem revert message", true)).toBe("verifyFailed");
  });

  it("no tx hash + rail unavailable → notConfigured", () => {
    expect(classifyProRailError("unavailable", false)).toBe("notConfigured");
  });

  it("no tx hash + anything else → generic", () => {
    expect(classifyProRailError("tx_failed", false)).toBe("generic");
    expect(classifyProRailError("not_connected", false)).toBe("generic");
  });
});
