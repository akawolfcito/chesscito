/**
 * Whether the duel is DISCOVERABLE.
 *
 * ⛔ THIS GATES DISCOVERY, NOT THE FEATURE. It hides the fourth card in the
 * PLAY opponent picker and nothing else. The routes, the link and the Arena all
 * keep working, on purpose: a gate on the routes would break an invitation that
 * had already been handed out, and the whole product is a link somebody keeps.
 *
 * ⚠️ Why a gate exists at all, and it is not caution by default:
 *
 *   - The spec's scope is "two people who are ALREADY inside". Cold contacts
 *     are an explicit non-goal, and a card visible to everyone contradicts it.
 *   - Every web guest who accepts an invitation is a LOGIN against a capacity
 *     budget that is small. A duel is a machine for handing out links, and
 *     links get forwarded.
 *   - The dead-end for a guest without allowlist access is accepted debt. Left
 *     open to the world, strangers are the ones who find it.
 *
 * ⛔ ABSENT MEANS OFF. An environment nobody configured is a closed one, so
 * production is safe by default and a forgotten variable can never open the
 * door. Only `"true"` opens it.
 *
 * ⚠️ And the value lives ONLY in the deployment environment, never in a file
 * this repo tracks — `.env` is gitignored and `.env.template` carries no
 * values. That is what makes promoting `main` to production unable to change
 * what production shows.
 */
export const DUEL_DISCOVERY_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DUEL === "true";
