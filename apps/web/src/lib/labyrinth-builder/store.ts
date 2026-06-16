import type { LabyrinthRecord } from "../../../scripts/import-puzzles";
export type { LabyrinthRecord };

/** Replace a record by id; otherwise append. */
export function upsertRecord(recs: LabyrinthRecord[], rec: LabyrinthRecord): LabyrinthRecord[] {
  const i = rec.id ? recs.findIndex((r) => r.id === rec.id) : -1;
  if (i >= 0) {
    const next = recs.slice();
    next[i] = rec;
    return next;
  }
  return [...recs, rec];
}
