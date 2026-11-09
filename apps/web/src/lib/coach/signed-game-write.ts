import {
  buildGameWriteMessage, GAME_WRITE_ISSUED_HEADER, GAME_WRITE_SIGNATURE_HEADER,
  GAME_WRITE_TTL_MS, GAME_WRITE_MAX_BYTES,
} from "./game-write-message";

export type GameWriteArgs = {
  path: string; wallet: `0x${string}`; gameId: string; payload: unknown; signal?: AbortSignal;
};
export type SignedGameWrite = (args: GameWriteArgs) => Promise<Response>;

/** One personal_sign, one exact POST. Never log/persist the proof or signer errors. */
export async function postSignedGameWrite(args: GameWriteArgs, deps: {
  origin: string;
  signMessage: (args: { account: `0x${string}`; message: string }) => Promise<`0x${string}`>;
  isCurrent: () => boolean;
}): Promise<Response> {
  if (args.path !== "/api/games" && args.path !== `/api/games/${args.gameId}/mint-receipt`) {
    throw new Error("game_write_invalid_resource");
  }
  const body = JSON.stringify(args.payload);
  if (typeof body !== "string") throw new Error("game_write_invalid_payload");
  if (new TextEncoder().encode(body).byteLength > GAME_WRITE_MAX_BYTES) throw new Error("game_write_too_large");
  const issuedAt = Date.now();
  if (!deps.isCurrent() || args.signal?.aborted) throw new Error("game_write_cancelled");
  let signature: `0x${string}`;
  try {
    signature = await deps.signMessage({ account: args.wallet, message: buildGameWriteMessage({
      origin: deps.origin, path: args.path, wallet: args.wallet, gameId: args.gameId, body, issuedAt,
    }) });
  } catch {
    throw new Error("game_write_confirmation_failed");
  }
  if (!deps.isCurrent() || args.signal?.aborted || Date.now() >= issuedAt + GAME_WRITE_TTL_MS) {
    throw new Error("game_write_cancelled");
  }
  return fetch(args.path, {
    method: "POST", signal: args.signal, cache: "no-store", body,
    headers: {
      "Content-Type": "application/json",
      [GAME_WRITE_ISSUED_HEADER]: String(issuedAt),
      [GAME_WRITE_SIGNATURE_HEADER]: signature,
    },
  });
}
