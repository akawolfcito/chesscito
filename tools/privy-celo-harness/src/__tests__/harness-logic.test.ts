import { describe, expect, it } from "vitest";
import { celo, celoSepolia } from "wagmi/chains";

import { MAINNET_CHAIN_ID, SEND_CHAIN_ID } from "../chains";
import {
  assertTestnetForSend,
  canSend,
  canSign,
  maskAppId,
  resolveAppId,
  resolveWalletPhase,
  TEST_MESSAGE,
} from "../harness-logic";

describe("resolveAppId", () => {
  it("returns a clear config error when the App ID is missing (empty)", () => {
    const result = resolveAppId("");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/VITE_PRIVY_APP_ID/);
  });

  it("returns a clear config error when the App ID is undefined", () => {
    const result = resolveAppId(undefined);
    expect(result.ok).toBe(false);
  });

  it("accepts a present App ID", () => {
    const result = resolveAppId("  clxyz123appid  ");
    expect(result).toEqual({ ok: true, appId: "clxyz123appid" });
  });
});

describe("maskAppId", () => {
  it("never reveals the full App ID", () => {
    const masked = maskAppId("clabcdef1234567890");
    expect(masked).not.toContain("cdef1234");
    expect(masked).toBe("clab…7890");
  });
});

describe("resolveWalletPhase", () => {
  const base = { hasAppId: true, ready: true, authenticated: false, address: null };

  it("config-error when there is no App ID", () => {
    expect(resolveWalletPhase({ ...base, hasAppId: false })).toBe("config-error");
  });
  it("initializing before Privy is ready", () => {
    expect(resolveWalletPhase({ ...base, ready: false })).toBe("initializing");
  });
  it("unauthenticated when ready but not logged in", () => {
    expect(resolveWalletPhase(base)).toBe("unauthenticated");
  });
  it("wallet-loading when authenticated but no address yet", () => {
    expect(resolveWalletPhase({ ...base, authenticated: true })).toBe("wallet-loading");
  });
  it("wallet-ready when an address exists", () => {
    expect(
      resolveWalletPhase({ ...base, authenticated: true, address: "0xabc" }),
    ).toBe("wallet-ready");
  });
});

describe("sign/send gating", () => {
  it("only enables signing and sending when the wallet is ready", () => {
    expect(canSign("wallet-ready")).toBe(true);
    expect(canSend("wallet-ready")).toBe(true);
    for (const phase of [
      "config-error",
      "initializing",
      "unauthenticated",
      "wallet-loading",
    ] as const) {
      expect(canSign(phase)).toBe(false);
      expect(canSend(phase)).toBe(false);
    }
  });
});

describe("assertTestnetForSend — the harness never sends on mainnet", () => {
  it("SEND chain is Celo Sepolia testnet, not mainnet", () => {
    expect(SEND_CHAIN_ID).toBe(celoSepolia.id);
    expect(SEND_CHAIN_ID).not.toBe(celo.id);
    expect(MAINNET_CHAIN_ID).toBe(celo.id);
  });

  it("throws when asked to send on Celo mainnet", () => {
    expect(() => assertTestnetForSend(celo.id)).toThrow(/mainnet/i);
  });

  it("throws on any non-testnet chain", () => {
    expect(() => assertTestnetForSend(1)).toThrow();
  });

  it("passes on Celo testnet", () => {
    expect(() => assertTestnetForSend(celoSepolia.id)).not.toThrow();
  });
});

describe("TEST_MESSAGE", () => {
  it("is the exact validation message", () => {
    expect(TEST_MESSAGE).toBe("Chesscito Privy × Celo validation — 2026-07-23");
  });
});
