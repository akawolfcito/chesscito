/**
 * POST /api/verify-payment
 *
 * Stablecoin single-tx payment rail — slice E (2026-06-09). First case:
 * `peones_pack_50`. Verifies an on-chain ERC20 Transfer to the treasury
 * and credits Peones (source `pack_purchase`) idempotently.
 *
 * The backend trusts NOTHING from the client for economics — amount,
 * reward, treasury, price are all server-decided from config/SKU. The
 * client only points at a txHash + the token it claims to have paid with.
 *
 * FAIL-CLOSED (preview + prod share env): if CHESSCITO_TREASURY_ADDRESS is
 * unset/invalid the endpoint returns `rail_not_configured` BEFORE any
 * receipt fetch, log decode, Supabase call, or credit — no path can ever
 * route funds-verification to a placeholder treasury.
 *
 * No UI, no tx send, no public rail activation. Does not touch
 * Shop/PRO/Founder/Victory/Arena or Peones spend.
 */

import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";

import { ACCEPTED_TOKENS, normalizePrice } from "@/lib/contracts/tokens";
import {
  buildPaymentIdempotencyKey,
  getPeonesPack,
  getTreasuryAddressServer,
  PEONES_PACKS,
  RAIL_ACCEPTED_STABLECOIN_ADDRESSES_LOWER,
  RAIL_OVERPAY_ACCEPTED,
  type PeonesPackSku,
} from "@/lib/payments/rail-config";
import { verifyStablecoinTransfer } from "@/lib/payments/verify-transfer";
import { normalizeWallet } from "@/lib/peones/ledger-service";
import { buildAttestationHash } from "@/lib/peones/ledger-service-server";
import {
  enforceOrigin,
  enforceReadRateLimit,
  getRequestIp,
} from "@/lib/server/demo-signing";
import { createLogger } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

const log = createLogger({ route: "/api/verify-payment" });

const CELO_MAINNET_CHAIN_ID = 42220;
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const client = createPublicClient({
  chain: celo,
  transport: http(process.env.CELO_RPC_URL),
});

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

type ParsedInput = {
  chainId: number;
  txHash: `0x${string}`;
  wallet: string;
  token: string;
  sku: PeonesPackSku;
};

/** Basic shape only — semantic checks (chain/token/sku) come after the
 *  fail-closed treasury gate. */
function parseShape(
  body: unknown,
): { ok: true; value: Omit<ParsedInput, "wallet"> & { wallet: string } } | { ok: false } {
  if (!isPlainObject(body)) return { ok: false };
  const { chainId, txHash, wallet, token, sku } = body;
  if (typeof chainId !== "number" || !Number.isInteger(chainId)) return { ok: false };
  if (typeof txHash !== "string" || !TX_HASH_RE.test(txHash)) return { ok: false };
  if (typeof wallet !== "string" || !ADDRESS_RE.test(wallet)) return { ok: false };
  if (typeof token !== "string" || !ADDRESS_RE.test(token)) return { ok: false };
  if (typeof sku !== "string" || sku.length === 0) return { ok: false };
  return {
    ok: true,
    value: {
      chainId,
      txHash: txHash as `0x${string}`,
      wallet: wallet.toLowerCase(),
      token: token.toLowerCase(),
      sku: sku as PeonesPackSku,
    },
  };
}

