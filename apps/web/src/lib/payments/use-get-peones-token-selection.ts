"use client";

/**
 * Stablecoin balance read + auto-selection for Get Peones (slice D,
 * 2026-06-09). Picks a PAYABLE stablecoin so we never repeat the smoke
 * bug (USDC default with 0 balance → "transfer amount exceeds balance").
 *
 * Pure `selectPayableToken` (fully testable) + `useGetPeonesTokenSelection`
 * (reads balances via useReadContracts, same pattern as the Shop). No
 * Shop/approve/contract/endpoint changes.
 */

import { useMemo, useState } from "react";
import { useAccount, useChainId, useReadContracts } from "wagmi";

import { erc20Abi, normalizePrice } from "@/lib/contracts/tokens";
import {
  getPeonesPack,
  RAIL_ACCEPTED_STABLECOINS,
  type PeonesPackSku,
} from "@/lib/payments/rail-config";

/** Auto-select preference: USDC, then USDT, then cUSD. USDC is the default
 *  ONLY when it has a sufficient balance. */
const PREFERENCE = ["USDC", "USDT", "cUSD"] as const;

function prefIndex(symbol: string): number {
  const i = (PREFERENCE as readonly string[]).indexOf(symbol);
  return i === -1 ? PREFERENCE.length : i;
}

export type TokenBalanceInput = {
  symbol: string;
  address: string;
  decimals: number;
  balance: bigint;
};

export type PayableToken = TokenBalanceInput & {
  expectedAmount: bigint;
  payable: boolean;
};

/**
 * Pure: given the pack price + per-token balances, compute each token's
 * required amount (normalized by decimals) + payability, in preference
 * order, and the first payable token (or null if none can pay).
 */
export function selectPayableToken(
  priceUsd6: bigint,
  balances: readonly TokenBalanceInput[],
): { tokens: PayableToken[]; autoSelected: string | null } {
  const tokens = [...balances]
    .sort((a, b) => prefIndex(a.symbol) - prefIndex(b.symbol))
    .map((t) => {
      const expectedAmount = normalizePrice(priceUsd6, t.decimals);
      return { ...t, expectedAmount, payable: t.balance >= expectedAmount };
    });
  return { tokens, autoSelected: tokens.find((t) => t.payable)?.symbol ?? null };
}

/* ------------------------------------------------------------------------- *
 * Read instrumentation (evidence pass, lote 1 — 2026-08-16)
 *
 * Everything below is PURELY ADDITIVE. `selectPayableToken` above is the
 * function that fixed the 2026-06-09 smoke bug and it stays untouched: this
 * describes the same reads it consumes, it never feeds them.
 *
 * The question in production: when a MiniPay wallet taps buy and we answer
 * "insufficient balance", is the wallet actually empty, or did `balanceOf`
 * FAIL? Today both — plus a third case, a read that has not arrived yet —
 * collapse into `0n` at line ~93 and are indistinguishable in the data.
 * ------------------------------------------------------------------------- */

/** `absent` is a REAL third state (read not arrived / index missing), not a
 *  synonym for `failure`. Telling them apart is the whole point. */
export type TokenReadStatus = "success" | "failure" | "absent";

/** Bounded by construction, like every other analytics dimension.
 *  `payable` is kept in the vocabulary even though a `no-token` event can
 *  never legitimately carry it — so that contradiction stays EXPRESSIBLE and
 *  therefore observable, instead of being impossible to report. */
export type BalanceBucket = "zero" | "dust" | "under_price" | "payable";

export type TokenReadOutcome = {
  symbol: string;
  status: TokenReadStatus;
  /** `null` whenever `status !== "success"` — a read that did not land has no
   *  balance to bucket, and reporting one would be a fabrication. */
  bucket: BalanceBucket | null;
};

/** The shape `useReadContracts` returns per contract with `allowFailure`. */
export type TokenReadResult =
  | { status: "success"; result: unknown }
  | { status: "failure"; error: unknown };

/** Below this fraction of the price, a balance is dust: technically nonzero,
 *  practically the same as empty. Cheap way to separate "never funded" from
 *  "funded and spent down". */
const DUST_FRACTION = 100n; // 1%

function bucketOf(balance: bigint, expectedAmount: bigint): BalanceBucket {
  // `payable` is tested FIRST so the bucket can never contradict
  // `selectPayableToken`, which compares `balance >= expectedAmount` — that
  // equivalence is asserted directly in the tests.
  if (balance >= expectedAmount) return "payable";
  if (balance === 0n) return "zero";
  if (balance * DUST_FRACTION < expectedAmount) return "dust";
  return "under_price";
}

