import { defineCommand } from "citty";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isAddress, type AbiFunction, type Address } from "viem";

import { getChainConfig, resolveChain } from "@/config";
import { getPublicClient, readContract, runWriteCommand } from "@/lib/tx-runner";
import { loadAccount } from "@/lib/wallet";

/** ShopUpgradeable.setAcceptedToken stores a token's decimals (uint8)
 *  in the acceptedTokens mapping — not a boolean. The contract uses
 *  the stored decimals when normalizing priceUsd6 to the token's
 *  smallest unit, so passing the wrong value would silently overcharge
 *  or undercharge buyers. To "blacklist", call `remove-accepted-token`
 *  instead. */
const SET_ACCEPTED_TOKEN_ABI: AbiFunction = {
  type: "function",
  name: "setAcceptedToken",
  stateMutability: "nonpayable",
  inputs: [
    { name: "token", type: "address" },
    { name: "tokenDecimals", type: "uint8" },
  ],
  outputs: [],
};

const ACCEPTED_TOKENS_ABI: AbiFunction = {
  type: "function",
  name: "acceptedTokens",
  stateMutability: "view",
  inputs: [{ name: "", type: "address" }],
  outputs: [{ name: "", type: "uint8" }],
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIT_ROOT = join(__dirname, "..", "..", "..");

/** Convenience aliases — typing the full CELO address every time is
 *  error-prone. Resolved against the active chain config so the same
 *  alias works on mainnet and testnet without code changes. */
function resolveTokenAlias(input: string, chainCelo: Address): Address {
  if (input.toUpperCase() === "CELO") return chainCelo;
  if (!isAddress(input)) {
    throw new Error(`Invalid token argument: "${input}". Pass an address or "CELO".`);
  }
  return input;
}

export default defineCommand({
  meta: {
    name: "set-accepted-token",
    description:
      "Whitelist a token for Shop.buyItem with its decimals (uint8). Use 6 for USDC/USDT, 18 for cUSD/CELO. To blacklist, use `remove-accepted-token`. Owner-only.",
  },
  args: {
    token: { type: "string", required: true, description: "ERC-20 address or alias (CELO)" },
    decimals: {
      type: "string",
      required: true,
      description: "Token decimals — must be between 6 and 18 (e.g. 6 for USDC, 18 for CELO/cUSD)",
    },
    chain: { type: "string", default: "celo" },
    "dry-run": { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
  },
  async run({ args }) {
    const chain = resolveChain(args.chain);
    const cfg = getChainConfig(chain);
    const token = resolveTokenAlias(args.token, cfg.celoToken);
    const decimals = Number.parseInt(args.decimals, 10);
    if (!Number.isInteger(decimals) || decimals < 6 || decimals > 18) {
      console.error("--decimals must be an integer between 6 and 18 (contract enforces InvalidDecimals).");
      process.exitCode = 1;
      return;
    }

    const client = getPublicClient(cfg.rpcUrl);
    const account = await loadAccount();

    const result = await runWriteCommand({
      command: "shop set-accepted-token",
      chain,
      contract: cfg.contracts.shop,
      abiItem: SET_ACCEPTED_TOKEN_ABI,
      args: [token, decimals],
      signature: "setAcceptedToken(address,uint8)",
      account,
      rpcUrl: cfg.rpcUrl,
      chainId: cfg.chainId,
      dryRun: Boolean(args["dry-run"]),
      yes: Boolean(args.yes),
      auditRoot: AUDIT_ROOT,
      preState: async () => {
        const v = await readContract<number>(client, cfg.contracts.shop, ACCEPTED_TOKENS_ABI, [token]);
        return v === 0 ? "not whitelisted" : `decimals=${v}`;
      },
      postState: async () => {
        const v = await readContract<number>(client, cfg.contracts.shop, ACCEPTED_TOKENS_ABI, [token]);
        return v === 0 ? "not whitelisted" : `decimals=${v}`;
      },
    });

    if (!result.ok) process.exitCode = 1;
  },
});
