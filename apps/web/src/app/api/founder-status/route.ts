import { NextResponse } from "next/server";
import { createPublicClient, http, isAddress, parseAbiItem } from "viem";
import { celo } from "viem/chains";
import { Redis } from "@upstash/redis";
import {
  enforceOrigin,
  enforceReadRateLimit,
  getRequestIp,
} from "@/lib/server/demo-signing";
import {
  FOUNDER_BADGE_ITEM_ID,
  FOUNDER_BADGE_CELO_ITEM_ID,
} from "@/lib/contracts/shop-catalog";
import { createLogger } from "@/lib/server/logger";

const logger = createLogger({ route: "/api/founder-status" });

/**
 * Read-only check for whether a wallet has EVER purchased the Founder
 * Badge (itemId 1 = stablecoin sibling, or 5 = CELO sibling). Scans
 * `ItemPurchased` events emitted by ShopUpgradeable — Founder Badge
 * is fungible spend that emits an event but does NOT mint into the
 * BadgesUpgradeable ERC-721 contract (verified in §0.3 of the addendum),
 * so `Badges.balanceOf` would return 0 for a Founder-only wallet. This
 * route is the canonical Founder ownership read.
 *
 * Cached in Redis under `founder:{walletLower}` for 24h. Founder
 * ownership is permanent so stale-tolerant.
 */

export const dynamic = "force-dynamic";

// viem-typed event reference — lets us use the `args` filter for indexed
// params (buyer + itemId) without hand-packing topic hashes.
const ITEM_PURCHASED_EVENT = parseAbiItem(
  "event ItemPurchased(address indexed buyer, uint256 indexed itemId, uint256 quantity, uint256 unitPriceUsd6, uint256 totalTokenAmount, address indexed token, address treasury)",
);
const CACHE_TTL_SECONDS = 24 * 60 * 60;

const SHOP_ADDRESS = process.env.NEXT_PUBLIC_SHOP_ADDRESS as
  | `0x${string}`
  | undefined;

// Hardcoded fallback when `SHOP_DEPLOY_BLOCK_CELO` env var is unset or
// invalid. Mirrors `shopDeployedAt: 2026-03-12T16:47:12.872Z` from
// `apps/contracts/deployments/celo.json`. Update if Shop is redeployed
// to a new proxy. The env var still wins when set (e.g. preview deploys
// against a fresh Shop fixture). This eliminates the prior fallback to
// `fromBlock: "earliest"`, which Forno rejected as an unbounded range
// and caused the route to 500 after ~40s.
const SHOP_DEPLOY_BLOCK_FALLBACK = 37_800_000n;

// Stale-on-error TTL. When the chain read fails we still cache a
// degraded response (`stale: true`) so cold-cache hits don't burn ~40s
// of Function execution on every retry. Short enough that recovery is
// quick once the RPC heals.
const CHAIN_ERROR_CACHE_TTL_SECONDS = 5 * 60;

function getShopDeployBlock(): bigint {
  const raw = process.env.SHOP_DEPLOY_BLOCK_CELO;
  if (!raw) return SHOP_DEPLOY_BLOCK_FALLBACK;
  try {
    return BigInt(raw);
  } catch {
    return SHOP_DEPLOY_BLOCK_FALLBACK;
  }
}

const redis = Redis.fromEnv();

// `CELO_RPC_URL` lets us swap Forno for a higher-capacity provider
// (dRPC / Alchemy / QuickNode) when the unbounded historical scan
// stresses the public endpoint. Undefined falls back to the chain's
// default (Forno) inside viem's `http()`.
const client = SHOP_ADDRESS
  ? createPublicClient({
      chain: celo,
      transport: http(process.env.CELO_RPC_URL || undefined),
    })
  : null;

type FounderStatus = {
  ownsFounder: boolean;
  since: number | null;
  stale?: boolean;
};

export async function GET(req: Request) {
  try {
    enforceOrigin(req);
    await enforceReadRateLimit(getRequestIp(req));
  } catch (err) {
    logger.warn("auth rejected", {
      errName: err instanceof Error ? err.name : "unknown",
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!client || !SHOP_ADDRESS) {
    return NextResponse.json(
      { error: "Shop address not configured" },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }

  const cacheKey = `founder:${wallet}`;

  // Cache hit short-circuits the chain read.
  try {
    const cached = await redis.get<FounderStatus>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }
  } catch (err) {
    // Redis miss / outage — fall through to chain scan; do not 500.
    logger.warn("cache read failed", {
      errName: err instanceof Error ? err.name : "unknown",
    });
  }

  try {
    const logs = await client.getLogs({
      address: SHOP_ADDRESS,
      event: ITEM_PURCHASED_EVENT,
      args: {
        buyer: wallet as `0x${string}`,
        itemId: [FOUNDER_BADGE_ITEM_ID, FOUNDER_BADGE_CELO_ITEM_ID],
      },
      fromBlock: getShopDeployBlock(),
      toBlock: "latest",
    });

    if (logs.length === 0) {
      const status: FounderStatus = { ownsFounder: false, since: null };
      await safeSetCache(cacheKey, status);
      return NextResponse.json(status);
    }

    // Earliest block among the matching logs → approximate "since" timestamp.
    // We avoid an extra getBlock call here: the block number is enough for
    // the v1 signal. Future spec can promote to a real timestamp.
    const earliestBlock = logs.reduce(
      (acc, log) => (log.blockNumber < acc ? log.blockNumber : acc),
      logs[0].blockNumber,
    );

    const status: FounderStatus = {
      ownsFounder: true,
      since: Number(earliestBlock),
    };
    await safeSetCache(cacheKey, status);
    return NextResponse.json(status);
  } catch (err) {
    logger.error("getLogs failed", {
      wallet,
      errName: err instanceof Error ? err.name : "unknown",
      errMessage: err instanceof Error ? err.message : String(err),
    });
    // Stale-on-error: return a degraded `{ stale: true }` payload with
    // a short TTL so the next cold-cache hit doesn't pay another ~40s
    // of Function time. The consumer hook (`use-founder-status.ts`)
    // already tolerates `false` via its own localStorage cache, so
    // founders without local cache will reconverge once the RPC heals.
    const staleStatus: FounderStatus = {
      ownsFounder: false,
      since: null,
      stale: true,
    };
    await safeSetCache(cacheKey, staleStatus, CHAIN_ERROR_CACHE_TTL_SECONDS);
    return NextResponse.json(staleStatus);
  }
}

async function safeSetCache(
  key: string,
  value: FounderStatus,
  ttlSeconds: number = CACHE_TTL_SECONDS,
) {
  try {
    await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
  } catch (err) {
    logger.warn("cache write failed", {
      errName: err instanceof Error ? err.name : "unknown",
    });
  }
}
