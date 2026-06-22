import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// vi.doMock (non-hoisted) + vi.resetModules() is the correct pattern when
// the same test file needs to exercise different values of a module-level
// constant (CHESSCITO_LITE_MODE). Each test resets the module registry,
// registers its factory via doMock, then imports the component fresh.

describe("[locale]/not-found", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("Full mode (CHESSCITO_LITE_MODE=false)", () => {
    it("renders 404 page with title and Back to Hub link", async () => {
      vi.doMock("@/lib/feature-flags", () => ({ CHESSCITO_LITE_MODE: false }));
      vi.doMock("next/navigation", () => ({ redirect: vi.fn() }));

      const { default: NotFound } = await import("../not-found");
      render(<NotFound />);

      expect(screen.getByText("Page not found")).toBeTruthy();
      const link = screen.getByRole("link", { name: "Back to Hub" });
      expect(link).toBeTruthy();
      expect(link.getAttribute("href")).toBe("/hub");
    });
  });

  describe("Lite mode (CHESSCITO_LITE_MODE=true)", () => {
    it("calls redirect('/hub') without rendering 404 content", async () => {
      const redirectMock = vi.fn();
      vi.doMock("@/lib/feature-flags", () => ({ CHESSCITO_LITE_MODE: true }));
      vi.doMock("next/navigation", () => ({ redirect: redirectMock }));

      const { default: NotFound } = await import("../not-found");
      render(<NotFound />);

      expect(redirectMock).toHaveBeenCalledWith("/hub");
      expect(redirectMock).toHaveBeenCalledTimes(1);
    });
  });
});
