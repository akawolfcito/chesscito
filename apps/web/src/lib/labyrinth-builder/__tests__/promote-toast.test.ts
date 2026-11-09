import { describe, expect, it } from "vitest";
import { formatPromoteResult } from "../promote-toast";

describe("formatPromoteResult", () => {
  it("ok → success toast naming the move + the ~60s propagation", () => {
    const t = formatPromoteResult(
      { ok: true, from: "draft", to: "published" },
      "rook-1",
    );
    expect(t.kind).toBe("ok");
    expect(t.text).toMatch(/rook-1/);
    expect(t.text).toMatch(/draft/);
    expect(t.text).toMatch(/published/);
    expect(t.text).toMatch(/60s|minute|propagat/i);
  });

  it("not ok → error toast surfacing the reason", () => {
    const t = formatPromoteResult(
      { ok: false, errors: ["no 'draft' version of exercise rook-1 to promote"] },
      "rook-1",
    );
    expect(t.kind).toBe("err");
    expect(t.text).toMatch(/no 'draft'/);
  });

  it("not ok with no errors → generic failure", () => {
    const t = formatPromoteResult({ ok: false }, "rook-1");
    expect(t.kind).toBe("err");
    expect(t.text).toMatch(/failed/i);
  });
});
