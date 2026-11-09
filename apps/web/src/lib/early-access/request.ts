/**
 * Web Early Access — the request (intake) contract.
 *
 * ⚠️ READ THIS BEFORE CHANGING THE STATUS VOCABULARY.
 *
 * This module does NOT grant access, and neither does the table behind it.
 * Access to Chesscito Web is granted by ONE system: Privy's own allowlist
 * (Dashboard → Users → Access Control). Privy's login server enforces it, so a
 * player who is not on that list cannot obtain a session no matter what our
 * database says, and cannot be kept out by us once they are on it.
 *
 * That is why the terminal status is `allowlisted` and not `approved`.
 * `approved` reads like a decision this system made, which would quietly turn
 * our table into a second source of truth for a fact it does not own. The row
 * is a RECORD OF AN ACTION TAKEN IN PRIVY, and its name says so: for
 * `allowlisted` to be true, somebody must have added that email to the Privy
 * allowlist first. The operational order is fixed and one-directional:
 *
 *     1. add the email to the Privy allowlist   ← this is what grants
 *     2. mark the row `allowlisted`             ← this only records
 *
 * Reversing those two leaves a row claiming access for somebody who cannot log
 * in. Nothing in the app reads this status to decide anything.
 *
 * The table exists for exactly two jobs: an ordered queue for the founder to
 * work through, and the first step of the research funnel (requested → …).
 */

/** Where a request can be in the operational queue.
 *
 *  - `waiting`     — asked for a key; NOT on the Privy allowlist.
 *  - `allowlisted` — the email has been added to the Privy allowlist. Recorded
 *    here after the fact; this value never causes access by itself. */
export const EARLY_ACCESS_STATUSES = ["waiting", "allowlisted"] as const;
export type EarlyAccessStatus = (typeof EARLY_ACCESS_STATUSES)[number];

/**
 * What a POST actually did.
 *
 * Both outcomes show the player the same confirmation — asking twice is not an
 * error, and telling somebody "you already asked" adds nothing for them. The
 * distinction is kept for research: a repeat request is an intent signal, and
 * it is the only way to tell "25 people asked" from "9 people asked, some
 * twice".
 */
export type EarlyAccessOutcome = "created" | "already-requested";

/** Longest address RFC 5321 allows on the wire. Also what keeps a megabyte of
 *  junk from reaching the database as a "malformed email". */
const MAX_EMAIL_LENGTH = 254;
/** RFC 5321 caps the local part at 64 octets. */
const MAX_LOCAL_LENGTH = 64;

/**
 * Deliberately NOT an RFC-complete grammar.
 *
 * A permissive regex here is the right trade: the value is not a credential
 * and grants nothing (see the header). It has to be (a) safe to store, (b)
 * usable as a stable primary key, and (c) recognisable to the founder, who
 * pastes it into the Privy dashboard by hand. Rejecting a valid-but-exotic
 * address would lock a real player out of even ASKING; accepting a slightly
 * odd one costs a row in a queue somebody reads with their eyes.
 *
 * What it does refuse is anything that cannot be an address at all: no `@`,
 * more than one `@`, whitespace anywhere, an empty side, or a domain with no
 * dot.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalize an email into the exact form stored as the primary key, or `null`
 * when it cannot be one.
 *
 * Trim + lowercase is the whole normalization, and it is what makes the
 * uniqueness constraint mean what a human means by "the same person":
 * `" Ana@Example.com "` and `"ana@example.com"` must not become two rows in a
 * 25-slot queue. This runs SERVER-SIDE on the value from the request body —
 * the client's normalization is a convenience, never the one that counts.
 *
 * Casing of the local part is technically significant per RFC 5321 and
 * ignored by every mail provider in practice; Privy's allowlist matches
 * case-insensitively too, so lowercasing keeps our key and theirs in the same
 * shape.
 */
export function normalizeEarlyAccessEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  const email = raw.trim().toLowerCase();

  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return null;
  if (!EMAIL_RE.test(email)) return null;

  const [local] = email.split("@");
  if (local.length > MAX_LOCAL_LENGTH) return null;

  return email;
}
