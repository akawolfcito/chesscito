import { spawnSync } from "node:child_process";
import {
  createPublicClient,
  decodeFunctionResult,
  encodeFunctionData,
  http,
  type AbiFunction,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

/** Lightweight wrapper around viem (read + encode) and foundry's cast
 *  (signing + send). The PK never enters this Node process — cast
 *  prompts for the keystore password in its own process and signs +
 *  broadcasts. We just generate calldata, optionally simulate, and
 *  parse cast's stdout for the final tx hash + receipt details. */

export type TxRunnerCtx = {
  rpcUrl: string;
  chainId: number;
  contract: Address;
  /** AbiFunction-style item; see commands for typed examples. */
  abiItem: AbiFunction;
  args: readonly unknown[];
};

export function buildCalldata(ctx: TxRunnerCtx): Hex {
  return encodeFunctionData({
    abi: [ctx.abiItem],
    functionName: ctx.abiItem.name,
    args: ctx.args as readonly never[],
  });
}

export function getPublicClient(rpcUrl: string): PublicClient {
  return createPublicClient({ transport: http(rpcUrl) });
}

/** Read a function via eth_call. Used for both pre-tx state snapshots
 *  ("what is itemId 5 today?") and post-tx verifications. */
export async function readContract<T>(
  client: PublicClient,
  contract: Address,
  abiItem: AbiFunction,
  args: readonly unknown[],
): Promise<T> {
  const data = encodeFunctionData({
    abi: [abiItem],
    functionName: abiItem.name,
    args: args as readonly never[],
  });
  const raw = await client.request({
    method: "eth_call",
    params: [{ to: contract, data }, "latest"],
  });
  return decodeFunctionResult({
    abi: [abiItem],
    functionName: abiItem.name,
    data: raw as Hex,
  }) as T;
}

/** Simulate the call as if `from` had sent it. Returns the decoded
 *  result on success, or the revert reason on failure. Useful before
 *  spending gas on a real tx. */
export async function simulate(
  client: PublicClient,
  ctx: TxRunnerCtx,
  from: Address,
): Promise<{ ok: true; result: unknown } | { ok: false; reason: string }> {
  const data = buildCalldata(ctx);
  try {
    const raw = await client.request({
      method: "eth_call",
      params: [{ to: ctx.contract, data, from }, "latest"],
    });
    const decoded = decodeFunctionResult({
      abi: [ctx.abiItem],
      functionName: ctx.abiItem.name,
      data: raw as Hex,
    });
    return { ok: true, result: decoded };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false, reason };
  }
}

export type CastResult =
  | { ok: true; txHash: Hex; blockNumber?: number; gasUsed?: number; sender?: Address }
  | { ok: false; reason: string };

/** Spawn `cast send` to actually sign + broadcast. The Node process
 *  never sees the private key — cast handles signing in its own
 *  subprocess, prompting for the keystore password.
 *
 *  We pass `--account <name>` (foundry keystore) by default; callers
 *  can override via the `account` option. Set `dryRun: true` to skip
 *  sending entirely. */
export function castSend(opts: {
  contract: Address;
  signature: string;
  args: readonly string[];
  rpcUrl: string;
  account: string;
  dryRun?: boolean;
}): CastResult {
  if (opts.dryRun) {
    return { ok: true, txHash: ("0x" + "0".repeat(64)) as Hex };
  }
  const cli = "cast";
  const cliArgs = [
    "send",
    opts.contract,
    opts.signature,
    ...opts.args,
    "--rpc-url",
    opts.rpcUrl,
    "--account",
    opts.account,
  ];
  const result = spawnSync(cli, cliArgs, { stdio: ["inherit", "pipe", "pipe"], encoding: "utf8" });
  if (result.error) {
    return { ok: false, reason: result.error.message };
  }
  if (result.status !== 0) {
    return { ok: false, reason: result.stderr || "cast exited with non-zero status" };
  }
  return parseCastSendOutput(result.stdout);
}

/** Parse the key=value blob `cast send` prints on success. Tolerant of
 *  fields being absent or out of order. */
export function parseCastSendOutput(stdout: string): CastResult {
  const fields = new Map<string, string>();
  for (const line of stdout.split("\n")) {
    const match = line.match(/^([a-zA-Z][a-zA-Z0-9]*)\s+(.+)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (!key || !value) continue;
    fields.set(key, value.trim());
  }
  const txHash = fields.get("transactionHash") as Hex | undefined;
  if (!txHash) {
    return { ok: false, reason: "cast send did not return a transactionHash" };
  }
  return {
    ok: true,
    txHash,
    blockNumber: fields.has("blockNumber") ? Number(fields.get("blockNumber")) : undefined,
    gasUsed: fields.has("gasUsed") ? Number(fields.get("gasUsed")) : undefined,
    sender: fields.get("from") as Address | undefined,
  };
}
