import { describe, it, expect, vi } from "vitest";

// Mock the heavy children — the page test only cares which one is
// chosen and what props are forwarded.
vi.mock("@/components/play-hub/play-hub-root", () => ({
  PlayHubRoot: (props: unknown) => ({
    type: "PlayHubRoot",
    props,
  }),
}));
vi.mock("@/components/hub/hub-scaffold-client", () => ({
  HubScaffoldClient: () => ({ type: "HubScaffoldClient", props: {} }),
}));

import HubPage from "../page";

function renderPage(searchParams: Record<string, string | string[] | undefined>) {
  // Server components are plain functions in Vitest — call directly and
  // inspect the returned ReactElement's type + props.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shape verified inline
  return HubPage({ searchParams: searchParams as any }) as unknown as {
    type: { name?: string };
    props: Record<string, unknown>;
  };
}

describe("/hub page (server)", () => {
  describe("default → scaffold", () => {
    it("renders <HubScaffoldClient /> when no flags are present", () => {
      const el = renderPage({});
      expect((el.type as unknown as { name: string }).name).toBe(
        "HubScaffoldClient",
      );
    });

    it("renders <HubScaffoldClient /> for the canary alias `?hub=new`", () => {
      const el = renderPage({ hub: "new" });
      expect((el.type as unknown as { name: string }).name).toBe(
        "HubScaffoldClient",
      );
    });

    it("renders <HubScaffoldClient /> when `legacy` is empty / missing", () => {
      const el = renderPage({ legacy: undefined });
      expect((el.type as unknown as { name: string }).name).toBe(
        "HubScaffoldClient",
      );
    });
  });

  describe("legacy fallback → PlayHubRoot", () => {
    it("renders <PlayHubRoot /> when `?legacy=1`", () => {
      const el = renderPage({ legacy: "1" });
      expect((el.type as unknown as { name: string }).name).toBe("PlayHubRoot");
    });

    it("renders <PlayHubRoot /> when `?legacy=true`", () => {
      const el = renderPage({ legacy: "true" });
      expect((el.type as unknown as { name: string }).name).toBe("PlayHubRoot");
    });

    it("forwards a valid `?piece=` to initialPiece", () => {
      const el = renderPage({ legacy: "1", piece: "bishop" });
      expect(el.props).toMatchObject({ initialPiece: "bishop" });
    });

    it("ignores an invalid `?piece=` (initialPiece undefined)", () => {
      const el = renderPage({ legacy: "1", piece: "dragon" });
      expect(el.props.initialPiece).toBeUndefined();
    });

    it("forwards a valid `?action=` to initialAction", () => {
      const el = renderPage({ legacy: "1", action: "shop" });
      expect(el.props).toMatchObject({ initialAction: "shop" });
    });

    it("accepts the three valid actions: shop, pro, badges", () => {
      for (const action of ["shop", "pro", "badges"] as const) {
        const el = renderPage({ legacy: "1", action });
        expect(el.props).toMatchObject({ initialAction: action });
      }
    });

    it("ignores an unknown `?action=` (initialAction undefined)", () => {
      const el = renderPage({ legacy: "1", action: "trophies" });
      expect(el.props.initialAction).toBeUndefined();
    });

    it("array-shaped searchParams are flattened to first entry", () => {
      const el = renderPage({
        legacy: ["1", "0"],
        piece: ["knight", "pawn"],
        action: ["pro", "shop"],
      });
      expect(el.props).toMatchObject({
        initialPiece: "knight",
        initialAction: "pro",
      });
    });
  });
});
