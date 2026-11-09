/**
 * Rendering, artefact safety, and snapshot compatibility.
 */

import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { classify, type ClassifyInput } from "../lib/classify";
import { cumulativeDelta, pointDelta } from "../lib/derive";
import {
  assertNoSecrets,
  findSecrets,
  formatBytes,
  formatDelta,
  formatLocal,
  renderConsole,
  renderMarkdown,
  renderVerdict,
  type ReportModel,
} from "../lib/render";
import {
  SNAPSHOT_SCHEMA_VERSION,
  checkCompatibility,
  elapsedMinutes,
  readLatest,
  snapshotStamp,
  writeSnapshot,
  type SnapshotEnvelope,
} from "../lib/snapshot-store";

function healthy(): ClassifyInput {
  return {
    supabase: {
      observed: true,
      latency_ms: 240,
      events_per_hour: [{ events: 100 }],
      events_per_session: 24,
      session_events_p95_24h: 73,
      session_population_24h: 2411,
      projection_90d_bytes: 2.7 * 1024 ** 3,
    },
    vercel: { cpu_percent: null, gateway_error_routes: 0, logs_observed: true },
    upstash: { percent_used: null, hours_to_exhaustion: null },
  };
}

function model(overrides: Partial<ReportModel> = {}): ReportModel {
  return {
    target: "production",
    taken_at_utc: "2026-08-04T04:24:25Z",
    taken_at_local: "2026-08-03 23:24:25",
    duration_ms: 1_468,
    classification: classify(healthy()),
    sections: [{ title: "SUPABASE", status: "observable", lines: ["filas 100.010"] }],
    changes: ["filas 98.527 → 100.010 (+1.483)"],
    capacity: ["disco 82 MB / 8 GB"],
    actions: ["poda diaria en vez de mensual"],
    not_observable: [
      { what: "Fluid Active CPU", why: "VERCEL_TOKEN ausente", manual: "Vercel → Usage" },
    ],
    credentials: [
      { name: "SUPABASE_URL", configured: true },
      { name: "VERCEL_TOKEN", configured: false },
    ],
    ...overrides,
  };
}

function envelope(over: Partial<SnapshotEnvelope> = {}): SnapshotEnvelope {
  return {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    target: "production",
    taken_at_utc: "2026-08-04T04:00:00.000Z",
    taken_at_local: "2026-08-03 23:00:00",
    duration_ms: 1_000,
    credentials: [],
    supabase: { row_count: 98_527 },
    vercel: {},
    upstash: {},
    classification: {},
    ...over,
  };
}

describe("formatting", () => {
  it("renders bytes at a readable scale", () => {
    expect(formatBytes(20_971_520)).toBe("20 MB");
    expect(formatBytes(2.7 * 1024 ** 3)).toBe("2.7 GB");
    expect(formatBytes(null)).toBe("—");
  });

  it("renders the local time in Bogotá", () => {
    expect(formatLocal(new Date("2026-08-04T04:24:25Z"))).toBe("2026-08-03 23:24:25");
  });

  it("prints a delta with its direction", () => {
    expect(formatDelta(pointDelta(98_527, 100_010))).toContain("+1,483");
  });

  it("prints the REASON instead of a number when a delta is invalid", () => {
    // This is the visible half of "not_observable never enters arithmetic".
    const across = cumulativeDelta(
      { value: 5_000, stats_reset: "A" },
      { value: 120, stats_reset: "B" },
    );
    const text = formatDelta(across);
    expect(text).toMatch(/not comparable/);
    expect(text).not.toMatch(/[0-9]{3}/);
  });

  it("never renders an unmeasured side as zero", () => {
    expect(formatDelta(pointDelta(null, 100))).toMatch(/not comparable/);
  });
});

describe("verdict line", () => {
  it("flags a partial verdict and counts the missing axes", () => {
    const line = renderVerdict(classify(healthy()));
    expect(line).toContain("GREEN (partial)");
    expect(line).toMatch(/2 critical/);
  });

  it("shows a clean verdict without a warning", () => {
    const full = classify({
      ...healthy(),
      vercel: { cpu_percent: 10, gateway_error_routes: 0, logs_observed: true },
      upstash: { percent_used: 20, hours_to_exhaustion: 900 },
    });
    expect(renderVerdict(full)).toBe("🟢 GREEN");
  });
});

