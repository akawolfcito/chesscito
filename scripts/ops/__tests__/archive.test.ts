import { describe, expect, it } from "vitest";

import {
  ARCHIVE_ROOT_SUFFIX,
  assertNoWrites,
  assertUnderArchiveRoot,
  buildExportSql,
  buildVerifySql,
  parseArgs,
  redactSecrets,
  resolveAllRange,
  partitionsFromFiles,
  verifyManifest,
  type PartitionSummary,
} from "../archive";

/**
 * The tool talks to PRODUCTION. Every test here defends one of the two
 * properties that make that acceptable: it cannot write, and it cannot leak.
 *
 * The W2 numbers are reused as an anchor because they were verified end-to-end
 * (`docs/audits/2026-08-17-supabase-historical-archive-recoverability.md`), but
 * the logic is exercised with synthetic data too — a suite that only knows one
 * dataset proves the dataset, not the tool.
 */

describe("parseArgs", () => {
  it("reads an explicit range", () => {
    expect(parseArgs(["--from", "2026-08-10", "--to", "2026-08-17"])).toEqual({
      kind: "export",
      range: { from: "2026-08-10", to: "2026-08-17" },
    });
  });

  it("reads --all as a range to be resolved from production", () => {
    expect(parseArgs(["--all"])).toEqual({ kind: "export-all" });
  });

  it("reads --verify-only with its manifest path", () => {
    expect(parseArgs(["--verify-only", "private/archive/manifest.json"])).toEqual({
      kind: "verify",
      manifestPath: "private/archive/manifest.json",
    });
  });

  it("rejects a malformed date instead of guessing", () => {
    expect(() => parseArgs(["--from", "10-08-2026", "--to", "2026-08-17"])).toThrow(/YYYY-MM-DD/);
    expect(() => parseArgs(["--from", "2026-13-01", "--to", "2026-08-17"])).toThrow();
  });

  it("rejects an inverted or empty range — it would export nothing, silently", () => {
    expect(() => parseArgs(["--from", "2026-08-17", "--to", "2026-08-10"])).toThrow(/after/i);
    expect(() => parseArgs(["--from", "2026-08-10", "--to", "2026-08-10"])).toThrow(/after/i);
  });

  it("rejects a half-specified range", () => {
    expect(() => parseArgs(["--from", "2026-08-10"])).toThrow();
    expect(() => parseArgs([])).toThrow();
  });
});

describe("resolveAllRange — UTC boundaries", () => {
  it("covers the last day fully by making `to` exclusive on the NEXT day", () => {
    // A `to` equal to the last event's date would silently drop that day.
    expect(
      resolveAllRange("2026-05-03 03:04:55.734732+00", "2026-08-18 01:26:42.642073+00"),
    ).toEqual({ from: "2026-05-03", to: "2026-08-19" });
  });

  it("uses UTC, not local time, for the day boundary", () => {
    // 23:30 UTC on the 17th is already the 18th in some local zones. If the tool
    // resolved locally, the last partition would be named for the wrong day.
    expect(resolveAllRange("2026-08-17 23:30:00+00", "2026-08-17 23:59:59+00")).toEqual({
      from: "2026-08-17",
      to: "2026-08-18",
    });
  });

  it("handles a single-instant history without producing an empty range", () => {
    const r = resolveAllRange("2026-08-17 12:00:00+00", "2026-08-17 12:00:00+00");
    expect(r.from).toBe("2026-08-17");
    expect(r.to).toBe("2026-08-18");
  });
});

describe("assertNoWrites — the invariant that outranks discipline", () => {
  it("accepts the SQL the tool actually generates", () => {
    expect(() => assertNoWrites(buildExportSql({ from: "2026-08-10", to: "2026-08-17" }))).not.toThrow();
    expect(() => assertNoWrites(buildVerifySql())).not.toThrow();
  });

  it.each([
    "DELETE FROM pg.public.analytics_events",
    "UPDATE pg.public.scores SET v = 1",
    "INSERT INTO pg.public.duels VALUES (1)",
    "TRUNCATE pg.public.analytics_events",
    "DROP TABLE pg.public.victories",
    "ALTER TABLE pg.public.scores ADD COLUMN x int",
    "VACUUM FULL pg.public.analytics_events",
    "CREATE INDEX ix ON pg.public.analytics_events (event)",
  ])("refuses %s", (sql) => {
    expect(() => assertNoWrites(sql)).toThrow(/refus/i);
  });

  it("refuses a write hidden after a legitimate read", () => {
    expect(() =>
      assertNoWrites("SELECT 1; DELETE FROM pg.public.analytics_events WHERE true"),
    ).toThrow();
  });

  it("refuses a write hidden behind a comment", () => {
    expect(() => assertNoWrites("SELECT 1; -- ok\nDROP TABLE pg.public.scores")).toThrow();
  });

  it("still allows the local COPY/CREATE the export needs", () => {
    // The tool writes Parquet and builds LOCAL DuckDB views. Those are writes to
    // the archive, never to `pg.` — the guard must tell the two apart or it is
    // useless in practice.
    expect(() =>
      assertNoWrites("COPY (SELECT * FROM pg.public.analytics_events) TO '/out/x.parquet'"),
    ).not.toThrow();
    expect(() => assertNoWrites("CREATE VIEW e AS SELECT * FROM read_parquet('/out/**')")).not.toThrow();
  });
});

