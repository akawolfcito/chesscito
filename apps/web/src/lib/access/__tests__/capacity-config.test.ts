/**
 * La perilla, leída de la fila.
 *
 * Existe como fila y no como env var por una razón medida: en Vercel una env
 * var exige redeploy, y un redeploy de este repo tarda 8–10 minutos. Durante un
 * pico eso llega tarde por construcción.
 *
 * ⚠️ La propiedad que atraviesa todos los casos: **una fila ilegible nunca deja
 * el sistema sin config**. Cae al env var, y de ahí al default seguro. Un lector
 * de config que puede devolver "no sé" obliga a cada llamador a inventar qué
 * hacer con eso, y ahí es donde nacen los fail-closed accidentales.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseServerMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => getSupabaseServerMock(),
}));

import { readCapacityConfig } from "@/lib/access/capacity-config";
import { DEFAULT_CAPACITY_LIMIT } from "@/lib/access/login-capacity";

type Row = { seat_limit: unknown; enabled: unknown } | null;

/** Un doble cuyo `.select().eq().maybeSingle()` resuelve a `{ data, error }`. */
function supabaseWithRow(data: Row, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from }, from, select, eq, maybeSingle };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("con la fila disponible", () => {
  it("manda la fila", async () => {
    getSupabaseServerMock.mockReturnValue(
      supabaseWithRow({ seat_limit: 250, enabled: true }).client,
    );

    await expect(readCapacityConfig()).resolves.toEqual({
      limit: 250,
      enabled: true,
    });
  });

  it("⛔ la fila le GANA al env var", async () => {
    // Si no ganara, mover la perilla en vivo no serviría de nada en cualquier
    // entorno donde el env var esté seteado — que es justo producción.
    vi.stubEnv("LOGIN_CAPACITY_LIMIT", "999");
    vi.stubEnv("LOGIN_CAPACITY_ENABLED", "false");
    getSupabaseServerMock.mockReturnValue(
      supabaseWithRow({ seat_limit: 250, enabled: true }).client,
    );

    await expect(readCapacityConfig()).resolves.toEqual({
      limit: 250,
      enabled: true,
    });
  });

  it("lee el singleton, no una fila cualquiera", async () => {
    const double = supabaseWithRow({ seat_limit: 250, enabled: true });
    getSupabaseServerMock.mockReturnValue(double.client);

    await readCapacityConfig();

    expect(double.from).toHaveBeenCalledWith("login_capacity_config");
    expect(double.eq).toHaveBeenCalledWith("id", true);
  });

  it("apaga el tope cuando la fila lo dice", async () => {
    getSupabaseServerMock.mockReturnValue(
      supabaseWithRow({ seat_limit: 460, enabled: false }).client,
    );

    await expect(readCapacityConfig()).resolves.toEqual({
      limit: 460,
      enabled: false,
    });
  });

  it("repara un seat_limit inservible sin perder el resto de la fila", async () => {
    getSupabaseServerMock.mockReturnValue(
      supabaseWithRow({ seat_limit: 0, enabled: false }).client,
    );

    await expect(readCapacityConfig()).resolves.toEqual({
      limit: DEFAULT_CAPACITY_LIMIT,
      enabled: false,
    });
  });
});

describe("cuando la fila no se puede leer", () => {
  const unreadable: Array<[string, () => void]> = [
    ["no hay base configurada", () => getSupabaseServerMock.mockReturnValue(null)],
    [
      "la fila no existe todavía",
      () => getSupabaseServerMock.mockReturnValue(supabaseWithRow(null).client),
    ],
    [
      "la query falla",
      () =>
        getSupabaseServerMock.mockReturnValue(
          supabaseWithRow(null, { message: "boom" }).client,
        ),
    ],
    [
      "la query rompe",
      () =>
        getSupabaseServerMock.mockReturnValue({
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.reject(new Error("network")),
              }),
            }),
          }),
        }),
    ],
  ];

  for (const [name, arrange] of unreadable) {
    it(`cae al env var — ${name}`, async () => {
      vi.stubEnv("LOGIN_CAPACITY_LIMIT", "300");
      vi.stubEnv("LOGIN_CAPACITY_ENABLED", "false");
      arrange();

      await expect(readCapacityConfig()).resolves.toEqual({
        limit: 300,
        enabled: false,
      });
    });

    it(`y de ahí al default seguro — ${name}`, async () => {
      arrange();

      await expect(readCapacityConfig()).resolves.toEqual({
        limit: DEFAULT_CAPACITY_LIMIT,
        enabled: true,
      });
    });
  }
});
