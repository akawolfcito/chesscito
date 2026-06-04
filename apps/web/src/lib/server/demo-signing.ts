import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { ethers } from "ethers";
import { decryptSignerKey } from "./crypto";
import { createLogger } from "./logger";

const originLog = createLogger({ route: "demo-signing.enforceOrigin" });

const MAX_REQUESTS_PER_IP = 5;
const MAX_REQUESTS_PER_ADDRESS = 3;
/** Higher-volume limit for read-only endpoints. Status reads (PRO chip,
 *  Coach credits) re-fire on every mount + wallet change, so the 5/min
 *  budget designed for signing endpoints starves the UI within a few
 *  scaffold↔legacy round-trips. 60/min/IP keeps abuse manageable while
 *  letting normal navigation breathe. Sized roughly to "1/sec sustained
 *  with bursts up to 5/sec" — comfortably above any UI-driven workload. */
const MAX_READ_REQUESTS_PER_IP = 60;

const redis = Redis.fromEnv();

const ipLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(MAX_REQUESTS_PER_IP, "60s"),
  prefix: "rl:ip",
});

const addrLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(MAX_REQUESTS_PER_ADDRESS, "60s"),
  prefix: "rl:addr",
});

const readIpLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(MAX_READ_REQUESTS_PER_IP, "60s"),
  prefix: "rl:read:ip",
});

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }

  return value;
}

export function getDemoConfig() {
  const chainId = Number.parseInt(requireEnv("NEXT_PUBLIC_CHAIN_ID"), 10);
  const badgesAddress = ethers.getAddress(requireEnv("NEXT_PUBLIC_BADGES_ADDRESS"));
  const scoreboardAddress = ethers.getAddress(requireEnv("NEXT_PUBLIC_SCOREBOARD_ADDRESS"));
  const victoryNFTAddress = ethers.getAddress(requireEnv("NEXT_PUBLIC_VICTORY_NFT_ADDRESS"));
  const signer = new ethers.Wallet(
    decryptSignerKey(requireEnv("TORRE_PRINCESA"), requireEnv("DRAGON"))
  );

  return {
    chainId,
    badgesAddress,
    scoreboardAddress,
    victoryNFTAddress,
    signer,
  };
}

// Scoped to /api/sign-labyrinth so score/victory/badge routes don't
// crash when the Labyrinth contract isn't deployed on a given chain
// (e.g. mainnet pre-D.2 promote — env var legitimately absent).
export function getLabyrinthBadgesAddress() {
  return ethers.getAddress(requireEnv("NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS"));
}

export async function enforceRateLimit(ip: string, playerAddress?: string) {
  const { success: ipOk } = await ipLimiter.limit(ip);
  if (!ipOk) throw new Error("Rate limit exceeded");

  if (playerAddress) {
    const { success: addrOk } = await addrLimiter.limit(playerAddress);
    if (!addrOk) throw new Error("Rate limit exceeded");
  }
}

/** Lenient IP-only rate limiter for read-only status endpoints
 *  (PRO chip, Coach credits, etc.). Reuses the same Redis backend as
 *  the strict limiter but with a separate prefix so the buckets don't
 *  cross-contaminate. */
export async function enforceReadRateLimit(ip: string) {
  const { success: ok } = await readIpLimiter.limit(ip);
  if (!ok) throw new Error("Rate limit exceeded");
}

export function enforceOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const source = origin ?? referer;

  // MiniPay's WebView may omit Origin/Referer on same-site fetches — allow through.
  // Security is still enforced by rate limiting, nonce uniqueness, and signature verification.
  //
  // Observability rollout (red-team P0-W2, 2026-05-31): the bypass is the
  // weakest link in the documented defense — any curl/server-side caller
  // omitting both headers also passes. Before tightening to "reject POST
  // without Origin in production" (which would re-break the March 2026
  // MiniPay incident in commit 44c6b500), instrument every bypass hit so
  // we can see which UAs and routes actually rely on it. Once 7 days of
  // telemetry confirm MiniPay is the only legit caller, replace the
  // early return with a UA-gated enforcement.
  if (!source) {
    if (process.env.VERCEL_ENV) {
      let path = "unknown";
      try {
        if (request.url) path = new URL(request.url).pathname;
      } catch {
        // request.url malformed — log "unknown" rather than crash the handler
      }
      originLog.warn("origin_bypass_triggered", {
        method: request.method ?? "unknown",
        path,
        user_agent: request.headers.get("user-agent")?.slice(0, 200) ?? null,
      });
    }
    return;
  }

  let sourceHost: string;
  try {
    sourceHost = new URL(source).host;
  } catch {
    throw new Error("Forbidden");
  }

  // Collect all allowed hosts: explicit app URL, optional preview alias,
  // Vercel deployment URL, Vercel branch alias, and production alias.
  const allowedHosts = new Set<string>();
  for (const envVar of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_PREVIEW_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    if (envVar) {
      allowedHosts.add(envVar.replace(/^https?:\/\//, ""));
    }
  }

  // No allowed hosts configured — skip check (dev environment)
  if (allowedHosts.size === 0) return;

  if (!allowedHosts.has(sourceHost)) {
    throw new Error("Forbidden");
  }
}

export function createNonce() {
  return BigInt(ethers.hexlify(ethers.randomBytes(8)));
}

export function createDeadline() {
  return BigInt(Math.floor(Date.now() / 1000) + 10 * 60);
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export function parseAddress(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Invalid player address");
  }

  return ethers.getAddress(value);
}

export function parseInteger(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Invalid ${field}`);
  }

  return BigInt(value);
}
