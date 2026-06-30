import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  isGetPeonesCanaryServerEnabled,
  resolveGetPeonesCanaryServerConfig,
} from "@/lib/payments/get-peones-canary-server";

const TREASURY = "0x1234567890abcdef1234567890abcdef12345678";
const USDT = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e";

const KEYS = [
  "GET_PEONES_TREASURY_CANARY_ENABLED",
  "CHESSCITO_TREASURY_CANARY_ADDRESS",
  "CHESSCITO_TREASURY_CANARY_CONFIG_VERSION",
  "CHESSCITO_TREASURY_CANARY_PRICE_VERSION",
  "CHESSCITO_TREASURY_CANARY_CONFIRMATIONS",
  "CHESSCITO_TREASURY_CANARY_TOKEN_ADDRESSES",
  "ALLOW_CLIENT_ASSERTED_WALLET_FOR_GET_PEONES_CANARY",
  "TREASURY_ADDRESS",
] as const;

beforeEach(() => {
  for (const key of KEYS) delete process.env[key];
});
afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

function configure() {
  process.env.GET_PEONES_TREASURY_CANARY_ENABLED = "true";
  process.env.CHESSCITO_TREASURY_CANARY_ADDRESS = TREASURY;
  process.env.CHESSCITO_TREASURY_CANARY_CONFIG_VERSION = "canary-v1";
  process.env.CHESSCITO_TREASURY_CANARY_PRICE_VERSION = "peones-50-v1";
  process.env.CHESSCITO_TREASURY_CANARY_CONFIRMATIONS = "2";
  process.env.CHESSCITO_TREASURY_CANARY_TOKEN_ADDRESSES = USDT;
  process.env.ALLOW_CLIENT_ASSERTED_WALLET_FOR_GET_PEONES_CANARY = "true";
}

describe("Get Peones Treasury canary server config", () => {
  it("defaults OFF", () => {
    expect(isGetPeonesCanaryServerEnabled()).toBe(false);
  });

  it("never falls back to TREASURY_ADDRESS", () => {
    process.env.TREASURY_ADDRESS = TREASURY;
    const result = resolveGetPeonesCanaryServerConfig();
    expect(result).toEqual({ ok: false, reason: "canary_treasury_missing" });
  });

  it("resolves one explicit versioned config", () => {
    configure();
    const result = resolveGetPeonesCanaryServerConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.treasury.toLowerCase()).toBe(TREASURY);
      expect(result.config.configVersion).toBe("canary-v1");
      expect(result.config.requiredConfirmations).toBe(2);
      expect(result.config.tokenAddresses.map((x) => x.toLowerCase())).toEqual([USDT.toLowerCase()]);
    }
  });

  it("rejects enablement unless client-asserted wallet risk is explicitly accepted", () => {
    configure();
    delete process.env.ALLOW_CLIENT_ASSERTED_WALLET_FOR_GET_PEONES_CANARY;
    expect(resolveGetPeonesCanaryServerConfig()).toEqual({
      ok: false,
      reason: "canary_client_asserted_wallet_not_allowed",
    });
  });

  it("rejects tokens outside existing metadata", () => {
    configure();
    process.env.CHESSCITO_TREASURY_CANARY_TOKEN_ADDRESSES =
      "0x9999888877776666555544443333222211110000";
    expect(resolveGetPeonesCanaryServerConfig()).toEqual({
      ok: false,
      reason: "canary_token_unsupported",
    });
  });
});
