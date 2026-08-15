/**
 * El enlace del duelo tiene que sobrevivir al login.
 *
 * Era el único P0 vivo del red-team del duelo p2p
 * (docs/specs/2026-08-13-p2p-chess-duel-by-link-redteam.md): el invitado abre
 * `/arena?duel=<id>`, el gate lo manda a Privy, y al volver tiene que aterrizar
 * en ESE duelo. Si el parámetro se pierde, cae en el hub sin saber a qué lo
 * invitaron y el duelo queda `awaiting-opponent` para siempre.
 *
 * ✅ MEDIDO EN VIVO el 2026-08-15, en un teléfono, con Google, que es el camino
 * riesgoso (redirect de página completa, no popup). Privy volvió a
 * `…/arena?duel=test123&privy_oauth_state=…&privy_oauth_provider=google&privy_oauth_code=…`
 * — conserva la query original y anexa la suya. Por eso NO se construyó ningún
 * mecanismo de estacionamiento: no hacía falta.
 *
 * ⛔ Lo que este test cuida es la otra mitad, que es la que sí podemos romper
 * NOSOTROS: que al autenticarse el gate cambie de pantalla **en la misma URL**.
 * Un `router.push("/hub")` agregado después del login rompería el enlace del
 * duelo sin poner roja ninguna otra prueba, porque desde el punto de vista del
 * gate "el usuario entró" seguiría siendo cierto.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let readyMock = true;
let authenticatedMock = false;
let addressMock: string | undefined = undefined;

const pushMock = vi.fn();
const replaceMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({ ready: readyMock, authenticated: authenticatedMock }),
  useLogin: () => ({ login: vi.fn() }),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: addressMock }),
}));

// El gate hoy no importa `next/navigation`. El mock existe para que el día que
// alguien lo importe y navegue, este test lo vea.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    refresh: refreshMock,
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(window.location.search),
  usePathname: () => window.location.pathname,
}));

import { WebAccessGate } from "@/components/web-access-gate";

const DUEL_URL = "/arena?duel=test123";

describe("el gate no se lleva puesto el enlace del duelo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readyMock = true;
    authenticatedMock = false;
    addressMock = undefined;
    window.history.replaceState({}, "", DUEL_URL);
  });

  it("entrega el producto en la MISMA url con la que llegó el invitado", async () => {
    // El invitado ya volvió de Privy con su wallet lista.
    authenticatedMock = true;
    addressMock = "0x1111111111111111111111111111111111111111";

    render(
      <WebAccessGate>
        <div data-testid="product">ARENA</div>
      </WebAccessGate>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("product")).toBeInTheDocument();
    });

    // ⛔ La aserción del feature: el duelo sigue en la URL.
    expect(window.location.search).toContain("duel=test123");
    expect(new URLSearchParams(window.location.search).get("duel")).toBe("test123");
  });

  it("no navega a ningún lado cuando el invitado termina de autenticarse", async () => {
    const { rerender } = render(
      <WebAccessGate>
        <div data-testid="product">ARENA</div>
      </WebAccessGate>,
    );

    // Sin sesión ve el gate, no el producto — y sigue en su URL.
    expect(screen.queryByTestId("product")).toBeNull();
    expect(window.location.search).toContain("duel=test123");

    // Vuelve de Privy: autenticado y con wallet.
    authenticatedMock = true;
    addressMock = "0x1111111111111111111111111111111111111111";
    rerender(
      <WebAccessGate>
        <div data-testid="product">ARENA</div>
      </WebAccessGate>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("product")).toBeInTheDocument();
    });

    // Ni router, ni history: el gate cambia de PANTALLA, no de dirección.
    expect(pushMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/arena");
    expect(new URLSearchParams(window.location.search).get("duel")).toBe("test123");
  });

  it("tampoco toca la url mientras la wallet todavía no está lista", () => {
    authenticatedMock = true;
    addressMock = undefined; // interstitial `wallet-pending`

    render(
      <WebAccessGate>
        <div data-testid="product">ARENA</div>
      </WebAccessGate>,
    );

    expect(screen.queryByTestId("product")).toBeNull();
    expect(pushMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
    expect(new URLSearchParams(window.location.search).get("duel")).toBe("test123");
  });
});
