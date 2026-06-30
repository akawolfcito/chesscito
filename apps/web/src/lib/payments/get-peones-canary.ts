import { ACCEPTED_TOKENS, normalizePrice } from "@/lib/contracts/tokens";
import { getPeonesPack } from "@/lib/payments/rail-config";

export const GET_PEONES_CANARY_CHAIN_ID = 42220 as const;
export const GET_PEONES_CANARY_SKU = "peones_pack_50" as const;
export const GET_PEONES_CANARY_REWARD = 50 as const;
export const GET_PEONES_CANARY_INTENT_TTL_SECONDS = 10 * 60;

/**
 * Current auth limitation: Get Peones has no SIWE/SIWC session. The intent
 * wallet is client-asserted, then cryptographically constrained by both the
 * canonical transaction sender and Transfer.from. This prevents redirecting
 * another payer's entitlement, but it is not strong account authentication.
 * The canary remains disabled unless the server explicitly acknowledges this.
 */
export const GET_PEONES_CANARY_AUTH_BINDING = "client_asserted_wallet" as const;

export type GetPeonesCanaryIntent = {
  id: string;
  wallet: `0x${string}`;
  sku: typeof GET_PEONES_CANARY_SKU;
  token: `0x${string}`;
  tokenSymbol: string;
  tokenDecimals: number;
  expectedAmount: string;
  chainId: typeof GET_PEONES_CANARY_CHAIN_ID;
  treasury: `0x${string}`;
  configVersion: string;
  priceVersion: string;
  requiredConfirmations: number;
  expiresAt: string;
  authBinding: typeof GET_PEONES_CANARY_AUTH_BINDING;
};

export function isGetPeonesCanaryClientRequested(): boolean {
  return process.env.NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED === "true";
}

export function getCanaryTokenByAddress(address: string) {
  const lower = address.toLowerCase();
  return ACCEPTED_TOKENS.find((token) => token.address.toLowerCase() === lower) ?? null;
}

export function getCanaryExpectedAmount(tokenDecimals: number): bigint {
  return normalizePrice(getPeonesPack(GET_PEONES_CANARY_SKU).priceUsd6, tokenDecimals);
}

