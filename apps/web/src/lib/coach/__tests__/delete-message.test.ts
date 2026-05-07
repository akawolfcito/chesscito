import { describe, it, expect } from "vitest";
import { buildDeleteMessage } from "../delete-message.js";
import { COACH_COPY } from "@/lib/content/editorial";

describe("buildDeleteMessage", () => {
  it("produces the expected chain + domain bound template", () => {
    const out = buildDeleteMessage("deadbeef", "2026-05-06T12:00:00.000Z");
    expect(out).toBe(
      "Delete my Coach history\nDomain: chesscito.app\nChain: 42220\nNonce: deadbeef\nIssued: 2026-05-06T12:00:00.000Z",
    );
  });

  it("client (COACH_COPY.historyDelete.signMessage) and server use the SAME function", () => {
    expect(COACH_COPY.historyDelete.signMessage).toBe(buildDeleteMessage);
  });
});
