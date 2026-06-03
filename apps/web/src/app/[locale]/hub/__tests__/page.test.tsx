import { describe, it, expect, vi, beforeEach } from "vitest";

const redirectMock = vi.hoisted(() =>
  vi.fn((_url: string): never => {
    // next/navigation's redirect() throws a NEXT_REDIRECT error to halt
    // rendering. We mirror the throw so callers detect the redirect.
    throw new Error("REDIRECT");
  }),
);

const preloadMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("react-dom", () => ({
  preload: preloadMock,
}));

vi.mock("@/components/hub/hub-scaffold-client", () => ({
  HubScaffoldClient: () => ({ type: "HubScaffoldClient", props: {} }),
}));

import HubPage from "../page";

type SearchParamsLike = {
  legacy?: string | string[];
  piece?: string | string[];
  action?: string | string[];
  sheet?: string | string[];
};

type RenderedElement = {
  type: { name?: string };
  props: Record<string, unknown>;
};

function renderPage(searchParams: SearchParamsLike): RenderedElement | undefined {
  try {
    return HubPage({ searchParams }) as unknown as RenderedElement;
  } catch (err) {
    if ((err as Error).message === "REDIRECT") return undefined;
    throw err;
  }
}

describe("/hub page (server)", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    preloadMock.mockClear();
  });

  describe("LCP preload", () => {
    it("preloads the hub-scaffold background AVIF with high priority", () => {
      renderPage({});
      expect(preloadMock).toHaveBeenCalledWith(
        "/art/redesign/bg/bg-new-hub.avif",
        { as: "image", type: "image/avif", fetchPriority: "high" },
      );
    });

    it("preloads the WebP fallback for browsers without AVIF support", () => {
      renderPage({});
      expect(preloadMock).toHaveBeenCalledWith(
        "/art/redesign/bg/bg-new-hub.webp",
        { as: "image", type: "image/webp" },
      );
    });

    it("does NOT preload the legacy daily-exercise icon", () => {
      renderPage({});
      const calls = preloadMock.mock.calls.map((args) => args[0] as string);
      expect(calls).not.toContain(
        "/art/new-icons-chesscito/ejercicio-diario-chess.avif",
      );
    });

    it("skips preloads on legacy bookmark redirects", () => {
      renderPage({ legacy: "1" });
      expect(preloadMock).not.toHaveBeenCalled();
    });
  });

  describe("default → scaffold", () => {
    it("renders <HubScaffoldClient /> when no flags are present", () => {
      const el = renderPage({});
      expect((el?.type as unknown as { name: string }).name).toBe(
        "HubScaffoldClient",
      );
      expect(redirectMock).not.toHaveBeenCalled();
    });

    it("renders <HubScaffoldClient /> when `legacy` is empty / missing", () => {
      const el = renderPage({ legacy: undefined });
      expect((el?.type as unknown as { name: string }).name).toBe(
        "HubScaffoldClient",
      );
      expect(redirectMock).not.toHaveBeenCalled();
    });

    it("passes a valid `?sheet=` deep link into the scaffold", () => {
      const el = renderPage({ sheet: "shop" });
      expect(el?.props.initialSheet).toBe("shop");
      expect(redirectMock).not.toHaveBeenCalled();
    });

    it("ignores an unknown `?sheet=` value", () => {
      const el = renderPage({ sheet: "leaderboard" });
      expect(el?.props.initialSheet).toBeUndefined();
      expect(redirectMock).not.toHaveBeenCalled();
    });
  });

  describe("legacy bookmark redirects", () => {
    it("redirects `?legacy=1` to /exercises (no piece)", () => {
      renderPage({ legacy: "1" });
      expect(redirectMock).toHaveBeenCalledWith("/exercises");
    });

    it("redirects `?legacy=true` to /exercises", () => {
      renderPage({ legacy: "true" });
      expect(redirectMock).toHaveBeenCalledWith("/exercises");
    });

    it("preserves a valid `?piece=` on the redirect to /exercises", () => {
      renderPage({ legacy: "1", piece: "bishop" });
      expect(redirectMock).toHaveBeenCalledWith("/exercises?piece=bishop");
    });

    it("drops an invalid `?piece=` from the redirect", () => {
      renderPage({ legacy: "1", piece: "dragon" });
      expect(redirectMock).toHaveBeenCalledWith("/exercises");
    });

    it("preserves rook/bishop/knight/pawn/queen/king on the redirect", () => {
      for (const piece of [
        "rook",
        "bishop",
        "knight",
        "pawn",
        "queen",
        "king",
      ] as const) {
        redirectMock.mockClear();
        renderPage({ legacy: "1", piece });
        expect(redirectMock).toHaveBeenCalledWith(`/exercises?piece=${piece}`);
      }
    });

    it("redirects `?legacy=1&action=trophies` to /trophies", () => {
      renderPage({ legacy: "1", action: "trophies" });
      expect(redirectMock).toHaveBeenCalledWith("/trophies");
    });

    it.each(["shop", "pro", "badges"] as const)(
      "redirects `?legacy=1&action=%s` to a scaffold sheet deep link",
      (action) => {
        redirectMock.mockClear();
        renderPage({ legacy: "1", action });
        expect(redirectMock).toHaveBeenCalledWith(`/hub?sheet=${action}`);
      },
    );

    it("redirects unknown `?action=` to /exercises", () => {
      renderPage({ legacy: "1", action: "leaderboard" });
      expect(redirectMock).toHaveBeenCalledWith("/exercises");
    });

    it("array-shaped searchParams flatten to first entry", () => {
      renderPage({
        legacy: ["1", "0"],
        piece: ["knight", "pawn"],
        action: ["xx"],
      });
      expect(redirectMock).toHaveBeenCalledWith("/exercises?piece=knight");
    });
  });
});
