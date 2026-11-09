/**
 * `extraFields` is the builder's only ride for record data the UI cannot draw.
 *
 * It lived unexported inside page.tsx, which is precisely why the loss below
 * survived so long — the same trap `deriveStateFromFen` was in (etapa 1). The
 * set it consults listed `kind`, so every edit dropped the record's game and
 * re-saved it as a plain labyrinth. That was the SECOND half of the corruption,
 * independent of the read that erased it: fixing only the reader still lost it
 * here, on the way back out.
 */
import { describe, expect, it } from "vitest";
import { extraFields } from "../state";

const QUEENS_RECORD = {
  id: "queens-1",
  piece: "queen" as const,
  kind: "queens" as const,
  fen: "NNNNNNNN/NNNNNNNN/NNNNNNNN/5NNN/5NNN/5NNN/5NNN/Q4NNN w - - 0 1",
  mover: "a1",
  tier: "easy" as const,
  title: "The Quiet Room",
  principle: "queens-intro",
  playerPrompt: "No queen may see another. Fill the room.",
  order: 3,
};

describe("extraFields", () => {
  it("carries the record's kind through, so an edit cannot demote a signature game", () => {
    expect(extraFields(QUEENS_RECORD).kind).toBe("queens");
  });

  it("carries player-facing copy and promoteTo, which the UI cannot express", () => {
    const extras = extraFields({ ...QUEENS_RECORD, promoteTo: "knight" });

    // `title` / `playerPrompt` are shown to players and the builder has no
    // field for them, so they ride along as passengers.
    expect(extras.title).toBe("The Quiet Room");
    expect(extras.promoteTo).toBe("knight");
  });

  it("does NOT carry the teaching guide — the UI owns it now", () => {
    // `principle` and `learningObjective` became editable in the builder
    // (the authoring-only teaching guide), so they are UI-owned: the builder's
    // edit must win, not the loaded copy that extraFields would re-impose.
    const extras = extraFields({
      ...QUEENS_RECORD,
      learningObjective: "No queen shares a line with another.",
    });

    expect(extras).not.toHaveProperty("principle");
    expect(extras).not.toHaveProperty("learningObjective");
  });

  it("drops `bucket`: it is a read-time tag, never part of the record", () => {
    const extras = extraFields({ ...QUEENS_RECORD, bucket: "labyrinth" });

    expect(extras).not.toHaveProperty("bucket");
  });

  it("drops the fields the UI owns, so its edits win instead of being overwritten", () => {
    const extras = extraFields(QUEENS_RECORD);

    for (const owned of ["id", "piece", "fen", "mover", "tier", "order"]) {
      expect(extras).not.toHaveProperty(owned);
    }
  });
});
