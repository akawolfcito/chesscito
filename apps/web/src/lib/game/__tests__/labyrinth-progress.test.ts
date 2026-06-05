import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  areAllLabyrinthsSolved,
  getLabyrinthBest,
  recordLabyrinthBest,
} from "@/lib/game/labyrinth-progress";

const STORAGE_KEY = "chesscito:labyrinth-best:rook";

describe("labyrinth best-score persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns null when no record exists", () => {
    expect(getLabyrinthBest("rook", "rook-lab-1")).toBeNull();
  });

  it("records first completion as new best", () => {
    expect(recordLabyrinthBest("rook", "rook-lab-1", 4)).toBe(true);
    expect(getLabyrinthBest("rook", "rook-lab-1")).toBe(4);
  });

  it("replaces previous best when new score is lower", () => {
    recordLabyrinthBest("rook", "rook-lab-1", 6);
    expect(recordLabyrinthBest("rook", "rook-lab-1", 4)).toBe(true);
    expect(getLabyrinthBest("rook", "rook-lab-1")).toBe(4);
  });

  it("ignores worse scores and keeps the previous best", () => {
    recordLabyrinthBest("rook", "rook-lab-1", 4);
    expect(recordLabyrinthBest("rook", "rook-lab-1", 8)).toBe(false);
    expect(getLabyrinthBest("rook", "rook-lab-1")).toBe(4);
  });

  it("ignores equal scores (must strictly improve)", () => {
    recordLabyrinthBest("rook", "rook-lab-1", 4);
    expect(recordLabyrinthBest("rook", "rook-lab-1", 4)).toBe(false);
    expect(getLabyrinthBest("rook", "rook-lab-1")).toBe(4);
  });

  it("rejects zero or negative move counts as data hygiene", () => {
    expect(recordLabyrinthBest("rook", "rook-lab-1", 0)).toBe(false);
    expect(recordLabyrinthBest("rook", "rook-lab-1", -3)).toBe(false);
    expect(getLabyrinthBest("rook", "rook-lab-1")).toBeNull();
  });

  it("scopes records per labyrinth id within a piece", () => {
    recordLabyrinthBest("rook", "rook-lab-1", 4);
    recordLabyrinthBest("rook", "rook-lab-2", 6);
    expect(getLabyrinthBest("rook", "rook-lab-1")).toBe(4);
    expect(getLabyrinthBest("rook", "rook-lab-2")).toBe(6);
  });

  it("scopes records across pieces", () => {
    recordLabyrinthBest("rook", "shared-id", 4);
    recordLabyrinthBest("bishop", "shared-id", 7);
    expect(getLabyrinthBest("rook", "shared-id")).toBe(4);
    expect(getLabyrinthBest("bishop", "shared-id")).toBe(7);
  });

  it("treats corrupt stored values as no record without throwing", () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json");
    expect(getLabyrinthBest("rook", "rook-lab-1")).toBeNull();
  });

  it("treats unexpected stored shapes as no record", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["array", "not", "object"]));
    expect(getLabyrinthBest("rook", "rook-lab-1")).toBeNull();
  });
});

describe("areAllLabyrinthsSolved", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns false for an empty id list (defensive default)", () => {
    expect(areAllLabyrinthsSolved("king", [])).toBe(false);
  });

  it("returns false when no labyrinth has been solved yet", () => {
    expect(areAllLabyrinthsSolved("king", ["king-lab-1", "king-lab-2"])).toBe(false);
  });

  it("returns false when only some labyrinths in the list have a record", () => {
    recordLabyrinthBest("king", "king-lab-1", 5);
    expect(areAllLabyrinthsSolved("king", ["king-lab-1", "king-lab-2"])).toBe(false);
  });

  it("returns true once every id in the list has a recorded completion", () => {
    recordLabyrinthBest("king", "king-lab-1", 5);
    recordLabyrinthBest("king", "king-lab-2", 7);
    expect(areAllLabyrinthsSolved("king", ["king-lab-1", "king-lab-2"])).toBe(true);
  });

  it("scopes the check per piece (rook completions do not satisfy king)", () => {
    recordLabyrinthBest("rook", "king-lab-1", 4);
    expect(areAllLabyrinthsSolved("king", ["king-lab-1"])).toBe(false);
  });
});
