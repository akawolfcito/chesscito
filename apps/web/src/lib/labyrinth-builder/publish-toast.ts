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
export type PublishToast = { kind: "ok" | "warn" | "err"; text: string };

export interface PublishResultLike {
  ok: boolean;
  baseline: { ok: boolean; id?: string; errors?: string[] };
  overlay: { ok: boolean; revalidated?: boolean; errors?: string[] };
}

const COMMIT_NUDGE = "Remember to commit content/*.json.";

export function formatPublishResult(r: PublishResultLike): PublishToast {
  if (!r.baseline.ok) {
    const errs = (r.baseline.errors ?? ["unknown error"]).join("; ");
    return { kind: "err", text: `Save failed: ${errs}` };
  }
  if (r.overlay.ok) {
    const note = r.overlay.revalidated ? "visible in dev now" : "propagating";
    return {
      kind: "ok",
      text: `Saved as draft (${note}) + baseline. Promote to publish for players. ${COMMIT_NUDGE}`,
    };
  }
  const errs = (r.overlay.errors ?? ["unknown error"]).join("; ");
  return {
    kind: "warn",
    text: `Saved to baseline, but the draft overlay save failed: ${errs}. ${COMMIT_NUDGE}`,
  };
}
