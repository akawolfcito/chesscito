import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { appendAuditEntry, logDir, type AuditEntry } from "../audit-log";

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), "audit-log-test-"));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

const SAMPLE: AuditEntry = {
  timestamp: "2026-04-27T12:34:56.000Z",
  command: "shop set-item",
  chain: "celo",
  contract: "0x24846C772af7233ADfD98b9A96273120f3a1f74b",
  functionSignature: "setItem(uint256,uint256,bool)",
  args: [5n, 1_000_000n, true],
  calldata: "0xbbcf696a",
  txHash: "0xabc",
  blockNumber: 12345,
  gasUsed: 28000,
  sender: "0x917497b64eeb85859edcf2e4ca64059edfec1923",
  outcome: "success",
  state: { before: "(0, false)", after: "(1000000, true)" },
};

describe("appendAuditEntry", () => {
  it("creates the audit-log directory and a header on first use", () => {
    const dir = logDir(workdir);
    expect(existsSync(dir)).toBe(false);

    appendAuditEntry(workdir, SAMPLE);

    expect(existsSync(dir)).toBe(true);
    const md = readFileSync(join(dir, "2026-04-27.md"), "utf8");
    expect(md.startsWith("# Admin audit log")).toBe(true);
  });

  it("appends a markdown block with the key fields", () => {
    appendAuditEntry(workdir, SAMPLE);
    const md = readFileSync(join(logDir(workdir), "2026-04-27.md"), "utf8");
    expect(md).toContain("## 2026-04-27T12:34:56.000Z · shop set-item");
    expect(md).toContain("`setItem(uint256,uint256,bool)`");
    expect(md).toContain("`0xabc`");
    expect(md).toContain("State after**: `(1000000, true)`");
  });

  it("emits one JSONL line per entry with bigint args serialized to strings", () => {
    appendAuditEntry(workdir, SAMPLE);
    appendAuditEntry(workdir, { ...SAMPLE, txHash: "0xdef" });
    const jsonl = readFileSync(join(logDir(workdir), "2026-04-27.jsonl"), "utf8");
    const lines = jsonl.trim().split("\n");
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0] ?? "");
    expect(first.args).toEqual(["5", "1000000", true]);
  });

  it("buckets entries by UTC day", () => {
    appendAuditEntry(workdir, SAMPLE);
    appendAuditEntry(workdir, { ...SAMPLE, timestamp: "2026-04-28T00:00:00.000Z" });
    expect(existsSync(join(logDir(workdir), "2026-04-27.md"))).toBe(true);
    expect(existsSync(join(logDir(workdir), "2026-04-28.md"))).toBe(true);
  });

  it("does not throw when the entry serialization is partially missing", () => {
    expect(() =>
      appendAuditEntry(workdir, {
        ...SAMPLE,
        sender: undefined,
        txHash: undefined,
        blockNumber: undefined,
        gasUsed: undefined,
        state: undefined,
        outcome: "dry-run",
      }),
    ).not.toThrow();
    const md = readFileSync(join(logDir(workdir), "2026-04-27.md"), "utf8");
    expect(md).toContain("Outcome**: dry-run");
    expect(md).not.toContain("Tx hash");
  });
});
