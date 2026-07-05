import { describe, expect, it } from "vitest";

import { appModeUrl } from "../app-mode";

describe("appModeUrl", () => {
  it("switches preview Play to preview Learn and preserves URL state", () => {
    expect(
      appModeUrl(
        "learn",
        new URL("https://preview.chesscito.com/es/hub?sheet=pro#account"),
      ),
    ).toBe("https://learn-preview.chesscito.com/es?sheet=pro#account");
  });

  it("switches production Learn to production Play", () => {
    expect(appModeUrl("play", new URL("https://learn.chesscito.com/"))).toBe(
      "https://play.chesscito.com/hub",
    );
  });

  it("keeps the locale when opening the Play hub", () => {
    expect(appModeUrl("play", new URL("https://learn.chesscito.com/es"))).toBe(
      "https://play.chesscito.com/es/hub",
    );
  });

  it("switches production Play to Learn", () => {
    expect(appModeUrl("learn", new URL("https://play.chesscito.com/es/hub"))).toBe(
      "https://learn.chesscito.com/es",
    );
  });

  it("keeps the preview tier when switching from legacy Lite Preview", () => {
    expect(
      appModeUrl("play", new URL("https://lite-preview.chesscito.com/es")),
    ).toBe("https://preview.chesscito.com/es/hub");
  });
});