function err(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request) {
  try {
    enforceOrigin(req);
    await enforceReadRateLimit(getRequestIp(req));
  } catch (e) {
    log.warn("guard_failed", { reason: (e as Error)?.message });
    return err("rate_limited", 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("invalid_input", 400);
  }

  const parsed = parseShape(body);
  if (!parsed.ok) return err("invalid_input", 400);
  const { chainId, txHash, wallet, token, sku } = parsed.value;

  // ── FAIL-CLOSED treasury gate (before any chain/db/credit work) ──
  const treasury = getTreasuryAddressServer();
  if (!treasury) {
    log.warn("rail_not_configured", { sku, chainId });
    return err("rail_not_configured", 503);
  }

  // ── Semantic validation (server-decided) ───────────────────────
  if (chainId !== CELO_MAINNET_CHAIN_ID) return err("unsupported_chain", 400);
  if (!(sku in PEONES_PACKS)) return err("unknown_sku", 400);
  if (!RAIL_ACCEPTED_STABLECOIN_ADDRESSES_LOWER.includes(token)) {
    return err("unsupported_token", 400);
  }
  const pack = getPeonesPack(sku);
  const tokenEntry = ACCEPTED_TOKENS.find((t) => t.address.toLowerCase() === token);
  if (!tokenEntry) return err("unsupported_token", 400); // defensive
  const expectedAmount = normalizePrice(pack.priceUsd6, tokenEntry.decimals);

  // ── Receipt fetch + Transfer verification ──────────────────────
  let receipt: Awaited<ReturnType<typeof client.getTransactionReceipt>>;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash });
  } catch {
    return err("receipt_not_found", 400);
  }
  if (!receipt || receipt.status !== "success") return err("receipt_not_found", 400);

  const verdict = verifyStablecoinTransfer({
    logs: receipt.logs.map((l) => ({
      address: l.address,
      topics: l.topics,
      data: l.data,
      logIndex: l.logIndex ?? 0,
    })),
    expectedTreasury: treasury,
    fromWallet: wallet,
    acceptedTokenAddressesLower: [token],
    expectedAmount,
    overpayAccepted: RAIL_OVERPAY_ACCEPTED,
  });

  if (!verdict.ok) {
    if (verdict.reason === "treasury-not-configured" || verdict.reason === "invalid-treasury") {
      return err("rail_not_configured", 503);
    }
    if (verdict.reason === "amount-too-low") return err("amount_too_low", 400);
    return err("transfer_not_found", 400);
  }

  // ── Credit Peones (idempotent, server-decided amount) ──────────
  const idempotencyKey = buildPaymentIdempotencyKey({
    source: pack.source,
    chainId,
    txHash,
    logIndex: verdict.logIndex,
  });
  const walletNorm = normalizeWallet(wallet);
  const peonesCredited = pack.peonesReward;
  const amountPaid = verdict.amount.toString();

  const supabase = getSupabaseServer();
  if (!supabase) {
    log.error("supabase_unavailable", { wallet: walletNorm, sku });
    return err("ledger_unavailable", 503);
  }

  // Idempotency pre-check.
  const { data: existingRow, error: existingErr } = await supabase
    .from("peones_ledger")
    .select("id, amount, attestation_hash")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existingErr) {
    log.error("idempotency_lookup_failed", { idempotencyKey, code: existingErr.code });
    return err("ledger_unavailable", 503);
  }

  if (existingRow) {
    return NextResponse.json({
      ok: true,
      sku,
      wallet: walletNorm,
      peonesCredited: Number(existingRow.amount ?? peonesCredited),
      amountPaid,
      token,
      txHash,
      logIndex: verdict.logIndex,
      idempotencyKey,
      duplicate: true,
      overpaid: verdict.overpaid,
    });
  }

  const today = todayUtcDate();
  const attestationHash = buildAttestationHash({
    wallet: walletNorm,
    event_type: "earn",
    amount: peonesCredited,
    source: pack.source,
    source_id: sku,
    day_utc: today,
    idempotency_key: idempotencyKey,
  });

  const { data: insertedRow, error: insertError } = await supabase
    .from("peones_ledger")
    .insert({
      wallet: walletNorm,
      event_type: "earn",
      amount: peonesCredited,
      source: pack.source,
      source_id: sku,
      idempotency_key: idempotencyKey,
      attestation_hash: attestationHash,
      metadata: {
        sku,
        chainId,
        txHash,
        logIndex: verdict.logIndex,
        token,
        amountPaid,
        expectedAmount: expectedAmount.toString(),
        overpaid: verdict.overpaid,
        rail: "stablecoin_single_tx",
      },
      day_utc: today,
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    // Race: another in-flight request inserted the same idempotency_key.
    if (insertError.code === "23505") {
      const { data: raceRow } = await supabase
        .from("peones_ledger")
        .select("id, amount")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (raceRow) {
        return NextResponse.json({
          ok: true,
          sku,
          wallet: walletNorm,
          peonesCredited: Number(raceRow.amount ?? peonesCredited),
          amountPaid,
          token,
          txHash,
          logIndex: verdict.logIndex,
          idempotencyKey,
          duplicate: true,
          overpaid: verdict.overpaid,
        });
      }
    }
    log.error("insert_failed", { code: insertError.code, message: insertError.message });
    return err("ledger_write_failed", 500);
  }

  // Best-effort post-balance (non-fatal — newBalance is optional).
  let newBalance: number | undefined;
  try {
    const { data: capRows } = await supabase.rpc("peones_balance_with_caps", {
      p_wallet: walletNorm,
      p_day_utc: today,
    });
    const capRow = Array.isArray(capRows) ? capRows[0] : capRows;
    if (capRow) newBalance = Number(capRow.balance ?? 0);
  } catch {
    /* leave newBalance undefined */
  }

  return NextResponse.json({
    ok: true,
    sku,
    wallet: walletNorm,
    peonesCredited,
    amountPaid,
    token,
    txHash,
    logIndex: verdict.logIndex,
    idempotencyKey,
    duplicate: false,
    overpaid: verdict.overpaid,
    ledgerId: insertedRow?.id ?? null,
    ...(newBalance !== undefined ? { newBalance } : {}),
  });
}
