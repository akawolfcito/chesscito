/* ── The consequence of an attempt ─────────────────────────────────
 * Spec: docs/specs/2026-08-08-consequence-in-completion-overlay.md (Paso 1)
 *
 * The completion overlay already delivers THE MOMENT ("you did it, 3 stars").
 * This resolves what it should also deliver: THE CONSEQUENCE — what changed in
 * the piece because of this attempt. Pure: no React, no IO, no catalog.
 * ----------------------------------------------------------------- */

import type { TrainingNode } from "@/lib/training/path";

/** What the overlay announces BESIDES the attempt's result. One per overlay:
 *  it is a moment, not a list, and 390px do not stretch. */
export type TrainingConsequence =
  | { kind: "mastery" }
  | { kind: "badge_ready" }
  | { kind: "challenge_unlocked"; nodeId: string }
  /** Floor of the EXERCISE lane. `required` is the badge GATE, never the pool
   *  size: a player on 7 reading "7 of 10" thinks three are left when one is. */
  | { kind: "badge_progress"; done: number; required: number }
  /** Floor of the CHALLENGE lane. `total` is the length of the PROJECTED lane
   *  (`projectSpecialTrainingLane`), never the raw labyrinth catalog. */
  | { kind: "lane_progress"; done: number; total: number };

/** A key in `CONSEQUENCE_COPY` plus the numbers it interpolates. */
export type ConsequenceMessage = {
  key:
    | "mastery"
    | "badgeReady"
    | "challengeUnlocked"
    | "badgeProgress"
    | "laneProgress"
    | "laneComplete";
  values?: Record<string, number>;
};

/**
 * Which sentence a rung is said with. Pure and translator-agnostic so BOTH
 * overlays (challenge in 1B, exercise in 1C) resolve it the same way.
 *
 * ⛔ It lives here, and not inline in a component, for one rule: a finished
 * lane does NOT say "4 of 4, the crown is at the end" — that sentence is false
 * at the exact moment the player clears it, which is the dead-end reading AC-4
 * forbids. Duplicated across two overlays that rule would drift, and the drift
 * would only show on the last level of a lane, in one of the two surfaces.
 */
export function consequenceMessage(
  consequence: TrainingConsequence,
): ConsequenceMessage {
  switch (consequence.kind) {
    case "mastery":
      return { key: "mastery" };
    case "badge_ready":
      return { key: "badgeReady" };
    case "challenge_unlocked":
      return { key: "challengeUnlocked" };
    case "badge_progress":
      return {
        key: "badgeProgress",
        values: {
          done: consequence.done,
          required: consequence.required,
        },
      };
    case "lane_progress":
      return consequence.done >= consequence.total
        ? { key: "laneComplete" }
        : {
            key: "laneProgress",
            values: { done: consequence.done, total: consequence.total },
          };
  }
}

/**
 * Resolve the one consequence to announce, or `null` when there is nothing.
 *
 * ⛔ Takes the TRANSITION, not the state. A path snapshot says STATE, and three
 * of the five rungs are transitions: `badge_ready` is true from the moment the
 * badge is earned until it is claimed, and an available challenge stays
 * available until it is beaten. Read off a snapshot they would fire in EVERY
 * overlay for the whole period — the player would see "your badge is ready"
 * five times, and by the third would stop reading the overlay, which is the
 * exact channel this feature exists to open.
 *
 * `null` is not an edge case, it is half the design: with transitions, replaying
 * something already finished changes nothing, so the overlay stays byte-identical
 * to today's. An overlay that announces progress when nothing happened lies, and
 * once it lies the player stops reading it.
 *
 * The LADDER — precedence, never accumulation. One rung, the highest that
 * applies: `mastery` > `badge_ready` > `challenge_unlocked` > the lane floor.
 * Which floor is decided by the LANE of the node that just completed, not by
 * which overlay is asking — one resolver serves both.
 *
 * Both snapshots must come from the PROJECTED lane. The king's raw lane holds 1
 * level and the knight's 5; neither is what the player sees.
 */
export function resolveConsequence(
  before: readonly TrainingNode[],
  after: readonly TrainingNode[],
): TrainingConsequence | null {
  const was = new Map(before.map((node) => [node.id, node.status]));

  // ── The stale-snapshot guard, before any rung ────────────────────
  // An attempt completes EXACTLY ONE playable node. Zero means nothing was
  // played (a replay of something already finished) and there is nothing to
  // announce. Two or more means the snapshots do not describe one attempt:
  // `before` never hydrated, or the catalog changed between them — and
  // announcing off that would credit the player with levels they finished
  // days ago, which is the one way this feature can lie, silently.
  //
  // Milestone nodes are deliberately outside the count: `badge` and `mastery`
  // are SUPPOSED to flip in the same step as the node that moved them.
  const justCompleted = after.filter(
    (node) =>
      (node.kind === "exercise" || node.kind === "labyrinth") &&
      node.status === "complete" &&
      was.get(node.id) !== "complete",
  );
  if (justCompleted.length !== 1) return null;
  const completed = justCompleted[0];

  // Different id sets = different catalogs. Nothing derived across them holds.
  if (before.length !== after.length || after.some((n) => !was.has(n.id))) {
    return null;
  }

  const crowned = after.find(
    (node) =>
      node.kind === "mastery" &&
      node.status === "complete" &&
      was.get(node.id) !== "complete",
  );
  if (crowned) return { kind: "mastery" };

  const badgeEarned = after.find(
    (node) =>
      node.kind === "badge" &&
      node.status === "available" &&
      was.get(node.id) === "locked",
  );
  if (badgeEarned) return { kind: "badge_ready" };

  const unlocked = after.find(
    (node) =>
      node.kind === "labyrinth" &&
      node.status === "available" &&
      was.get(node.id) === "locked",
  );
  if (unlocked) return { kind: "challenge_unlocked", nodeId: unlocked.id };

  // ── The floor: chosen by the LANE of the node just completed ─────
  if (completed.kind === "exercise") {
    const badge = after.find((node) => node.kind === "badge");
    if (badge?.unlock.type !== "completion") return null;
    const done = after.filter(
      (node) => node.kind === "exercise" && node.status === "complete",
    ).length;
    const required = badge.unlock.min;
    // Above the gate the remaining solves move nothing: no floor, no line.
    // This is `null` earning its keep, not a hole in the ladder.
    if (done >= required) return null;
    return { kind: "badge_progress", done, required };
  }

  if (completed.kind === "labyrinth") {
    const lane = after.filter((node) => node.kind === "labyrinth");
    return {
      kind: "lane_progress",
      done: lane.filter((node) => node.status === "complete").length,
      total: lane.length,
    };
  }

  return null;
}
