/**
 * `promptPolicy` — el derecho a interrumpir al jugador con una firma.
 *
 * Spec: docs/specs/2026-08-09-attempt-save-never-ambushes-v3.md §3
 *
 * POR QUÉ EL CANDADO VIVE ACÁ Y NO EN EL LLAMADOR
 * ----------------------------------------------
 * Dos intentos previos fallaron por taparlo en un CAMINO y dejar otro abierto:
 * el v1 guardó el drenado de la cola y dejó vivo el auto-save del score
 * (`exercises-screen.tsx:2505`); el v2 guardó `postScoreSave` y dejó viva su
 * SEGUNDA llamada a `ensureScoreSession` (`save-client.ts:186`, la re-auth).
 *
 * `ensureScoreSession` es la única función que puede abrir la wallet, y la
 * llama un solo módulo. Con `promptPolicy` requerido, "alguien agrega un camino
 * nuevo y se olvida del guard" deja de ser expresable: no compila.
 *
 * EL CRITERIO QUE ESTOS TESTS DEFIENDEN
 * ------------------------------------
 * Ninguna entrada a /exercises puede abrir la wallet. El founder lo describió
 * como "se siente una app insegura que trata de sacarte tus fondos" — que es la
 * lectura correcta: un pedido de firma no solicitado al cargar una pantalla es
 * la forma de un phishing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearScoreSession, ensureScoreSession } from "../session-client";
import { postScoreSave } from "../save-client";

const WALLET = "0x1234567890123456789012345678901234567890" as const;
const NOW = 1_800_000_000_000;
const NOW_SECONDS = NOW / 1000;

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** Servidor que autoriza siempre. */
function authorizingServer(expiresAt = NOW_SECONDS + 7200) {
  return vi.fn(async (url: string) => {
    if (url === "/api/scores/session/challenge") {
      return jsonResponse(200, {
        message: "Chesscito Score Session v1\n…",
        expiresAt,
        maxSaves: 25,
      });
    }
    if (url === "/api/scores/session/authorize") {
      return jsonResponse(200, {
        token: "a".repeat(64),
        expiresAt,
        maxSaves: 25,
      });
    }
    throw new Error(`unexpected ${url}`);
  }) as unknown as typeof fetch;
}

const signer = () => vi.fn(async () => `0x${"ab".repeat(65)}`);

const baseSave = {
  player: WALLET,
  levelId: 1,
  score: 10,
  timeMs: 1000,
  surface: "learn" as const,
};

beforeEach(() => {
  clearScoreSession();
  localStorage.clear();
});
afterEach(() => {
  clearScoreSession();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("ensureScoreSession — promptPolicy", () => {
  it("con deny y sin sesión usable, NO firma", async () => {
    const signMessage = signer();

    const result = await ensureScoreSession({
      wallet: WALLET,
      surface: "learn",
      signMessage,
      fetchImpl: authorizingServer(),
      now: NOW,
      promptPolicy: "deny",
    });

    // El corazón del fix: la wallet no se abre.
    expect(signMessage).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("session_required");
  });

  it("con deny y sesión usable en caché, la devuelve sin firmar", async () => {
    const signMessage = signer();
    const fetchImpl = authorizingServer();

    // Primera: con permiso, acuña.
    await ensureScoreSession({
      wallet: WALLET,
      surface: "learn",
      signMessage,
      fetchImpl,
      now: NOW,
      promptPolicy: "allow",
    });
    expect(signMessage).toHaveBeenCalledTimes(1);

    // Segunda: sin permiso, pero ya hay token — el caso feliz que NO se
    // sacrifica. Drenar en frío con sesión viva es el mejor resultado posible:
    // la cola desaparece y el jugador nunca supo que existió.
    const result = await ensureScoreSession({
      wallet: WALLET,
      surface: "learn",
      signMessage,
      fetchImpl,
      now: NOW,
      promptPolicy: "deny",
    });

    expect(result.ok).toBe(true);
    expect(signMessage).toHaveBeenCalledTimes(1);
  });

  it("con deny NO espera la firma que otro llamador dejó en vuelo", async () => {
    // `ensureScoreSession` coalescea concurrentes (`if (inFlight) return
    // inFlight`). Sin este guard, un drenado de fondo quedaría colgado mientras
    // el modal de la wallet siga abierto — y con él el inFlightRef del outbox,
    // que serializa la cola entera.
    let releaseSignature = () => {};
    let announceSignerCalled = () => {};
    // ⚠️ El firmante se invoca DESPUÉS del challenge, que es async. Sin esperar
    // a que ocurra, el test liberaría una firma que todavía no arrancó y la
    // promesa quedaría colgada para siempre — falla por timeout y parece un
    // bug del producto.
    const signerCalled = new Promise<void>((resolve) => {
      announceSignerCalled = resolve;
    });
    const hangingSigner = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          releaseSignature = () => resolve(`0x${"ab".repeat(65)}`);
          announceSignerCalled();
        }),
    );
    const fetchImpl = authorizingServer();

    const pending = ensureScoreSession({
      wallet: WALLET,
      surface: "learn",
      signMessage: hangingSigner,
      fetchImpl,
      now: NOW,
      promptPolicy: "allow",
    });

    await signerCalled;

    // Con el prompt abierto, un deny tiene que resolver YA.
    const denied = await ensureScoreSession({
      wallet: WALLET,
      surface: "learn",
      signMessage: hangingSigner,
      fetchImpl,
      now: NOW,
      promptPolicy: "deny",
    });

    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error).toBe("session_required");

    releaseSignature();
    await pending;
  });
});

