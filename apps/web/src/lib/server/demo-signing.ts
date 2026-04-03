import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { ethers } from "ethers";
import { decryptSignerKey } from "./crypto";

const MAX_REQUESTS_PER_IP = 5;
const MAX_REQUESTS_PER_ADDRESS = 3;

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

export async function enforceRateLimit(ip: string, playerAddress?: string) {
  const { success: ipOk } = await ipLimiter.limit(ip);
  if (!ipOk) throw new Error("Rate limit exceeded");

  if (playerAddress) {
    const { success: addrOk } = await addrLimiter.limit(playerAddress);
    if (!addrOk) throw new Error("Rate limit exceeded");
  }
}

export function enforceOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const source = origin ?? referer;

  // MiniPay's WebView may omit Origin/Referer on same-site fetches — allow through.
  // Security is still enforced by rate limiting, nonce uniqueness, and signature verification.
  if (!source) return;

  let sourceHost: string;
  try {
    sourceHost = new URL(source).host;
  } catch {
    throw new Error("Forbidden");
  }

  // Collect all allowed hosts: explicit app URL, Vercel deployment URL, and production alias
  const allowedHosts = new Set<string>();
  for (const envVar of [process.env.NEXT_PUBLIC_APP_URL, process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
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
