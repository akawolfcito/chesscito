import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const createClientMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

import { getSupabaseServer } from "../server";

/**
 * ⛔ EL BUG QUE ESTE ARCHIVO CIERRA, y que sólo existe en un build real.
 *
 * En el App Router, Next parchea `fetch` y CACHEA los GET por defecto, y
 * `supabase-js` habla con PostgREST por `fetch`. Un `select` queda cacheado
 * como cualquier GET, ENTRE REQUESTS Y ENTRE USUARIOS, y la ruta sigue
 * contestando un snapshot mucho después de que la fila cambió.
 *
 * ⚠️ `export const dynamic = "force-dynamic"` NO lo evita: fuerza el RENDER
 * dinámico, no los datos frescos. Y `next dev` no aplica el cache, que es por
 * qué esto es invisible en local.
 *
 * Medido en preview el 2026-08-16: la fila del duelo decía `active / version 2`
 * mientras `GET /api/duel/[id]` contestaba `awaiting-opponent / version 1`, con
 * `x-vercel-cache: MISS` — o sea que la ruta corría y lo viejo venía de abajo.
 */

const SRC = join(process.cwd(), "src");

beforeEach(() => {
  createClientMock.mockReset().mockReturnValue({});
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
});

afterEach(() => vi.unstubAllEnvs());

describe("getSupabaseServer", () => {
  it("no cambia el comportamiento de quien no lo pide", () => {
    getSupabaseServer();

    const options = createClientMock.mock.calls[0][2] as { global?: unknown };
    expect(options.global).toBeUndefined();
  });

  /** ⛔ Con `freshReads`, TODA lectura sale con `cache: "no-store"`. */
  it("fuerza no-store en el fetch cuando se le pide frescura", async () => {
    getSupabaseServer({ freshReads: true });

    const options = createClientMock.mock.calls[0][2] as {
      global?: { fetch?: (input: unknown, init?: RequestInit) => unknown };
    };
    expect(typeof options.global?.fetch).toBe("function");

    const spy = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", spy);
    await options.global!.fetch!("https://example.supabase.co/rest/v1/duels", {
      method: "GET",
    });

    expect(spy.mock.calls[0][1]).toMatchObject({ method: "GET", cache: "no-store" });
    vi.unstubAllGlobals();
  });

  it("sigue devolviendo null sin credenciales", () => {
    vi.stubEnv("SUPABASE_URL", "");
    expect(getSupabaseServer({ freshReads: true })).toBeNull();
  });
});

describe("las cinco rutas del duelo piden lecturas frescas", () => {
  /**
   * ⛔ Sin esto, el duelo vuelve al bug exacto: el JOIN persiste y la ruta
   * sigue contestando el estado anterior, así que el invitado ve otra vez
   * "JOIN THE GAME" y nadie puede mover.
   */
  it("todas construyen el cliente con freshReads", () => {
    for (const route of [
      "app/api/duel/route.ts",
      "app/api/duel/[id]/route.ts",
      "app/api/duel/[id]/join/route.ts",
      "app/api/duel/[id]/move/route.ts",
      "app/api/duel/[id]/resign/route.ts",
    ]) {
      const source = readFileSync(join(SRC, route), "utf8");
      expect(source).toContain("getSupabaseServer({ freshReads: true })");
      expect(source).not.toMatch(/getSupabaseServer\(\)/);
    }
  });
});
