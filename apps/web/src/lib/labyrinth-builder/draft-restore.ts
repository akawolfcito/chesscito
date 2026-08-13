import type { BuilderState } from "./state";

/**
 * Carrying the DRAFT across the reload the save itself causes.
 *
 * ⚠️ The failure, reported by the founder while authoring: change a board →
 * Save draft → the board comes back completely BLANK, and re-editing the same
 * record means going back to the piece picker and hunting for it again. On the
 * single most repeated action in the tool.
 *
 * The cause is the same one `publish-toast.ts` already documents: a save writes
 * `content/*.json` AND `src/lib/game/generated/puzzles.generated.ts`, both inside
 * the tree Next dev watches, so Fast Refresh remounts the page and every piece of
 * useState goes back to `emptyState`. The toast was taught to survive that. The
 * draft — the actual work — was not, so the tool threw you out of the record you
 * had just saved, every single time.
 *
 * `sessionStorage` and read-once, for the reasons that module gives: this is
 * about what just happened in THIS tab, and every access is wrapped because
 * storage throws in private-mode Safari. Losing the restore is acceptable;
 * taking down the only tool that can author content is not.
 */

const DRAFT_KEY = "chesscito:builder-draft";

export type StoredDraft = {
  bucket: "exercise" | "labyrinth";
  state: BuilderState;
  extras: Record<string, unknown>;
  /**
   * Did the baseline write actually land?
   *
   * ⛔ Load-bearing. On restore this decides whether the draft counts as
   * AGREEING WITH DISK. A save that failed left nothing on disk, so calling the
   * restored draft clean would tell the unsaved-changes guard there is nothing
   * to lose — and the guard would then let the next click throw the work away
   * silently, which is the exact bug it exists to prevent.
   */
  savedOk: boolean;
};

export function storeDraft(draft: StoredDraft): void {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* no storage → the draft is simply lost, as it always was */
  }
}

/** Read AND consume the stored draft. `null` when there is none or it is junk. */
export function readStoredDraft(): StoredDraft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(DRAFT_KEY);
    const parsed = JSON.parse(raw) as StoredDraft;
    // Enough of a shape check that hand-edited or half-written JSON cannot put
    // the builder into a state with no piece and no kind.
    if (
      !parsed ||
      (parsed.bucket !== "exercise" && parsed.bucket !== "labyrinth") ||
      !parsed.state ||
      typeof parsed.state.piece !== "string" ||
      typeof parsed.state.kind !== "string" ||
      !Array.isArray(parsed.state.walls) ||
      !Array.isArray(parsed.state.enemies)
    ) {
      return null;
    }
    return {
      ...parsed,
      extras: parsed.extras ?? {},
      // ⚠️ Defaults to NOT-saved. An absent flag must land on the safe side:
      // "there might be unsaved work here", never "disk already has this".
      savedOk: parsed.savedOk === true,
    };
  } catch {
    return null;
  }
}

export function clearStoredDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* nothing to clear */
  }
}
