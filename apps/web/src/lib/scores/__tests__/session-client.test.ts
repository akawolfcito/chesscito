/**
 * Score write session — caché persistida e invalidación (Slice 0.1b).
 *
 * El smoke en device (2026-07-27) mostró que un token solo-en-memoria costaba
 * una firma por cada apertura de MiniPay que produjera un save. Ahora se
 * persiste en localStorage bajo una clave versionada, con el MISMO alcance de
 * siempre (una wallet, una superficie, 2h, revocable).
 *
 * Estos tests fijan las dos mitades del trato:
 *   - REUSO: sobrevive desmontar, recargar y reabrir mientras siga vigente.
 *   - INVALIDACIÓN: se borra ante cualquier cambio real de identidad, expiry,
 *     rechazo del servidor o storage corrupto — y nunca entra en loop de firmas.
 *
 * Audit: docs/product/2026-07-27-score-and-leaders-audit.md §10.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearScoreSession,
  ensureScoreSession,
  peekScoreSession,
  peekUsableScoreSession,
} from "../session-client";

const STORAGE_KEY = "chesscito:score-write-session:v1";

const WALLET_A = "0x1234567890123456789012345678901234567890";
const WALLET_B = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const NOW = 1_800_000_000_000;
const NOW_SECONDS = NOW / 1000;

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

/** Emite un token distinto por autorización para poder distinguirlos. */
function serverStub(expiresAt = NOW_SECONDS + 7200) {
  let n = 0;
  const fetchImpl = vi.fn(async (url: string) => {
    if (url === "/api/scores/session/challenge") {
      return jsonResponse(200, { message: "Chesscito Score Session v1\n…", expiresAt, maxSaves: 25 });
    }
    if (url === "/api/scores/session/authorize") {
      n += 1;
      return jsonResponse(200, { token: String(n).repeat(64).slice(0, 64), expiresAt, maxSaves: 25 });
    }
    throw new Error(`unexpected ${url}`);
  }) as unknown as typeof fetch;
  return fetchImpl;
}

const signer = () => vi.fn(async () => `0x${"ab".repeat(65)}`);

/** Simula cerrar la app / recargar: la memoria del módulo se va, el disco no.
 *  `clearScoreSession()` NO sirve para esto — ese borra ambos, que es
 *  justamente lo que estos tests necesitan distinguir. */
async function simulateReload() {
  vi.resetModules();
  return import("../session-client");
}

function readStored(): Record<string, unknown> | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

/**
 * `peekUsableScoreSession` — la lectura que usa el camino que GASTA Peones.
 *
 * Existe por un bug medido en preview el 2026-08-10: el gasto leía sólo memoria
 * (`peekScoreSession`), así que al cerrar y reabrir MiniPay la primera pista
 * fallaba con 401 aunque la sesión siguiera intacta en disco, y empezaba a
 * andar sola en cuanto cualquier ejercicio llamaba a `ensureScoreSession`. Un
 * bug que aparece al reabrir la app y se cura jugando es el que nadie reporta
 * bien.
 *
 * La condición que fija esta suite: memoria y disco valen igual, y NINGUNA de
 * las dos puede costar una firma.
 */
