import { describe, expect, it } from "vitest";

import { appModeUrl } from "../app-mode";

describe("appModeUrl", () => {
  it("switches preview Full to preview Lite and preserves the complete route", () => {
    expect(
      appModeUrl(
        "training",
        new URL("https://preview.chesscito.com/es/hub?sheet=pro#account"),
      ),
    ).toBe("https://lite-preview.chesscito.com/es?sheet=pro#account");
  });

  it("switches production Lite to production Play", () => {
    expect(appModeUrl("play", new URL("https://lite.chesscito.com/"))).toBe(
      "https://play.chesscito.com/hub",
    );
  });

  it("keeps the locale when opening the Full hub", () => {
    expect(appModeUrl("play", new URL("https://lite.chesscito.com/es"))).toBe(
      "https://play.chesscito.com/es/hub",
    );
  });
});
