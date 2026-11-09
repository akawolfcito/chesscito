import { describe, it, expect } from "vitest";

import { ACCEPTED_TOKENS, CELO_TOKEN } from "../tokens";
import {
  selectMaxBalanceToken,
  type BalanceReadResult,
} from "../select-payment-token";

const [USDC, USDT, CUSD] = ACCEPTED_TOKENS;

function ok(result: bigint): BalanceReadResult {
  return { status: "success", result };
}
const fail: BalanceReadResult = { status: "failure", error: new Error("rpc") };

describe("selectMaxBalanceToken", () => {
  it("returns the token with the highest USD-equivalent balance among those that cover the price", () => {
    const price = 1_000_000n;
    const balances = [
      ok(2_000_000n),
      ok(5_000_000n),
      ok(3n * 10n ** 18n),
    ];
    expect(selectMaxBalanceToken(ACCEPTED_TOKENS, balances, price)).toBe(USDT);
  });

  it("compares balances normalized to USD6 across mixed decimals (cUSD 18 vs USDC 6)", () => {
    const price = 1_000_000n;
    const balances = [
      ok(1_000_000n),
      ok(1_000_000n),
      ok(50n * 10n ** 18n),
    ];
    expect(selectMaxBalanceToken(ACCEPTED_TOKENS, balances, price)).toBe(CUSD);
  });

  it("returns the only eligible token when others have insufficient balance", () => {
    const price = 5_000_000n;
    const balances = [
      ok(1_000_000n),
      ok(10_000_000n),
      ok(2n * 10n ** 18n),
    ];
    expect(selectMaxBalanceToken(ACCEPTED_TOKENS, balances, price)).toBe(USDT);
  });

  it("returns null when no token has enough balance to cover the price", () => {
    const price = 100_000_000n;
    const balances = [
      ok(1_000_000n),
      ok(2_000_000n),
      ok(3n * 10n ** 18n),
    ];
    expect(selectMaxBalanceToken(ACCEPTED_TOKENS, balances, price)).toBeNull();
  });

  it("breaks ties deterministically by returning the first token in the array order", () => {
    const price = 1_000_000n;
    const balances = [
      ok(10_000_000n),
      ok(10_000_000n),
      ok(10n * 10n ** 18n),
    ];
    expect(selectMaxBalanceToken(ACCEPTED_TOKENS, balances, price)).toBe(USDC);
  });

  it("skips reads that did not succeed (status !== 'success')", () => {
    const price = 1_000_000n;
    const balances = [
      fail,
      ok(2_000_000n),
      ok(100n * 10n ** 18n),
    ];
    expect(selectMaxBalanceToken(ACCEPTED_TOKENS, balances, price)).toBe(CUSD);
  });

  it("returns null when balances array is undefined", () => {
    expect(selectMaxBalanceToken(ACCEPTED_TOKENS, undefined, 1_000_000n)).toBeNull();
  });

  it("returns null when every read failed", () => {
    expect(
      selectMaxBalanceToken(ACCEPTED_TOKENS, [fail, fail, fail], 1_000_000n),
    ).toBeNull();
  });

  it("supports a single-token array (e.g. CELO-only path)", () => {
    const price = 1_000_000n;
    const balances = [ok(2n * 10n ** 18n)];
    expect(selectMaxBalanceToken([CELO_TOKEN], balances, price)).toBe(CELO_TOKEN);
  });

  it("respects token decimals when checking affordability (cUSD with 18 decimals)", () => {
    const price = 1_000_000n;
    const balances = [
      ok(0n),
      ok(0n),
      ok(10n ** 18n - 1n),
    ];
    expect(selectMaxBalanceToken(ACCEPTED_TOKENS, balances, price)).toBeNull();
  });
});
