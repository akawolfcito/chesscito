import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() =>
  vi.fn((_url: string): never => undefined as never),
);

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import LegacyHubPage from "../page";

function renderLegacyHub(
  locale: string,
  searchParams: Record<string, string | string[] | undefined> = {},
): void {
  LegacyHubPage({ params: { locale }, searchParams });
}

describe("/hub route-level legacy fallback", () => {
  beforeEach(() => redirectMock.mockClear());

  it("redirects the default locale to root", () => {
    renderLegacyHub("en");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("redirects a non-default locale to its localized root", () => {
    renderLegacyHub("es");
    expect(redirectMock).toHaveBeenCalledWith("/es");
  });

  it("preserves sheet and legacy query parameters", () => {
    renderLegacyHub("en", {
      sheet: "profile",
      legacy: "1",
      action: "shop",
    });
    expect(redirectMock).toHaveBeenCalledWith(
      "/?sheet=profile&legacy=1&action=shop",
    );
  });

  it("preserves repeated query values", () => {
    renderLegacyHub("es", { piece: ["rook", "bishop"] });
    expect(redirectMock).toHaveBeenCalledWith(
      "/es?piece=rook&piece=bishop",
    );
  });
});
