import { defineCommand } from "citty";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isAddress, type AbiFunction, type Address } from "viem";

import { getChainConfig, resolveChain } from "@/config";
import { getPublicClient, readContract, runWriteCommand } from "@/lib/tx-runner";
import { loadAccount } from "@/lib/wallet";

const SET_ACCEPTED_TOKEN_ABI: AbiFunction = {
  type: "function",
  name: "setAcceptedToken",
  stateMutability: "nonpayable",
  inputs: [
    { name: "token", type: "address" },
    { name: "accepted", type: "bool" },
  ],
  outputs: [],
};

const ACCEPTED_TOKENS_ABI: AbiFunction = {
  type: "function",
  name: "acceptedTokens",
  stateMutability: "view",
  inputs: [{ name: "", type: "address" }],
  outputs: [{ name: "", type: "bool" }],
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
    description: "Whitelist or blacklist a token for Shop.buyItem. Owner-only.",
  },
  args: {
    token: { type: "string", required: true, description: "ERC-20 address or alias (CELO)" },
    accepted: { type: "boolean", required: true, description: "true = whitelist, false = blacklist" },
    chain: { type: "string", default: "celo" },
    "dry-run": { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
  },
  async run({ args }) {
    const chain = resolveChain(args.chain);
    const cfg = getChainConfig(chain);
    const token = resolveTokenAlias(args.token, cfg.celoToken);
    const accepted = Boolean(args.accepted);

    const client = getPublicClient(cfg.rpcUrl);
    const account = await loadAccount();

    const result = await runWriteCommand({
      command: "shop set-accepted-token",
      chain,
      contract: cfg.contracts.shop,
      abiItem: SET_ACCEPTED_TOKEN_ABI,
      args: [token, accepted],
      signature: "setAcceptedToken(address,bool)",
      account,
      rpcUrl: cfg.rpcUrl,
      chainId: cfg.chainId,
      dryRun: Boolean(args["dry-run"]),
      yes: Boolean(args.yes),
      auditRoot: AUDIT_ROOT,
      preState: async () => {
        const v = await readContract<boolean>(client, cfg.contracts.shop, ACCEPTED_TOKENS_ABI, [token]);
        return String(v);
      },
      postState: async () => {
        const v = await readContract<boolean>(client, cfg.contracts.shop, ACCEPTED_TOKENS_ABI, [token]);
        return String(v);
      },
    });

    if (!result.ok) process.exitCode = 1;
  },
});
