import { UUID_RE } from "./game-persistence";
import type { CoachAnalysisRecord, GameRecord } from "./types";

/**
 * Pure parsers for the two payloads consumed by `coach-history.tsx`:
 * `/api/coach/history` (Supabase analyzed records) and `/api/games`
 * (Redis game records). Both endpoints can legally return a `{ error }`
 * object on rate-limit / 403, and both can in principle carry a corrupt
 * `gameId` — POST-time validation closes the write path on `/api/games`
 * but not on the analyze backfill flow, and never on legacy entries.
 *
 * Cluster E defer #4 (edge-case hunter #11): assert UUID shape so a
 * corrupt id never reaches `/api/coach/analyze`, where it would 400 and
 * silently fall on the floor inside the caller's `try/catch`.
 */

export type AnalyzedEntry = CoachAnalysisRecord & {
  kind: "analyzed";
  game: GameRecord;
};

export type UnanalyzedEntry = {
  kind: "unanalyzed";
  gameId: string;
  game: GameRecord;
};

function hasValidGameId(record: object): boolean {
  const id = (record as { gameId?: unknown }).gameId;
  return typeof id === "string" && UUID_RE.test(id);
}

export function parseAnalyzedHistory(input: unknown): AnalyzedEntry[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input
    .filter((e: unknown): e is CoachAnalysisRecord & { game: GameRecord } => {
      if (!e || typeof e !== "object") return false;
      if (!("game" in e)) return false;
      return hasValidGameId(e);
    })
    .filter((e) => {
      // Per-locale migration (2026-05-24): if the server (or a future
      // backend) ever emits two entries for the same gameId — one per
      // locale — the parser collapses them to a single AnalyzedEntry.
      // First-wins preserves the server's ordering signal (newest first
      // by LPUSH semantics, or the caller's chosen sort order).
      const id = (e as { gameId: string }).gameId;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((e) => ({ ...e, kind: "analyzed" as const }));
}

export function parseUnanalyzedGames(
  input: unknown,
  analyzedIds: ReadonlySet<string>,
): UnanalyzedEntry[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((g: unknown): g is GameRecord => {
      if (!g || typeof g !== "object") return false;
      return hasValidGameId(g);
    })
    .filter((g) => !analyzedIds.has(g.gameId))
    .map((g) => ({ kind: "unanalyzed" as const, gameId: g.gameId, game: g }));
}
