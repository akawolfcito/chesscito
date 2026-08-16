import { describe, expect, it } from "vitest";

import { assertReadOnlyScript, redact, sanitizeError } from "../read-only-query";

/**
 * The runner connects to PRODUCTION. These tests pin the two properties that
 * make that acceptable: it cannot express a write, and it cannot print an
 * identifier. The guard itself is `lib/read-only-guard.ts` — reused, not
 * reimplemented — so what is tested here is the SCRIPT layer around it:
 * multi-statement scripts and psql meta-commands, neither of which the
 * single-statement guard was built to see.
 */

describe("assertReadOnlyScript — what it accepts", () => {
  it("accepts a single select", () => {
    expect(() => assertReadOnlyScript("SELECT 1;")).not.toThrow();
  });

  it("accepts several selects — an analysis script is many questions", () => {
    expect(() =>
      assertReadOnlyScript("SELECT 1;\nSELECT 2;\nWITH e AS (SELECT 3) SELECT * FROM e;"),
    ).not.toThrow();
  });

  it("accepts \\echo section markers, which only produce output", () => {
    expect(() => assertReadOnlyScript("\\echo === section ===\nSELECT 1;")).not.toThrow();
  });

  it("accepts a trailing statement with no final semicolon", () => {
    expect(() => assertReadOnlyScript("SELECT 1")).not.toThrow();
  });
});

describe("assertReadOnlyScript — what it refuses", () => {
  it("refuses a write hidden after a legitimate read", () => {
    // The shape that turns a query tool into an executor.
    expect(() => assertReadOnlyScript("SELECT 1;\nDELETE FROM duels;")).toThrow();
  });

  it("refuses a write hidden behind a comment", () => {
    expect(() =>
      assertReadOnlyScript("SELECT 1; -- harmless\nUPDATE duels SET seats = '{}';"),
    ).toThrow();
  });

  it("refuses \\copy, which writes files", () => {
    expect(() => assertReadOnlyScript("\\copy t TO '/tmp/x.csv'\nSELECT 1;")).toThrow(
      /meta-command/,
    );
  });

  it("refuses \\! , which runs a shell", () => {
    expect(() => assertReadOnlyScript("\\! rm -rf /\nSELECT 1;")).toThrow(/meta-command/);
  });

  it("refuses an empty script rather than running nothing quietly", () => {
    expect(() => assertReadOnlyScript("\\echo hi\n")).toThrow(/no statement/);
  });

  it("refuses its own preamble as USER input — only the runner may SET", () => {
    expect(() =>
      assertReadOnlyScript("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;"),
    ).toThrow();
  });

  it("still allows column names that merely CONTAIN a forbidden word", () => {
    // `created_at` contains "create", `updated_at` contains "update". A guard
    // that rejected these would be weakened on its first real use.
    expect(() =>
      assertReadOnlyScript("SELECT created_at, updated_at FROM analytics_events;"),
    ).not.toThrow();
  });
});

describe("redact — nothing identifier-shaped reaches stdout", () => {
  it("masks wallets and tx hashes", () => {
    expect(redact("from 0x1234567890abcdef1234567890abcdef12345678 ok")).toBe(
      "from 0x<hex> ok",
    );
  });

  it("masks uuids", () => {
    expect(redact("session 123e4567-e89b-12d3-a456-426614174000")).toBe("session <uuid>");
  });

  it("masks emails", () => {
    expect(redact("user a.b+c@example.com here")).toBe("user <email> here");
  });

  it("masks long digit runs, which is what a raw id looks like", () => {
    expect(redact("id 12345678901234")).toBe("id <n>");
  });

  it("leaves an error family intact — masking must not destroy the grouping", () => {
    const family = "No token with sufficient balance";
    expect(redact(family)).toBe(family);
  });

  it("leaves short numbers alone, so counts stay readable", () => {
    expect(redact("rows 251 wallets 148")).toBe("rows 251 wallets 148");
  });
});

describe("sanitizeError — a failure must not leak the connection", () => {
  it("strips the connection string psql echoes back", () => {
    const out = sanitizeError(
      new Error('could not connect: postgresql://postgres.abc:s3cret@host:5432/postgres'),
    );
    expect(out).toContain("postgresql://[REDACTED]");
    expect(out).not.toContain("s3cret");
  });

  it("strips a password= parameter", () => {
    expect(sanitizeError(new Error("dsn password=hunter2 more"))).not.toContain("hunter2");
  });

  it("redacts identifiers in the error text too", () => {
    expect(
      sanitizeError(new Error("failed for 0x1234567890abcdef1234567890abcdef12345678")),
    ).toContain("0x<hex>");
  });
});
