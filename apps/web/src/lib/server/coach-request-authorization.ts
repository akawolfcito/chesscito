import { authorizeGameplaySession } from "./gameplay-session";
import { readSpendBearerToken } from "@/lib/scores/spend-session-guard";
import { hashSessionToken } from "@/lib/server/score-session-store";
import { isAddress, keccak256, toBytes, verifyMessage } from "viem";
import { UUID_RE } from "@/lib/coach/game-persistence";
import {
  buildCoachRequestMessage, coachPayloadHash, COACH_REQUEST_HEADERS as H,
  COACH_REQUEST_TTL_MS, COACH_REQUEST_MAX_BYTES,
} from "@/lib/coach/coach-request-message";

/** Writes accept a current wallet session or the legacy request proof. */
export async function authorizeCoachRequest(req: Request, wallet: string, body?: string, now = Date.now()) {
  const url = new URL(req.url);
  const post = req.method === "POST" && url.pathname === "/api/coach/analyze";
  const poll = req.method === "GET" && /^\/api\/coach\/job\/[^/]+$/.test(url.pathname);
  if ((!post && !poll) || !isAddress(wallet)) return null;
  if (post && typeof body === "string" && new TextEncoder().encode(body).byteLength <= COACH_REQUEST_MAX_BYTES) {
    const nonce = req.headers.get(H.nonce);
    let gameId: unknown;
    try { gameId = JSON.parse(body).gameId; } catch { return null; }
    if (typeof gameId === "string" && UUID_RE.test(gameId) && nonce && UUID_RE.test(nonce) &&
        await authorizeGameplaySession(req, wallet)) {
      const token = readSpendBearerToken(req)!;
      return { gameId, replayKey: `coach:request:session:${hashSessionToken(token)}:${nonce}`, ttlSeconds: Math.ceil(COACH_REQUEST_TTL_MS / 1000) };
    }
  }
  const gameId = req.headers.get(H.game);
  const nonce = req.headers.get(H.nonce);
  const payloadHash = req.headers.get(H.payload);
  const issued = req.headers.get(H.issued);
  const signature = req.headers.get(H.signature);
  if (!gameId || !UUID_RE.test(gameId) || !nonce || !UUID_RE.test(nonce) ||
      !payloadHash || !/^0x[0-9a-f]{64}$/.test(payloadHash) ||
      !issued || !/^\d{13}$/.test(issued) || !signature || !/^0x[0-9a-fA-F]{130}$/.test(signature)) return null;
  if (post && (typeof body !== "string" ||
      new TextEncoder().encode(body).byteLength > COACH_REQUEST_MAX_BYTES || coachPayloadHash(body) !== payloadHash)) return null;
  const issuedAt = Number(issued);
  if (issuedAt > now + 30_000 || now >= issuedAt + COACH_REQUEST_TTL_MS) return null;
  const message = buildCoachRequestMessage({ origin: url.origin, wallet, gameId, payloadHash, issuedAt, nonce });
  try {
    if (!await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` })) return null;
    return {
      gameId,
      // Bind consumption to the signed message, not a malleable signature.
      replayKey: `coach:request:${keccak256(toBytes(message))}`,
      ttlSeconds: Math.ceil((issuedAt + COACH_REQUEST_TTL_MS - now) / 1000),
    };
  } catch { return null; }
}
