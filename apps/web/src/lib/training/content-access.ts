import type { ContentAccess, Exercise, PieceId } from "@/lib/game/types";
import type { EffectiveTrainingPass } from "@/lib/entitlements/effective-training-pass";
import { trainingContentSelectionStorageKey } from "@/lib/lite-progress-storage";

export type ContentAccessResult =
  | { allowed: true }
  | { allowed: false; reason: "training_pass_required" };

/** Loading is deliberately outside ContentAccessResult: unresolved access is
 *  neither allowed nor denied, so UI cannot accidentally render a lock/upsell. */
export type ContentAccessState = ContentAccessResult | { pending: true };

export type EffectiveTrainingPassSnapshot = Pick<
  EffectiveTrainingPass,
  "active" | "source"
> & { loading: boolean };

export type TrainingContentRequestSource =
  | "explicit_tap"
  | "direct"
  | "restore"
  | "automatic";

export type TrainingContentRequestResult =
  | { action: "start"; content: Exercise; attemptGrantId: string | null }
  | { action: "pending" }
  | {
      action: "locked";
      reason: "training_pass_required";
      openCheckout: boolean;
    }
  | { action: "missing" };

export function resolveContentAccess(
  content: Pick<Exercise, "access">,
  trainingPass: EffectiveTrainingPassSnapshot,
): ContentAccessState {
  const access: ContentAccess = content.access ?? "base";
  if (access === "base") return { allowed: true };
  if (trainingPass.loading) return { pending: true };
  if (trainingPass.active) return { allowed: true };
  return { allowed: false, reason: "training_pass_required" };
}

export function isContentAccessPending(
  state: ContentAccessState,
): state is { pending: true } {
  return "pending" in state;
}

export function resolveTrainingContentRequest({
  contentId,
  catalog,
  trainingPass,
  source,
}: {
  contentId: string;
  catalog: readonly Exercise[];
  trainingPass: EffectiveTrainingPassSnapshot;
  source: TrainingContentRequestSource;
}): TrainingContentRequestResult {
  const content = catalog.find((entry) => entry.id === contentId);
  if (!content) return { action: "missing" };

  const access = resolveContentAccess(content, trainingPass);
  if (isContentAccessPending(access)) return { action: "pending" };
  if (!access.allowed) {
    return {
      action: "locked",
      reason: access.reason,
      // Commercial UI is an explicit-intent boundary. Deep links, restores,
      // stale ids and automatic continuation only return the player to Path.
      openCheckout: source === "explicit_tap",
    };
  }

  return {
    action: "start",
    content,
    // A grant captures authorization for this attempt only. It lets a mounted
    // premium run finish after expiry, but is cleared before retry/replay.
    attemptGrantId: content.access === "training_pass" ? content.id : null,
  };
}

export function canMountTrainingContent({
  content,
  trainingPass,
  attemptGrantId,
}: {
  content: Exercise | null;
  trainingPass: EffectiveTrainingPassSnapshot;
  attemptGrantId: string | null;
}): boolean {
  if (!content) return false;
  if (attemptGrantId === content.id) return true;
  const access = resolveContentAccess(content, trainingPass);
  return !isContentAccessPending(access) && access.allowed;
}

export function readLastTrainingContentId(piece: PieceId): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(trainingContentSelectionStorageKey(piece));
  } catch {
    return null;
  }
}

export function writeLastTrainingContentId(piece: PieceId, contentId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(trainingContentSelectionStorageKey(piece), contentId);
  } catch {
    // Storage is an optional resume affordance; gameplay must remain local-first.
  }
}
