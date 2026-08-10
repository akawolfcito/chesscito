"use client";

/**
 * Score write session — client cache and just-in-time authorization.
 *
 * Audit: docs/product/2026-07-27-score-and-leaders-audit.md §10.
 *
 *   first puntuable save  → challenge → ONE signature → token
 *   every save after that → silent
 *
 * WHY THE TOKEN IS PERSISTED (revisado 2026-07-27 tras el smoke en device)
 * -----------------------------------------------------------------------
 * La primera versión lo guardaba SOLO en memoria del módulo, con el argumento
 * de que una credencial bearer en storage amplía el radio de exposición. El
 * smoke en MiniPay mostró que ese razonamiento estaba mal calibrado:
 *
 *   - MiniPay es una mini-app que se abre y se cierra todo el tiempo. Cada
 *     cierre descarga el módulo y tira el token, así que en la práctica no era
 *     "una firma cada 2 horas" sino "una firma por cada apertura que produzca
 *     un save". El founder lo verificó en dos dispositivos.
 *   - Y el peor caso de un token robado es MUY acotado: permite escribir hasta
 *     `maxSaves` scores EN LA WALLET DE LA VÍCTIMA. No mueve fondos, no lee
 *     datos, no firma transacciones, no toca entitlements. El daño máximo es
 *     inflarle el puntaje a alguien o gastarle su presupuesto de saves — un
 *     ataque con casi ninguna utilidad.
 *
 * Pagar ese riesgo casi nulo con firmas repetidas es un mal negocio: un prompt
 * que aparece seguido es un prompt que el jugador aprende a descartar sin leer,
 * y esa es justo la costumbre de la que depende el carril on-chain.
 *
 * Lo que NO cambia: el alcance del token (una wallet, una superficie, 2h, 25
 * saves, revocable server-side) y toda la lógica de invalidación. Solo cambia
 * DÓNDE vive entre aperturas.
 *
 * El caché sigue keyed por `(wallet, surface)` — es lo que hace la
 * invalidación automática en vez de algo que un caller deba recordar:
 *   - wallet distinta  → miss → nueva autorización, y la entrada vieja se borra
 *   - Disconnect       → `clearScoreSession()` explícito
 *   - surface distinta → miss (un build tiene una sola, pero un token acuñado
 *                        en el otro producto no debe reusarse jamás)
 *   - expirado         → miss, contra el `expiresAt` guardado
 *   - el server lo rechaza → se descarta en el acto
 *
 * NUNCA pide firma al montar, al abrir el Hub, ni antes de completar un
 * ejercicio — solo en el primer save que realmente se va a escribir.
 */

import type { ScoreSaveSurface } from "./save-authorization";

export type SignMessageFn = (args: { message: string }) => Promise<string>;

export type ScoreSession = {
  token: string;
  wallet: string;
  surface: ScoreSaveSurface;
  /** Unix SECONDS, as issued by the server. */
  expiresAt: number;
  maxSaves: number;
};

/** Lo único que se persiste. `maxSaves` queda deliberadamente afuera: es
 *  informativo para la UI y el servidor lo cuenta igual, así que guardarlo solo
 *  crearía un segundo lugar donde el presupuesto puede mentir. */
type PersistedSession = Pick<ScoreSession, "token" | "wallet" | "surface" | "expiresAt">;

export type ScoreSessionError =
  | "no_wallet"
  | "challenge_failed"
  | "signature_rejected"
  | "authorize_failed"
  /** Haría falta una firma y este llamador no tiene derecho a pedirla.
   *  ⛔ NO es un fallo: es "ahora no". Nada salió mal, nadie rechazó nada y el
   *  intento sigue entero — sólo que acuñar la sesión habría costado un prompt
   *  que el jugador no pidió. Los consumidores deben tratarlo distinto de un
   *  error (no encender estados de "falló el guardado"). */
  | "session_required"
  | "network";

export type ScoreSessionResult =
  | { ok: true; session: ScoreSession }
  | { ok: false; error: ScoreSessionError };

