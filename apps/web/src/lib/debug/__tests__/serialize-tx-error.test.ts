import { describe, expect, it } from "vitest";

import {
  findRevertData,
  redactLongHex,
  serializeTxError,
} from "../serialize-tx-error";

const SIGNATURE = `0x${"ab".repeat(65)}`; // 65 bytes → 132 chars
const REVERT_DATA = "0xc1ab61a1"; // CooldownActive()

describe("redactLongHex", () => {
  it("redacts a 65-byte signature", () => {
    const out = redactLongHex(`args: (1, 2400, ${SIGNATURE})`);
    expect(out).not.toContain(SIGNATURE);
    expect(out).toContain("[redacted 132 chars]");
  });

  it("leaves a 4-byte selector alone — it is what we came for", () => {
    expect(redactLongHex(`reverted with signature ${REVERT_DATA}`)).toContain(REVERT_DATA);
  });

  it("leaves an address and a tx hash alone", () => {
    const addr = "0x1681aAA176d5f46e45789A8b18C8E990f663959a";
    const hash = `0x${"cd".repeat(32)}`;
    const out = redactLongHex(`${addr} ${hash}`);
    expect(out).toContain(addr);
    expect(out).toContain(hash);
  });
});

describe("serializeTxError", () => {
  it("captures name, message, code, data and own keys", () => {
    const err = Object.assign(new Error("execution reverted"), {
      code: 3,
      data: REVERT_DATA,
    });
    const { top } = serializeTxError(err);
    expect(top.name).toBe("Error");
    expect(top.message).toBe("execution reverted");
    expect(top.code).toBe(3);
    expect(top.data).toBe(REVERT_DATA);
    expect(top.keys).toContain("code");
    expect(top.keys).toContain("data");
  });

  it("redacts a signature echoed into the message", () => {
    const err = new Error(`args: (${SIGNATURE})`);
    expect(serializeTxError(err).top.message).toContain("[redacted 132 chars]");
  });

  it("walks the cause chain outermost first", () => {
    const inner = Object.assign(new Error("inner"), { data: REVERT_DATA });
    const middle = Object.assign(new Error("middle"), { cause: inner });
    const outer = Object.assign(new Error("outer"), { cause: middle });

    const chain = serializeTxError(outer);
    expect(chain.top.message).toBe("outer");
    expect(chain.causes.map((c) => c.message)).toEqual(["middle", "inner"]);
    expect(chain.depth).toBe(2);
  });

  it("survives a cyclic cause chain", () => {
    const a = new Error("a") as Error & { cause?: unknown };
    const b = new Error("b") as Error & { cause?: unknown };
    a.cause = b;
    b.cause = a;
    expect(() => serializeTxError(a)).not.toThrow();
    expect(serializeTxError(a).depth).toBeLessThanOrEqual(8);
  });

  it("handles a thrown non-object", () => {
    expect(serializeTxError("boom").top.message).toBe("boom");
  });
});

describe("findRevertData — the go/no-go signal", () => {
  it("finds revert data on the top level", () => {
    const err = Object.assign(new Error("x"), { data: REVERT_DATA });
    expect(findRevertData(serializeTxError(err))).toBe(REVERT_DATA);
  });

  it("finds revert data nested in a cause", () => {
    const inner = Object.assign(new Error("inner"), { data: REVERT_DATA });
    const outer = Object.assign(new Error("outer"), { cause: inner });
    expect(findRevertData(serializeTxError(outer))).toBe(REVERT_DATA);
  });

  it("finds revert data wrapped as { data: { data } }", () => {
    const err = Object.assign(new Error("x"), { data: { data: REVERT_DATA } });
    expect(findRevertData(serializeTxError(err))).toBe(REVERT_DATA);
  });

  it("falls back to viem's undecoded `signature` field", () => {
    const err = Object.assign(new Error("x"), { signature: REVERT_DATA });
    expect(findRevertData(serializeTxError(err))).toBe(REVERT_DATA);
  });

  it("returns null when the wallet stripped the revert data", () => {
    const err = Object.assign(new Error("execution reverted"), { code: 3 });
    expect(findRevertData(serializeTxError(err))).toBeNull();
  });

  it("does not mistake a user rejection for revert data", () => {
    const err = Object.assign(new Error("User rejected the request"), { code: 4001 });
    expect(findRevertData(serializeTxError(err))).toBeNull();
  });
});
