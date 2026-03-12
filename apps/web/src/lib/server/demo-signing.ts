import { ethers } from "ethers";

// NOTE: In-memory rate limit resets on serverless cold starts.
// For production, migrate to a persistent store (Upstash Redis / Vercel KV).
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_IP = 5;
const MAX_REQUESTS_PER_ADDRESS = 3;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

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
  const signer = new ethers.Wallet(requireEnv("SIGNER_PRIVATE_KEY"));

  return {
    chainId,
    badgesAddress,
    scoreboardAddress,
    signer,
  };
}

function checkRateLimit(key: string, max: number) {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  if (entry.count >= max) {
    throw new Error("Rate limit exceeded");
  }

  entry.count += 1;
  rateLimitStore.set(key, entry);
}

export function enforceRateLimit(ip: string, playerAddress?: string) {
  checkRateLimit(`ip:${ip}`, MAX_REQUESTS_PER_IP);
  if (playerAddress) {
    checkRateLimit(`addr:${playerAddress}`, MAX_REQUESTS_PER_ADDRESS);
  }
}

export function enforceOrigin(request: Request) {
  const allowedHost = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  if (!allowedHost) return; // skip check in dev if not configured

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

  const normalizedAllowed = allowedHost.replace(/^https?:\/\//, "");
  if (sourceHost !== allowedHost && sourceHost !== normalizedAllowed) {
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
