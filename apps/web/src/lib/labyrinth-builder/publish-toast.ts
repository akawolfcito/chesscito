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
  /** The FULL account of what happened. Belongs in the popup, not in the header
   *  strip: it already runs to two sentences when the overlay fails, and an
   *  error list makes it longer still. */
  text: string;
  /**
   * The one-line version for the header strip.
   *
   * ⚠️ Present only on results that came from a WRITE (publish / promote). The
   * ad-hoc `say()` messages carry no summary because they are already one short
   * line, and the strip renders `summary ?? text`.
   *
   * The split exists because the strip sits above a layout the founder called
   * stable and wants kept that way: a status line that can grow to several
   * sentences is the same problem the warnings panel had, one surface over.
   */
  summary?: string;
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

/**
 * The verdict to park BEFORE the request goes out.
 *
 * ⚠️ The save is a RACE and both halves of it need covering. The server writes
 * content/*.json DURING the fetch, so Next's watcher can fire Fast Refresh
 * before the response is ever read — everything after `await` may not run.
 * The DRAFT was moved ahead of the request for exactly this reason; the toast
 * was left behind, and when the reload won you got the board back with no
 * message and no chip at all: the save looked like it had done nothing.
 *
 * So a provisional verdict is parked first and overwritten by the real one if
 * the response arrives in time. It says `warn`, not `ok`, because the honest
 * position is that nobody read the answer: the reload is itself evidence the
 * write happened (nothing else touches those files), but "probably landed" is
 * not "landed", and the draft is deliberately restored as unsaved to match.
 */
export const IN_FLIGHT_TOAST: PublishToast = {
  kind: "warn",
  summary: "The page reloaded before the save answered",
  text:
    "The save was still in flight when the page reloaded. The write almost " +
    "certainly landed — that reload is triggered by the content files being " +
    "written, and nothing else touches them — but the result was never read, " +
    "so nothing here can confirm it. The draft is kept as unsaved on purpose: " +
    `check the record in the list, or just save again. ${COMMIT_NUDGE}`,
  warnings: [],
};

export function formatPublishResult(r: PublishResultLike): PublishToast {
  // The route has always sent these (api/dev/publish/route.ts); this mapper
  // used to drop them, so every save-time linter warning died unread.
  const warnings = r.baseline.warnings ?? [];

  if (!r.baseline.ok) {
    const errs = (r.baseline.errors ?? ["unknown error"]).join("; ");
    return {
      kind: "err",
      // ⚠️ The error list is the part that grows without bound — one entry per
      // validation failure — so it stays out of the summary entirely.
      summary: "Save failed — nothing was written",
      text: `Save failed: ${errs}`,
      warnings,
    };
  }
  if (r.overlay.ok) {
    const note = r.overlay.revalidated ? "visible in dev now" : "propagating";
    return {
      kind: "ok",
      // The commit nudge rides the summary: it is the one thing on the happy
      // path that needs doing, and burying it in a popup nobody opens on a
      // successful save would lose it.
      summary: `Saved as draft — ${COMMIT_NUDGE.toLowerCase()}`,
      text: `Saved as draft (${note}) + baseline. Promote to publish for players. ${COMMIT_NUDGE}`,
      warnings,
    };
  }
  const errs = (r.overlay.errors ?? ["unknown error"]).join("; ");
  return {
    kind: "warn",
    summary: "Saved to baseline — the draft overlay failed",
    text: `Saved to baseline, but the draft overlay save failed: ${errs}. ${COMMIT_NUDGE}`,
    warnings,
  };
}
