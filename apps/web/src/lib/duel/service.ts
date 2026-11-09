/**
 * The two things every duel route does around the pure layer: read a duel with
 * the clock already applied, and record the four events the metric is made of.
 *
 * Both live here rather than in five route files so they cannot drift apart —
 * and so the decisions in them can be tested against a fake repository instead
 * of a running Next.
 */

import type { DuelRepository } from "./repository";
import { materialize } from "./lifecycle";
import type { Duel, DuelColor, DuelOutcome } from "./types";

export type LoadResult =
  | { status: "found"; duel: Duel }
  | { status: "not-found" }
  | { status: "error" };

/**
 * Read a duel and hand back the state the CLOCK says it is in, persisting that
 * only as a side effect.
 *
 * ⛔ The write inside a read can fail, and when it does the caller still gets
 * the materialized state. Expiration and the fallen flag are functions of TIME,
 * not permissions to write: a duel whose hour passed is expired whether or not
 * the row says so yet, and answering `active` because an UPDATE failed would
 * show a live board for a game that is over.
 *
 * ⚠️ A `stale` commit is equally uninteresting: it means somebody else's
 * request materialized the same thing first, which is the outcome we wanted.
 */
export async function loadMaterialized(
  repo: DuelRepository,
  id: string,
  now: number,
): Promise<LoadResult> {
  const found = await repo.find(id);
  if (found.status !== "found") return found;

  const { duel, changed } = materialize(found.duel, now);
  if (changed) {
    // The version it materialized FROM. Deliberately unchecked: see above.
    await repo.commit(duel, duel.version - 1);
  }
  return { status: "found", duel };
}

// ── the metric ──────────────────────────────────────────────────────

/**
 * ⛔ The metric the founder fixed is *"duels with at least one move from EACH
 * seat"* — not duels created. A link nobody answers proves nothing, and a link
 * answered by somebody who never moves proves only that they clicked.
 *
 * That is why `duel_first_move` carries the seat and fires at most twice per
 * duel: a duel with both is a duel that was actually played, and it costs two
 * rows instead of one per move.
 */
export type DuelEventName =
  | "duel_created"
  | "duel_joined"
  | "duel_first_move"
  | "duel_finished";

export type DuelEventClient = {
  from(table: string): { insert(row: Record<string, unknown>): PromiseLike<unknown> };
};

export type DuelEventInput = {
  event: DuelEventName;
  duelId: string;
  /**
   * ⚠️ The visit id the CLIENT owns, exactly as every other event in this app.
   *
   * Minting a synthetic session per duel would land these rows in the same
   * table the `stats_*` RPCs read and inflate `events/session` and the session
   * counts on the public `/stats` page — a metric bought by corrupting three
   * others. The server still stamps the event itself, so its CONTENT cannot be
   * forged; only the identity of the visit comes from the client, which is
   * already true of the whole funnel.
   */
  sessionId: string | null;
  props?: Record<string, string | number | boolean | null>;
};

/**
 * Best-effort by design, like the rest of the telemetry in this repo: a lost
 * event must never cost a player their move. It follows that the numbers are a
 * SUB-count and should be read as a floor, never as a total.
 */
export async function recordDuelEvent(
  client: DuelEventClient | null,
  input: DuelEventInput,
): Promise<void> {
  if (!client) return;
  // No session, no row: a synthetic one would pollute the session metrics this
  // table also feeds, which is worse than missing an event.
  if (!input.sessionId) return;

  try {
    await client.from("analytics_events").insert({
      session_id: input.sessionId,
      event: input.event,
      props: { duel_id: input.duelId, ...input.props },
    });
  } catch {
    // Swallowed on purpose. See the note above.
  }
}

/** Which event, if any, a freshly applied move is worth recording. */
export function firstMoveEvent(before: Duel, after: Duel): DuelColor | null {
  // ply 1 is white's first, ply 2 is black's. Anything later is just a move.
  if (before.moves.length === 0 && after.moves.length === 1) return "w";
  if (before.moves.length === 1 && after.moves.length === 2) return "b";
  return null;
}

/** The reason a duel ended, flattened for telemetry props. */
export function outcomeReason(outcome: DuelOutcome | null): string | null {
  if (!outcome) return null;
  return outcome.kind === "draw" ? `draw:${outcome.reason}` : outcome.kind;
}
