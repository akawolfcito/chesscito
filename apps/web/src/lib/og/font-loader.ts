const FONT_PATH = "/fonts/Cinzel-Bold.ttf";

/**
 * Fetch the Cinzel Bold TTF from public/. Returns null on any fetch
 * failure so callers can fall back to a system serif — the OG card
 * still renders, just with generic typography.
 */
export async function loadCinzelFont(requestUrl: string): Promise<ArrayBuffer | null> {
  try {
    const fontUrl = new URL(FONT_PATH, requestUrl);
    const res = await fetch(fontUrl);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}
