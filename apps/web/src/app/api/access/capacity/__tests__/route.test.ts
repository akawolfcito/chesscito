/**
 * GET /api/access/capacity — the login budget, read server-side.
 *
 * Two properties hold across every case below:
 *
 *   1. ⛔ The response says `open` and NOTHING else. Telling a visitor "3 seats
 *      left" is a race and an invitation to force it.
 *   2. ⚠️ Doubt opens the door. A missing database, a broken query, a limiter
 *      outage — none of them may lock everybody out of the product, because
 *      Privy's own allowlist is still underneath as the real gate. The only
 *      thing that closes is a count that genuinely reached the limit, or a
 *      configuration we cannot read (which is OUR bug, and visible).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const countBrowserAccountsMock = vi.fn();
const checkRateLimitMock = vi.fn();

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

import { GET } from "@/app/api/access/capacity/route";

function get() {
  return GET(new Request("https://learn.chesscito.com/api/access/capacity"));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  checkRateLimitMock.mockResolvedValue({ allowed: true, outcome: "allowed", resetAt: null });
  countBrowserAccountsMock.mockResolvedValue(5);
});

describe("the verdict", () => {
  it("is open while the count is below the limit", async () => {
    vi.stubEnv("LOGIN_CAPACITY_LIMIT", "460");
    countBrowserAccountsMock.mockResolvedValue(459);

    const res = await get();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ open: true });
  });

  it("is closed once the count reaches the limit", async () => {
    vi.stubEnv("LOGIN_CAPACITY_LIMIT", "460");
    countBrowserAccountsMock.mockResolvedValue(460);

    const res = await get();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ open: false });
  });

  it("never leaks the count or the limit", async () => {
    vi.stubEnv("LOGIN_CAPACITY_LIMIT", "460");
    countBrowserAccountsMock.mockResolvedValue(458);

    const body = await (await get()).json();

    expect(Object.keys(body)).toEqual(["open"]);
  });

  it("is never cached — the knob must take effect on the next call", async () => {
    const res = await get();

    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});

describe("the switch", () => {
  it("reopens completely when the cap is disabled", async () => {
    vi.stubEnv("LOGIN_CAPACITY_ENABLED", "false");
    vi.stubEnv("LOGIN_CAPACITY_LIMIT", "1");
    countBrowserAccountsMock.mockResolvedValue(9_999);

    await expect((await get()).json()).resolves.toEqual({ open: true });
  });

  it("does not even count when the cap is disabled", async () => {
    vi.stubEnv("LOGIN_CAPACITY_ENABLED", "false");

    await get();

    expect(countBrowserAccountsMock).not.toHaveBeenCalled();
  });

  it("is ON without any configuration", async () => {
    // ⛔ A cap you must remember to switch on is not a cap. The default limit
    // is safe (460), so the safe default for `enabled` is true — the spike this
    // exists to survive is precisely the one nobody is watching for.
    countBrowserAccountsMock.mockResolvedValue(10_000);

    await expect((await get()).json()).resolves.toEqual({ open: false });
  });
});

describe("when in doubt", () => {
  it("opens if the count could not be taken", async () => {
    countBrowserAccountsMock.mockResolvedValue(null);

    await expect((await get()).json()).resolves.toEqual({ open: true });
  });

  it("repairs an unusable limit instead of closing on it", async () => {
    // ⚠️ `decideLoginCapacity` CIERRA ante una config rota, y por esta ruta esa
    // rama es inalcanzable: `resolveCapacityLimit` repara `0` / `-5` / `muchos`
    // al default antes de que llegue. Y así debe ser — el default ya es seguro
    // (460 < 499), así que reparar cuida la plata Y deja la puerta abierta,
    // mientras que cerrar el producto entero por un typo en un env var es el
    // fail-closed que el spec rechaza para el caso de la base caída.
    // La rama fail-closed sigue viva para cualquier otro origen de config
    // (p. ej. una fila con NaN) — se prueba en `login-capacity.test.ts`.
    for (const broken of ["0", "-5", "muchos"]) {
      vi.stubEnv("LOGIN_CAPACITY_LIMIT", broken);

      countBrowserAccountsMock.mockResolvedValue(459);
      await expect((await get()).json()).resolves.toEqual({ open: true });

      countBrowserAccountsMock.mockResolvedValue(460);
      await expect((await get()).json()).resolves.toEqual({ open: false });
    }
  });
});

describe("rate limiting", () => {
  it("guards the route per IP, failing open", async () => {
    await get();

    expect(checkRateLimitMock).toHaveBeenCalledWith({
      identifier: "203.0.113.7",
      route: "access-capacity",
      policy: "fail-open",
    });
  });

  it("answers 429 without counting when the limiter refuses", async () => {
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
