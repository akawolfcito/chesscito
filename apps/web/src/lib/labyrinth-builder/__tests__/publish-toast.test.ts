import { describe, expect, it } from "vitest";
import { formatPublishResult } from "../publish-toast";

describe("formatPublishResult", () => {
  it("ok + revalidated → 'saved as draft' toast (NOT live) + commit + promote nudge", () => {
    const t = formatPublishResult({
      ok: true,
      baseline: { ok: true, id: "rook-1" },
      overlay: { ok: true, revalidated: true },
    });
    expect(t.kind).toBe("ok");
    expect(t.text).toMatch(/draft/i);
    expect(t.text).not.toMatch(/\blive\b/i); // staging: Save ≠ live to players
    expect(t.text).toMatch(/promote/i);
    expect(t.text).toMatch(/commit/i);
  });

  it("ok but not yet revalidated → draft toast notes propagation", () => {
    const t = formatPublishResult({
      ok: true,
      baseline: { ok: true, id: "rook-1" },
      overlay: { ok: true, revalidated: false },
    });
    expect(t.kind).toBe("ok");
    expect(t.text).toMatch(/draft/i);
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

  /**
   * The save route has always sent `baseline.warnings` over the wire
   * (app/api/dev/publish/route.ts:144) — and this mapper dropped them on the
   * floor, because `PublishResultLike` did not even declare the field. Every
   * warning the catalog linter produced at save time died here, unread.
   *
   * That is why the founder reports "a warning appears but the screen
   * refreshes before I can read it": what they were catching was the LIVE
   * per-board validation panel re-rendering. The save-time warnings never
   * arrived at all.
   *
   * So warnings ride on the result as their own array, not concatenated into
   * `text`. The toast is transient by nature; the caller needs the list to
   * render somewhere that survives the refresh.
   */
  it("carries save-time warnings through instead of dropping them", () => {
    const t = formatPublishResult({
      ok: true,
      baseline: {
        ok: true,
        id: "rook-6",
        warnings: ["rook: the curve jumps 3 moves at step 6"],
      },
      overlay: { ok: true, revalidated: true },
    });
    expect(t.kind).toBe("ok");
    expect(t.warnings).toEqual(["rook: the curve jumps 3 moves at step 6"]);
  });

  it("reports no warnings as an empty list, never undefined", () => {
    // The caller renders `warnings.length` — an undefined here is a crash in
    // the builder, on the save path, which is the worst place for one.
    const t = formatPublishResult({
      ok: true,
      baseline: { ok: true, id: "rook-1" },
      overlay: { ok: true, revalidated: true },
    });
    expect(t.warnings).toEqual([]);
  });

  it("still carries warnings when the overlay half failed", () => {
    // A partial save is exactly when the author most needs to know what the
    // linter thought of the content that DID land in the baseline.
    const t = formatPublishResult({
      ok: false,
      baseline: { ok: true, id: "rook-6", warnings: ["rook: the curve goes backwards"] },
      overlay: { ok: false, errors: ["admin token rejected (403)"] },
    });
    expect(t.kind).toBe("warn");
    expect(t.warnings).toEqual(["rook: the curve goes backwards"]);
  });
});