describe("assertUnderArchiveRoot — output cannot escape the private path", () => {
  it("accepts a path inside the archive", () => {
    expect(() => assertUnderArchiveRoot(`/repo/${ARCHIVE_ROOT_SUFFIX}/manifest.json`)).not.toThrow();
  });

  it("refuses a traversal out of the archive", () => {
    expect(() =>
      assertUnderArchiveRoot(`/repo/${ARCHIVE_ROOT_SUFFIX}/../../docs/leak.json`),
    ).toThrow(/private\/archive/);
  });

  it("refuses an unrelated absolute path", () => {
    expect(() => assertUnderArchiveRoot("/tmp/leak.parquet")).toThrow();
  });

  it("refuses the repo docs directory — the archive must never land in git", () => {
    expect(() => assertUnderArchiveRoot("/repo/docs/audits/x.parquet")).toThrow();
  });
});

describe("buildExportSql", () => {
  const sql = buildExportSql({ from: "2026-08-10", to: "2026-08-17" });

  it("bounds the window half-open in UTC, so days cannot double-count", () => {
    expect(sql).toContain("'2026-08-10 00:00:00+00'");
    expect(sql).toContain("'2026-08-17 00:00:00+00'");
    expect(sql).toMatch(/>=[^<]*<\s/s);
  });

  it("partitions by UTC event date", () => {
    expect(sql).toContain("PARTITION_BY (event_date)");
    expect(sql).toContain("created_at::DATE");
  });

  it("uses Parquet with ZSTD", () => {
    expect(sql).toContain("FORMAT PARQUET");
    expect(sql).toContain("COMPRESSION ZSTD");
  });

  it("ALWAYS exports account_first_seen — retention dies without it", () => {
    // D1/D3/D7 do not come from analytics_events. An archive without this table
    // silently loses every retention metric, and nothing would report the loss.
    expect(sql).toContain("account_first_seen");
  });

  it("exports session_first_seen too", () => {
    expect(sql).toContain("session_first_seen");
  });

  it("selects the whole row rather than a column list that could drift", () => {
    expect(sql).toMatch(/SELECT \*, created_at::DATE AS event_date/);
  });
});

describe("verifyManifest — per partition, never on the total", () => {
  const entry = (over: Partial<PartitionSummary> = {}): PartitionSummary => ({
    partition: "2026-08-10",
    rows: 6824,
    min_ts: "2026-08-10T00:00:54.633Z",
    max_ts: "2026-08-10T23:40:40.925Z",
    ...over,
  });

  it("passes when every partition matches", () => {
    const r = verifyManifest([entry()], [{ partition: "2026-08-10", rows: 6824, min_ts: "2026-08-10T00:00:54.633Z", max_ts: "2026-08-10T23:40:40.925Z" }]);
    expect(r.ok).toBe(true);
    expect(r.failures).toEqual([]);
  });

  it("FAILS on a row-count mismatch in one partition", () => {
    const r = verifyManifest([entry()], [{ partition: "2026-08-10", rows: 6823, min_ts: "2026-08-10T00:00:54.633Z", max_ts: "2026-08-10T23:40:40.925Z" }]);
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toMatch(/rows/);
  });

  it("FAILS on a timestamp mismatch even when the row count is right", () => {
    const r = verifyManifest([entry()], [{ partition: "2026-08-10", rows: 6824, min_ts: "2026-08-10T00:00:55.000Z", max_ts: "2026-08-10T23:40:40.925Z" }]);
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toMatch(/min_ts/);
  });

  it("FAILS when a partition is missing entirely", () => {
    const r = verifyManifest([entry(), entry({ partition: "2026-08-11" })], [
      { partition: "2026-08-10", rows: 6824, min_ts: "2026-08-10T00:00:54.633Z", max_ts: "2026-08-10T23:40:40.925Z" },
    ]);
    expect(r.ok).toBe(false);
    expect(r.failures.join(" ")).toMatch(/2026-08-11/);
  });

  it("FAILS on an EXTRA partition nobody recorded", () => {
    const r = verifyManifest([entry()], [
      { partition: "2026-08-10", rows: 6824, min_ts: "2026-08-10T00:00:54.633Z", max_ts: "2026-08-10T23:40:40.925Z" },
      { partition: "2026-08-11", rows: 10, min_ts: "x", max_ts: "y" },
    ]);
    expect(r.ok).toBe(false);
    expect(r.failures.join(" ")).toMatch(/unexpected|2026-08-11/i);
  });

  it("⛔ a matching TOTAL never rescues a per-partition mismatch", () => {
    // Two days off by the same amount in opposite directions: the sum is right
    // and the archive is wrong. This is the whole reason verification is per
    // partition.
    const manifest = [entry(), entry({ partition: "2026-08-11", rows: 6052, min_ts: "m", max_ts: "M" })];
    const observed = [
      { partition: "2026-08-10", rows: 6825, min_ts: "2026-08-10T00:00:54.633Z", max_ts: "2026-08-10T23:40:40.925Z" },
      { partition: "2026-08-11", rows: 6051, min_ts: "m", max_ts: "M" },
    ];
    expect(manifest.reduce((a, e) => a + e.rows, 0)).toBe(observed.reduce((a, o) => a + o.rows, 0));
    expect(verifyManifest(manifest, observed).ok).toBe(false);
  });

  it("is stable when partitions arrive in a different order", () => {
    const manifest = [entry(), entry({ partition: "2026-08-11", rows: 1, min_ts: "m", max_ts: "M" })];
    const observed = [
      { partition: "2026-08-11", rows: 1, min_ts: "m", max_ts: "M" },
      { partition: "2026-08-10", rows: 6824, min_ts: "2026-08-10T00:00:54.633Z", max_ts: "2026-08-10T23:40:40.925Z" },
    ];
    expect(verifyManifest(manifest, observed).ok).toBe(true);
  });
});

