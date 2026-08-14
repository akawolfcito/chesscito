/**
 * El interruptor del waitlist, operable desde el teléfono.
 *
 * ⛔ Es la ÚNICA superficie que escribe la perilla, y por eso su radio de daño
 * está acotado a propósito: quien tenga el token puede apagar el tope (pagamos
 * Privy) o ponerlo en 1 (nadie nuevo entra). **Ningún dato se expone y las dos
 * cosas se revierten en un tap.** Ese techo es lo que permite que exista sin la
 * ceremonia que necesitaría un panel de operaciones general.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const countBrowserAccountsMock = vi.fn();
const checkRateLimitMock = vi.fn();
const updateMock = vi.fn();
const maybeSingleMock = vi.fn();

vi.mock("@/lib/access/browser-accounts", () => ({
  countBrowserAccounts: () => countBrowserAccountsMock(),
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

const getSupabaseServerMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => getSupabaseServerMock(),
}));

import { GET, POST } from "@/app/api/admin/access-capacity/route";

const TOKEN = "s3cr3t-admin-token";

function supabaseDouble(row = { seat_limit: 460, enabled: true }) {
  maybeSingleMock.mockResolvedValue({ data: row, error: null });
  updateMock.mockReturnValue({
    eq: () => ({ select: () => ({ maybeSingle: maybeSingleMock }) }),
  });
  return {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
      update: updateMock,
    }),
  };
}

function req(method: "GET" | "POST", body?: unknown, token: string | null = TOKEN) {
  return new Request("https://learn.chesscito.com/api/admin/access-capacity", {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-admin-token": token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("ADMIN_TOKEN", TOKEN);
  checkRateLimitMock.mockResolvedValue({ allowed: true, outcome: "allowed", resetAt: null });
  countBrowserAccountsMock.mockResolvedValue(5);
  getSupabaseServerMock.mockReturnValue(supabaseDouble());
});

describe("el candado", () => {
  it("503 cuando no hay ADMIN_TOKEN configurado", async () => {
    vi.stubEnv("ADMIN_TOKEN", "");

    expect((await GET(req("GET"))).status).toBe(503);
  });

  it("403 sin token", async () => {
    expect((await GET(req("GET", undefined, null))).status).toBe(403);
  });

  it("403 con token equivocado", async () => {
    expect((await GET(req("GET", undefined, "otro"))).status).toBe(403);
  });

  it("⛔ un token equivocado NO puede escribir", async () => {
    const res = await POST(req("POST", { enabled: false }, "otro"));

    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("un token equivocado no revela si hay token configurado", async () => {
    // 403 tanto para ausente como para incorrecto: distinguirlos le diría a
    // quien prueba que el largo o la forma del suyo iba por buen camino.
    const missing = await GET(req("GET", undefined, null));
    const wrong = await GET(req("GET", undefined, "otro"));

    expect(await missing.json()).toEqual(await wrong.json());
  });
});

describe("leer el estado", () => {
  it("devuelve la perilla, el pozo y el headroom", async () => {
    countBrowserAccountsMock.mockResolvedValue(37);

    const res = await GET(req("GET"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      enabled: true,
      limit: 460,
      browserAccounts: 37,
      headroom: 423,
      open: true,
    });
  });

  it("⛔ acá el conteo SÍ viaja, y es la diferencia con la ruta pública", async () => {
    // `/api/access/capacity` contesta `{open}` y nada más porque la lee un
    // visitante. Ésta la lee el founder detrás de un token, y el número es todo
    // el punto: sin él, el botón no avisa nada hasta que ya cerró.
    const body = await (await GET(req("GET"))).json();

    expect(body).toHaveProperty("browserAccounts");
    expect(body).toHaveProperty("headroom");
  });

  it("no inventa un headroom cuando el conteo falla", async () => {
    countBrowserAccountsMock.mockResolvedValue(null);

    const body = await (await GET(req("GET"))).json();

    expect(body.browserAccounts).toBeNull();
    expect(body.headroom).toBeNull();
  });
});

describe("mover la perilla", () => {
  it("apaga el tope", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { seat_limit: 460, enabled: false },
      error: null,
    });

    const res = await POST(req("POST", { enabled: false }));

    expect(res.status).toBe(200);
    const [patch] = updateMock.mock.calls[0];
    expect(patch.enabled).toBe(false);
  });

  it("cambia el número", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { seat_limit: 400, enabled: true },
      error: null,
    });

    await POST(req("POST", { limit: 400 }));

    const [patch] = updateMock.mock.calls[0];
    expect(patch.seat_limit).toBe(400);
  });

  it("sella quién y cuándo", async () => {
    await POST(req("POST", { enabled: false }));

    const [patch] = updateMock.mock.calls[0];
    expect(patch.updated_by).toBe("admin-panel");
    expect(typeof patch.updated_at).toBe("string");
  });

  it("devuelve el estado YA aplicado, no el pedido", async () => {
    // El botón tiene que mostrar lo que quedó en la base. Si dibujara lo que
    // mandó, un write rechazado se vería como un write exitoso.
    maybeSingleMock.mockResolvedValue({
      data: { seat_limit: 400, enabled: false },
      error: null,
    });

    const body = await (await POST(req("POST", { limit: 400, enabled: false }))).json();

    expect(body.limit).toBe(400);
    expect(body.enabled).toBe(false);
  });

  const rejected: Array<[string, unknown]> = [
    ["cero", { limit: 0 }],
    ["negativo", { limit: -5 }],
    ["no entero", { limit: 12.5 }],
    ["texto", { limit: "muchos" }],
    ["absurdo", { limit: 1_000_000 }],
    ["cuerpo vacío", {}],
  ];

  for (const [name, body] of rejected) {
    it(`rechaza ${name} sin tocar la fila`, async () => {
      const res = await POST(req("POST", body));

      expect(res.status).toBe(400);
      expect(updateMock).not.toHaveBeenCalled();
    });
  }

  it("acepta un número por encima del plan, pero lo dice", async () => {
    // ⛔ El techo de 499 es un hecho de Privy que puede cambiar con su pricing.
    // Bloquearlo acá haría que el día que lo suban el botón mienta. Se avisa.
    maybeSingleMock.mockResolvedValue({
      data: { seat_limit: 600, enabled: true },
      error: null,
    });

    const res = await POST(req("POST", { limit: 600 }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ overPlanCeiling: true });
  });
});

describe("el limitador", () => {
  it("⚠️ falla ABIERTO, porque esto es el botón de emergencia", async () => {
    // Un limitador caído no puede dejar al founder sin su interruptor: sería
    // fallar justo en el escenario para el que existe. Quien protege acá es el
    // token, que es de alta entropía; el limitador sólo baja el ruido.
    await GET(req("GET"));

    expect(checkRateLimitMock).toHaveBeenCalledWith({
      identifier: "203.0.113.7",
      route: "admin-access-capacity",
      policy: "fail-open",
    });
  });

  it("429 cuando se excede de verdad", async () => {
    checkRateLimitMock.mockResolvedValue({ allowed: false, outcome: "limited", resetAt: 0 });

    expect((await GET(req("GET"))).status).toBe(429);
  });
});
