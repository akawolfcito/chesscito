/**
 * Identity Lite — deterministic, isomorphic player identity.
 *
 * Same code runs on the server (leaderboard / stats derivation) and the client
 * (header, own-row, guest). Derivation MUST stay byte-for-byte identical on both
 * sides, so this module is pure: no DOM, no env, no time, no randomness.
 *
 * Spec: docs/specs/identity-lite-pr1.md
 */

export type PieceKey = "pawn" | "knight" | "rook" | "bishop" | "queen" | "king";
export type StyleKey =
  | "golden"
  | "green"
  | "blue"
  | "coral"
  | "tropical"
  | "bright";

export const PIECES: readonly PieceKey[] = [
  "pawn",
  "knight",
  "rook",
  "bishop",
  "queen",
  "king",
] as const;

export const STYLES: readonly StyleKey[] = [
  "golden",
  "green",
  "blue",
  "coral",
  "tropical",
  "bright",
] as const;

/**
 * Deterministic, locale-agnostic visual + naming descriptor.
 * Irreversible: 6 × 6 × 10_000 ≈ 360k space; does NOT leak the wallet.
 */
export type AvatarVariant = {
  piece: PieceKey;
  style: StyleKey;
  /** 0..9999, rendered as "#<number>". */
  number: number;
};

/** Localized tokens injected by the caller from the next-intl bundle. */
export type NicknameTokens = {
  pieces: Record<PieceKey, string>;
  styles: Record<StyleKey, string>;
  guestPrefix: string;
  /** Order template. Tokens: {piece} {style} {number}.
   *  EN: "{style} {piece} #{number}" · ES: "{piece} {style} #{number}". */
  template: string;
};

export type NicknameValidation =
  | { ok: true; value: string }
  | { ok: false; reason: "too_short" | "too_long" | "bad_chars" | "blocked" };

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

/**
 * Stable 32-bit FNV-1a hash of the lowercased seed. Specified explicitly so
 * server and client produce identical variants. Operates on UTF-8 bytes so
 * non-ASCII seeds hash identically across environments.
 */
export function hashSeed(seed: string): number {
  let hash = FNV_OFFSET_BASIS;
  const bytes = utf8Bytes(seed.toLowerCase());
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

/** Minimal, dependency-free UTF-8 encoder (TextEncoder is fine too, but this
 *  keeps the module trivially isomorphic with no global assumptions). */
function utf8Bytes(input: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i);
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // surrogate pair
      const next = input.charCodeAt(++i);
      code = 0x10000 + ((code & 0x3ff) << 10) + (next & 0x3ff);
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      out.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return out;
}

/**
 * Derive the variant. Each axis hashes a SALTED seed so piece / style / number
 * are independent (avoids correlated slices of a single hash).
 */
export function deriveAvatarVariant(seed: string): AvatarVariant {
  const piece = PIECES[hashSeed(`${seed}:p`) % PIECES.length];
  const style = STYLES[hashSeed(`${seed}:s`) % STYLES.length];
  const number = hashSeed(`${seed}:n`) % 10000;
  return { piece, style, number };
}

/**
 * Opaque, irreversible row key for the leaderboard. The only input is the full
 * lowercased wallet (server-side); the output ships to clients to dedupe the
 * caller's own row WITHOUT exposing any wallet.
 */
export function deriveRowId(walletLower: string): string {
  return `id_${hashSeed(walletLower).toString(36)}`;
}

function fill(template: string, parts: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in parts ? String(parts[key]) : `{${key}}`,
  );
}

/** Format the visible nickname from a variant + localized tokens. */
export function formatNickname(v: AvatarVariant, tokens: NicknameTokens): string {
  return fill(tokens.template, {
    piece: tokens.pieces[v.piece],
    style: tokens.styles[v.style],
    number: v.number,
  });
}

/** Guest nickname: localized prefix + the localized piece + number.
 *  "Guest Knight #3842" / "Invitado Caballo #3842". */
export function formatGuestNickname(
  v: AvatarVariant,
  tokens: NicknameTokens,
): string {
  return `${tokens.guestPrefix} ${tokens.pieces[v.piece]} #${v.number}`;
}

/** Compact form for the ≤14-char header slot: drops the style adjective. */
export function formatNicknameCompact(
  v: AvatarVariant,
  tokens: NicknameTokens,
): string {
  return `${tokens.pieces[v.piece]} #${v.number}`;
}

const NICKNAME_MIN = 3;
const NICKNAME_MAX = 18;
const NICKNAME_CHARSET = /^[\p{L}\p{N} _-]+$/u;
const BLOCKLIST = new Set([
  "admin",
  "administrator",
  "moderator",
  "mod",
  "chesscito",
  "support",
  "system",
  "null",
  "undefined",
]);

/**
 * Validate a user-supplied nickname. Pure; reused by the existing edit dialog.
 * Length 3–18 (trimmed); letters / numbers / space / `_` / `-`; small blocklist.
 */
export function validateNickname(input: string): NicknameValidation {
  const value = input.trim();
  if (value.length < NICKNAME_MIN) return { ok: false, reason: "too_short" };
  if (value.length > NICKNAME_MAX) return { ok: false, reason: "too_long" };
  if (!NICKNAME_CHARSET.test(value)) return { ok: false, reason: "bad_chars" };
  if (BLOCKLIST.has(value.toLowerCase())) return { ok: false, reason: "blocked" };
  return { ok: true, value };
}
