import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics } from "viem";
import { erc20Abi, STABLECOIN_ADDRESSES_LOWER } from "@/lib/contracts/tokens";
import {
  verifyStablecoinTransfer,
  type TransferLogInput,
} from "@/lib/payments/verify-transfer";

const USDC = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
const TREASURY = "0x1234567890abcdef1234567890abcdef12345678";
const WALLET = "0xaaaabbbbccccddddeeeeffff0000111122223333";
const OTHER = "0x9999888877776666555544443333222211110000";
const EXPECTED = 500_000n;

function transferLog(
  token: string,
  from: string,
  to: string,
  value: bigint,
  logIndex: number,
): TransferLogInput {
  const topics = encodeEventTopics({
    abi: erc20Abi,
    eventName: "Transfer",
    args: { from: from as `0x${string}`, to: to as `0x${string}` },
  });
  const data = encodeAbiParameters([{ type: "uint256" }], [value]);
  return { address: token, topics: topics as `0x${string}`[], data, logIndex };
}

function approvalLog(token: string, owner: string, spender: string): TransferLogInput {
  const topics = encodeEventTopics({
    abi: erc20Abi,
    eventName: "Approval",
    args: { owner: owner as `0x${string}`, spender: spender as `0x${string}` },
  });
  const data = encodeAbiParameters([{ type: "uint256" }], [1n]);
  return { address: token, topics: topics as `0x${string}`[], data, logIndex: 7 };
}

const base = {
  expectedTreasury: TREASURY,
  fromWallet: WALLET,
  acceptedTokenAddressesLower: STABLECOIN_ADDRESSES_LOWER,
  expectedAmount: EXPECTED,
};

describe("verifyStablecoinTransfer — happy paths", () => {
  it("accepts an exact-amount transfer to treasury", () => {
    const r = verifyStablecoinTransfer({
      ...base,
      logs: [transferLog(USDC, WALLET, TREASURY, EXPECTED, 3)],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.amount).toBe(EXPECTED);
      expect(r.logIndex).toBe(3);
      expect(r.overpaid).toBe(false);
      expect(r.token).toBe(USDC.toLowerCase());
      expect(r.to).toBe(TREASURY.toLowerCase());
    }
  });

  it("accepts overpay by default and flags it", () => {
    const r = verifyStablecoinTransfer({
      ...base,
      logs: [transferLog(USDC, WALLET, TREASURY, EXPECTED + 1n, 0)],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.overpaid).toBe(true);
  });

  it("picks the matching transfer among multiple logs", () => {
    const r = verifyStablecoinTransfer({
      ...base,
      logs: [
        approvalLog(USDC, WALLET, OTHER),
        transferLog(USDC, OTHER, TREASURY, EXPECTED, 1), // wrong from
        transferLog(USDC, WALLET, OTHER, EXPECTED, 2), // wrong to
        transferLog(USDC, WALLET, TREASURY, EXPECTED, 5), // ← match
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.logIndex).toBe(5);
  });
});

describe("verifyStablecoinTransfer — rejections", () => {
  it("rejects amount below expected", () => {
    const r = verifyStablecoinTransfer({
      ...base,
      logs: [transferLog(USDC, WALLET, TREASURY, EXPECTED - 1n, 0)],
    });
    expect(r).toEqual({ ok: false, reason: "amount-too-low" });
  });

  it("rejects overpay when overpayAccepted is false", () => {
    const r = verifyStablecoinTransfer({
      ...base,
      overpayAccepted: false,
      logs: [transferLog(USDC, WALLET, TREASURY, EXPECTED + 5n, 0)],
    });
    expect(r).toEqual({ ok: false, reason: "overpay-not-accepted" });
  });

  it("rejects a transfer to a non-treasury address", () => {
    const r = verifyStablecoinTransfer({
      ...base,
      logs: [transferLog(USDC, WALLET, OTHER, EXPECTED, 0)],
    });
    expect(r).toEqual({ ok: false, reason: "no-matching-transfer" });
  });

  it("rejects a transfer from the wrong wallet", () => {
    const r = verifyStablecoinTransfer({
      ...base,
      logs: [transferLog(USDC, OTHER, TREASURY, EXPECTED, 0)],
    });
    expect(r).toEqual({ ok: false, reason: "no-matching-transfer" });
  });

  it("rejects a token not in the allowlist", () => {
    const r = verifyStablecoinTransfer({
      ...base,
      logs: [transferLog(OTHER, WALLET, TREASURY, EXPECTED, 0)],
    });
    expect(r).toEqual({ ok: false, reason: "no-matching-transfer" });
  });

  it("ignores non-Transfer (Approval) logs", () => {
    const r = verifyStablecoinTransfer({
      ...base,
      logs: [approvalLog(USDC, WALLET, TREASURY)],
    });
    expect(r).toEqual({ ok: false, reason: "no-matching-transfer" });
  });
});

describe("verifyStablecoinTransfer — fail-closed", () => {
  it("rejects when the treasury is not configured (null)", () => {
    const r = verifyStablecoinTransfer({
      ...base,
      expectedTreasury: null,
      logs: [transferLog(USDC, WALLET, TREASURY, EXPECTED, 0)],
    });
    expect(r).toEqual({ ok: false, reason: "treasury-not-configured" });
  });

  it("rejects an invalid treasury address", () => {
    const r = verifyStablecoinTransfer({
      ...base,
      expectedTreasury: "not-an-address",
      logs: [transferLog(USDC, WALLET, TREASURY, EXPECTED, 0)],
    });
    expect(r).toEqual({ ok: false, reason: "invalid-treasury" });
  });

  it("rejects an invalid from wallet", () => {
    const r = verifyStablecoinTransfer({
      ...base,
      fromWallet: "nope",
      logs: [transferLog(USDC, WALLET, TREASURY, EXPECTED, 0)],
    });
    expect(r).toEqual({ ok: false, reason: "invalid-wallet" });
  });
});
