/**
 * Wallet address formatting helpers — single source of truth for the
 * canonical truncated shape used in `<GlobalStatusBar />` (Z1) and any
 * future identity surface.
 *
 * Spec: docs/specs/ui/global-status-bar-spec-2026-05-02.md §5 + §6
 *
 * Canonical shape: `0xABCD…1234` — 4 hex + horizontal-ellipsis (U+2026)
 * + 4 hex. Total visible length 11 chars. Casing preserved.
 *
 * Why a dedicated helper (and not `address.slice(0,6) + "…" + address.slice(-4)`):
 * the spec's runtime guard (§6) checks the shape against a regex; manual
 * slicing produces inconsistent truncations (e.g., `0x12345…3456` from a
 * `slice(0, 7)`). The helper guarantees the shape; the guard verifies it.
 */

const ELLIPSIS = "…"; // U+2026 horizontal ellipsis (single character).
const PREFIX_LEN = 6; // "0x" + 4 hex = 6 chars.
const SUFFIX_LEN = 4; // last 4 hex.
const MIN_INPUT_LEN = PREFIX_LEN + SUFFIX_LEN; // 10 — anything shorter is pointless to truncate.

/**
 * Produces the canonical `0xABCD…1234` truncation from a full hex address.
 * Throws on malformed input — fail loud, never return a sentinel.
 */
export function formatWalletShort(address: string): string {
  if (!address || typeof address !== "string") {
    throw new Error("formatWalletShort: address must be a non-empty string");
  }
  if (!address.startsWith("0x") && !address.startsWith("0X")) {
    throw new Error("formatWalletShort: address must start with '0x'");
  }
  if (address.length < MIN_INPUT_LEN) {
    throw new Error(
      `formatWalletShort: address too short to truncate (got ${address.length}, need ≥ ${MIN_INPUT_LEN})`,
    );
  }
  const prefix = address.slice(0, PREFIX_LEN);
  const suffix = address.slice(-SUFFIX_LEN);
  return `${prefix}${ELLIPSIS}${suffix}`;
}

const SHAPE_RE = /^0x[a-fA-F0-9]{4}…[a-fA-F0-9]{4}$/;

/** Validates a string against the canonical truncated shape. */
export function isWalletShortShape(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  return SHAPE_RE.test(value);
}
