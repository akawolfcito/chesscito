/**
 * Maps a /api/dev/publish result to a builder toast — db-content overlay-full
 * (Stage 7). Pure so the success / partial-failure / error copy is unit-tested
 * without rendering the builder page.
 *
 * - baseline fail            → "err"  (nothing published; show validation errors)
 * - baseline ok + overlay ok → "ok"   (live; remind to commit the json)
 * - baseline ok + overlay !ok→ "warn" (partial: saved to baseline, live failed)
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
    const note = r.overlay.revalidated ? "live now" : "saved, propagating";
    return { kind: "ok", text: `Published (${note}) + saved to baseline. ${COMMIT_NUDGE}` };
  }
  const errs = (r.overlay.errors ?? ["unknown error"]).join("; ");
  return {
    kind: "warn",
    text: `Saved to baseline, but live publish failed: ${errs}. ${COMMIT_NUDGE}`,
  };
}
