import { mkdirSync, appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Append-only audit log for every admin tx the CLI sends. One markdown
 *  file per UTC day so logs stay easy to skim, plus a JSON line per
 *  entry on a sibling `.jsonl` file so we can grep / pipe later if
 *  needed. Both files live in the gitignored `audit-log/` directory. */

export type AuditEntry = {
  /** ISO-8601 UTC timestamp at the moment we wrote the log. */
  timestamp: string;
  /** Human-readable command — e.g. "shop set-item". */
  command: string;
  /** Target chain identifier (matches admin/config.ts). */
  chain: string;
  /** Contract address that received the call. */
  contract: `0x${string}`;
  /** Solidity-style function signature, e.g. setItem(uint256,uint256,bool). */
  functionSignature: string;
  /** Decoded args printed verbatim, mostly for human review. */
  args: readonly unknown[];
  /** Hex calldata that was actually broadcast. Useful for replay /
   *  forensic verification. */
  calldata: `0x${string}`;
  /** Wallet that signed (read from cast output). */
  sender?: `0x${string}`;
  /** Resulting tx hash on success. */
  txHash?: `0x${string}`;
  /** Block number where the tx was mined. */
  blockNumber?: number;
  /** Gas units actually consumed. */
  gasUsed?: number;
  /** Brief outcome, e.g. "success", "dry-run", "rejected", or an error
   *  message when the cast call failed. */
  outcome: string;
  /** Optional pre + post state snapshot to make the log self-contained.
   *  e.g. `{ before: "(0, false)", after: "(1000000, true)" }` for a
   *  setItem call. */
  state?: { before?: string; after?: string };
};

const HEADER = `# Admin audit log — entries appended by apps/admin CLI

Every successful, dry-run, or failed admin tx writes one block here.
Markdown is for skimming; JSONL sibling is for grep / scripting.

`;

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function logDir(rootDir: string): string {
  return join(rootDir, "audit-log");
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function ensureMarkdownHeader(filePath: string) {
  if (!existsSync(filePath)) {
    appendFileSync(filePath, HEADER, "utf8");
  }
}

function formatMarkdown(entry: AuditEntry): string {
  const lines: string[] = [];
  lines.push(`## ${entry.timestamp} · ${entry.command}`);
  lines.push("");
  lines.push(`- **Chain**: ${entry.chain}`);
  lines.push(`- **Contract**: \`${entry.contract}\``);
  lines.push(`- **Function**: \`${entry.functionSignature}\``);
  lines.push(`- **Args**: \`${JSON.stringify(entry.args, replaceBigints)}\``);
  lines.push(`- **Calldata**: \`${entry.calldata}\``);
  if (entry.sender) lines.push(`- **Sender**: \`${entry.sender}\``);
  if (entry.txHash) lines.push(`- **Tx hash**: \`${entry.txHash}\``);
  if (entry.blockNumber !== undefined) lines.push(`- **Block**: ${entry.blockNumber}`);
  if (entry.gasUsed !== undefined) lines.push(`- **Gas used**: ${entry.gasUsed}`);
  lines.push(`- **Outcome**: ${entry.outcome}`);
  if (entry.state?.before !== undefined) lines.push(`- **State before**: \`${entry.state.before}\``);
  if (entry.state?.after !== undefined) lines.push(`- **State after**: \`${entry.state.after}\``);
  lines.push("");
  return lines.join("\n");
}

function replaceBigints(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

/** Append one entry to today's markdown + JSONL files. Always succeeds
 *  (creates files / dirs as needed) and never throws — audit logging
 *  must not block an otherwise valid operation. */
export function appendAuditEntry(rootDir: string, entry: AuditEntry): void {
  try {
    const dir = logDir(rootDir);
    ensureDir(dir);
    const day = dayKey(new Date(entry.timestamp));
    const mdPath = join(dir, `${day}.md`);
    const jsonlPath = join(dir, `${day}.jsonl`);
    ensureMarkdownHeader(mdPath);
    appendFileSync(mdPath, formatMarkdown(entry), "utf8");
    appendFileSync(jsonlPath, JSON.stringify(entry, replaceBigints) + "\n", "utf8");
  } catch (err) {
    // Surface to stderr but do not throw — losing one log line is
    // strictly better than aborting an admin op that already ran.
    console.warn("[audit-log] failed to append:", err instanceof Error ? err.message : err);
  }
}
