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
type DailyArgs = {
  piece: SharePiece;
  name: string;
  start: string;
  target: string;
  solved?: boolean;
  streak?: number;
};

const SQUARE_RE = /^[a-h][1-8]$/;
const DAILY_NAME_MAX = 40;
const DAILY_STREAK_MAX = 999;

function normalizeSquare(raw: string): string {
  const lc = raw.toLowerCase();
  return SQUARE_RE.test(lc) ? lc : "a1";
}

function normalizeDailyName(raw: string): string {
  return raw.slice(0, DAILY_NAME_MAX);
}

function clampStreak(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(Math.max(Math.trunc(raw), 0), DAILY_STREAK_MAX);
}

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

/**
 * Daily-tactic share URL (`/share/daily?piece=...&name=...&start=...&target=...`).
 * Optionally appends `solved=true` and `streak=N` when the puzzle has been solved.
 *
 * Crawlers fetch this canonical page; its `generateMetadata` exposes `og:image`
 * pointing back at `/api/og/exercise?type=daily&...` with the same params, so
 * each shared puzzle renders its own rich preview.
 */
export function shareUrlForDaily({
  piece,
  name,
  start,
  target,
  solved,
  streak,
}: DailyArgs): string {
  const p = normalizePiece(piece);
  const n = normalizeDailyName(name);
  const s = normalizeSquare(start);
  const t = normalizeSquare(target);
  const params = new URLSearchParams({
    piece: p,
    name: n,
    start: s,
    target: t,
  });
  if (solved) {
    params.set("solved", "true");
    const k = clampStreak(streak ?? 0);
    if (k > 0) params.set("streak", String(k));
  }
  return `${getShareOrigin()}/share/daily?${params.toString()}`;
}
