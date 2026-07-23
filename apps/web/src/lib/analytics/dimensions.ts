/**
 * Analytics dimension normalizers + allow-lists.
 *
 * PURE (no window, no env, no React) so the SAME rules run on the client (to
 * stamp events) and on the server (to sanitize, defense-in-depth). Every
 * normalizer returns a canonical low-cardinality value or `null` — never the
 * raw input — which is what keeps the dimensions safe to index and group, and
 * what keeps referrer/URL junk out of the database.
 *
 * Privacy: `country` is ISO-3166-1 alpha-2 ONLY. `source`/`campaign` are
 * allow-listed; a raw referrer or arbitrary query string can never survive.
 */

export const SURFACES = ["learn", "play", "full"] as const;
export type Surface = (typeof SURFACES)[number];

export const CONTAINERS = ["minipay", "browser"] as const;
export type Container = (typeof CONTAINERS)[number];

/** Mirrors i18n/routing locales. Kept as a literal so this module stays pure
 *  (importing routing would drag server-only deps into the client bundle). */
export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];

/** Small canonical source vocabulary. Anything recognized-but-off-list becomes
 *  `unknown`; a total absence of attribution becomes `direct` (see attribution
 *  module). This bounds cardinality by construction. */
export const SOURCES = [
  "direct",
  "minipay_discovery",
  "challenge_link",
  "share_whatsapp",
  "share_generic",
  "qr",
  "unknown",
] as const;
export type Source = (typeof SOURCES)[number];

/** Raw utm/source aliases → canonical Source. */
const SOURCE_ALIASES: Record<string, Source> = {
  direct: "direct",
  minipay: "minipay_discovery",
  minipay_discovery: "minipay_discovery",
  discovery: "minipay_discovery",
  challenge: "challenge_link",
  challenge_link: "challenge_link",
  whatsapp: "share_whatsapp",
  wa: "share_whatsapp",
  share: "share_generic",
  share_generic: "share_generic",
  qr: "qr",
};

function asString(raw: unknown): string | null {
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

export function normalizeSurface(raw: unknown): Surface | null {
  const s = asString(raw);
  return s && (SURFACES as readonly string[]).includes(s) ? (s as Surface) : null;
}

export function normalizeContainer(raw: unknown): Container | null {
  const s = asString(raw);
  return s && (CONTAINERS as readonly string[]).includes(s)
    ? (s as Container)
    : null;
}

export function normalizeLocale(raw: unknown): Locale | null {
  const s = asString(raw)?.toLowerCase();
  return s && (LOCALES as readonly string[]).includes(s) ? (s as Locale) : null;
}

/** ISO-3166-1 alpha-2, upper-cased. `null` for anything else (incl. the edge's
 *  "XX"/"T1" placeholders for unknown/anonymized geo). */
export function normalizeCountry(raw: unknown): string | null {
  const s = asString(raw)?.toUpperCase();
  return s && /^[A-Z]{2}$/.test(s) && s !== "XX" ? s : null;
}

/** Build sha (7 hex) or 'dev'. Bounded to keep cardinality ~ number of deploys. */
export function normalizeAppVersion(raw: unknown): string | null {
  const s = asString(raw)?.toLowerCase();
  return s && /^[a-z0-9]{1,12}$/.test(s) ? s : null;
}

/**
 * Map a raw source token to the canonical vocabulary.
 *  - absent  → `null` (caller decides direct vs unchanged)
 *  - known   → canonical
 *  - present but unrecognized → `unknown`
 */
export function normalizeSource(raw: unknown): Source | null {
  const s = asString(raw)?.toLowerCase().trim();
  if (!s) return null;
  // Idempotent on already-canonical values (client stamps canonical, server
  // re-sanitizes) — then alias mapping — then a bounded `unknown` fallback.
  if ((SOURCES as readonly string[]).includes(s)) return s as Source;
  return SOURCE_ALIASES[s] ?? "unknown";
}

/** Sanitized campaign slug: lowercase `[a-z0-9_-]`, ≤32 chars, else `null`.
 *  Never stores a raw referrer or arbitrary query value. */
export function normalizeCampaign(raw: unknown): string | null {
  const s = asString(raw)?.toLowerCase().trim();
  return s && /^[a-z0-9_-]{1,32}$/.test(s) ? s : null;
}
