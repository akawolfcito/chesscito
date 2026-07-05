import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

type Mode = "full" | "learn" | "play";
type Middleware = (
  request: NextRequest,
) => Response | NextResponse | Promise<Response | NextResponse>;

async function loadMiddleware(
  mode: Mode,
  { esReady = true }: { esReady?: boolean } = {},
): Promise<Middleware> {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_I18N_ES_READY", esReady ? "1" : "0");
  vi.doMock("@/lib/feature-flags", () => ({ CHESSCITO_MODE: mode }));
  vi.doMock("next-intl/middleware", () => ({
    default: () => () => NextResponse.next(),
  }));

  const { default: middleware } = await import("../middleware");
  return middleware;
}

function request(path: string, host: string): NextRequest {
  return new NextRequest(new URL(path, `https://${host}`));
}

function locationOf(response: Response | NextResponse): URL {
  const location = response.headers.get("location");
  expect(location).not.toBeNull();
  return new URL(location!);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@/lib/feature-flags");
  vi.doUnmock("next-intl/middleware");
  vi.resetModules();
});

describe("mode-aware middleware", () => {
  it("redirects Learn /arena to Play and preserves query", async () => {
    const middleware = await loadMiddleware("learn");
    const response = await middleware(
      request("/arena?fresh=1", "learn.chesscito.com"),
    );

    expect(response.status).toBe(307);
    expect(locationOf(response).toString()).toBe(
      "https://play.chesscito.com/arena?fresh=1",
    );
  });

  it("redirects localized Learn coach routes to preview Play", async () => {
    const middleware = await loadMiddleware("learn");
    const response = await middleware(
      request(
        "/es/coach/history?source=hub",
        "learn-preview.chesscito.com",
      ),
    );

    expect(locationOf(response).toString()).toBe(
      "https://preview.chesscito.com/es/coach/history?source=hub",
    );
  });

  it("allows Learn /exercises", async () => {
    const middleware = await loadMiddleware("learn");
    const response = await middleware(
      request("/es/exercises", "learn.chesscito.com"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects Play /exercises to Learn", async () => {
    const middleware = await loadMiddleware("play");
    const response = await middleware(
      request("/en/exercises?piece=rook", "play.chesscito.com"),
    );

    expect(locationOf(response).toString()).toBe(
      "https://learn.chesscito.com/en/exercises?piece=rook",
    );
  });

  it("allows Play /arena", async () => {
    const middleware = await loadMiddleware("play");
    const response = await middleware(
      request("/arena", "play.chesscito.com"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it.each(["/arena", "/coach/history", "/exercises"])(
    "keeps Full route %s available",
    async (path) => {
      const middleware = await loadMiddleware("full");
      const response = await middleware(
        request(path, "preview.chesscito.com"),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    },
  );

  it.each(["lite.chesscito.com", "lite-preview.chesscito.com"])(
    "keeps legacy Lite host %s available without product redirects",
    async (host) => {
      const middleware = await loadMiddleware("learn");
      const response = await middleware(request("/arena?legacy=1", host));
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    },
  );

  it("keeps the existing disabled-ES redirect ahead of product routing", async () => {
    const middleware = await loadMiddleware("learn", { esReady: false });
    const response = await middleware(
      request("/es/arena?fresh=1", "learn.chesscito.com"),
    );

    expect(locationOf(response).toString()).toBe(
      "https://learn.chesscito.com/arena?fresh=1",
    );
  });
});
