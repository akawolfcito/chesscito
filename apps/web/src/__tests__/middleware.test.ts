import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

type Middleware = (
  request: NextRequest,
) => Response | NextResponse | Promise<Response | NextResponse>;

async function loadLiteMiddleware({
  esReady = true,
}: {
  esReady?: boolean;
} = {}): Promise<Middleware> {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_I18N_ES_READY", esReady ? "1" : "0");
  vi.doMock("@/lib/feature-flags", () => ({
    CHESSCITO_LITE_MODE: true,
  }));
  vi.doMock("next-intl/middleware", () => ({
    default: () => () => NextResponse.next(),
  }));

  const { default: middleware } = await import("../middleware");
  return middleware;
}

function request(path: string): NextRequest {
  return new NextRequest(new URL(path, "https://lite.chesscito.com"));
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

describe("Lite middleware Full-only fallback", () => {
  it("temporarily redirects /arena to root and preserves its query", async () => {
    const middleware = await loadLiteMiddleware();
    const response = await middleware(request("/arena?foo=bar"));

    expect(response.status).toBe(307);
    const location = locationOf(response);
    expect(`${location.pathname}${location.search}`).toBe("/?foo=bar");
  });

  it("temporarily redirects localized /es/arena to /es", async () => {
    const middleware = await loadLiteMiddleware({ esReady: true });
    const response = await middleware(request("/es/arena"));

    expect(response.status).toBe(307);
    expect(locationOf(response).pathname).toBe("/es");
  });

  it("redirects another Full-only route to root", async () => {
    const middleware = await loadLiteMiddleware();
    const response = await middleware(request("/coach/history?source=hub"));

    expect(response.status).toBe(307);
    const location = locationOf(response);
    expect(`${location.pathname}${location.search}`).toBe("/?source=hub");
  });

  it("does not redirect the fallback root again", async () => {
    const middleware = await loadLiteMiddleware();
    const response = await middleware(request("/?foo=bar"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
