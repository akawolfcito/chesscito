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

import HomePage, { generateMetadata } from "../page";

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

function renderPage(
  searchParams: SearchParamsLike,
  locale = "en",
): RenderedElement | undefined {
  try {
    return HomePage({
      params: { locale },
      searchParams,
    }) as unknown as RenderedElement;
  } catch (err) {
    if ((err as Error).message === "REDIRECT") return undefined;
    throw err;
  }
}

describe("/ page (canonical Hub server route)", () => {
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

    it("preloads the daily tile icon AVIF (LCP candidate post-hydration)", () => {
      // 2026-06-12: the tile asset is daily-icon-v1 (hub-daily-tile.tsx);
      // the old ejercicio-diario-chess preload was stale — it fetched an
      // icon only used inside the daily sheet, while the real tile icon
      // waited for hydration (LCP Load Delay ~5s on prod).
      renderPage({});
      expect(preloadMock).toHaveBeenCalledWith(
        "/art/new-icons-chesscito/daily-icon-v1.avif",
        { as: "image", type: "image/avif", fetchPriority: "high" },
      );
      const calls = preloadMock.mock.calls.map((args) => args[0] as string);
      expect(calls).not.toContain(
        "/art/new-icons-chesscito/ejercicio-diario-chess.avif",
      );
    });

    it("preloads the kingdom portal AVIF (the root Hub LCP element)", () => {
      // 2026-06-12: the portal became the LCP after the q35 bg re-encode;
      // KingdomAnchor is client-rendered so without a preload the URL is
      // only discovered post-hydration.
      renderPage({});
      expect(preloadMock).toHaveBeenCalledWith(
        "/art/hub/portal-chesscito-normal.avif",
        { as: "image", type: "image/avif", fetchPriority: "high" },
      );
    });

    it("does NOT preload WebP fallbacks (AVIF-only for MiniPay Chromium)", () => {
      renderPage({});
      const calls = preloadMock.mock.calls.map((args) => args[0] as string);
      expect(calls).not.toContain("/art/redesign/bg/bg-new-hub.webp");
      expect(calls).not.toContain(
        "/art/new-icons-chesscito/daily-icon-v1.webp",
      );
    });

    it("skips preloads on legacy bookmark redirects", () => {
      renderPage({ legacy: "1" });
      expect(preloadMock).not.toHaveBeenCalled();
    });
  });

  describe("metadata", () => {
    it("marks the app root noindex and canonicalizes the default locale", () => {
      const metadata = generateMetadata({ params: { locale: "en" } });
      expect(metadata.robots).toEqual({ index: false, follow: false });
      expect(metadata.alternates).toMatchObject({ canonical: "/" });
    });

    it("canonicalizes a non-default locale to its localized root", () => {
      const metadata = generateMetadata({ params: { locale: "es" } });
      expect(metadata.alternates).toMatchObject({ canonical: "/es" });
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

    it("keeps a localized `?sheet=` deep link on the ES scaffold", () => {
      const el = renderPage({ sheet: "profile" }, "es");
      expect(el?.props.initialSheet).toBe("profile");
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
        expect(redirectMock).toHaveBeenCalledWith(`/?sheet=${action}`);
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

    it("preserves ES for a legacy piece redirect", () => {
      renderPage({ legacy: "1", piece: "rook" }, "es");
      expect(redirectMock).toHaveBeenCalledWith("/es/exercises?piece=rook");
    });

    it("preserves ES for a legacy trophies redirect", () => {
      renderPage({ legacy: "1", action: "trophies" }, "es");
      expect(redirectMock).toHaveBeenCalledWith("/es/trophies");
    });

    it("preserves ES for a legacy shop sheet redirect", () => {
      renderPage({ legacy: "1", action: "shop" }, "es");
      expect(redirectMock).toHaveBeenCalledWith("/es?sheet=shop");
    });
  });
});
