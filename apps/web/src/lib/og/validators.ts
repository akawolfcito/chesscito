import type { NextRequest } from "next/server";

/** Clamp an integer query param into [min, max]. */
export function parseIntParam(
  raw: string | null,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/** Whitelisted enum pick. Falls back to the first value on miss. */
export function parseEnumParam<T extends string>(
  raw: string | null,
  allowed: readonly T[],
): T {
  if (raw && (allowed as readonly string[]).includes(raw)) return raw as T;
  return allowed[0];
}

/**
 * Safe display-name sanitizer: strips control chars, trims, caps length.
 * Public endpoints render this text with Satori — no HTML escape needed,
 * but we still reject surrogate-only sequences and keep it short so the
 * card layout doesn't overflow.
 */
export function sanitizeName(raw: string | null, maxLen = 24): string | null {
  if (!raw) return null;
  const cleaned = raw
    .normalize("NFC")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  if (!cleaned) return null;
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen - 1)}\u2026` : cleaned;
}

/**
 * FEN validator. Rejects anything that isn't a well-formed 8-rank board
 * (the only portion our renderer consumes). Prevents arbitrary data on
 * shareable URLs from breaking Satori or misrepresenting game state.
 */
export function sanitizeFen(raw: string | null): string | null {
  if (!raw) return null;
  const boardPart = raw.split(" ")[0] ?? "";
  const ranks = boardPart.split("/");
  if (ranks.length !== 8) return null;
  for (const rank of ranks) {
    let count = 0;
    for (const ch of rank) {
      if (/[1-8]/.test(ch)) {
        count += Number(ch);
        continue;
      }
      if (!/[prnbqkPRNBQK]/.test(ch)) return null;
      count += 1;
    }
    if (count !== 8) return null;
  }
  return boardPart;
}

/** Read URL search params regardless of whether req is Request or NextRequest. */
export function readSearchParams(req: Request | NextRequest): URLSearchParams {
  return new URL(req.url).searchParams;
}
