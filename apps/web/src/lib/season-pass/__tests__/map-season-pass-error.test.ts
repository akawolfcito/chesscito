/**
 * Tests for mapSeasonPassError — Fix 5: map raw rail/verify error reasons to
 * the few user-facing messages a buyer can act on.
 */

import { describe, expect, it } from "vitest";

import { mapSeasonPassError } from "../map-season-pass-error";

describe("mapSeasonPassError", () => {
  it("not-configured / no-treasury → configuration message", () => {
    const msg = "Payments are not configured yet.";
    expect(mapSeasonPassError("rail_not_configured")).toBe(msg);
    expect(mapSeasonPassError("no_treasury")).toBe(msg);
    expect(mapSeasonPassError("unavailable")).toBe(msg);
  });

  it("wrong chain → switch to Celo Mainnet", () => {
    expect(mapSeasonPassError("unsupported_chain")).toBe("Switch to Celo Mainnet.");
    expect(mapSeasonPassError("wrong_chain")).toBe("Switch to Celo Mainnet.");
  });

  it("unsupported token → choose a stablecoin", () => {
    expect(mapSeasonPassError("unsupported_token")).toBe("Choose USDC, USDT or cUSD.");
  });

  it("user cancellation → cancelled message", () => {
    expect(mapSeasonPassError("user_rejected")).toBe("Transaction was cancelled.");
    expect(mapSeasonPassError("tx_rejected")).toBe("Transaction was cancelled.");
  });

  it("verification failures → could-not-verify message", () => {
    const msg = "We could not verify the payment yet.";
    for (const reason of [
      "verification_failed",
      "verify_failed",
      "transfer_not_found",
      "not_direct_transfer",
      "amount_too_low",
      "receipt_not_found",
      "ledger_unavailable",
      "ledger_write_failed",
    ]) {
      expect(mapSeasonPassError(reason)).toBe(msg);
    }
  });

  it("unknown / null / undefined → generic fallback", () => {
    const fallback = "Payment failed. Try again.";
    expect(mapSeasonPassError("something_weird")).toBe(fallback);
    expect(mapSeasonPassError(null)).toBe(fallback);
    expect(mapSeasonPassError(undefined)).toBe(fallback);
  });

  it("maps active PRO coverage to stable included copy", () => {
    expect(mapSeasonPassError("included_with_pro")).toBe("Included with PRO.");
  });
});
