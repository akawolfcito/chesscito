import { describe, expect, it } from "vitest";
import { modeRedirectUrl } from "@/lib/mode-routing";

const LOCALES = ["en", "es"] as const;

function redirect(mode: "full" | "learn" | "play", value: string) {
  return modeRedirectUrl(mode, new URL(value), LOCALES)?.toString() ?? null;
}

describe("modeRedirectUrl", () => {
  it.each([
    [
      "https://learn.chesscito.com/arena?fresh=1#setup",
      "https://play.chesscito.com/arena?fresh=1#setup",
    ],
    [
      "https://learn.chesscito.com/es/coach/history?source=hub#game",
      "https://play.chesscito.com/es/coach/history?source=hub#game",
    ],
    [
      "https://learn-preview.chesscito.com/en/arena",
      "https://preview.chesscito.com/en/arena",
    ],
  ])("redirects Learn route %s to Play", (source, expected) => {
    expect(redirect("learn", source)).toBe(expected);
  });

  it.each([
    [
      "https://play.chesscito.com/exercises?piece=rook#board",
      "https://learn.chesscito.com/exercises?piece=rook#board",
    ],
    [
      "https://preview.chesscito.com/es/exercises/rook?level=2",
      "https://learn-preview.chesscito.com/es/exercises/rook?level=2",
    ],
  ])("redirects Play route %s to Learn", (source, expected) => {
    expect(redirect("play", source)).toBe(expected);
  });

  it.each([
    "https://learn.chesscito.com/exercises",
    "https://learn.chesscito.com/es/exercises/rook",
    "https://play.chesscito.com/arena",
    "https://play.chesscito.com/coach/history",
    "https://play.chesscito.com/hub",
  ])("allows a route owned by the active product: %s", (url) => {
    const mode = new URL(url).hostname.startsWith("learn") ? "learn" : "play";
    expect(redirect(mode, url)).toBeNull();
  });

  it.each([
    "https://lite.chesscito.com/arena?legacy=1",
    "https://lite-preview.chesscito.com/es/coach/history",
  ])("does not redirect a legacy Lite host: %s", (url) => {
    expect(redirect("learn", url)).toBeNull();
  });

  it.each(["/arena", "/coach/history", "/exercises"])(
    "does not restrict Full route %s",
    (path) => {
      expect(redirect("full", `https://preview.chesscito.com${path}`)).toBeNull();
    },
  );

  it("avoids a loop when a deployment is configured with the wrong mode", () => {
    expect(redirect("learn", "https://play.chesscito.com/arena")).toBeNull();
  });
});
