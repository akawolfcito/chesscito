/** Storage boundary for PRO reads. Values are expiry milliseconds since epoch;
 * decimal strings remain supported for existing records. Errors must propagate:
 * an unavailable store must never be interpreted as an absent subscription. */
export interface ProExpiryReader {
  getExpiresAt(wallet: string): Promise<string | number | null>;
}

export type ProStatus = {
  active: boolean;
  expiresAt: number | null;
};

export async function readProStatus(
  reader: ProExpiryReader,
  wallet: string,
  now: () => number = Date.now,
): Promise<ProStatus> {
  const raw = await reader.getExpiresAt(wallet.toLowerCase());
  if (raw == null) return { active: false, expiresAt: null };

  const expiresAt = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(expiresAt)) return { active: false, expiresAt: null };

  // Evaluate after I/O: a subscription may expire during a slow read.
  return { active: expiresAt > now(), expiresAt };
}
