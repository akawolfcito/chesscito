/**
 * What the mount-time RESTORE is allowed to reopen.
 *
 * Reported on prod 2026-08-07, on two accounts: a player finished the rook's
 * last labyrinth at the optimum, 3/3 stars, went back to the hub, tapped the
 * rook — and landed straight back in the same labyrinth. It read as "my
 * progress is not saving".
 *
 * It was never a save bug. The bests were all stored, and `getNextChallenge`
 * correctly reported nothing available. The restore simply reopened the last
 * content played for the piece without asking whether it was finished.
 *
 * That is the RIGHT behaviour for an exercise — resume where you were, mid
 * attempt. It is the wrong behaviour for a completed labyrinth, which has no
 * "where you were": the player closed it at its optimum, and re-serving it is
 * indistinguishable from having made no progress at all.
 *
 * ⛔ This applies ONLY to the implicit restore. An explicit destination — a tap
 * on the path, a deep link — must still open exactly what it names, because
 * replaying a finished labyrinth on purpose is a legitimate thing to do.
 */

import type { TrainingNode } from "@/lib/training/path";

/**
 * The id the restore should reopen, or `null` to fall through to the ordinary
 * flow.
 *
 * Only completed LABYRINTHS are dropped. Exercises keep resuming even when
 * complete — that is how a player returns to a solved puzzle to improve their
 * stars, and it is the behaviour the path's own "improve-stars" variant
 * assumes.
 */
export function restorableContentId(
  contentId: string | null,
  path: readonly TrainingNode[],
): string | null {
  if (!contentId) return null;
  const node = path.find((n) => n.id === contentId);
  if (!node) return contentId;
  if (node.kind === "labyrinth" && node.status === "complete") return null;
  return contentId;
}
