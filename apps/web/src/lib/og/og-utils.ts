/** Format milliseconds to m:ss display */
export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0
    ? `${m}:${String(sec).padStart(2, "0")}`
    : `0:${String(sec).padStart(2, "0")}`;
}

/** Clamp moves to 999+ for display (R8) */
export function clampMoves(n: number): string {
  return n > 999 ? "999+" : String(n);
}

/** Clamp time to 99:59 for display (R8) */
export function clampTime(ms: number): string {
  const MAX_MS = 5999000; // 99:59
  return formatTime(Math.min(ms, MAX_MS));
}

/** Truncate token ID to 10 digits for display (R11) */
export function truncateId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 10)}\u2026` : id;
}

/** Format player address as 0xABCD…1234 */
export function formatPlayer(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}\u2026${address.slice(-4)}`;
}
