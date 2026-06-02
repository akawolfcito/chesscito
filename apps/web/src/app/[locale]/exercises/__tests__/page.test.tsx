import { describe, it, expect, vi } from "vitest";

vi.mock("@/components/exercises/exercises-screen", () => ({
  ExercisesScreen: (props: unknown) => ({
    type: "ExercisesScreen",
    props,
  }),
}));

import ExercisesPage from "../page";

type SearchParamsLike = {
  piece?: string | string[];
};

type RenderedElement = {
  type: { name?: string };
  props: Record<string, unknown>;
};

function renderPage(searchParams: SearchParamsLike): RenderedElement {
  return ExercisesPage({ searchParams }) as unknown as RenderedElement;
}

describe("/exercises page (server)", () => {
  it("renders <ExercisesScreen /> with no initialPiece when `piece` is missing", () => {
    const el = renderPage({});
    expect((el.type as unknown as { name: string }).name).toBe("ExercisesScreen");
    expect(el.props.initialPiece).toBeUndefined();
  });

  it("forwards a valid `?piece=` to initialPiece", () => {
    const el = renderPage({ piece: "bishop" });
    expect(el.props).toMatchObject({ initialPiece: "bishop" });
  });

  it("ignores an unknown `?piece=` (initialPiece undefined)", () => {
    const el = renderPage({ piece: "dragon" });
    expect(el.props.initialPiece).toBeUndefined();
  });

  it("accepts pieces with defined exercises (rook, bishop, knight, pawn, queen, king)", () => {
    for (const piece of [
      "rook",
      "bishop",
      "knight",
      "pawn",
      "queen",
      "king",
    ] as const) {
      const el = renderPage({ piece });
      expect(el.props).toMatchObject({ initialPiece: piece });
    }
  });

  it("array-shaped `?piece=` is flattened to first entry", () => {
    const el = renderPage({ piece: ["knight", "pawn"] });
    expect(el.props).toMatchObject({ initialPiece: "knight" });
  });
});
