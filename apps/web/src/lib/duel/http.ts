/**
 * How the seat credential travels, and the one place that decides it.
 *
 * ⛔ THE HARD RULE OF THIS FILE: the credential is read from the request BODY
 * and from a cookie, and from NOWHERE ELSE — never from the query string.
 *
 * A token in a URL is a seat given away by accident: it lands in access logs,
 * in `Referer` headers sent to third parties, in browser history, and in every
 * "share this link" the player taps. The red-team flagged logging as the risk
 * ("un token en un log de acceso es un asiento regalado") and a query parameter
 * is the shortest path to exactly that. There is a test that a token in the
 * query string is ignored, so adding the convenience later fails loudly.
 *
 * ⚠️ The BODY is the primary path and the cookie is the backup, not the other
 * way round. Opening the link in WhatsApp's in-app browser and then "open in
 * Chrome" is a different browser context: the cookie does not travel, and in
 * `learn` mode the middleware bounces `/arena` cross-domain, where it does not
 * travel either. The client stores the token it was issued and sends it.
 */

export const SEAT_COOKIE = "chesscito_duel_seat";

/**
 * Scoped to the duel, so holding two duels at once cannot make one seat
 * shadow the other — the browser only offers the cookie whose path matches.
 */
export function seatCookiePath(duelId: string): string {
  return `/api/duel/${duelId}`;
}

export type SeatCookie = {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    sameSite: "lax";
    secure: boolean;
    path: string;
    maxAge: number;
  };
};

/**
 * The whole life of a duel: one hour of invitation plus, at the top rung of the
 * ladder, thirty minutes a side. Two hours is that with room to spare, and a
 * cookie that outlived its duel would only ever unlock a row that is gone.
 */
const SEAT_COOKIE_MAX_AGE_SECONDS = 2 * 60 * 60;

export function seatCookie(duelId: string, token: string): SeatCookie {
  return {
    name: SEAT_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax",
      // ⚠️ Not `secure` on localhost, or the cookie is silently dropped in dev
      // and every local duel looks like a broken credential.
      secure: process.env.NODE_ENV === "production",
      path: seatCookiePath(duelId),
      maxAge: SEAT_COOKIE_MAX_AGE_SECONDS,
    },
  };
}

/**
 * The credential the caller is presenting, or `null`.
 *
 * ⛔ Body first, cookie second, query string NEVER.
 */
export function readSeatToken(request: Request, body?: unknown): string | null {
  const fromBody = seatTokenOf(body);
  if (fromBody) return fromBody;
  return cookieValue(request.headers.get("cookie"), SEAT_COOKIE);
}

function seatTokenOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const value = (body as { seatToken?: unknown }).seatToken;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = decodeURIComponent(part.slice(separator + 1).trim());
    return value === "" ? null : value;
  }
  return null;
}
