import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { authorizeCoachRequest } from "@/lib/server/coach-request-authorization";
import { buildHistoryReadMessage } from "../history-read-message";
import { buildGameWriteMessage } from "../game-write-message";
import {
  buildCoachRequestMessage, coachPayloadHash, COACH_REQUEST_HEADERS as H, COACH_REQUEST_TTL_MS,
} from "../coach-request-message";
import { clearCoachJobAccess, coachJobHeaders, postAuthorizedCoachAnalyze } from "../coach-request-access";

// Ephemeral signing identities only; no key or signature is logged or saved.
const account = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());
const origin = "https://qa.invalid";
const gameId = crypto.randomUUID();
const jobId = crypto.randomUUID();
const body = JSON.stringify({ gameId, walletAddress: account.address, locale: "es", forceLocale: true });
const request = (headers: Record<string, string>, rawBody = body, url = `${origin}/api/coach/analyze`) =>
  new Request(url, { method: "POST", headers, body: rawBody });
async function proof(issuedAt = Date.now()) {
  const nonce = crypto.randomUUID();
  const payloadHash = coachPayloadHash(body);
  const message = buildCoachRequestMessage({ origin, wallet: account.address, gameId, payloadHash, issuedAt, nonce });
  return { message, headers: {
    [H.issued]: String(issuedAt), [H.game]: gameId, [H.nonce]: nonce, [H.payload]: payloadHash,
    [H.signature]: await account.signMessage({ message }),
  } };
}
beforeEach(() => { clearCoachJobAccess(); });
afterEach(() => { clearCoachJobAccess(); vi.restoreAllMocks(); });

describe("Coach proof isolation and payload integrity", () => {
  it("verifies a real signature for its exact request and read-only polling scope", async () => {
    const { headers } = await proof();
    const write = await authorizeCoachRequest(request(headers), account.address, body);
    expect(write?.gameId).toBe(gameId);
    expect(write?.ttlSeconds).toBeLessThanOrEqual(300);
    const poll = new Request(`${origin}/api/coach/job/${jobId}`, { headers });
    expect((await authorizeCoachRequest(poll, account.address))?.gameId).toBe(gameId);
    expect((await authorizeCoachRequest(request({ ...headers, [H.signature]: `0x${"0".repeat(130)}` }), account.address, body))).toBeNull();
  });
  it("rejects wallet, origin, resource, body and header tampering", async () => {
    const { headers } = await proof();
    expect(await authorizeCoachRequest(request(headers), other.address, body)).toBeNull();
    expect(await authorizeCoachRequest(request(headers, body, "https://other.invalid/api/coach/analyze"), account.address, body)).toBeNull();
    expect(await authorizeCoachRequest(request(headers, body, `${origin}/api/games`), account.address, body)).toBeNull();
    expect(await authorizeCoachRequest(request(headers, body + " "), account.address, body + " ")).toBeNull();
    for (const key of Object.values(H)) {
      expect(await authorizeCoachRequest(request({ ...headers, [key]: "invalid" }), account.address, body)).toBeNull();
    }
  });
  it("rejects missing, future and expired proof", async () => {
    const now = Date.now();
    expect(await authorizeCoachRequest(request({}), account.address, body)).toBeNull();
    for (const time of [now + 30_001, now - COACH_REQUEST_TTL_MS]) {
      const { headers } = await proof(time);
      expect(await authorizeCoachRequest(request(headers), account.address, body, now)).toBeNull();
    }
  });
  it("does not accept existing history-read or save-game signatures", async () => {
    const { headers } = await proof();
    const issuedAt = Number(headers[H.issued]);
    for (const message of [
      buildHistoryReadMessage(origin, account.address, issuedAt),
      buildGameWriteMessage({ origin, wallet: account.address, gameId, body, issuedAt, path: "/api/games" }),
    ]) {
      expect(await authorizeCoachRequest(request({ ...headers, [H.signature]: await account.signMessage({ message }) }), account.address, body)).toBeNull();
    }
  });
});

describe("signed analyze transport and in-memory polling access", () => {
  const init = () => ({ method: "POST", body, headers: { "content-type": "application/json" } });
  const signMessage = vi.fn(async ({ message }: { account: `0x${string}`; message: string }) => account.signMessage({ message }));
  it("sends only the approved payload and retains its poll proof without another signature", async () => {
    signMessage.mockClear();
    const fetchImpl = vi.fn<typeof fetch>(async (_url, options) => {
      const serverRequest = new Request(`${origin}/api/coach/analyze`, options);
      expect(await authorizeCoachRequest(serverRequest, account.address, body)).not.toBeNull();
      return Response.json({ jobId });
    });
    const response = await postAuthorizedCoachAnalyze("/api/coach/analyze", init(), { origin, wallet: account.address, signMessage, isCurrent: () => true, fetchImpl });
    expect(await response.json()).toEqual({ jobId });
    const headers = coachJobHeaders(jobId, account.address, origin);
    expect(headers).not.toBeNull();
    expect(await authorizeCoachRequest(new Request(`${origin}/api/coach/job/${jobId}`, { headers: headers! }), account.address)).not.toBeNull();
    expect(signMessage).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1]?.cache).toBe("no-store");
    expect(coachJobHeaders(jobId, other.address, origin)).toBeNull();
  });
  it("does not send after signer rejection, identity change, expiry or abort", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    for (const mode of ["reject", "change", "expire", "abort", "session_reset"]) {
      const controller = new AbortController();
      let active = true;
      const now = Date.now();
      const delayedSigner = async () => {
        if (mode === "reject") throw new Error("QA rejected");
        if (mode === "change") active = false;
        if (mode === "expire") vi.spyOn(Date, "now").mockReturnValue(now + COACH_REQUEST_TTL_MS);
        if (mode === "abort") controller.abort();
        if (mode === "session_reset") clearCoachJobAccess();
        return `0x${"1".repeat(130)}` as `0x${string}`;
      };
      await expect(postAuthorizedCoachAnalyze("/api/coach/analyze", { ...init(), signal: controller.signal }, {
        origin, wallet: account.address, signMessage: delayedSigner, isCurrent: () => active, fetchImpl,
      })).rejects.toThrow();
      vi.restoreAllMocks();
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("invalidates retained poll access on session reset and expiry", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ jobId }));
    const deps = { origin, wallet: account.address, signMessage, isCurrent: () => true, fetchImpl };
    await postAuthorizedCoachAnalyze("/api/coach/analyze", init(), deps);
    clearCoachJobAccess();
    expect(coachJobHeaders(jobId, account.address, origin)).toBeNull();
    await postAuthorizedCoachAnalyze("/api/coach/analyze", init(), deps);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + COACH_REQUEST_TTL_MS);
    expect(coachJobHeaders(jobId, account.address, origin)).toBeNull();
  });
});
