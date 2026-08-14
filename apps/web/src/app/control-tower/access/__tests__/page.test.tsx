/**
 * El botón, desde el teléfono.
 *
 * Lo que estos casos fijan no es el look: es que el token no se filtre por la
 * URL, que la pantalla dibuje lo que la BASE devolvió (nunca lo que se pidió), y
 * que un token equivocado tenga salida sin borrar el storage a mano.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

import AdminAccessPage from "@/app/control-tower/access/page";

const TOKEN = "s3cr3t-admin-token";
const STORAGE_KEY = "chesscito.ct";

function stateResponse(over: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      enabled: true,
      limit: 460,
      browserAccounts: 5,
      headroom: 455,
      open: true,
      ...over,
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(stateResponse());
});

describe("sin token guardado", () => {
  it("lo pide y no llama a la API", async () => {
    render(<AdminAccessPage />);

    expect(await screen.findByLabelText(/admin token/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("una vez pegado, lo recuerda y consulta", async () => {
    render(<AdminAccessPage />);

    await userEvent.type(await screen.findByLabelText(/admin token/i), TOKEN);
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(TOKEN);
  });
});

describe("con token guardado", () => {
  beforeEach(() => window.localStorage.setItem(STORAGE_KEY, TOKEN));

  it("⛔ manda el token por HEADER, nunca por la URL", async () => {
    // Un token en el query string queda en el historial del navegador, en los
    // logs del CDN y en cualquier Referer que la página emita.
    render(<AdminAccessPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain(TOKEN);
    expect((init as RequestInit).headers).toMatchObject({ "x-admin-token": TOKEN });
  });

  it("muestra el pozo, el tope y el headroom", async () => {
    render(<AdminAccessPage />);

    expect(await screen.findByText("5 / 460")).toBeInTheDocument();
    expect(screen.getByText(/455/)).toBeInTheDocument();
  });

  it("dice ABIERTO o CERRADO en palabras, no sólo con un color", async () => {
    fetchMock.mockResolvedValue(stateResponse({ enabled: false, open: true }));
    render(<AdminAccessPage />);

    expect(await screen.findByText(/sin tope/i)).toBeInTheDocument();
  });

  it("no dibuja un headroom inventado cuando el conteo falló", async () => {
    fetchMock.mockResolvedValue(
      stateResponse({ browserAccounts: null, headroom: null }),
    );
    render(<AdminAccessPage />);

    expect(await screen.findByText(/no se pudo contar/i)).toBeInTheDocument();
  });
});

describe("mover la perilla", () => {
  beforeEach(() => window.localStorage.setItem(STORAGE_KEY, TOKEN));

  it("apaga el tope con un tap", async () => {
    render(<AdminAccessPage />);
    await screen.findByText("5 / 460");

    fetchMock.mockResolvedValue(stateResponse({ enabled: false }));
    await userEvent.click(screen.getByRole("button", { name: /quitar el tope/i }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "POST");
      expect(post).toBeDefined();
      expect(JSON.parse(String((post![1] as RequestInit).body))).toEqual({ enabled: false });
    });
  });

  it("⛔ repinta con lo que devolvió la BASE, no con lo que se pidió", async () => {
    // Si dibujara lo pedido, un write rechazado se vería como uno exitoso.
    render(<AdminAccessPage />);
    await screen.findByText("5 / 460");

    fetchMock.mockResolvedValue(stateResponse({ limit: 400, headroom: 395 }));
    await userEvent.click(screen.getByRole("button", { name: /quitar el tope/i }));

    expect(await screen.findByText("5 / 400")).toBeInTheDocument();
  });

  it("avisa cuando el número queda por encima del plan", async () => {
    render(<AdminAccessPage />);
    await screen.findByText("5 / 460");

    fetchMock.mockResolvedValue(stateResponse({ limit: 600, overPlanCeiling: true }));
    await userEvent.click(screen.getByRole("button", { name: /quitar el tope/i }));

    expect(await screen.findByText(/por encima del plan/i)).toBeInTheDocument();
  });
});

describe("cuando el token no sirve", () => {
  beforeEach(() => window.localStorage.setItem(STORAGE_KEY, "viejo"));

  it("lo dice y ofrece salir sin tener que borrar el storage a mano", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "forbidden" }),
    });
    render(<AdminAccessPage />);

    await userEvent.click(await screen.findByRole("button", { name: /olvidar/i }));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(await screen.findByLabelText(/admin token/i)).toBeInTheDocument();
  });
});
