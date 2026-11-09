import { beforeEach, describe, expect, it, vi } from "vitest";

const trackMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/telemetry", () => ({ track: (...args: unknown[]) => trackMock(...args) }));

import {
  emitPlayTacticsCompleted,
  emitPlayTacticsFailed,
  emitPlayTacticsOpened,
} from "../telemetry";

const PUZZLE = { puzzleId: "dt-rook-1", piece: "rook" };

describe("Play Tactics telemetry", () => {
  beforeEach(() => trackMock.mockReset());

  it("emits only Play-owned event names", () => {
    emitPlayTacticsOpened({ ...PUZZLE, completedToday: false });
    emitPlayTacticsCompleted({ ...PUZZLE, movesUsed: 1, totalCompleted: 4 });
    emitPlayTacticsFailed({ ...PUZZLE, movesUsed: 1 });

    expect(trackMock.mock.calls.map((call) => call[0])).toEqual([
      "play_tactics_opened",
      "play_tactics_completed",
      "play_tactics_failed",
    ]);
    expect(trackMock.mock.calls.flat().join(" ")).not.toMatch(/daily|focus|challenge|passport/i);
  });
});
