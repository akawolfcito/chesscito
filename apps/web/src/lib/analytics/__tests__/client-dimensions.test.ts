import { afterEach, describe, expect, it, vi } from "vitest";
import { localeFromPath } from "../client-dimensions";

describe("localeFromPath", () => {
  it("maps the first path segment to a locale, defaulting to en", () => {
    expect(localeFromPath("/es/hub")).toBe("es");
    expect(localeFromPath("/hub")).toBe("en"); // bare root = en
    expect(localeFromPath("/")).toBe("en");
    expect(localeFromPath("/fr/hub")).toBe("en"); // unknown locale → en
  });
});

describe("clientDimensions fail-open", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/lib/minipay");
  });

  it("returns a safe fallback and never throws when a source throws", async () => {
    vi.doMock("@/lib/minipay", () => ({
      isMiniPayEnv: () => {
        throw new Error("boom");
      },
    }));
    const { clientDimensions } = await import("../client-dimensions");
    expect(() => clientDimensions()).not.toThrow();
    const d = clientDimensions();
    expect(d.container).toBe("browser");
    expect(d.source).toBe("direct");
    expect(d.app_version).toBe("dev");
  });
});
