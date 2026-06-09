import { describe, expect, it } from "vitest";
import { decodeFunctionData } from "viem";
import { erc20Abi } from "@/lib/contracts/tokens";
import { PEONES_PACKS, type PeonesPackSku } from "@/lib/payments/rail-config";
import { buildPeonesPackTransfer } from "@/lib/payments/transfer-builder";

const TREASURY = "0x1234567890abcdef1234567890abcdef12345678";
const USDC = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
const USDT = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e";
const CUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

describe("buildPeonesPackTransfer — happy path (USDC default)", () => {
  const tx = buildPeonesPackTransfer({ sku: "peones_pack_50", treasury: TREASURY });

  it("targets the USDC token contract with value 0n", () => {
    expect(tx.to).toBe(USDC);
    expect(tx.value).toBe(0n);
    expect(tx.token.symbol).toBe("USDC");
    expect(tx.token.decimals).toBe(6);
  });

  it("normalizes $0.50 to 500_000 (USDC 6 decimals)", () => {
    expect(tx.priceUsd6).toBe(500_000n);
    expect(tx.expectedAmount).toBe(500_000n);
    expect(tx.sku).toBe("peones_pack_50");
    expect(tx.source).toBe("pack_purchase");
    expect(tx.treasury).toBe(TREASURY);
  });

  it("encodes transfer(treasury, 500_000) calldata", () => {
    expect(tx.data.startsWith("0xa9059cbb")).toBe(true); // transfer selector
    const decoded = decodeFunctionData({ abi: erc20Abi, data: tx.data });
    expect(decoded.functionName).toBe("transfer");
    // viem returns the decoded address checksummed; compare case-insensitively.
    expect(String(decoded.args?.[0]).toLowerCase()).toBe(TREASURY);
    expect(decoded.args?.[1]).toBe(500_000n);
  });
});

describe("buildPeonesPackTransfer — other accepted stablecoins", () => {
  it("USDT (6 decimals) → 500_000", () => {
    const tx = buildPeonesPackTransfer({
      sku: "peones_pack_50",
      treasury: TREASURY,
      tokenSymbol: "USDT",
    });
    expect(tx.to).toBe(USDT);
    expect(tx.expectedAmount).toBe(500_000n);
  });

  it("cUSD (18 decimals) → 500_000 * 10^12", () => {
    const tx = buildPeonesPackTransfer({
      sku: "peones_pack_50",
      treasury: TREASURY,
      tokenSymbol: "cUSD",
    });
    expect(tx.to).toBe(CUSD);
    expect(tx.token.decimals).toBe(18);
    expect(tx.expectedAmount).toBe(500_000n * 10n ** 12n); // 5e17
    const decoded = decodeFunctionData({ abi: erc20Abi, data: tx.data });
    expect(decoded.args?.[1]).toBe(500_000n * 10n ** 12n);
  });
});

describe("buildPeonesPackTransfer — validation", () => {
  it("rejects an invalid treasury address", () => {
    expect(() =>
      buildPeonesPackTransfer({ sku: "peones_pack_50", treasury: "not-an-address" }),
    ).toThrow(/Invalid treasury/);
  });

  it("rejects an unknown pack SKU", () => {
    expect(() =>
      buildPeonesPackTransfer({
        sku: "peones_pack_999" as PeonesPackSku,
        treasury: TREASURY,
      }),
    ).toThrow(/Unknown pack SKU/);
  });

  it("rejects a non-allowlisted token", () => {
    expect(() =>
      buildPeonesPackTransfer({
        sku: "peones_pack_50",
        treasury: TREASURY,
        tokenSymbol: "DAI",
      }),
    ).toThrow(/not-allowlisted/);
  });

  it("does not require a real treasury env (a mock valid address works)", () => {
    expect(() =>
      buildPeonesPackTransfer({ sku: "peones_pack_50", treasury: TREASURY }),
    ).not.toThrow();
  });
});

describe("buildPeonesPackTransfer — purity", () => {
  it("does not mutate the pack config", () => {
    const before = JSON.stringify(
      PEONES_PACKS.peones_pack_50,
      (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    );
    buildPeonesPackTransfer({ sku: "peones_pack_50", treasury: TREASURY });
    const after = JSON.stringify(
      PEONES_PACKS.peones_pack_50,
      (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    );
    expect(after).toBe(before);
  });
});