describe("console and markdown", () => {
  it("both carry the verdict, UTC and Bogotá times", () => {
    for (const text of [renderConsole(model()), renderMarkdown(model())]) {
      expect(text).toContain("GREEN (partial)");
      expect(text).toContain("2026-08-04T04:24:25Z");
      expect(text).toContain("2026-08-03 23:24:25");
    }
  });

  it("both list the not-observable data with how to read it by hand", () => {
    for (const text of [renderConsole(model()), renderMarkdown(model())]) {
      expect(text).toContain("Fluid Active CPU");
      expect(text).toContain("Vercel → Usage");
    }
  });

  it("both state that no action was executed", () => {
    expect(renderConsole(model())).toMatch(/ninguna ejecutada/i);
    expect(renderMarkdown(model())).toMatch(/Ninguna ejecutada/i);
  });

  it("renders credentials as presence only, never as values", () => {
    const text = renderMarkdown(model());
    expect(text).toContain("| `VERCEL_TOKEN` | no |");
  });

  it("says so plainly when there is no previous snapshot", () => {
    expect(renderConsole(model({ changes: [] }))).toMatch(/sin snapshot previo/i);
  });
});

describe("artefact safety", () => {
  it("detects every credential shape it is meant to catch", () => {
    expect(findSecrets("postgresql://user:pw@host/db")).toContain("postgres connection string");
    expect(findSecrets("0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd")).toContain("wallet address");
    expect(findSecrets("https://fake-db-1.upstash.io")).toContain("upstash host");
    expect(findSecrets("Bearer abcdefghijklmno")).toContain("bearer token");
  });

  it("passes a clean report", () => {
    expect(findSecrets(renderMarkdown(model()))).toEqual([]);
    expect(() => assertNoSecrets(renderMarkdown(model()))).not.toThrow();
  });

  it("refuses to write an artefact containing a secret", () => {
    expect(() => assertNoSecrets("conn postgresql://u:p@h/db")).toThrow(/refusing to write/);
  });

  it("catches a registered secret that matches no pattern", () => {
    expect(findSecrets("token is hunter2hunter2", ["hunter2hunter2"])).toContain("known credential");
  });
});

describe("snapshot store", () => {
  function tempRepo(): string {
    return mkdtempSync(path.join(tmpdir(), "ops-snap-"));
  }

  it("produces a filename-safe UTC stamp", () => {
    expect(snapshotStamp(new Date("2026-08-04T04:24:25.123Z"))).toBe("2026-08-04T04-24-25Z");
  });

  it("writes the timestamped pair and updates latest.*", () => {
    const root = tempRepo();
    const stamp = snapshotStamp(new Date("2026-08-04T04:24:25Z"));
    writeSnapshot(root, stamp, envelope(), "# report");

    // Snapshots live under their target, never in a shared directory.
    const dir = path.join(root, "artifacts", "ops", "production");
    expect(readFileSync(path.join(dir, `${stamp}.md`), "utf8")).toBe("# report");
    expect(readFileSync(path.join(dir, "latest.md"), "utf8")).toBe("# report");
    expect(JSON.parse(readFileSync(path.join(dir, "latest.json"), "utf8")).schema_version)
      .toBe(SNAPSHOT_SCHEMA_VERSION);
  });

  it("reads back the previous snapshot", () => {
    const root = tempRepo();
    writeSnapshot(root, "stamp", envelope(), "# report");
    expect(readLatest(root, "production")?.taken_at_utc).toBe("2026-08-04T04:00:00.000Z");
  });

  it("treats a missing or corrupt latest.json as no previous snapshot", () => {
    const root = tempRepo();
    expect(readLatest(root, "production")).toBeNull();

    mkdirSync(path.join(root, "artifacts", "ops", "production"), { recursive: true });
    writeFileSync(
      path.join(root, "artifacts", "ops", "production", "latest.json"),
      "{ broken",
      "utf8",
    );
    expect(readLatest(root, "production")).toBeNull();
  });
});

describe("snapshot compatibility", () => {
  it("compares two snapshots of the same schema", () => {
    const previous = envelope();
    const current = envelope({ taken_at_utc: "2026-08-04T04:30:00.000Z" });
    expect(checkCompatibility(previous, current)).toEqual({ comparable: true });
    expect(elapsedMinutes(previous, current)).toBe(30);
  });

  it("refuses across schema versions", () => {
    // Comparing a renamed field to its old name produces confident nonsense.
    const verdict = checkCompatibility(
      envelope({ schema_version: 0 }),
      envelope({ taken_at_utc: "2026-08-04T04:30:00.000Z" }),
    );
    expect(verdict.comparable).toBe(false);
    if (verdict.comparable) return;
    expect(verdict.reason).toMatch(/schema/);
  });

  it("refuses when there is no previous snapshot", () => {
    expect(checkCompatibility(null, envelope()).comparable).toBe(false);
  });

  it("refuses when the previous snapshot is not actually older", () => {
    const same = envelope();
    expect(checkCompatibility(same, same).comparable).toBe(false);
  });
});