/**
 * Classify each balance read, per token, WITHOUT touching selection.
 *
 * `expectedAmount` is normalized by the token's decimals exactly as
 * `selectPayableToken` does — cUSD at 18 decimals is where an unnormalized
 * comparison would silently call dust "payable".
 */
export function describeTokenReads(
  priceUsd6: bigint,
  tokens: readonly { symbol: string; decimals: number }[],
  data: readonly (TokenReadResult | undefined)[] | undefined,
): TokenReadOutcome[] {
  return tokens.map((t, i) => {
    const r = data?.[i];
    if (!r) return { symbol: t.symbol, status: "absent", bucket: null };
    // A `success` whose result is not a bigint produced no balance, so it is
    // reported as a failure rather than as a fourth category: an extra state
    // that changes no decision is cardinality without information.
    if (r.status !== "success" || typeof r.result !== "bigint") {
      return { symbol: t.symbol, status: "failure", bucket: null };
    }
    return {
      symbol: t.symbol,
      status: "success",
      bucket: bucketOf(r.result, normalizePrice(priceUsd6, t.decimals)),
    };
  });
}

/**
 * Flatten the outcomes into telemetry props.
 *
 * ⛔ FLAT STRINGS ON PURPOSE. `sanitizeProps` (`app/api/telemetry/route.ts`)
 * only copies string/number/boolean/null values; anything else — an array, a
 * nested object — is dropped SILENTLY and the event is still written, so the
 * row would look recorded while carrying nothing. An array of objects, the
 * obvious shape, is exactly the shape that disappears.
 */
export function tokenReadProps(
  outcomes: readonly TokenReadOutcome[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const o of outcomes) {
    out[`read_${o.symbol.toLowerCase()}`] =
      o.bucket === null ? o.status : `${o.status}:${o.bucket}`;
  }
  return out;
}

/**
 * Generic stablecoin balance read + payable auto-selection for ANY
 * single-tx purchase priced in USD6 (Peones packs, Season Pass, …).
 * Reads balances for all RAIL_ACCEPTED_STABLECOINS and auto-selects the
 * first payable one in USDC→USDT→cUSD preference order. This is what
 * prevents the "USDC default with 0 balance → transfer reverts" smoke
 * bug across every rail surface.
 */
export function useStablecoinTokenSelection(priceUsd6: bigint) {
  const { address } = useAccount();
  const chainId = useChainId();
  // Manual override; null = follow the auto-selection.
  const [override, setOverride] = useState<string | null>(null);

  const { data, isLoading } = useReadContracts({
    contracts: RAIL_ACCEPTED_STABLECOINS.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: address ? ([address] as const) : undefined,
      chainId,
    })),
    allowFailure: true,
    query: { enabled: Boolean(address), staleTime: 15_000 },
  });

  const { tokens, autoSelected } = useMemo(() => {
    // Fail-safe: a failed/missing read counts as 0 (not payable), never throws.
    const balances: TokenBalanceInput[] = RAIL_ACCEPTED_STABLECOINS.map((t, i) => {
      const r = data?.[i];
      const balance =
        r && r.status === "success" && typeof r.result === "bigint" ? r.result : 0n;
      return { symbol: t.symbol, address: t.address, decimals: t.decimals, balance };
    });
    return selectPayableToken(priceUsd6, balances);
  }, [data, priceUsd6]);

  // Same `data`, described instead of collapsed. Nothing downstream of the
  // selection reads this — it exists only so a blocked purchase can say WHY.
  const reads = useMemo(
    () =>
      describeTokenReads(
        priceUsd6,
        RAIL_ACCEPTED_STABLECOINS,
        data as readonly (TokenReadResult | undefined)[] | undefined,
      ),
    [data, priceUsd6],
  );

  const selectedSymbol = override ?? autoSelected;
  const selected = tokens.find((t) => t.symbol === selectedSymbol) ?? null;
  const loading = Boolean(address) && isLoading;
  // Insufficient ONLY once balances have loaded for a connected wallet.
  const noPayableToken = Boolean(address) && !loading && autoSelected === null;

  return {
    loading,
    tokens,
    reads,
    selectedSymbol,
    setSelectedSymbol: (s: string) => setOverride(s),
    selected,
    noPayableToken,
  };
}

export function useGetPeonesTokenSelection(sku: PeonesPackSku) {
  return useStablecoinTokenSelection(getPeonesPack(sku).priceUsd6);
}
