/**
 * Slice A — OG exercise card copy.
 *
 * `ogExerciseCardCopy` is the pure label map for the non-daily
 * `/api/og/exercise` card (eyebrow / title / tagline / footer). It exists
 * so the SCORE-SAVED share stops borrowing the PIECE-MASTERED template:
 *
 *   piece-complete -> "PIECE COMPLETE" / "{Piece} Mastered"  (unchanged)
 *   badge-earned   -> "BADGE UNLOCKED" / "{Piece} Ascendant"  (unchanged)
 *   score-saved    -> "SCORE SAVED" / "On the leaderboard"    (NEW, leaderboard-first)
 *
 * The score card must NOT say "Mastered" and its footer must NOT claim
 * "saved on Celo" (the base save is off-chain now).
 */

import { describe, expect, it } from "vitest";

import { ogExerciseCardCopy } from "../exercise-card-copy";

describe("ogExerciseCardCopy — score-saved (NEW)", () => {
  const c = ogExerciseCardCopy("score-saved", "Rook", 9);

  it('eyebrow is "SCORE SAVED"', () => {
    expect(c.eyebrow).toBe("SCORE SAVED");
  });

  it("title is leaderboard-first and NOT piece mastery", () => {
    expect(c.title).toBe("On the leaderboard");
    expect(c.title).not.toMatch(/mastered/i);
    expect(c.title).not.toMatch(/ascendant/i);
  });

  it("tagline carries the stars + a beat-it hook, no on-chain claim", () => {
    expect(c.tagline).toContain("9");
    expect(c.tagline).toMatch(/beat it/i);
    expect(c.tagline).not.toMatch(/yours to keep/i);
    expect(c.tagline).not.toMatch(/celo|forever|on-chain|on chain/i);
  });

  it('footer does NOT claim "saved on Celo"', () => {
    expect(c.footer).not.toMatch(/saved on celo/i);
    expect(c.footer).toMatch(/leaderboard/i);
  });
});

describe("ogExerciseCardCopy — existing types unchanged", () => {
  it("piece-complete keeps PIECE COMPLETE / {Piece} Mastered", () => {
    const c = ogExerciseCardCopy("piece-complete", "Bishop", 12);
    expect(c.eyebrow).toBe("PIECE COMPLETE");
    expect(c.title).toBe("Bishop Mastered");
    expect(c.footer).toMatch(/saved on celo/i);
  });

  it("badge-earned keeps BADGE UNLOCKED / {Piece} Ascendant", () => {
    const c = ogExerciseCardCopy("badge-earned", "Knight", 15);
    expect(c.eyebrow).toBe("BADGE UNLOCKED");
    expect(c.title).toBe("Knight Ascendant");
    expect(c.tagline).toMatch(/yours to keep/i);
  });
});
