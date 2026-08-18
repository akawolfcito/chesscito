import { describe, expect, it } from "vitest";

import {
  assertUnderBackupRoot,
  backupStamp,
  BACKUP_ROOT_SUFFIX,
  buildCountSql,
  buildDumpArgs,
  compareCounts,
  EXCLUDED_TABLES,
  parseCounts,
  PG_IMAGE,
  redactSecrets,
} from "../backup";

describe("what gets dumped", () => {
  it("excludes analytics_events, and ONLY that", () => {
    // 164 MB of the ~190 MB database, already archived and verified to Parquet.
    expect(EXCLUDED_TABLES).toEqual(["analytics_events"]);
  });

  it("uses a DENY-list, so a product table added later is backed up by default", () => {
    // An allow-list would silently miss a new table — the one failure mode a
    // backup cannot afford. The SQL asks the catalog what exists.
    const sql = buildCountSql(EXCLUDED_TABLES);
    expect(sql).toContain("pg_class");
    expect(sql).toContain("NOT IN ('analytics_events')");
    expect(sql).not.toMatch(/relname IN \('peones_ledger'/);
  });

  it("dumps public only, without owners or privileges", () => {
    const args = buildDumpArgs(EXCLUDED_TABLES);
    expect(args).toContain("--schema=public");
    expect(args).toContain("--no-owner");
    expect(args).toContain("--no-privileges");
    expect(args).toContain("--exclude-table=public.analytics_events");
  });

  it("⛔ pins the pg_dump image to 17, matching the server", () => {
    // A 16 client refuses a 17 server outright. The rest of the repo's tooling
    // uses 16 because psql 16 talks to 17 fine; pg_dump does not.
    expect(PG_IMAGE).toBe("postgres:17-alpine");
  });
});

describe("backupStamp", () => {
  it("is UTC, sortable and filesystem-safe", () => {
    expect(backupStamp(new Date("2026-08-18T20:14:19.123Z"))).toBe("2026-08-18T20-14-19Z");
  });

  it("sorts chronologically as plain strings", () => {
    const a = backupStamp(new Date("2026-08-18T20:14:19Z"));
    const b = backupStamp(new Date("2026-08-18T21:00:00Z"));
    expect([b, a].sort()).toEqual([a, b]);
  });
});

describe("assertUnderBackupRoot", () => {
  it("accepts a path inside the backup root", () => {
    expect(() => assertUnderBackupRoot(`/repo/${BACKUP_ROOT_SUFFIX}/2026-08-18T00-00-00Z/x.sql`)).not.toThrow();
  });

  it("refuses a traversal out of it", () => {
    expect(() => assertUnderBackupRoot(`/repo/${BACKUP_ROOT_SUFFIX}/../../docs/leak.sql`)).toThrow();
  });

  it("refuses an unrelated path — the dump holds real user state", () => {
    expect(() => assertUnderBackupRoot("/tmp/leak.sql")).toThrow();
    expect(() => assertUnderBackupRoot("/repo/docs/backup.sql")).toThrow();
  });
});

describe("parseCounts / compareCounts", () => {
  it("parses psql pipe output and sorts by table", () => {
    expect(parseCounts("score_saves|4895\npeones_ledger|7889\n")).toEqual([
      { table: "peones_ledger", rows: 7889 },
      { table: "score_saves", rows: 4895 },
    ]);
  });

  it("passes when every table matches", () => {
    const src = [{ table: "peones_ledger", rows: 7889 }];
    expect(compareCounts(src, src).ok).toBe(true);
  });

  it("FAILS on a row-count mismatch, naming the table", () => {
    const r = compareCounts(
      [{ table: "peones_ledger", rows: 7889 }],
      [{ table: "peones_ledger", rows: 7888 }],
    );
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toMatch(/peones_ledger/);
  });

  it("FAILS when a table did not survive the restore", () => {
    const r = compareCounts([{ table: "duels", rows: 3 }], []);
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toMatch(/missing/);
  });

  it("FAILS on an unexpected extra table", () => {
    const r = compareCounts([], [{ table: "ghost", rows: 1 }]);
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toMatch(/unexpected/);
  });

  it("⛔ a matching TOTAL does not rescue two tables that are individually wrong", () => {
    const src = [{ table: "a", rows: 10 }, { table: "b", rows: 10 }];
    const got = [{ table: "a", rows: 11 }, { table: "b", rows: 9 }];
    expect(src.reduce((s, t) => s + t.rows, 0)).toBe(got.reduce((s, t) => s + t.rows, 0));
    expect(compareCounts(src, got).ok).toBe(false);
  });

  it("an empty backup is not silently a pass", () => {
    expect(compareCounts([{ table: "peones_ledger", rows: 7889 }], []).ok).toBe(false);
  });
});

describe("redactSecrets", () => {
  const s = { password: "hunter2", ref: "abcdefghijklmnop" };

  it("masks the password and the project ref", () => {
    expect(redactSecrets("pw hunter2 ref abcdefghijklmnop", s)).toBe("pw [REDACTED] ref [REF]");
  });

  it("masks a whole connection string", () => {
    expect(redactSecrets("postgresql://u:p@h:5432/db failed", s)).toBe("[REDACTED] failed");
  });

  it("leaves diagnostics readable — an unreadable error is an error nobody fixes", () => {
    expect(redactSecrets("peones_ledger: 7889 → 7888", s)).toBe("peones_ledger: 7889 → 7888");
  });
});
