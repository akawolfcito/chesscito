/**
 * Maps a /api/dev/publish result to a builder toast — db-content overlay-full
 * (Stage 7), updated for the content-staging-model: a Save lands the overlay at
 * `stage='draft'`, NOT live to players. Pure so the copy is unit-tested without
 * rendering the builder page.
 *
 * - baseline fail            → "err"  (nothing saved; show validation errors)
 * - baseline ok + overlay ok → "ok"   (saved as draft; promote to publish)
 * - baseline ok + overlay !ok→ "warn" (partial: saved to baseline, draft failed)
 */
export type PublishToast = {
  kind: "ok" | "warn" | "err";
  text: string;
  /** Save-time linter warnings, kept OUT of `text` on purpose: a toast is
   *  transient and these need somewhere durable to be read. Always an array —
   *  the caller renders `.length`, and an undefined here would crash the
   *  builder on the save path. */
  warnings: string[];
};

export interface PublishResultLike {
  ok: boolean;
  baseline: { ok: boolean; id?: string; errors?: string[]; warnings?: string[] };
  overlay: { ok: boolean; revalidated?: boolean; errors?: string[] };
}

const COMMIT_NUDGE = "Remember to commit content/*.json.";

/* ── Surviving the reload the save itself causes ──────────────────────────────
 *
 * A save writes content/*.json AND src/lib/game/generated/puzzles.generated.ts,
 * both inside the tree Next dev watches, so Fast Refresh reloads the page and
 * wipes the state the toast lives in. The verdict — including every save-time
 * linter warning — was computed, rendered and destroyed in the same beat; the
 * only way to read it was to photograph the screen in time.
 *
 * `sessionStorage`, not `localStorage`: this is a message about what just
 * happened in THIS tab, and greeting a fresh session with an hour-old verdict is
 * how a surface stops being believed. Read-once, for the same reason.
 *
 * Every access is wrapped: storage throws in private-mode Safari, and hand-edited
 * JSON must not take down the only tool that can author content. Losing the toast
 * is acceptable — losing the builder is not. */
const TOAST_KEY = "chesscito:builder-toast";

export function storeToast(toast: PublishToast): void {
  try {
    window.sessionStorage.setItem(TOAST_KEY, JSON.stringify(toast));
  } catch {
    /* no storage → the toast is simply lost, as before */
  }
}

/** Read AND consume the stored toast. `null` when there is none or it is junk. */
export function readStoredToast(): PublishToast | null {
  try {
    const raw = window.sessionStorage.getItem(TOAST_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(TOAST_KEY);
    const parsed = JSON.parse(raw) as PublishToast;
    if (!parsed || typeof parsed.text !== "string") return null;
    return { ...parsed, warnings: parsed.warnings ?? [] };
  } catch {
    return null;
  }
}

export function clearStoredToast(): void {
  try {
    window.sessionStorage.removeItem(TOAST_KEY);
  } catch {
    /* nothing to clear */
  }
}

export function formatPublishResult(r: PublishResultLike): PublishToast {
  // The route has always sent these (api/dev/publish/route.ts); this mapper
  // used to drop them, so every save-time linter warning died unread.
  const warnings = r.baseline.warnings ?? [];

  if (!r.baseline.ok) {
    const errs = (r.baseline.errors ?? ["unknown error"]).join("; ");
    return { kind: "err", text: `Save failed: ${errs}`, warnings };
  }
  if (r.overlay.ok) {
    const note = r.overlay.revalidated ? "visible in dev now" : "propagating";
    return {
      kind: "ok",
      text: `Saved as draft (${note}) + baseline. Promote to publish for players. ${COMMIT_NUDGE}`,
      warnings,
    };
  }
  const errs = (r.overlay.errors ?? ["unknown error"]).join("; ");
  return {
    kind: "warn",
    text: `Saved to baseline, but the draft overlay save failed: ${errs}. ${COMMIT_NUDGE}`,
    warnings,
  };
}
