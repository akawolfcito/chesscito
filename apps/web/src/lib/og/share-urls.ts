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

const PRODUCTION_FALLBACK = "https://chesscito.com";
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

/** Production origin (no trailing slash). Prefers NEXT_PUBLIC_APP_URL. */
export function getShareOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  if (!raw) return PRODUCTION_FALLBACK;
  return raw.replace(/\/+$/, "");
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
