import { Ratelimit } from "@upstash/ratelimit";
import { ethers } from "ethers";
import { classifyProOriginHost } from "@/lib/pro/pro-origin";
import { decryptSignerKey } from "./crypto";
import { createLogger } from "./logger";
import { getRedis } from "./redis";

const originLog = createLogger({ route: "demo-signing.enforceOrigin" });

const MAX_REQUESTS_PER_IP = 5;
const MAX_REQUESTS_PER_ADDRESS = 3;

/** Shared, time-bounded client (see `./redis.ts`). The bare `Redis.fromEnv()`
 *  that used to live here inherited the SDK's six-attempt retry ladder with no
 *  timeout — the mechanism behind the guard stalls of 2026-08-03. */
const redis = getRedis();

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

/** Soft per-IP limit for the off-chain SaveScore endpoint
 *  (POST /api/scores/save). DEDICATED bucket (prefix rl:score:ip) so it
 *  never cross-contaminates the strict signing bucket (5/min, the one
 *  that produced the 429 loop) nor the 60/min read bucket. Sized for
 *  normal play: a user finishes an exercise every few seconds at most,
 *  so 30/min/IP is comfortably above real usage while still capping
 *  write-spam against the DB + Peones ledger. */
const MAX_SCORE_SAVE_REQUESTS_PER_IP = 30;

const scoreSaveIpLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(MAX_SCORE_SAVE_REQUESTS_PER_IP, "60s"),
  prefix: "rl:score:ip",
});

/** Per-wallet limit for POST /api/focus-day. Keyed by wallet, not IP: the
 *  thing being protected is one wallet's ledger, and a household behind one
 *  NAT is not abuse. A Focus Day is written once per day plus the odd retry,
 *  so 10 per 10 minutes is orders of magnitude above real use and still caps
 *  a loop. Idempotency does NOT depend on this — the UNIQUE guarantees it. */
const MAX_FOCUS_DAY_REQUESTS_PER_WALLET = 10;

const focusDayWalletLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(MAX_FOCUS_DAY_REQUESTS_PER_WALLET, "600s"),
  prefix: "rl:focus-day:wallet",
});

/** Throws "Rate limit exceeded" on overflow; the route maps it to 429. */
export async function enforceFocusDayRateLimit(wallet: string) {
  const { success: ok } = await focusDayWalletLimiter.limit(wallet);
  if (!ok) throw new Error("Rate limit exceeded");
}

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

/** Soft IP-only limiter for the off-chain SaveScore endpoint. Throws
 *  "Rate limit exceeded" on overflow; the route maps that to a 429
 *  `rate_limited` with a retry hint. Dedicated bucket — see
 *  `scoreSaveIpLimiter`. */
export async function enforceScoreSaveRateLimit(ip: string) {
  const { success: ok } = await scoreSaveIpLimiter.limit(ip);
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

  // The DEV warning uses this exact classifier. Keep the acceptance boundary
  // host-based (hostname + port, no protocol) unless separately approved.
  const classification = classifyProOriginHost(source, [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_PREVIEW_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]);

  // No allowed hosts configured — skip check (dev environment)
  if (classification.status === "unconfigured") return;

  if (classification.status !== "allowed") {
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
