/**
 * Canonical activation-funnel event vocabulary + backward-compatible shim.
 *
 * The catalog has ~120 historical event names and several that mean the same
 * thing (`exercise_complete` vs `training_exercise_completed` vs
 * `play_tactics_completed`). Rather than rename ~120 call sites (out of scope)
 * or double-write canonical events (which would risk double-counting), we map
 * aliases → canonical at READ time. The canonical names below are the query
 * vocabulary for funnels; each one is fed by the union of its aliases.
 *
 * Only the 5 activation-funnel steps are normalized here. Everything else keeps
 * its existing name.
 */

export const CANONICAL_EVENTS = {
  app_opened: ["app_opened"],
  hub_viewed: ["hub_viewed", "hub_view", "play_hub_view"],
  exercise_started: [
    "exercise_started",
    "training_exercise_started",
    "daily_tactic_started",
    "play_tactics_opened",
  ],
  exercise_completed: [
    "exercise_completed",
    "exercise_complete",
    "training_exercise_completed",
    "play_tactics_completed",
  ],
  daily_focus_completed: ["daily_focus_completed", "daily_tactic_completed"],
} as const;

export type CanonicalEvent = keyof typeof CANONICAL_EVENTS;

/** Ordered funnel steps (activation). */
export const ACTIVATION_FUNNEL: readonly CanonicalEvent[] = [
  "app_opened",
  "hub_viewed",
  "exercise_started",
  "exercise_completed",
  "daily_focus_completed",
];

/** Flat list of every raw event name that feeds any canonical step — for a
 *  single `in (...)` query. */
export const ALL_FUNNEL_ALIASES: readonly string[] = Array.from(
  new Set(Object.values(CANONICAL_EVENTS).flat()),
);

const ALIAS_TO_CANONICAL: Record<string, CanonicalEvent> = Object.fromEntries(
  Object.entries(CANONICAL_EVENTS).flatMap(([canonical, aliases]) =>
    aliases.map((alias) => [alias, canonical as CanonicalEvent]),
  ),
);

/** Raw event name → canonical funnel step, or `null` if it is not a funnel
 *  event. */
export function canonicalEventFor(event: string): CanonicalEvent | null {
  return ALIAS_TO_CANONICAL[event] ?? null;
}

/* ── Access funnel ──────────────────────────────────────────────────────────
   "¿Logran entrar y llegar al valor?" — the door is now mandatory (there is no
   `Continue as Guest`), so every drop between these steps is a person who never
   reached the product at all.

   The last step deliberately is NOT `wallet_ready`: having a wallet is
   plumbing, not value. Entering only counts once a first exercise is finished,
   so the funnel spans door → value in one read. */

export const ACCESS_FUNNEL: readonly AccessStep[] = [
  "gate_viewed",
  "login_started",
  "login_succeeded",
  "wallet_ready",
  "first_exercise_completed",
] as const;

export type AccessStep =
  | "gate_viewed"
  | "login_started"
  | "login_succeeded"
  | "wallet_ready"
  | "first_exercise_completed";

/** Raw event names feeding each access step. The terminal step reuses the
 *  activation vocabulary rather than redeclaring it, so a new completion alias
 *  registered for activation is picked up here too. */
export const ACCESS_EVENTS: Record<AccessStep, readonly string[]> = {
  gate_viewed: ["web_access_gate_viewed"],
  login_started: ["web_login_started"],
  login_succeeded: ["web_login_succeeded"],
  wallet_ready: ["web_wallet_ready"],
  first_exercise_completed: CANONICAL_EVENTS.exercise_completed,
};

/** Emitted when Privy rejects/aborts a login. NOT a funnel step: the same
 *  session can fail and then succeed, so it is reported beside the funnel as a
 *  friction counter, never subtracted from it. */
export const ACCESS_FAILURE_EVENT = "web_login_failed";

/** Every raw name the access funnel reads, for a single `in (...)` query. */
export const ALL_ACCESS_ALIASES: readonly string[] = Array.from(
  new Set([...Object.values(ACCESS_EVENTS).flat(), ACCESS_FAILURE_EVENT]),
);

const ALIAS_TO_ACCESS: Record<string, AccessStep> = Object.fromEntries(
  Object.entries(ACCESS_EVENTS).flatMap(([step, aliases]) =>
    aliases.map((alias) => [alias, step as AccessStep]),
  ),
);

/** Raw event name → access step, or `null` if it is not an access event. */
export function accessStepFor(event: string): AccessStep | null {
  return ALIAS_TO_ACCESS[event] ?? null;
}
