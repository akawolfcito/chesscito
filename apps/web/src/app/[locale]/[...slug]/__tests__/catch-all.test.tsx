import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.doMock (non-hoisted) + vi.resetModules() so each test loads
// CatchAllPage fresh with the intended CHESSCITO_LITE_MODE value.

describe("[locale]/[...slug] catch-all page", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("Lite mode (CHESSCITO_LITE_MODE=true)", () => {
    it("calls redirect('/hub')", async () => {
      const redirectMock = vi.fn();
      vi.doMock("@/lib/feature-flags", () => ({ CHESSCITO_LITE_MODE: true }));
      vi.doMock("next/navigation", () => ({
        redirect: redirectMock,
        notFound: vi.fn(),
      }));

      const { default: CatchAllPage } = await import("../page");
      CatchAllPage();

      expect(redirectMock).toHaveBeenCalledWith("/hub");
      expect(redirectMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("Full mode (CHESSCITO_LITE_MODE=false)", () => {
    it("calls notFound()", async () => {
      const notFoundMock = vi.fn();
      vi.doMock("@/lib/feature-flags", () => ({ CHESSCITO_LITE_MODE: false }));
      vi.doMock("next/navigation", () => ({
        redirect: vi.fn(),
        notFound: notFoundMock,
      }));

      const { default: CatchAllPage } = await import("../page");
      CatchAllPage();

      expect(notFoundMock).toHaveBeenCalledTimes(1);
    });
  });
});