describe("peekUsableScoreSession — memoria, disco, o nada", () => {
  beforeEach(() => {
    clearScoreSession();
    localStorage.clear();
  });
  afterEach(() => {
    clearScoreSession();
    localStorage.clear();
  });

  it("devuelve la sesión que está en MEMORIA", async () => {
    await ensureScoreSession({
      wallet: WALLET_A,
      surface: "learn",
      signMessage: signer(),
      fetchImpl: serverStub(),
      now: NOW,
      promptPolicy: "allow",
    });

    const session = peekUsableScoreSession(WALLET_A, "learn", NOW);

    expect(session?.token).toBe(peekScoreSession()?.token);
  });

  it("EL CASO DEL BUG: la levanta del DISCO con la memoria vacía", async () => {
    await ensureScoreSession({
      wallet: WALLET_A,
      surface: "learn",
      signMessage: signer(),
      fetchImpl: serverStub(),
      now: NOW,
      promptPolicy: "allow",
    });

    // Cerrar y reabrir MiniPay: la memoria del módulo se va, el disco queda.
    const fresh = await simulateReload();
    expect(fresh.peekScoreSession()).toBeNull(); // memoria vacía, como en device

    const session = fresh.peekUsableScoreSession(WALLET_A, "learn", NOW);

    expect(session).not.toBeNull();
    expect(session?.wallet).toBe(WALLET_A.toLowerCase());
  });

  it("no acuña ni pide firma cuando no hay nada — devuelve null", () => {
    const signMessage = signer();

    expect(peekUsableScoreSession(WALLET_A, "learn", NOW)).toBeNull();
    // La invariante que hace que esto se pueda llamar desde un tap de HINT.
    expect(signMessage).not.toHaveBeenCalled();
  });

  it("ignora la sesión de OTRA wallet y la borra del disco", async () => {
    await ensureScoreSession({
      wallet: WALLET_A,
      surface: "learn",
      signMessage: signer(),
      fetchImpl: serverStub(),
      now: NOW,
      promptPolicy: "allow",
    });

    const fresh = await simulateReload();

    expect(fresh.peekUsableScoreSession(WALLET_B, "learn", NOW)).toBeNull();
    // Credencial de otra identidad: no se queda acumulando en disco.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("ignora la sesión de OTRA superficie", async () => {
    await ensureScoreSession({
      wallet: WALLET_A,
      surface: "learn",
      signMessage: signer(),
      fetchImpl: serverStub(),
      now: NOW,
      promptPolicy: "allow",
    });

    const fresh = await simulateReload();

    expect(fresh.peekUsableScoreSession(WALLET_A, "play", NOW)).toBeNull();
  });

  it("ignora la sesión EXPIRADA", async () => {
    await ensureScoreSession({
      wallet: WALLET_A,
      surface: "learn",
      signMessage: signer(),
      fetchImpl: serverStub(NOW_SECONDS + 60),
      now: NOW,
      promptPolicy: "allow",
    });

    const fresh = await simulateReload();

    // Dos horas después: vencida, y el margen de expiry la descarta igual.
    expect(fresh.peekUsableScoreSession(WALLET_A, "learn", NOW + 7_200_000)).toBeNull();
  });

  it("devuelve null sin wallet, en vez de mirar el disco", () => {
    expect(peekUsableScoreSession("", "learn", NOW)).toBeNull();
  });
});

