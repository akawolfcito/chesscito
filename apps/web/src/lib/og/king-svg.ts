/**
 * Chess king silhouette as base64-encoded SVG data URI.
 * Used as atmospheric watermark in OG victory card.
 * Opacity controlled by the consumer (0.04–0.05).
 *
 * The SVG is a simple crown/king silhouette — intentionally minimal
 * for Satori compatibility. If Satori fails to render SVG data URIs,
 * replace with a PNG data URI (see spec R9 fallback plan).
 */

const KING_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" fill="#5eead4">
  <path d="M50 5 L55 20 L65 10 L60 25 L75 18 L65 30 L80 28 L68 38 L78 42 L32 42 L22 38 L20 28 L35 30 L25 18 L40 25 L35 10 L45 20 Z"/>
  <rect x="28" y="42" width="44" height="8" rx="2"/>
  <path d="M25 50 L75 50 L72 90 L28 90 Z"/>
  <rect x="22" y="90" width="56" height="10" rx="3"/>
  <rect x="18" y="100" width="64" height="12" rx="4"/>
</svg>`;

export const KING_DATA_URI = `data:image/svg+xml;base64,${typeof btoa !== "undefined" ? btoa(KING_SVG) : Buffer.from(KING_SVG).toString("base64")}`;
