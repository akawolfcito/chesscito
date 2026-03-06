import { ethers } from "ethers";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;
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

export function enforceRateLimit(ip: string) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    throw new Error("Rate limit exceeded");
  }

  entry.count += 1;
  rateLimitStore.set(ip, entry);
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
