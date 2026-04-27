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

import { appendAuditEntry, type AuditEntry } from "@/lib/audit-log";
import { confirm } from "@/lib/confirm";

/** ABI for the standard Ownable.owner() read. Used to discover the
 *  expected sender for simulating owner-restricted write calls
 *  without asking the user to pass --from explicitly. */
const OWNER_ABI: AbiFunction = {
  type: "function",
  name: "owner",
  stateMutability: "view",
  inputs: [],
  outputs: [{ name: "", type: "address" }],
};

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

/** Read the contract `owner()` (Ownable / OwnableUpgradeable). Returns
 *  null when the call reverts — useful for non-Ownable contracts or
 *  when the explorer is mid-rotation. */
export async function readOwner(
  client: PublicClient,
  contract: Address,
): Promise<Address | null> {
  try {
    return await readContract<Address>(client, contract, OWNER_ABI, []);
  } catch {
    return null;
  }
}

/** High-level orchestrator for write commands. Reads pre-state,
 *  simulates the call as the owner, prints a preview, asks for
 *  confirmation (skippable with --yes), spawns cast send (or short-
 *  circuits in --dry-run mode), reads post-state, and appends one
 *  entry to the audit log no matter what. Always returns a result
 *  object; never throws. */
export type WriteOpts = {
  command: string;
  chain: string;
  contract: Address;
  abiItem: AbiFunction;
  args: readonly unknown[];
  signature: string;
  castArgs: readonly string[];
  account: string;
  rpcUrl: string;
  chainId: number;
  dryRun: boolean;
  yes: boolean;
  auditRoot: string;
  preState?: () => Promise<string>;
  postState?: () => Promise<string>;
};

export type WriteResult =
  | { ok: true; txHash: Hex }
  | { ok: true; dryRun: true }
  | { ok: false; reason: string };

export async function runWriteCommand(opts: WriteOpts): Promise<WriteResult> {
  const client = getPublicClient(opts.rpcUrl);
  const calldata = buildCalldata(opts);

  const owner = await readOwner(client, opts.contract);
  const before = opts.preState ? await opts.preState() : undefined;

  console.log("");
  console.log(`# ${opts.command}`);
  console.log(`  chain      : ${opts.chain} (id ${opts.chainId})`);
  console.log(`  contract   : ${opts.contract}`);
  console.log(`  signature  : ${opts.signature}`);
  console.log(`  args       : ${JSON.stringify(opts.args, replaceBigints)}`);
  console.log(`  calldata   : ${calldata}`);
  if (owner) console.log(`  owner      : ${owner} (used as simulation sender)`);
  if (before !== undefined) console.log(`  pre-state  : ${before}`);

  if (owner) {
    const sim = await simulate(client, opts, owner);
    if (!sim.ok) {
      console.error(`  simulate   : reverted — ${sim.reason}`);
      logEntry(opts, calldata, "simulation reverted: " + sim.reason, before, undefined, undefined);
      return { ok: false, reason: sim.reason };
    }
    console.log(`  simulate   : ok`);
  } else {
    console.log(`  simulate   : skipped (owner() unavailable)`);
  }

  if (opts.dryRun) {
    console.log(`  outcome    : dry-run (no tx broadcast)`);
    logEntry(opts, calldata, "dry-run", before, undefined, undefined);
    return { ok: true, dryRun: true };
  }

  if (!opts.yes) {
    const proceed = await confirm("Send this transaction?");
    if (!proceed) {
      console.log(`  outcome    : cancelled by user`);
      logEntry(opts, calldata, "cancelled by user", before, undefined, undefined);
      return { ok: false, reason: "cancelled by user" };
    }
  }

  const cast = castSend({
    contract: opts.contract,
    signature: opts.signature,
    args: opts.castArgs,
    rpcUrl: opts.rpcUrl,
    account: opts.account,
  });

  if (!cast.ok) {
    console.error(`  outcome    : cast send failed — ${cast.reason}`);
    logEntry(opts, calldata, "cast send failed: " + cast.reason, before, undefined, undefined);
    return { ok: false, reason: cast.reason };
  }

  const after = opts.postState ? await opts.postState() : undefined;
  console.log(`  txHash     : ${cast.txHash}`);
  if (cast.blockNumber !== undefined) console.log(`  block      : ${cast.blockNumber}`);
  if (cast.gasUsed !== undefined) console.log(`  gas used   : ${cast.gasUsed}`);
  if (after !== undefined) console.log(`  post-state : ${after}`);
  console.log(`  outcome    : success`);

  logEntry(opts, calldata, "success", before, after, cast);
  return { ok: true, txHash: cast.txHash };
}

function logEntry(
  opts: WriteOpts,
  calldata: Hex,
  outcome: string,
  before: string | undefined,
  after: string | undefined,
  cast: Extract<CastResult, { ok: true }> | undefined,
) {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    command: opts.command,
    chain: opts.chain,
    contract: opts.contract,
    functionSignature: opts.signature,
    args: opts.args,
    calldata,
    sender: cast?.sender,
    txHash: cast?.txHash,
    blockNumber: cast?.blockNumber,
    gasUsed: cast?.gasUsed,
    outcome,
    state: before !== undefined || after !== undefined ? { before, after } : undefined,
  };
  appendAuditEntry(opts.auditRoot, entry);
}

function replaceBigints(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
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
