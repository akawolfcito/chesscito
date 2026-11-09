import { authorizeGameplaySession } from "./gameplay-session";
import { isAddress, verifyMessage } from "viem";
import { UUID_RE } from "@/lib/coach/game-persistence";
import {
  buildGameWriteMessage, GAME_WRITE_ISSUED_HEADER, GAME_WRITE_SIGNATURE_HEADER,
  GAME_WRITE_TTL_MS, GAME_WRITE_MAX_BYTES,
} from "@/lib/coach/game-write-message";

/** Verify before any private-record read/write. No secrets or payload logging. */
export async function authorizeGameWrite(
  req: Request, wallet: string, gameId: string, body: string, now = Date.now(),
): Promise<boolean> {
  if (req.method !== "POST" || !isAddress(wallet) || !UUID_RE.test(gameId) ||
      new TextEncoder().encode(body).byteLength > GAME_WRITE_MAX_BYTES) return false;
  const url = new URL(req.url);
  if (url.pathname !== "/api/games" && url.pathname !== `/api/games/${gameId}/mint-receipt`) return false;
  if (await authorizeGameplaySession(req, wallet)) return true;
  const issued = req.headers.get(GAME_WRITE_ISSUED_HEADER);
  const signature = req.headers.get(GAME_WRITE_SIGNATURE_HEADER);
  if (!issued || !/^\d{13}$/.test(issued) || !signature || !/^0x[0-9a-fA-F]{130}$/.test(signature)) return false;
  const issuedAt = Number(issued);
  if (issuedAt > now + 30_000 || now >= issuedAt + GAME_WRITE_TTL_MS) return false;
  try {
    return await verifyMessage({
      address: wallet as `0x${string}`,
      message: buildGameWriteMessage({ origin: url.origin, path: url.pathname, wallet, gameId, body, issuedAt }),
      signature: signature as `0x${string}`,
    });
  } catch {
    return false;
  }
}
