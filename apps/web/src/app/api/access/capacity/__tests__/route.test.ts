/**
 * GET /api/access/capacity — el presupuesto de logins, leído server-side.
 *
 * Tres propiedades atraviesan todos los casos:
 *
 *   1. ⛔ La respuesta dice `open` y NADA MÁS. Decirle a un visitante "quedan 3
 *      lugares" es una carrera y una invitación a forzarla.
 *   2. ⚠️ Ante la duda se abre. Base ausente, query rota, limitador caído: nada
 *      de eso puede dejar a todo el mundo afuera del producto, porque el
 *      allowlist de Privy sigue debajo como el candado real.
 *   3. ⛔ El caché va ANTES del limitador. Un veredicto fresco no hace trabajo
 *      de base, así que cobrarle cuota convertía al limitador en el interruptor
 *      de apagado del tope justo durante un pico.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const countBrowserAccountsMock = vi.fn();
const readCapacityConfigMock = vi.fn();
const checkRateLimitMock = vi.fn();

vi.mock("@/lib/access/browser-accounts", () => ({
  countBrowserAccounts: () => countBrowserAccountsMock(),
}));

vi.mock("@/lib/access/capacity-config", () => ({
  readCapacityConfig: () => readCapacityConfigMock(),
}));

vi.mock("@/lib/server/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
}));

vi.mock("@/lib/server/demo-signing", () => ({
  getRequestIp: () => "203.0.113.7",
}));

vi.mock("@/lib/server/logger", () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import { GET, __resetCapacityCache } from "@/app/api/access/capacity/route";

function get() {
  return GET(new Request("https://learn.chesscito.com/api/access/capacity"));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  __resetCapacityCache();
  checkRateLimitMock.mockResolvedValue({ allowed: true, outcome: "allowed", resetAt: null });
  readCapacityConfigMock.mockResolvedValue({ limit: 460, enabled: true });
  countBrowserAccountsMock.mockResolvedValue(5);
});

describe("el veredicto", () => {
  it("abre mientras el conteo esté debajo del tope", async () => {
    countBrowserAccountsMock.mockResolvedValue(459);

    const res = await get();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ open: true });
  });

  it("cierra cuando el conteo alcanza el tope", async () => {
    countBrowserAccountsMock.mockResolvedValue(460);

    const res = await get();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ open: false });
  });

  it("nunca filtra el conteo ni el tope", async () => {
    countBrowserAccountsMock.mockResolvedValue(458);

    const body = await (await get()).json();

    expect(Object.keys(body)).toEqual(["open"]);
  });
});

describe("la perilla", () => {
  it("sale de la FILA, no de un env var", async () => {
    // Es toda la razón de ser de la tabla: en Vercel un env var exige redeploy y
    // un redeploy tarda 8-10 minutos, que durante un pico llega tarde.
    readCapacityConfigMock.mockResolvedValue({ limit: 10, enabled: true });
    countBrowserAccountsMock.mockResolvedValue(10);

    await expect((await get()).json()).resolves.toEqual({ open: false });
    expect(readCapacityConfigMock).toHaveBeenCalled();
  });

  it("reabre por completo cuando el tope está apagado", async () => {
    readCapacityConfigMock.mockResolvedValue({ limit: 1, enabled: false });
    countBrowserAccountsMock.mockResolvedValue(9_999);

    await expect((await get()).json()).resolves.toEqual({ open: true });
  });

  it("no cuenta siquiera cuando el tope está apagado", async () => {
    readCapacityConfigMock.mockResolvedValue({ limit: 460, enabled: false });

    await get();

    expect(countBrowserAccountsMock).not.toHaveBeenCalled();
  });
});

describe("ante la duda", () => {
  it("abre si el conteo no se pudo tomar", async () => {
    countBrowserAccountsMock.mockResolvedValue(null);

    await expect((await get()).json()).resolves.toEqual({ open: true });
  });

  it("cierra si el tope que llega es inservible", async () => {
    // La dirección opuesta a propósito: una config rota es error nuestro, se ve
    // enseguida, y errar hacia abierto acá es una factura recurrente.
    // ⚠️ `readCapacityConfig` repara lo que puede antes de llegar acá; esta rama
    // cubre lo que ni siquiera él pueda arreglar.
    readCapacityConfigMock.mockResolvedValue({ limit: Number.NaN, enabled: true });

    await expect((await get()).json()).resolves.toEqual({ open: false });
  });
});

describe("el caché", () => {
  it("contesta el segundo pedido sin volver a la base", async () => {
    await get();
    await get();

    expect(countBrowserAccountsMock).toHaveBeenCalledTimes(1);
    expect(readCapacityConfigMock).toHaveBeenCalledTimes(1);
  });

  it("⛔ contesta con el caché SIN pasar por el limitador", async () => {
    // El agujero que esto cierra: 60 req/min por IP, y detrás de CGNAT mucha
    // gente comparte una IP de salida. Si el limitador corriera primero, el
    // visitante 61 recibía 429 y el cliente falla abierto — el tope se apagaba
    // solo justo en el pico para el que existe.
    countBrowserAccountsMock.mockResolvedValue(460);
    await get();

    checkRateLimitMock.mockResolvedValue({ allowed: false, outcome: "limited", resetAt: 0 });
    const res = await get();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ open: false });
    expect(checkRateLimitMock).toHaveBeenCalledTimes(1);
  });

  it("vuelve a preguntar cuando el veredicto vence", async () => {
    vi.useFakeTimers();
    await get();

    vi.advanceTimersByTime(10_001);
    await get();

    expect(countBrowserAccountsMock).toHaveBeenCalledTimes(2);
  });

  it("deja que el CDN absorba el pico, con el mismo techo", async () => {
    const cacheControl = (await get()).headers.get("cache-control");

    expect(cacheControl).toContain("public");
    expect(cacheControl).toContain("s-maxage=10");
  });
});

describe("rate limiting", () => {
  it("guarda la ruta por IP, fallando abierto", async () => {
    await get();

    expect(checkRateLimitMock).toHaveBeenCalledWith({
      identifier: "203.0.113.7",
      route: "access-capacity",
      policy: "fail-open",
    });
  });

  it("contesta 429 sin contar cuando el limitador se niega", async () => {
    checkRateLimitMock.mockResolvedValue({
      allowed: false,
      outcome: "limited",
      resetAt: Date.now(),
    });

    const res = await get();

    expect(res.status).toBe(429);
    expect(countBrowserAccountsMock).not.toHaveBeenCalled();
  });
});
