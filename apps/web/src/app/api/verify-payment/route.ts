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
import { getRedis } from "@/lib/server/redis";

import { ACCEPTED_TOKENS, normalizePrice } from "@/lib/contracts/tokens";
import {
  buildPaymentIdempotencyKey,
  getPeonesPack,
  getProPack,
  getSeasonPass,
  getTreasuryAddressServer,
  PEONES_PACKS,
  PRO_PACKS,
  RAIL_ACCEPTED_STABLECOIN_ADDRESSES_LOWER,
  RAIL_OVERPAY_ACCEPTED,
  SEASON_PASSES,
  SEASON_PASS_SOURCE,
  type PeonesPackSku,
  type ProPackSku,
  type SeasonPassSku,
} from "@/lib/payments/rail-config";
import { verifyStablecoinTransfer } from "@/lib/payments/verify-transfer";
import { isLiteModeServer } from "@/lib/feature-flags";
import { normalizeWallet } from "@/lib/peones/ledger-service";
import { buildAttestationHash } from "@/lib/peones/ledger-service-server";
import { enforceOrigin, getRequestIp } from "@/lib/server/demo-signing";
import { enforceReadRateLimit } from "@/lib/server/rate-limit";
import { createLogger } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import { extendProExpiry } from "@/lib/coach/pro-extend";
import { isProActive } from "@/lib/pro/is-active";

