import { isAddress } from "viem";
import { UUID_RE } from "./game-persistence";
import {
  buildCoachRequestMessage, coachPayloadHash, COACH_REQUEST_HEADERS as H,
  COACH_REQUEST_TTL_MS, COACH_REQUEST_MAX_BYTES,
} from "./coach-request-message";

type Grant = { wallet: string; origin: string; issuedAt: number; headers: Record<string, string> };
// Credentials live only in tab memory, never storage, URLs or telemetry.
const jobs = new Map<string, Grant>();
let generation = 0;
export function clearCoachJobAccess() { generation += 1; jobs.clear(); }
export function coachJobHeaders(jobId: string, wallet: string, origin: string) {
  const grant = jobs.get(jobId);
  if (!grant || grant.wallet !== wallet.toLowerCase() || grant.origin !== origin ||
      Date.now() >= grant.issuedAt + COACH_REQUEST_TTL_MS) {
    if (grant) jobs.delete(jobId);
    return null;
  }
  return { ...grant.headers };
}

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
  const payloadHash = coachPayloadHash(init.body);
  let signature: `0x${string}`;
  try {
    signature = await deps.signMessage({ account: wallet, message: buildCoachRequestMessage({
      origin: deps.origin, wallet, gameId: payload.gameId, payloadHash, issuedAt, nonce,
    }) });
  } catch { throw new Error("coach_confirmation_failed"); }
  if (!isCurrent()) throw new Error("coach_request_cancelled");
  const proof = {
    [H.issued]: String(issuedAt), [H.signature]: signature, [H.nonce]: nonce,
    [H.game]: payload.gameId, [H.payload]: payloadHash,
  };
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(proof)) headers.set(key, value);
  const response = await (deps.fetchImpl ?? fetch)(input, { ...init, headers, cache: "no-store" });
  if (!isCurrent()) throw new Error("coach_request_cancelled");
  if (response.ok) {
    const data = await response.clone().json().catch(() => null) as { jobId?: unknown } | null;
    if (!isCurrent()) throw new Error("coach_request_cancelled");
    if (typeof data?.jobId === "string" && UUID_RE.test(data.jobId)) {
      // Bound retained credentials and remove expired entries on insertion.
      for (const [key, grant] of jobs) if (Date.now() >= grant.issuedAt + COACH_REQUEST_TTL_MS) jobs.delete(key);
      if (jobs.size >= 20) jobs.delete(jobs.keys().next().value!);
      jobs.set(data.jobId, { wallet: wallet.toLowerCase(), origin: deps.origin, issuedAt, headers: proof });
    }
  }
  return response;
}
