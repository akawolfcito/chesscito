const PASSPORT_API_BASE = "https://api.passport.xyz/v2/stamps";

export async function checkPassportScore(address: string): Promise<boolean> {
  const apiKey = process.env.PASSPORT_API_KEY;
  const scorerId = process.env.PASSPORT_SCORER_ID;

  if (!apiKey || !scorerId) return false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(
      `${PASSPORT_API_BASE}/${scorerId}/score/${address}`,
      {
        headers: { "X-API-KEY": apiKey },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return false;
    const data = await res.json();
    return data.passing_score === true;
  } catch {
    return false;
  }
}

export async function checkPassportScores(
  addresses: string[]
): Promise<Map<string, boolean>> {
  const results = await Promise.all(
    addresses.map(async (addr) => ({
      addr,
      verified: await checkPassportScore(addr),
    }))
  );
  const map = new Map<string, boolean>();
  for (const r of results) {
    map.set(r.addr, r.verified);
  }
  return map;
}
