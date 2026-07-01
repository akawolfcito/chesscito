import { getAddress, isAddress } from "viem";

import {
  GET_PEONES_CANARY_AUTH_BINDING,
  GET_PEONES_CANARY_CHAIN_ID,
  GET_PEONES_CANARY_INTENT_TTL_SECONDS,
  getCanaryTokenByAddress,
} from "@/lib/payments/get-peones-canary";

const VERSION_RE = /^[a-zA-Z0-9._-]{1,64}$/;

export type GetPeonesCanaryServerConfig = {
  chainId: typeof GET_PEONES_CANARY_CHAIN_ID;
  treasury: `0x${string}`;
  configVersion: string;
  priceVersion: string;
  tokenAddresses: readonly `0x${string}`[];
  requiredConfirmations: number;
  intentTtlSeconds: number;
  authBinding: typeof GET_PEONES_CANARY_AUTH_BINDING;
};

export type GetPeonesCanaryConfigResult =
  | { ok: true; config: GetPeonesCanaryServerConfig }
  | { ok: false; reason: string };

export function isGetPeonesCanaryServerEnabled(): boolean {
  return process.env.GET_PEONES_TREASURY_CANARY_ENABLED === "true";
}

/**
 * Server-authoritative, canary-only config. It intentionally does not read
 * CHESSCITO_TREASURY_ADDRESS or TREASURY_ADDRESS, so Treasury mode can never
 * silently fall back to the legacy EOA recipient.
 */
export function resolveGetPeonesCanaryServerConfig(): GetPeonesCanaryConfigResult {
  const rawTreasury = process.env.CHESSCITO_TREASURY_CANARY_ADDRESS;
  if (!rawTreasury || !isAddress(rawTreasury)) {
    return { ok: false, reason: "canary_treasury_missing" };
  }

  const configVersion = process.env.CHESSCITO_TREASURY_CANARY_CONFIG_VERSION ?? "";
  const priceVersion = process.env.CHESSCITO_TREASURY_CANARY_PRICE_VERSION ?? "";
  if (!VERSION_RE.test(configVersion) || !VERSION_RE.test(priceVersion)) {
    return { ok: false, reason: "canary_version_missing" };
  }

  const rawConfirmations = process.env.CHESSCITO_TREASURY_CANARY_CONFIRMATIONS ?? "";
  const requiredConfirmations = Number.parseInt(rawConfirmations, 10);
  if (!Number.isInteger(requiredConfirmations) || requiredConfirmations < 1 || requiredConfirmations > 100) {
    return { ok: false, reason: "canary_finality_unconfigured" };
  }

  // Chesscito currently has no server-authenticated wallet session. Enabling
  // this separate, default-OFF gate is an explicit acceptance of the limited
  // client-asserted-wallet model; the canonical tx sender and Transfer.from
  // still constrain all credit to the wallet that actually paid.
  if (process.env.ALLOW_CLIENT_ASSERTED_WALLET_FOR_GET_PEONES_CANARY !== "true") {
    return { ok: false, reason: "canary_client_asserted_wallet_not_allowed" };
  }

  const rawTokens = process.env.CHESSCITO_TREASURY_CANARY_TOKEN_ADDRESSES ?? "";
  const entries = rawTokens.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (entries.length === 0) return { ok: false, reason: "canary_tokens_missing" };

  const normalized: `0x${string}`[] = [];
  for (const entry of entries) {
    if (!isAddress(entry) || !getCanaryTokenByAddress(entry)) {
      return { ok: false, reason: "canary_token_unsupported" };
    }
    const address = getAddress(entry);
    if (!normalized.some((candidate) => candidate.toLowerCase() === address.toLowerCase())) {
      normalized.push(address);
    }
  }

  return {
    ok: true,
    config: {
      chainId: GET_PEONES_CANARY_CHAIN_ID,
      treasury: getAddress(rawTreasury),
      configVersion,
      priceVersion,
      tokenAddresses: normalized,
      requiredConfirmations,
      intentTtlSeconds: GET_PEONES_CANARY_INTENT_TTL_SECONDS,
      authBinding: GET_PEONES_CANARY_AUTH_BINDING,
    },
  };
}

export function isTokenAllowedByCanaryConfig(
  config: GetPeonesCanaryServerConfig,
  token: string,
): boolean {
  return config.tokenAddresses.some((candidate) => candidate.toLowerCase() === token.toLowerCase());
}
