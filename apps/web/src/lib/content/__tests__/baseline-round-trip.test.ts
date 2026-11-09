/**
 * AC-2 / AC-3 / AC-10 — the load→save round trip over the REAL records.
 *
 * This is the test the builder never had, and its absence is why a signature
 * game could lose its `kind` in silence for this long. It runs against the
 * actual content/*.json (not fixtures): the bug was a property of the real
 * data, so a fixture-shaped test could have stayed green through it.
 *
 * ⚠️ Real fs, NOT mocked — `root` is injected to a tmpdir. Without the injected
 * root these writes would land on the working tree (spec AC-2).
 */
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readBaselineRecords, writeBaselineRecord } from "../baseline-write";

const REPO = resolve(process.cwd());

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "chesscito-baseline-"));
  mkdirSync(join(root, "content"), { recursive: true });
  for (const f of ["labyrinths.json", "exercises.json", "puzzles.csv"]) {
    cpSync(join(REPO, "content", f), join(root, "content", f));
  }
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("readBaselineRecords (AC-3)", () => {
  it("returns the record's real kind and its bucket as two separate axes", () => {
    const records = readBaselineRecords("labyrinth", root);
    const queens = records.filter((r) => r.kind === "queens");

    // The bug: `kind` used to be overwritten with the bucket, so this was 0.
    expect(queens).toHaveLength(3);
    expect(queens.every((r) => r.bucket === "labyrinth")).toBe(true);
  });

  it("keeps `kind` absent on the 19 legit labyrinths (AC-10 compat)", () => {
    const records = readBaselineRecords("labyrinth", root);
    const kindless = records.filter((r) => r.kind === undefined);

    expect(kindless).toHaveLength(19);
    expect(kindless.every((r) => r.bucket === "labyrinth")).toBe(true);
  });

  it("tags the exercise bucket without inventing a kind", () => {
    const records = readBaselineRecords("exercise", root);

    // Counted from the catalog, not pinned: 59 went stale the day the bishop got
    // its tenth board. What this case is about is the BUCKET and the absent kind,
    // and a frozen total only ever fails for authoring.
    const authored = (
      JSON.parse(
        readFileSync(join(root, "content", "exercises.json"), "utf8"),
      ) as unknown[]
    ).length;
    expect(records).toHaveLength(authored);
    expect(records.every((r) => r.bucket === "exercise")).toBe(true);
    expect(records.every((r) => r.kind === undefined)).toBe(true);
  });
});

describe("load→save round trip (AC-2)", () => {
  it("preserves every one of the 15 signature-game records, deep-equal", () => {
    const before = readBaselineRecords("labyrinth", root);
    const kinded = before.filter((r) => r.kind !== undefined);

    // 3 each of diagonal-run, knight-tour, queens, safe-path, promotion-run.
    expect(kinded).toHaveLength(15);

    for (const rec of kinded) {
      const { bucket, ...record } = rec;
      const result = writeBaselineRecord(bucket, record, root);
      // Surface the real errors — a bare toBe(true) hides why it rejected.
      expect(result.ok ? [] : result.errors).toEqual([]);
    }

    const after = readBaselineRecords("labyrinth", root);
    expect(after).toEqual(before);
  }, 60_000);

  it("never leaks the `bucket` axis into the persisted record", () => {
    const [rec] = readBaselineRecords("labyrinth", root).filter((r) => r.kind === "queens");
    const { bucket, ...record } = rec;

    // A caller holding a BucketedRecord can pass it straight through: the type
    // allows it (extra props survive assignment), so the strip must be real.
    writeBaselineRecord(bucket, { ...record, bucket } as typeof record, root);

    const reread = readBaselineRecords("labyrinth", root).find((r) => r.id === rec.id);
    expect(reread).toEqual(rec);
  }, 30_000);
});
