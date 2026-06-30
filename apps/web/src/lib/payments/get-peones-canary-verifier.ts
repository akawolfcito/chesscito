import {
  decodeEventLog,
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  isAddressEqual,
} from "viem";

import type { GetPeonesCanaryIntent } from "@/lib/payments/get-peones-canary";

export type CanaryTransactionInput = {
  to: `0x${string}` | null;
  from: `0x${string}`;
  input: `0x${string}`;
};

export type CanaryReceiptLog = {
  address: `0x${string}`;
  topics: readonly `0x${string}`[];
  data: `0x${string}`;
  logIndex: number | null | undefined;
};

export type CanaryVerificationReason =
  | "wrong_target"
  | "wrong_selector"
  | "wrong_sender"
  | "wrong_recipient"
  | "insufficient_amount"
  | "missing_event"
  | "ambiguous_event";

export type CanaryTransactionVerification =
  | { ok: true; amount: bigint }
  | { ok: false; reason: CanaryVerificationReason };

export type CanaryEventVerification =
  | { ok: true; logIndex: number; amount: bigint; overpaid: boolean }
  | { ok: false; reason: CanaryVerificationReason };

export function verifyCanaryTransaction(
  transaction: CanaryTransactionInput,
  intent: GetPeonesCanaryIntent,
): CanaryTransactionVerification {
  if (!transaction.to || !isAddressEqual(transaction.to, intent.token)) {
    return { ok: false, reason: "wrong_target" };
  }
  if (!isAddressEqual(transaction.from, intent.wallet)) {
    return { ok: false, reason: "wrong_sender" };
  }

  let decoded: ReturnType<typeof decodeFunctionData<typeof erc20Abi>>;
  try {
    decoded = decodeFunctionData({ abi: erc20Abi, data: transaction.input });
  } catch {
    return { ok: false, reason: "wrong_selector" };
  }
  if (decoded.functionName !== "transfer" || !decoded.args || decoded.args.length !== 2) {
    return { ok: false, reason: "wrong_selector" };
  }

  const [recipient, amount] = decoded.args as readonly [`0x${string}`, bigint];
  const canonicalInput = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [recipient, amount],
  });
  if (canonicalInput.toLowerCase() !== transaction.input.toLowerCase()) {
    return { ok: false, reason: "wrong_selector" };
  }
  if (!isAddressEqual(recipient, intent.treasury)) {
    return { ok: false, reason: "wrong_recipient" };
  }
  if (amount < BigInt(intent.expectedAmount)) {
    return { ok: false, reason: "insufficient_amount" };
  }
  return { ok: true, amount };
}

export function verifyCanaryTransferEvent(args: {
  logs: readonly CanaryReceiptLog[];
  intent: GetPeonesCanaryIntent;
  requestedLogIndex?: number;
}): CanaryEventVerification {
  const matches: Array<{ logIndex: number; amount: bigint }> = [];

  for (const log of args.logs) {
    if (!isAddressEqual(log.address, args.intent.token)) continue;
    if (log.logIndex == null) continue;
    if (args.requestedLogIndex !== undefined && log.logIndex !== args.requestedLogIndex) continue;

    try {
      const decoded = decodeEventLog({
        abi: erc20Abi,
        eventName: "Transfer",
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        data: log.data,
      });
      const eventArgs = decoded.args as { from: `0x${string}`; to: `0x${string}`; value: bigint };
      if (!isAddressEqual(eventArgs.from, args.intent.wallet)) continue;
      if (!isAddressEqual(eventArgs.to, args.intent.treasury)) continue;
      if (eventArgs.value < BigInt(args.intent.expectedAmount)) continue;
      matches.push({ logIndex: log.logIndex, amount: eventArgs.value });
    } catch {
      continue;
    }
  }

  if (matches.length === 0) return { ok: false, reason: "missing_event" };
  if (matches.length !== 1) return { ok: false, reason: "ambiguous_event" };
  const match = matches[0];
  return {
    ok: true,
    logIndex: match.logIndex,
    amount: match.amount,
    overpaid: match.amount > BigInt(args.intent.expectedAmount),
  };
}
