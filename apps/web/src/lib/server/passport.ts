const PASSPORT_API_BASE = "https://api.passport.xyz/v2/stamps";

export async function checkPassportScore(address: string): Promise<boolean> {
  const apiKey = process.env.PASSPORT_API_KEY;
  const scorerId = process.env.PASSPORT_SCORER_ID;

  if (!apiKey || !scorerId) return false;

  try {
    const res = await fetch(
      `${PASSPORT_API_BASE}/${scorerId}/score/${address}`,
      {
        headers: { "X-API-KEY": apiKey },
      }
    );
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
  const results = await Promise.allSettled(
    addresses.map(async (addr) => ({
      addr,
      verified: await checkPassportScore(addr),
    }))
  );
  const map = new Map<string, boolean>();
  for (const r of results) {
    if (r.status === "fulfilled") {
      map.set(r.value.addr, r.value.verified);
    }
  }
  return map;
}