/**
 * Refresh a token this many seconds BEFORE it actually expires.
 *
 * Without a margin a token that passes the client check can still expire in
 * flight, producing a 401 the player experiences as a random failed save. 60s
 * comfortably covers a slow mobile round trip.
 */
const EXPIRY_MARGIN_SECONDS = 60;

/** Versionada: si el shape cambia, la clave cambia y las entradas viejas se
 *  ignoran solas en vez de parsearse mal. */
const STORAGE_KEY = "chesscito:score-write-session:v1";

let cached: ScoreSession | null = null;
/** In-flight authorization, so two saves racing on the same tick produce ONE
 *  wallet prompt rather than two. This is the difference between "just in
 *  time" and "twice, confusingly". */
let inFlight: Promise<ScoreSessionResult> | null = null;

// ─────────────────────────────────────────────────────────────────
// Persistencia
// ─────────────────────────────────────────────────────────────────

function isPersistedSession(v: unknown): v is PersistedSession {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.token === "string" &&
    s.token.length > 0 &&
    typeof s.wallet === "string" &&
    s.wallet.length > 0 &&
    (s.surface === "learn" || s.surface === "play") &&
    typeof s.expiresAt === "number" &&
    Number.isFinite(s.expiresAt)
  );
}

/** Lee la entrada persistida. Cualquier cosa que no sea exactamente el shape
 *  esperado se descarta EN SILENCIO y se borra: un token corrupto no es un
 *  error del jugador ni algo que valga interrumpirlo, y dejarlo ahí haría que
 *  cada lectura vuelva a fallar. */
function readPersisted(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isPersistedSession(parsed)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    // JSON inválido, storage bloqueado o modo privado.
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nada que hacer */
    }
    return null;
  }
}

function writePersisted(session: ScoreSession): void {
  if (typeof window === "undefined") return;
  try {
    const toStore: PersistedSession = {
      token: session.token,
      wallet: session.wallet,
      surface: session.surface,
      expiresAt: session.expiresAt,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Quota o modo privado: la sesión sigue viva en memoria para esta pestaña.
    // Perder la persistencia degrada la comodidad, nunca la corrección.
  }
}

function removePersisted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nada que hacer */
  }
}

// ─────────────────────────────────────────────────────────────────
// Caché
// ─────────────────────────────────────────────────────────────────

function isUsable(
  session: { wallet: string; surface: ScoreSaveSurface; expiresAt: number } | null,
  wallet: string,
  surface: ScoreSaveSurface,
  nowSeconds: number,
): boolean {
  if (!session) return false;
  if (session.wallet !== wallet.toLowerCase()) return false;
  if (session.surface !== surface) return false;
  return session.expiresAt - EXPIRY_MARGIN_SECONDS > nowSeconds;
}

/**
 * Borra la sesión, en memoria y en disco.
 *
 * Se llama ante un cambio REAL de identidad (Disconnect, otra wallet) o cuando
 * el servidor declara el token muerto — NUNCA por el ciclo de vida de una
 * pantalla. Desmontar `ExercisesScreen` o navegar al Hub no es un evento de
 * seguridad, y tratarlo como tal costaba una firma extra por navegación.
 */
export function clearScoreSession(): void {
  cached = null;
  inFlight = null;
  removePersisted();
}

/** Lo que hay en memoria. No toca storage ni acuña nada — para tests y para el
 *  camino "el server rechazó nuestro token". */
export function peekScoreSession(): ScoreSession | null {
  return cached;
}

export type EnsureScoreSessionInput = {
  wallet: string;
  surface: ScoreSaveSurface;
  signMessage: SignMessageFn;
  fetchImpl?: typeof fetch;
  now?: number;
  /** Force a fresh authorization even if a token is cached. Used exactly once
   *  after the server rejects a token, never in a loop. */
  forceRefresh?: boolean;
  /**
   * ¿Este llamador tiene derecho a interrumpir al jugador con una firma?
   *
   * ⛔ REQUERIDO, sin default. Un default convierte "nadie lo pensó" en
   * "permitido", que es exactamente cómo nacieron los dos caminos automáticos
   * que abrían la wallet al montar `/exercises`: el drenado de la cola de
   * intentos y el auto-save del score. Siendo obligatorio, todo llamador nuevo
   * —presente o futuro— está forzado por `tsc` a decidir, y el agujero no se
   * puede reabrir en silencio.
   *
   * Spec: docs/specs/2026-08-09-attempt-save-never-ambushes-v3.md §3
   */
  promptPolicy: "allow" | "deny";
};

