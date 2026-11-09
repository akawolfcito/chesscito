import { isAddress, verifyMessage } from "viem";
import {
  buildHistoryReadMessage,
  HISTORY_READ_ISSUED_HEADER,
  HISTORY_READ_SIGNATURE_HEADER,
  HISTORY_READ_TTL_MS,
} from "@/lib/coach/history-read-message";

/** Pure verification: no datastore access, logging, or authorization via Origin. */
export async function authorizeHistoryRead(req: Request, wallet: string, now = Date.now()): Promise<boolean> {
  if (req.method !== "GET") return false;
  const issued = req.headers.get(HISTORY_READ_ISSUED_HEADER);
  const signature = req.headers.get(HISTORY_READ_SIGNATURE_HEADER);
  if (!isAddress(wallet) || !issued || !/^\d{13}$/.test(issued) ||
      !signature || !/^0x[0-9a-fA-F]{130}$/.test(signature)) return false;
  const issuedAt = Number(issued);
  if (issuedAt > now + 30_000 || now >= issuedAt + HISTORY_READ_TTL_MS) return false;
  try {
    return await verifyMessage({
      address: wallet as `0x${string}`,
      message: buildHistoryReadMessage(new URL(req.url).origin, wallet, issuedAt),
      signature: signature as `0x${string}`,
    });
  } catch {
    return false;
  }
}
