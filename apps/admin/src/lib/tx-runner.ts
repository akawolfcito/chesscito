import {
  createPublicClient,
  createWalletClient,
  decodeFunctionResult,
  defineChain,
  encodeFunctionData,
  http,
  type AbiFunction,
  type Account,
  type Address,
  type Chain as ViemChain,
  type Hex,
  type PublicClient,
} from "viem";
import { celo } from "viem/chains";

import { appendAuditEntry, type AuditEntry } from "@/lib/audit-log";
import { confirm } from "@/lib/prompt";

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

/** Manual definition for celo-sepolia — viem/chains doesn't export it
 *  yet at the version we pin. Kept side-by-side with mainnet so admin
 *  ops can flip between them with --chain. */
const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "Celo", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: ["https://forno.celo-sepolia.celo-testnet.org"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://celo-sepolia.blockscout.com" } },
  testnet: true,
});

function viemChainFor(chainId: number): ViemChain {
  if (chainId === celo.id) return celo;
  if (chainId === celoSepolia.id) return celoSepolia;
  throw new Error(`Unsupported chainId for viem signing: ${chainId}`);
}

export type TxRunnerCtx = {
  rpcUrl: string;
  chainId: number;
  contract: Address;
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
 *  result on success, or the revert reason on failure. */
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

/** Read the contract `owner()` (Ownable / OwnableUpgradeable). Returns
 *  null when the call reverts — useful for non-Ownable contracts. */
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

export type SendResult =
  | { ok: true; txHash: Hex; blockNumber?: number; gasUsed?: number; sender?: Address }
  | { ok: false; reason: string };

/** Sign + broadcast via viem using the provided account. The account
 *  carries its own signer (privateKeyToAccount) decrypted from the
 *  on-disk keystore by `lib/wallet.ts`. The PK lives in this Node
 *  process during the call and is scrubbed when the account is
 *  garbage-collected.  */
export async function viemSend(opts: {
  account: Account;
  contract: Address;
  abiItem: AbiFunction;
  args: readonly unknown[];
  rpcUrl: string;
  chainId: number;
}): Promise<SendResult> {
  const chain = viemChainFor(opts.chainId);
  const transport = http(opts.rpcUrl);
  const walletClient = createWalletClient({ account: opts.account, chain, transport });
  const publicClient = createPublicClient({ chain, transport });
  try {
    const txHash = await walletClient.writeContract({
      address: opts.contract,
      abi: [opts.abiItem],
      functionName: opts.abiItem.name,
      args: opts.args as readonly never[],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    return {
      ok: receipt.status === "success",
      txHash,
      blockNumber: Number(receipt.blockNumber),
      gasUsed: Number(receipt.gasUsed),
      sender: opts.account.address,
      ...(receipt.status !== "success" ? { reason: "tx mined but reverted" } : {}),
    } as SendResult;
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** High-level orchestrator for write commands. */
export type WriteOpts = {
  command: string;
  chain: string;
  contract: Address;
  abiItem: AbiFunction;
  args: readonly unknown[];
  signature: string;
  account: Account;
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
  console.log(`  signer     : ${opts.account.address}`);
  if (owner) console.log(`  owner      : ${owner} (used as simulation sender)`);
  if (before !== undefined) console.log(`  pre-state  : ${before}`);

  const simAs = owner ?? opts.account.address;
  const sim = await simulate(client, opts, simAs);
  if (!sim.ok) {
    console.error(`  simulate   : reverted — ${sim.reason}`);
    logEntry(opts, calldata, "simulation reverted: " + sim.reason, before, undefined, undefined);
    return { ok: false, reason: sim.reason };
  }
  console.log(`  simulate   : ok`);

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

  const send = await viemSend({
    account: opts.account,
    contract: opts.contract,
    abiItem: opts.abiItem,
    args: opts.args,
    rpcUrl: opts.rpcUrl,
    chainId: opts.chainId,
  });

  if (!send.ok) {
    console.error(`  outcome    : send failed — ${send.reason}`);
    logEntry(opts, calldata, "send failed: " + send.reason, before, undefined, undefined);
    return { ok: false, reason: send.reason };
  }

  const after = opts.postState ? await opts.postState() : undefined;
  console.log(`  txHash     : ${send.txHash}`);
  if (send.blockNumber !== undefined) console.log(`  block      : ${send.blockNumber}`);
  if (send.gasUsed !== undefined) console.log(`  gas used   : ${send.gasUsed}`);
  if (after !== undefined) console.log(`  post-state : ${after}`);
  console.log(`  outcome    : success`);

  logEntry(opts, calldata, "success", before, after, send);
  return { ok: true, txHash: send.txHash };
}

function logEntry(
  opts: WriteOpts,
  calldata: Hex,
  outcome: string,
  before: string | undefined,
  after: string | undefined,
  send: Extract<SendResult, { ok: true }> | undefined,
) {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    command: opts.command,
    chain: opts.chain,
    contract: opts.contract,
    functionSignature: opts.signature,
    args: opts.args,
    calldata,
    sender: send?.sender ?? opts.account.address,
    txHash: send?.txHash,
    blockNumber: send?.blockNumber,
    gasUsed: send?.gasUsed,
    outcome,
    state: before !== undefined || after !== undefined ? { before, after } : undefined,
  };
  appendAuditEntry(opts.auditRoot, entry);
}

function replaceBigints(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}
