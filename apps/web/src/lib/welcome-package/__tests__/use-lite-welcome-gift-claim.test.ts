import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));

const signMessageAsyncMock = vi.hoisted(() => vi.fn(async () => "0xsig"));
const addressMock = vi.hoisted(() => ({ value: "0xabc" as string | undefined }));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: addressMock.value }),
  useSignMessage: () => ({ signMessageAsync: signMessageAsyncMock }),
}));

import { track } from "@/lib/telemetry";
import { useLiteWelcomeGiftClaim } from "../use-lite-welcome-gift-claim";

const mockTrack = vi.mocked(track);

function callsOf(name: string) {
  return mockTrack.mock.calls.filter((c) => c[0] === name);
}

beforeEach(() => {
  mockTrack.mockClear();
  signMessageAsyncMock.mockClear();
  signMessageAsyncMock.mockResolvedValue("0xsig");
  addressMock.value = "0xabc";
});

describe("useLiteWelcomeGiftClaim — telemetry: wallet path", () => {
  it("emits claim_gift_tap then claim_gift_signing on handleClaim with wallet", async () => {
    const { result } = renderHook(() => useLiteWelcomeGiftClaim());
    await act(async () => {
      result.current.handleClaim(() => {});
    });
    expect(callsOf("claim_gift_tap")).toHaveLength(1);
    expect(callsOf("claim_gift_signing")).toHaveLength(1);
  });

  it("emits claim_gift_success { hadWallet: true } on signature resolve", async () => {
    const { result } = renderHook(() => useLiteWelcomeGiftClaim());
    await act(async () => {
      result.current.handleClaim(() => {});
    });
    const success = callsOf("claim_gift_success");
    expect(success).toHaveLength(1);
    expect(success[0]![1]).toEqual({ isLite: true, hadWallet: true });
  });

  it("emits claim_gift_rejected when user cancels (UserRejectedRequestError message)", async () => {
    signMessageAsyncMock.mockRejectedValue(new Error("User rejected the request"));
    const { result } = renderHook(() => useLiteWelcomeGiftClaim());
    await act(async () => {
      result.current.handleClaim(() => {});
    });
    expect(callsOf("claim_gift_rejected")).toHaveLength(1);
    expect(callsOf("claim_gift_failed")).toHaveLength(0);
  });

  it("emits claim_gift_rejected for 'user denied' message", async () => {
    signMessageAsyncMock.mockRejectedValue(new Error("User denied transaction signature"));
    const { result } = renderHook(() => useLiteWelcomeGiftClaim());
    await act(async () => {
      result.current.handleClaim(() => {});
    });
    expect(callsOf("claim_gift_rejected")).toHaveLength(1);
  });

  it("emits claim_gift_failed { reason: sign_failed } for non-rejection errors", async () => {
    signMessageAsyncMock.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useLiteWelcomeGiftClaim());
    await act(async () => {
      result.current.handleClaim(() => {});
    });
    const failed = callsOf("claim_gift_failed");
    expect(failed).toHaveLength(1);
    expect(failed[0]![1]).toEqual({ isLite: true, reason: "sign_failed" });
    expect(callsOf("claim_gift_rejected")).toHaveLength(0);
  });

  it("never emits wallet address in any telemetry event", async () => {
    const { result } = renderHook(() => useLiteWelcomeGiftClaim());
    await act(async () => {
      result.current.handleClaim(() => {});
    });
    for (const call of mockTrack.mock.calls) {
      const props = call[1] as Record<string, unknown> | undefined;
      expect(props).not.toHaveProperty("address");
      expect(props).not.toHaveProperty("wallet");
    }
  });
});

describe("useLiteWelcomeGiftClaim — telemetry: no-wallet fast-path", () => {
  beforeEach(() => {
    addressMock.value = undefined;
  });

  it("emits claim_gift_tap then claim_gift_success { hadWallet: false } — skips signing", async () => {
    const { result } = renderHook(() => useLiteWelcomeGiftClaim());
    act(() => {
      result.current.handleClaim(() => {});
    });
    expect(callsOf("claim_gift_tap")).toHaveLength(1);
    expect(callsOf("claim_gift_signing")).toHaveLength(0);
    const success = callsOf("claim_gift_success");
    expect(success).toHaveLength(1);
    expect(success[0]![1]).toEqual({ isLite: true, hadWallet: false });
    expect(signMessageAsyncMock).not.toHaveBeenCalled();
  });
});

describe("useLiteWelcomeGiftClaim — telemetry: guard re-entry", () => {
  it("does not emit duplicate events when called twice while signing", async () => {
    signMessageAsyncMock.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useLiteWelcomeGiftClaim());
    // First call: transitions to "signing" state
    act(() => { result.current.handleClaim(() => {}); });
    // Second call after re-render: claimPhase !== "idle" → guarded, no emission
    act(() => { result.current.handleClaim(() => {}); });
    expect(callsOf("claim_gift_tap")).toHaveLength(1);
    expect(callsOf("claim_gift_signing")).toHaveLength(1);
  });
});
