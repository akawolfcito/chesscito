/**
 * The client side of the five duel routes.
 *
 * ⛔ THE CREDENTIAL TRAVELS IN THE BODY. Never in the URL, never in a header
 * this app then logs. `readSeatToken` on the server refuses to look at the
 * query string, so a token put there would not even work — but the reason it
 * must not be attempted is that a URL ends up in access logs, in `Referer`
 * headers sent to third parties, and in browser history.
 *
 * ⚠️ Every call returns a discriminated result instead of throwing. A failed
 * move is an ordinary outcome of this feature — `not-your-turn`,
 * `illegal-move`, `version-conflict` — and the Arena has copy for each. Making
 * the caller catch would turn the game's own rules into exceptions.
 */

import type { DuelPublic } from "./types";

export type DuelApiResult =
  | { ok: true; duel: DuelPublic; seatToken?: string; alreadySeated?: boolean }
  /** The server answered, and said no. `duel` comes along for the codes that
   *  carry fresh state (`version-conflict`, `expired`). */
  | { ok: false; error: string; duel?: DuelPublic }
  /** We never got an answer. ⚠️ NOT the same as a refusal: the request may have
   *  applied. The caller must re-READ, never re-POST.
   *
   *  `duel?: undefined` is not noise: without it the union has a member that
   *  lacks the property, and every `result.duel` read stops compiling for the
   *  whole union. Naming it absent keeps the discriminant AND the access. */
  | { ok: false; error: "network"; duel?: undefined };

export type CreateDuelBody = {
  minutes: number;
  displayName?: string | null;
  sessionId?: string | null;
};

export async function createDuelRequest(body: CreateDuelBody): Promise<DuelApiResult> {
  return post("/api/duel", body);
}

export async function fetchDuel(duelId: string): Promise<DuelApiResult> {
  try {
    const response = await fetch(`/api/duel/${encodeURIComponent(duelId)}`, {
      method: "GET",
      // ⚠️ The materialization of the flag happens inside this GET, so a cached
      // answer is a duel frozen in the past.
      cache: "no-store",
    });
    return await readResult(response);
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function joinDuelRequest(
  duelId: string,
  body: { displayName?: string | null; seatToken?: string | null; sessionId?: string | null },
): Promise<DuelApiResult> {
  return post(`/api/duel/${encodeURIComponent(duelId)}/join`, body);
}

export async function moveRequest(
  duelId: string,
  body: { san: string; version: number; seatToken?: string | null; sessionId?: string | null },
): Promise<DuelApiResult> {
  return post(`/api/duel/${encodeURIComponent(duelId)}/move`, body);
}

export async function resignRequest(
  duelId: string,
  body: { version: number; seatToken?: string | null; sessionId?: string | null },
): Promise<DuelApiResult> {
  return post(`/api/duel/${encodeURIComponent(duelId)}/resign`, body);
}

async function post(path: string, body: unknown): Promise<DuelApiResult> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // ⛔ Here, and only here. See the file header.
      body: JSON.stringify(body),
    });
    return await readResult(response);
  } catch {
    return { ok: false, error: "network" };
  }
}

async function readResult(response: Response): Promise<DuelApiResult> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // A body we cannot parse from a server that answered is still a failure we
    // can name, and naming it beats inventing a duel.
    return { ok: false, error: response.ok ? "malformed" : String(response.status) };
  }

  const data = (payload ?? {}) as {
    ok?: unknown;
    duel?: unknown;
    error?: unknown;
    seatToken?: unknown;
    alreadySeated?: unknown;
  };

  if (data.ok === true && data.duel) {
    return {
      ok: true,
      duel: data.duel as DuelPublic,
      seatToken: typeof data.seatToken === "string" ? data.seatToken : undefined,
      alreadySeated: data.alreadySeated === true,
    };
  }

  return {
    ok: false,
    error: typeof data.error === "string" ? data.error : String(response.status),
    duel: (data.duel as DuelPublic | undefined) ?? undefined,
  };
}
