import { describe, expect, it } from "vitest";
import { detectWalletFromUserAgent } from "@/lib/server/wallet-detection";

describe("detectWalletFromUserAgent", () => {
  it("returns null for an empty / missing UA", () => {
    expect(detectWalletFromUserAgent("")).toBeNull();
    expect(detectWalletFromUserAgent(null)).toBeNull();
    expect(detectWalletFromUserAgent(undefined)).toBeNull();
  });

  it("returns null for a regular desktop browser UA", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15";
    expect(detectWalletFromUserAgent(ua)).toBeNull();
  });

  it("detects MiniPay", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 MiniPay/1.0";
    expect(detectWalletFromUserAgent(ua)).toBe("minipay");
  });

  it("detects Valora", () => {
    const ua = "Mozilla/5.0 ... Valora/1.86.0 ...";
    expect(detectWalletFromUserAgent(ua)).toBe("valora");
  });

  it("detects Coinbase Wallet", () => {
    const ua = "Mozilla/5.0 ... CoinbaseWallet/1.0 ...";
    expect(detectWalletFromUserAgent(ua)).toBe("coinbase-wallet");
  });

  it("detects Trust Wallet", () => {
    const ua = "Mozilla/5.0 ... Trust/1.0 ...";
    expect(detectWalletFromUserAgent(ua)).toBe("trust-wallet");
  });

  it("returns the first match when multiple tokens are present", () => {
    // MiniPay listed first in the fingerprint table, so it wins.
    const ua = "MiniPay Valora Trust";
    expect(detectWalletFromUserAgent(ua)).toBe("minipay");
  });
});
