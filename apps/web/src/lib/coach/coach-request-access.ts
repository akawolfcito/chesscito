import { clearScoreSession, ensureScoreSession } from "@/lib/scores/session-client";
import { resolveDeploymentSurface } from "@/lib/scores/deployment-surface";
import { isAddress } from "viem";
import { UUID_RE } from "./game-persistence";
import {
  COACH_REQUEST_HEADERS as H,
  COACH_REQUEST_TTL_MS, COACH_REQUEST_MAX_BYTES,
} from "./coach-request-message";

let generation = 0;
export function clearCoachJobAccess() { generation += 1; }

/** Signing is called only by an explicit analyze/reanalyze user action. */
export async function postAuthorizedCoachAnalyze(input: RequestInfo | URL, init: RequestInit | undefined, deps: {
  origin: string; wallet?: `0x${string}`; isCurrent: () => boolean;
  signMessage: (args: { account: `0x${string}`; message: string }) => Promise<`0x${string}`>;
  fetchImpl?: typeof fetch;
}): Promise<Response> {
  if (input !== "/api/coach/analyze" || init?.method !== "POST" || typeof init.body !== "string" ||
      new TextEncoder().encode(init.body).byteLength > COACH_REQUEST_MAX_BYTES) throw new Error("coach_request_invalid");
  const payload = JSON.parse(init.body) as { walletAddress?: string; gameId?: string };
  const wallet = deps.wallet;
  if (!wallet || !isAddress(wallet) || typeof payload.walletAddress !== "string" ||
      payload.walletAddress.toLowerCase() !== wallet.toLowerCase() ||
      !payload.gameId || !UUID_RE.test(payload.gameId)) throw new Error("coach_request_invalid");
  const issuedAt = Date.now();
  const nonce = crypto.randomUUID();
  const signingGeneration = generation;
  const isCurrent = () => deps.isCurrent() && generation === signingGeneration && !init.signal?.aborted &&
    Date.now() < issuedAt + COACH_REQUEST_TTL_MS;
  if (!isCurrent()) throw new Error("coach_request_cancelled");
  const session = await ensureScoreSession({
    wallet, surface: resolveDeploymentSurface(), promptPolicy: "allow",
    signMessage: ({ message }) => deps.signMessage({ account: wallet, message }),
    fetchImpl: deps.fetchImpl,
  });
  if (!session.ok) throw new Error("coach_confirmation_failed");
  if (!isCurrent()) throw new Error("coach_request_cancelled");
  const proof = { Authorization: `Bearer ${session.session.token}`, [H.nonce]: nonce, [H.game]: payload.gameId };
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(proof)) headers.set(key, value);
  const response = await (deps.fetchImpl ?? fetch)(input, { ...init, headers, cache: "no-store" });
  if (!isCurrent()) throw new Error("coach_request_cancelled");
  if (response.status === 401) clearScoreSession();
  return response;
}
