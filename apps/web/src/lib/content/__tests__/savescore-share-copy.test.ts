/**
 * Slice A — SaveScore share/saved copy guard.
 *
 * The base save is off-chain now. Its share + saved-state copy must stop
 * claiming on-chain permanence ("on Celo", "forever", "Kept forever") and
 * stop framing a score save as piece mastery. The SavedChip aria (the
 * off-chain, no-receipt path) must not say "saved on chain".
 *
 * `ariaLabelWithReceipt` is intentionally NOT guarded: it only renders for
 * legacy localStorage entries that ARE genuine on-chain saves (real tx +
 * CeloScan), where "on chain" is correct.
 */

import { describe, expect, it } from "vitest";

import { SHARE_COPY, SCORE_SHARE_COPY, SAVED_CHIP_COPY } from "@/lib/content/editorial";

describe("SHARE_COPY.score — leaderboard-first, no on-chain claim", () => {
  const text = SHARE_COPY.score(9);

  it("does not claim Celo / forever / on-chain permanence", () => {
    expect(text).not.toMatch(/celo/i);
    expect(text).not.toMatch(/forever/i);
    expect(text).not.toMatch(/on[-\s]?chain/i);
  });

  it("is leaderboard-framed with a beat-it hook", () => {
    expect(text).toMatch(/leaderboard/i);
    expect(text).toMatch(/beat it/i);
  });
});

describe("SCORE_SHARE_COPY.kicker — not piece mastery", () => {
  it("does not call a score save 'mastered'", () => {
    expect(SCORE_SHARE_COPY.kickerFormat).not.toMatch(/mastered/i);
    expect(SCORE_SHARE_COPY.kickerFormat).toMatch(/leaderboard/i);
  });
});

describe("SAVED_CHIP_COPY.ariaLabel — off-chain, no on-chain claim", () => {
  it("drops the 'on chain' wording for the off-chain saved state", () => {
    expect(SAVED_CHIP_COPY.ariaLabel(6, 15)).not.toMatch(/on[-\s]?chain/i);
    expect(SAVED_CHIP_COPY.ariaLabel(6, 15)).toMatch(/score saved/i);
  });
});