describe("redactSecrets", () => {
  const secrets = { password: "hunter2", ref: "abcdefghijklmnop" };

  it("masks the database password", () => {
    expect(redactSecrets("connect hunter2 failed", secrets)).toBe("connect [REDACTED] failed");
  });

  it("masks the Supabase project ref as [REF]", () => {
    expect(redactSecrets("user=postgres.abcdefghijklmnop x", secrets)).toBe("user=postgres.[REF] x");
  });

  it("masks a connection string wholesale", () => {
    expect(redactSecrets("postgresql://u:p@h:5432/db", secrets)).toContain("[REDACTED]");
  });

  it("masks wallets and hashes that could ride in an error", () => {
    expect(redactSecrets("at 0x1234567890abcdef1234567890abcdef12345678", secrets)).toContain("0x<hex>");
  });

  it("leaves ordinary diagnostics readable — over-masking hides real failures", () => {
    expect(redactSecrets("rows 6824 partition 2026-08-10 mismatch", secrets)).toBe(
      "rows 6824 partition 2026-08-10 mismatch",
    );
  });

  it("tolerates an absent ref without masking everything", () => {
    expect(redactSecrets("plain text", { password: "hunter2", ref: "" })).toBe("plain text");
  });
});

describe("repeat execution", () => {
  it("regenerates the same SQL for the same range — the export is deterministic", () => {
    const a = buildExportSql({ from: "2026-08-10", to: "2026-08-17" });
    const b = buildExportSql({ from: "2026-08-10", to: "2026-08-17" });
    expect(a).toBe(b);
  });

  it("overwrites its own partitions instead of appending duplicates on a re-run", () => {
    // Without this, running twice would double every row count and the manifest
    // would still "verify" against the doubled files.
    expect(buildExportSql({ from: "2026-08-10", to: "2026-08-17" })).toContain("OVERWRITE");
  });
});

/**
 * Regression, found by running `--all` against real production on 2026-08-17.
 *
 * DuckDB splits a large partition across several files (`2026-08-05` produced
 * three, `2026-08-12` two). The first manifest shape assumed one file per
 * partition, so a multi-file day was recorded twice and verification reported
 * it as MISSING — a false failure that would have discredited a correct export.
 *
 * ⛔ The lesson is in the schema, not the loop: a partition HAS files, so counts
 * belong to the partition and checksums belong to the file.
 */
describe("multi-file partitions", () => {
  const partitions = [
    { partition: "2026-08-05", rows: 22107, min_ts: "a", max_ts: "b" },
    { partition: "2026-08-12", rows: 6953, min_ts: "c", max_ts: "d" },
  ];

  it("verifies a partition split across three files exactly once", () => {
    const r = verifyManifest(partitions, [
      { partition: "2026-08-05", rows: 22107, min_ts: "a", max_ts: "b" },
      { partition: "2026-08-12", rows: 6953, min_ts: "c", max_ts: "d" },
    ]);
    expect(r.ok).toBe(true);
  });

  it("still FAILS a multi-file partition whose total is wrong", () => {
    const r = verifyManifest(partitions, [
      { partition: "2026-08-05", rows: 22106, min_ts: "a", max_ts: "b" },
      { partition: "2026-08-12", rows: 6953, min_ts: "c", max_ts: "d" },
    ]);
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toMatch(/2026-08-05/);
  });

  it("groups file rows into partition rows", () => {
    expect(
      partitionsFromFiles([
        { table: "analytics_events", filename: "…/event_date=2026-08-05/part-0.parquet", partition: "2026-08-05", bytes: 1, sha256: "x" },
        { table: "analytics_events", filename: "…/event_date=2026-08-05/part-1.parquet", partition: "2026-08-05", bytes: 1, sha256: "y" },
        { table: "analytics_events", filename: "…/event_date=2026-08-12/part-0.parquet", partition: "2026-08-12", bytes: 1, sha256: "z" },
      ]).sort(),
    ).toEqual(["2026-08-05", "2026-08-12"]);
  });
});
