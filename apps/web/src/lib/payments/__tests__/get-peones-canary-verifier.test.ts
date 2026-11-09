import { describe, expect, it } from "vitest";
import { encodeEventTopics, encodeFunctionData, encodeAbiParameters, erc20Abi } from "viem";

import type { GetPeonesCanaryIntent } from "@/lib/payments/get-peones-canary";
import {
  verifyCanaryTransaction,
  verifyCanaryTransferEvent,
} from "@/lib/payments/get-peones-canary-verifier";

const WALLET = "0xaaaabbbbccccddddeeeeffff0000111122223333" as const;
const TOKEN = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as const;
const TREASURY = "0x1234567890abcdef1234567890abcdef12345678" as const;
const OTHER = "0x9999888877776666555544443333222211110000" as const;
const EXPECTED = 500_000n;

const intent: GetPeonesCanaryIntent = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  wallet: WALLET,
  sku: "peones_pack_50",
  token: TOKEN,
  tokenSymbol: "USDT",
  tokenDecimals: 6,
  expectedAmount: EXPECTED.toString(),
  chainId: 42220,
  treasury: TREASURY,
  configVersion: "canary-v1",
  priceVersion: "peones-50-v1",
  requiredConfirmations: 2,
  expiresAt: "2099-01-01T00:00:00.000Z",
  authBinding: "client_asserted_wallet",
};

function input(recipient: `0x${string}` = TREASURY, amount = EXPECTED) {
  return encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [recipient, amount] });
}

function log(
  from: `0x${string}` = WALLET,
  to: `0x${string}` = TREASURY,
  amount = EXPECTED,
  logIndex: number | null = 3,
) {
  const topics = encodeEventTopics({ abi: erc20Abi, eventName: "Transfer", args: { from, to } });
  return {
    address: TOKEN,
    topics: topics as `0x${string}`[],
    data: encodeAbiParameters([{ type: "uint256" }], [amount]),
    logIndex,
  };
}

describe("Get Peones canary canonical transaction", () => {
  it("accepts only the intended transfer", () => {
    expect(verifyCanaryTransaction({ to: TOKEN, from: WALLET, input: input() }, intent)).toEqual({
      ok: true,
      amount: EXPECTED,
    });
  });

  it.each([
    ["wrong target", { to: OTHER, from: WALLET, input: input() }, "wrong_target"],
    ["wrong selector", { to: TOKEN, from: WALLET, input: "0x12345678" }, "wrong_selector"],
    ["trailing calldata", { to: TOKEN, from: WALLET, input: `${input()}00` }, "wrong_selector"],
    ["wrong sender", { to: TOKEN, from: OTHER, input: input() }, "wrong_sender"],
    ["wrong recipient", { to: TOKEN, from: WALLET, input: input(OTHER) }, "wrong_recipient"],
    ["insufficient amount", { to: TOKEN, from: WALLET, input: input(TREASURY, EXPECTED - 1n) }, "insufficient_amount"],
  ] as const)("rejects %s", (_name, transaction, reason) => {
    expect(verifyCanaryTransaction(transaction, intent)).toEqual({ ok: false, reason });
  });
});

describe("Get Peones canary Transfer event", () => {
  it("requires one matching event with a real logIndex", () => {
    expect(verifyCanaryTransferEvent({ logs: [log()], intent })).toEqual({
      ok: true,
      logIndex: 3,
      amount: EXPECTED,
      overpaid: false,
    });
    expect(verifyCanaryTransferEvent({ logs: [log(WALLET, TREASURY, EXPECTED, null)], intent }))
      .toEqual({ ok: false, reason: "missing_event" });
  });

  it("rejects missing and ambiguous matching events", () => {
    expect(verifyCanaryTransferEvent({ logs: [], intent })).toEqual({
      ok: false,
      reason: "missing_event",
    });
    expect(verifyCanaryTransferEvent({ logs: [log(), log(WALLET, TREASURY, EXPECTED, 4)], intent }))
      .toEqual({ ok: false, reason: "ambiguous_event" });
  });

  it("uses an explicit canonical logIndex to disambiguate", () => {
    expect(verifyCanaryTransferEvent({
      logs: [log(), log(WALLET, TREASURY, EXPECTED + 1n, 4)],
      intent,
      requestedLogIndex: 4,
    })).toEqual({ ok: true, logIndex: 4, amount: EXPECTED + 1n, overpaid: true });
  });
});
