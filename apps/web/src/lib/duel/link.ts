/**
 * The link a player hands to a friend.
 *
 * ⛔ TWO RULES, BOTH MEASURED ON A PHONE IN STAGE 4, AND BOTH EASY TO BREAK BY
 * WRITING THE OBVIOUS THING INSTEAD:
 *
 * 1. It is built from the duel ID, **never** from `window.location.href`. After
 *    the login round trip the address bar carries `privy_oauth_code` and
 *    `privy_oauth_state`, so a share button that copies the current URL mails
 *    the inviter's OAuth code to their friend.
 *
 * 2. It is **absolute and on the PLAY host**. In `learn` mode the middleware
 *    bounces every `/arena` cross-domain to play. The query survives that jump;
 *    the seat cookie does NOT, because it does not cross domains. A relative
 *    link shared from LEARN lands the guest somewhere their credential cannot
 *    follow.
 *
 * ⚠️ The path must stay `/[locale]/arena?duel=<id>`. That exact URL is what the
 * only P0 of the red-team was closed against — measured with Google's
 * full-page redirect on a real phone. Changing the shape invalidates the
 * measurement, not just the link.
 */

import { playOriginFrom } from "@/lib/mode-routing";

export function duelShareUrl(duelId: string, locale: string, current: URL): string {
  const url = new URL(`/${locale}/arena`, playOriginFrom(current));
  // `searchParams.set` on a fresh URL: nothing from `current` is copied, which
  // is rule 1 enforced by construction rather than by remembering to strip.
  url.searchParams.set("duel", duelId);
  return url.toString();
}
