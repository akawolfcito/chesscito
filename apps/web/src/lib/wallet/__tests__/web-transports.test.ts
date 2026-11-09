import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { celo } from "wagmi/chains";

import { CELO_WEB_RPC_URLS, createWebTransports } from "@/lib/wallet/web-transports";

// The web (Privy) branch reads the chain through OUR transport (useBalance,
// useWaitForTransactionReceipt). Forno 403s under burst in-browser (validation
// §10.7), so a bare http(forno) strands those reads. This module builds a
// fallback() over public, key-less Celo mainnet endpoints, rotating past a
// failing one. MiniPay never shares it — it injects its own RPC.

const moduleSource = readFileSync(
  resolve(process.cwd(), "src/lib/wallet/web-transports.ts"),
  "utf8",
);
const walletProviderSource = readFileSync(
  resolve(process.cwd(), "src/components/wallet-provider.tsx"),
  "utf8",
);

describe("CELO_WEB_RPC_URLS", () => {
  it("lists exactly three endpoints", () => {
    expect(CELO_WEB_RPC_URLS).toHaveLength(3);
  });

  it("is HTTPS only", () => {
    for (const url of CELO_WEB_RPC_URLS) {
      expect(url).toMatch(/^https:\/\//);
    }
  });

  it("carries no API key or placeholder — every endpoint is anonymous", () => {
    for (const url of CELO_WEB_RPC_URLS) {
      expect(url).not.toMatch(/api[_-]?key/i);
      expect(url).not.toMatch(/[<{]|\$\{|YOUR_/);
    }
  });

  it("keeps Forno last — it is best-effort, rate-limited, and the 403 source", () => {
    expect(CELO_WEB_RPC_URLS.at(-1)).toBe("https://forno.celo.org");
  });
});

describe("createWebTransports", () => {
  it("exposes only celo mainnet (42220)", () => {
    expect(Object.keys(createWebTransports())).toEqual([String(celo.id)]);
  });

  it("builds a fallback transport for celo mainnet", () => {
    const transport = createWebTransports()[celo.id];
    // viem transports are factories: invoke to read the resolved config.
    const { config } = transport({});
    expect(config.type).toBe("fallback");
  });
});

describe("branch isolation", () => {
  it("does not import MiniPay wallet configuration", () => {
    expect(moduleSource).not.toMatch(/@\/lib\/minipay/);
    expect(moduleSource).not.toMatch(/wallet-provider/);
  });

  it("is not imported by the MiniPay WalletProvider", () => {
    expect(walletProviderSource).not.toMatch(/web-transports/);
  });
});
