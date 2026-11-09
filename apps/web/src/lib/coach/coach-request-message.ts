import { keccak256, toBytes } from "viem";

export const COACH_REQUEST_TTL_MS = 5 * 60 * 1000;
export const COACH_REQUEST_MAX_BYTES = 16 * 1024;
export const COACH_REQUEST_HEADERS = {
  issued: "x-chesscito-coach-issued-at",
  signature: "x-chesscito-coach-signature",
  game: "x-chesscito-coach-game",
  payload: "x-chesscito-coach-payload",
  nonce: "x-chesscito-coach-nonce",
} as const;

export const coachPayloadHash = (body: string) => keccak256(toBytes(body));

export function buildCoachRequestMessage(args: {
  origin: string; wallet: string; gameId: string; payloadHash: string; issuedAt: number; nonce: string;
}): string {
  return [
    "Request my Chesscito Coach analysis",
    `Origin: ${args.origin}`, "Chain: 42220",
    `Wallet: ${args.wallet.toLowerCase()}`,
    "Resource: POST /api/coach/analyze",
    `Game: ${args.gameId}`, `Payload: ${args.payloadHash}`, `Nonce: ${args.nonce}`,
    `Issued: ${args.issuedAt}`, `Expires: ${args.issuedAt + COACH_REQUEST_TTL_MS}`,
    "Authorize this analysis request once and read its job for this game until expiry.",
    "Analysis may use existing Coach credits. No blockchain transaction or token payment authorized.",
  ].join("\n");
}
