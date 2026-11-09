import { clearScoreSession, ensureScoreSession } from "@/lib/scores/session-client";
import { resolveDeploymentSurface } from "@/lib/scores/deployment-surface";
import {
  GAME_WRITE_MAX_BYTES,
} from "./game-write-message";

export type GameWriteArgs = {
  path: string; wallet: `0x${string}`; gameId: string; payload: unknown; signal?: AbortSignal;
};
export type SignedGameWrite = (args: GameWriteArgs) => Promise<Response>;

/** Wallet-scoped session authorization; never log its token or signer errors. */
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
  if (!deps.isCurrent() || args.signal?.aborted) throw new Error("game_write_cancelled");
  const access = await ensureScoreSession({
    wallet: args.wallet, surface: resolveDeploymentSurface(), promptPolicy: "allow",
    signMessage: ({ message }) => deps.signMessage({ account: args.wallet, message }),
  });
  if (!access.ok) throw new Error("game_write_confirmation_failed");
  if (!deps.isCurrent() || args.signal?.aborted) throw new Error("game_write_cancelled");
  const response = await fetch(args.path, {
    method: "POST", signal: args.signal, cache: "no-store", body,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${access.session.token}` },
  });
  if (response.status === 401 && deps.isCurrent()) clearScoreSession();
  return response;
}
