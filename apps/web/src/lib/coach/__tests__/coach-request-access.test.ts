import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { authorizeCoachRequest } from "@/lib/server/coach-request-authorization";
import { buildHistoryReadMessage } from "../history-read-message";
import { buildGameWriteMessage } from "../game-write-message";
import {
  buildCoachRequestMessage, coachPayloadHash, COACH_REQUEST_HEADERS as H, COACH_REQUEST_TTL_MS,
} from "../coach-request-message";
import { clearCoachJobAccess, postAuthorizedCoachAnalyze } from "../coach-request-access";

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

describe("session analyze transport", () => {
  it("does not issue an analysis for invalid payloads", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const signMessage = vi.fn();
    await expect(postAuthorizedCoachAnalyze("/api/coach/analyze", { method: "POST", body: "{}" }, {
      origin, wallet: account.address, signMessage, isCurrent: () => true, fetchImpl,
    })).rejects.toThrow("coach_request_invalid");
    expect(fetchImpl).not.toHaveBeenCalled(); expect(signMessage).not.toHaveBeenCalled();
  });
});
