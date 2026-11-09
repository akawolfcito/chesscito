/**
 * Identity Lite — the derivation slice the /stats census needs.
 *
 * Byte-for-byte port of the pure half of
 * `apps/web/src/lib/identity/identity-lite.ts`. Only `hashSeed`,
 * `deriveAvatarVariant` and `deriveRowId` travel: the landing renders no
 * nickname, so the localized formatter and its token types stay behind.
 *
 * ⚠️ The derivation MUST stay identical to apps/web's. The same wallet has to
 * produce the same avatar and the same `rowId` on both surfaces, or a player
 * ranked in Play would appear as a different character on the public table.
 * That is why the FNV constants and the hand-rolled UTF-8 encoder are copied
 * verbatim instead of being "modernised" into `TextEncoder`.
 *
 * Pure: no DOM, no env, no time, no randomness.
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

/** Irreversible: 6 × 6 × 10_000 ≈ 360k space; does NOT leak the wallet. */
export type AvatarVariant = {
  piece: PieceKey;
  style: StyleKey;
  /** 0..9999, rendered as "#<number>". */
  number: number;
};

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

/** Stable 32-bit FNV-1a hash of the lowercased seed, over UTF-8 bytes. */
export function hashSeed(seed: string): number {
  let hash = FNV_OFFSET_BASIS;
  const bytes = utf8Bytes(seed.toLowerCase());
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

/** Minimal, dependency-free UTF-8 encoder. */
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

/** Each axis hashes a SALTED seed so piece / style / number are independent. */
export function deriveAvatarVariant(seed: string): AvatarVariant {
  const piece = PIECES[hashSeed(`${seed}:p`) % PIECES.length];
  const style = STYLES[hashSeed(`${seed}:s`) % STYLES.length];
  const number = hashSeed(`${seed}:n`) % 10000;
  return { piece, style, number };
}

/** Opaque, irreversible row key. Input is the full lowercased wallet
 *  (server-side); the output ships to clients WITHOUT exposing any wallet. */
export function deriveRowId(walletLower: string): string {
  return `id_${hashSeed(walletLower).toString(36)}`;
}
