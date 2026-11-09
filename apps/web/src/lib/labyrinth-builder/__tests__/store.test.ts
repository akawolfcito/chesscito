import { describe, expect, it } from "vitest";
import { upsertRecord, type LabyrinthRecord } from "../store";

function rec(id: string, order: number): LabyrinthRecord {
  return { id, piece: "rook", fen: "8/8/8/8/8/8/8/8 w - - 0 1", target: "a1", order };
}

describe("upsertRecord", () => {
  it("replaces a record matched by id", () => {
    const existing = [rec("alpha", 0), rec("beta", 1)];
    const updated: LabyrinthRecord = { ...rec("beta", 1), target: "h8" };
    const next = upsertRecord(existing, updated);
    expect(next).toHaveLength(2);
    expect(next[1]).toBe(updated);
    expect(next[1].target).toBe("h8");
    // original array is not mutated
    expect(existing[1].target).toBe("a1");
  });

  it("appends when no record matches the id", () => {
    const existing = [rec("alpha", 0)];
    const fresh = rec("gamma", 5);
    const next = upsertRecord(existing, fresh);
    expect(next).toHaveLength(2);
    expect(next[1]).toBe(fresh);
  });

  it("appends when the incoming record has no id", () => {
    const existing = [rec("alpha", 0)];
    const noId: LabyrinthRecord = { piece: "rook", fen: "8/8/8/8/8/8/8/8 w - - 0 1", target: "b2", order: 9 };
    const next = upsertRecord(existing, noId);
    expect(next).toHaveLength(2);
    expect(next[1]).toBe(noId);
  });
});
