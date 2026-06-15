import { describe, it, expect } from "vitest";

import {
  RIVALS,
  rivalFor,
  eloRangeLabel,
  randomEloForDifficulty,
} from "../rivals";
import type { ArenaDifficulty } from "@/lib/game/types";

const DIFFS: ArenaDifficulty[] = ["easy", "medium", "hard"];

describe("rivals config", () => {
  it("maps each difficulty to a named persona with a piece + ELO range", () => {
    expect(rivalFor("easy").name).toBe("Pipo");
    expect(rivalFor("medium").name).toBe("Mara");
    expect(rivalFor("hard").name).toBe("Kairo");
    expect(rivalFor("easy").piece).toBe("pawn");
    expect(rivalFor("medium").piece).toBe("knight");
    expect(rivalFor("hard").piece).toBe("bishop");
  });

  it("gives each rival a character avatar slug matching its name", () => {
    expect(rivalFor("easy").avatar).toBe("pipo");
    expect(rivalFor("medium").avatar).toBe("mara");
    expect(rivalFor("hard").avatar).toBe("kairo");
  });

  it("gives every rival a distinct, non-empty persona name (not 'AI'/'Bot')", () => {
    const names = DIFFS.map((d) => rivalFor(d).name);
    expect(new Set(names).size).toBe(DIFFS.length);
    for (const n of names) {
      expect(n.trim().length).toBeGreaterThan(0);
      expect(["AI", "Bot"]).not.toContain(n);
    }
  });

  it("formats the ELO range label", () => {
    expect(eloRangeLabel("easy")).toBe("0 - 800 ELO");
    expect(eloRangeLabel("medium")).toBe("801 - 1500 ELO");
    expect(eloRangeLabel("hard")).toBe("1501 - 2200 ELO");
  });

  it("randomEloForDifficulty stays within the rival's inclusive range", () => {
    for (const d of DIFFS) {
      const { eloMin, eloMax } = RIVALS[d];
      for (let i = 0; i < 200; i++) {
        const elo = randomEloForDifficulty(d);
        expect(elo).toBeGreaterThanOrEqual(eloMin);
        expect(elo).toBeLessThanOrEqual(eloMax);
        expect(Number.isInteger(elo)).toBe(true);
      }
    }
  });
});
