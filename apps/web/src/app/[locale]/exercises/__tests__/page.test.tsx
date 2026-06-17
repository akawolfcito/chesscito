import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

// db-backed-content Phase 2c: the page mounts an ExerciseCatalogProvider with
// the merged (baseline ⊕ overlay) pools ONLY when CONTENT_OVERLAY_ENABLED is
// on. With the flag off it renders <ExercisesScreen /> directly — byte-identical
// to the pre-2c behavior, and never calls getMergedCatalog (no DB hit).

let overlayEnabled = false;
const getMergedCatalog = vi.fn();

vi.mock("@/components/exercises/exercises-screen", () => ({
  ExercisesScreen: (props: unknown) => ({ type: "ExercisesScreen", props }),
}));
vi.mock("@/lib/content/catalog-context", () => ({
  ExerciseCatalogProvider: (props: unknown) => ({
    type: "ExerciseCatalogProvider",
    props,
  }),
}));
vi.mock("@/lib/content/merged-catalog", () => ({
  getMergedCatalog: () => getMergedCatalog(),
}));
vi.mock("@/lib/content/overlay-flag", () => ({
  get CONTENT_OVERLAY_ENABLED() {
    return overlayEnabled;
  },
}));

import ExercisesPage from "../page";

type SearchParamsLike = {
  piece?: string | string[];
};

type RenderedElement = {
  type: { name?: string } | string;
  props: Record<string, unknown>;
};

async function renderPage(
  searchParams: SearchParamsLike,
): Promise<RenderedElement> {
  return (await ExercisesPage({ searchParams })) as unknown as RenderedElement;
}

beforeEach(() => {
  overlayEnabled = false;
  getMergedCatalog.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("/exercises page (server) — flag OFF (baseline)", () => {
  it("renders <ExercisesScreen /> with no initialPiece when `piece` is missing", async () => {
    const el = await renderPage({});
    expect((el.type as { name: string }).name).toBe("ExercisesScreen");
    expect(el.props.initialPiece).toBeUndefined();
  });

  it("forwards a valid `?piece=` to initialPiece", async () => {
    const el = await renderPage({ piece: "bishop" });
    expect(el.props).toMatchObject({ initialPiece: "bishop" });
  });

  it("ignores an unknown `?piece=` (initialPiece undefined)", async () => {
    const el = await renderPage({ piece: "dragon" });
    expect(el.props.initialPiece).toBeUndefined();
  });

  it("accepts pieces with defined exercises (rook, bishop, knight, pawn, queen, king)", async () => {
    for (const piece of [
      "rook",
      "bishop",
      "knight",
      "pawn",
      "queen",
      "king",
    ] as const) {
      const el = await renderPage({ piece });
      expect(el.props).toMatchObject({ initialPiece: piece });
    }
  });

  it("array-shaped `?piece=` is flattened to first entry", async () => {
    const el = await renderPage({ piece: ["knight", "pawn"] });
    expect(el.props).toMatchObject({ initialPiece: "knight" });
  });

  it("does NOT mount a provider and never reads the merged catalog", async () => {
    const el = await renderPage({ piece: "rook" });
    expect((el.type as { name: string }).name).toBe("ExercisesScreen");
    expect(getMergedCatalog).not.toHaveBeenCalled();
  });
});

describe("/exercises page (server) — flag ON (overlay)", () => {
  const mergedPools = {
    exercises: {
      rook: [{ id: "rook-overlay-1" }],
      bishop: [{ id: "bishop-baseline" }],
      knight: [],
      pawn: [],
      queen: [],
      king: [],
    },
    labyrinths: {},
    descriptions: {},
    source: "baseline+overlay" as const,
    overlayCount: 1,
  };

  beforeEach(() => {
    overlayEnabled = true;
    getMergedCatalog.mockResolvedValue(mergedPools);
  });

  it("mounts ExerciseCatalogProvider with the merged exercise pools", async () => {
    const el = await renderPage({});
    expect((el.type as { name: string }).name).toBe("ExerciseCatalogProvider");
    expect(el.props.value).toBe(mergedPools.exercises);
    expect(getMergedCatalog).toHaveBeenCalledTimes(1);
  });

  it("wraps <ExercisesScreen /> as the provider child", async () => {
    const el = await renderPage({ piece: "rook" });
    const child = el.props.children as RenderedElement;
    expect((child.type as { name: string }).name).toBe("ExercisesScreen");
    expect(child.props).toMatchObject({ initialPiece: "rook" });
  });

  it("validates `?piece=` against the MERGED pools, not the baseline", async () => {
    // knight is empty in the merged pools → rejected even though the baseline
    // has knight exercises.
    const el = await renderPage({ piece: "knight" });
    const child = el.props.children as RenderedElement;
    expect(child.props.initialPiece).toBeUndefined();
  });
});
