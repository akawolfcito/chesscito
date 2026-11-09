/**
 * Maps a /api/dev/promote result to a builder toast (content-staging-model).
 * Pure so the copy is unit-tested without rendering the builder page.
 */
import type { PublishToast } from "./publish-toast";

export interface PromoteResultLike {
  ok: boolean;
  from?: string;
  to?: string;
  errors?: string[];
}

export function formatPromoteResult(
  r: PromoteResultLike,
  id: string,
): PublishToast {
  // Promotion moves an already-linted record between stages; it never re-runs
  // the catalog linter, so there is nothing to report. Empty rather than
  // optional: the builder renders `.length` unconditionally.
  if (r.ok) {
    return {
      kind: "ok",
      summary: `Promoted ${id} → ${r.to}`,
      text: `Promoted ${id}: ${r.from} → ${r.to}. Visible on the ${r.to} env within ~60s (TTL).`,
      warnings: [],
    };
  }
  const errs = (r.errors ?? ["unknown error"]).join("; ");
  return {
    kind: "err",
    // Same reason as a failed save: the error list has no upper bound.
    summary: `Promote failed for ${id}`,
    text: `Promote failed: ${errs}`,
    warnings: [],
  };
}
