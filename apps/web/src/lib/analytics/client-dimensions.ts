import { CHESSCITO_MODE } from "@/lib/feature-flags";
import { isMiniPayEnv } from "@/lib/minipay";
import { getAttribution } from "./attribution";
import { getVisitId } from "./identity";
import { normalizeLocale, normalizeSurface, type Locale } from "./dimensions";

/**
 * Client-stamped analytics dimensions attached to every event.
 *
 * `country` is deliberately ABSENT — it is resolved server-side from the edge
 * geo header (privacy: the client must never see or send geo). Everything here
 * is cheap, synchronous, and SSR-safe via the underlying accessors.
 */
export type ClientDimensions = {
  visit_id: string;
  surface: string | null;
  container: "minipay" | "browser";
  locale: Locale;
  source: string;
  campaign: string | null;
  app_version: string;
};

/** First path segment → locale; the bare root (no locale prefix) is `en`. */
export function localeFromPath(pathname: string): Locale {
  const seg = pathname.split("/")[1] ?? "";
  return normalizeLocale(seg) ?? "en";
}

/** Safe fallback used if ANY dimension source throws. Telemetry is fail-open:
 *  a broken dimension must never propagate into the business flow. */
const FALLBACK_DIMENSIONS: ClientDimensions = {
  visit_id: "",
  surface: null,
  container: "browser",
  locale: "en",
  source: "direct",
  campaign: null,
  app_version: "dev",
};

export function clientDimensions(): ClientDimensions {
  try {
    const attribution = getAttribution();
    const pathname =
      typeof window === "undefined" ? "/" : window.location.pathname;
    return {
      visit_id: getVisitId(),
      surface: normalizeSurface(CHESSCITO_MODE),
      container: isMiniPayEnv() ? "minipay" : "browser",
      locale: localeFromPath(pathname),
      source: attribution.source,
      campaign: attribution.campaign,
      app_version: process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev",
    };
  } catch {
    return { ...FALLBACK_DIMENSIONS };
  }
}
