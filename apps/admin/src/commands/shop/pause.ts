import { defineCommand } from "citty";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type AbiFunction } from "viem";

import { getChainConfig, resolveChain } from "@/config";
import { getPublicClient, readContract, runWriteCommand } from "@/lib/tx-runner";
import { loadAccount } from "@/lib/wallet";

const PAUSE_ABI: AbiFunction = {
  type: "function",
  name: "pause",
  stateMutability: "nonpayable",
  inputs: [],
  outputs: [],
};

const PAUSED_ABI: AbiFunction = {
  type: "function",
  name: "paused",
  stateMutability: "view",
  inputs: [],
  outputs: [{ name: "", type: "bool" }],
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIT_ROOT = join(__dirname, "..", "..", "..");

export default defineCommand({
  meta: {
    name: "pause",
    description: "Emergency pause — blocks Shop.buyItem until unpause(). Owner-only.",
  },
  args: {
    chain: { type: "string", default: "celo" },
    "dry-run": { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
  },
  async run({ args }) {
    const chain = resolveChain(args.chain);
    const cfg = getChainConfig(chain);
    const client = getPublicClient(cfg.rpcUrl);
    const account = await loadAccount();

    const result = await runWriteCommand({
      command: "shop pause",
      chain,
      contract: cfg.contracts.shop,
      abiItem: PAUSE_ABI,
      args: [],
      signature: "pause()",
      account,
      rpcUrl: cfg.rpcUrl,
      chainId: cfg.chainId,
      dryRun: Boolean(args["dry-run"]),
      yes: Boolean(args.yes),
      auditRoot: AUDIT_ROOT,
      preState: async () => {
        const v = await readContract<boolean>(client, cfg.contracts.shop, PAUSED_ABI, []);
        return `paused=${v}`;
      },
      postState: async () => {
        const v = await readContract<boolean>(client, cfg.contracts.shop, PAUSED_ABI, []);
        return `paused=${v}`;
      },
    });

    if (!result.ok) process.exitCode = 1;
  },
});
