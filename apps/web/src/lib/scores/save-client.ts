"use client";

/**
 * SaveScore off-chain — client seam.
 *
 * `postScoreSave` is the single place the UI calls to persist a basic score.
 * Off-chain only: this module imports NO contract ABI, NO wagmi/viem, NO
 * /api/sign-score. It never broadcasts a tx.
 *
 * ── SLICE 0 (2026-07-29) ────────────────────────────────────────────────
 * The save is now AUTHORED. The client builds the canonical message from
 * `save-authorization.ts`, asks the wallet to sign it (EIP-191 personal_sign
 * — the one method proven on both MiniPay and Privy embedded, see that
 * module's header), and POSTs `{ message, signature }`.
 *
 * There is deliberately no `player` field in the request: the server recovers
 * the author from the signature. Passing an address alongside would invite a
 * future reader to trust it.
 *
 * `signMessage` is INJECTED rather than imported from wagmi, so this module
 * stays free of React hooks and is unit-testable without a wallet provider.
 * The caller supplies `signMessageAsync` from `useSignMessage()`.
 *
 * Failure policy is unchanged: a network throw, a user rejection, or an
 * unparseable body degrades to `{ status: "error" }`. The client NEVER
 * fabricates a "saved" the server did not return.
 */

import {
  buildScoreSaveMessage,
  MAX_SCORE_SAVE_WINDOW_SECONDS,
  type ScoreSaveSurface,
} from "./save-authorization";
import { type BasicScoreSaveResult } from "./save-service";

/** How long the authorization we mint stays valid. Deliberately shorter than
 *  the server's `MAX_SCORE_SAVE_WINDOW_SECONDS` ceiling so ordinary clock
 *  skew never produces a window the server rejects as too wide. */
const AUTHORIZATION_TTL_SECONDS = Math.min(120, MAX_SCORE_SAVE_WINDOW_SECONDS);

export type SignMessageFn = (args: { message: string }) => Promise<string>;

export type ScoreSaveClientInput = {
  player: `0x${string}`;
  levelId: number;
  score: number;
  timeMs: number;
  /** Which product this build is. Comes from the caller's mode flag, and is
   *  re-checked server-side against the deployment — a lie here is a 400. */
  surface: ScoreSaveSurface;
  chainId: number;
  signMessage: SignMessageFn;
};

/** Statuses the endpoint can return — used to validate the JSON body
 *  before trusting it as a `BasicScoreSaveResult`. */
const KNOWN_STATUSES = new Set<BasicScoreSaveResult["status"]>([
  "saved",
  "duplicate",
  "insufficient_peones",
  "invalid",
  "rate_limited",
  "error",
]);

function isBasicScoreSaveResult(v: unknown): v is BasicScoreSaveResult {
  if (typeof v !== "object" || v === null) return false;
  const status = (v as { status?: unknown }).status;
  return typeof status === "string" && KNOWN_STATUSES.has(status as BasicScoreSaveResult["status"]);
}

/** 128 bits of CSPRNG, lowercase hex. Uniqueness is ultimately enforced by the
 *  DB primary key; this only has to make honest collisions impossible. */
export function createScoreSaveNonce(
  randomValues: (arr: Uint8Array) => Uint8Array = (arr) =>
    globalThis.crypto.getRandomValues(arr),
): string {
  const bytes = randomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Persist a basic score off-chain, authored by the player's wallet.
 *
 * `gameId` stays the score itself server-side, so the derived saveId
 * (`player:levelId:score`) keeps its best-score-per-level dedup: re-saving the
 * same score is idempotent (`duplicate`), a higher score is a fresh row the
 * combined leaderboard's MAX picks up.
 *
 * `fetchImpl` / `now` are injectable for tests.
 */
export async function postScoreSave(
  input: ScoreSaveClientInput,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<BasicScoreSaveResult> {
  const issuedAt = Math.floor(now / 1000);

  const message = buildScoreSaveMessage({
    chainId: input.chainId,
    player: input.player,
    surface: input.surface,
    levelId: input.levelId,
    score: input.score,
    timeMs: input.timeMs,
    issuedAt,
    expiresAt: issuedAt + AUTHORIZATION_TTL_SECONDS,
    nonce: createScoreSaveNonce(),
  });

  let signature: string;
  try {
    signature = await input.signMessage({ message });
  } catch {
    // User rejected the prompt, or the wallet has no signing capability.
    // Reported honestly; the caller decides whether to offer a retry.
    return { status: "error", reason: "signature_rejected" };
  }

  let res: Response;
  try {
    res = await fetchImpl("/api/scores/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, signature }),
    });
  } catch {
    // Network / offline. The optimistic quick-save-local degrade is the
    // caller's call; the client only reports the failure honestly.
    return { status: "error", reason: "network" };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { status: "error", reason: "bad_response" };
  }

  if (isBasicScoreSaveResult(data)) {
    return data;
  }
  return { status: "error", reason: "bad_response" };
}
