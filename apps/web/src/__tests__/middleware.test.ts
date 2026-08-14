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

/**
 * ⛔ ESTE BLOQUE EXISTE POR UN INCIDENTE EN PRODUCCIÓN (2026-08-14).
 *
 * `/control-tower/access` —el interruptor del waitlist— **redirigía a `/`** en cuanto se
 * deployó. La página estaba bien y su ruta también: lo que faltaba era una palabra en el
 * matcher del middleware. Todo path que no esté excluido pasa por el routing de locale, que
 * trata al primer segmento como un locale y manda a la raíz.
 *
 * ⚠️ **Y nada más lo delata.** No hay error, ni log, ni test que falle: la superficie
 * simplemente no existe desde afuera, con la app entera en verde. Es la misma clase de bug que
 * el export de más en un `route.ts` — el código está bien y la plataforma lo descarta.
 *
 * Por eso el test corre contra el matcher REAL de `config`, no contra una copia: una lista
 * duplicada acá pasaría en verde con el middleware equivocado.
 */
describe("matcher del middleware", () => {
  async function matcherRegex(): Promise<RegExp> {
    vi.resetModules();
    // Mismo doble que `loadMiddleware`: el módulo real de next-intl no resuelve
    // `next/server` bajo Vitest, y acá sólo interesa el `config` exportado.
    vi.doMock("next-intl/middleware", () => ({
      default: () => () => NextResponse.next(),
    }));
    const { config } = await import("../middleware");
    const [pattern] = (config as { matcher: string[] }).matcher;
    return new RegExp(`^${pattern}$`);
  }

  const excluded = [
    ["API", "/api/access/capacity"],
    ["fixtures de dev", "/dev/labyrinth-builder"],
    ["QA de Lite", "/lite-debug/reset"],
    ["el interruptor", "/control-tower/access"],
    ["internals de Next", "/_next/static/chunk.js"],
    ["assets con extensión", "/art/board.png"],
  ] as const;

  for (const [name, path] of excluded) {
    it(`deja pasar ${name} sin routing de locale (${path})`, async () => {
      expect((await matcherRegex()).test(path)).toBe(false);
    });
  }

  const routed = [
    ["la raíz", "/"],
    ["el hub", "/hub"],
    ["ejercicios", "/en/exercises"],
  ] as const;

  for (const [name, path] of routed) {
    it(`sí rutea ${name} (${path})`, async () => {
      // La otra mitad: un matcher que excluyera de más dejaría al producto sin i18n.
      expect((await matcherRegex()).test(path)).toBe(true);
    });
  }
});
