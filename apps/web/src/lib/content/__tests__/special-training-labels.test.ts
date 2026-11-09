import { describe, expect, it } from "vitest";
import {
  resolveSpecialTrainingLabels,
  unlocalizedIds,
  type LabelLane,
} from "@/lib/content/special-training-labels";
import { QUEENS, KNIGHT_TOUR, DIAGONAL_RUN } from "@/lib/game/exercises";
import esMessages from "@/lib/content/messages/es";
import type { Exercise, PieceId } from "@/lib/game/types";

const entry = (id: string, title?: string): Exercise => ({
  id,
  optimalMoves: 1,
  startPos: { file: 0, rank: 0 },
  targetPos: { file: 0, rank: 0 },
  title,
});

const lane = (ids: string[], prefix: string): LabelLane => ({
  ids: new Set(ids),
  translate: (id) => `${prefix}:${id}`,
});

describe("resolveSpecialTrainingLabels", () => {
  it("routes a claimed id through its lane's translator", () => {
    const out = resolveSpecialTrainingLabels(
      [entry("queens-1", "The Quiet Room")],
      [lane(["queens-1"], "es")],
    );
    expect(out["queens-1"]).toBe("es:queens-1");
  });

  it("leaves an unclaimed id on its authored title", () => {
    // Raw labyrinths are not localized and carry no signature-game copy.
    const out = resolveSpecialTrainingLabels([entry("queen-lab-1", "Maze")], []);
    expect(out["queen-lab-1"]).toBe("Maze");
  });

  it("prefers the lane over the authored title — the 162ea1ae bug", () => {
    // `entry.title` is English authoring copy. If the lane loses to it, the row
    // ships titled in the wrong language and reads as content, not as a bug.
    const out = resolveSpecialTrainingLabels(
      [entry("queens-1", "The Quiet Room")],
      [lane(["queens-1"], "es")],
    );
    expect(out["queens-1"]).not.toBe("The Quiet Room");
  });
});

describe("every shipped signature game is localized", () => {
  const PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

  it("has ES copy for every queens level that ships", () => {
    // The catalog is the source of truth for what ships; the ES bundle must
    // have kept up. A level added without its copy fails HERE, not in the hands
    // of a Spanish player.
    const es = esMessages as unknown as {
      QUEENS_COPY: { title: Record<string, string>; prompt: Record<string, string> };
    };
    for (const piece of PIECES) {
      for (const level of QUEENS[piece]) {
        expect(es.QUEENS_COPY.title[level.id], `ES title for ${level.id}`).toBeTruthy();
        expect(es.QUEENS_COPY.prompt[level.id], `ES prompt for ${level.id}`).toBeTruthy();
      }
    }
  });

  it("leaves no signature-game level rendering authoring copy", () => {
    // The guard that would have caught the tour's bug: every level in a
    // signature-game pool must be claimed by a lane. A new game wired into the
    // catalog but not into the label lanes lands here.
    for (const piece of PIECES) {
      const entries = [
        ...DIAGONAL_RUN[piece],
        ...KNIGHT_TOUR[piece],
        ...QUEENS[piece],
      ];
      const lanes: LabelLane[] = [
        lane(DIAGONAL_RUN[piece].map((e) => e.id), "run"),
        lane(KNIGHT_TOUR[piece].map((e) => e.id), "tour"),
        lane(QUEENS[piece].map((e) => e.id), "queens"),
      ];
      expect(unlocalizedIds(entries, lanes), `${piece} has unlocalized rows`).toEqual([]);
    }
  });
});
