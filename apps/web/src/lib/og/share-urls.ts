/**
 * Canonical share URL builders.
 *
 * Each helper returns an absolute URL pointing to a `/share/...` page that
 * exposes static OG/Twitter metadata. Social-platform crawlers (WhatsApp,
 * X, Telegram, Facebook) fetch the page, read the meta tags, and render
 * the rich preview tied to the dynamic /api/og/* image.
 *
 * Why this exists: passing `chesscito.com` to share intents drops the
 * crawler back to the generic site OG card. Per-share canonical URLs
 * let every share have its own preview.
 */

export const SHARE_PIECES = [
  "rook",
  "bishop",
  "knight",
  "pawn",
  "queen",
  "king",
] as const;

export type SharePiece = (typeof SHARE_PIECES)[number];

/**
 * Production canonical is the `www` subdomain — Vercel project routing
 * 307-redirects the apex (`chesscito.com`) to `www.chesscito.com`. Crawlers
 * follow the hop but emit "redirect detected" warnings (Twitter Card
 * Validator + Facebook Sharing Debugger both flag it) and pay an extra
 * roundtrip. Canonicalizing here keeps og:url and og:image one hop shorter.
 */
const PRODUCTION_FALLBACK = "https://www.chesscito.com";
const APEX_HOST_RE = /^https?:\/\/chesscito\.com(?=\/|$)/i;
const MAX_STARS = 15;
const MIN_STARS = 0;

function clampStars(raw: number): number {
  if (!Number.isFinite(raw)) return MIN_STARS;
  return Math.min(Math.max(Math.trunc(raw), MIN_STARS), MAX_STARS);
}

function normalizePiece(raw: string): SharePiece {
  return (SHARE_PIECES as readonly string[]).includes(raw)
    ? (raw as SharePiece)
    : "rook";
}

/**
 * Production origin (no trailing slash, canonicalized to www for the
 * apex prod host). Prefers NEXT_PUBLIC_APP_URL.
 */
export function getShareOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  const trimmed = (raw ?? PRODUCTION_FALLBACK).replace(/\/+$/, "");
  return trimmed.replace(APEX_HOST_RE, "https://www.chesscito.com");
}

type ScoreArgs = { piece: SharePiece; stars: number };
type BadgeArgs = { piece: SharePiece; stars: number };

/** Score share URL (`/share/score?piece=...&stars=...`). */
export function shareUrlForScore({ piece, stars }: ScoreArgs): string {
  const p = normalizePiece(piece);
  const s = clampStars(stars);
  return `${getShareOrigin()}/share/score?piece=${p}&stars=${s}`;
}

/** Badge share URL (`/share/badge?piece=...&stars=...`). */
export function shareUrlForBadge({ piece, stars }: BadgeArgs): string {
  const p = normalizePiece(piece);
  const s = clampStars(stars);
  return `${getShareOrigin()}/share/badge?piece=${p}&stars=${s}`;
}
