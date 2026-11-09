import { normalizePrice } from "./tokens";

export type PaymentTokenLike = {
  readonly symbol: string;
  readonly address: `0x${string}`;
  readonly decimals: number;
};

export type BalanceReadResult =
  | { status: "success"; result: bigint }
  | { status: "failure"; error?: unknown };

function toUsd6(balance: bigint, decimals: number): bigint {
  if (decimals >= 6) return balance / 10n ** BigInt(decimals - 6);
  return balance * 10n ** BigInt(6 - decimals);
}

export function selectMaxBalanceToken<T extends PaymentTokenLike>(
  tokens: readonly T[],
  balances: readonly BalanceReadResult[] | undefined,
  priceUsd6: bigint,
): T | null {
  if (!balances) return null;

  let best: T | null = null;
  let bestUsd6 = -1n;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const read = balances[i];
    if (!read || read.status !== "success") continue;

    const balance = read.result;
    const needed = normalizePrice(priceUsd6, token.decimals);
    if (balance < needed) continue;

    const usd6 = toUsd6(balance, token.decimals);
    if (usd6 > bestUsd6) {
      bestUsd6 = usd6;
      best = token;
    }
  }

  return best;
}