const redis = getRedis();

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
  sku: string; // widened — semantic SKU type check happens post-treasury gate
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
  // FAIL-CLOSED: payment verification.
  try {
    enforceOrigin(req);
    await enforceReadRateLimit(getRequestIp(req), "verify-payment");
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

  const isSeasonPass = sku in SEASON_PASSES;
  const isPeonesPack = sku in PEONES_PACKS;
  const isProPack = sku in PRO_PACKS;
  if (!isSeasonPass && !isPeonesPack && !isProPack) return err("unknown_sku", 400);

  // Lite-only entitlement: the Season Pass SKU is rejected in Full builds so
  // it can never be credited outside Chesscito Lite. Peones packs + PRO
  // unaffected — PRO is available in both Lite and Full.
  if (isSeasonPass && !isLiteModeServer()) {
    log.warn("season_pass_unavailable_full_mode", { sku, chainId });
    return err("season_pass_unavailable", 404);
  }

  // PRO already includes effective Training Pass access. Reject before any
  // receipt fetch or settlement work so the server never converts a direct
  // transfer into a duplicate Season Pass purchase or a +3 Shields grant.
  if (isSeasonPass) {
    try {
      const pro = await isProActive(wallet);
      if (pro.active) return err("included_with_pro", 409);
    } catch (e) {
      log.error("pro_status_check_failed_before_season_pass", {
        wallet,
        err: String(e),
      });
      return err("entitlement_unavailable", 503);
    }
  }

  if (!RAIL_ACCEPTED_STABLECOIN_ADDRESSES_LOWER.includes(token)) {
    return err("unsupported_token", 400);
  }
  const priceUsd6 = isSeasonPass
    ? getSeasonPass(sku as SeasonPassSku).priceUsd6
    : isProPack
      ? getProPack(sku as ProPackSku).priceUsd6
      : getPeonesPack(sku as PeonesPackSku).priceUsd6;
  const tokenEntry = ACCEPTED_TOKENS.find((t) => t.address.toLowerCase() === token);
  if (!tokenEntry) return err("unsupported_token", 400); // defensive
  const expectedAmount = normalizePrice(priceUsd6, tokenEntry.decimals);

  // ── Receipt fetch + Transfer verification ──────────────────────
  let receipt: Awaited<ReturnType<typeof client.getTransactionReceipt>>;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash });
  } catch {
    return err("receipt_not_found", 400);
  }
  if (!receipt || receipt.status !== "success") return err("receipt_not_found", 400);

  // Anti-replay: the rail is a DIRECT `token.transfer(treasury, amount)`,
  // so the tx recipient MUST be the payment token contract. The Shop's
  // buyItem does `safeTransferFrom(buyer, treasury, ...)` to the SAME
  // treasury and emits an identical Transfer event — requiring tx.to ==
  // token excludes Shop (and any other contract-mediated) payments from
  // being replayed here to double-credit Peones.
  if (!receipt.to || receipt.to.toLowerCase() !== token) {
    return err("not_direct_transfer", 400);
  }

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

  // ── Season Pass branch (Chesscito Lite only) ───────────────────
  if (isSeasonPass) {
    const pass = getSeasonPass(sku as SeasonPassSku);
    const idempotencyKey = `${SEASON_PASS_SOURCE}:${chainId}:${txHash.toLowerCase()}:${verdict.logIndex}`;
    const walletNorm = normalizeWallet(wallet);
    const amountPaid = verdict.amount.toString();

    const supabase = getSupabaseServer();
    if (!supabase) {
      log.error("supabase_unavailable_season_pass", { wallet: walletNorm, sku });
      return err("ledger_unavailable", 503);
    }

    const expiresAt = new Date(Date.now() + pass.accessDurationDays * 86_400_000).toISOString();
    const paymentMetadata = { rail: "stablecoin_single_tx", overpaid: verdict.overpaid };
    const { data: settlement, error: settlementError } = await supabase.rpc(
      "consume_lite_season_pass_payment",
      {
        p_chain_id: chainId,
        p_tx_hash: txHash.toLowerCase(),
        p_log_index: verdict.logIndex,
        p_wallet: walletNorm,
        p_sku: pass.sku,
        p_season_id: pass.seasonId,
        p_token_address: token,
        p_treasury_address: treasury,
        p_amount_paid: amountPaid,
        p_idempotency_key: idempotencyKey,
        p_shields: pass.shieldsOnPurchase,
        p_supporter_status: pass.supporterStatus,
        p_expires_at: expiresAt,
        p_metadata: paymentMetadata,
      },
    );
    if (settlementError) {
      const replay = String(settlementError.message).includes("payment_replay");
      log.warn(replay ? "payment_replay" : "season_pass_insert_failed", { code: settlementError.code });
      return err(replay ? "payment_replay" : "ledger_write_failed", replay ? 409 : 500);
    }

    const settlementRow = Array.isArray(settlement) ? settlement[0] : settlement;
    const duplicate = settlementRow?.outcome === "duplicate";
    const persistedExpiry = String(settlementRow?.expires_at ?? expiresAt);
    const persistedMeta = isPlainObject(settlementRow?.metadata) ? settlementRow.metadata : paymentMetadata;
    let shieldsCredited = Number(settlementRow?.shields_credited ?? pass.shieldsOnPurchase);
    let shieldsPending = duplicate &&
      (shieldsCredited < pass.shieldsOnPurchase || persistedMeta.shieldsPending === true);

    // New settlements and explicitly pending duplicates receive/recover the
    // Redis companion grant. A completed duplicate never increments again.
    if (!duplicate || shieldsPending) {
      try {
        await redis.incrby(REDIS_KEYS.shieldsCredited(walletNorm), pass.shieldsOnPurchase);
        const ttlMs = pass.accessDurationDays * 86_400_000;
        await redis.set(REDIS_KEYS.seasonPass(walletNorm), persistedExpiry, { px: ttlMs });
        if (shieldsPending) {
          await supabase.from("lite_season_passes").update({
            shields_credited: pass.shieldsOnPurchase,
            metadata: { ...persistedMeta, shieldsPending: false },
          }).eq("idempotency_key", idempotencyKey);
        }
        shieldsCredited = pass.shieldsOnPurchase;
        shieldsPending = false;
      } catch (redisErr) {
        log.error("season_pass_redis_failed_after_insert", { wallet: walletNorm, err: String(redisErr) });
        shieldsCredited = 0;
        shieldsPending = true;
        await supabase.from("lite_season_passes").update({
          shields_credited: 0,
          metadata: { ...persistedMeta, shieldsPending: true },
        }).eq("idempotency_key", idempotencyKey).then(undefined, (e: unknown) =>
          log.error("season_pass_pending_persist_failed", { err: String(e) }));
      }
    }

    return NextResponse.json({
      ok: true,
      sku,
      wallet: walletNorm,
      seasonId: pass.seasonId,
      expiresAt: persistedExpiry,
      shieldsCredited,
      shieldsPending: shieldsPending || undefined,
      supporterStatus: pass.supporterStatus,
      amountPaid,
      token,
      txHash,
      duplicate,
      overpaid: verdict.overpaid,
    });
  }

  // ── Chesscito PRO branch (no-approve rail; Shop.buyItem stays live) ────
  if (isProPack) {
    const pack = getProPack(sku as ProPackSku);
    const idempotencyKey = `${pack.source}:${chainId}:${txHash.toLowerCase()}:${verdict.logIndex}`;
    const walletNorm = normalizeWallet(wallet);
    const amountPaid = verdict.amount.toString();

    const supabase = getSupabaseServer();
    if (!supabase) {
      log.error("supabase_unavailable_pro", { wallet: walletNorm, sku });
      return err("ledger_unavailable", 503);
    }

    // Same per-tx dedupe as the Shop.buyItem PRO grant path
    // (/api/verify-pro) — a real on-chain tx hash is globally unique, so
    // this prevents a retried/replayed verify call from extending Redis
    // twice for one payment, regardless of which route processes it.
    const txProcessedKey = REDIS_KEYS.proProcessedTx(txHash.toLowerCase());
    const alreadyProcessed = await redis.get(txProcessedKey);
    let expiresAtMs: number;
    if (alreadyProcessed) {
      expiresAtMs = Number((await redis.get<string>(REDIS_KEYS.pro(walletNorm))) ?? 0);
    } else {
      expiresAtMs = await extendProExpiry(redis, REDIS_KEYS.pro(walletNorm));
      await redis.set(txProcessedKey, "1", { ex: 90 * 24 * 60 * 60 });
    }

    const paymentMetadata = { rail: "stablecoin_single_tx", overpaid: verdict.overpaid };
    const { data: settlement, error: settlementError } = await supabase.rpc(
      "consume_pro_treasury_payment",
      {
        p_chain_id: chainId,
        p_tx_hash: txHash.toLowerCase(),
        p_log_index: verdict.logIndex,
        p_wallet: walletNorm,
        p_sku: pack.sku,
        p_token_address: token,
        p_treasury_address: treasury,
        p_amount_paid: amountPaid,
        p_idempotency_key: idempotencyKey,
        p_expires_at: new Date(expiresAtMs).toISOString(),
        p_metadata: paymentMetadata,
      },
    );
    if (settlementError) {
      const replay = String(settlementError.message).includes("payment_replay");
      log.warn(replay ? "payment_replay" : "pro_insert_failed", { code: settlementError.code });
      return err(replay ? "payment_replay" : "ledger_write_failed", replay ? 409 : 500);
    }

    const settlementRow = Array.isArray(settlement) ? settlement[0] : settlement;
    const duplicate = settlementRow?.outcome === "duplicate";
    const persistedExpiry = settlementRow?.expires_at
      ? new Date(settlementRow.expires_at as string).getTime()
      : expiresAtMs;

    return NextResponse.json({
      ok: true,
      sku,
      wallet: walletNorm,
      expiresAt: persistedExpiry,
      amountPaid,
      token,
      txHash,
      duplicate,
      overpaid: verdict.overpaid,
    });
  }

  // ── Credit Peones (idempotent, server-decided amount) ──────────
  const pack = getPeonesPack(sku as PeonesPackSku);
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

  const paymentMetadata = {
    sku,
    chainId,
    txHash,
    logIndex: verdict.logIndex,
    token,
    amountPaid,
    expectedAmount: expectedAmount.toString(),
    overpaid: verdict.overpaid,
    rail: "stablecoin_single_tx",
  };
  const { data: settlement, error: settlementError } = await supabase.rpc(
    "consume_legacy_get_peones_payment",
    {
      p_chain_id: chainId,
      p_tx_hash: txHash.toLowerCase(),
      p_log_index: verdict.logIndex,
      p_wallet: walletNorm,
      p_sku: sku,
      p_token_address: token,
      p_treasury_address: treasury,
      p_amount_paid: amountPaid,
      p_peones: peonesCredited,
      p_idempotency_key: idempotencyKey,
      p_attestation_hash: attestationHash,
      p_day_utc: today,
      p_metadata: paymentMetadata,
    },
  );
  if (settlementError) {
    const replay = String(settlementError.message).includes("payment_replay");
    log.warn(replay ? "payment_replay" : "ledger_write_failed", { code: settlementError.code });
    return err(replay ? "payment_replay" : "ledger_write_failed", replay ? 409 : 500);
  }
  const settlementRow = Array.isArray(settlement) ? settlement[0] : settlement;
  const duplicate = settlementRow?.outcome === "duplicate";

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
    duplicate,
    overpaid: verdict.overpaid,
    ledgerId: settlementRow?.ledger_id ?? null,
    ...(newBalance !== undefined ? { newBalance } : {}),
  });
}