/**
 * Return a usable session, minting one (with a single wallet prompt) only if
 * neither memory nor storage can serve the request.
 */
export async function ensureScoreSession(
  input: EnsureScoreSessionInput,
): Promise<ScoreSessionResult> {
  const {
    wallet,
    surface,
    signMessage,
    fetchImpl = fetch,
    now = Date.now(),
    forceRefresh = false,
    promptPolicy,
  } = input;

  if (!wallet) return { ok: false, error: "no_wallet" };

  const nowSeconds = Math.floor(now / 1000);

  if (forceRefresh) {
    cached = null;
    removePersisted();
  } else {
    if (isUsable(cached, wallet, surface, nowSeconds)) {
      return { ok: true, session: cached! };
    }

    // Memoria vacía (pestaña nueva, app reabierta) — probar disco.
    const stored = readPersisted();
    if (stored) {
      if (isUsable(stored, wallet, surface, nowSeconds)) {
        // `maxSaves` no se persiste; el servidor es quien lleva la cuenta real.
        cached = { ...stored, maxSaves: 0 };
        return { ok: true, session: cached };
      }
      // Expirada, o de otra wallet/superficie: se borra en vez de quedar
      // acumulando credenciales muertas de identidades pasadas.
      removePersisted();
    }
  }

  // A partir de acá sólo queda acuñar, y acuñar cuesta una firma.
  //
  // ⛔ El guard va ANTES del coalescing, no después. Si un llamador `deny`
  // recibiera la promesa en vuelo de un `allow`, quedaría bloqueado todo el
  // tiempo que el modal de la wallet siga abierto — y con él el `inFlightRef`
  // del outbox, que serializa la cola entera. Un `deny` no genera prompts y
  // tampoco espera los ajenos.
  if (promptPolicy === "deny") return { ok: false, error: "session_required" };

  // Coalesce concurrent callers onto one prompt.
  if (inFlight) return inFlight;

  inFlight = authorize(wallet, surface, signMessage, fetchImpl).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function authorize(
  wallet: string,
  surface: ScoreSaveSurface,
  signMessage: SignMessageFn,
  fetchImpl: typeof fetch,
): Promise<ScoreSessionResult> {
  // 1. Ask the server for terms. The client proposes nothing but its wallet.
  let challenge: { message?: unknown; expiresAt?: unknown; maxSaves?: unknown };
  try {
    const res = await fetchImpl("/api/scores/session/challenge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet }),
    });
    if (!res.ok) return { ok: false, error: "challenge_failed" };
    challenge = await res.json();
  } catch {
    return { ok: false, error: "network" };
  }

  if (typeof challenge.message !== "string") {
    return { ok: false, error: "challenge_failed" };
  }

  // 2. The one prompt. Everything the player is agreeing to is readable in it.
  let signature: string;
  try {
    signature = await signMessage({ message: challenge.message });
  } catch {
    return { ok: false, error: "signature_rejected" };
  }

  // 3. Trade the signature for the token.
  let payload: { token?: unknown; expiresAt?: unknown; maxSaves?: unknown };
  try {
    const res = await fetchImpl("/api/scores/session/authorize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: challenge.message, signature }),
    });
    if (!res.ok) return { ok: false, error: "authorize_failed" };
    payload = await res.json();
  } catch {
    return { ok: false, error: "network" };
  }

  if (
    typeof payload.token !== "string" ||
    typeof payload.expiresAt !== "number" ||
    typeof payload.maxSaves !== "number"
  ) {
    return { ok: false, error: "authorize_failed" };
  }

  cached = {
    token: payload.token,
    wallet: wallet.toLowerCase(),
    surface,
    expiresAt: payload.expiresAt,
    maxSaves: payload.maxSaves,
  };
  writePersisted(cached);
  return { ok: true, session: cached };
}
