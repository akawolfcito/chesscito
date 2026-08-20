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
  | "automatic"
  /** A curated Mini-games card or its deep link, vouched for by a shipped
   *  rotation (`resolveMiniGameDeepLink`). The SCREEN lets this source skip the
   *  lane's progression lock — featuring a mid-lane level is the whole point of
   *  per-challenge rotation.
   *
   *  ⛔ It skips PROGRESSION only. The commercial check above runs for it
   *  exactly as for every other source, and it may NOT open checkout: a card
   *  tap on the hub is an explicit intent to PLAY, never to buy. */
  | "featured";

export type TrainingContentRequestResult =
  | { action: "start"; content: Exercise; attemptGrantId: string | null }
  | { action: "pending" }
  | {
      action: "locked";
      reason: "training_pass_required";
      openCheckout: boolean;
    }
  | { action: "missing" };

/**
 * What the SCREEN settles a content request into. It is the resolver's result
 * plus one outcome the resolver cannot reach.
 *
 * `completed`: the content exists and is UNLOCKED, but the player already
 * finished it and the request is an implicit restore — not a tap, a deep link,
 * or automatic continuation. It settles exactly like `missing`; not an error.
 *
 * ⛔ Deliberately NOT a member of `TrainingContentRequestResult`. Completion
 * lives in the training path, which `resolveTrainingContentRequest` does not
 * receive and should not: it is a pure access resolver. Widening its union
 * would make every caller narrow against an action it can never return — the
 * compiler said so the moment it was tried.
 *
 * ⛔ PRECEDENCE: `pending` > `missing`/`locked` > `completed` > `start`.
 * A labyrinth that is finished AND pass-gated settles as `locked`: the unlock
 * CTA is worth more to the player than "you already did this".
 * ⚠️ This ordering has no observable consequence TODAY — both branches settle
 * to the path, and the drawer routes checkout itself — so it is pinned here
 * and by the branch position, not by a test. See the note in
 * `__tests__/restore-completed-content.test.tsx`.
 */
export type TrainingContentSettlement =
  | TrainingContentRequestResult
  | { action: "completed" };

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
