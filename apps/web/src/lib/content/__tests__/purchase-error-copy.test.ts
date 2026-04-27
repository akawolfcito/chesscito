import { describe, it, expect } from "vitest";
import { RESULT_OVERLAY_COPY } from "@/lib/content/editorial";

const KINDS = ["error", "cancelled", "timeout"] as const;

describe("RESULT_OVERLAY_COPY.error.purchaseKindCopy", () => {
  it("publishes copy for all three purchase end-state kinds", () => {
    const kinds = Object.keys(RESULT_OVERLAY_COPY.error.purchaseKindCopy);
    expect(kinds).toEqual(expect.arrayContaining([...KINDS]));
  });

  for (const kind of KINDS) {
    describe(`kind=${kind}`, () => {
      it("ships a non-empty title, subtitle and hint", () => {
        const copy = RESULT_OVERLAY_COPY.error.purchaseKindCopy[kind];
        expect(copy.title.length).toBeGreaterThan(0);
        expect(copy.subtitle.length).toBeGreaterThan(0);
        expect(copy.hint.length).toBeGreaterThan(0);
      });

      it("avoids leaking technical jargon (no 'EVALSHA', 'revert', 'undefined')", () => {
        const copy = RESULT_OVERLAY_COPY.error.purchaseKindCopy[kind];
        const blob = `${copy.title} ${copy.subtitle} ${copy.hint}`.toLowerCase();
        expect(blob).not.toMatch(/evalsha|undefined|null|nan|reverted with reason/);
      });
    });
  }

  it("the cancelled subtitle reassures the player that nothing was charged", () => {
    const copy = RESULT_OVERLAY_COPY.error.purchaseKindCopy.cancelled;
    expect(`${copy.subtitle} ${copy.hint}`.toLowerCase()).toMatch(/nothing was charged|no charge/);
  });

  it("the timeout subtitle nudges the wallet rather than blaming the network alone", () => {
    const copy = RESULT_OVERLAY_COPY.error.purchaseKindCopy.timeout;
    expect(`${copy.subtitle} ${copy.hint}`.toLowerCase()).toMatch(/wallet/);
  });
});