describe("postScoreSave — el policy atraviesa las DOS llamadas", () => {
  /** Token vivo local, muerto server-side: la caché lo sirve sin firmar, el POST
   *  vuelve rechazado, y ahí `save-client.ts:186` re-autoriza. Ese es el hueco
   *  por el que se colaba el prompt en el v2 — y es el camino del jugador que
   *  vuelve al día siguiente, cuyo token persistido puede seguir dentro de su
   *  ventana local mientras el server ya lo dio de baja. */
  function serverThatRejectsTheToken(expiresAt = NOW_SECONDS + 7200) {
    return vi.fn(async (url: string) => {
      if (url === "/api/scores/session/challenge") {
        return jsonResponse(200, {
          message: "Chesscito Score Session v1\n…",
          expiresAt,
          maxSaves: 25,
        });
      }
      if (url === "/api/scores/session/authorize") {
        return jsonResponse(200, {
          token: "a".repeat(64),
          expiresAt,
          maxSaves: 25,
        });
      }
      if (url === "/api/scores/save") {
        return jsonResponse(200, {
          status: "error",
          reason: "invalid_session",
        });
      }
      throw new Error(`unexpected ${url}`);
    }) as unknown as typeof fetch;
  }

  it("con deny, un token rechazado por el server NO dispara la re-firma", async () => {
    const signMessage = signer();
    const fetchImpl = serverThatRejectsTheToken();

    // Sembrar una sesión usable (con permiso), como la que sobrevive en disco.
    await ensureScoreSession({
      wallet: WALLET,
      surface: "learn",
      signMessage,
      fetchImpl,
      now: NOW,
      promptPolicy: "allow",
    });
    expect(signMessage).toHaveBeenCalledTimes(1);

    await postScoreSave(
      { ...baseSave, signMessage, promptPolicy: "deny" },
      fetchImpl,
      NOW,
    );

    // Una sola firma en todo el test: la del sembrado. La re-auth NO firmó.
    expect(signMessage).toHaveBeenCalledTimes(1);
  });

  it("con allow, el mismo rechazo SÍ re-autoriza — el camino legítimo sigue vivo", async () => {
    const signMessage = signer();
    const fetchImpl = serverThatRejectsTheToken();

    await ensureScoreSession({
      wallet: WALLET,
      surface: "learn",
      signMessage,
      fetchImpl,
      now: NOW,
      promptPolicy: "allow",
    });

    await postScoreSave(
      { ...baseSave, signMessage, promptPolicy: "allow" },
      fetchImpl,
      NOW,
    );

    // Sembrado + re-autorización tras el rechazo del server.
    expect(signMessage).toHaveBeenCalledTimes(2);
  });

  it("con deny NO le destruye al jugador la sesión que tenía", async () => {
    // `save-client.ts:185` limpia antes de re-autorizar. En un camino que ni
    // siquiera tiene derecho a pedir una firma nueva, borrar el token le cuesta
    // al jugador un prompt evitable en su PRÓXIMO tap — por un intento de fondo
    // que no inició.
    const signMessage = signer();
    const fetchImpl = serverThatRejectsTheToken();

    await ensureScoreSession({
      wallet: WALLET,
      surface: "learn",
      signMessage,
      fetchImpl,
      now: NOW,
      promptPolicy: "allow",
    });

    await postScoreSave(
      { ...baseSave, signMessage, promptPolicy: "deny" },
      fetchImpl,
      NOW,
    );

    // La sesión sigue disponible sin volver a firmar.
    const after = await ensureScoreSession({
      wallet: WALLET,
      surface: "learn",
      signMessage,
      fetchImpl,
      now: NOW,
      promptPolicy: "deny",
    });
    expect(after.ok).toBe(true);
    expect(signMessage).toHaveBeenCalledTimes(1);
  });
});
