import { normalizeCampaign, normalizeSource, type Source } from "./dimensions";

/**
 * First-touch acquisition attribution.
 *
 * On the first call in an install, reads `utm_source`/`source` and
 * `utm_campaign`/`campaign` from the current URL, normalizes them through the
 * allow-list, and PERSISTS the result to localStorage so every later visit
 * keeps the ORIGINAL acquisition source (first-touch, not last-touch). A total
 * absence of params on first touch resolves to `direct`.
 *
 * We persist only the normalized {source, campaign} — never the raw referrer,
 * URL, or arbitrary query params. SSR-safe and storage-error-safe.
 */

const ATTRIBUTION_KEY = "chesscito:attribution";

export type Attribution = { source: Source; campaign: string | null };

const DEFAULT: Attribution = { source: "direct", campaign: null };

export function getAttribution(): Attribution {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const stored = window.localStorage.getItem(ATTRIBUTION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Attribution>;
      return {
        source: normalizeSource(parsed.source) ?? "direct",
        campaign: normalizeCampaign(parsed.campaign),
      };
    }
    const params = new URLSearchParams(window.location.search);
    const source =
      normalizeSource(params.get("utm_source") ?? params.get("source")) ??
      "direct";
    const campaign = normalizeCampaign(
      params.get("utm_campaign") ?? params.get("campaign"),
    );
    const attribution: Attribution = { source, campaign };
    window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
    return attribution;
  } catch {
    return DEFAULT;
  }
}
