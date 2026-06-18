import { describe, it, expect, afterEach } from "vitest";
import {
  visibleStages,
  envStageFloor,
  resolveVisibleRows,
} from "../stage";
import type { ContentOverlayRow, ContentStage } from "../overlay-types";

describe("visibleStages — the maturity ladder", () => {
  it("draft floor sees all three stages", () => {
    expect(visibleStages("draft")).toEqual(["draft", "preview", "published"]);
  });

  it("preview floor sees preview + published (not draft)", () => {
    expect(visibleStages("preview")).toEqual(["preview", "published"]);
  });

  it("published floor sees only published", () => {
    expect(visibleStages("published")).toEqual(["published"]);
  });
});

describe("envStageFloor — reads CONTENT_STAGE (kill-switch on unset/invalid)", () => {
  const original = process.env.CONTENT_STAGE;
  afterEach(() => {
    if (original === undefined) delete process.env.CONTENT_STAGE;
    else process.env.CONTENT_STAGE = original;
  });

  it("returns the valid stage", () => {
    process.env.CONTENT_STAGE = "preview";
    expect(envStageFloor()).toBe("preview");
  });

  it("returns null when unset (→ baseline-only kill-switch)", () => {
    delete process.env.CONTENT_STAGE;
    expect(envStageFloor()).toBeNull();
  });

  it("returns null on an invalid value", () => {
    process.env.CONTENT_STAGE = "prod"; // typo
    expect(envStageFloor()).toBeNull();
  });
});

describe("resolveVisibleRows — one row per id (freshest that reached this env)", () => {
  const mk = (
    id: string,
    stage: ContentStage,
    extra: Partial<ContentOverlayRow> = {},
  ): ContentOverlayRow => ({
    id,
    kind: "exercise",
    piece: "rook",
    fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
    target: "a8",
    mover: "a1",
    tier: "easy",
    tags: null,
    explanation: null,
    order: 0,
    disabled: false,
    optimal_moves: 1,
    updated_at: "2026-06-17T00:00:00Z",
    stage,
    ...extra,
  });

  it("dev (draft floor) picks the draft over the live published of the same id", () => {
    const rows = [mk("x", "published"), mk("x", "draft")];
    const out = resolveVisibleRows(rows, "draft");
    expect(out).toHaveLength(1);
    expect(out[0].stage).toBe("draft");
  });

  it("prod (published floor) only ever resolves the published row", () => {
    const rows = [mk("x", "published"), mk("x", "draft")];
    const out = resolveVisibleRows(rows, "published");
    expect(out).toHaveLength(1);
    expect(out[0].stage).toBe("published");
  });

  it("preview (preview floor) ignores the draft and shows the published when no preview exists", () => {
    const rows = [mk("x", "published"), mk("x", "draft")];
    const out = resolveVisibleRows(rows, "preview");
    expect(out).toHaveLength(1);
    expect(out[0].stage).toBe("published");
  });

  it("preview picks the preview row over published for the same id", () => {
    const rows = [mk("x", "published"), mk("x", "preview")];
    const out = resolveVisibleRows(rows, "preview");
    expect(out[0].stage).toBe("preview");
  });

  it("a draft-only new puzzle does NOT leak to preview or prod", () => {
    const rows = [mk("new", "draft")];
    expect(resolveVisibleRows(rows, "preview")).toHaveLength(0);
    expect(resolveVisibleRows(rows, "published")).toHaveLength(0);
    expect(resolveVisibleRows(rows, "draft")).toHaveLength(1);
  });

  it("keeps distinct ids independent", () => {
    const rows = [mk("a", "published"), mk("b", "draft")];
    const out = resolveVisibleRows(rows, "draft");
    expect(out.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });
});
