import { describe, expect, it } from "vitest";
import { formatPublishResult } from "../publish-toast";

describe("formatPublishResult", () => {
  it("ok + revalidated → success toast with commit nudge", () => {
    const t = formatPublishResult({
      ok: true,
      baseline: { ok: true, id: "rook-1" },
      overlay: { ok: true, revalidated: true },
    });
    expect(t.kind).toBe("ok");
    expect(t.text).toMatch(/live/i);
    expect(t.text).toMatch(/commit/i);
  });

  it("ok but not yet revalidated → success toast notes propagation", () => {
    const t = formatPublishResult({
      ok: true,
      baseline: { ok: true, id: "rook-1" },
      overlay: { ok: true, revalidated: false },
    });
    expect(t.kind).toBe("ok");
    expect(t.text).toMatch(/propagat/i);
  });

  it("baseline ok but overlay failed → partial (warn) toast surfacing the overlay error", () => {
    const t = formatPublishResult({
      ok: false,
      baseline: { ok: true, id: "rook-1" },
      overlay: { ok: false, errors: ["overlay publish rejected: admin token rejected (403)"] },
    });
    expect(t.kind).toBe("warn");
    expect(t.text).toMatch(/saved to baseline/i);
    expect(t.text).toMatch(/403/);
    expect(t.text).toMatch(/commit/i);
  });

  it("baseline failed → error toast with the validation errors", () => {
    const t = formatPublishResult({
      ok: false,
      baseline: { ok: false, errors: ["rook-boxed: unsolvable"] },
      overlay: { ok: false, errors: ["skipped: baseline write failed"] },
    });
    expect(t.kind).toBe("err");
    expect(t.text).toMatch(/unsolvable/i);
  });
});