describe("persistencia", () => {
  beforeEach(() => {
    clearScoreSession();
    localStorage.clear();
  });
  afterEach(() => {
    clearScoreSession();
    localStorage.clear();
  });

  it("guarda SOLO token, wallet, surface y expiresAt", async () => {
    // maxSaves queda afuera a propósito: el servidor lleva la cuenta real, y
    // un segundo lugar donde el presupuesto puede mentir no ayuda a nadie.
    const fetchImpl = serverStub();
    await ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "learn", signMessage: signer(), fetchImpl, now: NOW });

    const stored = readStored();
    expect(Object.keys(stored!).sort()).toEqual(["expiresAt", "surface", "token", "wallet"]);
    expect(stored!.wallet).toBe(WALLET_A.toLowerCase());
    expect(stored!.surface).toBe("learn");
  });

  // ── 1 y 2: sobrevive desmontar / cerrar / reabrir ────────────────────────

  it("sobrevive a desmontar y volver a montar (misma pestaña)", async () => {
    const fetchImpl = serverStub();
    const signMessage = signer();

    await ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });
    // Desmontar una pantalla no toca la sesión — solo deja de haber consumidor.
    const again = await ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });

    expect(signMessage).toHaveBeenCalledTimes(1);
    expect(again.ok).toBe(true);
  });

  it("sobrevive a cerrar y reabrir la app mientras no expire", async () => {
    // EL caso que motivó todo esto: MiniPay cerrada y vuelta a abrir.
    const fetchImpl = serverStub();
    const signMessage = signer();
    await ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });

    const reopened = await simulateReload();
    const after = await reopened.ensureScoreSession({ promptPolicy: "allow",
      wallet: WALLET_A, surface: "learn", signMessage, fetchImpl,
      now: NOW + 30 * 60 * 1000, // media hora después
    });

    expect(after.ok).toBe(true);
    // Cero firmas nuevas: la del principio sigue valiendo.
    expect(signMessage).toHaveBeenCalledTimes(1);
    if (after.ok) expect(after.session.token).toBe("1".repeat(64));
  });

  // ── 3: reuso por wallet + surface ────────────────────────────────────────

  it("reutiliza el token con la misma wallet y surface", async () => {
    const fetchImpl = serverStub();
    const signMessage = signer();

    const a = await ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });
    const b = await ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });

    expect(signMessage).toHaveBeenCalledTimes(1);
    if (a.ok && b.ok) expect(a.session.token).toBe(b.session.token);
  });

  it("acepta la wallet en distinto casing sin re-firmar", async () => {
    const fetchImpl = serverStub();
    const signMessage = signer();

    await ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });
    await ensureScoreSession({ promptPolicy: "allow",
      wallet: WALLET_A.toUpperCase().replace("0X", "0x"),
      surface: "learn", signMessage, fetchImpl, now: NOW,
    });

    expect(signMessage).toHaveBeenCalledTimes(1);
  });

  // ── 4, 6: identidad distinta ─────────────────────────────────────────────

  it("descarta la sesión cuando cambia la wallet, incluso tras reabrir", async () => {
    const fetchImpl = serverStub();
    const signMessage = signer();
    await ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });

    const reopened = await simulateReload();
    const b = await reopened.ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_B, surface: "learn", signMessage, fetchImpl, now: NOW });

    expect(signMessage).toHaveBeenCalledTimes(2);
    if (b.ok) expect(b.session.wallet).toBe(WALLET_B.toLowerCase());
    // La credencial de A no queda dando vueltas en disco.
    expect(readStored()!.wallet).toBe(WALLET_B.toLowerCase());
  });

  it("nunca entrega el token de A a la wallet B", async () => {
    const fetchImpl = serverStub();
    const signMessage = signer();
    const a = await ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });
    const b = await ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_B, surface: "learn", signMessage, fetchImpl, now: NOW });

    if (a.ok && b.ok) expect(a.session.token).not.toBe(b.session.token);
  });

  it("descarta la sesión cuando cambia la surface", async () => {
    const fetchImpl = serverStub();
    const signMessage = signer();
    await ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });

    const reopened = await simulateReload();
    await reopened.ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "play", signMessage, fetchImpl, now: NOW });

    expect(signMessage).toHaveBeenCalledTimes(2);
    expect(readStored()!.surface).toBe("play");
  });

  // ── 5: Disconnect ────────────────────────────────────────────────────────

  it("Disconnect borra la sesión de memoria Y de disco", async () => {
    const fetchImpl = serverStub();
    const signMessage = signer();
    await ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });
    expect(readStored()).not.toBeNull();

    clearScoreSession();

    expect(peekScoreSession()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("tras Disconnect, reabrir la app no resucita el token", async () => {
    const fetchImpl = serverStub();
    const signMessage = signer();
    await ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });
    clearScoreSession();

    const reopened = await simulateReload();
    await reopened.ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });

    expect(signMessage).toHaveBeenCalledTimes(2);
  });

  it("sin wallet no acuña ni lee nada", async () => {
    const fetchImpl = serverStub();
    const signMessage = signer();
    const r = await ensureScoreSession({ promptPolicy: "allow", wallet: "", surface: "learn", signMessage, fetchImpl, now: NOW });
    expect(r).toEqual({ ok: false, error: "no_wallet" });
    expect(signMessage).not.toHaveBeenCalled();
  });

  // ── 7: expiración ────────────────────────────────────────────────────────

  it("descarta la sesión expirada y borra la entrada", async () => {
    const fetchImpl = serverStub(NOW_SECONDS + 100);
    const signMessage = signer();
    await ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });

    const reopened = await simulateReload();
    await reopened.ensureScoreSession({ promptPolicy: "allow",
      wallet: WALLET_A, surface: "learn", signMessage, fetchImpl,
      now: NOW + 200_000, // pasado el expiresAt
    });

    expect(signMessage).toHaveBeenCalledTimes(2);
  });

  it("refresca ANTES de expirar para que un token no muera en vuelo", async () => {
    // Un token que pasa el chequeo del cliente y expira a mitad del request
    // se ve como un save que falló al azar.
    const fetchImpl = serverStub(NOW_SECONDS + 100);
    const signMessage = signer();
    await ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });
    await ensureScoreSession({ promptPolicy: "allow",
      wallet: WALLET_A, surface: "learn", signMessage, fetchImpl,
      now: NOW + 50_000, // aún válido, pero dentro del margen de 60s
    });

    expect(signMessage).toHaveBeenCalledTimes(2);
  });

  // ── 9: storage corrupto ──────────────────────────────────────────────────

  it.each([
    ["JSON inválido", "{{{no soy json"],
    ["objeto vacío", "{}"],
    ["falta el token", JSON.stringify({ wallet: WALLET_A, surface: "learn", expiresAt: NOW_SECONDS + 7200 })],
    ["token vacío", JSON.stringify({ token: "", wallet: WALLET_A, surface: "learn", expiresAt: NOW_SECONDS + 7200 })],
    ["surface desconocida", JSON.stringify({ token: "t", wallet: WALLET_A, surface: "admin", expiresAt: NOW_SECONDS + 7200 })],
    ["expiresAt no numérico", JSON.stringify({ token: "t", wallet: WALLET_A, surface: "learn", expiresAt: "mañana" })],
    ["un array", "[1,2,3]"],
    ["null", "null"],
  ])("descarta storage corrupto (%s) sin romper y re-autoriza", async (_label, raw) => {
    localStorage.setItem(STORAGE_KEY, raw);
    const fetchImpl = serverStub();
    const signMessage = signer();

    const reopened = await simulateReload();
    const r = await reopened.ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });

    expect(r.ok).toBe(true);
    expect(signMessage).toHaveBeenCalledTimes(1);
    // La entrada mala se limpia; si no, cada lectura volvería a fallar.
    expect(readStored()!.token).toBe("1".repeat(64));
  });

  // ── forceRefresh y fallos ────────────────────────────────────────────────

  it("forceRefresh acuña un token nuevo y reemplaza el guardado", async () => {
    const fetchImpl = serverStub();
    const signMessage = signer();
    const a = await ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });
    const b = await ensureScoreSession({ promptPolicy: "allow",
      wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW, forceRefresh: true,
    });

    expect(signMessage).toHaveBeenCalledTimes(2);
    if (a.ok && b.ok) {
      expect(a.session.token).not.toBe(b.session.token);
      expect(readStored()!.token).toBe(b.session.token);
    }
  });

  it("una firma rechazada no deja nada persistido", async () => {
    const fetchImpl = serverStub();
    const r = await ensureScoreSession({ promptPolicy: "allow",
      wallet: WALLET_A, surface: "learn", fetchImpl, now: NOW,
      signMessage: vi.fn().mockRejectedValue(new Error("User rejected")),
    });
    expect(r).toEqual({ ok: false, error: "signature_rejected" });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("un authorize fallido no deja nada persistido", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === "/api/scores/session/challenge") return jsonResponse(200, { message: "m" });
      return jsonResponse(400, { error: "invalid_challenge" });
    }) as unknown as typeof fetch;

    const r = await ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "learn", signMessage: signer(), fetchImpl, now: NOW });
    expect(r).toEqual({ ok: false, error: "authorize_failed" });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("dos saves en el mismo tick producen UNA sola firma", async () => {
    const fetchImpl = serverStub();
    const signMessage = signer();
    await Promise.all([
      ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW }),
      ensureScoreSession({ promptPolicy: "allow", wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW }),
    ]);
    expect(signMessage).toHaveBeenCalledTimes(1);
  });
});
