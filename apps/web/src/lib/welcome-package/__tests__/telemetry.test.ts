import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

import { track } from "@/lib/telemetry";
import {
  emitClaimGiftFailed,
  emitClaimGiftRejected,
  emitClaimGiftSigning,
  emitClaimGiftSuccess,
  emitClaimGiftTap,
} from "../telemetry";

const mockTrack = vi.mocked(track);

function callsOf(name: string) {
  return mockTrack.mock.calls.filter((c) => c[0] === name);
}

beforeEach(() => {
  mockTrack.mockClear();
});

describe("emitClaimGiftTap", () => {
  it("emits claim_gift_tap with isLite: true", () => {
    emitClaimGiftTap();
    const calls = callsOf("claim_gift_tap");
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toEqual({ isLite: true });
  });
});

describe("emitClaimGiftSigning", () => {
  it("emits claim_gift_signing with isLite: true and hadWallet: true", () => {
    emitClaimGiftSigning();
    const calls = callsOf("claim_gift_signing");
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toEqual({ isLite: true, hadWallet: true });
  });
});

describe("emitClaimGiftSuccess", () => {
  it("emits claim_gift_success with hadWallet: true (wallet path)", () => {
    emitClaimGiftSuccess(true);
    const calls = callsOf("claim_gift_success");
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toEqual({ isLite: true, hadWallet: true });
  });

  it("emits claim_gift_success with hadWallet: false (no-wallet fast-path)", () => {
    emitClaimGiftSuccess(false);
    const calls = callsOf("claim_gift_success");
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toEqual({ isLite: true, hadWallet: false });
  });
});

describe("emitClaimGiftRejected", () => {
  it("emits claim_gift_rejected with isLite: true — no raw error data", () => {
    emitClaimGiftRejected();
    const calls = callsOf("claim_gift_rejected");
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toEqual({ isLite: true });
  });
});

describe("emitClaimGiftFailed", () => {
  it.each<["sign_failed" | "unknown"]>([["sign_failed"], ["unknown"]])(
    "emits claim_gift_failed with reason=%s — no raw error message",
    (reason) => {
      emitClaimGiftFailed(reason);
      const calls = callsOf("claim_gift_failed");
      expect(calls).toHaveLength(1);
      expect(calls[0]![1]).toEqual({ isLite: true, reason });
    },
  );

  it("never includes wallet address or raw error string in props", () => {
    emitClaimGiftFailed("sign_failed");
    const props = callsOf("claim_gift_failed")[0]![1] as Record<string, unknown>;
    expect(props).not.toHaveProperty("address");
    expect(props).not.toHaveProperty("message");
    expect(props).not.toHaveProperty("error");
    expect(props).not.toHaveProperty("signature");
  });
});

describe("Lite B1.2 telemetry guarantees", () => {
  it("all Claim Gift events carry isLite: true", () => {
    emitClaimGiftTap();
    emitClaimGiftSigning();
    emitClaimGiftSuccess(true);
    emitClaimGiftRejected();
    emitClaimGiftFailed("sign_failed");

    for (const call of mockTrack.mock.calls) {
      const props = call[1] as Record<string, unknown> | undefined;
      expect(props?.["isLite"]).toBe(true);
    }
  });

  it("does not emit peones_earned or daily_tactic events (wrong namespace)", () => {
    emitClaimGiftTap();
    emitClaimGiftSuccess(false);
    const wrongEvents = mockTrack.mock.calls.filter(
      (c) => c[0].startsWith("peones_") || c[0].startsWith("daily_"),
    );
    expect(wrongEvents).toHaveLength(0);
  });
});
