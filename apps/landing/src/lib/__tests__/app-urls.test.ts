import { afterEach, describe, expect, it, vi } from "vitest";

async function loadAppUrls(
  env: Partial<
    Record<
      | "NEXT_PUBLIC_LEARN_URL"
      | "NEXT_PUBLIC_PLAY_URL"
      | "NEXT_PUBLIC_FULL_URL",
      string | undefined
    >
  > = {},
) {
  vi.resetModules();
  for (const key of [
    "NEXT_PUBLIC_LEARN_URL",
    "NEXT_PUBLIC_PLAY_URL",
    "NEXT_PUBLIC_FULL_URL",
  ] as const) {
    vi.stubEnv(key, env[key]);
  }
  return import("../app-urls");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("app URLs", () => {
  it("uses the canonical Learn and Play production origins by default", async () => {
    const urls = await loadAppUrls();
    expect(urls.LEARN_URL).toBe("https://learn.chesscito.com");
    expect(urls.PLAY_URL).toBe("https://play.chesscito.com");
  });

  it("uses the explicit Learn and Play variables", async () => {
    const urls = await loadAppUrls({
      NEXT_PUBLIC_LEARN_URL: "https://learn-preview.chesscito.com/hub/",
      NEXT_PUBLIC_PLAY_URL: "https://preview.chesscito.com/hub",
      NEXT_PUBLIC_FULL_URL: "https://ignored.example",
    });
    expect(urls.LEARN_URL).toBe("https://learn-preview.chesscito.com");
    expect(urls.PLAY_URL).toBe("https://preview.chesscito.com");
  });

  it("keeps NEXT_PUBLIC_FULL_URL only as a Play fallback", async () => {
    const urls = await loadAppUrls({
      NEXT_PUBLIC_FULL_URL: "https://legacy-play.example/hub",
    });
    expect(urls.PLAY_URL).toBe("https://legacy-play.example");
    expect(urls.LEARN_URL).toBe("https://learn.chesscito.com");
  });

  it("maps technical modes to their matching product", async () => {
    const urls = await loadAppUrls();
    expect(urls.destinationForMode("learn")).toBe(urls.LEARN_URL);
    expect(urls.destinationForMode("play")).toBe(urls.PLAY_URL);
  });
});
