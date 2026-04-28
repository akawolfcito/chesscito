import { defineCommand } from "citty";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isAddress, type AbiFunction, type Address } from "viem";

import { getChainConfig, resolveChain } from "@/config";
import { getPublicClient, readContract, runWriteCommand } from "@/lib/tx-runner";
import { loadAccount } from "@/lib/wallet";

const REMOVE_ACCEPTED_TOKEN_ABI: AbiFunction = {
  type: "function",
  name: "removeAcceptedToken",
  stateMutability: "nonpayable",
  inputs: [{ name: "token", type: "address" }],
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

function resolveTokenAlias(input: string, chainCelo: Address): Address {
  if (input.toUpperCase() === "CELO") return chainCelo;
  if (!isAddress(input)) {
    throw new Error(`Invalid token argument: "${input}". Pass an address or "CELO".`);
  }
  return input;
}

export default defineCommand({
  meta: {
    name: "remove-accepted-token",
    description:
      "Blacklist a token from Shop.buyItem by zeroing its acceptedTokens entry. Owner-only.",
  },
  args: {
    token: { type: "string", required: true, description: "ERC-20 address or alias (CELO)" },
    chain: { type: "string", default: "celo" },
    "dry-run": { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
  },
  async run({ args }) {
    const chain = resolveChain(args.chain);
    const cfg = getChainConfig(chain);
    const token = resolveTokenAlias(args.token, cfg.celoToken);

    const client = getPublicClient(cfg.rpcUrl);
    const account = await loadAccount();

    const result = await runWriteCommand({
      command: "shop remove-accepted-token",
      chain,
      contract: cfg.contracts.shop,
      abiItem: REMOVE_ACCEPTED_TOKEN_ABI,
      args: [token],
      signature: "removeAcceptedToken(address)",
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
